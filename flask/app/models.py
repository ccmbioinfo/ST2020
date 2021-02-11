from dataclasses import dataclass
from datetime import datetime, date
from enum import Enum
from typing import List
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import CheckConstraint

from . import db


users_groups_table = db.Table(
    "users_groups",
    db.Model.metadata,
    db.Column("user_id", db.Integer, db.ForeignKey("user.user_id")),
    db.Column("group_id", db.Integer, db.ForeignKey("group.group_id")),
)


class User(UserMixin, db.Model):
    user_id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(30), nullable=False, unique=True)
    password_hash = db.Column(db.String(200), nullable=False, unique=False)
    email = db.Column(db.String(150), nullable=False, unique=True)
    is_admin = db.Column(db.Boolean, unique=False, default=False)
    last_login = db.Column(db.DateTime)
    deactivated = db.Column(db.Boolean, unique=False, nullable=False, default=False)
    minio_access_key = db.Column(db.String(150))
    minio_secret_key = db.Column(db.String(150))

    groups = db.relationship("Group", secondary=users_groups_table, backref="users")

    def set_password(self, password):
        self.password_hash = generate_password_hash(
            password, method="pbkdf2:sha256:50000"
        )

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def get_id(self):
        return self.user_id


@dataclass
class Group(db.Model):
    group_id: int = db.Column(db.Integer, primary_key=True)
    group_code: str = db.Column(
        db.String(50),
        CheckConstraint(
            "LENGTH(group_code) > 2 AND group_code REGEXP '^[a-z,0-9,-]*$' AND BINARY group_code = LOWER(group_code)"
        ),
        nullable=False,
        unique=True,
    )
    group_name: str = db.Column(
        db.String(250), nullable=False, unique=True
    )  # full group name


@dataclass
class Family(db.Model):
    family_id: int = db.Column(db.Integer, primary_key=True)
    family_codename: str = db.Column(db.String(50), nullable=False, unique=True)
    family_aliases: str = db.Column(db.String(100))
    created: str = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    created_by_id = db.Column(
        db.Integer, db.ForeignKey("user.user_id", onupdate="cascade"), nullable=False
    )
    updated: str = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    updated_by_id = db.Column(
        db.Integer, db.ForeignKey("user.user_id", onupdate="cascade"), nullable=False
    )
    participants = db.relationship("Participant", backref="family")

    updated_by = db.relationship("User", foreign_keys=[updated_by_id], lazy="joined")
    created_by = db.relationship("User", foreign_keys=[created_by_id], lazy="joined")


class Sex(str, Enum):
    Male = "Male"
    Female = "Female"
    Unknown = "Unknown"
    Other = "Other"


class ParticipantType(str, Enum):
    Proband = "Proband"
    Parent = "Parent"
    Sibling = "Sibling"
    Other = "Other"


@dataclass
class Participant(db.Model):
    participant_id: int = db.Column(db.Integer, primary_key=True)
    family_id = db.Column(db.Integer, db.ForeignKey("family.family_id"), nullable=False)
    participant_codename: str = db.Column(db.String(50), nullable=False, unique=True)
    participant_aliases: str = db.Column(db.String(100))
    sex: Sex = db.Column(db.Enum(Sex))
    participant_type: ParticipantType = db.Column(db.Enum(ParticipantType))
    month_of_birth: date = db.Column(
        db.Date, CheckConstraint("DAY(month_of_birth) = 1")
    )
    institution_id = db.Column(
        db.Integer, db.ForeignKey("institution.institution_id", onupdate="cascade")
    )
    affected: bool = db.Column(db.Boolean)
    solved: bool = db.Column(db.Boolean)  # TODO uncomment and rebuild
    notes: str = db.Column(db.Text)
    created: datetime = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    created_by_id = db.Column(
        db.Integer, db.ForeignKey("user.user_id", onupdate="cascade"), nullable=False
    )
    updated: datetime = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    updated_by_id = db.Column(
        db.Integer, db.ForeignKey("user.user_id", onupdate="cascade"), nullable=False
    )
    tissue_samples = db.relationship("TissueSample", backref="participant")
    institution = db.relationship("Institution", foreign_keys=[institution_id])
    updated_by = db.relationship("User", foreign_keys=[updated_by_id])
    created_by = db.relationship("User", foreign_keys=[created_by_id])


@dataclass
class Institution(db.Model):
    institution_id: int = db.Column(db.Integer, primary_key=True)
    institution: str = db.Column(db.String(100), unique=True, nullable=False)


