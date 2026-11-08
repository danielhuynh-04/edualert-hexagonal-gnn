# -*- coding: utf-8 -*-
"""
EduAlert — Synthetic Data Generator with Causal Peer Effects & Heterophily
Generates realistic Vietnamese university academic records (scale 4.0) across multiple semesters,
classes, programs, courses, enrollments, conduct scores, and relational student graphs.
Author: Huynh Le Thanh Hai — HCMC Open University
"""

import hashlib
import random
import sqlite3
import numpy as np
from typing import List, Dict, Any

from backend.database import get_connection, init_db
from backend.rule_engine import seed_default_rules

LAST_NAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương"]
MIDDLE_NAMES = ["Văn", "Thị", "Minh", "Hoàng", "Thanh", "Quốc", "Gia", "Ngọc", "Đức", "Anh", "Phương", "Tuấn"]
FIRST_NAMES = ["Hải", "An", "Bình", "Châu", "Dũng", "Giang", "Hà", "Khánh", "Linh", "My", "Nam", "Oanh", "Phúc", "Quân", "Sơn", "Thảo", "Uyên", "Vinh", "Yến", "Khoa", "Tâm", "Đạt", "Trang", "Huy"]

PROGRAMS = [
    ("CS_DB", "Khoa học Máy tính (Chuyên ngành CSDL)", "Khoa Công nghệ Thông tin", 130),
    ("CS_AI", "Khoa học Máy tính (Trí tuệ Nhân tạo)", "Khoa Công nghệ Thông tin", 130),
    ("IS_ERP", "Hệ thống Thông tin Quản lý", "Khoa Công nghệ Thông tin", 125),
]

COURSES = [
    ("IT101", "Nhập môn Lập trình", 4, 0.08, "EASY"),
    ("MA101", "Giải tích 1", 3, 0.22, "HARD"),
    ("MA102", "Đại số Tuyến tính", 3, 0.16, "MID"),
    ("IT102", "Kỹ thuật Lập trình", 4, 0.18, "MID"),
    ("IT201", "Cấu trúc Dữ liệu & Giải thuật", 4, 0.26, "HARD"),
    ("DB201", "Cơ sở Dữ liệu", 4, 0.14, "MID"),
    ("IT202", "Kiến trúc Máy tính & HĐH", 3, 0.12, "MID"),
    ("MA201", "Xác suất Thống kê", 3, 0.21, "HARD"),
    ("DB301", "Hệ Quản trị Cơ sở Dữ liệu", 4, 0.24, "HARD"),
    ("AI301", "Học máy (Machine Learning)", 4, 0.25, "HARD"),
    ("SE301", "Công nghệ Phần mềm", 3, 0.09, "EASY"),
    ("NW201", "Mạng Máy tính", 3, 0.11, "MID"),
    ("DB302", "Phân tích & Thiết kế CSDL", 3, 0.13, "MID"),
    ("AI302", "Mạng Nơ-ron Đồ thị (GNN)", 3, 0.27, "HARD"),
    ("GE101", "Kỹ năng Giao tiếp Liên văn hóa", 2, 0.04, "EASY"),
]

SEMESTERS = [
    ("2024_HK1", "2024-2025", 1, 1, "2024-09-01", "2025-01-15"),
    ("2024_HK2", "2024-2025", 2, 2, "2025-02-10", "2025-06-20"),
    ("2025_HK1", "2025-2026", 1, 3, "2025-09-01", "2026-01-15"),
    ("2025_HK2", "2025-2026", 2, 4, "2026-02-10", "2026-06-20"),
]


def _hash_pw(pw: str) -> str:
    return hashlib.sha256(f"edualert_salt::{pw}".encode("utf-8")).hexdigest()


def _anon_id(student_id: str) -> str:
    return "ANON_" + hashlib.sha256(student_id.encode("utf-8")).hexdigest()[:12].upper()


