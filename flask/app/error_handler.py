from flask import Blueprint, jsonify, current_app as app
from werkzeug.exceptions import HTTPException
import traceback

error_blueprint = Blueprint("error_handler", __name__)


@error_blueprint.app_errorhandler(Exception)
def handle_error(error: Exception):

    werkzeug_500_codes = [
        500,  # internal error
        501,  # not implemented
        502,  # bad gateway
        503,  # service unavailable
        504,  # gateway timeout
        505,  # http ver. not supported
    ]
    code = 500  # defaults to 500 for non HTTP exceptions
    msg = error

    if isinstance(error, HTTPException):
        code = error.code
        msg = error.description
        # 500 codes are handled as they all exist as a subclass of HTTPException
        if code in werkzeug_500_codes:
            app.logger.error(traceback.format_exc())
    return jsonify(error=str(msg)), code
