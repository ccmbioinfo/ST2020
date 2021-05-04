from datetime import datetime
import random

import click

from flask import Flask, current_app as app
from flask.cli import with_appcontext
from minio import Minio

from .models import *
from .extensions import db
from .madmin import MinioAdmin, stager_buckets_policy
from .manage_oidc import *


def register_commands(app: Flask) -> None:
    app.cli.add_command(seed_database)
    app.cli.add_command(seed_database_for_development)
    app.cli.add_command(seed_database_minio_groups)


@click.command("db-seed")
@click.option("--force", is_flag=True, default=False)
@with_appcontext
def seed_database(force: bool) -> None:
    seed_default_admin(force)
    seed_institutions(force)
    seed_dataset_types(force)
    seed_pipelines(force)
    db.session.commit()


@click.command("db-seed-dev")
@click.option("--force", is_flag=True, default=False)
@with_appcontext
def seed_database_for_development(force: bool) -> None:
    if app.config.get("ENABLE_OIDC"):
        setup_keycloak()
    seed_default_admin(force)
    seed_institutions(force)
    seed_dataset_types(force)
    seed_pipelines(force)
    db.session.flush()
    seed_dev_groups_and_users(force)
    seed_dev_data(force)
    db.session.commit()


@click.command("db-minio-seed-groups")
@click.option("--force", is_flag=True, default=False)
@with_appcontext
def seed_database_minio_groups(force: bool) -> None:
    seed_dev_groups_and_users(force, True)
    db.session.commit()


def seed_default_admin(force: bool) -> None:
    if force or User.query.count() == 0:
        default_admin = User(
            username=app.config.get("DEFAULT_ADMIN"),
            email=app.config.get("DEFAULT_ADMIN_EMAIL"),
            is_admin=True,
            deactivated=False,
        )
        password = app.config.get("DEFAULT_PASSWORD")
        default_admin.set_password(password)
        if app.config.get("ENABLE_OIDC"):
            access_token = obtain_admin_token()
            if access_token:
                add_keycloak_user(access_token, default_admin, password)
        db.session.add(default_admin)
        app.logger.info(
            f'Created default admin "{default_admin.username}" with email "{default_admin.email}"'
        )


def seed_institutions(force: bool) -> None:
    if force or Institution.query.count() == 0:
        for institution in [
            "Alberta Children's Hospital",
            "BC Children's Hospital",
            "Children's Hospital of Eastern Ontario",
            "CHU Ste-Justine",
            "Credit Valley Hospital",
            "Hamilton Health Sciences Centre",
            "Health Sciences North",
            "International",
            "IWK Health Centre",
            "Kingston Health Sciences Centre",
            "London Health Sciences Centre",
            "Montreal Children's Hospital",
            "Mount Sinai Hospital",
            "North York General Hospital",
            "Saskatoon Health Region",
            "Stollery Children's Hospital",
            "The Hospital for Sick Children",
            "The Ottawa Hospital",
            "University Health Network",
            "Winnipeg Regional Health",
        ]:
            db.session.add(Institution(institution=institution))
        app.logger.info("Inserted institutions")


def seed_dataset_types(force: bool) -> None:
    if force or (DatasetType.query.count() == 0 and MetaDatasetType.query.count() == 0):
        for dataset_type in [
            "RES",  # Research Exome Sequencing
            "CES",  # Clinical Exome Sequencing
            "WES",  # Whole Exome Sequencing
            "CPS",  # Clinical Panel Sequencing
            "RCS",  # Research Clinome Sequencing
            "RDC",  # Research Deep Clinome Sequencing
            "RDE",  # Research Deep Exome Sequencing
            "RGS",  # Research Genome Sequencing
            "CGS",  # Clinical Genome Sequencing
            "WGS",  # Whole Genome Sequencing
            "RRS",  # Research RNA Sequencing
            "RLM",  # Research Lipidomics Mass Spectrometry
            "RMM",  # Research Metabolomics Mass Spectrometry
            "RTA",  # Research DNA Methylation array
        ]:
            db.session.add(DatasetType(dataset_type=dataset_type))

        for metadataset_type in ["Genome", "Exome", "RNA", "Other"]:
            db.session.add(MetaDatasetType(metadataset_type=metadataset_type))
        db.session.flush()

        for e in ["RES", "CES", "WES", "CPS", "RCS", "RDC", "RDE"]:
            db.session.add(
                MetaDatasetType_DatasetType(metadataset_type="Exome", dataset_type=e)
            )
        for g in ["RGS", "CGS", "WGS"]:
            db.session.add(
                MetaDatasetType_DatasetType(metadataset_type="Genome", dataset_type=g)
            )
        for o in ["RLM", "RMM", "RTA"]:
            db.session.add(
                MetaDatasetType_DatasetType(metadataset_type="Other", dataset_type=o)
            )
        db.session.add(
            MetaDatasetType_DatasetType(metadataset_type="RNA", dataset_type="RRS")
        )
        app.logger.info("Inserted dataset types and meta-dataset types")


