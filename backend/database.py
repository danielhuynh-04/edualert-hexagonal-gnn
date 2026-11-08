# -*- coding: utf-8 -*-
"""
EduAlert — Database Module (SQLite runtime + 18-table 3NF Relational Schema)
Author: Huynh Le Thanh Hai — HCMC Open University
"""

import os
import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "db" / "edualert.db"


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    conn = get_connection()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('ADMIN', 'TRAINING_DEPT', 'FACULTY_BOARD', 'ADVISOR')),
            email TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS advisors (
            advisor_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            full_name TEXT NOT NULL,
            faculty TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS programs (
            program_id TEXT PRIMARY KEY,
            program_name TEXT NOT NULL,
            faculty TEXT NOT NULL,
            total_credits INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS classes (
            class_id TEXT PRIMARY KEY,
            class_name TEXT NOT NULL,
            cohort_year INTEGER NOT NULL,
            program_id TEXT NOT NULL REFERENCES programs(program_id),
            advisor_id INTEGER NOT NULL REFERENCES advisors(advisor_id)
        );

        CREATE TABLE IF NOT EXISTS students (
            student_id TEXT PRIMARY KEY,
            anon_hash TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            class_id TEXT NOT NULL REFERENCES classes(class_id),
            program_id TEXT NOT NULL REFERENCES programs(program_id),
            enrollment_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'ACTIVE'
        );

        CREATE TABLE IF NOT EXISTS admission_scores (
            student_id TEXT PRIMARY KEY REFERENCES students(student_id) ON DELETE CASCADE,
            thpt_score REAL,
            dgnl_score REAL,
            hocba_score REAL,
            normalized_score_30 REAL NOT NULL,
            admission_method TEXT NOT NULL CHECK (admission_method IN ('THPT', 'HOCBA', 'DGNL'))
        );

        CREATE TABLE IF NOT EXISTS courses (
            course_id TEXT PRIMARY KEY,
            course_name TEXT NOT NULL,
            credits INTEGER NOT NULL,
            historical_fail_rate REAL NOT NULL,
            difficulty_tier TEXT NOT NULL CHECK (difficulty_tier IN ('EASY', 'MID', 'HARD'))
        );

        CREATE TABLE IF NOT EXISTS semesters (
            semester_id TEXT PRIMARY KEY,
            academic_year TEXT NOT NULL,
            semester_num INTEGER NOT NULL,
            chronological_idx INTEGER UNIQUE NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS enrollments (
            enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
            course_id TEXT NOT NULL REFERENCES courses(course_id),
            semester_id TEXT NOT NULL REFERENCES semesters(semester_id),
            grade_4 REAL NOT NULL,
            passed INTEGER NOT NULL,
            UNIQUE (student_id, course_id, semester_id)
        );

        CREATE TABLE IF NOT EXISTS semester_results (
            student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
            semester_id TEXT NOT NULL REFERENCES semesters(semester_id),
            study_year INTEGER NOT NULL,
            semester_seq INTEGER NOT NULL,
            registered_credits INTEGER NOT NULL,
            passed_credits INTEGER NOT NULL,
            failed_credits INTEGER NOT NULL,
            accumulated_debt_credits INTEGER NOT NULL DEFAULT 0,
            gpa_semester REAL NOT NULL,
            gpa_cumulative REAL NOT NULL,
            planned_credits_next INTEGER NOT NULL DEFAULT 16,
            planned_easy_courses INTEGER NOT NULL DEFAULT 2,
            planned_mid_courses INTEGER NOT NULL DEFAULT 2,
            planned_hard_courses INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (student_id, semester_id)
        );

        CREATE TABLE IF NOT EXISTS conduct_scores (
            student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
            semester_id TEXT NOT NULL REFERENCES semesters(semester_id),
            conduct_score INTEGER NOT NULL,
            conduct_rank TEXT NOT NULL,
            PRIMARY KEY (student_id, semester_id)
        );

        CREATE TABLE IF NOT EXISTS academic_warnings (
            warning_id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
            semester_id TEXT NOT NULL REFERENCES semesters(semester_id),
            warning_level INTEGER NOT NULL,
            consecutive_count INTEGER NOT NULL DEFAULT 1,
            reason TEXT NOT NULL,
            issued_date TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rule_config (
            rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_code TEXT UNIQUE NOT NULL,
            rule_name TEXT NOT NULL,
            param_json TEXT NOT NULL,
            effective_from TEXT NOT NULL,
            legal_ref TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS graph_edges (
            edge_id INTEGER PRIMARY KEY AUTOINCREMENT,
            src_student TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
            dst_student TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
            semester_id TEXT NOT NULL REFERENCES semesters(semester_id),
            edge_type TEXT NOT NULL,
            weight REAL NOT NULL DEFAULT 1.0,
            sheaf_attention REAL NOT NULL DEFAULT 0.0
        );

        CREATE TABLE IF NOT EXISTS model_runs (
            run_id TEXT PRIMARY KEY,
            model_name TEXT NOT NULL,
            model_family TEXT NOT NULL,
            version TEXT NOT NULL,
            trained_at TEXT NOT NULL,
            macro_f1 REAL NOT NULL,
            recall_high_risk REAL NOT NULL,
            pr_auc REAL NOT NULL,
            roc_auc REAL NOT NULL,
            gpa_mae REAL NOT NULL,
            gpa_r2 REAL NOT NULL,
            ece REAL NOT NULL,
            perm_test_r2 REAL NOT NULL DEFAULT 0.025,
            is_active INTEGER NOT NULL DEFAULT 0,
            hyperparams_json TEXT
        );

        CREATE TABLE IF NOT EXISTS risk_assessments (
            assessment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
            semester_id TEXT NOT NULL REFERENCES semesters(semester_id),
            run_id TEXT NOT NULL REFERENCES model_runs(run_id),
            risk_score REAL NOT NULL,
            risk_probability REAL NOT NULL,
            risk_level TEXT NOT NULL CHECK (risk_level IN ('NORMAL', 'ATTENTION', 'HIGH_RISK')),
            rule_triggered INTEGER NOT NULL DEFAULT 0,
            predicted_next_gpa REAL NOT NULL,
            predicted_gpa_std REAL NOT NULL DEFAULT 0.16,
            explanation_text TEXT NOT NULL,
            recommendations_json TEXT NOT NULL,
            assessed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (student_id, semester_id, run_id)
        );

        CREATE TABLE IF NOT EXISTS risk_factors (
            factor_id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id INTEGER NOT NULL REFERENCES risk_assessments(assessment_id) ON DELETE CASCADE,
            factor_code TEXT NOT NULL,
            factor_label TEXT NOT NULL,
            contribution REAL NOT NULL,
            direction TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rule_results (
            result_id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id INTEGER NOT NULL REFERENCES risk_assessments(assessment_id) ON DELETE CASCADE,
            rule_code TEXT NOT NULL,
            triggered INTEGER NOT NULL,
            actual_value TEXT NOT NULL,
            threshold_value TEXT NOT NULL,
            explanation TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS interventions (
            intervention_id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
            advisor_id INTEGER NOT NULL REFERENCES advisors(advisor_id),
            meeting_date TEXT NOT NULL,
            notes TEXT NOT NULL,
            outcome_status TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS notifications (
            notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id INTEGER NOT NULL REFERENCES risk_assessments(assessment_id) ON DELETE CASCADE,
            channel TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'SENT',
            sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            target_entity TEXT,
            details TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_sr_student_sem ON semester_results(student_id, semester_id);
        CREATE INDEX IF NOT EXISTS idx_ra_sem_level ON risk_assessments(semester_id, risk_level);
        CREATE INDEX IF NOT EXISTS idx_edges_src_sem ON graph_edges(src_student, semester_id);
        """
    )
    conn.commit()
    conn.close()


def log_audit(conn: sqlite3.Connection, user_id: int, action: str, target: str, details: dict) -> None:
    conn.execute(
        "INSERT INTO audit_log (user_id, action, target_entity, details) VALUES (?, ?, ?, ?)",
        (user_id, action, target, json.dumps(details, ensure_ascii=False)),
    )

