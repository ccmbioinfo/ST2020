from datetime import date, datetime, time
from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, List, Union
from os import getenv

from flask import abort, current_app as app, jsonify, request
from flask.json import JSONEncoder
from flask_login import current_user
from sqlalchemy import exc
from werkzeug.exceptions import HTTPException

from .extensions import db
from .madmin import MinioAdmin
from .models import User


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


def update_last_login(user: User = None):
    """
    Update last login for given user and return login details.
    Use current_user if no user is specified.
    """
    if not user:
        user = current_user  # type: ignore

    last_login = None
    try:
        last_login = user.last_login
        user.last_login = datetime.now()
        db.session.commit()
        app.logger.info("Last login for '%s' updated..", user.username)
    except:
        app.logger.warning("Failed to updated last_login for '%s'", user.username)

    return jsonify(
        {
            "username": user.username,
            "last_login": last_login,
            "is_admin": user.is_admin,
            "groups": [group.group_code for group in user.groups],
        }
    )


def stager_is_keycloak_admin():
    """
    Return true if OIDC is enabled and if Stager is using a Keycloak
    instance with administrative access.

    In other words, return true if Stager has the ability to create users in Keycloak.
    """
    return app.config.get("ENABLE_OIDC") and getenv("KEYCLOAK_HOST") is not None


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