def seed_pipelines(force: bool) -> None:
    if force or Pipeline.query.count() == 0:
        crg2 = Pipeline(pipeline_name="crg2", pipeline_version="latest")
        db.session.add(crg2)
        cre = Pipeline(pipeline_name="cre", pipeline_version="latest")
        db.session.add(cre)
        dig2 = Pipeline(pipeline_name="dig2", pipeline_version="latest")
        db.session.add(dig2)
        db.session.flush()
        app.logger.info("Inserted pipelines")
        db.session.add(
            PipelineDatasets(
                pipeline_id=crg2.pipeline_id, supported_metadataset_type="Genome"
            )
        )
        db.session.add(
            PipelineDatasets(
                pipeline_id=cre.pipeline_id, supported_metadataset_type="Exome"
            )
        )
        db.session.add(
            PipelineDatasets(
                pipeline_id=dig2.pipeline_id, supported_metadataset_type="RNA"
            )
        )
        app.logger.info("Inserted supported meta-dataset types for pipelines")


def seed_dev_groups_and_users(force: bool, skip_users: bool = False) -> None:
    if force or (Group.query.count() == 0 and User.query.count() == 1):  # default admin
        minio_client = Minio(
            app.config["MINIO_ENDPOINT"],
            access_key=app.config["MINIO_ACCESS_KEY"],
            secret_key=app.config["MINIO_SECRET_KEY"],
            secure=False,
        )
        minio_admin = MinioAdmin(
            endpoint=app.config["MINIO_ENDPOINT"],
            access_key=app.config["MINIO_ACCESS_KEY"],
            secret_key=app.config["MINIO_SECRET_KEY"],
        )
        groups = {
            "c4r": "Care4Rare",
            "cheo": "Children's Hospital of Eastern Ontario",
            "bcch": "BC Children's Hospital",
            "ach": "Alberta Children's Hospital",
            "sch": "The Hospital for Sick Children",
        }
        for code, name in groups.items():
            policy = stager_buckets_policy(code)
            minio_admin.add_policy(code, policy)
            try:
                minio_client.make_bucket(code)
            except:
                app.logger.warn(f"MinIO bucket `{code}` already exists.")
            group = Group(group_code=code, group_name=name)
            db.session.add(group)

            if not skip_users:
                user = User(
                    username=f"{code}-user",
                    email=f"user@test.{code}",
                    is_admin=False,
                    deactivated=False,
                )
                user.set_password(code + "-" + app.config.get("DEFAULT_PASSWORD"))
                if app.config.get("ENABLE_OIDC"):
                    access_token = obtain_admin_token()
                    if access_token:
                        add_keycloak_user(access_token, user)
                user.groups.append(group)
                db.session.add(user)
                app.logger.info(f"Created user {user.username} in group {code}")


def seed_dev_data(force: bool) -> None:
    if not force and Family.query.count() != 0:
        return
    family_code_iter = 2000
    participant_code_iter = 1
    c4r_group = Group.query.filter_by(group_code="c4r").one()
    for group in Group.query.filter(Group.group_code != "c4r").all():
        institution = Institution.query.filter_by(
            institution=group.group_name
        ).one_or_none()
        # default to CHEO for unknown
        if not institution:
            cheo = "Children's Hospital of Eastern Ontario"
            institution = Institution.query.filter_by(institution=cheo).one_or_none()

        # create family per group
        default_family = Family(
            family_codename=str(family_code_iter), created_by_id=1, updated_by_id=1
        )
        # one analysis per trio
        analysis = Analysis(
            analysis_state=AnalysisState.Requested,
            pipeline_id=1,  # CRG
            assignee_id=1,
            requester_id=1,
            requested=datetime.now(),
            updated=datetime.now(),
            updated_by_id=1,
        )
        # build trio
        for sex in ["-", "Female", "Male"]:
            participant = Participant(
                participant_codename=f"{group.group_code.upper()}{participant_code_iter:04}",
                institution_id=institution.institution_id,
                affected=True if sex == "-" else False,
                participant_type=ParticipantType.Proband
                if sex == "-"
                else ParticipantType.Parent,
                sex=getattr(Sex, random.choice(["Female", "Male"]))
                if sex == "-"
                else getattr(Sex, sex),
                created_by_id=1,
                updated_by_id=1,
            )
            default_family.participants.append(participant)
            participant_code_iter += 1
            tissue_sample = TissueSample(
                tissue_sample_type=TissueSampleType.Blood,
                created_by_id=1,
                updated_by_id=1,
            )
            participant.tissue_samples.append(tissue_sample)
            gdataset = Dataset(
                dataset_type="RGS",
                created=datetime.now(),
                condition="GermLine",
                updated_by_id=1,
                created_by_id=1,
            )
            edataset = Dataset(
                dataset_type="RES",
                created=datetime.now(),
                condition="GermLine",
                updated_by_id=1,
                created_by_id=1,
            )
            gdataset.groups += [group, c4r_group]
            edataset.groups += [group, c4r_group]
            tissue_sample.datasets += [gdataset, edataset]
            gdataset.analyses.append(analysis)

        db.session.add(default_family)
        family_code_iter += 1
