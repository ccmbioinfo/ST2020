"""add_index_to_gene_alias_ensembl_id

Revision ID: 184f5edd4719
Revises: 5e69ca582792
Create Date: 2021-06-30 20:35:45.293750

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "184f5edd4719"
down_revision = "5e69ca582792"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("gene_alias_ensembl_id_IDX", "gene_alias", ["ensembl_id"])


def downgrade():
    op.drop_index("gene_alias_ensembl_id_IDX", "gene_alias")
