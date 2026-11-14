# -*- coding: utf-8 -*-
"""
EduAlert — Full-Stack Web & REST API Server
Implements all endpoints from Draft Section 9.1 + Ad-hoc Simulator + Graph Network + Copilot.
Author: Huynh Le Thanh Hai — HCMC Open University
"""

import io
import csv
import sys
import json
import hashlib
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_file, send_from_directory, Response

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.database import get_connection, init_db, log_audit, DB_PATH
from backend.seed_data import seed_all
from backend.rule_engine import load_active_rules, evaluate_student_rules, get_cumulative_gpa_threshold
from backend.ml_pipeline import (
    run_full_pipeline,
    compute_student_features,
    generate_explanation_and_advice,
    FACTOR_META,
)
from backend.copilot import answer_copilot_query
from backend.ai_assistant import ask_assistant, ai_status, set_gemini_config
from src.domain.entities import SemesterSnapshot
from src.application.use_cases import EvaluateStudentRiskUseCase
from src.adapters.outbound.persistence_and_ml import (
    Circular08RegulationAdapter,
    SheafAttentionInferenceAdapter,
    SqliteAuditAdapter,
)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="/static")


def ensure_initialized() -> None:
    if not DB_PATH.exists():
        seed_all(num_students=180, seed=42)
        run_full_pipeline()
    else:
        conn = get_connection()
        cnt = conn.execute("SELECT COUNT(*) FROM risk_assessments").fetchone()[0]
        conn.close()
        if cnt == 0:
            seed_all(num_students=180, seed=42)
            run_full_pipeline()


@app.route("/")
def index():
    return send_file(str(FRONTEND_DIR / "index.html"))


@app.route("/<path:filename>")
def serve_frontend_static(filename: str):
    file_path = FRONTEND_DIR / filename
    if file_path.exists() and file_path.is_file():
        if filename.endswith(".jsx"):
            return send_from_directory(str(FRONTEND_DIR), filename, mimetype="text/babel; charset=utf-8")
        elif filename.endswith(".js"):
            return send_from_directory(str(FRONTEND_DIR), filename, mimetype="application/javascript; charset=utf-8")
        elif filename.endswith(".css"):
            return send_from_directory(str(FRONTEND_DIR), filename, mimetype="text/css; charset=utf-8")
        elif filename.endswith(".svg"):
            return send_from_directory(str(FRONTEND_DIR), filename, mimetype="image/svg+xml")
        return send_from_directory(str(FRONTEND_DIR), filename)
    if not filename.startswith("api/"):
        return send_file(str(FRONTEND_DIR / "index.html"))
    return jsonify({"error": "Endpoint not found"}), 404


# ---------------------------------------------------------------------------
# M01 · 5-LEVEL AUTHENTICATION (LV1 Sinh viên → LV5 Quản trị)
# ---------------------------------------------------------------------------
LEVEL_MAP = {"STUDENT": 1, "ADVISOR": 2, "FACULTY_BOARD": 3, "TRAINING_DEPT": 4, "ADMIN": 5}
LEVEL_LABELS = {
    1: "LV1 · Sinh viên",
    2: "LV2 · Cố vấn Học tập",
    3: "LV3 · Ban Chủ nhiệm Khoa",
    4: "LV4 · Phòng Đào tạo",
    5: "LV5 · Quản trị Hệ thống",
}
ROLE_LABELS = {
    "ADMIN": "Quản trị Hệ thống (System Admin)",
    "TRAINING_DEPT": "Phòng Quản lý Đào tạo (Registrar)",
    "FACULTY_BOARD": "Ban Chủ nhiệm Khoa CNTT (Faculty Dean)",
    "ADVISOR": "Cố vấn Học tập (Academic Advisor)",
    "STUDENT": "Sinh viên (Student Portal)",
}
LEVEL_DESCRIPTIONS = {
    1: "Xem phiếu cảnh báo M03 & mô phỏng What-If M04 của chính mình, hỏi trợ lý AI. Không xem được dữ liệu bạn khác.",
    2: "Quản lý lớp được phân công (RLS), lập biên bản can thiệp M08, xem đồ thị M06 của lớp.",
    3: "Giám sát toàn khoa, đối sánh mô hình AI và kích hoạt mô hình (M11).",
    4: "Toàn trường, cấu hình ngưỡng quy chế TT08 (M10), đối soát lại, xuất báo cáo M12.",
    5: "Toàn quyền: Gateway, Circuit Breaker, Audit Log, cấu hình hệ thống.",
}


def _permissions(role: str) -> dict:
    return {
        "can_edit_rules": role in ("ADMIN", "TRAINING_DEPT"),
        "can_run_pipeline": role in ("ADMIN", "TRAINING_DEPT"),
        "can_manage_models": role in ("ADMIN", "FACULTY_BOARD"),
        "can_intervene": role in ("ADMIN", "ADVISOR", "TRAINING_DEPT"),
        "rls_enforced": role in ("ADVISOR", "STUDENT"),
    }


def _student_profile(stu) -> dict:
    sid = stu["student_id"]
    return {
        "user_id": sid,
        "username": sid.lower(),
        "role": "STUDENT",
        "level": 1,
        "level_label": LEVEL_LABELS[1],
        "role_label": ROLE_LABELS["STUDENT"],
        "display_name": f"{stu['full_name']} ({sid})",
        "email": f"{sid.lower()}@student.ou.edu.vn",
        "student_id": sid,
        "assigned_classes": [stu["class_id"]],
        "description": LEVEL_DESCRIPTIONS[1],
        **_permissions("STUDENT"),
    }


