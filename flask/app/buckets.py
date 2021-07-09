from dataclasses import asdict
from flask import jsonify, Blueprint, current_app as app
from flask_login import current_user, login_required
from minio import Minio
from sqlalchemy.orm import joinedload
from sqlalchemy import or_

from . import models


bucket_blueprint = Blueprint(
    "buckets",
    __name__,
)


@bucket_blueprint.route("/api/unlinked", methods=["GET"])
@login_required
def get_unlinked_files():

    # temporary solution since Minio can't access the app without context
    with app.app_context():
        minioClient = Minio(
            app.config.get("MINIO_ENDPOINT"),
            access_key=app.config.get("MINIO_ACCESS_KEY"),
            secret_key=app.config.get("MINIO_SECRET_KEY"),
            secure=False,
        )

    app.logger.debug("Getting all minio bucket names..")
    all_bucket_names = [bucket.name for bucket in minioClient.list_buckets()]

    # Remove buckets the current user does not have access to assuming group_code.lower() == bucket name
    app.logger.debug("Getting all buckets that user has access to..")
    user = (
        models.User.query.filter_by(user_id=current_user.user_id)
        .options(joinedload(models.User.groups))
        .first()
    )

    valid_bucket_names = []
    for group in user.groups:
        code = group.group_code.lower()
        if code in all_bucket_names:
            valid_bucket_names.append(code)

    app.logger.debug("Getting all files in valid minio buckets..")
    all_files = []
    for bucket in valid_bucket_names:
        objs = minioClient.list_objects(bucket, recursive=True)
        for obj in objs:
            all_files.append(bucket + "/" + obj.object_name)

    app.logger.debug("Getting all linked files..")

    files = []

    linked_files = {
        f.path: True
        for f in models.File.query.filter(
            or_(models.File.multiplexed == None, models.File.multiplexed == False)
        ).all()
    }

    linkable_files = {
        f.path: True
        for f in models.File.query.filter(models.File.multiplexed == True).all()
    }

    for file_name in all_files:
        if linkable_files.get(file_name):
            files.append({"path": file_name, "multiplexed": True})
        elif not linked_files.get(file_name):
            app.logger.debug(file_name)
            files.append({"path": file_name, "multiplexed": False})

    app.logger.debug("Returning JSON array..")

    return jsonify(sorted(files, key=lambda f: f["path"]))