def seed_all(num_students: int = 180, seed: int = 42) -> Dict[str, Any]:
    rng = np.random.default_rng(seed)
    random.seed(seed)

    init_db()
    conn = get_connection()
    cur = conn.cursor()

    # Clear existing data for clean reproducible run
    for tbl in [
        "notifications", "interventions", "rule_results", "risk_factors",
        "risk_assessments", "model_runs", "graph_edges", "academic_warnings",
        "conduct_scores", "semester_results", "enrollments", "admission_scores",
        "students", "classes", "programs", "courses", "semesters", "advisors", "users", "audit_log"
    ]:
        cur.execute(f"DELETE FROM {tbl};")

    seed_default_rules(conn)

    # 1. Seed Users & Advisors
    users_data = [
        (1, "admin", _hash_pw("admin123"), "ADMIN", "admin@ou.edu.vn"),
        (2, "daotao", _hash_pw("daotao123"), "TRAINING_DEPT", "daotao@ou.edu.vn"),
        (3, "bcnkhoa", _hash_pw("khoa123"), "FACULTY_BOARD", "bcn.cntt@ou.edu.vn"),
        (4, "cvht_lan", _hash_pw("cvht123"), "ADVISOR", "lan.nt@ou.edu.vn"),
        (5, "cvht_minh", _hash_pw("cvht123"), "ADVISOR", "minh.tv@ou.edu.vn"),
        (6, "cvht_hung", _hash_pw("cvht123"), "ADVISOR", "hung.lh@ou.edu.vn"),
    ]
    cur.executemany(
        "INSERT INTO users (user_id, username, password_hash, role, email) VALUES (?, ?, ?, ?, ?)",
        users_data,
    )

    advisors_data = [
        (1, 4, "TS. Nguyễn Thị Lan", "Khoa Công nghệ Thông tin"),
        (2, 5, "ThS. Trần Văn Minh", "Khoa Công nghệ Thông tin"),
        (3, 6, "TS. Lê Hoàng Hùng", "Khoa Công nghệ Thông tin"),
    ]
    cur.executemany(
        "INSERT INTO advisors (advisor_id, user_id, full_name, faculty) VALUES (?, ?, ?, ?)",
        advisors_data,
    )

    # 2. Seed Programs, Courses, Semesters, Classes
    cur.executemany(
        "INSERT INTO programs (program_id, program_name, faculty, total_credits) VALUES (?, ?, ?, ?)",
        PROGRAMS,
    )
    cur.executemany(
        "INSERT INTO courses (course_id, course_name, credits, historical_fail_rate, difficulty_tier) VALUES (?, ?, ?, ?, ?)",
        COURSES,
    )
    cur.executemany(
        "INSERT INTO semesters (semester_id, academic_year, semester_num, chronological_idx, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
        SEMESTERS,
    )

    classes_data = [
        ("DH23CS01", "KHMT Cơ sở dữ liệu K23 - Lớp 1", 2023, "CS_DB", 1),
        ("DH23CS02", "KHMT Cơ sở dữ liệu K23 - Lớp 2", 2023, "CS_DB", 1),
        ("DH24AI01", "KHMT Trí tuệ nhân tạo K24 - Lớp 1", 2024, "CS_AI", 2),
        ("DH24AI02", "KHMT Trí tuệ nhân tạo K24 - Lớp 2", 2024, "CS_AI", 2),
        ("DH23IS01", "Hệ thống thông tin K23 - Lớp 1", 2023, "IS_ERP", 3),
        ("DH24IS02", "Hệ thống thông tin K24 - Lớp 2", 2024, "IS_ERP", 3),
    ]
    cur.executemany(
        "INSERT INTO classes (class_id, class_name, cohort_year, program_id, advisor_id) VALUES (?, ?, ?, ?, ?)",
        classes_data,
    )

    # 3. Generate Students with Latent Academic Traits & Study Groups (for Graph Signal)
    students_rows = []
    admission_rows = []
    latent_ability: Dict[str, float] = {}
    latent_resilience: Dict[str, float] = {}
    student_group: Dict[str, int] = {}
    student_class_map: Dict[str, str] = {}

    methods = ["THPT", "HOCBA", "DGNL"]
    for idx in range(1, num_students + 1):
        sid = f"SV{idx:03d}"
        cls_info = classes_data[(idx - 1) % len(classes_data)]
        class_id, _, cohort_year, prog_id, _ = cls_info
        full_name = f"{random.choice(LAST_NAMES)} {random.choice(MIDDLE_NAMES)} {random.choice(FIRST_NAMES)}"
        enroll_date = f"{cohort_year}-09-05"

        # Assign study group (36 study groups of ~5 students, mixing abilities -> heterophily!)
        grp_id = (idx - 1) // 5
        student_group[sid] = grp_id
        student_class_map[sid] = class_id

        # Latent ability ~ N(2.65, 0.55), with a subset experiencing mid-program downward drift
        ability = float(np.clip(rng.normal(2.65, 0.58), 1.15, 3.85))
        drift = float(rng.choice([0.0, -0.12, -0.28, 0.08], p=[0.55, 0.22, 0.15, 0.08]))
        # Showcase archetypes for SV001..SV005 so demo is crystal clear
        if sid == "SV001":
            full_name = "Nguyễn Minh Hải"
            ability, drift = 3.35, 0.05  # Normal / Strong student
        elif sid == "SV002":
            full_name = "Trần Hoàng Nam"
            ability, drift = 2.45, -0.34  # Early Warning (Yellow/Red by Model BEFORE hitting rule floor!)
        elif sid == "SV003":
            full_name = "Lê Thị Khánh Linh"
            ability, drift = 1.55, -0.35  # Regulatory Violation (Red by Rule Engine TT08)
        elif sid == "SV004":
            full_name = "Phạm Quốc Tuấn"
            ability, drift = 2.38, -0.26  # Heterophilic group member pulled down by difficult courses
        elif sid == "SV005":
            full_name = "Huỳnh Ngọc Thảo"
            ability, drift = 1.40, -0.40  # Severe Debt & Consecutive Warnings

        latent_ability[sid] = ability
        latent_resilience[sid] = drift

        method = methods[idx % 3]
        norm_30 = float(np.clip(14.5 + ability * 3.6 + rng.normal(0, 1.1), 13.5, 29.0))
        if sid == "SV002":
            norm_30 = 18.4
        elif sid == "SV003":
            norm_30 = 15.8

        thpt = round(norm_30, 2) if method == "THPT" else None
        hocba = round(min(30.0, norm_30 + 1.2), 2) if method == "HOCBA" else None
        dgnl = round(norm_30 * 32.0, 1) if method == "DGNL" else None

        students_rows.append((sid, _anon_id(sid), full_name, class_id, prog_id, enroll_date, "ACTIVE"))
        admission_rows.append((sid, thpt, dgnl, hocba, round(norm_30, 2), method))

    cur.executemany(
        "INSERT INTO students (student_id, anon_hash, full_name, class_id, program_id, enrollment_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        students_rows,
    )
    cur.executemany(
        "INSERT INTO admission_scores (student_id, thpt_score, dgnl_score, hocba_score, normalized_score_30, admission_method) VALUES (?, ?, ?, ?, ?, ?)",
        admission_rows,
    )

    # 4. Compute Group Peer Signals (including Heterophilic Contrast)
    group_members: Dict[int, List[str]] = {}
    for sid, g in student_group.items():
        group_members.setdefault(g, []).append(sid)

    # 5. Simulate 4 Semesters of Course Enrollments, Semester Results, Conduct Scores & Warnings
    enrollments_rows = []
    sem_results_rows = []
    conduct_rows = []
    warnings_rows = []

    sem_courses_map = {
        1: COURSES[0:4],
        2: COURSES[4:8],
        3: COURSES[8:12],
        4: COURSES[11:15],
    }

    for sid, _, _, class_id, _, _, _ in students_rows:
        cum_points = 0.0
        cum_credits = 0
        accum_debt = 0
        consec_warn = 0

        peers = [p for p in group_members[student_group[sid]] if p != sid]
        peer_mean_ability = float(np.mean([latent_ability[p] for p in peers])) if peers else latent_ability[sid]
        peer_gap = peer_mean_ability - latent_ability[sid]
        # Heterophilic effect: if gap is moderate, positive spillover; if gap is extreme & student has negative drift, contrast stress
        if abs(peer_gap) < 0.75:
            peer_effect = 0.18 * peer_gap
        else:
            peer_effect = -0.15 * abs(peer_gap) if latent_resilience[sid] < 0 else 0.10 * peer_gap

        for sem_id, _, _, sem_idx, _, end_date in SEMESTERS:
            study_year = (sem_idx + 1) // 2
            sem_courses = sem_courses_map[sem_idx]
            reg_tc = sum(c[2] for c in sem_courses)
            pass_tc = 0
            fail_tc = 0
            sem_weighted = 0.0

            base_perf = (
                latent_ability[sid]
                + latent_resilience[sid] * (sem_idx - 1)
                + peer_effect * (0.4 * sem_idx)
            )

            for c_id, _, c_tc, c_fail_rate, _ in sem_courses:
                course_penalty = (c_fail_rate - 0.12) * 2.2
                grade = float(np.clip(base_perf - course_penalty + rng.normal(0, 0.25), 0.2, 4.0))
                passed = 1 if grade >= 1.0 else 0
                if passed:
                    pass_tc += c_tc
                else:
                    fail_tc += c_tc
                sem_weighted += grade * c_tc
                enrollments_rows.append((sid, c_id, sem_id, round(grade, 2), passed))

            gpa_sem = round(float(np.clip(sem_weighted / max(1, reg_tc), 0.2, 4.0)), 2)

            # Fine-tune archetype trajectories for SV002 and SV003 in latest semesters
            if sid == "SV002":
                # Above regulatory floor (Year 2 threshold is 1.40, HK floor is 1.0),
                # but clear downward GPA trajectory: 2.95 -> 2.55 -> 2.12 -> 1.68
                preset_hk = {1: (15, 0, 2.95, 2.95, 0), 2: (14, 0, 2.55, 2.75, 3), 3: (15, 4, 2.05, 2.48, 7), 4: (13, 3, 1.62, 2.22, 10)}
                reg_tc, fail_tc, gpa_sem, gpa_cum, accum_debt = preset_hk[sem_idx]
                pass_tc = reg_tc - fail_tc
            elif sid == "SV003":
                # Hits Circular 08/2021 rule R04 & R01 in Semester 4
                preset_hk = {1: (15, 3, 1.65, 1.65, 3), 2: (14, 4, 1.35, 1.50, 7), 3: (15, 7, 1.12, 1.36, 14), 4: (13, 7, 0.88, 1.24, 21)}
                reg_tc, fail_tc, gpa_sem, gpa_cum, accum_debt = preset_hk[sem_idx]
                pass_tc = reg_tc - fail_tc
            elif sid == "SV005":
                preset_hk = {1: (15, 7, 1.15, 1.15, 7), 2: (14, 8, 0.92, 1.04, 15), 3: (15, 8, 0.85, 0.98, 23), 4: (13, 7, 0.78, 0.93, 28)}
                reg_tc, fail_tc, gpa_sem, gpa_cum, accum_debt = preset_hk[sem_idx]
                pass_tc = reg_tc - fail_tc
            else:
                cum_points += gpa_sem * reg_tc
                cum_credits += reg_tc
                gpa_cum = round(float(np.clip(cum_points / max(1, cum_credits), 0.3, 4.0)), 2)
                accum_debt = max(0, accum_debt + fail_tc - (3 if gpa_sem > 2.6 and accum_debt >= 3 else 0))

            # Planned next semester workload
            plan_hard = int(np.clip(round(1 + (1 if accum_debt > 6 else 0) + (1 if latent_resilience[sid] < -0.2 else 0)), 0, 4))
            plan_mid = 2
            plan_easy = max(1, 5 - plan_hard - plan_mid)
            plan_tc = (plan_easy + plan_mid + plan_hard) * 3 + (3 if accum_debt > 8 else 0)

            sem_results_rows.append(
                (
                    sid, sem_id, study_year, sem_idx, reg_tc, pass_tc, fail_tc,
                    accum_debt, gpa_sem, gpa_cum, plan_tc, plan_easy, plan_mid, plan_hard
                )
            )

            conduct = int(np.clip(round(62 + gpa_sem * 9.5 + rng.normal(0, 4.5)), 42, 98))
            c_rank = "Xuất sắc" if conduct >= 90 else "Tốt" if conduct >= 80 else "Khá" if conduct >= 65 else "Trung bình"
            conduct_rows.append((sid, sem_id, conduct, c_rank))

            # Check if official warning triggered this semester
            th_year = 1.2 if study_year <= 1 else 1.4
            hk_fl = 0.8 if sem_idx == 1 else 1.0
            if (fail_tc > 0.5 * reg_tc) or (accum_debt > 24) or (gpa_sem < hk_fl) or (gpa_cum < th_year):
                consec_warn += 1
                warnings_rows.append(
                    (sid, sem_id, min(3, consec_warn), consec_warn, "Vi phạm ngưỡng học vụ Thông tư 08/2021", end_date)
                )
            else:
                consec_warn = 0

    cur.executemany(
        "INSERT INTO enrollments (student_id, course_id, semester_id, grade_4, passed) VALUES (?, ?, ?, ?, ?)",
        enrollments_rows,
    )
    cur.executemany(
        """
        INSERT INTO semester_results (
            student_id, semester_id, study_year, semester_seq,
            registered_credits, passed_credits, failed_credits, accumulated_debt_credits,
            gpa_semester, gpa_cumulative, planned_credits_next,
            planned_easy_courses, planned_mid_courses, planned_hard_courses
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        sem_results_rows,
    )
    cur.executemany(
        "INSERT INTO conduct_scores (student_id, semester_id, conduct_score, conduct_rank) VALUES (?, ?, ?, ?)",
        conduct_rows,
    )
    cur.executemany(
        "INSERT INTO academic_warnings (student_id, semester_id, warning_level, consecutive_count, reason, issued_date) VALUES (?, ?, ?, ?, ?, ?)",
        warnings_rows,
    )

    # 6. Build Student Graph Edges (SAME_CLASS, SHARED_COURSE, KNN_PROFILE) for latest semester 2025_HK2
    edges_rows = []
    latest_sem = "2025_HK2"
    all_sids = [r[0] for r in students_rows]

    # Map latest GPA & debt for profile similarity
    latest_profile = {}
    for row in sem_results_rows:
        if row[1] == latest_sem:
            latest_profile[row[0]] = np.array([row[8], row[9], row[7] / 24.0, row[6] / max(1, row[4])])

    for i, u in enumerate(all_sids):
        # (a) Study group / shared course edges (high interaction weight)
        for v in group_members[student_group[u]]:
            if u != v:
                p_u, p_v = latest_profile[u], latest_profile[v]
                diff = float(np.linalg.norm(p_u - p_v))
                # Sheaf attention weight highlights informative peer links (including heterophilic contrast)
                attn = float(np.clip(0.55 + 0.25 * np.tanh(diff), 0.25, 0.94))
                edges_rows.append((u, v, latest_sem, "SHARED_COURSE", 0.85, round(attn, 4)))

        # (b) Same class neighbors (connect adjacent indices in same class)
        for j in range(max(0, i - 6), min(len(all_sids), i + 7)):
            v = all_sids[j]
            if u != v and student_class_map[u] == student_class_map[v]:
                edges_rows.append((u, v, latest_sem, "SAME_CLASS", 0.50, 0.42))

        # (c) Top-2 k-NN profile similarity across cohort
        dists = []
        for v in all_sids:
            if u != v:
                d = float(np.linalg.norm(latest_profile[u] - latest_profile[v]))
                dists.append((d, v))
        dists.sort(key=lambda x: x[0])
        for d, v in dists[:2]:
            sim = round(float(np.exp(-d)), 4)
            edges_rows.append((u, v, latest_sem, "KNN_PROFILE", sim, round(0.35 * sim, 4)))

    cur.executemany(
        "INSERT INTO graph_edges (src_student, dst_student, semester_id, edge_type, weight, sheaf_attention) VALUES (?, ?, ?, ?, ?, ?)",
        edges_rows,
    )

    # 7. Seed sample interventions
    interventions_rows = [
        ("SV003", 1, "2026-03-10", "Làm việc trực tiếp về việc nợ 14 TC và GPA tích lũy giảm dưới 1.4. Hướng dẫn đăng ký học lại Giải tích 1 và CTDL.", "FOLLOW_UP_NEEDED"),
        ("SV002", 1, "2026-04-02", "Hệ thống cảnh báo sớm xu hướng giảm điểm 3 kỳ liên tiếp (2.95 -> 2.05). Tư vấn giảm bớt 1 học phần khó HK tới.", "SCHEDULED"),
        ("SV005", 2, "2026-03-18", "Phối hợp Phòng Đào tạo nhắc nhở nguy cơ buộc thôi học do cảnh báo 2 kỳ liên tiếp.", "FOLLOW_UP_NEEDED"),
    ]
    cur.executemany(
        "INSERT INTO interventions (student_id, advisor_id, meeting_date, notes, outcome_status) VALUES (?, ?, ?, ?, ?)",
        interventions_rows,
    )

    conn.commit()
    conn.close()
    return {"num_students": num_students, "num_edges": len(edges_rows), "latest_semester": latest_sem}

