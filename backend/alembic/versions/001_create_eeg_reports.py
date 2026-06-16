"""create eeg_reports table

Revision ID: 001
Revises:
Create Date: 2026-06-04
"""
from sqlalchemy import text
from alembic import op

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Enum — skip if already exists (can happen on partial previous runs)
    row = conn.execute(text("SELECT 1 FROM pg_type WHERE typname = 'report_status'")).fetchone()
    if not row:
        conn.execute(text(
            "CREATE TYPE report_status AS ENUM ('UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED')"
        ))

    # Table — composite PK (id, created_at) required by TimescaleDB hypertable constraint
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS eeg_reports (
            id              UUID                NOT NULL,
            patient_id      VARCHAR(255)        NOT NULL,
            session_id      VARCHAR(255),
            report_name     VARCHAR(255)        NOT NULL,
            file_path       TEXT                NOT NULL,
            file_size_bytes INTEGER             NOT NULL,
            report_type     VARCHAR(100)        NOT NULL DEFAULT 'EEG_ANALYSIS',
            sha256_checksum VARCHAR(64)         NOT NULL,
            version         INTEGER             NOT NULL DEFAULT 1,
            status          report_status       NOT NULL DEFAULT 'UPLOADING',
            deleted_at      TIMESTAMPTZ,
            created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
            PRIMARY KEY (id, created_at)
        )
    """))

    # Hypertable
    conn.execute(text(
        "SELECT create_hypertable('eeg_reports', 'created_at', if_not_exists => TRUE)"
    ))

    # Indexes
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_eeg_reports_patient_created ON eeg_reports (patient_id, created_at)"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_eeg_reports_checksum ON eeg_reports (sha256_checksum)"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_eeg_reports_session_id ON eeg_reports (session_id)"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_eeg_reports_patient_active ON eeg_reports (patient_id, deleted_at)"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_eeg_reports_status ON eeg_reports (status)"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DROP INDEX IF EXISTS ix_eeg_reports_status"))
    conn.execute(text("DROP INDEX IF EXISTS ix_eeg_reports_patient_active"))
    conn.execute(text("DROP INDEX IF EXISTS ix_eeg_reports_session_id"))
    conn.execute(text("DROP INDEX IF EXISTS ix_eeg_reports_checksum"))
    conn.execute(text("DROP INDEX IF EXISTS ix_eeg_reports_patient_created"))
    conn.execute(text("DROP TABLE IF EXISTS eeg_reports"))
    conn.execute(text("DROP TYPE IF EXISTS report_status"))
