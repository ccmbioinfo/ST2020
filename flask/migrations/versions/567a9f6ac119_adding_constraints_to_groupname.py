"""adding constraints to groupname

Revision ID: 567a9f6ac119
Revises: 504637ea7e26
Create Date: 2020-11-23 20:03:17.774838

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '567a9f6ac119'
down_revision = '504637ea7e26'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.execute("ALTER TABLE `group` ADD CHECK (LENGTH(group_code) > 2 AND group_code REGEXP '^[a-z,0-9,-]*$' AND BINARY group_code = LOWER(group_code))")
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.execute("ALTER TABLE `group` DROP CHECK (LENGTH(group_code) > 2 AND group_code REGEXP '^[a-z,0-9,-]*$' AND BINARY group_code = LOWER(group_code))")
    # ### end Alembic commands ###
