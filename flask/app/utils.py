from csv import DictWriter, QUOTE_MINIMAL
from dataclasses import asdict, dataclass
from datetime import date, datetime, time
from enum import Enum
from functools import wraps
from io import BytesIO, StringIO
from typing import Any, Callable, Dict, List, Mapping, Union

from flask import (
    abort,
    current_app as app,
    jsonify,
    request,
    Request,
    send_file,
)
from flask.json import JSONEncoder
from flask_login import current_user
from flask_sqlalchemy import Model
from sqlalchemy import exc
from werkzeug.exceptions import HTTPException

from .extensions import db
from .madmin import MinioAdmin


def handle_error(e):
    code = 500
    if isinstance(e, HTTPException):
        code = e.code
    return jsonify(error=str(e.description)), code


def mixin(
    entity: db.Model, json_mixin: Dict[str, Any], columns: List[str]
) -> Union[None, str]:
    for field in columns:
        if field in json_mixin:
            column = getattr(entity, field)  # will be None if no value for field in db
            value = json_mixin[field]
            if isinstance(column, Enum):
                is_null_valid = (
                    entity.__table__.columns[field].nullable and value is None
                )
                if not hasattr(type(column), str(value)) and not is_null_valid:
                    allowed = [e.value for e in type(column)]
                    return f'"{field}" must be one of {allowed}'
            setattr(entity, field, value)


def check_admin(handler):
    @wraps(handler)
    def decorated_handler(*args, **kwargs):
        with app.app_context():
            if app.config.get("LOGIN_DISABLED") or current_user.is_admin:
                return handler(*args, **kwargs)
        return "Unauthorized", 401

    return decorated_handler


def validate_json(handler):
    @wraps(handler)
    def decorated_handler(*args, **kwargs):
        """ validate content-type header and run optional Validator on input """
        if request.headers.get("Content-Type") != "application/json":
            abort(415, description="Content-Type must be application/json")
        return handler(*args, **kwargs)

    return decorated_handler


# Support general paged query parameters
def paged(handler):
    @wraps(handler)
    def decorated_handler(*args, **kwargs):
        with app.app_context():
            # for some reason type=int doesn't catch non-integer queries, only returning None
            try:
                page = int(request.args.get("page", default=0))
                if page < 0:  # zero-indexed pages
                    raise ValueError
            except:
                abort(400, description="page must be a non-negative integer")
            try:
                limit = request.args.get("limit")
                if limit is not None:  # unspecified limit means return everything
                    limit = int(limit)
                    if limit <= 0:  # MySQL accepts 0 but that's just a waste of time
                        raise ValueError
            except:
                abort(400, description="limit must be a positive integer")
            return handler(*args, **kwargs, page=page, limit=limit)

    return decorated_handler


def transaction_or_abort(callback: Callable) -> None:
    try:
        callback()
    except exc.DataError as err:
        db.session.rollback()
        abort(400, description=err.orig.args[1])
    except exc.StatementError as err:
        db.session.rollback()
        abort(400, description=str(err.orig))
    except Exception as err:
        db.session.rollback()
        raise err


def enum_validate(
    entity: db.Model, json_mixin: Dict[str, any], columns: List[str]
) -> Union[None, str]:
    for field in columns:
        if field in json_mixin:
            column = getattr(entity, field)  # the column type from the entities
            value = json_mixin[field]
            if hasattr(column.type, "enums"):  # check if enum
                if value not in column.type.enums and value is not None:
                    allowed = column.type.enums
                    return f'Invalid value for: "{field}", current input is "{value}" but must be one of {allowed}'


def filter_in_enum_or_abort(column: db.Column, Allowed: Enum, values: str):
    try:
        return column.in_([Allowed(e) for e in values.split(",")])
    except ValueError as err:  # Invalid enum value
        abort(400, description=err)


def filter_nullable_bool_or_abort(column: db.Column, value: str):
    if value == "null":
        return column == None
    elif value == "true":
        return column == True
    elif value == "false":
        return column == False
    else:
        abort(400, description=f"{column.name} must be true, false, or null")


def filter_updated_or_abort(column: db.Column, value: str):
    description = "updated must be of the form before/after,iso-datetime"
    updated = value.split(",")
    if len(updated) != 2:
        abort(400, description=description)
    try:
        updated[1] = datetime.fromisoformat(updated[1])
    except ValueError as err:  # bad datetime format
        abort(400, description=err)
    if updated[0] == "before":
        return column <= updated[1]
    elif updated[0] == "after":
        return column >= updated[1]
    else:
        abort(400, description=description)


def get_minio_admin() -> MinioAdmin:
    return MinioAdmin(
        endpoint=app.config["MINIO_ENDPOINT"],
        access_key=app.config["MINIO_ACCESS_KEY"],
        secret_key=app.config["MINIO_SECRET_KEY"],
    )


def query_results_to_csv(results: List[dict or dataclass]):
    """ take a list of models and convert to csv """
    is_dict = isinstance(results[0], dict)

    if not is_dict:
        results = [asdict(result) for result in results]

    colnames = results[0].keys()

    csv_data = StringIO()
    writer = DictWriter(
        csv_data,
        fieldnames=colnames,
        quoting=QUOTE_MINIMAL,
    )
    writer.writeheader()
    for row in results:
        if isinstance(row, Model):
            row = asdict(row)
        writer.writerow(row)

    return csv_data.getvalue()


def paginated_response(results: List[Any], page: int, total: int, limit: int = None):
    return jsonify(
        {
            "data": results,
            "page": page if limit else 0,
            "total_count": total,
        }
    )


def csv_response(
    results: List[Dict[str, Any]] or List[Model],
    filename: str = "report",
    colnames: List[str] = None,
):
    """ create a csv HTTP response from a list of query results or mapping """

    if colnames:
        results = filter_keys_and_reorder(results, colnames)

    csv = query_results_to_csv(results)

    return send_file(
        BytesIO(csv.encode("utf-8")),
        "text/csv",
        as_attachment=True,
        attachment_filename=filename,
    )


def filter_keys_and_reorder(data: List[Dict[str, Any]] or List[Model], keys: List[str]):
    """ filter list item mappings and key order according to list of keys """
    return [{key: row[key] for key in keys} for row in data]


def expects_json(req: Request):
    return req.headers.get("Accept") in ["application/json", "*/*", None]


def expects_csv(req: Request):
    return req.headers.get("Accept") == "text/csv"


class DateTimeEncoder(JSONEncoder):
    """
    JSONEncoder override for encoding UTC datetimes in ISO format.
    """

    def default(self, obj):

        # handle any variant of date
        if isinstance(obj, (date, time, datetime)):
            return obj.isoformat()

        # default behaviour
        return JSONEncoder.default(self, obj)
