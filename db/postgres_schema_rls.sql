-- =============================================================================
-- EduAlert — PostgreSQL 16 Production Schema (3NF, 18 Tables, RLS, Triggers)
-- Author: Huynh Le Thanh Hai — HCMC Open University (Database Specialization)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. users
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'TRAINING_DEPT', 'FACULTY_BOARD', 'ADVISOR')),
    email VARCHAR(120) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. advisors
CREATE TABLE advisors (
    advisor_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    full_name VARCHAR(120) NOT NULL,
    faculty VARCHAR(120) NOT NULL
);

-- 3. programs
CREATE TABLE programs (
    program_id VARCHAR(20) PRIMARY KEY,
    program_name VARCHAR(120) NOT NULL,
    faculty VARCHAR(120) NOT NULL,
    total_credits INT NOT NULL CHECK (total_credits > 0)
);

-- 4. classes
CREATE TABLE classes (
    class_id VARCHAR(20) PRIMARY KEY,
    class_name VARCHAR(80) NOT NULL,
    cohort_year INT NOT NULL,
    program_id VARCHAR(20) NOT NULL REFERENCES programs(program_id),
    advisor_id INT NOT NULL REFERENCES advisors(advisor_id)
);

-- 5. students
CREATE TABLE students (
    student_id VARCHAR(20) PRIMARY KEY,
    anon_hash VARCHAR(64) UNIQUE NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    class_id VARCHAR(20) NOT NULL REFERENCES classes(class_id),
    program_id VARCHAR(20) NOT NULL REFERENCES programs(program_id),
    enrollment_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'WARNING', 'SUSPENDED', 'GRADUATED'))
);

-- 6. admission_scores
CREATE TABLE admission_scores (
    student_id VARCHAR(20) PRIMARY KEY REFERENCES students(student_id) ON DELETE CASCADE,
    thpt_score NUMERIC(4,2),
    dgnl_score NUMERIC(6,2),
    hocba_score NUMERIC(4,2),
    normalized_score_30 NUMERIC(4,2) NOT NULL CHECK (normalized_score_30 BETWEEN 0 AND 30),
    admission_method VARCHAR(20) NOT NULL CHECK (admission_method IN ('THPT', 'HOCBA', 'DGNL'))
);

-- 7. courses
CREATE TABLE courses (
    course_id VARCHAR(20) PRIMARY KEY,
    course_name VARCHAR(150) NOT NULL,
    credits INT NOT NULL CHECK (credits BETWEEN 1 AND 10),
    historical_fail_rate NUMERIC(4,3) NOT NULL DEFAULT 0.100 CHECK (historical_fail_rate BETWEEN 0 AND 1),
    difficulty_tier VARCHAR(10) NOT NULL CHECK (difficulty_tier IN ('EASY', 'MID', 'HARD'))
);

-- 8. semesters
CREATE TABLE semesters (
    semester_id VARCHAR(20) PRIMARY KEY,
    academic_year VARCHAR(20) NOT NULL,
    semester_num INT NOT NULL CHECK (semester_num IN (1, 2, 3)),
    chronological_idx INT UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL
);

-- 9. enrollments
CREATE TABLE enrollments (
    enrollment_id BIGSERIAL PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    course_id VARCHAR(20) NOT NULL REFERENCES courses(course_id),
    semester_id VARCHAR(20) NOT NULL REFERENCES semesters(semester_id),
    grade_4 NUMERIC(3,2) CHECK (grade_4 BETWEEN 0.0 AND 4.0),
    passed BOOLEAN NOT NULL,
    UNIQUE (student_id, course_id, semester_id)
);