class TissueSampleType(str, Enum):
    Blood = "Blood"  # BLO
    Saliva = "Saliva"  # SAL
    Lymphocyte = "Lymphocyte"  # LYM
    Fibroblast = "Fibroblast"  # FIB
    Muscle = "Muscle"  # MUS
    Skin = "Skin"  # SKI
    Urine = "Urine"  # URI
    Plasma = "Plasma"  # PLA
    Unknown = "Unknown"  # UNK
    Kidney = "Kidney"  # KID


class TissueProcessing(str, Enum):
    FreshFrozen = "FF"
    Formaldehyde = "FFPE"


@dataclass
class TissueSample(db.Model):
    tissue_sample_id: int = db.Column(db.Integer, primary_key=True)
    participant_id: int = db.Column(
        db.Integer, db.ForeignKey("participant.participant_id"), nullable=False
    )
    extraction_date: datetime = db.Column(db.Date)
    tissue_sample_type: TissueSampleType = db.Column(
        db.Enum(TissueSampleType), nullable=False
    )
    tissue_processing: TissueProcessing = db.Column(db.Enum(TissueProcessing))
    notes: str = db.Column(db.Text)
    created: datetime = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    created_by_id = db.Column(
        db.Integer, db.ForeignKey("user.user_id", onupdate="cascade"), nullable=False
    )
    updated: datetime = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.now
    )
    updated_by_id = db.Column(
        db.Integer, db.ForeignKey("user.user_id", onupdate="cascade"), nullable=False
    )
    datasets = db.relationship("Dataset", backref="tissue_sample")
    updated_by = db.relationship("User", foreign_keys=[updated_by_id])
    created_by = db.relationship("User", foreign_keys=[created_by_id])


@dataclass
class DatasetType(db.Model):
    __tablename__ = "dataset_type"
    dataset_type: str = db.Column(db.String(50), primary_key=True)


@dataclass
class MetaDatasetType(db.Model):
    __tablename__ = "metadataset_type"
    metadataset_type: str = db.Column(db.String(50), primary_key=True)


@dataclass
class MetaDatasetType_DatasetType(db.Model):
    __tablename__ = "metadataset_type_dataset_type"
    dataset_type: str = db.Column(
        db.String(50),
        db.ForeignKey("dataset_type.dataset_type"),
        nullable=False,
        unique=True,
        primary_key=True,
    )
    metadataset_type: str = db.Column(
        db.String(50),
        db.ForeignKey("metadataset_type.metadataset_type"),
        nullable=False,
        primary_key=True,
    )


# Name TBD
class DatasetCondition(str, Enum):
    Control = "Control"
    GermLine = "GermLine"  # e.g. rare diseases
    Somatic = "Somatic"  # e.g. cancer


class DatasetReadType(str, Enum):
    PairedEnd = "PairedEnd"
    SingleEnd = "SingleEnd"


groups_datasets_table = db.Table(
    "groups_datasets",
    db.Model.metadata,
    db.Column("group_id", db.Integer, db.ForeignKey("group.group_id")),
    db.Column("dataset_id", db.Integer, db.ForeignKey("dataset.dataset_id")),
)


datasets_analyses_table = db.Table(
    "datasets_analyses",
    db.Model.metadata,
    db.Column("dataset_id", db.Integer, db.ForeignKey("dataset.dataset_id")),
    db.Column("analysis_id", db.Integer, db.ForeignKey("analysis.analysis_id")),
)


@dataclass
class Dataset(db.Model):
    __tablename__ = "dataset"
    tissue_sample_id: int = db.Column(
        db.Integer, db.ForeignKey("tissue_sample.tissue_sample_id"), nullable=False
    )
    dataset_id: int = db.Column(db.Integer, primary_key=True)
    dataset_type: str = db.Column(
        db.String(50), db.ForeignKey("dataset_type.dataset_type"), nullable=False
    )
    notes: str = db.Column(db.Text)
    condition: DatasetCondition = db.Column(db.Enum(DatasetCondition), nullable=False)
    extraction_protocol: str = db.Column(db.String(100))
    capture_kit: str = db.Column(db.String(50))
    library_prep_method: str = db.Column(db.String(50))
    library_prep_date: datetime = db.Column(db.Date)
    read_length: int = db.Column(db.Integer)
    read_type: DatasetReadType = db.Column(db.Enum(DatasetReadType))
    sequencing_id: str = db.Column(db.String(50))
    sequencing_date: datetime = db.Column(db.Date)
    sequencing_centre: str = db.Column(db.String(100))
    batch_id: str = db.Column(db.String(50))
    created: datetime = db.Column(db.DateTime, default=datetime.utcnow)
    created_by_id = db.Column(
        db.Integer, db.ForeignKey("user.user_id", onupdate="cascade"), nullable=False
    )
    updated: datetime = db.Column(
        db.DateTime, nullable=False, onupdate=datetime.now, default=datetime.utcnow
    )
    updated_by_id = db.Column(
        db.Integer, db.ForeignKey("user.user_id", onupdate="cascade"), nullable=False
    )

    discriminator = db.Column(db.Enum("dataset", "rnaseq_dataset"))
    __mapper_args__ = {
        "polymorphic_identity": "dataset",
        "polymorphic_on": discriminator,
    }

    analyses = db.relationship(
        "Analysis", secondary=datasets_analyses_table, backref="datasets"
    )
    groups = db.relationship(
        "Group", secondary=groups_datasets_table, backref="datasets"
    )
    updated_by = db.relationship("User", foreign_keys=[updated_by_id], lazy="joined")
    created_by = db.relationship("User", foreign_keys=[created_by_id], lazy="joined")

    files = db.relationship(
        "DatasetFile",
        backref="dataset",
        cascade="all, delete",
        passive_deletes=True,
        lazy="joined",
    )
    linked_files: List[str]

    @property
    def linked_files(self) -> List[str]:
        return [x.path for x in self.files]


