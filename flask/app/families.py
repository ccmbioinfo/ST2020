from dataclasses import asdict

from flask import abort, jsonify, request, Response, current_app as app
from flask_login import login_user, logout_user, current_user, login_required
from app import db, login, models
from sqlalchemy.orm import contains_eager, joinedload
from .routes import check_admin, transaction_or_abort


@app.route("/api/families", methods=["GET"])
@login_required
def list_families():
    starts_with = request.args.get("starts_with", default="", type=str)
    starts_with = f"{starts_with}%"
    max_rows = request.args.get("max_rows", default=100)
    order_by_col = request.args.get("order", default="family_id", type=str)
    try:
        int(max_rows)
    except:
        return "Max rows must be a valid integer", 400

    columns = models.Family.__table__.columns.keys()

    if order_by_col not in columns:
        return f"Column name for ordering must be one of {columns}", 400
    column = getattr(models.Family, order_by_col)

    if app.config.get("LOGIN_DISABLED") or current_user.is_admin:
        user_id = request.args.get("user")
    else:
        user_id = current_user.user_id

    if user_id:
        families = (
            models.Family.query.options(contains_eager(models.Family.participants))
            .filter(models.Family.family_codename.like(starts_with))
            .join(models.Participant)
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
        families = (
            models.Family.query.options(joinedload(models.Family.participants))
            .filter(models.Family.family_codename.like(starts_with))
            .order_by(column)
            .limit(max_rows)
        )

    return jsonify(
        [{**asdict(family), "participants": family.participants} for family in families]
    )


@app.route("/api/families/<int:id>", methods=["GET"])
@login_required
def get_family(id: int):
    if app.config.get("LOGIN_DISABLED") or current_user.is_admin:
        user_id = request.args.get("user")
    else:
        user_id = current_user.user_id

    if user_id:
        family = (
            models.Family.query.filter_by(family_id=id)
            .options(
                contains_eager(models.Family.participants)
                .contains_eager(models.Participant.tissue_samples)
                .contains_eager(models.TissueSample.datasets)
            )
            .join(models.Participant)
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
        family = (
            models.Family.query.filter_by(family_id=id)
            .options(
                joinedload(models.Family.participants)
                .joinedload(models.Participant.tissue_samples)
                .joinedload(models.TissueSample.datasets)
            )
            .one_or_none()
        )

    if not family:
        return "Not Found", 404

    return jsonify(
        [
            {
                **asdict(family),
                "participants": [
                    {
                        **asdict(participants),
                        "tissue_samples": [
                            {
                                **asdict(tissue_samples),
                                "datasets": tissue_samples.datasets,
                            }
                            for tissue_samples in participants.tissue_samples
                        ],
                    }
                    for participants in family.participants
                ],
            }
        ]
    )


@app.route("/api/families/<int:id>", methods=["DELETE"])
@login_required
@check_admin
def delete_family(id: int):
    family = models.Family.query.filter_by(family_id=id).options(
        joinedload(models.Family.participants)
    )

    fam_entity = family.first_or_404()

    if len(fam_entity.participants) == 0:
        try:
            family.delete()
            db.session.commit()
            return "Deletion successful", 204
        except:
            db.session.rollback()
            return "Deletion of entity failed!", 422
    else:
        return "Family has participants, cannot delete!", 422


@app.route("/api/families/<int:id>", methods=["PATCH"])
@login_required
def update_family(id: int):

    if not request.json:
        return "Request body must be JSON", 415

    try:
        fam_codename = request.json["family_codename"]
    except KeyError:
        return "No family codename provided", 400

    if app.config.get("LOGIN_DISABLED") or current_user.is_admin:
        user_id = request.args.get("user")
    else:
        user_id = current_user.user_id

    if user_id:
        family = (
            models.Family.query.filter_by(family_id=id)
            .join(models.Participant)
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
        family = models.Family.query.filter_by(family_id=id).first_or_404()

    family.family_codename = fam_codename

    if user_id:
        family.updated_by_id = user_id

    try:
        db.session.commit()
        return jsonify(family)
    except:
        db.session.rollback()
        return "Server error", 500


@app.route("/api/families", methods=["POST"])
@login_required
@check_admin
def create_family():
    if not request.json:
        return "Request body must be JSON", 415

    try:
        updated_by_id = current_user.user_id
        created_by_id = current_user.user_id
    except:  # LOGIN_DISABLED
        updated_by_id = 1
        created_by_id = 1

    fam_codename = request.json.get("family_codename")

    if not fam_codename:
        return "A family codename must be provided", 400

    if models.Family.query.filter(models.Family.family_codename == fam_codename).value(
        "family_id"
    ):
        return "Family Codename already in use", 422

    fam_objs = models.Family(
        family_codename=fam_codename,
        created_by_id=created_by_id,
        updated_by_id=updated_by_id,
    )

    db.session.add(fam_objs)
    transaction_or_abort(db.session.commit)

    location_header = "/api/families/{}".format(fam_objs.family_id)

    return jsonify(fam_objs), 201, {"location": location_header}