-- 10. semester_results
CREATE TABLE semester_results (
    student_id VARCHAR(20) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    semester_id VARCHAR(20) NOT NULL REFERENCES semesters(semester_id),
    study_year INT NOT NULL CHECK (study_year BETWEEN 1 AND 6),
    semester_seq INT NOT NULL CHECK (semester_seq >= 1),
    registered_credits INT NOT NULL CHECK (registered_credits >= 0),
    passed_credits INT NOT NULL CHECK (passed_credits >= 0),
    failed_credits INT NOT NULL CHECK (failed_credits >= 0),
    accumulated_debt_credits INT NOT NULL DEFAULT 0 CHECK (accumulated_debt_credits >= 0),
    gpa_semester NUMERIC(3,2) NOT NULL CHECK (gpa_semester BETWEEN 0.0 AND 4.0),
    gpa_cumulative NUMERIC(3,2) NOT NULL CHECK (gpa_cumulative BETWEEN 0.0 AND 4.0),
    planned_credits_next INT NOT NULL DEFAULT 16,
    planned_easy_courses INT NOT NULL DEFAULT 2,
    planned_mid_courses INT NOT NULL DEFAULT 2,
    planned_hard_courses INT NOT NULL DEFAULT 1,
    PRIMARY KEY (student_id, semester_id)
);

-- 11. conduct_scores
CREATE TABLE conduct_scores (
    student_id VARCHAR(20) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    semester_id VARCHAR(20) NOT NULL REFERENCES semesters(semester_id),
    conduct_score INT NOT NULL CHECK (conduct_score BETWEEN 0 AND 100),
    conduct_rank VARCHAR(20) NOT NULL,
    PRIMARY KEY (student_id, semester_id)
);

-- 12. academic_warnings
CREATE TABLE academic_warnings (
    warning_id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    semester_id VARCHAR(20) NOT NULL REFERENCES semesters(semester_id),
    warning_level INT NOT NULL CHECK (warning_level BETWEEN 1 AND 3),
    consecutive_count INT NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 13. rule_config (Temporal Versioning with Exclusion Constraint)
CREATE TABLE rule_config (
    rule_id SERIAL PRIMARY KEY,
    rule_code VARCHAR(20) NOT NULL,
    rule_name VARCHAR(150) NOT NULL,
    param_json JSONB NOT NULL,
    effective_period DATERANGE NOT NULL DEFAULT daterange(CURRENT_DATE, NULL, '[)'),
    legal_ref VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    EXCLUDE USING gist (rule_code WITH =, effective_period WITH &&)
);

-- 14. graph_edges
CREATE TABLE graph_edges (
    edge_id BIGSERIAL PRIMARY KEY,
    src_student VARCHAR(20) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    dst_student VARCHAR(20) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    semester_id VARCHAR(20) NOT NULL REFERENCES semesters(semester_id),
    edge_type VARCHAR(30) NOT NULL CHECK (edge_type IN ('SAME_CLASS', 'SHARED_COURSE', 'KNN_PROFILE')),
    weight NUMERIC(5,4) NOT NULL DEFAULT 1.0,
    sheaf_attention NUMERIC(5,4) NOT NULL DEFAULT 0.0
);

-- 15. model_runs
CREATE TABLE model_runs (
    run_id VARCHAR(40) PRIMARY KEY,
    model_name VARCHAR(80) NOT NULL,
    model_family VARCHAR(40) NOT NULL,
    version VARCHAR(20) NOT NULL,
    trained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    macro_f1 NUMERIC(5,4) NOT NULL,
    recall_high_risk NUMERIC(5,4) NOT NULL,
    pr_auc NUMERIC(5,4) NOT NULL,
    roc_auc NUMERIC(5,4) NOT NULL,
    gpa_mae NUMERIC(5,4) NOT NULL,
    gpa_r2 NUMERIC(5,4) NOT NULL,
    ece NUMERIC(5,4) NOT NULL,
    perm_test_p_value NUMERIC(5,4) NOT NULL DEFAULT 0.001,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    hyperparams_json JSONB
);

-- 16. risk_assessments
CREATE TABLE risk_assessments (
    assessment_id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    semester_id VARCHAR(20) NOT NULL REFERENCES semesters(semester_id),
    run_id VARCHAR(40) NOT NULL REFERENCES model_runs(run_id),
    risk_score NUMERIC(5,2) NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    risk_probability NUMERIC(5,4) NOT NULL CHECK (risk_probability BETWEEN 0 AND 1),
    risk_level VARCHAR(15) NOT NULL CHECK (risk_level IN ('NORMAL', 'ATTENTION', 'HIGH_RISK')),
    rule_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    predicted_next_gpa NUMERIC(3,2) NOT NULL,
    predicted_gpa_std NUMERIC(3,2) NOT NULL DEFAULT 0.18,
    explanation_text TEXT NOT NULL,
    recommendations_json JSONB NOT NULL,
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, semester_id, run_id)
);