@dataclass
class RNASeqDataset(Dataset):
    __tablename__ = "rnaseq_dataset"
    dataset_id: int = db.Column(
        db.Integer,
        db.ForeignKey("dataset.dataset_id", onupdate="cascade", ondelete="cascade"),
        primary_key=True,
    )
    RIN: float = db.Column(db.Float)
    DV200: int = db.Column(db.Integer)
    concentration: float = db.Column(db.Float)
    sequencer: str = db.Column(db.String(50))
    spike_in: str = db.Column(db.String(50))

    __mapper_args__ = {"polymorphic_identity": "rnaseq_dataset"}


@dataclass
class DatasetFile(db.Model):
    file_id = db.Column(db.Integer, primary_key=True)
    dataset_id = db.Column(
        db.Integer,
        db.ForeignKey("dataset.dataset_id", onupdate="cascade", ondelete="cascade"),
        nullable=False,
    )
    path: str = db.Column(db.String(500), nullable=False, unique=True)


class AnalysisState(str, Enum):
    Requested = "Requested"
    Running = "Running"
    Done = "Done"
    Error = "Error"
    Cancelled = "Cancelled"


@dataclass
class Analysis(db.Model):
    analysis_id: int = db.Column(db.Integer, primary_key=True)
    analysis_state: AnalysisState = db.Column(db.Enum(AnalysisState), nullable=False)
    pipeline = db.relationship("Pipeline")
    pipeline_id: int = db.Column(
        db.Integer,
        db.ForeignKey("pipeline.pipeline_id", onupdate="cascade", ondelete="restrict"),
        nullable=False,
    )
    qsub_id: int = db.Column(db.Integer)
    result_path: str = db.Column(db.String(500))
    assignee_id = db.Column(
        db.Integer, db.ForeignKey("user.user_id", onupdate="cascade")
    )

    requester_id = db.Column(
        db.Integer, db.ForeignKey("user.user_id", onupdate="cascade"), nullable=False
    )

    requested: datetime = db.Column(db.DateTime, nullable=False)
    started: datetime = db.Column(db.DateTime)
    finished: datetime = db.Column(db.DateTime)
    notes: str = db.Column(db.Text)
    updated: datetime = db.Column(db.DateTime, nullable=False, onupdate=datetime.now)
    updated_by_id = db.Column(
        db.Integer, db.ForeignKey("user.user_id", onupdate="cascade"), nullable=False
    )
    updated_by = db.relationship("User", foreign_keys=[updated_by_id], lazy="joined")
    assignee = db.relationship("User", foreign_keys=[assignee_id], lazy="joined")
    requester = db.relationship("User", foreign_keys=[requester_id], lazy="joined")


@dataclass
class Pipeline(db.Model):
    pipeline_id: int = db.Column(db.Integer, primary_key=True)
    pipeline_name: str = db.Column(db.String(50), nullable=False)
    pipeline_version: str = db.Column(db.String(50), nullable=False)
    supported = db.relationship("PipelineDatasets", backref="pipeline")

    supported_types: List[MetaDatasetType]

    @property
    def supported_types(self) -> List[MetaDatasetType]:
        return [x.supported_metadataset_type for x in self.supported]

    __table_args__ = (db.UniqueConstraint("pipeline_name", "pipeline_version"),)


class PipelineDatasets(db.Model):
    pipeline_id: int = db.Column(
        db.Integer,
        db.ForeignKey("pipeline.pipeline_id", onupdate="cascade", ondelete="restrict"),
        primary_key=True,
    )
    supported_metadataset_type: str = db.Column(
        db.ForeignKey("metadataset_type.metadataset_type"),
        primary_key=True,
        nullable=False,
    )
