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


# 1. POST /api/auth/login (M01)
@app.route("/api/auth/login", methods=["POST"])
def api_login():
    body = request.get_json(force=True, silent=True) or {}
    username = (body.get("username") or "cvht_lan").strip()
    conn = get_connection()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if not user:
        user = conn.execute("SELECT * FROM users LIMIT 1").fetchone()
    advisor = conn.execute("SELECT * FROM advisors WHERE user_id = ?", (user["user_id"],)).fetchone()
    token = hashlib.sha256(f"session::{user['username']}".encode()).hexdigest()[:32]
    log_audit(conn, user["user_id"], "LOGIN", "users", {"username": user["username"], "role": user["role"]})
    conn.commit()
    conn.close()
    return jsonify(
        {
            "token": token,
            "user_id": user["user_id"],
            "username": user["username"],
            "role": user["role"],
            "email": user["email"],
            "advisor_name": advisor["full_name"] if advisor else "Quản trị / Phòng Đào tạo",
            "advisor_id": advisor["advisor_id"] if advisor else 1,
        }
    )


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
    conn.close()

    for r in rows:
        prev_g = r["prev_gpa_semester"] if r["prev_gpa_semester"] is not None else r["gpa_semester"]
        r["gpa_trend"] = round(float(r["gpa_semester"]) - float(prev_g), 2)

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
    entrance = float(body.get("entrance_score", 19.5))
    debt = int(body.get("accumulated_debt_credits", 10))
    consec_w = int(body.get("consecutive_warnings", 0))
    plan = body.get("plan", {"tc": 18, "easy": 2, "mid": 2, "hard": 2})
    raw_sems = body.get("semesters", [])

    if not raw_sems:
        return jsonify({"error": "Chưa có dữ liệu học kỳ"}), 400

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

    conn = get_connection()
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

    return jsonify(
        {
            "study_year": last_sem["study_year"],
            "num_semesters": len(sems),
            "risk_level": risk_level,
            "risk_probability": prob,
            "risk_score": round(prob * 100, 1),
            "rule_triggered": rule_eval["rule_triggered"],
            "predicted_next_gpa": pred_gpa,
            "rule_checks": rule_eval["checks"],
            "factors": factors_out,
            "explanation_text": expl,
            "recommendations": advice,
        }
    )


# 6. GET /api/graph/network (M06 Interactive Student Graph Visualization)
@app.route("/api/graph/network", methods=["GET"])
def api_graph_network():
    limit_nodes = int(request.args.get("limit", 45))
    conn = get_connection()
    cur = conn.cursor()
    nodes_rows = cur.execute(
        """
        SELECT s.student_id, s.full_name, s.class_id, sr.gpa_cumulative,
               ra.risk_level, ra.risk_score, ra.rule_triggered
        FROM students s
        JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = '2025_HK2'
        JOIN risk_assessments ra ON ra.student_id = s.student_id AND ra.semester_id = '2025_HK2'
        ORDER BY s.student_id
        LIMIT ?
        """,
        (limit_nodes,),
    ).fetchall()

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

    return jsonify({"nodes": [dict(r) for r in nodes_rows], "edges": filtered_edges[:120]})


# 7. GET & PUT /api/rules (M07 & M10 Rule Configuration)
@app.route("/api/rules", methods=["GET"])
def api_get_rules():
    conn = get_connection()
    rows = [dict(r) for r in conn.execute("SELECT * FROM rule_config ORDER BY rule_id").fetchall()]
    conn.close()
    for r in rows:
        r["params"] = json.loads(r["param_json"])
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
    q = (body.get("query") or "").strip()
    if not q:
        return jsonify({"error": "Vui lòng nhập câu hỏi"}), 400
    res = answer_copilot_query(q)
    return jsonify(res)


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
    ensure_initialized()
    print("EduAlert Full-Stack Server starting on http://127.0.0.1:8000")
    app.run(host="127.0.0.1", port=8000, debug=False)