# 1. POST /api/auth/login (M01 Level-Based Authentication Gate)
@app.route("/api/auth/login", methods=["POST"])
def api_login():
    body = request.get_json(force=True, silent=True) or {}
    raw = (body.get("username") or "").strip()
    if not raw:
        return jsonify({"error": "Vui lòng nhập tên đăng nhập hoặc mã số sinh viên."}), 400

    conn = get_connection()
    stu = conn.execute("SELECT * FROM students WHERE UPPER(student_id) = ?", (raw.upper(),)).fetchone()
    if stu:
        profile = _student_profile(stu)
        profile["token"] = hashlib.sha256(f"session::student::{stu['student_id']}".encode()).hexdigest()[:32]
        log_audit(conn, None, "LOGIN", "students", {"student_id": stu["student_id"], "level": 1})
        conn.commit()
        conn.close()
        return jsonify(profile)

    user = conn.execute("SELECT * FROM users WHERE LOWER(username) = ?", (raw.lower(),)).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": f"Không tìm thấy tài khoản '{raw}'. Thử: admin, daotao, bcnkhoa, cvht_lan, sv002."}), 401

    advisor = conn.execute("SELECT * FROM advisors WHERE user_id = ?", (user["user_id"],)).fetchone()
    classes = []
    if advisor:
        classes = [r["class_id"] for r in conn.execute(
            "SELECT class_id FROM classes WHERE advisor_id = ? ORDER BY class_id", (advisor["advisor_id"],)
        ).fetchall()]
    log_audit(conn, user["user_id"], "LOGIN", "users", {"username": user["username"], "role": user["role"]})
    conn.commit()
    conn.close()

    role = user["role"]
    level = LEVEL_MAP.get(role, 2)
    return jsonify(
        {
            "token": hashlib.sha256(f"session::{user['username']}".encode()).hexdigest()[:32],
            "user_id": user["user_id"],
            "username": user["username"],
            "role": role,
            "role_label": ROLE_LABELS.get(role, role),
            "level": level,
            "level_label": LEVEL_LABELS[level],
            "display_name": advisor["full_name"] if advisor else ROLE_LABELS.get(role, role),
            "email": user["email"],
            "advisor_name": advisor["full_name"] if advisor else "Quản trị / Phòng Đào tạo",
            "advisor_id": advisor["advisor_id"] if advisor else None,
            "assigned_classes": classes,
            "description": LEVEL_DESCRIPTIONS[level],
            **_permissions(role),
        }
    )


# 1b. GET /api/auth/roles (M01 RBAC & RLS Role Matrix — 5 levels)
@app.route("/api/auth/roles", methods=["GET"])
def api_auth_roles():
    conn = get_connection()
    users = conn.execute(
        """
        SELECT u.user_id, u.username, u.role, u.email,
               a.advisor_id, a.full_name as advisor_name,
               GROUP_CONCAT(c.class_id) as assigned_classes
        FROM users u
        LEFT JOIN advisors a ON a.user_id = u.user_id
        LEFT JOIN classes c ON c.advisor_id = a.advisor_id
        GROUP BY u.user_id
        ORDER BY u.user_id
        """
    ).fetchall()
    demo_students = conn.execute(
        "SELECT student_id, full_name, class_id FROM students WHERE student_id IN ('SV002', 'SV003') ORDER BY student_id"
    ).fetchall()
    conn.close()

    role_list = [_student_profile(s) for s in demo_students]
    for u in users:
        classes = [c.strip() for c in u["assigned_classes"].split(",")] if u["assigned_classes"] else []
        role_key = u["role"]
        level = LEVEL_MAP.get(role_key, 2)
        role_list.append(
            {
                "user_id": u["user_id"],
                "username": u["username"],
                "role": role_key,
                "level": level,
                "level_label": LEVEL_LABELS[level],
                "role_label": ROLE_LABELS.get(role_key, role_key),
                "display_name": u["advisor_name"] or ROLE_LABELS.get(role_key, u["username"]),
                "email": u["email"],
                "assigned_classes": classes,
                "description": LEVEL_DESCRIPTIONS[level],
                **_permissions(role_key),
            }
        )
    role_list.sort(key=lambda r: r["level"])
    return jsonify({"roles": role_list})


# 2. GET /api/stats/overview (M02 Dashboard)
@app.route("/api/stats/overview", methods=["GET"])
def api_stats_overview():
    conn = get_connection()
    cur = conn.cursor()
    latest_sem = "2025_HK2"

    level_rows = cur.execute(
        """
        SELECT risk_level, COUNT(*) as cnt
        FROM risk_assessments
        WHERE semester_id = ?
        GROUP BY risk_level
        """,
        (latest_sem,),
    ).fetchall()
    counts = {"NORMAL": 0, "ATTENTION": 0, "HIGH_RISK": 0}
    for r in level_rows:
        counts[r["risk_level"]] = r["cnt"]

    rule_trig_cnt = cur.execute(
        "SELECT COUNT(*) FROM risk_assessments WHERE semester_id = ? AND rule_triggered = 1",
        (latest_sem,),
    ).fetchone()[0]
    early_alert_cnt = cur.execute(
        "SELECT COUNT(*) FROM risk_assessments WHERE semester_id = ? AND rule_triggered = 0 AND risk_level IN ('HIGH_RISK', 'ATTENTION')",
        (latest_sem,),
    ).fetchone()[0]

    # Trend across 4 semesters
    sem_trend = cur.execute(
        """
        SELECT sr.semester_id,
               ROUND(AVG(sr.gpa_semester), 2) AS avg_gpa_sem,
               ROUND(AVG(sr.gpa_cumulative), 2) AS avg_gpa_cum,
               SUM(CASE WHEN sr.gpa_cumulative < 1.4 OR sr.gpa_semester < 1.0 OR sr.failed_credits > 0.5 * sr.registered_credits THEN 1 ELSE 0 END) AS rule_warn_count
        FROM semester_results sr
        GROUP BY sr.semester_id
        ORDER BY sr.semester_id
        """
    ).fetchall()

    # Breakdown by class
    class_stats = cur.execute(
        """
        SELECT c.class_id, c.class_name, p.program_name, a.full_name AS advisor_name,
               COUNT(*) AS total_students,
               SUM(CASE WHEN ra.risk_level = 'HIGH_RISK' THEN 1 ELSE 0 END) AS high_risk,
               SUM(CASE WHEN ra.risk_level = 'ATTENTION' THEN 1 ELSE 0 END) AS attention,
               SUM(CASE WHEN ra.risk_level = 'NORMAL' THEN 1 ELSE 0 END) AS normal,
               ROUND(AVG(sr.gpa_cumulative), 2) AS avg_gpa
        FROM risk_assessments ra
        JOIN students s ON s.student_id = ra.student_id
        JOIN classes c ON c.class_id = s.class_id
        JOIN programs p ON p.program_id = s.program_id
        JOIN advisors a ON a.advisor_id = c.advisor_id
        JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = ra.semester_id
        WHERE ra.semester_id = ?
        GROUP BY c.class_id
        ORDER BY high_risk DESC
        """,
        (latest_sem,),
    ).fetchall()

    # Fairness check across Admission Methods (THPT, HOCBA, DGNL)
    fairness_rows = cur.execute(
        """
        SELECT adm.admission_method,
               COUNT(*) AS total,
               ROUND(AVG(sr.gpa_cumulative), 2) AS avg_gpa,
               ROUND(AVG(ra.risk_probability) * 100, 1) AS avg_risk_pct,
               ROUND(AVG(ABS(ra.predicted_next_gpa - sr.gpa_semester)), 3) AS mae_gap
        FROM risk_assessments ra
        JOIN admission_scores adm ON adm.student_id = ra.student_id
        JOIN semester_results sr ON sr.student_id = ra.student_id AND sr.semester_id = ra.semester_id
        WHERE ra.semester_id = ?
        GROUP BY adm.admission_method
        """,
        (latest_sem,),
    ).fetchall()

    conn.close()
    return jsonify(
        {
            "semester_id": latest_sem,
            "total_students": sum(counts.values()),
            "counts": counts,
            "rule_triggered_count": rule_trig_cnt,
            "early_model_detected_count": early_alert_cnt,
            "semester_trends": [dict(r) for r in sem_trend],
            "class_breakdown": [dict(r) for r in class_stats],
            "fairness_by_admission": [dict(r) for r in fairness_rows],
        }
    )


