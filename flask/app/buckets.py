from flask import request, json, jsonify, current_app as app
from flask_login import login_user, logout_user, current_user, login_required
from minio import Minio
from minio.error import ResponseError


from . import db, login, models, routes
from sqlalchemy import exc
from sqlalchemy.orm import aliased, joinedload

minioClient = Minio(
    app.config.get("MINIO_ENDPOINT"),
    access_key=app.config.get("MINIO_ACCESS_KEY"),
    secret_key=app.config.get("MINIO_SECRET_KEY"),
    secure=False,
)


@app.route("/api/unlinked", methods=["GET"])
@login_required
def get_unlinked_files():

    # Get all minio bucket names
    all_bucket_names = [bucket.name for bucket in minioClient.list_buckets()]

    # Remove buckets the current user does not have access to assuming group_code.lower() == bucket name
    user = (
        db.session.query(models.User)
        .filter_by(user_id=current_user.user_id)
        .options(joinedload(models.User.groups))
        .first()
    )

    valid_bucket_names = []
    for group in user.groups:
        code = group.group_code.lower()
        if code in all_bucket_names:
            valid_bucket_names.append(code)

    # Get all files in valid minio buckets
    all_files = []
    for bucket in valid_bucket_names:
        objs = minioClient.list_objects(bucket)
        for obj in objs:
            all_files.append(bucket + "/" + obj.object_name)

    # Get all linked files
    linked_files = {}
    for dataset in models.Dataset.query.all():
        for path in dataset.linked_files:
            linked_files[path] = ":)"

    # Put all unlinked files in new list
    unlinked_files = []
    for file_name in all_files:
        if file_name not in linked_files:
            unlinked_files.append(file_name)

    return jsonify(unlinked_files)
