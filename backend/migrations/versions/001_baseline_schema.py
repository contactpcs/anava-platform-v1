"""Baseline schema snapshot — marks existing Supabase schema as migration starting point.

This is a no-op migration. The schema already exists in Supabase (created via
the Supabase dashboard / SQL editor). This revision establishes the alembic_version
table so future schema changes can be tracked as versioned migrations from here.

To apply:
    alembic upgrade head

Future schema changes should be added as new revisions:
    alembic revision -m "add_index_appointments_patient_id"
    # then edit the generated file and write upgrade()/downgrade() SQL

Revision ID: 001
Revises:
Create Date: 2026-05-29
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Schema already exists — this is a baseline marker only.
    # Future migrations build on top of this revision.
    pass


def downgrade() -> None:
    # Cannot downgrade a baseline — the schema predates migration tracking.
    pass
