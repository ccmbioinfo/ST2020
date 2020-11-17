from datetime import datetime
import json
from typing import Any, Callable, Dict, List, Union
from dataclasses import asdict

from . import db, login, models, routes

from flask import abort, jsonify, request, Response, current_app as app
from flask_login import login_user, logout_user, current_user, login_required
from sqlalchemy import exc
from sqlalchemy.orm import aliased, contains_eager, joinedload
from werkzeug.exceptions import HTTPException


@app.route("/api/participants", methods=["GET"])
@login_required
def participants_list():
    if app.config.get("LOGIN_DISABLED") or current_user.is_admin:
        user_id = request.args.get("user")
    else:
        user_id = current_user.user_id

    if user_id:
        db_participants = (
            models.Participant.query.options(
                joinedload(models.Participant.family),
                contains_eager(models.Participant.tissue_samples).contains_eager(
                    models.TissueSample.datasets
                ),
            )
            .join(models.TissueSample)
            .join(models.Dataset)
            .join(
                models.groups_datasets_table,
                models.Dataset.dataset_id
                == models.groups_datasets_table.columns.dataset_id,
            )
            .join(
                models.users_groups_table,
                models.groups_datasets_table.columns.group_id
                == models.users_groups_table.columns.group_id,
            )
            .filter(models.users_groups_table.columns.user_id == user_id)
            .all()
        )
    else:
        db_participants = models.Participant.query.options(
            joinedload(models.Participant.family),
            joinedload(models.Participant.tissue_samples).joinedload(
                models.TissueSample.datasets
            ),
        ).all()

    participants = [
        {
            **asdict(participant),
            "family_codename": participant.family.family_codename,
            "tissue_samples": [
                {
                    **asdict(tissue_sample),
                    "datasets": tissue_sample.datasets,
                }
                for tissue_sample in participant.tissue_samples
            ],
        }
        for participant in db_participants
    ]
    return jsonify(participants)


@app.route("/api/participants/<int:id>", methods=["DELETE"])
@login_required
@routes.check_admin
def delete_participant(id: int):
    participant = (
        models.Participant.query.filter(models.Participant.participant_id == id)
        .options(joinedload(models.Participant.tissue_samples))
        .one_or_none()
    )
    if participant and not participant.tissue_samples:
        try:
            db.session.delete(participant)
            db.session.commit()
            return "Updated", 204
        except:
            db.session.rollback()
            return "Server error", 500
    elif participant:
        return "Participant has tissue samples, cannot delete", 422
    else:
        return "Not Found", 404


@app.route("/api/participants/<int:id>", methods=["PATCH"])
@login_required
def update_participant(id: int):

    if not request.json:
        return "Request body must be JSON", 415

    if app.config.get("LOGIN_DISABLED") or current_user.is_admin:
        user_id = request.args.get("user")
    else:
        user_id = current_user.user_id

    if user_id:
        table = (
            models.Participant.query.filter(models.Participant.participant_id == id)
            .join(models.TissueSample)
            .join(models.Dataset)
            .join(
                models.groups_datasets_table,
                models.Dataset.dataset_id
                == models.groups_datasets_table.columns.dataset_id,
            )
            .join(
                models.users_groups_table,
                models.groups_datasets_table.columns.group_id
                == models.users_groups_table.columns.group_id,
            )
            .filter(models.users_groups_table.columns.user_id == user_id)
            .one_or_none()
        )
    else:
        table = models.Participant.query.filter(
            models.Participant.participant_id == id
        ).one_or_none()

    if not table:
        return "Not Found", 404

    editable_columns = [
        "participant_codename",
        "sex",
        "participant_type",
        "affected",
        "solved",
        "notes",
    ]
    enum_error = routes.mixin(table, request.json, editable_columns)

    if enum_error:
        return enum_error, 400

    try:
        table.updated_by = current_user.user_id
    except:
        pass  # LOGIN_DISABLED

    routes.transaction_or_abort(db.session.commit)

    return jsonify(table)