# 3. GET /api/cohorts (M05 Cohort View with Role / RLS filtering)
@app.route("/api/cohorts", methods=["GET"])
def api_cohorts():
    class_filter = request.args.get("class_id", "").strip()
    level_filter = request.args.get("risk_level", "").strip()
    search_q = request.args.get("q", "").strip().lower()
    advisor_id = request.args.get("advisor_id", "").strip()

    conn = get_connection()
    sql = """
        SELECT s.student_id, s.anon_hash, s.full_name, s.class_id, c.class_name,
               p.program_name, a.full_name AS advisor_name, c.advisor_id,
               adm.normalized_score_30 AS entrance_score, adm.admission_method,
               sr.study_year, sr.gpa_semester, sr.gpa_cumulative,
               sr.registered_credits, sr.failed_credits, sr.accumulated_debt_credits,
               ra.risk_score, ra.risk_probability, ra.risk_level, ra.rule_triggered,
               ra.predicted_next_gpa,
               prev_sr.gpa_semester AS prev_gpa_semester
        FROM risk_assessments ra
        JOIN students s ON s.student_id = ra.student_id
        JOIN classes c ON c.class_id = s.class_id
        JOIN programs p ON p.program_id = s.program_id
        JOIN advisors a ON a.advisor_id = c.advisor_id
        JOIN admission_scores adm ON adm.student_id = s.student_id
        JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = ra.semester_id
        LEFT JOIN semester_results prev_sr ON prev_sr.student_id = s.student_id AND prev_sr.semester_id = '2025_HK1'
        WHERE ra.semester_id = '2025_HK2'
    """
    params = []
    if class_filter:
        sql += " AND s.class_id = ?"
        params.append(class_filter)
    if level_filter:
        sql += " AND ra.risk_level = ?"
        params.append(level_filter)
    if advisor_id:
        sql += " AND c.advisor_id = ?"
        params.append(int(advisor_id))

    sql += " ORDER BY ra.risk_score DESC, sr.gpa_cumulative ASC"
    rows = [dict(r) for r in conn.execute(sql, params).fetchall()]

    # Fetch violated rules per student for 2025_HK2
    vr_rows = conn.execute(
        """
        SELECT ra.student_id, rr.rule_code
        FROM rule_results rr
        JOIN risk_assessments ra ON ra.assessment_id = rr.assessment_id
        WHERE rr.triggered = 1 AND ra.semester_id = '2025_HK2'
        """
    ).fetchall()
    conn.close()

    v_rules_by_student = {}
    for vr in vr_rows:
        v_rules_by_student.setdefault(vr["student_id"], []).append(vr["rule_code"])

    for r in rows:
        prev_g = r["prev_gpa_semester"] if r["prev_gpa_semester"] is not None else r["gpa_semester"]
        r["gpa_trend"] = round(float(r["gpa_semester"]) - float(prev_g), 2)
        r["violated_rules"] = v_rules_by_student.get(r["student_id"], [])

    if search_q:
        rows = [
            r
            for r in rows
            if search_q in r["student_id"].lower()
            or search_q in r["full_name"].lower()
            or search_q in r["class_id"].lower()
        ]

    return jsonify({"rows": rows, "total": len(rows)})


# 4. GET /api/students/<student_id>/assessment (M03 Individual Slip + M04 Trajectory + M06 Local Graph)
@app.route("/api/students/<student_id>/assessment", methods=["GET"])
def api_student_assessment(student_id: str):
    sid = student_id.strip().upper()
    conn = get_connection()
    cur = conn.cursor()

    stu = cur.execute(
        """
        SELECT s.*, c.class_name, c.cohort_year, p.program_name, a.full_name AS advisor_name,
               adm.normalized_score_30, adm.admission_method, adm.thpt_score, adm.dgnl_score, adm.hocba_score
        FROM students s
        JOIN classes c ON c.class_id = s.class_id
        JOIN programs p ON p.program_id = s.program_id
        JOIN advisors a ON a.advisor_id = c.advisor_id
        JOIN admission_scores adm ON adm.student_id = s.student_id
        WHERE s.student_id = ?
        """,
        (sid,),
    ).fetchone()

    if not stu:
        conn.close()
        return jsonify({"error": f"Không tìm thấy sinh viên {sid}"}), 404

    sems = [
        dict(r)
        for r in cur.execute(
            """
            SELECT sr.*, cs.conduct_score, cs.conduct_rank
            FROM semester_results sr
            LEFT JOIN conduct_scores cs ON cs.student_id = sr.student_id AND cs.semester_id = sr.semester_id
            WHERE sr.student_id = ?
            ORDER BY sr.semester_seq
            """,
            (sid,),
        ).fetchall()
    ]

    ra = cur.execute(
        "SELECT * FROM risk_assessments WHERE student_id = ? AND semester_id = '2025_HK2'",
        (sid,),
    ).fetchone()

    factors = [
        dict(r)
        for r in cur.execute(
            "SELECT * FROM risk_factors WHERE assessment_id = ? ORDER BY ABS(contribution) DESC",
            (ra["assessment_id"],),
        ).fetchall()
    ]
    rules = [
        dict(r)
        for r in cur.execute(
            "SELECT * FROM rule_results WHERE assessment_id = ? ORDER BY rule_code",
            (ra["assessment_id"],),
        ).fetchall()
    ]

    peer_edges = [
        dict(r)
        for r in cur.execute(
            """
            SELECT ge.dst_student AS peer_id, s.full_name AS peer_name, ge.edge_type,
                   ge.weight, ge.sheaf_attention,
                   sr.gpa_cumulative AS peer_gpa, ra.risk_level AS peer_risk_level
            FROM graph_edges ge
            JOIN students s ON s.student_id = ge.dst_student
            JOIN semester_results sr ON sr.student_id = ge.dst_student AND sr.semester_id = '2025_HK2'
            JOIN risk_assessments ra ON ra.student_id = ge.dst_student AND ra.semester_id = '2025_HK2'
            WHERE ge.src_student = ? AND ge.semester_id = '2025_HK2'
            ORDER BY ge.sheaf_attention DESC
            LIMIT 8
            """,
            (sid,),
        ).fetchall()
    ]

    interventions = [
        dict(r)
        for r in cur.execute(
            """
            SELECT iv.*, a.full_name AS advisor_name
            FROM interventions iv
            JOIN advisors a ON a.advisor_id = iv.advisor_id
            WHERE iv.student_id = ?
            ORDER BY iv.meeting_date DESC
            """,
            (sid,),
        ).fetchall()
    ]

    conn.close()
    ra_dict = dict(ra)
    ra_dict["recommendations"] = json.loads(ra_dict["recommendations_json"])

    return jsonify(
        {
            "student": dict(stu),
            "semesters": sems,
            "assessment": ra_dict,
            "factors": factors,
            "rule_checks": rules,
            "peer_edges": peer_edges,
            "interventions": interventions,
        }
    )


