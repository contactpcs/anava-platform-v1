-- ============================================================
-- NEUROWELLNESS — SUPABASE DATABASE SETUP
-- Version: 6.0.0 (PATCHED from v5)
--
-- v6 Changes (per "Changes of schema and new rules.md"):
--   • Removed prs_scoring_rules table entirely
--   • Removed scoring_rule_id from prs_scales,
--     prs_disease_scale_map, prs_scale_results, prs_final_results
--   • All PRS IDs changed from UUID to TEXT with
--     human-readable composite keys
--   • INSERT data generated from PRS_DET.xlsx
--
-- HOW TO RUN:
--   Paste this file into Supabase → SQL Editor → New Query
--   Run in ONE shot — do not split into parts
-- ============================================================


-- ============================================================
-- PRE-FLIGHT: EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- BASE TABLE 1: PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT,
  avatar_url   TEXT,
  role         TEXT        NOT NULL DEFAULT 'patient'
               CHECK (role IN ('patient', 'doctor', 'admin', 'receptionist', 'clinical_assistant')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'Public profile data for every authenticated user.';


-- ============================================================
-- BASE TABLE 2: DOCTORS
-- ============================================================
CREATE TABLE IF NOT EXISTS doctors (
  id                UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  specialisation    TEXT,
  licence_number    TEXT,
  hospital          TEXT,
  phone             TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE doctors IS 'Doctor-specific profile extension. id mirrors profiles.id.';


-- ============================================================
-- BASE TABLE 3: PATIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id                 UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  date_of_birth      DATE,
  gender             TEXT        CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  phone              TEXT,
  assigned_doctor_id UUID        REFERENCES doctors(id) ON DELETE SET NULL,
  is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE patients IS 'Patient-specific profile extension. id mirrors profiles.id.';


-- ============================================================
-- BASE TABLE 4: RECEPTIONISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS receptionists (
  id            UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id   TEXT        UNIQUE,
  department    TEXT,
  designation   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE receptionists IS 'Receptionist-specific profile extension. id mirrors profiles.id.';

ALTER TABLE receptionists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Receptionists can read own record"
  ON receptionists FOR SELECT USING (id = auth.uid());


-- ============================================================
-- BASE TABLE 5: CLINICAL_ASSISTANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS clinical_assistants (
  id                    UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id           TEXT        UNIQUE,
  department            TEXT,
  designation           TEXT,
  supervising_doctor_id UUID        REFERENCES doctors(id) ON DELETE SET NULL,
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE clinical_assistants IS 'Clinical assistant-specific profile extension. id mirrors profiles.id.';

ALTER TABLE clinical_assistants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinical assistants can read own record"
  ON clinical_assistants FOR SELECT USING (id = auth.uid());


-- ============================================================
-- BASE TABLE 6: ADMINS
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id            UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id   TEXT        UNIQUE,
  department    TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE admins IS 'Admin-specific profile extension. id mirrors profiles.id.';

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read own record"
  ON admins FOR SELECT USING (id = auth.uid());


-- ============================================================
-- BASE TABLE 7: SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id     UUID        NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,
  doctor_id      UUID        NOT NULL REFERENCES doctors(id)   ON DELETE CASCADE,
  session_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_type   TEXT        NOT NULL DEFAULT 'in_person'
                 CHECK (session_type IN ('in_person', 'teleconsult', 'follow_up')),
  notes          TEXT,
  status         TEXT        NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sessions IS 'Clinical visit sessions linking a patient to a doctor.';


-- ============================================================
-- BASE TABLE 5: DOCTOR_PATIENT_ALLOCATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS doctor_patient_allocations (
  allocation_id  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id      UUID        NOT NULL REFERENCES doctors(id)   ON DELETE CASCADE,
  patient_id     UUID        NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,
  allocated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deallocated_at TIMESTAMPTZ,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  notes          TEXT,
  UNIQUE (doctor_id, patient_id)
);

COMMENT ON TABLE doctor_patient_allocations IS 'History of doctor-patient allocation relationships.';


-- ============================================================
-- BASE TABLE 6: NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  body         TEXT,
  type         TEXT        NOT NULL DEFAULT 'general',
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  metadata     JSONB       DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'In-app notifications delivered to patients and doctors.';


-- ============================================================
-- BASE TABLE 7: AUDIT_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  action       TEXT        NOT NULL,
  table_name   TEXT,
  record_id    UUID,
  old_data     JSONB,
  new_data     JSONB,
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for significant system actions.';


-- ============================================================
-- BASE TABLE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role              ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_patients_assigned_doctor   ON patients(assigned_doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_active            ON patients(is_active);
CREATE INDEX IF NOT EXISTS idx_doctors_active             ON doctors(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_patient           ON sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_doctor            ON sessions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date              ON sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_dpa_doctor                 ON doctor_patient_allocations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_dpa_patient                ON doctor_patient_allocations(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user         ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read         ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_actor                ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_table                ON audit_logs(table_name, record_id);


-- ============================================================
-- BASE TABLE RLS
-- ============================================================
ALTER TABLE profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_patient_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (id = auth.uid());

-- Doctors
CREATE POLICY "Doctors can read own record"
  ON doctors FOR SELECT USING (id = auth.uid());
CREATE POLICY "Patients can read their assigned doctor"
  ON doctors FOR SELECT USING (
    EXISTS (SELECT 1 FROM patients p WHERE p.id = auth.uid() AND p.assigned_doctor_id = doctors.id)
  );

-- Patients
CREATE POLICY "Patients can read own record"
  ON patients FOR SELECT USING (id = auth.uid());
CREATE POLICY "Doctors can read their patients"
  ON patients FOR SELECT USING (assigned_doctor_id = auth.uid());

-- Sessions
CREATE POLICY "Patient sees own sessions"
  ON sessions FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "Doctor sees own sessions"
  ON sessions FOR SELECT USING (doctor_id = auth.uid());

-- Notifications
CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can mark own notifications read"
  ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Audit logs: service role only (no user-facing policy)


-- ============================================================
-- ============================================================
-- PRS v6 ASSESSMENT SCHEMA
-- (scoring_rule_id removed, IDs are TEXT-based composites)
-- ============================================================
-- ============================================================


-- ============================================================
-- STEP 1: DROP OLD ASSESSMENT TABLES (safe — no data yet)
-- ============================================================
DROP TABLE IF EXISTS assessment_responses      CASCADE;
DROP TABLE IF EXISTS scale_scores              CASCADE;
DROP TABLE IF EXISTS assessment_scores         CASCADE;
DROP TABLE IF EXISTS assessment_sessions       CASCADE;
DROP TABLE IF EXISTS assessment_permissions    CASCADE;
DROP TABLE IF EXISTS prs_question_branches     CASCADE;
DROP TABLE IF EXISTS prs_disease_scales        CASCADE;
DROP TABLE IF EXISTS prs_options               CASCADE;
DROP TABLE IF EXISTS prs_questions             CASCADE;
DROP TABLE IF EXISTS prs_scales                CASCADE;
DROP TABLE IF EXISTS prs_diseases              CASCADE;
DROP TABLE IF EXISTS prs_scoring_rules         CASCADE;
DROP TABLE IF EXISTS prs_disease_scale_map     CASCADE;
DROP TABLE IF EXISTS prs_scale_question_map    CASCADE;
DROP TABLE IF EXISTS prs_disease_question_map  CASCADE;
DROP TABLE IF EXISTS prs_assessment_instances  CASCADE;
DROP TABLE IF EXISTS prs_responses             CASCADE;
DROP TABLE IF EXISTS prs_scale_results         CASCADE;
DROP TABLE IF EXISTS prs_final_results         CASCADE;


-- ============================================================
-- STEP 2: ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE assessment_taken_by AS ENUM ('patient', 'doctor_on_behalf');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assessment_permission_status AS ENUM ('pending', 'granted', 'revoked', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- STEP 3: PRS_DISEASES
-- Disease_ID is TEXT: "DISEASENAME/2026"
-- ============================================================
CREATE TABLE IF NOT EXISTS prs_diseases (
  disease_id      TEXT        PRIMARY KEY,  -- e.g. 'CHRONICPAIN/2026'
  disease_code    TEXT        NOT NULL UNIQUE,
  disease_name    TEXT        NOT NULL,
  version         TEXT        NOT NULL DEFAULT 'v1.0',
  status          BOOLEAN     NOT NULL DEFAULT TRUE,
  time_stamp      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  prs_diseases               IS 'Master list of neurological conditions supported by the PRS assessment system.';
COMMENT ON COLUMN prs_diseases.disease_id    IS 'Composite TEXT key: DISEASENAME/2026';
COMMENT ON COLUMN prs_diseases.disease_code  IS 'Short unique identifier used in application logic.';
COMMENT ON COLUMN prs_diseases.status        IS 'TRUE = active and available for assessment; FALSE = retired.';


-- ============================================================
-- STEP 4: PRS_SCALES
-- Scale_ID is TEXT: "SCALECODE/2026"
-- scoring_rule_id REMOVED (scoring logic lives in code)
-- ============================================================
CREATE TABLE IF NOT EXISTS prs_scales (
  scale_id          TEXT        PRIMARY KEY,  -- e.g. 'EQ-5D-5L/2026'
  scale_code        TEXT        NOT NULL UNIQUE,
  scale_name        TEXT        NOT NULL,
  is_common_scale   BOOLEAN     NOT NULL DEFAULT FALSE,
  num_diseases_used INT         NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  prs_scales                  IS 'Clinical assessment instruments/scales. Common scales are reused across multiple diseases.';
COMMENT ON COLUMN prs_scales.scale_id         IS 'Composite TEXT key: SCALECODE/2026';
COMMENT ON COLUMN prs_scales.is_common_scale  IS 'TRUE when this scale appears in 2 or more diseases.';


-- ============================================================
-- STEP 5: PRS_DISEASE_SCALE_MAP
-- ds_map_id is TEXT: "DiseaseName/ScaleCode"
-- scoring_rule_id REMOVED
-- ============================================================
CREATE TABLE IF NOT EXISTS prs_disease_scale_map (
  ds_map_id       TEXT        PRIMARY KEY,  -- e.g. 'Depression/Anxiety/EQ-5D-5L'
  disease_id      TEXT        NOT NULL REFERENCES prs_diseases(disease_id) ON DELETE CASCADE,
  scale_id        TEXT        NOT NULL REFERENCES prs_scales(scale_id)    ON DELETE CASCADE,
  display_order   INT         NOT NULL DEFAULT 0,
  is_required     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (disease_id, scale_id)
);

COMMENT ON TABLE  prs_disease_scale_map IS 'Ordered mapping of which scales belong to each disease.';
COMMENT ON COLUMN prs_disease_scale_map.ds_map_id IS 'Composite TEXT key: DiseaseName/ScaleCode';


-- ============================================================
-- STEP 6: PRS_QUESTIONS
-- Question_ID is TEXT: "SCALECODE/NNN"
-- ============================================================
CREATE TABLE IF NOT EXISTS prs_questions (
  question_id       TEXT        PRIMARY KEY,  -- e.g. 'PDSS/004'
  question_code     TEXT        NOT NULL UNIQUE,
  disease_id        TEXT        REFERENCES prs_diseases(disease_id) ON DELETE SET NULL,
  scale_id          TEXT        REFERENCES prs_scales(scale_id)     ON DELETE SET NULL,
  ds_map_id         TEXT        REFERENCES prs_disease_scale_map(ds_map_id) ON DELETE SET NULL,
  question_text     TEXT        NOT NULL,
  answer_type       TEXT        NOT NULL
                    CHECK (answer_type IN ('likert','radio','slider','checkbox','text','number','table')),
  min_value         NUMERIC,
  max_value         NUMERIC,
  is_required       BOOLEAN     NOT NULL DEFAULT TRUE,
  skip_logic        TEXT,
  display_order     INT         NOT NULL DEFAULT 0,
  is_common_scale   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  prs_questions               IS 'All unique questions across all scales.';
COMMENT ON COLUMN prs_questions.question_id   IS 'Composite TEXT key: SCALECODE/NNN';


-- ============================================================
-- STEP 6b: PRS_OPTIONS
-- Option_ID is TEXT: "QUESTIONID/NN"
-- ============================================================
CREATE TABLE IF NOT EXISTS prs_options (
  option_id         TEXT        PRIMARY KEY,  -- e.g. 'PDSS/004/03'
  question_id       TEXT        NOT NULL REFERENCES prs_questions(question_id) ON DELETE CASCADE,
  option_label      TEXT        NOT NULL,
  option_value      TEXT        NOT NULL,
  points            NUMERIC     NOT NULL DEFAULT 0,
  display_order     INT         NOT NULL DEFAULT 0,
  status            BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, option_value)
);

COMMENT ON TABLE  prs_options              IS 'Relational answer options for each question.';
COMMENT ON COLUMN prs_options.option_id    IS 'Composite TEXT key: QUESTIONID/NN';


-- ============================================================
-- STEP 7: PRS_SCALE_QUESTION_MAP
-- sq_map_id is TEXT: "SCALEID/QUESTIONID"
-- ============================================================
CREATE TABLE IF NOT EXISTS prs_scale_question_map (
  sq_map_id     TEXT        PRIMARY KEY,  -- e.g. 'PDSS/2026/PDSS/004'
  scale_id      TEXT        NOT NULL REFERENCES prs_scales(scale_id)       ON DELETE CASCADE,
  question_id   TEXT        NOT NULL REFERENCES prs_questions(question_id)  ON DELETE CASCADE,
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scale_id, question_id)
);

COMMENT ON TABLE prs_scale_question_map IS 'Ordered list of questions for each scale.';
COMMENT ON COLUMN prs_scale_question_map.sq_map_id IS 'Composite TEXT key: SCALEID/QUESTIONID';


-- ============================================================
-- STEP 8: PRS_DISEASE_QUESTION_MAP
-- dq_map_id is TEXT: "DISEASEID/QUESTIONID"
-- ============================================================
CREATE TABLE IF NOT EXISTS prs_disease_question_map (
  dq_map_id     TEXT        PRIMARY KEY,  -- e.g. 'CHRONICPAIN/2026/DASS-21/006'
  disease_id    TEXT        NOT NULL REFERENCES prs_diseases(disease_id)    ON DELETE CASCADE,
  question_id   TEXT        NOT NULL REFERENCES prs_questions(question_id)  ON DELETE CASCADE,
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (disease_id, question_id)
);

COMMENT ON TABLE prs_disease_question_map IS 'Flat denormalised map of every question reachable from a disease.';
COMMENT ON COLUMN prs_disease_question_map.dq_map_id IS 'Composite TEXT key: DISEASEID/QUESTIONID';


-- ============================================================
-- STEP 9: ASSESSMENT_PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_permissions (
  id            UUID                        PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID                        NOT NULL REFERENCES patients(id)      ON DELETE CASCADE,
  doctor_id     UUID                        NOT NULL REFERENCES doctors(id)       ON DELETE CASCADE,
  disease_id    TEXT                        REFERENCES prs_diseases(disease_id)   ON DELETE SET NULL,
  scale_id      TEXT                        NOT NULL REFERENCES prs_scales(scale_id) ON DELETE CASCADE,
  session_id    UUID                        REFERENCES sessions(id)               ON DELETE SET NULL,
  status        assessment_permission_status NOT NULL DEFAULT 'granted',
  granted_at    TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  notes         TEXT,
  UNIQUE (patient_id, scale_id, session_id)
);

COMMENT ON TABLE assessment_permissions IS 'Doctor-issued permission for a patient to take a specific scale within a session.';


-- ============================================================
-- STEP 10: PRS_ASSESSMENT_INSTANCES
-- instance_id is TEXT: "PATXXX/NNN"
-- ============================================================
CREATE TABLE IF NOT EXISTS prs_assessment_instances (
  instance_id   TEXT                  PRIMARY KEY,  -- e.g. 'PAT001/001'
  disease_id    TEXT                  NOT NULL REFERENCES prs_diseases(disease_id) ON DELETE CASCADE,
  patient_id    UUID                  NOT NULL REFERENCES patients(id)             ON DELETE CASCADE,
  visit_id      UUID                  REFERENCES sessions(id)                      ON DELETE SET NULL,
  initiated_by  assessment_taken_by   NOT NULL DEFAULT 'patient',
  status        TEXT                  NOT NULL DEFAULT 'in_progress'
                CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  final_result  TEXT,                 -- FK → prs_final_results.final_result_id (set on completion)
  created_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  prs_assessment_instances               IS 'One row per patient assessment session.';
COMMENT ON COLUMN prs_assessment_instances.instance_id   IS 'Composite TEXT key: PATXXX/NNN';
COMMENT ON COLUMN prs_assessment_instances.initiated_by  IS 'Who started the assessment: the patient directly or a doctor on their behalf.';


-- ============================================================
-- STEP 11: PRS_RESPONSES
-- response_id is TEXT: "INSTANCEID/NNNN"
-- ============================================================
CREATE TABLE IF NOT EXISTS prs_responses (
  response_id      TEXT        PRIMARY KEY,  -- e.g. 'PAT001/001/0006'
  instance_id      TEXT        NOT NULL REFERENCES prs_assessment_instances(instance_id) ON DELETE CASCADE,
  question_id      TEXT        NOT NULL REFERENCES prs_questions(question_id)            ON DELETE CASCADE,
  given_response   TEXT,
  response_value   NUMERIC,
  time_stamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instance_id, question_id)
);

COMMENT ON TABLE  prs_responses                IS 'Raw patient answers. One row per question per assessment instance.';
COMMENT ON COLUMN prs_responses.response_id    IS 'Composite TEXT key: INSTANCEID/NNNN';


-- ============================================================
-- STEP 12: PRS_SCALE_RESULTS
-- scale_result_id is TEXT: "INSTANCEID/SCALEID"
-- scoring_rule_id REMOVED
-- ============================================================
CREATE TABLE IF NOT EXISTS prs_scale_results (
  scale_result_id       TEXT        PRIMARY KEY,  -- e.g. 'PAT001/001/PFS-16/2026'
  instance_id           TEXT        NOT NULL REFERENCES prs_assessment_instances(instance_id) ON DELETE CASCADE,
  scale_id              TEXT        NOT NULL REFERENCES prs_scales(scale_id)                  ON DELETE CASCADE,
  calculated_value      NUMERIC,
  max_possible          NUMERIC,
  percentage            NUMERIC GENERATED ALWAYS AS (
    CASE WHEN max_possible > 0
         THEN ROUND((calculated_value / max_possible) * 100, 2)
         ELSE NULL
    END
  ) STORED,
  severity_level        TEXT,
  severity_label        TEXT,
  subscale_scores       JSONB DEFAULT '{}',
  risk_flags            JSONB DEFAULT '[]',
  raw_score_data        JSONB DEFAULT '{}',
  time_stamp            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instance_id, scale_id)
);

COMMENT ON TABLE  prs_scale_results                IS 'Computed score for each scale within an assessment instance.';
COMMENT ON COLUMN prs_scale_results.scale_result_id IS 'Composite TEXT key: INSTANCEID/SCALEID';
COMMENT ON COLUMN prs_scale_results.percentage      IS 'Auto-computed: (calculated_value / max_possible) * 100.';


-- ============================================================
-- STEP 13: PRS_FINAL_RESULTS
-- final_result_id is TEXT: "INSTANCEID/DISEASEID"
-- scoring_rule_id REMOVED
-- ============================================================
CREATE TABLE IF NOT EXISTS prs_final_results (
  final_result_id         TEXT        PRIMARY KEY,  -- e.g. 'PAT001/001/CHRONICPAIN/2026'
  instance_id             TEXT        NOT NULL UNIQUE
                          REFERENCES prs_assessment_instances(instance_id) ON DELETE CASCADE,
  calculated_value        NUMERIC,
  max_possible            NUMERIC,
  percentage              NUMERIC GENERATED ALWAYS AS (
    CASE WHEN max_possible > 0
         THEN ROUND((calculated_value / max_possible) * 100, 2)
         ELSE NULL
    END
  ) STORED,
  scales_completed        INT         NOT NULL DEFAULT 0,
  scales_total            INT         NOT NULL DEFAULT 0,
  overall_severity        TEXT,
  overall_severity_label  TEXT,
  scale_summaries         JSONB       NOT NULL DEFAULT '[]',
  all_risk_flags          JSONB       NOT NULL DEFAULT '[]',
  composite_summary       TEXT,
  time_stamp              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deferred FK from instances → final results
ALTER TABLE prs_assessment_instances
  ADD CONSTRAINT fk_instance_final_result
  FOREIGN KEY (final_result) REFERENCES prs_final_results(final_result_id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

COMMENT ON TABLE  prs_final_results                 IS 'Aggregated score across all scales in one assessment instance.';
COMMENT ON COLUMN prs_final_results.final_result_id IS 'Composite TEXT key: INSTANCEID/DISEASEID';


-- ============================================================
-- STEP 14: PERFORMANCE INDEXES
-- ============================================================

-- prs_diseases
CREATE INDEX IF NOT EXISTS idx_prs_diseases_code       ON prs_diseases(disease_code);
CREATE INDEX IF NOT EXISTS idx_prs_diseases_status     ON prs_diseases(status);

-- prs_scales
CREATE INDEX IF NOT EXISTS idx_prs_scales_code         ON prs_scales(scale_code);
CREATE INDEX IF NOT EXISTS idx_prs_scales_common       ON prs_scales(is_common_scale);

-- prs_disease_scale_map
CREATE INDEX IF NOT EXISTS idx_prs_dsmap_disease       ON prs_disease_scale_map(disease_id);
CREATE INDEX IF NOT EXISTS idx_prs_dsmap_scale         ON prs_disease_scale_map(scale_id);
CREATE INDEX IF NOT EXISTS idx_prs_dsmap_order         ON prs_disease_scale_map(disease_id, display_order);

-- prs_questions
CREATE INDEX IF NOT EXISTS idx_prs_questions_code      ON prs_questions(question_code);
CREATE INDEX IF NOT EXISTS idx_prs_questions_type      ON prs_questions(answer_type);
CREATE INDEX IF NOT EXISTS idx_prs_questions_common    ON prs_questions(is_common_scale);

-- prs_options
CREATE INDEX IF NOT EXISTS idx_prs_options_question    ON prs_options(question_id);
CREATE INDEX IF NOT EXISTS idx_prs_options_order       ON prs_options(question_id, display_order);
CREATE INDEX IF NOT EXISTS idx_prs_options_status      ON prs_options(status);

-- prs_scale_question_map
CREATE INDEX IF NOT EXISTS idx_prs_sqmap_scale         ON prs_scale_question_map(scale_id);
CREATE INDEX IF NOT EXISTS idx_prs_sqmap_question      ON prs_scale_question_map(question_id);
CREATE INDEX IF NOT EXISTS idx_prs_sqmap_order         ON prs_scale_question_map(scale_id, display_order);

-- prs_disease_question_map
CREATE INDEX IF NOT EXISTS idx_prs_dqmap_disease       ON prs_disease_question_map(disease_id);
CREATE INDEX IF NOT EXISTS idx_prs_dqmap_question      ON prs_disease_question_map(question_id);
CREATE INDEX IF NOT EXISTS idx_prs_dqmap_order         ON prs_disease_question_map(disease_id, display_order);

-- assessment_permissions
CREATE INDEX IF NOT EXISTS idx_ap_patient              ON assessment_permissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_ap_doctor               ON assessment_permissions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_ap_status               ON assessment_permissions(status);
CREATE INDEX IF NOT EXISTS idx_ap_disease              ON assessment_permissions(disease_id);

-- prs_assessment_instances
CREATE INDEX IF NOT EXISTS idx_pai_patient             ON prs_assessment_instances(patient_id);
CREATE INDEX IF NOT EXISTS idx_pai_disease             ON prs_assessment_instances(disease_id);
CREATE INDEX IF NOT EXISTS idx_pai_status              ON prs_assessment_instances(status);
CREATE INDEX IF NOT EXISTS idx_pai_visit               ON prs_assessment_instances(visit_id);

-- prs_responses
CREATE INDEX IF NOT EXISTS idx_pr_instance             ON prs_responses(instance_id);
CREATE INDEX IF NOT EXISTS idx_pr_question             ON prs_responses(question_id);

-- prs_scale_results
CREATE INDEX IF NOT EXISTS idx_psr_instance            ON prs_scale_results(instance_id);
CREATE INDEX IF NOT EXISTS idx_psr_scale               ON prs_scale_results(scale_id);

-- prs_final_results
CREATE INDEX IF NOT EXISTS idx_pfr_instance            ON prs_final_results(instance_id);


-- ============================================================
-- STEP 15: TRIGGERS — auto updated_at for prs_scales
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prs_scales_updated_at ON prs_scales;
CREATE TRIGGER trg_prs_scales_updated_at
  BEFORE UPDATE ON prs_scales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- STEP 16: AUTO-CALCULATE FINAL RESULT TRIGGER
-- (scoring_rule_id references removed)
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_final_result()
RETURNS TRIGGER AS $$
DECLARE
  v_instance        prs_assessment_instances%ROWTYPE;
  v_total           NUMERIC := 0;
  v_max             NUMERIC := 0;
  v_completed       INT     := 0;
  v_total_scales    INT     := 0;
  v_worst_sev       TEXT    := NULL;
  v_worst_label     TEXT    := NULL;
  v_summaries       JSONB   := '[]'::jsonb;
  v_all_flags       JSONB   := '[]'::jsonb;
  sev_order         INT;
  worst_order       INT     := -1;
  r                 RECORD;
BEGIN
  SELECT * INTO v_instance
  FROM prs_assessment_instances
  WHERE instance_id = NEW.instance_id;

  -- Total scales for this disease
  SELECT COUNT(*) INTO v_total_scales
  FROM prs_disease_scale_map
  WHERE disease_id = v_instance.disease_id;

  -- Aggregate all scale results for this instance
  FOR r IN
    SELECT sr.*, sc.scale_code, sc.scale_name
    FROM prs_scale_results sr
    JOIN prs_scales sc ON sc.scale_id = sr.scale_id
    WHERE sr.instance_id = NEW.instance_id
  LOOP
    v_total     := v_total + COALESCE(r.calculated_value, 0);
    v_max       := v_max   + COALESCE(r.max_possible, 0);
    v_completed := v_completed + 1;

    -- Track worst severity
    sev_order := CASE r.severity_level
      WHEN 'severe'            THEN 4
      WHEN 'moderately-severe' THEN 3
      WHEN 'moderate'          THEN 2
      WHEN 'mild'              THEN 1
      ELSE 0
    END;
    IF sev_order > worst_order THEN
      worst_order   := sev_order;
      v_worst_sev   := r.severity_level;
      v_worst_label := r.severity_label;
    END IF;

    -- Build per-scale summary snapshot
    v_summaries := v_summaries || jsonb_build_object(
      'scale_code',     r.scale_code,
      'scale_name',     r.scale_name,
      'score',          r.calculated_value,
      'max_possible',   r.max_possible,
      'percentage',     CASE WHEN r.max_possible > 0
                             THEN ROUND((r.calculated_value / r.max_possible) * 100, 2)
                             ELSE NULL END,
      'severity_level', r.severity_level,
      'severity_label', r.severity_label
    );

    -- Collect risk flags
    IF r.risk_flags IS NOT NULL AND jsonb_array_length(r.risk_flags) > 0 THEN
      v_all_flags := v_all_flags || r.risk_flags;
    END IF;
  END LOOP;

  -- Upsert prs_final_results
  INSERT INTO prs_final_results (
    final_result_id, instance_id,
    calculated_value, max_possible,
    scales_completed, scales_total,
    overall_severity, overall_severity_label,
    scale_summaries, all_risk_flags,
    time_stamp
  ) VALUES (
    NEW.instance_id || '/' || v_instance.disease_id,
    NEW.instance_id,
    v_total, v_max,
    v_completed, v_total_scales,
    v_worst_sev, v_worst_label,
    v_summaries, v_all_flags,
    NOW()
  )
  ON CONFLICT (instance_id) DO UPDATE SET
    calculated_value        = EXCLUDED.calculated_value,
    max_possible            = EXCLUDED.max_possible,
    scales_completed        = EXCLUDED.scales_completed,
    scales_total            = EXCLUDED.scales_total,
    overall_severity        = EXCLUDED.overall_severity,
    overall_severity_label  = EXCLUDED.overall_severity_label,
    scale_summaries         = EXCLUDED.scale_summaries,
    all_risk_flags          = EXCLUDED.all_risk_flags,
    time_stamp              = EXCLUDED.time_stamp;

  -- Backfill final_result on the instance when all scales are done
  IF v_completed >= v_total_scales THEN
    UPDATE prs_assessment_instances
    SET
      status       = 'completed',
      completed_at = NOW(),
      final_result = (
        SELECT final_result_id FROM prs_final_results WHERE instance_id = NEW.instance_id
      )
    WHERE instance_id = NEW.instance_id
      AND status != 'completed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalculate_final_result ON prs_scale_results;
CREATE TRIGGER trg_recalculate_final_result
  AFTER INSERT OR UPDATE ON prs_scale_results
  FOR EACH ROW EXECUTE FUNCTION recalculate_final_result();


-- ============================================================
-- STEP 17: ROW LEVEL SECURITY (RLS) — assessment tables
-- ============================================================
ALTER TABLE prs_diseases              ENABLE ROW LEVEL SECURITY;
ALTER TABLE prs_scales                ENABLE ROW LEVEL SECURITY;
ALTER TABLE prs_disease_scale_map     ENABLE ROW LEVEL SECURITY;
ALTER TABLE prs_questions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE prs_options               ENABLE ROW LEVEL SECURITY;
ALTER TABLE prs_scale_question_map    ENABLE ROW LEVEL SECURITY;
ALTER TABLE prs_disease_question_map  ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE prs_assessment_instances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prs_responses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE prs_scale_results         ENABLE ROW LEVEL SECURITY;
ALTER TABLE prs_final_results         ENABLE ROW LEVEL SECURITY;

-- Reference tables: all authenticated users can read
CREATE POLICY "Anyone can read diseases"
  ON prs_diseases FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can read scales"
  ON prs_scales FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can read disease scale map"
  ON prs_disease_scale_map FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can read questions"
  ON prs_questions FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can read options"
  ON prs_options FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can read scale question map"
  ON prs_scale_question_map FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can read disease question map"
  ON prs_disease_question_map FOR SELECT USING (auth.role() = 'authenticated');

-- Assessment instances: patient sees own, doctor sees their patients'
CREATE POLICY "Patients see own instances"
  ON prs_assessment_instances FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "Doctors see their patients instances"
  ON prs_assessment_instances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_id
        AND p.assigned_doctor_id = auth.uid()
    )
  );

CREATE POLICY "Patient or doctor can create instance"
  ON prs_assessment_instances FOR INSERT
  WITH CHECK (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM doctors d WHERE d.id = auth.uid()
    )
  );

-- Responses: scoped to instance owner
CREATE POLICY "Patient sees own responses"
  ON prs_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM prs_assessment_instances i
      WHERE i.instance_id = prs_responses.instance_id
        AND i.patient_id = auth.uid()
    )
  );

CREATE POLICY "Patient can insert own responses"
  ON prs_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM prs_assessment_instances i
      WHERE i.instance_id = prs_responses.instance_id
        AND i.patient_id = auth.uid()
    )
  );

-- Scale results & final results: patient + doctor read access
CREATE POLICY "Patient sees own scale results"
  ON prs_scale_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM prs_assessment_instances i
      WHERE i.instance_id = prs_scale_results.instance_id
        AND i.patient_id = auth.uid()
    )
  );

CREATE POLICY "Doctor sees their patients scale results"
  ON prs_scale_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM prs_assessment_instances i
      JOIN patients p ON p.id = i.patient_id
      WHERE i.instance_id = prs_scale_results.instance_id
        AND p.assigned_doctor_id = auth.uid()
    )
  );

