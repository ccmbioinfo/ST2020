from functools import wraps
from enum import Enum
from typing import Any, Callable, Dict, List, Union
from datetime import date, time, datetime
from json import loads

from flask import abort, jsonify
from flask.json import JSONEncoder
from flask_login import current_user
from sqlalchemy import exc


from flask import current_app as app
from .extensions import db
from werkzeug.exceptions import HTTPException


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
            column = getattr(entity, field)
            value = json_mixin[field]
            if isinstance(column, Enum):
                if not hasattr(type(column), str(value)):
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