# 5. POST /api/assess/simulate (Interactive What-If Simulator compatible with Teacher's PoC + Sheaf Engine)
@app.route("/api/assess/simulate", methods=["POST"])
def api_assess_simulate():
    body = request.get_json(force=True, silent=True) or {}
    sid = body.get("student_id")
    entrance = float(body.get("entrance_score", 19.5))
    debt = int(body.get("accumulated_debt_credits", body.get("sim_debt", 10)))
    consec_w = int(body.get("consecutive_warnings", 0))
    plan = body.get("plan", {"tc": 18, "easy": 2, "mid": 2, "hard": 2})
    raw_sems = body.get("semesters", [])

    conn = get_connection()
    stu = None
    if not raw_sems and sid:
        db_sems = [
            dict(r)
            for r in conn.execute(
                "SELECT * FROM semester_results WHERE student_id = ? ORDER BY semester_seq",
                (sid,),
            ).fetchall()
        ]
        stu = conn.execute("SELECT * FROM students WHERE student_id = ?", (sid,)).fetchone()
        adm = conn.execute("SELECT * FROM admission_scores WHERE student_id = ?", (sid,)).fetchone()
        if db_sems:
            if adm and adm["normalized_score_30"]:
                entrance = float(adm["normalized_score_30"])
            raw_sems = []
            for s in db_sems:
                raw_sems.append({
                    "tcDK": s["registered_credits"],
                    "tcKD": s["failed_credits"],
                    "dtbHK": s["gpa_semester"],
                    "dtbTL": s["gpa_cumulative"],
                })
            if "sim_gpa" in body:
                raw_sems[-1]["dtbHK"] = float(body["sim_gpa"])
                raw_sems[-1]["dtbTL"] = round((raw_sems[-1]["dtbTL"] * 0.75 + float(body["sim_gpa"]) * 0.25), 2)
            if "sim_debt" in body:
                raw_sems[-1]["tcKD"] = min(raw_sems[-1]["tcDK"], debt)

    if not raw_sems:
        sim_gpa = float(body.get("sim_gpa", 1.8))
        raw_sems = [
            {"tcDK": 16, "tcKD": 0, "dtbHK": 2.8, "dtbTL": 2.8},
            {"tcDK": 16, "tcKD": min(16, debt), "dtbHK": sim_gpa, "dtbTL": round((2.8 + sim_gpa) / 2, 2)},
        ]

    sems = []
    for idx, s in enumerate(raw_sems, start=1):
        tc_dk = int(s.get("tcDK", 16))
        tc_kd = int(s.get("tcKD", 0))
        dtb_hk = float(s.get("dtbHK", 2.5))
        dtb_tl = float(s.get("dtbTL", dtb_hk))
        sems.append(
            {
                "semester_seq": idx,
                "study_year": (idx + 1) // 2,
                "registered_credits": tc_dk,
                "passed_credits": max(0, tc_dk - tc_kd),
                "failed_credits": tc_kd,
                "accumulated_debt_credits": debt if idx == len(raw_sems) else tc_kd,
                "gpa_semester": dtb_hk,
                "gpa_cumulative": dtb_tl,
                "planned_credits_next": int(plan.get("tc", 18)),
                "planned_easy_courses": int(plan.get("easy", 2)),
                "planned_mid_courses": int(plan.get("mid", 2)),
                "planned_hard_courses": int(plan.get("hard", 2)),
            }
        )

    active_rules = load_active_rules(conn)
    conn.close()

    last_sem = sems[-1]
    rule_eval = evaluate_student_rules(last_sem, consec_w, consec_w, active_rules)
    p4_params = active_rules["R04_CUM_GPA_BY_YEAR"]["params"]
    th = get_cumulative_gpa_threshold(last_sem["study_year"], p4_params)

    peer_sig = float(body.get("sheaf_peer_signal", 0.08 if int(plan.get("hard", 0)) >= 2 else 0.0))
    _, contrib, prob, pred_gpa = compute_student_features(sems, entrance, peer_sig, th)

    if rule_eval["rule_triggered"]:
        risk_level = "HIGH_RISK"
        prob = max(prob, 0.82)
    elif prob >= 0.65:
        risk_level = "HIGH_RISK"
    elif prob >= 0.35:
        risk_level = "ATTENTION"
    else:
        risk_level = "NORMAL"

    expl, advice = generate_explanation_and_advice(contrib, last_sem, risk_level, rule_eval["rule_triggered"])
    factors_out = [
        {
            "factor_code": k,
            "factor_label": FACTOR_META[k],
            "contribution": v,
            "direction": "INCREASE" if v >= 0 else "DECREASE",
        }
        for k, v in sorted(contrib.items(), key=lambda item: abs(item[1]), reverse=True)
    ]

    stu_dict = dict(stu) if stu else {
        "student_id": sid or "SV002",
        "full_name": f"Sinh viên Giả lập ({sid or 'What-If'})",
        "class_name": "Lớp Thử nghiệm What-If",
        "advisor_name": "Cố vấn học tập",
    }

    return jsonify(
        {
            "student": stu_dict,
            "assessment": {
                "risk_level": risk_level,
                "risk_score": round(prob * 100, 1),
                "predicted_next_gpa": round(pred_gpa, 2),
                "predicted_gpa_std": 0.15,
                "explanation_text": expl,
                "recommendations": [advice] if isinstance(advice, str) else advice,
                "advisor_action_hint": advice,
                "assessed_at": "Đánh giá giả lập What-If tức thời",
            },
            "rule_checks": rule_eval["checks"],
            "factors": factors_out,
            "peers": [],
            "semesters": sems,
            "is_simulation": True,
        }
    )


