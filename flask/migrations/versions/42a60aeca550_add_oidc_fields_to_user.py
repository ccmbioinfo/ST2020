"""Add OIDC Fields to User

Revision ID: 42a60aeca550
Revises: 12eef79e0a33
Create Date: 2021-03-23 15:08:53.360939

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "42a60aeca550"
down_revision = "12eef79e0a33"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column("user", sa.Column("issuer", sa.String(length=150), nullable=True))
    op.add_column("user", sa.Column("subject", sa.String(length=255), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("user", "subject")
    op.drop_column("user", "issuer")
    # ### end Alembic commands ###