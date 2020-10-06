"""adding month of birth to participant table

Revision ID: c16337c9fc89
Revises: f8862eed0498
Create Date: 2020-10-06 22:17:17.030988

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c16337c9fc89'
down_revision = 'f8862eed0498'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('participant', sa.Column('month_of_birth', sa.Date(), nullable=True))
    op.execute("ALTER TABLE sample_tracker.participant ADD CHECK (DAY(month_of_birth) = 1);")
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('participant', 'month_of_birth')
    # ### end Alembic commands ###
