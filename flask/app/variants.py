from dataclasses import asdict
from typing import Any, List

from flask import Blueprint, Response, abort, current_app as app, jsonify, request
from flask_login import current_user, login_required
import pandas as pd
from sqlalchemy import distinct, func
from sqlalchemy.orm import aliased, contains_eager
from sqlalchemy.sql import and_

from . import models
from .extensions import db
from .utils import expects_csv, expects_json


variants_blueprint = Blueprint(
    "variants",
    __name__,
)

relevant_cols = [
    "ensembl_id",
    "name",
    "chromosome",
    "position",
    "reference_allele",
    "alt_allele",
    "variation",
    "refseq_change",
    "depth",
    "conserved_in_20_mammals",
    "sift_score",
    "polyphen_score",
    "cadd_score",
    "gnomad_af",
    "zygosity",
    "burden",
    "alt_depths",
    "dataset_id",
    "participant_codename",
    "family_codename",
]


def get_report_df(df: pd.DataFrame, type: str, relevant_cols=relevant_cols):
    """
    The expected input is a de-normalized ('tidy') dataframe returned by pd.read_sql. This function subsets relevant columns and retains variants with sufficient depth to annotate zygosity.
    It then returns a sample (participant)  wise dataframe, where each row is a participant's variant, the variant annotations, and their genotype,
    or aggregates by variant, where each row is identified by a unique variant and various fields such as depth, zygosity and codenames are concatenated into a single list, delimited by a ';'.
    """

    app.logger.debug(df.head(3))

    # subsetting by a list of col names ensures ordering is consistent between the two report types

    df = df.loc[:, ~df.columns.duplicated()]
    df = df[relevant_cols]

    # some columns are duplicated eg. dataset_id, is there a way to query so that this doesn't happen?

    df = df[~df["zygosity"].str.contains("-|Insufficient")]
    df = df.fillna("")
    df = df.astype(str)
    df["ensembl_id"] = df["ensembl_id"].apply(lambda x: "ENSG" + x.rjust(11, "0"))

    if type == "participants":
        return df

    elif type == "variants":
        df = (
            df.groupby(["position", "reference_allele", "alt_allele"])
            .agg(
                {
                    "ensembl_id": set,
                    "chromosome": "first",
                    "variation": "first",
                    "refseq_change": "first",
                    "depth": list,
                    "conserved_in_20_mammals": "first",
                    "sift_score": "first",
                    "polyphen_score": "first",
                    "cadd_score": "first",
                    "gnomad_af": "first",
                    "zygosity": list,
                    "burden": list,
                    "alt_depths": list,
                    "dataset_id": list,
                    "participant_codename": list,
                    "family_codename": set,
                    "name": "first",
                },
                axis="columns",
            )
            .reset_index()
        )
        df = df[relevant_cols]

        df["frequency"] = df["participant_codename"].str.len()
        for col in [
            "ensembl_id",
            "zygosity",
            "burden",
            "alt_depths",
            "depth",
            "participant_codename",
            "family_codename",
            "dataset_id",
        ]:
            df[col] = df[col].apply(lambda g: "; ".join(g))
        return df


def parse_gene_panel() -> List[Any]:
    """
    Parses query string parameter ?panel=ENSGXXXXXXXX,ENSGXXXXXXX for the current request.
    We abort if the panel parameter is missing or malformed. If any specified gene isn't
    in our database, we also abort.
    Returns a list of filters for use against the variant table to find corresponding variants
    based on gene start and end positions.
    """
    genes = request.args.get("panel", type=str)
    if genes is None or len(genes) == 0:
        app.logger.error("No gene(s) provided in the request body")
        abort(400, description="No gene(s) provided")
    genes = genes.lower().split(",")
    app.logger.info("Requested gene panel: %s", genes)
    ensgs = set()
    errors = []
    for gene in genes:
        if gene.startswith("ensg"):
            try:
                ensgs.add(int(gene[4:]))
            except ValueError:
                errors.append(gene)
        else:
            errors.append(gene)
    if len(errors):
        app.logger.error(f"Bad gene panel: {errors}")
        abort(400, description=f"Bad gene panel: {','.join(errors)}")

    # we can't validate whether the requested genes are found in the results (if that is still desired), since gene is no longer a property like in the variant endpoint
    # this may not play well if we decide to pre-populate the entire gene table though since in that case, a gene can be found in the database but not have variants
    # Again, we customize the count query for efficiency
    query = models.Gene.query.filter(models.Gene.ensembl_id.in_(ensgs))
    found_genes = query.with_entities(
        func.count(distinct(models.Gene.ensembl_id))
    ).scalar()
    if found_genes == 0:
        app.logger.error("No requested genes were found.")
        abort(400, description="No requested genes were found.")
    elif found_genes < len(ensgs):
        app.logger.error("Not all requested genes were found.")
        abort(400, description="Not all requested genes were found.")

    genes = query.all()

    return ensgs