CREATE POLICY "Patient sees own final results"
  ON prs_final_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM prs_assessment_instances i
      WHERE i.instance_id = prs_final_results.instance_id
        AND i.patient_id = auth.uid()
    )
  );

CREATE POLICY "Doctor sees their patients final results"
  ON prs_final_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM prs_assessment_instances i
      JOIN patients p ON p.id = i.patient_id
      WHERE i.instance_id = prs_final_results.instance_id
        AND p.assigned_doctor_id = auth.uid()
    )
  );

-- Assessment permissions
CREATE POLICY "Patients see own permissions"
  ON assessment_permissions FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "Doctors see permissions they granted"
  ON assessment_permissions FOR SELECT
  USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can insert permissions"
  ON assessment_permissions FOR INSERT
  WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "Doctors can update permissions they granted"
  ON assessment_permissions FOR UPDATE
  USING (doctor_id = auth.uid());


-- ============================================================
-- STEP 18: SERVICE ROLE GRANTS
-- ============================================================
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


-- ============================================================
-- STEP 19: SEED DATA — Diseases (from PRS_DET.xlsx)
-- ============================================================

INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('DEPRESSION/ANXIETY/2026', 'DEPRESSIONANXIETY', 'Depression/Anxiety', 'v1.0', TRUE);
INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('CHRONICPAIN/2026', 'CHRONICPAIN', 'Chronic Pain', 'v1.0', TRUE);
INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('FIBROMYALGIA/2026', 'FIBROMYALGIA', 'Fibromyalgia', 'v1.0', TRUE);
INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('MIGRAINE/2026', 'MIGRAINE', 'Migraine', 'v1.0', TRUE);
INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('ATAXIA/2026', 'ATAXIA', 'Ataxia', 'v1.0', TRUE);
INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('AFTERSTROKE/TBI/2026', 'AFTERSTROKETBI', 'After Stroke/TBI', 'v1.0', TRUE);
INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('DEMENTIA/2026', 'DEMENTIA', 'Dementia', 'v1.0', TRUE);
INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('PARKINSONSDISEASE/2026', 'PARKINSONSDISEASE', 'Parkinson''s Disease', 'v1.0', TRUE);
INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('TINNITUS/2026', 'TINNITUS', 'Tinnitus', 'v1.0', TRUE);
INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('INSOMNIA/2026', 'INSOMNIA', 'Insomnia', 'v1.0', TRUE);
INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('MULTIPLESCLEROSIS/2026', 'MULTIPLESCLEROSIS', 'Multiple Sclerosis', 'v1.0', TRUE);
INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('ADHD/2026', 'ADHD', 'ADHD', 'v1.0', TRUE);
INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('ALS/2026', 'ALS', 'ALS', 'v1.0', TRUE);
INSERT INTO prs_diseases (disease_id, disease_code, disease_name, version, status) VALUES ('IRRITABLEBOWELDISEASE/2026', 'IRRITABLEBOWELDISEASE', 'Irritable Bowel Disease', 'v1.0', TRUE);


