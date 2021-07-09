"""many_to_many_dataset_files

Revision ID: 6f448fc94a2d
Revises: 5e69ca582792
Create Date: 2021-06-23 13:30:06.701210

"""
from alembic import op
import sqlalchemy as sa
from dataclasses import dataclass

from app.extensions import db


# revision identifiers, used by Alembic.
revision = "6f448fc94a2d"
down_revision = "5e69ca582792"
branch_labels = None
depends_on = None


@dataclass
class LegacyDatasetTable(db.Model):
    __tablename__ = "dataset_file"
    file_id = db.Column(db.Integer, primary_key=True)
    dataset_id = db.Column(db.Integer)
    path = db.Column(db.String(500), nullable=False, unique=True)


def upgrade():

    file_table = op.create_table(
        "file",
        sa.Column("file_id", sa.Integer, primary_key=True),
        sa.Column("path", sa.String(500), nullable=False, unique=True),
        sa.Column("multiplexed", sa.Boolean, default=False),
    )

    joining_table = op.create_table(
        "datasets_files",
        sa.Column("file_id", sa.Integer, nullable=False),
        sa.Column("dataset_id", sa.Integer, nullable=False),
        sa.ForeignKeyConstraint(
            ["file_id"],
            ["file.file_id"],
        ),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["dataset.dataset_id"],
            ondelete="CASCADE",  # DB level, ORM logic defined in models
        ),
    )

    for file in LegacyDatasetTable.query.all():
        stmt = file_table.insert().values(path=file.path)
        result = db.session.execute(stmt)
        db.session.commit()
        pk = result.inserted_primary_key[0]
        stmt = joining_table.insert().values(dataset_id=file.dataset_id, file_id=pk)
        result = db.session.execute(stmt)
        db.session.commit()


def downgrade():

    op.drop_table("datasets_files")
    op.drop_table("file")
