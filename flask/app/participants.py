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


editable_columns = [
    "participant_codename",
    "sex",
    "participant_type",
    "affected",
    "month_of_birth",
    "solved",
    "notes",
]


@app.route("/api/participants", methods=["GET"])
@login_required
def list_participants():

    # parsing query parameters
    max_rows = request.args.get("max_rows", default=100)
    starts_with = request.args.get("starts_with", default="", type=str)
    starts_with = f"{starts_with}%"  # sql syntax
    order_by_col = request.args.get("order", default="participant_id", type=str)
    # need some default or we need an ifelse statement, one with order_by method and one without. AFAIK there is no 'default' parameter we can pass into order_by to get the default sql ordering scheme

    try:
        int(max_rows)
    except:
        return "Max rows must be a valid integer", 400

    columns = models.Participant.__table__.columns.keys()

    if order_by_col not in columns:
        return f"Column name for ordering must be one of {columns}", 400
    column = getattr(models.Participant, order_by_col)

    if app.config.get("LOGIN_DISABLED") or current_user.is_admin:
        user_id = request.args.get("user")
    else:
        user_id = current_user.user_id

    if user_id:
        participants = (
            models.Participant.query.options(
                joinedload(models.Participant.family),
                contains_eager(models.Participant.tissue_samples).contains_eager(
                    models.TissueSample.datasets
                ),
            )
            .filter(models.Participant.participant_codename.like(starts_with))
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
            .order_by(column)
            .limit(max_rows)
        )
    else:
        participants = (
            models.Participant.query.options(
                joinedload(models.Participant.family),
                joinedload(models.Participant.tissue_samples).joinedload(
                    models.TissueSample.datasets
                ),
                joinedload(models.Participant.created_by),
                joinedload(models.Participant.updated_by),
            )
            .filter(models.Participant.participant_codename.like(starts_with))
            .order_by(column)
            .limit(max_rows)
        )

    return jsonify(
        [
            {
                **asdict(participant),
                "family_codename": participant.family.family_codename,
                "updated_by": participant.updated_by.username,
                "created_by": participant.created_by.username,
                "tissue_samples": [
                    {**asdict(tissue_sample), "datasets": tissue_sample.datasets}
                    for tissue_sample in participant.tissue_samples
                ],
            }
            for participant in participants
        ]
    )


@app.route("/api/participants/<int:id>", methods=["DELETE"])
@login_required
@routes.check_admin
def delete_participant(id: int):
    participant = (
        models.Participant.query.filter(models.Participant.participant_id == id)
        .options(joinedload(models.Participant.tissue_samples))
        .first_or_404()
    )
    if not participant.tissue_samples:
        try:
            db.session.delete(participant)
            db.session.commit()
            return "Updated", 204
        except:
            db.session.rollback()
            return "Server error", 500
    else:
        return "Participant has tissue samples, cannot delete", 422


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
        participant = (
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
            .first_or_404()
        )
    else:
        participant = models.Participant.query.filter(
            models.Participant.participant_id == id
        ).first_or_404()

    enum_error = routes.mixin(participant, request.json, editable_columns)

    if enum_error:
        return enum_error, 400

    if user_id:
        participant.updated_by_id = user_id

    routes.transaction_or_abort(db.session.commit)

    return jsonify(
        [
            {
                **asdict(participant),
                "created_by": participant.created_by.username,
                "updated_by": participant.updated_by.username,
            }
        ]
    )


@app.route("/api/participants", methods=["POST"])
@login_required
@routes.check_admin
def create_participant():
    if not request.json:
        return "Request body must be JSON", 415

    try:
        updated_by_id = current_user.user_id
        created_by_id = current_user.user_id
    except:  # LOGIN_DISABLED
        updated_by_id = 1
        created_by_id = 1

    # check if the participant exists under a given family

    ptp_query = models.Participant.query.filter(
        models.Participant.family_id == request.json.get("family_id"),
        models.Participant.participant_codename
        == request.json.get("participant_codename"),
    )

    if ptp_query.first() is not None:
        return "Participant codename already exists under family", 422

    # check if family exists
    models.Family.query.filter(
        models.Family.family_id == request.json.get("family_id")
    ).first_or_404()

    # validate enums
    enum_error = routes.enum_validate(
        models.Participant, request.json, editable_columns
    )

    if enum_error:
        return enum_error, 400

    ptp_objs = models.Participant(
        family_id=request.json.get("family_id"),
        participant_codename=request.json.get("participant_codename"),
        sex=request.json.get("sex"),
        notes=request.json.get("notes"),
        affected=request.json.get("affected"),
        solved=request.json.get("solved"),
        participant_type=request.json.get("participant_type"),
        month_of_birth=request.json.get("month_of_birth"),
        created_by_id=created_by_id,
        updated_by_id=updated_by_id,
    )

    db.session.add(ptp_objs)
    routes.transaction_or_abort(db.session.commit)

    location_header = "/api/participants/{}".format(ptp_objs.participant_id)

    return (
        jsonify(
            {
                **asdict(ptp_objs),
                "created_by": ptp_objs.created_by.username,
                "updated_by": ptp_objs.updated_by.username,
            }
        ),
        201,
        {"location": location_header},
    )