-- ============================================================
-- STEP 20: SEED DATA — Scales (from PRS_DET.xlsx)
-- ============================================================
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('AIS/2026', 'AIS', 'AIS - Athens Insomnia Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('ALSFRS-R/2026', 'ALSFRS-R', 'ALSFRS-R - ALS Functional Rating Scale - Revised', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('AMTS/2026', 'AMTS', 'AMTS - Abbreviated Mental Test Score', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('ASRS-v1.1/2026', 'ASRS-v1.1', 'ASRS-v1.1 - Adult ADHD Self-Report Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('BDI-II/2026', 'BDI-II', 'BDI-II - Beck''s Depression Inventory Version 2', TRUE, 5);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('BARTHEL/2026', 'BARTHEL', 'Barthel Index', TRUE, 2);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('COMPASS-31/2026', 'COMPASS-31', 'COMPASS-31', TRUE, 14);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('DASS-21/2026', 'DASS-21', 'DASS-21', TRUE, 11);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('DHI/2026', 'DHI', 'DHI - Dizziness Handicap Inventory', TRUE, 2);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('DN-4/2026', 'DN-4', 'DN-4', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('DSRS/2026', 'DSRS', 'DSRS - Dementia Severity Rating Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('EQ-5D-5L/2026', 'EQ-5D-5L', 'EQ-5D-5L Health Questionnaire', TRUE, 12);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('FFS/2026', 'FFS', 'FFS - Flinders Fatigue Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('FIQR/2026', 'FIQR', 'FIQR - Revised Fibromyalgia Impact Questionnaire', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('FSS/2026', 'FSS', 'FSS - Fatigue Severity Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('GAD-7/2026', 'GAD-7', 'GAD-7', TRUE, 5);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('GDS/2026', 'GDS', 'GDS - Global Deterioration Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('HDRS/2026', 'HDRS', 'HDRS - Hamilton Depression Rating Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('IADL/2026', 'IADL', 'IADL - Lawton Instrumental Activities of Daily Living Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('IBS-SSS/2026', 'IBS-SSS', 'IBS-SSS - IBS Symptom Severity Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('ISI/2026', 'ISI', 'ISI - Insomnia Severity Index', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('KPS/2026', 'KPS', 'KPS - Karnofsky Performance Status Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('MADRS/2026', 'MADRS', 'MADRS - Montgomery and Asberg Depression Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('MAS/2026', 'MAS', 'MAS - Modified Ashworth Scale', TRUE, 2);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('MFIS/2026', 'MFIS', 'MFIS - Modified Fatigue Impact Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('MIDAS/2026', 'MIDAS', 'MIDAS - Migraine Disability Assessment', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('MRC/2026', 'MRC', 'MRC - Medical Research Council Scale for Muscle Strength', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('MSQ/2026', 'MSQ', 'MSQ - Migraine-specific Quality of Life Questionnaire', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('MoCA/2026', 'MoCA', 'MoCA - Montreal Cognitive Assessment', TRUE, 4);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('PDSS/2026', 'PDSS', 'PDSS - Parkinson''s Disease Sleep Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('PFS-16/2026', 'PFS-16', 'PFS-16 - Parkinson''s Disease Fatigue Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('PSQI/2026', 'PSQI', 'PSQI - Pittsburgh Sleep Quality Index', TRUE, 5);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('PRS/2026', 'PRS', 'Pain Rating Scale', TRUE, 4);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('PainDETECT/2026', 'PainDETECT', 'PainDETECT', TRUE, 4);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('SARA/2026', 'SARA', 'SARA - Scale for the Assessment and Rating of Ataxia', TRUE, 2);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('SNAP-IV/2026', 'SNAP-IV', 'SNAP-IV 26-Item Teacher and Parent Rating Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('SS-QOL/2026', 'SS-QOL', 'SS-QOL - Stroke Specific Quality of Life Scale', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('SLEEP-50/2026', 'SLEEP-50', 'Sleep-50', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('THI/2026', 'THI', 'THI - Tinnitus Handicap Inventory', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('VAS/2026', 'VAS', 'VAS', FALSE, 1);
INSERT INTO prs_scales (scale_id, scale_code, scale_name, is_common_scale, num_diseases_used) VALUES ('VVAS/2026', 'VVAS', 'VVAS - Visual Vertigo Analogue Scale', FALSE, 1);


-- ============================================================
-- STEP 21: SEED DATA — Disease Scale Map (from PRS_DET.xlsx)
-- ============================================================
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Depression/Anxiety/EQ-5D-5L', 'DEPRESSION/ANXIETY/2026', 'EQ-5D-5L/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Depression/Anxiety/COMPASS-31', 'DEPRESSION/ANXIETY/2026', 'COMPASS-31/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Depression/Anxiety/DASS-21', 'DEPRESSION/ANXIETY/2026', 'DASS-21/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Depression/Anxiety/BDI-II', 'DEPRESSION/ANXIETY/2026', 'BDI-II/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Depression/Anxiety/GAD-7', 'DEPRESSION/ANXIETY/2026', 'GAD-7/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Depression/Anxiety/MADRS', 'DEPRESSION/ANXIETY/2026', 'MADRS/2026', 6, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Depression/Anxiety/PSQI', 'DEPRESSION/ANXIETY/2026', 'PSQI/2026', 7, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Chronic Pain/EQ-5D-5L', 'CHRONICPAIN/2026', 'EQ-5D-5L/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Chronic Pain/COMPASS-31', 'CHRONICPAIN/2026', 'COMPASS-31/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Chronic Pain/DASS-21', 'CHRONICPAIN/2026', 'DASS-21/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Chronic Pain/DN-4', 'CHRONICPAIN/2026', 'DN-4/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Chronic Pain/PainDETECT', 'CHRONICPAIN/2026', 'PainDETECT/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Chronic Pain/PRS', 'CHRONICPAIN/2026', 'PRS/2026', 6, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Chronic Pain/GAD-7', 'CHRONICPAIN/2026', 'GAD-7/2026', 7, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Chronic Pain/PSQI', 'CHRONICPAIN/2026', 'PSQI/2026', 8, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Fibromyalgia/EQ-5D-5L', 'FIBROMYALGIA/2026', 'EQ-5D-5L/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Fibromyalgia/COMPASS-31', 'FIBROMYALGIA/2026', 'COMPASS-31/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Fibromyalgia/PRS', 'FIBROMYALGIA/2026', 'PRS/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Fibromyalgia/PainDETECT', 'FIBROMYALGIA/2026', 'PainDETECT/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Fibromyalgia/FSS', 'FIBROMYALGIA/2026', 'FSS/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Fibromyalgia/VAS', 'FIBROMYALGIA/2026', 'VAS/2026', 6, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Fibromyalgia/FIQR', 'FIBROMYALGIA/2026', 'FIQR/2026', 7, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Migraine/EQ-5D-5L', 'MIGRAINE/2026', 'EQ-5D-5L/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Migraine/COMPASS-31', 'MIGRAINE/2026', 'COMPASS-31/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Migraine/MIDAS', 'MIGRAINE/2026', 'MIDAS/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Migraine/MSQ', 'MIGRAINE/2026', 'MSQ/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Migraine/PRS', 'MIGRAINE/2026', 'PRS/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Migraine/DASS-21', 'MIGRAINE/2026', 'DASS-21/2026', 6, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Migraine/PSQI', 'MIGRAINE/2026', 'PSQI/2026', 7, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Migraine/BDI-II', 'MIGRAINE/2026', 'BDI-II/2026', 8, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Ataxia/EQ-5D-5L', 'ATAXIA/2026', 'EQ-5D-5L/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Ataxia/COMPASS-31', 'ATAXIA/2026', 'COMPASS-31/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Ataxia/DHI', 'ATAXIA/2026', 'DHI/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Ataxia/SARA', 'ATAXIA/2026', 'SARA/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Ataxia/DASS-21', 'ATAXIA/2026', 'DASS-21/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Ataxia/VVAS', 'ATAXIA/2026', 'VVAS/2026', 6, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Ataxia/BDI-II', 'ATAXIA/2026', 'BDI-II/2026', 7, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('After Stroke/TBI/COMPASS-31', 'AFTERSTROKE/TBI/2026', 'COMPASS-31/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('After Stroke/TBI/KPS', 'AFTERSTROKE/TBI/2026', 'KPS/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('After Stroke/TBI/SS-QOL', 'AFTERSTROKE/TBI/2026', 'SS-QOL/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('After Stroke/TBI/MAS', 'AFTERSTROKE/TBI/2026', 'MAS/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('After Stroke/TBI/MRC', 'AFTERSTROKE/TBI/2026', 'MRC/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('After Stroke/TBI/DASS-21', 'AFTERSTROKE/TBI/2026', 'DASS-21/2026', 6, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('After Stroke/TBI/MoCA', 'AFTERSTROKE/TBI/2026', 'MoCA/2026', 7, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('After Stroke/TBI/BARTHEL', 'AFTERSTROKE/TBI/2026', 'BARTHEL/2026', 8, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('After Stroke/TBI/PainDETECT', 'AFTERSTROKE/TBI/2026', 'PainDETECT/2026', 9, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Dementia/EQ-5D-5L', 'DEMENTIA/2026', 'EQ-5D-5L/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Dementia/COMPASS-31', 'DEMENTIA/2026', 'COMPASS-31/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Dementia/AMTS', 'DEMENTIA/2026', 'AMTS/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Dementia/MoCA', 'DEMENTIA/2026', 'MoCA/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Dementia/DSRS', 'DEMENTIA/2026', 'DSRS/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Dementia/GDS', 'DEMENTIA/2026', 'GDS/2026', 6, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Dementia/IADL', 'DEMENTIA/2026', 'IADL/2026', 7, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Dementia/DASS-21', 'DEMENTIA/2026', 'DASS-21/2026', 8, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Parkinson''s Disease/COMPASS-31', 'PARKINSONSDISEASE/2026', 'COMPASS-31/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Parkinson''s Disease/PDSS', 'PARKINSONSDISEASE/2026', 'PDSS/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Parkinson''s Disease/PFS-16', 'PARKINSONSDISEASE/2026', 'PFS-16/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Parkinson''s Disease/MoCA', 'PARKINSONSDISEASE/2026', 'MoCA/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Parkinson''s Disease/PainDETECT', 'PARKINSONSDISEASE/2026', 'PainDETECT/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Tinnitus/EQ-5D-5L', 'TINNITUS/2026', 'EQ-5D-5L/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Tinnitus/COMPASS-31', 'TINNITUS/2026', 'COMPASS-31/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Tinnitus/THI', 'TINNITUS/2026', 'THI/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Tinnitus/DASS-21', 'TINNITUS/2026', 'DASS-21/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Tinnitus/GAD-7', 'TINNITUS/2026', 'GAD-7/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Tinnitus/PSQI', 'TINNITUS/2026', 'PSQI/2026', 6, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Insomnia/EQ-5D-5L', 'INSOMNIA/2026', 'EQ-5D-5L/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Insomnia/COMPASS-31', 'INSOMNIA/2026', 'COMPASS-31/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Insomnia/DASS-21', 'INSOMNIA/2026', 'DASS-21/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Insomnia/GAD-7', 'INSOMNIA/2026', 'GAD-7/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Insomnia/PSQI', 'INSOMNIA/2026', 'PSQI/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Insomnia/AIS', 'INSOMNIA/2026', 'AIS/2026', 6, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Insomnia/FFS', 'INSOMNIA/2026', 'FFS/2026', 7, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Insomnia/ISI', 'INSOMNIA/2026', 'ISI/2026', 8, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Insomnia/SLEEP-50', 'INSOMNIA/2026', 'SLEEP-50/2026', 9, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Multiple Sclerosis/EQ-5D-5L', 'MULTIPLESCLEROSIS/2026', 'EQ-5D-5L/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Multiple Sclerosis/COMPASS-31', 'MULTIPLESCLEROSIS/2026', 'COMPASS-31/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Multiple Sclerosis/DHI', 'MULTIPLESCLEROSIS/2026', 'DHI/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Multiple Sclerosis/SARA', 'MULTIPLESCLEROSIS/2026', 'SARA/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Multiple Sclerosis/MFIS', 'MULTIPLESCLEROSIS/2026', 'MFIS/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Multiple Sclerosis/MoCA', 'MULTIPLESCLEROSIS/2026', 'MoCA/2026', 6, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Multiple Sclerosis/BARTHEL', 'MULTIPLESCLEROSIS/2026', 'BARTHEL/2026', 7, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('ADHD/EQ-5D-5L', 'ADHD/2026', 'EQ-5D-5L/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('ADHD/COMPASS-31', 'ADHD/2026', 'COMPASS-31/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('ADHD/ASRS-v1.1', 'ADHD/2026', 'ASRS-v1.1/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('ADHD/DASS-21', 'ADHD/2026', 'DASS-21/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('ADHD/SNAP-IV', 'ADHD/2026', 'SNAP-IV/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('ALS/EQ-5D-5L', 'ALS/2026', 'EQ-5D-5L/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('ALS/COMPASS-31', 'ALS/2026', 'COMPASS-31/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('ALS/DASS-21', 'ALS/2026', 'DASS-21/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('ALS/BDI-II', 'ALS/2026', 'BDI-II/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('ALS/MAS', 'ALS/2026', 'MAS/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('ALS/GAD-7', 'ALS/2026', 'GAD-7/2026', 6, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('ALS/ALSFRS-R', 'ALS/2026', 'ALSFRS-R/2026', 7, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Irritable Bowel Disease/EQ-5D-5L', 'IRRITABLEBOWELDISEASE/2026', 'EQ-5D-5L/2026', 1, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Irritable Bowel Disease/COMPASS-31', 'IRRITABLEBOWELDISEASE/2026', 'COMPASS-31/2026', 2, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Irritable Bowel Disease/IBS-SSS', 'IRRITABLEBOWELDISEASE/2026', 'IBS-SSS/2026', 3, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Irritable Bowel Disease/PRS', 'IRRITABLEBOWELDISEASE/2026', 'PRS/2026', 4, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Irritable Bowel Disease/DASS-21', 'IRRITABLEBOWELDISEASE/2026', 'DASS-21/2026', 5, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Irritable Bowel Disease/BDI-II', 'IRRITABLEBOWELDISEASE/2026', 'BDI-II/2026', 6, TRUE);
INSERT INTO prs_disease_scale_map (ds_map_id, disease_id, scale_id, display_order, is_required) VALUES ('Irritable Bowel Disease/HDRS', 'IRRITABLEBOWELDISEASE/2026', 'HDRS/2026', 7, TRUE);


-- ============================================================
-- STEP 22: VERIFICATION QUERY
-- ============================================================
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'doctors', 'patients', 'sessions', 'doctor_patient_allocations',
    'notifications', 'audit_logs',
    'prs_diseases', 'prs_scales',
    'prs_disease_scale_map', 'prs_questions', 'prs_options',
    'prs_scale_question_map', 'prs_disease_question_map',
    'assessment_permissions', 'prs_assessment_instances',
    'prs_responses', 'prs_scale_results', 'prs_final_results'
  )
ORDER BY tablename;

-- Expected: 19 tables total (7 base + 12 assessment), all with rls_enabled = true
-- v6 note: prs_scoring_rules removed; all PRS IDs are TEXT-based composites






-- Add missing columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS city         TEXT,
  ADD COLUMN IF NOT EXISTS state        TEXT,
  ADD COLUMN IF NOT EXISTS country      TEXT DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender       TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN NOT NULL DEFAULT TRUE;

-- Update role check constraint to include new roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('patient', 'doctor', 'admin', 'receptionist', 'clinical_assistant'));

-- Create the 3 new role tables if not exist
CREATE TABLE IF NOT EXISTS receptionists (
  id            UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id   TEXT UNIQUE,
  department    TEXT,
  designation   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinical_assistants (
  id                    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id           TEXT UNIQUE,
  department            TEXT,
  designation           TEXT,
  supervising_doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  id          UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE,
  department  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);













-- ============================================================
-- NeuroWellness — Full Schema Fix
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (all use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- ── 1. profiles ──────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update role CHECK to include all 5 roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('patient', 'doctor', 'admin', 'receptionist', 'clinical_assistant'));

-- ── 2. doctors ───────────────────────────────────────────────
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS specialization TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS license_number TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS hospital_affiliation TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS availability TEXT NOT NULL DEFAULT 'available';
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS current_patient_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS max_patients INTEGER NOT NULL DEFAULT 50;

-- ── 3. patients ──────────────────────────────────────────────
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS assigned_doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL;

-- ── 4. receptionists (create if missing) ─────────────────────
CREATE TABLE IF NOT EXISTS receptionists (
  id            UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id   TEXT UNIQUE,
  department    TEXT,
  designation   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE receptionists ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE receptionists ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE receptionists ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE receptionists ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 5. clinical_assistants (create if missing) ───────────────
CREATE TABLE IF NOT EXISTS clinical_assistants (
  id            UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id   TEXT UNIQUE,
  department    TEXT,
  designation   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clinical_assistants ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE clinical_assistants ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE clinical_assistants ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE clinical_assistants ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 6. admins (create if missing) ────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id            UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id   TEXT,
  department    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admins ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 7. doctor_patient_allocations (create if missing) ────────
CREATE TABLE IF NOT EXISTS doctor_patient_allocations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(patient_id, doctor_id)
);

-- ── 8. notifications (create if missing) ─────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  metadata    JSONB DEFAULT '{}',
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 9. Refresh PostgREST schema cache ────────────────────────
-- This makes Supabase aware of all new columns immediately
NOTIFY pgrst, 'reload schema';






























































































-- =============================================================================
-- Anamnesis Assessment — Table Setup SQL  (v2 — 4-table design)
-- Version : 2.0 (NeuroWellness v6.1)
-- Run in  : Supabase SQL Editor (service-role / postgres)
-- Tables  : anamnesis_assessments · anamnesis_questions
--           anamnesis_options     · anamnesis_responses
-- =============================================================================


-- =============================================================================
-- TABLE 1 — anamnesis_assessments
--   Lean header record. One per patient, forever.
--   All clinical answers live in anamnesis_responses.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.anamnesis_assessments (

    anamnesis_id    TEXT        PRIMARY KEY,    -- "ANA/{patient_id[:8]}/001"
    patient_id      UUID        NOT NULL
                                REFERENCES public.profiles(id) ON DELETE CASCADE,
    submitted_by    UUID        REFERENCES public.profiles(id),
    taken_by        TEXT        NOT NULL DEFAULT 'patient',
    status          TEXT        NOT NULL DEFAULT 'in_progress',
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_patient_anamnesis UNIQUE (patient_id),
    CONSTRAINT chk_anamnesis_status    CHECK (status   IN ('in_progress','completed')),
    CONSTRAINT chk_anamnesis_taken_by  CHECK (taken_by IN ('patient','doctor_on_behalf'))
);

CREATE TRIGGER set_anamnesis_updated_at
    BEFORE UPDATE ON public.anamnesis_assessments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_anamnesis_patient_id ON public.anamnesis_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_anamnesis_status     ON public.anamnesis_assessments(status);


-- =============================================================================
-- TABLE 2 — anamnesis_questions
--   Seed/reference table. Defines every question shown in the form.
--   Read-only for patients/doctors (they never write here).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.anamnesis_questions (

    question_id             TEXT        PRIMARY KEY,   -- "ANA/S02/Q003"
    section_number          INTEGER     NOT NULL,
    section_title           TEXT        NOT NULL,
    question_code           TEXT        NOT NULL UNIQUE,  -- snake_case, used by API
    question_text           TEXT        NOT NULL,
    answer_type             TEXT        NOT NULL,
        -- allowed: 'text' | 'textarea' | 'radio' | 'select' | 'checkbox' | 'conditional_text'
    is_required             BOOLEAN     NOT NULL DEFAULT TRUE,
    display_order           INTEGER     NOT NULL DEFAULT 0,
    depends_on_question_id  TEXT        REFERENCES public.anamnesis_questions(question_id),
    depends_on_value        TEXT,       -- show this question only when parent = this value
    helper_text             TEXT,
    status                  BOOLEAN     NOT NULL DEFAULT TRUE,

    CONSTRAINT chk_ana_q_answer_type CHECK (
        answer_type IN ('text','textarea','radio','select','checkbox','conditional_text')
    )
);

CREATE INDEX IF NOT EXISTS idx_anaq_section   ON public.anamnesis_questions(section_number);
CREATE INDEX IF NOT EXISTS idx_anaq_order     ON public.anamnesis_questions(display_order);


-- =============================================================================
-- TABLE 3 — anamnesis_options
--   One row per selectable choice for radio / select / checkbox questions.
--   Text / textarea / conditional_text questions have no rows here.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.anamnesis_options (

    option_id       TEXT        PRIMARY KEY,   -- "ANA/S02/Q003/O01"
    question_id     TEXT        NOT NULL
                                REFERENCES public.anamnesis_questions(question_id) ON DELETE CASCADE,
    option_label    TEXT        NOT NULL,      -- shown to the user
    option_value    TEXT        NOT NULL,      -- stored in response_value
    display_order   INTEGER     NOT NULL DEFAULT 0,

    CONSTRAINT unique_option_per_question UNIQUE (question_id, option_value)
);

CREATE INDEX IF NOT EXISTS idx_anaopt_question ON public.anamnesis_options(question_id);


-- =============================================================================
-- TABLE 4 — anamnesis_responses
--   One row per question per patient assessment.
--   Upserted as the patient fills the form; locked once assessment is completed.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.anamnesis_responses (

    response_id     TEXT        PRIMARY KEY,
        -- composite: "{anamnesis_id}|{question_id}"  e.g. "ANA/11111111/001|ANA/S02/Q007"
    anamnesis_id    TEXT        NOT NULL
                                REFERENCES public.anamnesis_assessments(anamnesis_id) ON DELETE CASCADE,
    question_id     TEXT        NOT NULL
                                REFERENCES public.anamnesis_questions(question_id),
    response_value  TEXT,       -- used for text / textarea / radio / select / conditional_text
    response_values TEXT[],     -- used for checkbox (multi-select), e.g. '{sleep,fatigue,pain}'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_response_per_question UNIQUE (anamnesis_id, question_id)
);

CREATE TRIGGER set_anaresp_updated_at
    BEFORE UPDATE ON public.anamnesis_responses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_anaresp_anamnesis ON public.anamnesis_responses(anamnesis_id);
CREATE INDEX IF NOT EXISTS idx_anaresp_question  ON public.anamnesis_responses(question_id);


-- =============================================================================
-- ROW-LEVEL SECURITY
-- =============================================================================

-- ── anamnesis_assessments ────────────────────────────────────────────────────
ALTER TABLE public.anamnesis_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anamnesis_patient_select"
    ON public.anamnesis_assessments FOR SELECT
    USING (auth.uid() = patient_id);

CREATE POLICY "anamnesis_doctor_select"
    ON public.anamnesis_assessments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.patients p
            WHERE p.id = anamnesis_assessments.patient_id
              AND p.assigned_doctor_id = auth.uid()
        )
    );

CREATE POLICY "anamnesis_admin_select"
    ON public.anamnesis_assessments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles pr
            WHERE pr.id = auth.uid() AND pr.role = 'admin'
        )
    );

-- ── anamnesis_questions  (read-only for all authenticated users) ─────────────
ALTER TABLE public.anamnesis_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anamnesis_questions_read_all"
    ON public.anamnesis_questions FOR SELECT
    USING (auth.role() = 'authenticated');

-- ── anamnesis_options  (read-only for all authenticated users) ───────────────
ALTER TABLE public.anamnesis_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anamnesis_options_read_all"
    ON public.anamnesis_options FOR SELECT
    USING (auth.role() = 'authenticated');

-- ── anamnesis_responses ──────────────────────────────────────────────────────
ALTER TABLE public.anamnesis_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anamnesis_responses_patient_select"
    ON public.anamnesis_responses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.anamnesis_assessments aa
            WHERE aa.anamnesis_id = anamnesis_responses.anamnesis_id
              AND aa.patient_id   = auth.uid()
        )
    );

CREATE POLICY "anamnesis_responses_doctor_select"
    ON public.anamnesis_responses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.anamnesis_assessments aa
            JOIN public.patients p ON p.id = aa.patient_id
            WHERE aa.anamnesis_id       = anamnesis_responses.anamnesis_id
              AND p.assigned_doctor_id  = auth.uid()
        )
    );

CREATE POLICY "anamnesis_responses_admin_select"
    ON public.anamnesis_responses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles pr
            WHERE pr.id = auth.uid() AND pr.role = 'admin'
        )
    );

-- All INSERT / UPDATE go through service role (backend only).




-- =============================================================================
-- SEED DATA — anamnesis_questions  (21 questions across 8 sections)
-- =============================================================================
INSERT INTO public.anamnesis_questions
    (question_id, section_number, section_title, question_code, question_text,
     answer_type, is_required, display_order, depends_on_question_id, depends_on_value, helper_text)
VALUES
-- ── Section 1 : Chief Complaint ───────────────────────────────────────────
('ANA/S01/Q001', 1, 'Chief Complaint & Diagnosis', 'chief_complaint',
 'Why are you here today? / Primary Diagnosis',
 'textarea', TRUE, 1, NULL, NULL, 'Describe the main reason for this visit and any existing diagnosis'),

-- ── Section 2 : Main Symptoms ─────────────────────────────────────────────
('ANA/S02/Q001', 2, 'Main Symptoms', 'main_symptoms',
 'What are your main symptoms?',
 'textarea', TRUE, 2, NULL, NULL, 'Describe the primary symptoms you are experiencing'),

('ANA/S02/Q002', 2, 'Main Symptoms', 'initial_symptoms',
 'What were the initial symptoms?',
 'textarea', TRUE, 3, NULL, NULL, 'Describe how your symptoms first appeared'),

('ANA/S02/Q003', 2, 'Main Symptoms', 'diagnosis_related',
 'Is there a diagnosis related to the symptoms?',
 'radio', TRUE, 4, NULL, NULL, NULL),

('ANA/S02/Q004', 2, 'Main Symptoms', 'diagnosis_details',
 'If yes, please specify the diagnosis',
 'conditional_text', FALSE, 5, 'ANA/S02/Q003', 'yes', 'Please specify the confirmed or suspected diagnosis'),

('ANA/S02/Q005', 2, 'Main Symptoms', 'symptoms_start',
 'When did the symptoms start?',
 'text', TRUE, 6, NULL, NULL, 'e.g. 3 months ago, January 2024'),

('ANA/S02/Q006', 2, 'Main Symptoms', 'symptoms_duration',
 'For how long have you had these symptoms?',
 'text', TRUE, 7, NULL, NULL, 'e.g. 2 weeks, 6 months, 2 years'),

('ANA/S02/Q007', 2, 'Main Symptoms', 'symptoms_frequency',
 'How often do you have these symptoms?',
 'select', TRUE, 8, NULL, NULL, NULL),

('ANA/S02/Q008', 2, 'Main Symptoms', 'symptoms_intensity',
 'How intense or severe are these symptoms?',
 'select', TRUE, 9, NULL, NULL, NULL),

('ANA/S02/Q009', 2, 'Main Symptoms', 'symptoms_progression',
 'Are the symptoms getting better, worse, or staying about the same?',
 'select', TRUE, 10, NULL, NULL, NULL),

-- ── Section 3 : Secondary Symptoms ────────────────────────────────────────
('ANA/S03/Q001', 3, 'Secondary Symptoms', 'secondary_symptoms',
 'What are your secondary symptoms? (select all that apply)',
 'checkbox', FALSE, 11, NULL, NULL, 'Check all that apply'),

('ANA/S03/Q002', 3, 'Secondary Symptoms', 'secondary_symptoms_details',
 'Additional details about secondary symptoms',
 'textarea', FALSE, 12, NULL, NULL, 'Please provide more details about the checked symptoms'),

-- ── Section 4 : Operations / Surgeries ────────────────────────────────────
('ANA/S04/Q001', 4, 'Operations / Surgeries', 'has_operations',
 'Have you had any operations or surgeries?',
 'radio', TRUE, 13, NULL, NULL, NULL),

('ANA/S04/Q002', 4, 'Operations / Surgeries', 'operations_details',
 'If yes, please provide details',
 'conditional_text', FALSE, 14, 'ANA/S04/Q001', 'yes',
 'Include: which operations, how many, when performed, post-surgery condition / effects'),

-- ── Section 5 : Previous / Ongoing Treatments ────────────────────────────
('ANA/S05/Q001', 5, 'Previous or Ongoing Treatments', 'previous_treatments',
 'Previous or ongoing treatments (physiotherapy, speech therapy, psychotherapy, etc.)',
 'textarea', FALSE, 15, NULL, NULL,
 'Include: type of treatment, how long, how often, outcomes / improvements'),

-- ── Section 6 : Medications & Supplements ────────────────────────────────
('ANA/S06/Q001', 6, 'Medications & Supplements', 'current_medications',
 'Current medications and supplements',
 'textarea', FALSE, 16, NULL, NULL, 'List all current medications and supplements with dosages'),

-- ── Section 7 : Brain MRI & Other Scans ──────────────────────────────────
('ANA/S07/Q001', 7, 'Brain MRI & Other Scans', 'has_brain_mri',
 'Have you had a Brain MRI?',
 'radio', TRUE, 17, NULL, NULL, NULL),

('ANA/S07/Q002', 7, 'Brain MRI & Other Scans', 'mri_details',
 'If yes, when was it performed and what were the results?',
 'conditional_text', FALSE, 18, 'ANA/S07/Q001', 'yes',
 'Include: date of MRI, results, any other relevant findings'),

('ANA/S07/Q003', 7, 'Brain MRI & Other Scans', 'other_scans',
 'Other scans (CT, EEG, EMG, etc.)',
 'textarea', FALSE, 19, NULL, NULL, 'List any other diagnostic scans or tests performed'),

-- ── Section 8 : Neuromodulation Experience ────────────────────────────────
('ANA/S08/Q001', 8, 'Neuromodulation Experience', 'has_neuromodulation',
 'Have you used any neuromodulation techniques before?',
 'radio', TRUE, 20, NULL, NULL, NULL),

('ANA/S08/Q002', 8, 'Neuromodulation Experience', 'neuromodulation_details',
 'If yes, please specify devices used and experience',
 'conditional_text', FALSE, 21, 'ANA/S08/Q001', 'yes',
 'Include: type of device, duration of use, effectiveness, any side effects')

ON CONFLICT (question_id) DO NOTHING;


-- =============================================================================
-- SEED DATA — anamnesis_options
-- =============================================================================
INSERT INTO public.anamnesis_options (option_id, question_id, option_label, option_value, display_order)
VALUES
-- ANA/S02/Q003  diagnosis_related  (radio)
('ANA/S02/Q003/O01', 'ANA/S02/Q003', 'Yes', 'yes', 1),
('ANA/S02/Q003/O02', 'ANA/S02/Q003', 'No',  'no',  2),

-- ANA/S02/Q007  symptoms_frequency  (select)
('ANA/S02/Q007/O01', 'ANA/S02/Q007', 'Daily',                'daily',              1),
('ANA/S02/Q007/O02', 'ANA/S02/Q007', 'Several times a week', 'several-times-week', 2),
('ANA/S02/Q007/O03', 'ANA/S02/Q007', 'Weekly',               'weekly',             3),
('ANA/S02/Q007/O04', 'ANA/S02/Q007', 'Monthly',              'monthly',            4),
('ANA/S02/Q007/O05', 'ANA/S02/Q007', 'Occasionally',         'occasionally',       5),

-- ANA/S02/Q008  symptoms_intensity  (select)
('ANA/S02/Q008/O01', 'ANA/S02/Q008', 'Mild',        'mild',       1),
('ANA/S02/Q008/O02', 'ANA/S02/Q008', 'Moderate',    'moderate',   2),
('ANA/S02/Q008/O03', 'ANA/S02/Q008', 'Severe',      'severe',     3),
('ANA/S02/Q008/O04', 'ANA/S02/Q008', 'Very Severe', 'very-severe',4),

-- ANA/S02/Q009  symptoms_progression  (select)
('ANA/S02/Q009/O01', 'ANA/S02/Q009', 'Getting better',          'better',     1),
('ANA/S02/Q009/O02', 'ANA/S02/Q009', 'Getting worse',           'worse',      2),
('ANA/S02/Q009/O03', 'ANA/S02/Q009', 'Staying about the same',  'same',       3),
('ANA/S02/Q009/O04', 'ANA/S02/Q009', 'Fluctuating',             'fluctuating',4),

-- ANA/S03/Q001  secondary_symptoms  (checkbox)
('ANA/S03/Q001/O01', 'ANA/S03/Q001', 'Sleep Issues',           'sleep',           1),
('ANA/S03/Q001/O02', 'ANA/S03/Q001', 'Concentration Problems', 'concentration',   2),
('ANA/S03/Q001/O03', 'ANA/S03/Q001', 'Memory Issues',          'memory',          3),
('ANA/S03/Q001/O04', 'ANA/S03/Q001', 'Gastrointestinal Issues','gastrointestinal', 4),
('ANA/S03/Q001/O05', 'ANA/S03/Q001', 'Mood Fluctuations',      'mood',            5),
('ANA/S03/Q001/O06', 'ANA/S03/Q001', 'Fatigue',                'fatigue',         6),
('ANA/S03/Q001/O07', 'ANA/S03/Q001', 'Weakness',               'weakness',        7),
('ANA/S03/Q001/O08', 'ANA/S03/Q001', 'Pain',                   'pain',            8),
('ANA/S03/Q001/O09', 'ANA/S03/Q001', 'Depression/Anxiety',     'depression',      9),
('ANA/S03/Q001/O10', 'ANA/S03/Q001', 'Bladder Function Issues','bladder',         10),

-- ANA/S04/Q001  has_operations  (radio)
('ANA/S04/Q001/O01', 'ANA/S04/Q001', 'Yes', 'yes', 1),
('ANA/S04/Q001/O02', 'ANA/S04/Q001', 'No',  'no',  2),

-- ANA/S07/Q001  has_brain_mri  (radio)
('ANA/S07/Q001/O01', 'ANA/S07/Q001', 'Yes', 'yes', 1),
('ANA/S07/Q001/O02', 'ANA/S07/Q001', 'No',  'no',  2),

-- ANA/S08/Q001  has_neuromodulation  (radio)
('ANA/S08/Q001/O01', 'ANA/S08/Q001', 'Yes', 'yes', 1),
('ANA/S08/Q001/O02', 'ANA/S08/Q001', 'No',  'no',  2)

ON CONFLICT (option_id) DO NOTHING;


-- =============================================================================
-- VERIFICATION  (uncomment to run individually after setup)
-- =============================================================================
-- SELECT COUNT(*) FROM public.anamnesis_questions;   -- expect 21
-- SELECT COUNT(*) FROM public.anamnesis_options;     -- expect 31
-- SELECT question_id, question_text, answer_type FROM public.anamnesis_questions ORDER BY display_order;
-- SELECT * FROM public.anamnesis_options ORDER BY question_id, display_order;




































CREATE TABLE doctor_notes (
    note_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID       NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id  UUID       NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    note_text  TEXT       NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (patient_id, doctor_id)
);

-- Only the owning doctor can read or write their notes
ALTER TABLE doctor_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor_notes_own" ON doctor_notes
    USING (auth.uid() = doctor_id)
    WITH CHECK (auth.uid() = doctor_id);






























-- Phase 1B: Create clinics table
CREATE TABLE clinics (
    clinic_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_name TEXT NOT NULL,
    owner_name  TEXT NOT NULL,
    address     TEXT,
    phone       TEXT,
    email       TEXT,
    city        TEXT,
    state       TEXT,
    country     TEXT NOT NULL DEFAULT 'India',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinics_is_active ON clinics(is_active);

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_clinics" ON clinics FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "public_read_active_clinics" ON clinics FOR SELECT TO anon USING (is_active = TRUE);









-- Phase 1C: Add clinic_id to all tables
ALTER TABLE profiles              ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;
ALTER TABLE doctors               ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;
ALTER TABLE patients              ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;
ALTER TABLE receptionists         ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;
ALTER TABLE clinical_assistants   ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;
ALTER TABLE admins                ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;
ALTER TABLE sessions              ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;
ALTER TABLE doctor_patient_allocations ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;



-- Phase 1D: Add approval_status to patients
ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));




-- Add clinic_id to all role-specific tables (safe to run again with IF NOT EXISTS)
ALTER TABLE doctors             ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;
ALTER TABLE receptionists       ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;
ALTER TABLE clinical_assistants ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;
ALTER TABLE admins              ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;
ALTER TABLE patients            ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;
ALTER TABLE sessions            ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;

-- Also add approval_status to patients if not done
ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));






































CREATE OR REPLACE FUNCTION increment_doctor_patient_count(doctor_id UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE doctors
  SET current_patient_count = current_patient_count + 1
  WHERE id = doctor_id;
$$;


-- Atomic patient registration (profiles + patients + doctor count in one transaction)
CREATE OR REPLACE FUNCTION register_patient_db(
    p_id UUID, p_full_name TEXT, p_email TEXT, p_phone TEXT,
    p_city TEXT, p_state TEXT, p_country TEXT,
    p_date_of_birth TEXT, p_gender TEXT,
    p_clinic_id UUID, p_is_active BOOLEAN,
    p_medical_history TEXT, p_emergency_contact TEXT,
    p_doctor_id UUID, p_approval_status TEXT
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO profiles (id, role, full_name, email, phone, city, state, country,
                          date_of_birth, gender, clinic_id, is_active)
    VALUES (p_id, 'patient', p_full_name, p_email, p_phone, p_city, p_state,
            p_country, p_date_of_birth, p_gender, p_clinic_id, p_is_active);

    INSERT INTO patients (id, clinic_id, medical_history, emergency_contact,
                          assigned_doctor_id, approval_status)
    VALUES (p_id, p_clinic_id, p_medical_history, p_emergency_contact,
            p_doctor_id, p_approval_status);

    IF p_doctor_id IS NOT NULL THEN
        UPDATE doctors SET current_patient_count = current_patient_count + 1
        WHERE id = p_doctor_id;
    END IF;
END;
$$;




-- Atomic staff registration (profiles + role table in one transaction)
CREATE OR REPLACE FUNCTION register_staff_db(
    p_id UUID, p_role TEXT, p_full_name TEXT, p_email TEXT,
    p_phone TEXT, p_city TEXT, p_state TEXT, p_country TEXT,
    p_clinic_id UUID,
    p_specialization TEXT, p_license_number TEXT,
    p_hospital_affiliation TEXT, p_years_of_experience INT,
    p_employee_id TEXT, p_department TEXT, p_designation TEXT
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO profiles (id, role, full_name, email, phone, city, state, country, clinic_id, is_active)
    VALUES (p_id, p_role, p_full_name, p_email, p_phone, p_city, p_state, p_country, p_clinic_id, TRUE);

    IF p_role = 'doctor' THEN
        INSERT INTO doctors (id, clinic_id, specialization, license_number,
                             hospital_affiliation, years_of_experience,
                             availability, current_patient_count, max_patients)
        VALUES (p_id, p_clinic_id, p_specialization, p_license_number,
                p_hospital_affiliation, p_years_of_experience,
                'available', 0, 50);
    ELSIF p_role = 'receptionist' THEN
        INSERT INTO receptionists (id, clinic_id, employee_id, department, designation)
        VALUES (p_id, p_clinic_id, p_employee_id, p_department, p_designation);
    ELSIF p_role = 'clinical_assistant' THEN
        INSERT INTO clinical_assistants (id, clinic_id, employee_id, department, designation)
        VALUES (p_id, p_clinic_id, p_employee_id, p_department, p_designation);
    END IF;
END;
$$;






ALTER TABLE prs_assessment_instances
    ADD COLUMN IF NOT EXISTS instance_label TEXT;



-- Add clinic_id to sessions (may already exist from Phase 1C — safe with IF NOT EXISTS)
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;

-- Add clinic_id to assessment_permissions
ALTER TABLE assessment_permissions
    ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;

-- Add clinic_id to prs_assessment_instances
ALTER TABLE prs_assessment_instances
    ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL;

-- Indexes for fast clinic-scoped queries
CREATE INDEX IF NOT EXISTS idx_assessment_permissions_clinic_id ON assessment_permissions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_prs_instances_clinic_id ON prs_assessment_instances(clinic_id);





SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('date_of_birth', 'gender');






ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));


SELECT prosrc FROM pg_proc WHERE proname = 'register_patient_db';



-- Check
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('date_of_birth', 'gender');

-- Add if missing (safe to run either way)
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));




ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url    TEXT,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS pincode       TEXT,
  ADD COLUMN IF NOT EXISTS language_pref TEXT DEFAULT 'en';


ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS mrn               TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS blood_group       TEXT CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')),
  ADD COLUMN IF NOT EXISTS allergies         TEXT,
  ADD COLUMN IF NOT EXISTS occupation        TEXT,
  ADD COLUMN IF NOT EXISTS marital_status    TEXT CHECK (marital_status IN ('single','married','divorced','widowed','other')),
  ADD COLUMN IF NOT EXISTS insurance_provider TEXT,
  ADD COLUMN IF NOT EXISTS insurance_policy  TEXT,
  ADD COLUMN IF NOT EXISTS referred_by       TEXT;



CREATE SEQUENCE IF NOT EXISTS mrn_seq START 10001;
CREATE OR REPLACE FUNCTION generate_mrn() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mrn IS NULL THEN
    NEW.mrn := 'NW-' || LPAD(nextval('mrn_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER set_mrn BEFORE INSERT ON patients FOR EACH ROW EXECUTE FUNCTION generate_mrn();





CREATE OR REPLACE FUNCTION register_patient_db(
  p_id UUID, p_full_name TEXT, p_email TEXT, p_phone TEXT,
  p_city TEXT, p_state TEXT, p_country TEXT,
  p_date_of_birth DATE, p_gender TEXT,
  p_clinic_id UUID, p_is_active BOOLEAN,
  p_medical_history TEXT, p_emergency_contact TEXT,
  p_doctor_id UUID, p_approval_status TEXT,
  p_address_line1 TEXT DEFAULT NULL,
  p_pincode TEXT DEFAULT NULL,
  p_language_pref TEXT DEFAULT 'en',
  p_blood_group TEXT DEFAULT NULL,
  p_allergies TEXT DEFAULT NULL,
  p_occupation TEXT DEFAULT NULL,
  p_marital_status TEXT DEFAULT NULL,
  p_insurance_provider TEXT DEFAULT NULL,
  p_insurance_policy TEXT DEFAULT NULL,
  p_referred_by TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name, email, phone, city, state, country,
                        date_of_birth, gender, clinic_id, is_active,
                        address_line1, pincode, language_pref)
  VALUES (p_id, 'patient', p_full_name, p_email, p_phone, p_city, p_state, p_country,
          p_date_of_birth, p_gender, p_clinic_id, p_is_active,
          p_address_line1, p_pincode, COALESCE(p_language_pref, 'en'));

  INSERT INTO patients (id, clinic_id, medical_history, emergency_contact,
                        assigned_doctor_id, approval_status,
                        blood_group, allergies, occupation, marital_status,
                        insurance_provider, insurance_policy, referred_by)
  VALUES (p_id, p_clinic_id, p_medical_history, p_emergency_contact,
          p_doctor_id, p_approval_status,
          p_blood_group, p_allergies, p_occupation, p_marital_status,
          p_insurance_provider, p_insurance_policy, p_referred_by);

  IF p_doctor_id IS NOT NULL THEN
    UPDATE doctors SET current_patient_count = current_patient_count + 1
    WHERE id = p_doctor_id;
  END IF;
END;
$$ LANGUAGE plpgsql;





-- Soft delete columns for patients, doctors, receptionists, clinical_assistants
-- Run this in Supabase SQL Editor

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE receptionists
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE clinical_assistants
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;



















CREATE TABLE IF NOT EXISTS consent_forms (
    consent_form_id   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    consent_form_name TEXT        NOT NULL UNIQUE,
    is_required       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE consent_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_consent_forms"
    ON consent_forms FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "public_read_consent_forms"
    ON consent_forms FOR SELECT
    USING (TRUE);

INSERT INTO consent_forms (consent_form_name, is_required)
VALUES ('Data Privacy and Security Form', TRUE);

CREATE TABLE IF NOT EXISTS user_consent_responses (
    consent_response_id UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    consent_form_id     UUID        NOT NULL REFERENCES consent_forms(consent_form_id) ON DELETE CASCADE,
    consent_form_name   TEXT        NOT NULL,
    response            BOOLEAN     NOT NULL,
    responded_at        TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_form UNIQUE (user_id, consent_form_id)
);

ALTER TABLE user_consent_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_consent_responses"
    ON user_consent_responses FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "user_view_own_responses"
    ON user_consent_responses FOR SELECT
    USING (auth.uid() = user_id);









-- ============================================================
-- BLOCK 1: Extensions (safe re-run)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- BLOCK 2: doctor_availability (weekly schedule)
-- ============================================================
CREATE TABLE IF NOT EXISTS doctor_availability (
    id                    UUID     DEFAULT uuid_generate_v4() PRIMARY KEY,
    doctor_id             UUID     NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id             UUID     REFERENCES clinics(clinic_id) ON DELETE SET NULL,
    day_of_week           SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time            TIME     NOT NULL,
    end_time              TIME     NOT NULL,
    slot_duration_minutes INTEGER  NOT NULL DEFAULT 30 CHECK (slot_duration_minutes > 0),
    is_active             BOOLEAN  NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT availability_time_check CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_doctor_avail_doctor
    ON doctor_availability(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_avail_clinic
    ON doctor_availability(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctor_avail_active_day
    ON doctor_availability(doctor_id, day_of_week)
    WHERE is_active = TRUE;

CREATE TRIGGER trg_doctor_availability_updated_at
    BEFORE UPDATE ON doctor_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE doctor_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_doctor_availability"
    ON doctor_availability FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "public_read_active_availability"
    ON doctor_availability FOR SELECT
    USING (is_active = TRUE);


-- ============================================================
-- BLOCK 3: appointment_requests (patient-initiated)
-- Create BEFORE appointments to avoid circular FK
-- ============================================================
CREATE TABLE IF NOT EXISTS appointment_requests (
    id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id           UUID NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,
    doctor_id            UUID NOT NULL REFERENCES doctors(id)   ON DELETE RESTRICT,
    clinic_id            UUID          REFERENCES clinics(clinic_id) ON DELETE SET NULL,
    preferred_date       DATE NOT NULL,
    preferred_time_start TIME NOT NULL,
    preferred_time_end   TIME,
    appointment_type     TEXT NOT NULL DEFAULT 'in_person'
                             CHECK (appointment_type IN ('in_person', 'telehealth')),
    reason               TEXT,
    status               TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at          TIMESTAMPTZ,
    review_notes         TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appt_req_patient
    ON appointment_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_req_doctor
    ON appointment_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appt_req_status
    ON appointment_requests(status);
CREATE INDEX IF NOT EXISTS idx_appt_req_date
    ON appointment_requests(preferred_date);

CREATE TRIGGER trg_appointment_requests_updated_at
    BEFORE UPDATE ON appointment_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE appointment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_appointment_requests"
    ON appointment_requests FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "patient_view_own_requests"
    ON appointment_requests FOR SELECT
    USING (auth.uid() = patient_id);


-- ============================================================
-- BLOCK 4: appointments (core booking — references requests table)
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id          UUID NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,
    doctor_id           UUID NOT NULL REFERENCES doctors(id)   ON DELETE RESTRICT,
    clinic_id           UUID          REFERENCES clinics(clinic_id) ON DELETE SET NULL,
    request_id          UUID          REFERENCES appointment_requests(id) ON DELETE SET NULL,
    appointment_date    DATE NOT NULL,
    start_time          TIME NOT NULL,
    end_time            TIME NOT NULL,
    status              TEXT NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled')),
    appointment_type    TEXT NOT NULL DEFAULT 'in_person'
                            CHECK (appointment_type IN ('in_person', 'telehealth')),
    reason              TEXT,
    doctor_notes        TEXT,
    booked_by           UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    cancelled_by        UUID          REFERENCES profiles(id) ON DELETE SET NULL,
    cancelled_at        TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT appointment_time_check CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient
    ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor
    ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic
    ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date
    ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status
    ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date_active
    ON appointments(doctor_id, appointment_date)
    WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_appointments_request
    ON appointments(request_id)
    WHERE request_id IS NOT NULL;

CREATE TRIGGER trg_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_appointments"
    ON appointments FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "patient_view_own_appointments"
    ON appointments FOR SELECT
    USING (auth.uid() = patient_id);


-- ============================================================
-- BLOCK 5: appointment_audit_log (reschedule + cancel history)
-- ============================================================
CREATE TABLE IF NOT EXISTS appointment_audit_log (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    action         TEXT NOT NULL
                       CHECK (action IN (
                           'scheduled', 'rescheduled', 'cancelled',
                           'completed', 'no_show', 'status_change'
                       )),
    old_date       DATE,
    old_start_time TIME,
    old_end_time   TIME,
    old_status     TEXT,
    new_date       DATE,
    new_start_time TIME,
    new_end_time   TIME,
    new_status     TEXT,
    changed_by     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    change_reason  TEXT,
    changed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_appointment
    ON appointment_audit_log(appointment_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by
    ON appointment_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_action
    ON appointment_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at
    ON appointment_audit_log(changed_at DESC);

ALTER TABLE appointment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_appointment_audit"
    ON appointment_audit_log FOR ALL
    USING (auth.role() = 'service_role');


























































-- 002_appointment_system.sql
-- Brings the appointment schema in line with the backend code (Milestone A/B).
-- The previously-applied tables (appointments, appointment_requests) had a
-- different, minimal shape and are EMPTY, so we drop and recreate them here.
-- Safe to run once in the Supabase SQL editor.

BEGIN;

-- 0. Drop the divergent, empty tables (and anything depending on them).
DROP TABLE IF EXISTS appointment_history       CASCADE;
DROP TABLE IF EXISTS appointment_requests       CASCADE;
DROP TABLE IF EXISTS appointments               CASCADE;
DROP TABLE IF EXISTS doctor_schedule_overrides  CASCADE;
DROP TABLE IF EXISTS doctor_weekly_schedules    CASCADE;

-- 1. Doctor weekly recurring schedule -----------------------------------------
CREATE TABLE doctor_weekly_schedules (
  schedule_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clinic_id              UUID NOT NULL REFERENCES clinics(clinic_id),
  day_of_week            SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun..6=Sat
  start_time             TIME NOT NULL,
  end_time               TIME NOT NULL,
  slot_duration_minutes  SMALLINT NOT NULL DEFAULT 30
                         CHECK (slot_duration_minutes IN (15,20,30,45,60)),
  break_start            TIME,
  break_end              TIME,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from         DATE,
  effective_until        DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_dws_times CHECK (end_time > start_time),
  CONSTRAINT chk_dws_break CHECK (
    (break_start IS NULL AND break_end IS NULL)
    OR (break_start IS NOT NULL AND break_end IS NOT NULL
        AND break_start >= start_time AND break_end <= end_time AND break_end > break_start)
  ),
  UNIQUE (doctor_id, day_of_week, start_time)
);
CREATE INDEX idx_dws_doctor ON doctor_weekly_schedules(doctor_id, is_active);
CREATE INDEX idx_dws_clinic ON doctor_weekly_schedules(clinic_id);

-- 2. Doctor date-level overrides ----------------------------------------------
CREATE TABLE doctor_schedule_overrides (
  override_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clinic_id     UUID NOT NULL REFERENCES clinics(clinic_id),
  override_date DATE NOT NULL,
  is_available  BOOLEAN NOT NULL DEFAULT FALSE,
  start_time    TIME,
  end_time      TIME,
  reason        TEXT,
  created_by    UUID NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_override_times CHECK (
    is_available = FALSE OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  ),
  UNIQUE (doctor_id, override_date)
);
CREATE INDEX idx_dso_doctor_date ON doctor_schedule_overrides(doctor_id, override_date);

-- 3. Appointment requests (created without cross-FKs; added after appointments)
CREATE TABLE appointment_requests (
  request_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id               UUID REFERENCES clinics(clinic_id),
  patient_id              UUID NOT NULL REFERENCES profiles(id),
  doctor_id               UUID NOT NULL REFERENCES profiles(id),
  request_type            TEXT NOT NULL DEFAULT 'new' CHECK (request_type IN ('new','reschedule')),
  parent_appointment_id   UUID,
  preferred_date_1        DATE NOT NULL,
  preferred_date_2        DATE,
  preferred_date_3        DATE,
  preferred_time_window   TEXT NOT NULL DEFAULT 'any'
                          CHECK (preferred_time_window IN ('morning','afternoon','evening','any')),
  patient_complaint       TEXT NOT NULL,
  reason                  TEXT,
  urgency                 TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal','urgent','emergency')),
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected','cancelled_by_patient','expired')),
  approved_appointment_id UUID,
  reviewed_by             UUID REFERENCES profiles(id),
  reviewed_at             TIMESTAMPTZ,
  review_notes            TEXT,
  expires_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_reschedule_has_parent CHECK (
    request_type = 'new' OR (request_type = 'reschedule' AND parent_appointment_id IS NOT NULL)
  )
);
CREATE INDEX idx_apt_req_clinic_status  ON appointment_requests(clinic_id, status, created_at DESC);
CREATE INDEX idx_apt_req_patient        ON appointment_requests(patient_id, created_at DESC);
CREATE INDEX idx_apt_req_doctor         ON appointment_requests(doctor_id);
CREATE INDEX idx_apt_req_pending_expiry ON appointment_requests(expires_at) WHERE status = 'pending';
CREATE UNIQUE INDEX uq_apt_req_one_pending_reschedule
  ON appointment_requests(parent_appointment_id)
  WHERE status = 'pending' AND request_type = 'reschedule';

-- 4. Appointments -------------------------------------------------------------
CREATE TABLE appointments (
  appointment_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id              UUID REFERENCES clinics(clinic_id),
  patient_id             UUID NOT NULL REFERENCES profiles(id),
  doctor_id              UUID NOT NULL REFERENCES profiles(id),
  booked_by              UUID NOT NULL REFERENCES profiles(id),
  booked_by_role         TEXT NOT NULL CHECK (booked_by_role IN ('doctor','receptionist','clinical_assistant','admin')),
  appointment_request_id UUID REFERENCES appointment_requests(request_id),
  appointment_date       DATE NOT NULL,
  start_time             TIME NOT NULL,
  end_time               TIME NOT NULL,
  start_at               TIMESTAMPTZ NOT NULL,
  end_at                 TIMESTAMPTZ NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled','confirmed','checked_in','in_progress',
                                           'completed','cancelled','no_show','rescheduled')),
  appointment_type       TEXT NOT NULL DEFAULT 'consultation'
                         CHECK (appointment_type IN ('consultation','follow_up','assessment','emergency','video')),
  reason                 TEXT,
  notes                  TEXT,
  patient_complaint      TEXT,
  cancellation_reason    TEXT,
  cancelled_by           UUID REFERENCES profiles(id),
  cancelled_at           TIMESTAMPTZ,
  rescheduled_from       UUID REFERENCES appointments(appointment_id),
  rescheduled_to         UUID REFERENCES appointments(appointment_id),
  session_id             UUID REFERENCES sessions(id),
  reminder_24h_sent_at   TIMESTAMPTZ,
  reminder_1h_sent_at    TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_apt_times CHECK (end_time > start_time),
  CONSTRAINT uq_doctor_slot UNIQUE (doctor_id, appointment_date, start_time)
);
CREATE INDEX idx_apt_doctor_date  ON appointments(doctor_id, appointment_date) WHERE status NOT IN ('cancelled','no_show');
CREATE INDEX idx_apt_patient_date ON appointments(patient_id, appointment_date);
CREATE INDEX idx_apt_clinic_date  ON appointments(clinic_id, appointment_date);
CREATE INDEX idx_apt_status       ON appointments(status);
CREATE INDEX idx_apt_start_at     ON appointments(start_at);
CREATE INDEX idx_apt_request      ON appointments(appointment_request_id);

-- 5. Add the cross-FKs back onto appointment_requests -------------------------
ALTER TABLE appointment_requests
  ADD CONSTRAINT fk_apt_req_parent   FOREIGN KEY (parent_appointment_id)   REFERENCES appointments(appointment_id),
  ADD CONSTRAINT fk_apt_req_approved FOREIGN KEY (approved_appointment_id) REFERENCES appointments(appointment_id);

-- 6. Append-only audit log ----------------------------------------------------
CREATE TABLE appointment_history (
  history_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('appointment','request')),
  entity_id       UUID NOT NULL,
  action          TEXT NOT NULL,
  old_status      TEXT,
  new_status      TEXT,
  changed_by      UUID,
  changed_by_role TEXT,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB DEFAULT '{}'::jsonb,
  notes           TEXT
);
CREATE INDEX idx_apt_hist_entity ON appointment_history(entity_type, entity_id, changed_at DESC);

-- 7. Link clinical sessions to appointments -----------------------------------
ALTER TABLE sessions DROP COLUMN IF EXISTS appointment_id;
ALTER TABLE sessions ADD  COLUMN appointment_id UUID REFERENCES appointments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_sessions_appointment ON sessions(appointment_id);

-- 8. RLS (defense-in-depth; backend uses the service key which bypasses RLS) --
ALTER TABLE appointments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_weekly_schedules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_history       ENABLE ROW LEVEL SECURITY;

CREATE POLICY apt_patient_select ON appointments FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY apt_doctor_select  ON appointments FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY apt_staff_select   ON appointments FOR SELECT USING (EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = auth.uid()
    AND p.role IN ('receptionist','clinical_assistant','admin') AND p.clinic_id = appointments.clinic_id));

CREATE POLICY apt_req_patient_select ON appointment_requests FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY apt_req_staff_select   ON appointment_requests FOR SELECT USING (EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = auth.uid()
    AND p.role IN ('receptionist','clinical_assistant','doctor','admin') AND p.clinic_id = appointment_requests.clinic_id));

CREATE POLICY sched_owner_select ON doctor_weekly_schedules FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY sched_staff_select ON doctor_weekly_schedules FOR SELECT USING (EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = auth.uid()
    AND p.role IN ('receptionist','clinical_assistant','admin') AND p.clinic_id = doctor_weekly_schedules.clinic_id));

CREATE POLICY override_owner_select ON doctor_schedule_overrides FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY override_staff_select ON doctor_schedule_overrides FOR SELECT USING (EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = auth.uid()
    AND p.role IN ('receptionist','clinical_assistant','admin') AND p.clinic_id = doctor_schedule_overrides.clinic_id));

COMMIT;




-- backend/migrations/004_slot_min_1h.sql
ALTER TABLE doctor_weekly_schedules DROP CONSTRAINT IF EXISTS doctor_weekly_schedules_slot_duration_minutes_check;
ALTER TABLE doctor_weekly_schedules ADD CONSTRAINT doctor_weekly_schedules_slot_duration_minutes_check CHECK (slot_duration_minutes IN (60, 90, 120));
ALTER TABLE doctor_weekly_schedules ALTER COLUMN slot_duration_minutes SET DEFAULT 60;














































-- ============================================================
-- 005_production_hardening_safe.sql
-- Purpose: tighten the schema for production WITHOUT requiring
--          any backend or frontend code changes.
--
-- Run in Supabase SQL Editor (service-role / postgres). Take a
-- snapshot first (Supabase Dashboard → Database → Backups).
--
-- Everything in this file is ADDITIVE:
--   • no constraints are dropped
--   • the existing upsert path stays compatible
--   • no columns change type
--   • no data is rewritten
-- ============================================================

BEGIN;

-- ============================================================
-- A. Helpful extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- already used for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- fuzzy / trigram search
-- pg_stat_statements: enable if Supabase plan allows; ignore the error otherwise.
DO $$ BEGIN
  CREATE EXTENSION pg_stat_statements;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_stat_statements not enabled (requires elevated privileges) — skipping.';
END $$;


-- ============================================================
-- B. Plug the nullable-session_id UNIQUE bypass on
--    assessment_permissions WITHOUT removing the existing
--    UNIQUE that the backend upsert relies on.
-- ============================================================
-- Original constraint kept intact:
--   UNIQUE (patient_id, scale_id, session_id)   ← upsert uses this
-- Add a second partial unique index for the NULL session_id case:
CREATE UNIQUE INDEX IF NOT EXISTS uq_perm_no_session
  ON assessment_permissions(patient_id, scale_id)
  WHERE session_id IS NULL;


-- ============================================================
-- C. profiles.email — case-insensitive uniqueness
--    Pre-flight: run this SELECT first; if it returns rows, dedupe
--    those profiles manually BEFORE re-running this migration.
--    SELECT LOWER(email), COUNT(*) FROM profiles
--      WHERE email IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_email_ci
  ON profiles(LOWER(email))
  WHERE email IS NOT NULL;


-- ============================================================
-- D. Generic updated_at trigger applied to every table that
--    HAS the column but is missing the trigger.
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables  t USING (table_schema, table_name)
     WHERE c.table_schema = 'public'
       AND c.column_name  = 'updated_at'
       AND t.table_type   = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_updated_at ON public.%I', r.table_name);
    EXECUTE format('CREATE TRIGGER trg_touch_updated_at
                    BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',
                   r.table_name);
  END LOOP;
END $$;


-- ============================================================
-- E. audit_logs → append-only.
--    Block UPDATE and DELETE from all client roles. Service-role
--    can still INSERT (which is all the backend needs).
-- ============================================================
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
REVOKE UPDATE, DELETE ON audit_logs FROM anon;
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;
-- service_role keeps INSERT/SELECT; UPDATE/DELETE removed as well to enforce immutability.
REVOKE UPDATE, DELETE ON audit_logs FROM service_role;
GRANT  INSERT, SELECT  ON audit_logs TO service_role;


-- ============================================================
-- F. Cross-clinic safety: patients.assigned_doctor_id must point
--    to a doctor in the SAME clinic. Fires only on INSERT/UPDATE,
--    so existing rows are not touched.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_patient_doctor_same_clinic()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE d_clinic UUID;
BEGIN
  IF NEW.assigned_doctor_id IS NULL THEN RETURN NEW; END IF;
  SELECT clinic_id INTO d_clinic FROM public.doctors WHERE id = NEW.assigned_doctor_id;
  IF d_clinic IS NOT NULL AND NEW.clinic_id IS NOT NULL AND d_clinic <> NEW.clinic_id THEN
    RAISE EXCEPTION 'assigned_doctor_id (clinic %) does not match patient.clinic_id (%)',
                    d_clinic, NEW.clinic_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_patient_same_clinic ON public.patients;
CREATE TRIGGER trg_patient_same_clinic
  BEFORE INSERT OR UPDATE OF assigned_doctor_id, clinic_id ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.enforce_patient_doctor_same_clinic();


-- ============================================================
-- G. Hot-path indexes (read performance, no behaviour change)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_feed
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patients_clinic_active
  ON patients(clinic_id, is_active);

CREATE INDEX IF NOT EXISTS idx_patients_clinic_approval
  ON patients(clinic_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_pr_response_question
  ON prs_responses(question_id);

CREATE INDEX IF NOT EXISTS idx_pai_disease_status
  ON prs_assessment_instances(disease_id, status);

CREATE INDEX IF NOT EXISTS idx_perm_patient_disease
  ON assessment_permissions(patient_id, disease_id);

CREATE INDEX IF NOT EXISTS idx_doctors_clinic_avail
  ON doctors(clinic_id, availability);

-- Trigram (fuzzy) search indexes for patient / doctor pickers.
CREATE INDEX IF NOT EXISTS idx_profiles_fullname_trgm
  ON profiles USING gin (full_name gin_trgm_ops)
  WHERE full_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm
  ON profiles USING gin (email gin_trgm_ops)
  WHERE email IS NOT NULL;

-- Optional: speed up soft-delete-aware lookups
CREATE INDEX IF NOT EXISTS idx_patients_alive
  ON patients(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doctors_alive
  ON doctors(id)  WHERE deleted_at IS NULL;


-- ============================================================
-- H. Soft-delete consistency (additive nullable columns)
--    Profiles / admins / sessions did not have these.
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;


-- ============================================================
-- I. Keep prs_disease_question_map in sync with the source maps.
--    Manual REFRESH function — backend never has to call it; you
--    run it after editing disease/scale/question seeds.
--    (Safer than auto-triggers during bulk seed loads.)
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_disease_question_map()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM public.prs_disease_question_map;

  INSERT INTO public.prs_disease_question_map
        (dq_map_id, disease_id, question_id, display_order)
  SELECT dsm.disease_id || '/' || sqm.question_id AS dq_map_id,
         dsm.disease_id,
         sqm.question_id,
         (dsm.display_order * 1000) + sqm.display_order AS display_order
    FROM public.prs_disease_scale_map  dsm
    JOIN public.prs_scale_question_map sqm ON sqm.scale_id = dsm.scale_id
  ON CONFLICT (dq_map_id) DO NOTHING;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Run it once now so the map reflects current data:
SELECT public.refresh_disease_question_map();


-- ============================================================
-- J. PostgREST schema cache reload (so the new indexes /
--    triggers are picked up by Supabase REST immediately).
-- ============================================================
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- K. Profile self-edit — name split + government ID fields
--    first_name / last_name stored separately; full_name kept
--    in sync by the backend (first + " " + last).
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name      TEXT,
  ADD COLUMN IF NOT EXISTS last_name       TEXT,
  ADD COLUMN IF NOT EXISTS government_id   TEXT,
  ADD COLUMN IF NOT EXISTS id_type         TEXT;


COMMIT;


-- ============================================================
-- Post-flight checks (optional — run individually after COMMIT):
--   SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public';
--   SELECT tgname FROM pg_trigger WHERE tgname='trg_patient_same_clinic';
--   SELECT public.refresh_disease_question_map();   -- expect a positive row count
-- ============================================================