# 6. GET /api/graph/network (M06 Interactive Student Graph Visualization)
@app.route("/api/graph/network", methods=["GET"])
def api_graph_network():
    limit_nodes = int(request.args.get("limit", 180))
    class_id = request.args.get("class_id", "").strip()
    conn = get_connection()
    cur = conn.cursor()

    query = """
        SELECT s.student_id, s.full_name, s.class_id, sr.gpa_cumulative,
               sr.gpa_semester, sr.accumulated_debt_credits,
               ra.risk_level, ra.risk_score, ra.risk_probability, ra.rule_triggered,
               ra.predicted_next_gpa
        FROM students s
        JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = '2025_HK2'
        JOIN risk_assessments ra ON ra.student_id = s.student_id AND ra.semester_id = '2025_HK2'
    """
    params = []
    if class_id:
        query += " WHERE s.class_id = ?"
        params.append(class_id)
    query += " ORDER BY s.student_id LIMIT ?"
    params.append(limit_nodes)

    nodes_rows = cur.execute(query, params).fetchall()
    node_ids = {r["student_id"] for r in nodes_rows}
    edges_rows = cur.execute(
        """
        SELECT src_student, dst_student, edge_type, weight, sheaf_attention
        FROM graph_edges
        WHERE semester_id = '2025_HK2'
        ORDER BY sheaf_attention DESC
        """
    ).fetchall()
    conn.close()

    filtered_edges = []
    seen_pairs = set()
    for e in edges_rows:
        u, v = e["src_student"], e["dst_student"]
        if u in node_ids and v in node_ids:
            pair = tuple(sorted([u, v]))
            if pair not in seen_pairs:
                seen_pairs.add(pair)
                filtered_edges.append(dict(e))

    return jsonify({"nodes": [dict(r) for r in nodes_rows], "edges": filtered_edges})


# 7. GET, PUT, & RE-EVALUATE /api/rules (M07 & M10 Rule Configuration)
@app.route("/api/rules", methods=["GET"])
def api_get_rules():
    conn = get_connection()
    rows = [dict(r) for r in conn.execute("SELECT * FROM rule_config ORDER BY rule_id").fetchall()]

    # Query current violations for each rule in 2025_HK2
    v_rows = conn.execute(
        """
        SELECT rr.rule_code, COUNT(DISTINCT ra.student_id) as violated_count,
               GROUP_CONCAT(DISTINCT ra.student_id) as student_ids
        FROM rule_results rr
        JOIN risk_assessments ra ON ra.assessment_id = rr.assessment_id
        WHERE rr.triggered = 1 AND ra.semester_id = '2025_HK2'
        GROUP BY rr.rule_code
        """
    ).fetchall()
    conn.close()

    v_map = {
        r["rule_code"]: {
            "count": r["violated_count"],
            "students": [s.strip() for s in r["student_ids"].split(",")] if r["student_ids"] else [],
        }
        for r in v_rows
    }

    RULE_META_EXTRA = {
        "R01_SEM_FAIL_RATIO": {
            "unit": "% tín chỉ đăng ký",
            "format_threshold": lambda p: f"> {int(float(p.get('max_fail_ratio', 0.5)) * 100)}% khối lượng ĐK",
            "tooltip": "Căn cứ Điểm a Khoản 1 Điều 11 Thông tư 08/2021/TT-BGDĐT: Sinh viên bị cảnh báo kết quả học tập cuối mỗi học kỳ chính nếu tổng số tín chỉ không đạt trong học kỳ vượt quá 50% khối lượng đã đăng ký học trong học kỳ đó.",
        },
        "R02_ACCUM_DEBT_CREDITS": {
            "unit": "Tín chỉ nợ đọng",
            "format_threshold": lambda p: f"> {int(p.get('max_debt_credits', 24))} tín chỉ nợ đọng",
            "tooltip": "Căn cứ Điểm b Khoản 1 Điều 11 Thông tư 08/2021/TT-BGDĐT: Sinh viên bị cảnh báo kết quả học tập nếu tổng số tín chỉ nợ đọng từ đầu khóa học (các học phần F, W chưa học lại) vượt quá 24 tín chỉ.",
        },
        "R03_SEM_GPA_FLOOR": {
            "unit": "Thang điểm 4.0",
            "format_threshold": lambda p: f"< {float(p.get('first_sem_floor', 0.8)):.2f} (HK đầu) / < {float(p.get('later_sem_floor', 1.0)):.2f} (HK sau)",
            "tooltip": "Căn cứ Điểm c Khoản 1 Điều 11 Thông tư 08/2021/TT-BGDĐT: Sinh viên bị cảnh báo nếu điểm trung bình học kỳ đạt dưới 0.80 đối với học kỳ đầu của khóa học, hoặc dưới 1.00 đối với các học kỳ tiếp theo.",
        },
        "R04_CUM_GPA_BY_YEAR": {
            "unit": "Thang điểm 4.0",
            "format_threshold": lambda p: f"Năm 1: <{float(p.get('year_1', 1.2)):.2f} | Năm 2: <{float(p.get('year_2', 1.4)):.2f} | Năm 3: <{float(p.get('year_3', 1.6)):.2f} | Năm 4+: <{float(p.get('year_4_plus', 1.8)):.2f}",
            "tooltip": "Căn cứ Điểm d Khoản 1 Điều 11 Thông tư 08/2021/TT-BGDĐT: Sinh viên bị cảnh báo nếu điểm trung bình tích lũy đạt dưới ngưỡng lũy tiến theo năm đào tạo (Năm 1: < 1.20, Năm 2: < 1.40, Năm 3: < 1.60, Năm 4 trở đi: < 1.80).",
        },
        "R05_CONSECUTIVE_WARNINGS": {
            "unit": "Lần cảnh báo học tập",
            "format_threshold": lambda p: f"≥ {int(p.get('max_consecutive_warnings', 2))} lần liên tiếp hoặc ≥ {int(p.get('max_total_warnings', 3))} lần tổng cộng",
            "tooltip": "Căn cứ Khoản 2 Điều 11 Thông tư 08/2021/TT-BGDĐT & Quy chế Đào tạo ĐH Mở TP.HCM: Sinh viên bị buộc thôi học nếu bị cảnh báo kết quả học tập 2 lần liên tiếp, hoặc tổng số lần bị cảnh báo vượt quá 3 lần trong toàn khóa.",
        },
    }

    for r in rows:
        params = json.loads(r["param_json"])
        r["params"] = params
        extra = RULE_META_EXTRA.get(r["rule_code"], {})
        r["unit"] = extra.get("unit", "Tiêu chí")
        r["formatted_threshold"] = extra["format_threshold"](params) if "format_threshold" in extra else str(params)
        r["tooltip"] = extra.get("tooltip", r["rule_name"])
        v_info = v_map.get(r["rule_code"], {"count": 0, "students": []})
        r["violation_count"] = v_info["count"]
        r["violated_students"] = v_info["students"]

    return jsonify({"rules": rows})