-- 17. risk_factors
CREATE TABLE risk_factors (
    factor_id SERIAL PRIMARY KEY,
    assessment_id INT NOT NULL REFERENCES risk_assessments(assessment_id) ON DELETE CASCADE,
    factor_code VARCHAR(40) NOT NULL,
    factor_label VARCHAR(150) NOT NULL,
    contribution NUMERIC(6,3) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('INCREASE', 'DECREASE'))
);

-- 18. rule_results
CREATE TABLE rule_results (
    result_id SERIAL PRIMARY KEY,
    assessment_id INT NOT NULL REFERENCES risk_assessments(assessment_id) ON DELETE CASCADE,
    rule_code VARCHAR(20) NOT NULL,
    triggered BOOLEAN NOT NULL,
    actual_value VARCHAR(80) NOT NULL,
    threshold_value VARCHAR(80) NOT NULL,
    explanation TEXT NOT NULL
);

-- 19. interventions
CREATE TABLE interventions (
    intervention_id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    advisor_id INT NOT NULL REFERENCES advisors(advisor_id),
    meeting_date DATE NOT NULL,
    notes TEXT NOT NULL,
    outcome_status VARCHAR(30) NOT NULL CHECK (outcome_status IN ('SCHEDULED', 'COMPLETED', 'FOLLOW_UP_NEEDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. notifications & audit_log
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    assessment_id INT NOT NULL REFERENCES risk_assessments(assessment_id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'SLACK')),
    status VARCHAR(20) NOT NULL DEFAULT 'SENT',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_log (
    log_id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    action VARCHAR(80) NOT NULL,
    target_entity VARCHAR(80),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Performance Indexes & Materialized View
-- =============================================================================
CREATE INDEX idx_sem_results_student_sem ON semester_results(student_id, semester_id);
CREATE INDEX idx_enrollments_student_sem ON enrollments(student_id, semester_id);
CREATE INDEX idx_assessments_high_risk ON risk_assessments(semester_id, risk_score DESC)
    WHERE risk_level = 'HIGH_RISK';
CREATE INDEX idx_graph_edges_src_sem ON graph_edges(src_student, semester_id);

CREATE MATERIALIZED VIEW mv_cohort_risk_summary AS
SELECT
    c.class_id,
    c.class_name,
    c.cohort_year,
    p.program_name,
    ra.semester_id,
    COUNT(*) AS total_students,
    COUNT(*) FILTER (WHERE ra.risk_level = 'HIGH_RISK') AS high_risk_count,
    COUNT(*) FILTER (WHERE ra.risk_level = 'ATTENTION') AS attention_count,
    COUNT(*) FILTER (WHERE ra.risk_level = 'NORMAL') AS normal_count,
    ROUND(AVG(sr.gpa_cumulative), 2) AS avg_cumulative_gpa
FROM risk_assessments ra
JOIN students s ON s.student_id = ra.student_id
JOIN classes c ON c.class_id = s.class_id
JOIN programs p ON p.program_id = s.program_id
JOIN semester_results sr ON sr.student_id = ra.student_id AND sr.semester_id = ra.semester_id
GROUP BY c.class_id, c.class_name, c.cohort_year, p.program_name, ra.semester_id;

-- =============================================================================
-- Row-Level Security (RLS): Advisors only see their assigned classes
-- =============================================================================
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY advisor_student_isolation ON students
    FOR SELECT
    USING (
        current_setting('app.current_role', TRUE) IN ('ADMIN', 'TRAINING_DEPT', 'FACULTY_BOARD')
        OR class_id IN (
            SELECT c.class_id FROM classes c
            JOIN advisors a ON a.advisor_id = c.advisor_id
            WHERE a.user_id = NULLIF(current_setting('app.current_user_id', TRUE), '')::INT
        )
    );