@variants_blueprint.route("/api/summary/<string:type>", methods=["GET"])
@login_required
def summary(type: str):
    """
    GET /api/summary/participants\?panel=ENSG00000138131
    GET /api/summary/variants\?panel=ENSG00000138131

    The same sqlalchemy query is used for both endpoints as the participant-wise report is the precursor to the variant-wise report.

    The JSON response for participants is de-normalized such that each object is a participant and a variant,
    whereas for the variant JSON response, each object is a variant, the annotations, and an array of genotypes for the involved participants.

    Similarly, the csv output for the participants is de-normalized such that each row is a participant's variant. If the requested genes span similar coordinates duplicated variants will be returned, for each gene.
    The variant csv output is a summary - each row is a unique variant with various columns collapsed and ';' delimited indicating for example, all participants that had such a variant.

    """

    if type not in ["variants", "participants"]:
        abort(404)

    if app.config.get("LOGIN_DISABLED") or current_user.is_admin:
        user_id = request.args.get("user")
        app.logger.debug("User is admin with ID '%s'", user_id)
    else:
        user_id = current_user.user_id
        app.logger.debug("User is regular with ID '%s'", user_id)

    ensgs = parse_gene_panel()

    # filter out all gene aliases except current_approved_symbol and make result an `aliased` subquery \
    # so that ORM recognizes it as the GeneAlias model when joining and eager loading
    alias_subquery = aliased(
        models.GeneAlias,
        models.GeneAlias.query.filter(
            models.GeneAlias.kind == "current_approved_symbol"
        ).subquery(),
    )

    # returns a tuple (Genes, Variants)
    query = (
        db.session.query(models.Gene, models.Variant)
        .options(
            contains_eager(models.Variant.genotype)
            .contains_eager(models.Genotype.analysis)
            .contains_eager(models.Analysis.datasets)
            .contains_eager(models.Dataset.tissue_sample)
            .contains_eager(models.TissueSample.participant)
            .contains_eager(models.Participant.family),
            contains_eager(models.Gene.aliases.of_type(alias_subquery)),
        )
        .join(
            models.Variant,
            and_(
                models.Gene.chromosome == models.Variant.chromosome,
                models.Gene.start <= models.Variant.position,
                models.Variant.position <= models.Gene.end,
            ),
        )
        .join(models.Variant.genotype)
        .join(models.Genotype.analysis, models.Genotype.dataset)
        .join(models.Dataset.tissue_sample)
        .join(models.TissueSample.participant)
        .join(models.Participant.family)
        .outerjoin(alias_subquery)
        .filter(models.Gene.ensembl_id.in_(ensgs))
    )

    if user_id:
        app.logger.debug("Processing query - restricted based on user id.")
        query = (
            query.join(
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
        )
    else:
        app.logger.debug("Processing query - unrestricted based on user id.")

    # defaults to json unless otherwise specified
    app.logger.info(request.accept_mimetypes)

    if expects_json(request):
        app.logger.info("Defaulting to json response")

        if type == "variants":

            return jsonify(
                [
                    {
                        **asdict(tup[0]),  # gene
                        "name": tup[0].aliases[0].name if tup[0].aliases else None,
                        **asdict(tup[1]),  # variants
                        "genotype": [
                            {
                                **asdict(genotype),
                                "participant_codename": genotype.dataset.tissue_sample.participant.participant_codename,
                            }
                            for genotype in tup[1].genotype
                        ],
                    }
                    for tup in query.all()
                ]
            )

        elif type == "participants":
            try:
                sql_df = pd.read_sql(query.statement, query.session.bind)
            except:
                app.logger.error(
                    "Unexpected error resulting from sqlalchemy query", exc_info=True
                )
                abort(500, "Unexpected error")

            ptp_dict = sql_df.loc[:, ~sql_df.columns.duplicated()][
                relevant_cols
            ].to_dict(orient="records")
            return jsonify(ptp_dict)

    elif expects_csv(request):
        app.logger.info("text/csv Accept header requested")
        try:
            sql_df = pd.read_sql(query.statement, query.session.bind)
        except:
            app.logger.error(
                "Unexpected error resulting from sqlalchemy query", exc_info=True
            )
            abort(500, "Unexpected error")

        agg_df = get_report_df(sql_df, type=type)
        csv_data = agg_df.to_csv(encoding="utf-8", index=False)

        response = Response(csv_data, mimetype="text/csv")
        response.headers.set(
            "Content-Disposition",
            "attachment",
            filename="{}_wise_report.csv".format(type[:-1]),
        )
        return response
    else:
        app.logger.error(
            "Only 'text/csv' and 'application/json' HTTP accept headers supported"
        )
        abort(
            406, "Only 'text/csv' and 'application/json' HTTP accept headers supported"
        )