@app.route("/api/rules/<rule_code>", methods=["PUT"])
def api_update_rule(rule_code: str):
    body = request.get_json(force=True, silent=True) or {}
    new_params = body.get("params")
    if not isinstance(new_params, dict):
        return jsonify({"error": "Tham số params không hợp lệ"}), 400

    conn = get_connection()
    conn.execute(
        "UPDATE rule_config SET param_json = ? WHERE rule_code = ?",
        (json.dumps(new_params, ensure_ascii=False), rule_code),
    )
    log_audit(conn, 1, "UPDATE_RULE_CONFIG", rule_code, new_params)
    conn.commit()
    conn.close()

    # Re-run pipeline so updated regulations take effect immediately
    summary = run_full_pipeline()
    return jsonify({"status": "updated", "rule_code": rule_code, "pipeline_summary": summary})


@app.route("/api/rules/re-evaluate", methods=["POST"])
def api_reevaluate_rules():
    summary = run_full_pipeline()
    conn = get_connection()
    log_audit(conn, 1, "RE_EVALUATE_ALL_RULES", "ALL", summary)

    v_rows = conn.execute(
        """
        SELECT rr.rule_code, COUNT(DISTINCT ra.student_id) as violated_count,
               GROUP_CONCAT(DISTINCT ra.student_id) as student_ids
        FROM rule_results rr
        JOIN risk_assessments ra ON ra.assessment_id = rr.assessment_id
        WHERE rr.triggered = 1 AND ra.semester_id = '2025_HK2'
        GROUP BY rr.rule_code
        """
    ).fetchall()

    total_triggered = conn.execute(
        """
        SELECT COUNT(*) FROM risk_assessments
        WHERE semester_id = '2025_HK2' AND rule_triggered = 1
        """
    ).fetchone()[0]
    conn.close()

    v_map = {
        r["rule_code"]: {
            "count": r["violated_count"],
            "students": [s.strip() for s in r["student_ids"].split(",")] if r["student_ids"] else [],
        }
        for r in v_rows
    }

    return jsonify(
        {
            "status": "success",
            "message": "Đã hoàn thành đối soát toàn trường cho 180 sinh viên theo Thông tư 08/2021/TT-BGDĐT",
            "total_rule_triggered": total_triggered,
            "pipeline_summary": summary,
            "violations": v_map,
            "evaluated_at": datetime.now().isoformat(),
        }
    )


# 8. GET & POST /api/interventions (M08 Advisor Interventions)
@app.route("/api/interventions", methods=["GET", "POST"])
def api_interventions():
    conn = get_connection()
    if request.method == "POST":
        body = request.get_json(force=True, silent=True) or {}
        sid = (body.get("student_id") or "SV002").strip().upper()
        advisor_id = int(body.get("advisor_id") or 1)
        m_date = (body.get("meeting_date") or "2026-11-10").strip()
        notes = (body.get("notes") or "").strip()
        outcome = (body.get("outcome_status") or "SCHEDULED").strip()

        if not notes:
            conn.close()
            return jsonify({"error": "Nội dung buổi làm việc không được để trống"}), 400

        conn.execute(
            "INSERT INTO interventions (student_id, advisor_id, meeting_date, notes, outcome_status) VALUES (?, ?, ?, ?, ?)",
            (sid, advisor_id, m_date, notes, outcome),
        )
        log_audit(conn, advisor_id, "CREATE_INTERVENTION", sid, {"meeting_date": m_date, "outcome": outcome})
        conn.commit()

    rows = [
        dict(r)
        for r in conn.execute(
            """
            SELECT iv.*, s.full_name AS student_name, s.class_id, a.full_name AS advisor_name,
                   ra.risk_level, ra.risk_score
            FROM interventions iv
            JOIN students s ON s.student_id = iv.student_id
            JOIN advisors a ON a.advisor_id = iv.advisor_id
            LEFT JOIN risk_assessments ra ON ra.student_id = iv.student_id AND ra.semester_id = '2025_HK2'
            ORDER BY iv.intervention_id DESC
            """
        ).fetchall()
    ]
    conn.close()
    return jsonify({"interventions": rows})


@app.route("/api/interventions/<int:intervention_id>", methods=["PUT", "DELETE"])
def api_intervention_detail(intervention_id: int):
    conn = get_connection()
    if request.method == "DELETE":
        conn.execute("DELETE FROM interventions WHERE intervention_id = ?", (intervention_id,))
        log_audit(conn, 1, "DELETE_INTERVENTION", str(intervention_id), {})
        conn.commit()
        conn.close()
        return jsonify({"status": "deleted", "intervention_id": intervention_id})

    # PUT
    body = request.get_json(force=True, silent=True) or {}
    notes = (body.get("notes") or "").strip()
    outcome = (body.get("outcome_status") or body.get("outcome") or "SCHEDULED").strip()
    m_date = (body.get("meeting_date") or body.get("intervention_date") or "").strip()

    if not notes:
        conn.close()
        return jsonify({"error": "Ghi chú can thiệp không được để trống"}), 400

    conn.execute(
        """
        UPDATE interventions
        SET notes = ?, outcome_status = ?, meeting_date = COALESCE(NULLIF(?, ''), meeting_date)
        WHERE intervention_id = ?
        """,
        (notes, outcome, m_date, intervention_id),
    )
    log_audit(conn, 1, "UPDATE_INTERVENTION", str(intervention_id), {"outcome": outcome, "notes": notes})
    conn.commit()
    conn.close()
    return jsonify({"status": "updated", "intervention_id": intervention_id})


# Endpoint CRUD: Cập nhật thông tin điểm học kỳ sinh viên và tự động tái tính toán rủi ro tức thời
@app.route("/api/students/<student_id>", methods=["PUT"])
def api_update_student_grades(student_id: str):
    sid = student_id.strip().upper()
    body = request.get_json(force=True, silent=True) or {}
    try:
        gpa_sem = float(body.get("gpa_semester", body.get("gpa_term", 2.0)))
        gpa_cum = float(body.get("gpa_cumulative", body.get("gpa_cum", gpa_sem)))
        failed_cr = int(body.get("failed_credits", 0))
        debt_cr = int(body.get("accumulated_debt_credits", body.get("failed_credits_cumulative", failed_cr)))
    except (ValueError, TypeError):
        return jsonify({"error": "Giá trị số liệu GPA hoặc tín chỉ không hợp lệ"}), 400

    conn = get_connection()
    res = conn.execute(
        """
        UPDATE semester_results
        SET gpa_semester = ?, gpa_cumulative = ?, failed_credits = ?, accumulated_debt_credits = ?
        WHERE student_id = ? AND semester_id = '2025_HK2'
        """,
        (gpa_sem, gpa_cum, failed_cr, debt_cr, sid),
    )
    if res.rowcount == 0:
        conn.close()
        return jsonify({"error": f"Không tìm thấy học kỳ của sinh viên {sid}"}), 404

    log_audit(conn, 1, "UPDATE_STUDENT_GRADES", sid, {
        "gpa_semester": gpa_sem,
        "gpa_cumulative": gpa_cum,
        "failed_credits": failed_cr,
        "accumulated_debt_credits": debt_cr,
    })
    conn.commit()
    conn.close()

    # Re-evaluate all student assessments & regulations immediately
    summary = run_full_pipeline()
    return jsonify({"status": "updated", "student_id": sid, "pipeline_summary": summary})


