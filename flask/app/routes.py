import json

from functools import wraps
from datetime import datetime

from flask import jsonify, request
from flask_login import login_user, logout_user, current_user, login_required

from app import app, db, login, models

@login.user_loader
def load_user(uid: int):
    return models.User.query.get(uid)


@app.route('/api/login', methods=['POST'])
def login():
    if current_user.is_authenticated:
        # get/update last login
        last_login = ''
        try:
            last_login = str(current_user.last_login)
            current_user.last_login = datetime.now()
            db.session.commit()
        except:
            app.logger.warning('Failed to updated last_login for {user} with timestamp {login}'.format(
                user=current_user.username,
                login=last_login))
        
        return jsonify({ "username": current_user.username, "last_login": last_login })

    body = request.json
    if not body:
        return 'Request body must be correctly-shaped JSON!', 400

    user = models.User.query.filter_by(username=body['username']).first()
    if user is None or not user.check_password(body['password']):
        return 'Unauthorized', 401

    # get/update last login
    last_login = ''
    try:
        last_login = str(user.last_login)
        user.last_login = datetime.now()
        db.session.commit()
    except:
        app.logger.warning('Failed to updated last_login for {user} with timestamp {login}'.format(
            user=user.username,
            login=last_login))
        app.logger.warning('failed to update last_login with %s', last_login)

    login_user(user)
    return jsonify({ "username": user.username, "last_login": last_login})


@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    if not request.json:
        return 'Request body must be JSON!', 400
    logout_user()
    return '', 204


def check_admin(handler):
    @wraps(handler)
    def decorated_handler(*args, **kwargs):
        if False:
            return 'Unauthorized', 401
        return handler(*args, **kwargs)

    return decorated_handler


def validate_user(request_user: dict):
    if 'username' in request_user:
        if 'password' in request_user and len(request_user['password']):
            return 'confirmPassword' in request_user and request_user['password'] == request_user['confirmPassword']
        return True
    return False


@app.route('/api/users', methods=['GET'])
@login_required
@check_admin
def user_list():
    db_users = db.session.query(models.User).all()
    users = [
        {
            'username': user.username,
            'email': user.email,
            'isAdmin': True
        }
        for user in db_users
    ]
    return json.dumps(users)


@app.route('/api/users', methods=['POST'])
@login_required
@check_admin
def create_user():
    rq_user = request.get_json()
    if not validate_user(rq_user):
        return 'Bad request', 400

    db_user = models.User.query.filter_by(username=rq_user['username']).first()
    if db_user is not None:
        return 'User already exists', 403

    if 'password' not in rq_user or 'email' not in rq_user:
        return 'Bad request', 400

    user = models.User(
        username=rq_user['username'],
        email=rq_user['email']
    )
    user.set_password(rq_user['password'])
    db.session.add(user)
    try:
        db.session.commit()
        return 'Created', 201
    except:
        db.session.rollback()
        return 'Server error', 500


@app.route('/api/users', methods=['PUT'])
@login_required
@check_admin
def update_user():
    rq_user = request.get_json()
    if not validate_user(rq_user):
        return 'Bad request', 400

    db_user = models.User.query.filter_by(username=rq_user['username']).first_or_404()
    if 'password' in rq_user and len(rq_user['password']):
        db_user.set_password(rq_user['password'])
    if 'email' in rq_user:
        db_user.email = rq_user['email']

    try:
        db.session.commit()
        return 'Updated', 204
    except:
        db.session.rollback()
        return 'Server error', 500


@app.route('/api/users', methods=['DELETE'])
@login_required
@check_admin
def delete_user():
    rq_user = request.get_json()
    if not validate_user(rq_user):
        return 'Bad request', 400

    db_user = models.User.query.filter_by(username=rq_user['username']).first_or_404()
    try:
        db.session.delete(db_user)
        db.session.commit()
        return 'Updated', 204
    except:
        db.session.rollback()
        return 'Server error', 500


@app.route('/api/password', methods=['POST'])
@login_required
def change_password():
    params = request.get_json()
    if 'current' not in params or 'password' not in params or \
        'confirm' not in params:
        return 'Bad request', 400

    if params['password'] != params['confirm']:
        return 'Passwords do not match', 400

    if not current_user.check_password(params['current']):
        return 'Incorrect password', 401

    current_user.set_password(params['password'])
    try:
        db.session.commit()
        return 'Updated', 204
    except:
        db.session.rollback()
        return 'Server error', 500
