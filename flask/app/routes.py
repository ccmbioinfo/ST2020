import json

from flask import request
from flask_login import login_user, logout_user, current_user, login_required

from app import app, models


@app.route('/')
def index():
    return json.dumps({})


@app.route('/login', methods=['POST'])
def login():
    if current_user.is_authenticated:
        return '', 204

    body = request.json
    if not body:
        return 'Request body must be JSON!', 400

    user = models.User.query.filter_by(username=body.username).first()
    if user is None or not user.check_password(body.password):
        return 'Unauthorized', 401
    login_user(user)
    return 'Authenticated', 200


@app.route('/logout', methods=['POST'])
@login_required
def logout():
    if not request.json:
        return 'Request body must be JSON!', 400
    logout_user()
    return '', 204