# 9. POST /api/data/import (M09 Row-level Validated CSV Import)
@app.route("/api/data/import", methods=["POST"])
def api_data_import():
    body = request.get_json(force=True, silent=True) or {}
    csv_text = (body.get("csv_text") or "").strip()
    if not csv_text:
        return jsonify({"error": "Không có dữ liệu CSV đầu vào"}), 400

    reader = csv.DictReader(io.StringIO(csv_text))
    valid_rows = []
    errors = []

    for line_idx, row in enumerate(reader, start=2):
        sid = (row.get("student_id") or "").strip().upper()
        try:
            tc_dk = int(row.get("registered_credits", 0))
            tc_kd = int(row.get("failed_credits", 0))
            gpa_hk = float(row.get("gpa_semester", -1))
            gpa_tl = float(row.get("gpa_cumulative", -1))
            debt = int(row.get("accumulated_debt_credits", 0))
        except ValueError:
            errors.append({"line": line_idx, "student_id": sid, "error": "Sai kiểu dữ liệu số (GPA hoặc tín chỉ)"})
            continue

        if not sid.startswith("SV"):
            errors.append({"line": line_idx, "student_id": sid, "error": "Mã SV phải bắt đầu bằng 'SV' (ví dụ SV001)"})
        elif not (0.0 <= gpa_hk <= 4.0 and 0.0 <= gpa_tl <= 4.0):
            errors.append({"line": line_idx, "student_id": sid, "error": f"Điểm GPA ({gpa_hk}, {gpa_tl}) nằm ngoài thang [0.0, 4.0]"})
        elif tc_dk <= 0 or tc_kd < 0 or tc_kd > tc_dk:
            errors.append({"line": line_idx, "student_id": sid, "error": f"Số tín chỉ không đạt ({tc_kd}) vượt tín chỉ đăng ký ({tc_dk})"})
        elif debt < 0:
            errors.append({"line": line_idx, "student_id": sid, "error": "Tín chỉ nợ đọng không được âm"})
        else:
            valid_rows.append(
                {
                    "student_id": sid,
                    "registered_credits": tc_dk,
                    "failed_credits": tc_kd,
                    "gpa_semester": gpa_hk,
                    "gpa_cumulative": gpa_tl,
                    "accumulated_debt_credits": debt,
                }
            )

    conn = get_connection()
    updated_count = 0
    for vr in valid_rows:
        res = conn.execute(
            """
            UPDATE semester_results
            SET registered_credits = ?, passed_credits = ?, failed_credits = ?,
                gpa_semester = ?, gpa_cumulative = ?, accumulated_debt_credits = ?
            WHERE student_id = ? AND semester_id = '2025_HK2'
            """,
            (
                vr["registered_credits"],
                vr["registered_credits"] - vr["failed_credits"],
                vr["failed_credits"],
                vr["gpa_semester"],
                vr["gpa_cumulative"],
                vr["accumulated_debt_credits"],
                vr["student_id"],
            ),
        )
        updated_count += res.rowcount

    log_audit(
        conn, 2, "IMPORT_CSV", "semester_results", {"valid": len(valid_rows), "errors": len(errors), "updated": updated_count}
    )
    conn.commit()
    conn.close()

    if updated_count > 0:
        run_full_pipeline()

    return jsonify(
        {
            "total_rows_read": len(valid_rows) + len(errors),
            "valid_count": len(valid_rows),
            "updated_in_db": updated_count,
            "error_count": len(errors),
            "errors": errors,
        }
    )


# 10. GET & POST /api/models (M11 Model Registry & Benchmark Comparison)
@app.route("/api/models", methods=["GET"])
def api_get_models():
    conn = get_connection()
    rows = [dict(r) for r in conn.execute("SELECT * FROM model_runs ORDER BY pr_auc DESC").fetchall()]
    conn.close()
    return jsonify({"models": rows})


@app.route("/api/models/<run_id>/activate", methods=["POST"])
def api_activate_model(run_id: str):
    conn = get_connection()
    conn.execute("UPDATE model_runs SET is_active = 0")
    conn.execute("UPDATE model_runs SET is_active = 1 WHERE run_id = ?", (run_id,))
    log_audit(conn, 1, "ACTIVATE_MODEL", run_id, {})
    conn.commit()
    conn.close()
    return jsonify({"status": "activated", "active_run_id": run_id})


