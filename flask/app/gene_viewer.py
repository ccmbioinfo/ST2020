from dataclasses import asdict

from flask import Blueprint, Response, abort, current_app as app, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy.orm import contains_eager
from sqlalchemy.sql import or_
from sqlalchemy.sql.selectable import Select
from sqlalchemy.engine.base import Engine

import pandas as pd
from . import models

from .extensions import db

from .utils import (
    check_admin,
    enum_validate,
    filter_in_enum_or_abort,
    filter_updated_or_abort,
    mixin,
    paged,
    transaction_or_abort,
)


gene_viewer_blueprint = Blueprint(
    "gene_viewer",
    __name__,
)


def get_variant_wise_df(statement: Select, session: Engine):

    df = pd.read_sql(statement, session)

    app.logger.debug(df.head(3))

    df = df[
        [
            "position",
            "reference_allele",
            "alt_allele",
            "variation",
            "refseq_change",
            "depth",
            "gene",
            "conserved_in_20_mammals",
            "sift_score",
            "polyphen_score",
            "cadd_score",
            "gnomad_af",
            "zygosity",
            "burden",
            "alt_depths",
            "dataset_id",
            "participant_id",
            "participant_codename",
            "family_id",
            "family_codename",
        ]
    ]
    df = df.loc[:, ~df.columns.duplicated()]
    # some columns are duplicated eg. dataset_id, is there a way to query so that this doesn't happen?

    df = df[~df["zygosity"].str.contains("-|Insufficient")]

    df = df.astype(str)
    df = df.groupby(["position", "reference_allele", "alt_allele"]).agg(
        {
            "variation": "first",
            "refseq_change": "first",
            "depth": list,
            "gene": "first",
            "conserved_in_20_mammals": "first",
            "sift_score": "first",
            "polyphen_score": "first",
            "cadd_score": "first",
            "gnomad_af": "first",
            "zygosity": list,
            "burden": list,
            "alt_depths": list,
            "dataset_id": list,
            "participant_id": list,
            "participant_codename": list,
            "family_id": lambda x: set(x),
            "family_codename": lambda x: set(x),
        },
        axis="columns",
    )

    df["frequency"] = df["participant_codename"].str.len()

    for col in [
        "zygosity",
        "burden",
        "alt_depths",
        "depth",
        "participant_codename",
        "family_codename",
        "dataset_id",
        "participant_id",
        "family_id",
    ]:
        df[col] = df[col].apply(lambda g: "; ".join(g))
    return df


@gene_viewer_blueprint.route("/api/summary/variants", methods=["GET"])
@login_required
def variant_summary():

    app.logger.debug("Retrieving user id..")

    if app.config.get("LOGIN_DISABLED") or current_user.is_admin:
        user_id = request.args.get("user")
        app.logger.debug("User is admin with ID '%s'", user_id)
    else:
        user_id = current_user.user_id
        app.logger.debug("User is regular with ID '%s'", user_id)

    if request.headers["Accept"] not in ["application/json", "text/csv"]:
        app.logger.error("Unsupported HTTP accept")
        abort(406, description="Unsupported HTTP accept")

    app.logger.debug("Parsing query parameters..")

    genes = request.args.getlist("genes")

    app.logger.info("Requested genes are %s", genes)

    if len(genes) == 0:

        app.logger.error("No gene(s) provided in the request body")
        abort(400, description="No gene(s) provided")

    filters = [models.Gene.gene == gene for gene in genes]

    if user_id:
        app.logger.debug("Processing query - restricted based on user id.")
        query = (
            models.Gene.query.join(models.Gene.variants)
            .join(models.Variant.genotype)
            .join(models.Genotype.analysis, models.Genotype.dataset)
            .join(models.Dataset.tissue_sample)
            .join(models.TissueSample.participant)
            .join(models.Participant.family)
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
            .options(
                contains_eager(models.Gene.variants)
                .contains_eager(models.Variant.genotype)
                .contains_eager(models.Genotype.analysis)
                .contains_eager(models.Analysis.datasets)
                .contains_eager(models.Dataset.tissue_sample)
                .contains_eager(models.TissueSample.participant)
                .contains_eager(models.Participant.family),
            )
            .filter(or_(*filters), models.users_groups_table.columns.user_id == user_id)
        )

    else:
        app.logger.debug("Processing query - unrestricted based on user id.")
        query = (
            models.Gene.query.join(models.Gene.variants)
            .join(models.Variant.genotype)
            .join(models.Genotype.analysis, models.Genotype.dataset)
            .join(models.Dataset.tissue_sample)
            .join(models.TissueSample.participant)
            .join(models.Participant.family)
            .options(
                contains_eager(models.Gene.variants)
                .contains_eager(models.Variant.genotype)
                .contains_eager(models.Genotype.analysis)
                .contains_eager(models.Analysis.datasets)
                .contains_eager(models.Dataset.tissue_sample)
                .contains_eager(models.TissueSample.participant)
                .contains_eager(models.Participant.family),
            )
            .filter(or_(*filters))
        )

    q = query.all()

    if len(q) == 0:
        app.logger.error("No requested genes were found.")
        abort(400, description="No requested genes were found.")
    elif len(q) < len(genes):
        app.logger.error("Not all requested genes were found.")
        abort(400, description="Not all requested genes were found.")

    if request.accept_mimetypes["application/json"]:

        app.logger.info("Application/json Accept header requested")
        return jsonify(
            [
                {
                    **asdict(gene),
                    "variants": [
                        {
                            **asdict(variant),
                            "zygosity": [
                                genotype.zygosity for genotype in variant.genotype
                            ],
                            "alt_depths": [
                                genotype.alt_depths for genotype in variant.genotype
                            ],
                            "burden": [
                                genotype.burden for genotype in variant.genotype
                            ],
                            "participant_codenames": [
                                dataset.tissue_sample.participant.participant_codename
                                for dataset in variant.analysis.datasets
                            ],
                        }
                        for variant in gene.variants
                    ],
                }
                for gene in q
            ]
        )

    elif request.accept_mimetypes["text/csv"]:

        app.logger.info("text/csv Accept header requested")

        try:
            agg_df = get_variant_wise_df(query.statement, query.session.bind)
        except:
            abort(500, "Unexpected error")

        csv_data = agg_df.to_csv(encoding="utf-8")

        response = Response(csv_data, mimetype="text/csv")

        response.headers.set(
            "Content-Disposition", "attachment", filename="variant_wise_report.csv"
        )

        return response