# 11. GET /api/reports/export (M12 Export Cohort Report to CSV/Excel-ready UTF-8 BOM)
@app.route("/api/reports/export", methods=["GET"])
def api_export_report():
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT s.student_id, s.full_name, s.class_id, p.program_name,
               sr.study_year, sr.gpa_semester, sr.gpa_cumulative,
               sr.registered_credits, sr.failed_credits, sr.accumulated_debt_credits,
               ra.risk_score, ra.risk_level, ra.rule_triggered, ra.predicted_next_gpa,
               ra.explanation_text
        FROM risk_assessments ra
        JOIN students s ON s.student_id = ra.student_id
        JOIN programs p ON p.program_id = s.program_id
        JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = ra.semester_id
        WHERE ra.semester_id = '2025_HK2'
        ORDER BY ra.risk_score DESC
        """
    ).fetchall()
    conn.close()

    output = io.StringIO()
    output.write("\ufeff")  # UTF-8 BOM for Microsoft Excel Vietnamese compatibility
    writer = csv.writer(output)
    writer.writerow(
        [
            "Mã SV", "Họ và tên", "Lớp", "Chương trình", "Năm học",
            "ĐTB HK (2025_HK2)", "ĐTB Tích lũy", "TC Đăng ký", "TC Không đạt", "TC Nợ đọng",
            "Điểm nguy cơ (%)", "Mức cảnh báo", "Chạm quy chế TT08", "Dự báo ĐTB kỳ tới", "Giải thích nguyên nhân"
        ]
    )
    for r in rows:
        writer.writerow(
            [
                r["student_id"], r["full_name"], r["class_id"], r["program_name"], r["study_year"],
                r["gpa_semester"], r["gpa_cumulative"], r["registered_credits"], r["failed_credits"],
                r["accumulated_debt_credits"], r["risk_score"], r["risk_level"],
                "Có" if r["rule_triggered"] else "Không", r["predicted_next_gpa"], r["explanation_text"]
            ]
        )

    return Response(
        output.getvalue(),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=EduAlert_BaoCao_CanhBaoHocVu_2025_HK2.csv"},
    )


# 12. POST /api/copilot/ask & GET /api/audit (Advisor Copilot & Security Audit Log)
@app.route("/api/copilot/ask", methods=["POST"])
def api_copilot_ask():
    body = request.get_json(force=True, silent=True) or {}
    q = (body.get("query") or body.get("question") or "").strip()
    if not q:
        return jsonify({"error": "Vui lòng nhập câu hỏi"}), 400
    role = (body.get("role") or "ADVISOR").upper()
    restrict = (body.get("student_id") or "").upper() if role == "STUDENT" else None
    if role == "STUDENT" and not restrict:
        return jsonify({"error": "Thiếu mã sinh viên cho phiên LV1"}), 400
    history = body.get("history") if isinstance(body.get("history"), list) else []
    api_key = (body.get("api_key") or "").strip() or None
    model = (body.get("model") or "").strip() or None
    res = ask_assistant(
        q,
        history=history,
        role=role,
        display_name=body.get("display_name", ""),
        restrict_student_id=restrict,
        api_key=api_key,
        model=model,
    )
    conn = get_connection()
    log_audit(conn, None, "COPILOT_ASK", "copilot", {"role": role, "engine": res.get("engine"), "q": q[:200]})
    conn.commit()
    conn.close()
    # Ensure client compatibility for both citations and legal_basis/sql_query
    if "citations" in res and isinstance(res["citations"], list):
        res["legal_basis"] = " · ".join(res["citations"])
    res["sql_query"] = res.get("sql_executed")
    return jsonify(res)


# 12b. GET /api/ai/status & POST /api/ai/config (Google Gemini / offline RAG status & runtime key config)
@app.route("/api/ai/status", methods=["GET"])
def api_ai_status():
    return jsonify(ai_status())


@app.route("/api/ai/config", methods=["POST"])
def api_ai_config():
    body = request.get_json(force=True, silent=True) or {}
    key = body.get("api_key")
    model = body.get("model")
    status = set_gemini_config(api_key=key, model=model)
    return jsonify(status)


# 12c. Single-service fallbacks (khi chạy không có Node.js Gateway, ví dụ Azure App Service)
_GATEWAY_STATE = {"circuit_breaker_state": "CLOSED"}


@app.route("/api/bff/dashboard-overview", methods=["GET"])
def api_bff_dashboard_overview():
    stats = api_stats_overview().get_json()
    models = api_get_models().get_json().get("models", [])
    active = next((m for m in models if m.get("is_active")), models[0] if models else None)
    total = max(1, stats.get("total_students", 1))
    return jsonify(
        {
            "stats": stats,
            "active_model": active,
            "gateway_telemetry": {
                "circuit_breaker_state": _GATEWAY_STATE["circuit_breaker_state"],
                "avg_latency_ms": 0,
                "correlation_id": "flask-direct",
                "mode": "Flask single-service (Azure App Service)",
            },
            "triage_urgency_ratio": round(stats.get("counts", {}).get("HIGH_RISK", 0) / total * 100, 1),
        }
    )


@app.route("/api/gateway/health", methods=["GET"])
def api_gateway_health():
    return jsonify({"status": "ok", "gateway": "flask-direct", **_GATEWAY_STATE})


@app.route("/api/gateway/circuit-breaker/reset", methods=["POST"])
def api_gateway_cb_reset():
    _GATEWAY_STATE["circuit_breaker_state"] = "CLOSED"
    return jsonify({"status": "reset", **_GATEWAY_STATE})


@app.route("/api/audit", methods=["GET"])
def api_audit_logs():
    conn = get_connection()
    rows = [
        dict(r)
        for r in conn.execute("SELECT * FROM audit_log ORDER BY log_id DESC LIMIT 30").fetchall()
    ]
    conn.close()
    return jsonify({"logs": rows})


# 13. GET /api/architecture/blueprint (Hexagonal Architecture Design Blueprint)
@app.route("/api/architecture/blueprint", methods=["GET"])
def api_architecture_blueprint():
    # Live verification through Hexagonal UseCase (Domain + Ports + Adapters)
    use_case = EvaluateStudentRiskUseCase(
        regulation_port=Circular08RegulationAdapter(),
        inference_port=SheafAttentionInferenceAdapter(),
        audit_port=None,
    )
    sample_snaps = [
        SemesterSnapshot("SV002", "2024_HK1", 1, 1, 15, 15, 0, 0, 2.95, 2.95),
        SemesterSnapshot("SV002", "2024_HK2", 1, 2, 14, 14, 0, 3, 2.55, 2.75),
        SemesterSnapshot("SV002", "2025_HK1", 2, 3, 15, 11, 4, 7, 2.05, 2.48),
        SemesterSnapshot("SV002", "2025_HK2", 2, 4, 13, 10, 3, 10, 1.62, 2.22, 18, 1, 2, 3),
    ]
    slip = use_case.execute("SV002", "2025_HK2", sample_snaps, entrance_score_30=18.4, sheaf_peer_signal=0.14)

    return jsonify(
        {
            "architecture_style": "Hexagonal Architecture (Ports & Adapters) + Event-Driven Outbox",
            "frontend_stack": "React 18 Component Architecture + Interactive SVG DataViz",
            "gateway_stack": "Node.js v24 Enterprise BFF Gateway (Circuit Breaker, Rate Limit, Correlation-ID)",
            "domain_core": "Pure Python 3.10 Domain Entities (Zero Framework Dependency) + Use Cases",
            "outbound_adapters": [
                "Circular08RegulationAdapter -> RegulationPort (Temporal Rule Engine TT08/2021)",
                "SheafAttentionInferenceAdapter -> GraphInferencePort (GCN, ST-GAT, Sheaf Attention + SHAP)",
                "PostgreSQL16 / SQLite3 -> StudentRepositoryPort & AuditPort (3NF, 18 Tables, RLS, Materialized Views)",
            ],
            "live_hexagonal_probe": {
                "student_id": slip.student_id,
                "final_risk_level": slip.final_risk_level.value,
                "final_risk_score": slip.final_risk_score,
                "rule_triggered": slip.rule_triggered,
                "predicted_next_gpa": slip.predicted_next_gpa,
            },
            "design_patterns": {
                "compliance_first": "Deterministic Circular 08/2021 Rules override ML probability; full XAI attribution & immutable audit log.",
                "pluggable_persistence": "Decoupled Repository Ports enable seamless swap between SQLite, PostgreSQL RLS, and institutional SIS/ERP APIs.",
            },
        }
    )


if __name__ == "__main__":
    import os

    ensure_initialized()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    print(f"EduAlert Full-Stack Server starting on http://{host}:{port}")
    print(f"AI Assistant: {ai_status()['provider']} — {ai_status()['model']}")
    app.run(host=host, port=port, debug=False)
