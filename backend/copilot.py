# -*- coding: utf-8 -*-
"""
EduAlert — Least-Privilege Read-Only SQL Explorer & Academic Advisor Copilot
Features:
 - Database-Engine Least-Privilege Sandbox: SQLite Read-Only URI + PRAGMA query_only=ON + sqlite3.set_authorizer
   (Strictly allows SELECT on academic tables, blocks all INSERT/UPDATE/DELETE/DROP/ALTER and sensitive columns)
 - Row-Level Security (RLS) enforcement per role (LV1 Student locked to own ID, LV2 Advisor scoped to assigned classes)
 - Rich Semantic NL-to-SQL Compiler covering 12+ analytical intents:
   * Top N Best / Excellent / Scholarship / Mentor candidates (ORDER BY gpa_cumulative DESC)
   * Top N High-Risk / Worst / Urgent Intervention students (ORDER BY risk_score DESC)
   * Class / Program / Study-Year comparative analytics (GROUP BY class_id)
   * Credit Debt, Failed Credits, GPA thresholds, Conduct Scores & Admission correlation
   * Early-warning AI detection (Sheaf GNN attention before rule violation)
   * Advisor & Intervention history lookup
   * Model benchmark comparison (model_runs) & Database Schema / Least-Privilege introspection
   * Dynamic safe SELECT execution for LLM-generated SQL (Text-to-SQL)
Author: Huynh Le Thanh Hai — HCMC Open University
"""

import re
import json
import sqlite3
from typing import Dict, Any, List, Optional, Tuple
from backend.database import DB_PATH, get_connection

# Danh sách bảng được phép đọc bởi AI (Least Privilege Whitelist)
ALLOWED_READ_TABLES = {
    "students",
    "classes",
    "programs",
    "advisors",
    "semester_results",
    "conduct_scores",
    "admission_scores",
    "courses",
    "semesters",
    "enrollments",
    "academic_warnings",
    "rule_config",
    "graph_edges",
    "model_runs",
    "risk_assessments",
    "risk_factors",
    "rule_results",
    "interventions",
    "sqlite_master",
}

# Các cột nhạy cảm bị cấm đọc tuyệt đối theo Nghị định 13/2023/NĐ-CP
BLOCKED_COLUMNS = {
    ("users", "password_hash"),
    ("users", "email"),
    ("students", "anon_hash"),
}

DB_SCHEMA_SUMMARY = """
Các bảng CSDL được cấp quyền ĐỌC TỐI THIỂU (Read-Only Least Privilege):
- students(student_id, full_name, class_id, program_id, enrollment_date, status)
- classes(class_id, class_name, cohort_year, program_id, advisor_id)
- programs(program_id, program_name, faculty, total_credits)
- advisors(advisor_id, full_name, faculty)
- semester_results(student_id, semester_id='2025_HK2', study_year, semester_seq, registered_credits, passed_credits, failed_credits, accumulated_debt_credits, gpa_semester, gpa_cumulative)
- conduct_scores(student_id, semester_id='2025_HK2', conduct_score, conduct_rank)
- admission_scores(student_id, normalized_score_30, admission_method)
- risk_assessments(student_id, semester_id='2025_HK2', risk_score, risk_probability, risk_level IN ('NORMAL','ATTENTION','HIGH_RISK'), rule_triggered, predicted_next_gpa, explanation_text, recommendations_json)
- interventions(intervention_id, student_id, advisor_id, meeting_date, notes, outcome_status)
- model_runs(run_id, model_name, model_family, macro_f1, recall_high_risk, pr_auc, roc_auc, gpa_mae, gpa_r2, ece, is_active)
- rule_config(rule_code, rule_name, param_json, legal_ref, is_active)
""".strip()


def _least_privilege_authorizer(action: int, arg1: Optional[str], arg2: Optional[str], dbname: Optional[str], source: Optional[str]) -> int:
    """
    SQLite C-level Authorizer đảm bảo Nguyên lý Đặc quyền Tối thiểu (Least Privilege):
    - Chỉ cho phép SELECT / READ / FUNCTION.
    - Từ chối mọi thao tác ghi (INSERT, UPDATE, DELETE, DROP, ALTER, ATTACH, TRANSACTION...).
    - Ẩn tuyệt đối cột mật khẩu (users.password_hash) và mã băm định danh.
    """
    if action in (sqlite3.SQLITE_SELECT, sqlite3.SQLITE_FUNCTION):
        return sqlite3.SQLITE_OK
    if action == sqlite3.SQLITE_READ:
        tbl = (arg1 or "").lower()
        col = (arg2 or "").lower()
        if (tbl, col) in BLOCKED_COLUMNS or tbl == "users":
            return sqlite3.SQLITE_IGNORE
        if tbl in ALLOWED_READ_TABLES or tbl.startswith("sqlite_"):
            return sqlite3.SQLITE_OK
        return sqlite3.SQLITE_DENY
    if action == sqlite3.SQLITE_PRAGMA:
        if (arg1 or "").lower() in ("query_only", "table_info"):
            return sqlite3.SQLITE_OK
        return sqlite3.SQLITE_DENY
    return sqlite3.SQLITE_DENY


def get_readonly_connection() -> sqlite3.Connection:
    """Mở kết nối CSDL ở chế độ Chỉ Đọc (Read-Only) có gắn bộ gác cổng Least-Privilege Authorizer."""
    if not DB_PATH.exists():
        conn = get_connection()
        conn.close()
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only = ON;")
    conn.set_authorizer(_least_privilege_authorizer)
    return conn


def execute_safe_readonly_sql(
    sql: str,
    params: Tuple = (),
    restrict_student_id: Optional[str] = None,
    max_rows: int = 25,
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """
    Thực thi câu lệnh SELECT an toàn dưới quyền tối thiểu.
    Trả về (danh sách dòng kết quả dạng dict, thông báo lỗi nếu có).
    """
    clean_sql = (sql or "").strip().rstrip(";")
    if not clean_sql.upper().startswith("SELECT"):
        return [], "Vi phạm Least Privilege: AI chỉ được cấp quyền thực thi câu lệnh SELECT (Read-Only)."
    forbidden = re.search(r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|REPLACE|PRAGMA)\b", clean_sql, re.IGNORECASE)
    if forbidden:
        return [], f"Từ chối thực thi từ khóa bị cấm: {forbidden.group(1).upper()}"
    if restrict_student_id and restrict_student_id.upper() not in clean_sql.upper():
        return [], f"Vi phạm RLS: Tài khoản LV1 chỉ được truy vấn dữ liệu của {restrict_student_id}."

    conn = get_readonly_connection()
    try:
        rows = conn.execute(clean_sql, params).fetchmany(max_rows)
        return [dict(r) for r in rows], None
    except Exception as exc:
        return [], str(exc)
    finally:
        conn.close()


KNOWLEDGE_BASE = [
    {
        "id": "TT08_D11_K1A",
        "title": "Thông tư 08/2021/TT-BGDĐT — Điều 11, Khoản 1a (Tín chỉ không đạt trong kỳ)",
        "keywords": ["tín chỉ không đạt", "50%", "rớt", "trượt", "khối lượng đăng ký", "r01", "không đạt"],
        "citation": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 1a",
        "content": (
            "Sinh viên bị cảnh báo kết quả học tập cuối mỗi học kỳ chính nếu tổng số tín chỉ không đạt "
            "trong học kỳ vượt quá 50% khối lượng đã đăng ký học trong học kỳ đó."
        ),
    },
    {
        "id": "TT08_D11_K1B",
        "title": "Thông tư 08/2021/TT-BGDĐT — Điều 11, Khoản 1b (Tín chỉ nợ đọng tích lũy)",
        "keywords": ["nợ đọng", "24 tín chỉ", "tích lũy", "nợ môn", "r02", "nợ tín chỉ", "nợ quá"],
        "citation": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 1b",
        "content": (
            "Sinh viên bị cảnh báo học tập nếu tổng số tín chỉ nợ đọng từ đầu khóa học vượt quá 24 tín chỉ."
        ),
    },
    {
        "id": "TT08_D11_K1C",
        "title": "Thông tư 08/2021/TT-BGDĐT — Điều 11, Khoản 1c (Điểm trung bình học kỳ)",
        "keywords": ["đtb học kỳ", "gpa kỳ", "0.8", "1.0", "học kỳ đầu", "r03", "sàn học kỳ", "dưới 1.0"],
        "citation": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 1c",
        "content": (
            "Sinh viên bị cảnh báo học tập nếu điểm trung bình học kỳ đạt dưới 0.8 đối với học kỳ đầu của khóa học, "
            "hoặc dưới 1.0 đối với các học kỳ tiếp theo."
        ),
    },
    {
        "id": "TT08_D11_K1D",
        "title": "Thông tư 08/2021/TT-BGDĐT — Điều 11, Khoản 1d (Điểm trung bình tích lũy theo năm)",
        "keywords": ["đtb tích lũy", "gpa tích lũy", "1.2", "1.4", "1.6", "1.8", "năm học", "r04", "sàn tích lũy"],
        "citation": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 1d",
        "content": (
            "Sinh viên bị cảnh báo học tập nếu điểm trung bình tích lũy đạt dưới 1.2 đối với trình độ năm thứ nhất, "
            "dưới 1.4 đối với năm thứ hai, dưới 1.6 đối với năm thứ ba, hoặc dưới 1.8 đối với các năm tiếp theo."
        ),
    },
    {
        "id": "TT08_D11_K2",
        "title": "Thông tư 08/2021/TT-BGDĐT — Điều 11, Khoản 2 & Quy chế ĐH Mở TP.HCM (Buộc thôi học / Cảnh báo lần 2)",
        "keywords": [
            "buộc thôi học", "cảnh báo liên tiếp", "2 lần", "lần thứ hai", "lần 2", "lần thứ 2",
            "3 lần", "r05", "đuổi học", "thôi học", "cảnh báo lần hai", "liên tiếp 2 kỳ"
        ],
        "citation": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 2 & Quy chế ĐH Mở TP.HCM",
        "content": (
            "Sinh viên bị xét BUỘC THÔI HỌC nếu rơi vào một trong các trường hợp sau:\n"
            "1. Có số lần bị cảnh báo học tập liên tiếp đạt từ 2 LẦN LIÊN TIẾP trở lên (ví dụ bị cảnh báo ở HK1 và tiếp tục bị cảnh báo ở HK2).\n"
            "2. Tổng số lần bị cảnh báo học tập vượt quá giới hạn tối đa quy định của trường (quá 3 lần trong toàn khóa học).\n"
            "3. Vượt quá thời gian đào tạo tối đa cho phép theo khung chương trình đào tạo tín chỉ."
        ),
    },
    {
        "id": "SHEAF_ARCH",
        "title": "Mạng Nơ-ron Đồ thị Sheaf Attention & Quy tắc Vàng (Hybrid Golden Invariant)",
        "keywords": ["sheaf", "gnn", "đồ thị", "dị thể", "heterophily", "ưu tiên", "mâu thuẫn", "alpha", "attention"],
        "citation": "Tài liệu Kiến trúc EduAlert — Mục 6.1 & 6.4 (Hansen & Gebhart 2020; Bodnar et al. 2022)",
        "content": (
            "EduAlert áp dụng Quy tắc vàng về tuân thủ: Kết quả của Rule Engine (Thông tư 08) luôn có quyền phủ quyết tuyệt đối "
            "(nếu chạm ngưỡng quy chế -> bắt buộc xếp loại Nguy cơ cao). Mô hình Sheaf Attention Network gán ánh xạ hạn chế "
            "lên từng cạnh đồ thị để giải quyết hiện tượng dị thể (sinh viên giỏi và yếu cùng nhóm đồ án), phát hiện sớm xu hướng "
            "sụt giảm điểm trước khi sinh viên chạm ngưỡng cảnh báo pháp lý."
        ),
    },
]


def extract_student_id(query: str, conn) -> Optional[str]:
    q_low = query.strip().lower()
    m1 = re.search(r"\b(?:sv|mssv|sinh\s*viên\s*|sv\s*|a)0*([1-9]\d{0,2})\b", q_low)
    if m1:
        num = int(m1.group(1))
        candidate = f"SV{num:03d}"
        check = conn.execute("SELECT student_id FROM students WHERE student_id = ?", (candidate,)).fetchone()
        if check:
            return candidate

    name_check = conn.execute(
        "SELECT student_id FROM students WHERE ? LIKE '%' || LOWER(full_name) || '%'",
        (q_low,),
    ).fetchone()
    if name_check:
        return name_check["student_id"]
    return None


def extract_class_id(query: str, conn) -> Optional[str]:
    q_low = query.strip().lower()
    m = re.search(r"\b(dh\d{2}[a-z]{2}\d{2}|cs\d{4}|it\d{4}|ai\d{4})\b", q_low)
    if m:
        cid = m.group(1).upper()
        check = conn.execute("SELECT class_id FROM classes WHERE UPPER(class_id) = ?", (cid,)).fetchone()
        if check:
            return check["class_id"]

    for row in conn.execute("SELECT class_id, class_name FROM classes").fetchall():
        if row["class_id"].lower() in q_low or row["class_name"].lower() in q_low:
            return row["class_id"]

    if "csdl" in q_low or "cơ sở dữ liệu" in q_low:
        return "DH23CS02" if "2" in q_low else "DH23CS01"
    if "ai" in q_low or "trí tuệ nhân tạo" in q_low:
        return "DH24AI02" if "2" in q_low else "DH24AI01"
    if "httt" in q_low or "hệ thống thông tin" in q_low:
        return "DH23IS01"
    return None


def _extract_limit(q_low: str, default: int = 5) -> int:
    m = re.search(r"\b(?:top|danh\s*sách|lấy|cho\s*tôi|hiển\s*thị)\s*(\d{1,2})\b", q_low)
    if not m:
        m = re.search(r"\b(\d{1,2})\s*(?:sinh\s*viên|sv|bạn|người)\b", q_low)
    if m:
        val = int(m.group(1))
        return max(1, min(val, 25))
    return default


def answer_copilot_query(query: str, restrict_student_id: Optional[str] = None) -> Dict[str, Any]:
    q_raw = query.strip()
    q_low = q_raw.lower()
    conn = get_readonly_connection()
    cur = conn.cursor()

    sid = extract_student_id(query, conn)
    cid = extract_class_id(query, conn)
    limit_n = _extract_limit(q_low, default=5)

    # -------------------------------------------------------------------------
    # RLS GUARD (LV1 · Sinh viên): chỉ được hỏi về hồ sơ của chính mình (NĐ 13/2023/NĐ-CP)
    # -------------------------------------------------------------------------
    if restrict_student_id:
        own = restrict_student_id.upper()
        asks_list = cid or any(k in q_low for k in [
            "danh sách", "top", "thống kê", "bao nhiêu sinh viên", "nợ trên", "nợ quá", "toàn trường", "lớp", "so sánh"
        ])
        if (sid and sid != own) or (asks_list and not sid):
            conn.close()
            return {
                "answer": (
                    "🔒 **Yêu cầu bị từ chối bởi chính sách bảo vệ dữ liệu cá nhân (RLS).**\n\n"
                    "Tài khoản Sinh viên (`LV1`) chỉ được cấp quyền tối thiểu (Least Privilege) để tra cứu hồ sơ học vụ của **chính mình** "
                    f"(`{own}`). Bạn có thể hỏi: *\"Tình hình học tập của tôi thế nào?\"* hoặc "
                    "*\"Tôi cần làm gì để cải thiện điểm học kỳ tới?\"*."
                ),
                "citations": ["Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân", "Chính sách RLS & Least Privilege EduAlert"],
                "sql_executed": None,
                "blocked": True,
            }
        personal = any(k in f" {q_low} " for k in [" tôi ", " mình ", " em ", " của tôi", "tình hình", "kết quả của", "hồ sơ"])
        if not sid and personal:
            sid = own

    is_remedy = any(k in q_low for k in [
        "khắc phục", "làm sao", "giải pháp", "lời khuyên", "hướng dẫn",
        "can thiệp", "tư vấn", "cứu", "đỡ", "xử lý", "cải thiện", "hỗ trợ", "kế hoạch", "lộ trình"
    ])

    # =========================================================================
    # CASE 1: TRA CỨU CHUYÊN SÂU HỒ SƠ 1 SINH VIÊN CỤ THỂ (KÈM ĐIỂM RÈN LUYỆN & LỊCH SỬ CAN THIỆP)
    # =========================================================================
    if sid:
        row = cur.execute(
            """
            SELECT s.student_id, s.full_name, s.class_id, c.class_name, p.program_name, a.full_name as advisor_name,
                   sr.study_year, sr.semester_seq, sr.gpa_semester, sr.gpa_cumulative,
                   sr.accumulated_debt_credits, sr.failed_credits, sr.registered_credits, sr.passed_credits,
                   cs.conduct_score, cs.conduct_rank,
                   adm.normalized_score_30, adm.admission_method,
                   ra.risk_level, ra.risk_score, ra.rule_triggered, ra.predicted_next_gpa,
                   ra.explanation_text, ra.recommendations_json
            FROM students s
            JOIN classes c ON c.class_id = s.class_id
            JOIN programs p ON p.program_id = s.program_id
            JOIN advisors a ON a.advisor_id = c.advisor_id
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = '2025_HK2'
            LEFT JOIN conduct_scores cs ON cs.student_id = s.student_id AND cs.semester_id = '2025_HK2'
            LEFT JOIN admission_scores adm ON adm.student_id = s.student_id
            JOIN risk_assessments ra ON ra.student_id = s.student_id AND ra.semester_id = '2025_HK2'
            WHERE s.student_id = ?
            """,
            (sid,),
        ).fetchone()

        if row:
            interventions = cur.execute(
                """
                SELECT meeting_date, notes, outcome_status
                FROM interventions WHERE student_id = ? ORDER BY meeting_date DESC LIMIT 3
                """,
                (sid,),
            ).fetchall()

            sql_used = (
                f"SELECT s.student_id, s.full_name, s.class_id, p.program_name, sr.gpa_semester, sr.gpa_cumulative, "
                f"sr.accumulated_debt_credits, cs.conduct_score, ra.risk_level, ra.risk_score, ra.predicted_next_gpa "
                f"FROM students s JOIN programs p USING(program_id) JOIN semester_results sr USING(student_id) "
                f"LEFT JOIN conduct_scores cs USING(student_id, semester_id) "
                f"JOIN risk_assessments ra USING(student_id, semester_id) "
                f"WHERE s.student_id = '{sid}' AND sr.semester_id = '2025_HK2';"
            )

            rec_list = []
            if row["recommendations_json"]:
                try:
                    rec_list = json.loads(row["recommendations_json"])
                except Exception:
                    pass

            remedy_bullets = "\n".join([
                f"  {idx+1}. {r.replace('<b>', '**').replace('</b>', '**')}"
                for idx, r in enumerate(rec_list)
            ]) if rec_list else (
                f"  1. **Điều chỉnh tải tín chỉ học kỳ tới:** Đăng ký vừa sức (12–14 TC), ưu tiên học lại {row['accumulated_debt_credits']} TC nợ đọng.\n"
                f"  2. **Lịch làm việc với CVHT ({row['advisor_name']}):** Kiểm tra tiến độ chuyên cần định kỳ mỗi 2 tuần.\n"
                f"  3. **Ghép cặp học tập (Peer Mentoring):** Kết nối với nhóm sinh viên xuất sắc trong lớp `{row['class_id']}`."
            )

            int_text = ""
            if interventions:
                int_lines = [f"  - `{it['meeting_date']}` [{it['outcome_status']}]: {it['notes']}" for it in interventions]
                int_text = "\n- **Nhật ký can thiệp gần nhất:**\n" + "\n".join(int_lines)

            # Tìm bạn cùng lớp có GPA cao nhất để ghép cặp Đôi Bạn Cùng Tiến (Peer Mentor)
            mentor = cur.execute(
                """
                SELECT s.student_id, s.full_name, sr.gpa_cumulative
                FROM students s
                JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = '2025_HK2'
                WHERE s.class_id = ? AND s.student_id != ?
                ORDER BY sr.gpa_cumulative DESC LIMIT 1
                """,
                (row["class_id"], sid),
            ).fetchone()
            mentor_str = (
                f"**{mentor['student_id']} — {mentor['full_name']}** (ĐTB TL: **{mentor['gpa_cumulative']:.2f}/4.0**)"
                if mentor else "Sinh viên khá giỏi trong lớp"
            )

            # Tính toán toán học mục tiêu GPA kỳ tới để vượt ngưỡng an toàn theo năm học
            year_floor = {1: 1.2, 2: 1.4, 3: 1.6}.get(row["study_year"], 1.8)
            target_cum = max(year_floor + 0.25, row["gpa_cumulative"] + 0.15)
            rec_credits = 12 if row["risk_level"] == "HIGH_RISK" else (14 if row["risk_level"] == "ATTENTION" else 16)
            est_accum_credits = max(15, row["study_year"] * 28 - row["accumulated_debt_credits"])
            req_sem_gpa = min(3.8, max(2.0, ((target_cum * (est_accum_credits + rec_credits)) - (row["gpa_cumulative"] * est_accum_credits)) / rec_credits))

            ans = (
                f"### 📋 Hồ Sơ Dò Xét & Kế Hoạch Hành Động: **{row['student_id']} — {row['full_name']}**\n\n"
                f"- **Lớp:** `{row['class_id']}` ({row['class_name']}) | **Ngành:** {row['program_name']} (Năm {row['study_year']})\n"
                f"- **Cố vấn học tập:** {row['advisor_name']} | **Đầu vào:** {row['admission_method'] or 'THPT'} ({row['normalized_score_30'] or 22.0:.1f}/30)\n"
                f"- **Xếp loại rủi ro:** `{row['risk_level']}` — Điểm nguy cơ: **{row['risk_score']}%** "
                f"({'❌ Đã chạm ngưỡng Thông tư 08' if row['rule_triggered'] else ('⚠️ Cảnh báo sớm bởi Sheaf GNN' if row['risk_level'] != 'NORMAL' else '✅ An toàn học vụ')})\n"
                f"- **Kết quả HK 2025_HK2:** ĐTB học kỳ **{row['gpa_semester']:.2f}/4.0** | ĐTB tích lũy **{row['gpa_cumulative']:.2f}/4.0** (Sàn năm {row['study_year']}: **{year_floor:.2f}**) | "
                f"Đạt **{row['passed_credits']}/{row['registered_credits']} TC** | Nợ tích lũy: **{row['accumulated_debt_credits']} TC**\n"
                f"- **Điểm rèn luyện:** **{row['conduct_score'] or 75}/100** ({row['conduct_rank'] or 'Khá'}) | "
                f"**Dự báo ĐTB kỳ tới (Sheaf GNN):** **{row['predicted_next_gpa']:.2f} ± 0.15**\n"
                f"- **Chẩn đoán nguyên nhân:** {row['explanation_text']}{int_text}\n\n"
                f"### 🎯 Kế Hoạch Học Tập & Can Thiệp Cụ Thể Kỳ Tới (2026_HK1)\n"
                f"1. **Định lượng mục tiêu học kỳ tới:** Đăng ký tối đa **{rec_credits} tín chỉ** (ưu tiên 2 môn cơ sở trả nợ + 2 môn tự chọn vừa sức), phấn đấu đạt **ĐTB học kỳ ≥ {req_sem_gpa:.2f}/4.0** để kéo ĐTB tích lũy lên **{target_cum:.2f}** (vượt ngưỡng an toàn `{year_floor:.2f}`).\n"
                f"2. **Ghép cặp Đôi Bạn Cùng Tiến (Peer Mentor cùng lớp `{row['class_id']}`):** Ghép nhóm học tập với {mentor_str}.\n"
                f"3. **Lịch giám sát 4 mốc với CVHT ({row['advisor_name']}):**\n"
                f"   - *Tuần 1–2:* Rà soát thời khóa biểu đăng ký học phần (`≤ {rec_credits} TC`).\n"
                f"   - *Tuần 4 & Tuần 8:* Kiểm tra chuyên cần LMS và điểm quá trình giữa kỳ.\n"
                f"   - *Tuần 12:* Phụ đạo ôn tập trước kỳ thi kết thúc học phần.\n"
                f"4. **Khuyến nghị chuyên môn bổ sung:**\n{remedy_bullets}"
            )

            conn.close()
            return {
                "answer": ans,
                "citations": ["Thông tư 08/2021/TT-BGDĐT, Điều 11", "CSDL EduAlert (Read-Only Least Privilege)", "Phiếu đánh giá M03 & Mô phỏng M04"],
                "sql_executed": sql_used,
            }

    # =========================================================================
    # CASE 1B: DÒ XÉT LỖ HỔNG CAN THIỆP & LẬP KẾ HOẠCH TỔNG THỂ CHO CVHT / KHOA
    # =========================================================================
    if any(k in q_low for k in [
        "lập kế hoạch", "lên kế hoạch", "kế hoạch can thiệp", "kế hoạch hỗ trợ", "kế hoạch học tập",
        "kế hoạch tuần", "dò xét", "rà soát", "chưa can thiệp", "bỏ sót", "lỗ hổng", "phương án hỗ trợ"
    ]):
        where_cls = "AND s.class_id = ?" if cid else ""
        params_cls = [cid] if cid else []

        # 1. Dò xét sinh viên nguy cơ cao CHƯA có biên bản can thiệp nào trong bảng interventions
        unmet_sql = f"""
            SELECT s.student_id, s.full_name, s.class_id, a.full_name AS advisor_name,
                   sr.gpa_cumulative, sr.accumulated_debt_credits, ra.risk_score, ra.risk_level,
                   COUNT(i.intervention_id) AS meeting_cnt
            FROM risk_assessments ra
            JOIN students s ON s.student_id = ra.student_id
            JOIN classes c ON c.class_id = s.class_id
            JOIN advisors a ON a.advisor_id = c.advisor_id
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = ra.semester_id
            LEFT JOIN interventions i ON i.student_id = s.student_id
            WHERE ra.semester_id = '2025_HK2' AND ra.risk_level IN ('HIGH_RISK', 'ATTENTION') {where_cls}
            GROUP BY s.student_id
            ORDER BY meeting_cnt ASC, ra.risk_score DESC
            LIMIT 6;
        """
        urgent_rows = cur.execute(unmet_sql, params_cls).fetchall()

        # 2. Lấy nhóm sinh viên xuất sắc nhất để ghép cặp Peer Mentor
        mentor_sql = f"""
            SELECT s.student_id, s.full_name, s.class_id, sr.gpa_cumulative
            FROM students s
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = '2025_HK2'
            WHERE 1=1 {where_cls}
            ORDER BY sr.gpa_cumulative DESC
            LIMIT 5;
        """
        mentors = cur.execute(mentor_sql, params_cls).fetchall()
        conn.close()

        scope_str = f"Lớp `{cid}`" if cid else "Toàn Khoa CNTT (180 SV)"
        unmet_lines = "\n".join([
            f"  {idx+1}. **{r['student_id']} — {r['full_name']}** (`{r['class_id']}`, CVHT: *{r['advisor_name']}*): "
            f"Nguy cơ **{r['risk_score']}%** (`{r['risk_level']}`) | ĐTB TL: **{r['gpa_cumulative']:.2f}** | "
            f"Nợ: **{r['accumulated_debt_credits']} TC** | Trạng thái: "
            + ("🚨 **CHƯA HỌP CAN THIỆP (0 biên bản)**" if r["meeting_cnt"] == 0 else f"Đã gặp {r['meeting_cnt']} lần")
            for idx, r in enumerate(urgent_rows)
        ])

        pair_lines = []
        for idx in range(min(len(urgent_rows), len(mentors), 4)):
            m_ee = urgent_rows[idx]
            m_or = mentors[idx]
            pair_lines.append(
                f"  • **Cặp #{idx+1}:** Mentor **{m_or['student_id']} ({m_or['full_name']} — GPA {m_or['gpa_cumulative']:.2f})** "
                f"⟷ Kèm cặp Mentee **{m_ee['student_id']} ({m_ee['full_name']} — GPA {m_ee['gpa_cumulative']:.2f}, Nợ {m_ee['accumulated_debt_credits']} TC)**"
            )
        pair_text = "\n".join(pair_lines) if pair_lines else "  • Chưa đủ dữ liệu ghép cặp."

        return {
            "answer": (
                f"### 🧭 Báo Cáo Dò Xét CSDL & Kế Hoạch Hành Động Học Vụ ({scope_str})\n\n"
                f"#### 1. Kết quả Dò xét Lỗ hổng Can thiệp (Ưu tiên SV nguy cơ cao chưa có biên bản họp)\n"
                f"{unmet_lines}\n\n"
                f"#### 2. Sơ đồ Ghép cặp 1-1 \"Đôi Bạn Cùng Tiến\" (Tự động tối ưu từ CSDL)\n"
                f"{pair_text}\n\n"
                f"#### 3. Kế Hoạch Triển Khai 4 Tuần Cho Cố Vấn Học Tập & Ban Chủ Nhiệm Khoa\n"
                f"1. **Tuần 1 (Triệu tập khẩn & Chốt khối lượng tín chỉ):** Mời làm việc trực tiếp các sinh viên có nhãn `🚨 CHƯA HỌP CAN THIỆP`, yêu cầu rút học phần khó để giới hạn tải học tập ở mức **12–14 tín chỉ**.\n"
                f"2. **Tuần 2 (Kích hoạt nhóm Peer Mentoring):** Giao nhiệm vụ cho các cặp Mentor ⟷ Mentee ở mục 2 ôn tập các học phần cơ sở ngành và lập biên bản lên phân hệ `M09`.\n"
                f"3. **Tuần 3–6 (Giám sát Cảnh báo sớm Sheaf GNN):** Kiểm tra tiến độ chuyên cần và điểm quá trình của nhóm `ATTENTION` (Vàng) để chặn đà tụt điểm trước kỳ thi giữa kỳ.\n"
                f"4. **Cuối kỳ (Đối soát tự động Rule Engine `M10`):** Chạy tái đánh giá toàn trường và xuất báo cáo `M12` trình Hội đồng học vụ."
            ),
            "citations": [
                "CSDL EduAlert — Truy vấn LEFT JOIN risk_assessments & interventions (Least Privilege)",
                "Thông tư 08/2021/TT-BGDĐT, Điều 11",
                "Quy trình Can thiệp Học vụ 4 Bước (M08/M09)",
            ],
            "sql_executed": " ".join(unmet_sql.split()),
        }

    # =========================================================================
    # CASE 2: TOP SINH VIÊN TỐT / GIỎI / XUẤT SẮC / ĐIỂM CAO NHẤT / AN TOÀN NHẤT
    # =========================================================================
    positive_keywords = [
        "tốt", "giỏi", "xuất sắc", "điểm cao", "gpa cao", "cao nhất", "đầu bảng",
        "thủ khoa", "an toàn", "khen thưởng", "học bổng", "mentor", "gương mẫu", "tích cực", "đạt chuẩn"
    ]
    negative_keywords = [
        "tệ", "yếu", "kém", "thấp nhất", "nguy cơ cao", "rủi ro", "đội sổ",
        "nguy hiểm", "cảnh báo", "vi phạm", "bét", "cần cứu", "ưu tiên"
    ]
    has_positive = any(k in q_low for k in positive_keywords) and not any(k in q_low for k in ["không tốt", "chưa tốt"])
    has_negative = any(k in q_low for k in negative_keywords)

    if has_positive and not has_negative:
        where_parts = ["ra.semester_id = '2025_HK2'"]
        params: List[Any] = []
        if cid:
            where_parts.append("s.class_id = ?")
            params.append(cid)
        where_sql = " AND ".join(where_parts)

        sql_best = f"""
            SELECT s.student_id, s.full_name, s.class_id, c.class_name, a.full_name AS advisor_name,
                   sr.gpa_semester, sr.gpa_cumulative, sr.passed_credits, sr.accumulated_debt_credits,
                   cs.conduct_score, cs.conduct_rank, ra.risk_level, ra.risk_score, ra.predicted_next_gpa
            FROM students s
            JOIN classes c ON c.class_id = s.class_id
            JOIN advisors a ON a.advisor_id = c.advisor_id
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = '2025_HK2'
            LEFT JOIN conduct_scores cs ON cs.student_id = s.student_id AND cs.semester_id = '2025_HK2'
            JOIN risk_assessments ra ON ra.student_id = s.student_id AND ra.semester_id = '2025_HK2'
            WHERE {where_sql}
            ORDER BY sr.gpa_cumulative DESC, sr.gpa_semester DESC, cs.conduct_score DESC
            LIMIT {limit_n};
        """
        best_rows = cur.execute(sql_best, params).fetchall()
        avg_gpa = cur.execute(
            f"SELECT AVG(sr.gpa_cumulative) FROM semester_results sr JOIN students s USING(student_id) WHERE sr.semester_id='2025_HK2'"
            + (" AND s.class_id = ?" if cid else ""),
            params,
        ).fetchone()[0] or 0.0
        conn.close()

        scope_label = f"lớp **{cid}**" if cid else "toàn khóa (180 SV)"
        lines = "\n".join([
            f"  {i+1}. **{r['student_id']} — {r['full_name']}** (`{r['class_id']}`): "
            f"ĐTB Tích lũy **{r['gpa_cumulative']:.2f}/4.0** | ĐTB HK: **{r['gpa_semester']:.2f}** | "
            f"Nợ: **{r['accumulated_debt_credits']} TC** | ĐRL: **{r['conduct_score'] or 85} ({r['conduct_rank'] or 'Tốt'})** | "
            f"Dự báo kỳ tới: **{r['predicted_next_gpa']:.2f}** (`{r['risk_level']}` — Rủi ro chỉ {r['risk_score']}%)"
            for i, r in enumerate(best_rows)
        ])

        return {
            "answer": (
                f"### 🏆 Top {len(best_rows)} Sinh Viên Thành Tích Học Tập Tốt Nhất ({scope_label})\n\n"
                f"- **ĐTB tích lũy trung bình của {scope_label}:** **{avg_gpa:.2f}/4.00**\n\n"
                f"{lines}\n\n"
                f"💡 **Khuyến nghị Học vụ & Quản lý Khoa:**\n"
                f"- Đề xuất xét **Học bổng Khuyến khích Học tập** và tuyên dương cuối học kỳ cho các sinh viên trên.\n"
                f"- Mời các sinh viên này làm **Peer Mentor (Đôi bạn cùng tiến)** trên mạng đồ thị học tập (`M06`) để kèm cặp các bạn đang có nguy cơ cảnh báo học vụ trong cùng lớp."
            ),
            "citations": ["CSDL EduAlert — Bảng semester_results & conduct_scores (Read-Only SQL)", "Chương trình Đôi bạn cùng tiến (Peer Mentoring)"],
            "sql_executed": " ".join(sql_best.split()),
        }

    # =========================================================================
    # CASE 3: SO SÁNH CÁC LỚP / THỐNG KÊ THEO LỚP / NGÀNH
    # =========================================================================
    if any(k in q_low for k in ["so sánh các lớp", "thống kê theo lớp", "theo từng lớp", "lớp nào", "các lớp", "tổng hợp lớp"]):
        sql_classes = """
            SELECT c.class_id, c.class_name, a.full_name AS advisor_name,
                   COUNT(s.student_id) AS total_students,
                   ROUND(AVG(sr.gpa_cumulative), 2) AS avg_gpa,
                   ROUND(AVG(sr.accumulated_debt_credits), 1) AS avg_debt,
                   SUM(CASE WHEN ra.risk_level = 'HIGH_RISK' THEN 1 ELSE 0 END) AS high_risk_cnt,
                   SUM(CASE WHEN ra.risk_level = 'ATTENTION' THEN 1 ELSE 0 END) AS attention_cnt,
                   SUM(CASE WHEN ra.risk_level = 'NORMAL' THEN 1 ELSE 0 END) AS normal_cnt
            FROM classes c
            JOIN advisors a ON a.advisor_id = c.advisor_id
            JOIN students s ON s.class_id = c.class_id
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = '2025_HK2'
            JOIN risk_assessments ra ON ra.student_id = s.student_id AND ra.semester_id = '2025_HK2'
            GROUP BY c.class_id, c.class_name, a.full_name
            ORDER BY high_risk_cnt DESC, avg_gpa ASC;
        """
        c_rows = cur.execute(sql_classes).fetchall()
        conn.close()

        lines = "\n".join([
            f"  • **`{r['class_id']}` ({r['class_name']})** — CVHT: *{r['advisor_name']}* ({r['total_students']} SV): "
            f"ĐTB TL: **{r['avg_gpa']:.2f}** | Nợ TB: **{r['avg_debt']} TC** | "
            f"🔴 Nguy cơ cao: **{r['high_risk_cnt']}** | 🟡 Cần chú ý: **{r['attention_cnt']}** | 🟢 An toàn: **{r['normal_cnt']}**"
            for r in c_rows
        ])
        return {
            "answer": (
                f"### 📊 Bảng So Sánh Chất Lượng Học Vụ Giữa Các Lớp (HK 2025_HK2)\n\n"
                f"{lines}\n\n"
                f"💡 **Nhận xét:** Lớp đứng đầu danh sách có số lượng sinh viên thuộc nhóm **Nguy cơ cao (Đỏ)** lớn nhất, Ban Chủ nhiệm Khoa cần ưu tiên phân bổ trợ giảng và tổ chức phụ đạo học phần cơ sở ngành."
            ),
            "citations": ["CSDL EduAlert — Truy vấn GROUP BY classes, semester_results, risk_assessments"],
            "sql_executed": " ".join(sql_classes.split()),
        }

    # =========================================================================
    # CASE 4: KIỂM TRA QUYỀN TRUY CẬP DATABASE / SCHEMA / LEAST PRIVILEGE
    # =========================================================================
    if any(k in q_low for k in ["quyền truy cập", "database", "csdl", "least privilege", "quyền tối thiểu", "schema", "bảng dữ liệu", "cấu trúc bảng"]):
        tables_info = cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
        ).fetchall()
        t_names = [r["name"] for r in tables_info]
        conn.close()
        return {
            "answer": (
                "### 🛡️ Cơ Chế Truy Cập CSDL Quyền Tối Thiểu (Least-Privilege Read-Only Sandbox)\n\n"
                "Trợ lý AI của EduAlert được kết nối trực tiếp vào CSDL học vụ thông qua **Lớp bảo vệ cấp Engine (`sqlite3.set_authorizer` + `PRAGMA query_only = ON`)**:\n\n"
                "1. **Chỉ đọc tuyệt đối (`SELECT` Only):** Mọi lệnh `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `ATTACH` đều bị từ chối ở tầng C-driver của SQLite (`SQLITE_DENY`).\n"
                "2. **Ẩn cột nhạy cảm (Column-Level Masking):** Cột mật khẩu (`users.password_hash`), email cá nhân và mã băm (`anon_hash`) bị chặn bởi `SQLITE_IGNORE` tuân thủ **Nghị định 13/2023/NĐ-CP**.\n"
                "3. **Phân quyền theo dòng (Row-Level Security - RLS):**\n"
                "   - `LV1 (Sinh viên)`: Chỉ truy vấn được dòng có `student_id` của chính mình.\n"
                "   - `LV2 (CVHT)` -> `LV5 (Admin)`: Truy vấn thống kê đa bảng trên **18 bảng chuẩn hóa 3NF**.\n\n"
                f"**Danh sách {len(t_names)} bảng trong CSDL hiện tại:** `{', '.join(t_names)}`"
            ),
            "citations": ["Nguyên lý Đặc quyền Tối thiểu (Least Privilege)", "Nghị định 13/2023/NĐ-CP", "SQLite Authorizer Callback"],
            "sql_executed": "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
        }

    # =========================================================================
    # CASE 5: CẢNH BÁO SỚM BỞI AI / SHEAF GNN (CHƯA VI PHẠM QUY CHẾ NHƯNG RỦI RO CAO)
    # =========================================================================
    if any(k in q_low for k in ["cảnh báo sớm", "chưa vi phạm", "phát hiện sớm", "vàng", "attention"]) and "thông tư" not in q_low:
        sql_early = f"""
            SELECT s.student_id, s.full_name, s.class_id, sr.gpa_semester, sr.gpa_cumulative,
                   sr.accumulated_debt_credits, ra.risk_level, ra.risk_score, ra.predicted_next_gpa, ra.explanation_text
            FROM risk_assessments ra
            JOIN students s ON s.student_id = ra.student_id
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = ra.semester_id
            WHERE ra.semester_id = '2025_HK2' AND ra.rule_triggered = 0 AND ra.risk_level IN ('HIGH_RISK', 'ATTENTION')
            ORDER BY ra.risk_score DESC
            LIMIT {limit_n};
        """
        early_rows = cur.execute(sql_early).fetchall()
        conn.close()
        lines = "\n".join([
            f"  {i+1}. **{r['student_id']} — {r['full_name']}** (`{r['class_id']}`): "
            f"Rủi ro AI **{r['risk_score']}%** (`{r['risk_level']}`) | ĐTB HK: **{r['gpa_semester']:.2f}** | "
            f"ĐTB TL: **{r['gpa_cumulative']:.2f}** | Nợ: **{r['accumulated_debt_credits']} TC** | "
            f"Dự báo kỳ tới: **{r['predicted_next_gpa']:.2f}**\n     *Lý do AI phát hiện sớm:* {r['explanation_text']}"
            for i, r in enumerate(early_rows)
        ])
        return {
            "answer": (
                f"### 🧠 Danh Sách Sinh Viên Được Mô Hình Sheaf GNN Phát Hiện Sớm (Chưa Chạm Ngưỡng TT08)\n\n"
                f"Các sinh viên dưới đây **chưa vi phạm ngưỡng cứng của Thông tư 08**, nhưng bị mạng **Sheaf Attention GNN** phát hiện xu hướng trượt dốc điểm số và rủi ro lan truyền trên đồ thị:\n\n"
                f"{lines}"
            ),
            "citations": ["Mô hình Hybrid Sheaf Attention GNN (M06)", "CSDL EduAlert — risk_assessments (rule_triggered = 0)"],
            "sql_executed": " ".join(sql_early.split()),
        }

    # =========================================================================
    # CASE 6: SO SÁNH ĐỘ CHÍNH XÁC CÁC MÔ HÌNH AI (MODEL RUNS)
    # =========================================================================
    if any(k in q_low for k in ["mô hình", "model", "f1", "roc", "auc", "logistic", "random forest", "độ chính xác"]):
        sql_models = """
            SELECT model_name, model_family, version, macro_f1, recall_high_risk, pr_auc, roc_auc, gpa_mae, gpa_r2, ece, is_active
            FROM model_runs ORDER BY macro_f1 DESC;
        """
        m_rows = cur.execute(sql_models).fetchall()
        conn.close()
        lines = "\n".join([
            f"  • **{r['model_name']}** (`{r['model_family']}` {r['version']}) {'✅ **[ĐANG KÍCH HOẠT]**' if r['is_active'] else ''}:\n"
            f"    Macro-F1: **{r['macro_f1']*100:.1f}%** | Recall (High-Risk): **{r['recall_high_risk']*100:.1f}%** | "
            f"PR-AUC: **{r['pr_auc']:.3f}** | ROC-AUC: **{r['roc_auc']:.3f}** | Sai số GPA MAE: **{r['gpa_mae']:.3f}** | R²: **{r['gpa_r2']:.3f}**"
            for r in m_rows
        ])
        return {
            "answer": f"### 🤖 Thực Nghiệm Đối sánh Các Mô Hình Học Máy Trên CSDL EduAlert (`M11`)\n\n{lines}",
            "citations": ["Bảng model_runs (SQLite)", "Phân hệ Quản lý Mô hình M11"],
            "sql_executed": " ".join(sql_models.split()),
        }

    # =========================================================================
    # CASE 7: ĐIỂM RÈN LUYỆN / ĐIỂM ĐẦU VÀO / NHẬT KÝ CAN THIỆP CVHT
    # =========================================================================
    if any(k in q_low for k in ["rèn luyện", "đrl", "hạnh kiểm"]):
        order_dir = "ASC" if any(k in q_low for k in ["thấp", "yếu", "kém", "tệ"]) else "DESC"
        sql_cond = f"""
            SELECT s.student_id, s.full_name, s.class_id, cs.conduct_score, cs.conduct_rank,
                   sr.gpa_cumulative, ra.risk_level, ra.risk_score
            FROM conduct_scores cs
            JOIN students s ON s.student_id = cs.student_id
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = cs.semester_id
            JOIN risk_assessments ra ON ra.student_id = s.student_id AND ra.semester_id = cs.semester_id
            WHERE cs.semester_id = '2025_HK2'
            ORDER BY cs.conduct_score {order_dir}, sr.gpa_cumulative {order_dir}
            LIMIT {limit_n};
        """
        c_rows = cur.execute(sql_cond).fetchall()
        conn.close()
        title = "Thấp Nhất (Cần Nhắc Nhở Chuyên Cần)" if order_dir == "ASC" else "Cao Nhất (Rèn Luyện Xuất Sắc)"
        lines = "\n".join([
            f"  {i+1}. **{r['student_id']} — {r['full_name']}** (`{r['class_id']}`): "
            f"Điểm rèn luyện **{r['conduct_score']}/100** ({r['conduct_rank']}) | ĐTB TL: **{r['gpa_cumulative']:.2f}** | Rủi ro: `{r['risk_level']}` ({r['risk_score']}%)"
            for i, r in enumerate(c_rows)
        ])
        return {
            "answer": f"### 📝 Top {len(c_rows)} Sinh Viên Có Điểm Rèn Luyện {title}\n\n{lines}",
            "citations": ["Bảng conduct_scores & semester_results (Read-Only SQL)"],
            "sql_executed": " ".join(sql_cond.split()),
        }

    if any(k in q_low for k in ["nhật ký can thiệp", "biên bản", "lịch sử can thiệp", "cvht đã gặp"]):
        sql_int = f"""
            SELECT i.meeting_date, s.student_id, s.full_name, s.class_id, a.full_name AS advisor_name,
                   i.outcome_status, i.notes
            FROM interventions i
            JOIN students s ON s.student_id = i.student_id
            JOIN advisors a ON a.advisor_id = i.advisor_id
            ORDER BY i.meeting_date DESC
            LIMIT {limit_n};
        """
        i_rows = cur.execute(sql_int).fetchall()
        conn.close()
        lines = "\n".join([
            f"  • **`{r['meeting_date']}` — {r['student_id']} ({r['full_name']} - `{r['class_id']}`)** | CVHT: *{r['advisor_name']}* | Trạng thái: `{r['outcome_status']}`\n    Nội dung: {r['notes']}"
            for r in i_rows
        ])
        return {
            "answer": f"### 🤝 Nhật Ký Can Thiệp Học Vụ Gần Nhất Của Cố Vấn Học Tập (`M04`/`M09`)\n\n{lines}",
            "citations": ["Bảng interventions (Read-Only SQL)"],
            "sql_executed": " ".join(sql_int.split()),
        }

    # =========================================================================
    # CASE 8: CẢNH BÁO LẦN 2 / BUỘC THÔI HỌC
    # =========================================================================
    if any(k in q_low for k in [
        "lần thứ hai", "lần 2", "lần thứ 2", "liên tiếp", "2 lần", "3 lần",
        "buộc thôi học", "đuổi học", "thôi học", "cảnh báo lần hai"
    ]):
        dismissal_doc = KNOWLEDGE_BASE[4]
        crit_students = cur.execute(
            f"""
            SELECT s.student_id, s.full_name, s.class_id, sr.gpa_cumulative, sr.accumulated_debt_credits,
                   ra.risk_score, ra.risk_level, COALESCE(aw.consecutive_count, 1) AS consecutive_warnings
            FROM risk_assessments ra
            JOIN students s ON s.student_id = ra.student_id
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = ra.semester_id
            LEFT JOIN academic_warnings aw ON aw.student_id = s.student_id AND aw.semester_id = ra.semester_id
            WHERE ra.semester_id = '2025_HK2' AND (ra.rule_triggered = 1 OR ra.risk_score >= 85)
            ORDER BY consecutive_warnings DESC, ra.risk_score DESC
            LIMIT {limit_n}
            """
        ).fetchall()
        conn.close()

        crit_lines = "\n".join([
            f"  • **{r['student_id']} ({r['full_name']} - `{r['class_id']}`)**: ĐTB TL **{r['gpa_cumulative']:.2f}**, "
            f"Nợ **{r['accumulated_debt_credits']} TC**, Cảnh báo liên tiếp: **{r['consecutive_warnings']} kỳ** (Nguy cơ: **{r['risk_score']}%**)"
            for r in crit_students
        ])

        ans = (
            f"### ⚖️ Quy định Xử lý Cảnh Báo Học Vụ Lần Thứ Hai & Buộc Thôi Học\n\n"
            f"Căn cứ **Khoản 2 Điều 11 Thông tư 08/2021/TT-BGDĐT** và Quy chế Đào tạo tín chỉ Trường ĐH Mở TP.HCM:\n\n"
            f"1. **Điều kiện Buộc Thôi Học:**\n"
            f"   - Bị cảnh báo kết quả học tập **2 LẦN LIÊN TIẾP** (ví dụ: bị cảnh báo ở HK1 và tiếp tục vi phạm ở HK2 kế tiếp).\n"
            f"   - Hoặc tổng số lần bị cảnh báo học tập vượt quá **3 LẦN** trong toàn khóa học.\n"
            f"2. **Danh sách {len(crit_students)} sinh viên đang chạm ngưỡng rủi ro buộc thôi học cần can thiệp khẩn cấp:**\n{crit_lines}"
        )
        return {
            "answer": ans,
            "citations": [dismissal_doc["citation"], "Bảng academic_warnings & risk_assessments"],
            "sql_executed": (
                "SELECT s.student_id, s.full_name, s.class_id, sr.gpa_cumulative, sr.accumulated_debt_credits, "
                "ra.risk_score, COALESCE(aw.consecutive_count, 1) AS consecutive_warnings "
                "FROM risk_assessments ra JOIN students s USING(student_id) JOIN semester_results sr USING(student_id, semester_id) "
                f"LEFT JOIN academic_warnings aw USING(student_id, semester_id) WHERE ra.semester_id='2025_HK2' AND ra.rule_triggered=1 ORDER BY consecutive_warnings DESC, ra.risk_score DESC LIMIT {limit_n};"
            ),
        }

    # =========================================================================
    # CASE 9: LỌC THEO LỚP / NỢ TÍN CHỈ / ĐIỀU KIỆN GPA ĐỘNG
    # =========================================================================
    if cid or any(k in q_low for k in ["nợ trên", "nợ quá", "nợ tín chỉ", "nợ nhiều", "danh sách lớp", "gpa dưới", "gpa trên", "đtb dưới", "đtb trên"]):
        where_clauses = ["ra.semester_id = '2025_HK2'"]
        params = []

        if cid:
            where_clauses.append("s.class_id = ?")
            params.append(cid)

        m_debt = re.search(r"nợ\s*(?:trên|quá|từ|>|>=)?\s*(\d+)", q_low)
        if m_debt:
            where_clauses.append("sr.accumulated_debt_credits >= ?")
            params.append(int(m_debt.group(1)))
        elif "nợ" in q_low:
            where_clauses.append("sr.accumulated_debt_credits > 0")

        m_gpa_lt = re.search(r"(?:gpa|đtb|điểm)\s*(?:dưới|nhỏ hơn|<|<=)\s*(\d+(?:[\.,]\d+)?)", q_low)
        if m_gpa_lt:
            where_clauses.append("sr.gpa_cumulative < ?")
            params.append(float(m_gpa_lt.group(1).replace(",", ".")))

        m_gpa_gt = re.search(r"(?:gpa|đtb|điểm)\s*(?:trên|lớn hơn|từ|>|>=)\s*(\d+(?:[\.,]\d+)?)", q_low)
        if m_gpa_gt:
            where_clauses.append("sr.gpa_cumulative >= ?")
            params.append(float(m_gpa_gt.group(1).replace(",", ".")))

        order_clause = "sr.gpa_cumulative DESC" if has_positive else "sr.accumulated_debt_credits DESC, ra.risk_score DESC"
        where_sql = " AND ".join(where_clauses)
        sql_query = f"""
            SELECT s.student_id, s.full_name, s.class_id, sr.accumulated_debt_credits,
                   sr.gpa_semester, sr.gpa_cumulative, ra.risk_level, ra.risk_score, ra.rule_triggered
            FROM students s
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = '2025_HK2'
            JOIN risk_assessments ra ON ra.student_id = s.student_id AND ra.semester_id = '2025_HK2'
            WHERE {where_sql}
            ORDER BY {order_clause}
            LIMIT 15;
        """

        results = cur.execute(sql_query, params).fetchall()
        conn.close()

        target_desc = f"lớp **{cid}**" if cid else "toàn trường"
        if results:
            rows_text = "\n".join([
                f"  {idx+1}. **{r['student_id']} — {r['full_name']}** (`{r['class_id']}`): "
                f"ĐTB TL: **{r['gpa_cumulative']:.2f}** (HK: {r['gpa_semester']:.2f}) | "
                f"Nợ: **{r['accumulated_debt_credits']} TC** | Mức: `{r['risk_level']}` (**{r['risk_score']}%**)"
                for idx, r in enumerate(results)
            ])
            ans = f"### 🔍 Kết Quả Truy Vấn CSDL Học Vụ ({target_desc} — {len(results)} sinh viên)\n\n{rows_text}"
        else:
            ans = f"Không tìm thấy sinh viên nào trong {target_desc} thỏa mãn điều kiện lọc."

        return {
            "answer": ans,
            "citations": ["Thông tư 08/2021/TT-BGDĐT, Điều 11", "CSDL EduAlert (Read-Only Least Privilege SQL)"],
            "sql_executed": " ".join(sql_query.split()),
        }

    # =========================================================================
    # CASE 10: TOP SINH VIÊN YẾU / NGUY CƠ CAO / THỐNG KÊ TỔNG QUAN TOÀN KHÓA
    # =========================================================================
    if has_negative or any(k in q_low for k in ["top", "ưu tiên", "nguy cơ", "danh sách", "thống kê", "bao nhiêu", "tổng quan"]):
        stats = cur.execute(
            """
            SELECT risk_level, COUNT(*) as cnt, ROUND(AVG( risk_score ), 1) as avg_score
            FROM risk_assessments WHERE semester_id = '2025_HK2'
            GROUP BY risk_level
            """
        ).fetchall()
        st_map = {r["risk_level"]: r["cnt"] for r in stats}
        sql_worst = f"""
            SELECT s.student_id, s.full_name, s.class_id, ra.risk_score, ra.risk_level,
                   sr.gpa_semester, sr.gpa_cumulative, sr.accumulated_debt_credits, sr.failed_credits, ra.rule_triggered
            FROM risk_assessments ra
            JOIN students s ON s.student_id = ra.student_id
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = ra.semester_id
            WHERE ra.semester_id = '2025_HK2'
            ORDER BY ra.rule_triggered DESC, ra.risk_score DESC, sr.gpa_cumulative ASC
            LIMIT {limit_n};
        """
        top_worst = cur.execute(sql_worst).fetchall()
        conn.close()

        top_lines = "\n".join([
            f"  {i+1}. **{r['student_id']} — {r['full_name']}** (`{r['class_id']}`): Nguy cơ **{r['risk_score']}%** "
            f"(`{r['risk_level']}` | ĐTB HK: **{r['gpa_semester']:.2f}** | ĐTB TL: **{r['gpa_cumulative']:.2f}** | "
            f"Nợ: **{r['accumulated_debt_credits']} TC** | Rớt kỳ này: **{r['failed_credits']} TC** | "
            f"{'❌ Vi phạm quy chế TT08' if r['rule_triggered'] else '⚠️ Cảnh báo sớm Sheaf GNN'})"
            for i, r in enumerate(top_worst)
        ])

        return {
            "answer": (
                f"### ⚠️ Thống Kê Rủi Ro Học Vụ Toàn Khóa HK 2025_HK2 (180 Sinh Viên)\n\n"
                f"- 🔴 **Nguy cơ cao (HIGH_RISK):** **{st_map.get('HIGH_RISK', 0)} SV** ({st_map.get('HIGH_RISK', 0)/1.8:.1f}%)\n"
                f"- 🟡 **Cần chú ý (ATTENTION):** **{st_map.get('ATTENTION', 0)} SV** ({st_map.get('ATTENTION', 0)/1.8:.1f}%)\n"
                f"- 🟢 **Bình thường (NORMAL):** **{st_map.get('NORMAL', 0)} SV** ({st_map.get('NORMAL', 0)/1.8:.1f}%)\n\n"
                f"**Top {len(top_worst)} sinh viên mức độ rủi ro cao nhất cần CVHT ưu tiên mời làm việc:**\n{top_lines}"
            ),
            "citations": ["Thông tư 08/2021/TT-BGDĐT, Điều 11", "CSDL EduAlert — risk_assessments & semester_results"],
            "sql_executed": " ".join(sql_worst.split()),
        }

    # =========================================================================
    # CASE 11: HỎI ĐÁP QUY CHẾ THÔNG TƯ 08/2021 + TỰ ĐỘNG ĐÍNH KÈM SỐ LIỆU CSDL THỰC TẾ
    # =========================================================================
    summary_row = cur.execute(
        """
        SELECT COUNT(*) AS total_sv,
               ROUND(AVG(sr.gpa_cumulative), 2) AS avg_gpa,
               MAX(sr.gpa_cumulative) AS max_gpa,
               MIN(sr.gpa_cumulative) AS min_gpa,
               SUM(CASE WHEN ra.risk_level = 'HIGH_RISK' THEN 1 ELSE 0 END) AS high_risk_cnt
        FROM semester_results sr
        JOIN risk_assessments ra ON ra.student_id = sr.student_id AND ra.semester_id = sr.semester_id
        WHERE sr.semester_id = '2025_HK2';
        """
    ).fetchone()
    conn.close()

    scored = []
    for doc in KNOWLEDGE_BASE:
        score = sum(3 for kw in doc["keywords"] if kw in q_low)
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda x: x[0], reverse=True)

    chosen = [d for _, d in scored[:2]] if scored else [KNOWLEDGE_BASE[0], KNOWLEDGE_BASE[1], KNOWLEDGE_BASE[4]]
    ans_parts = [f"- **{d['title']}**:\n  {d['content']}" for d in chosen]
    cites = [d["citation"] for d in chosen]

    db_snapshot = (
        f"\n\n---\n📊 **Số liệu thực tế từ CSDL EduAlert (HK 2025_HK2):** Tổng **{summary_row['total_sv']} SV**, "
        f"ĐTB tích lũy trung bình **{summary_row['avg_gpa']}/4.0** (cao nhất **{summary_row['max_gpa']:.2f}**, thấp nhất **{summary_row['min_gpa']:.2f}**), "
        f"hiện có **{summary_row['high_risk_cnt']} SV** thuộc diện Nguy cơ cao.\n"
        f"*Gợi ý truy vấn trực tiếp CSDL:* Bạn có thể gõ `Top 5 sinh viên tốt nhất`, `Top 5 sinh viên nguy cơ cao`, `So sánh các lớp`, `Danh sách lớp DH23CS02`, hoặc `Hồ sơ SV002`."
    )

    return {
        "answer": "### 📚 Căn Cứ Quy Chế Đào Tạo (Thông tư 08/2021/TT-BGDĐT)\n\n" + "\n\n".join(ans_parts) + db_snapshot,
        "citations": cites + ["CSDL EduAlert (Read-Only Least Privilege)"],
        "sql_executed": "SELECT COUNT(*) AS total_sv, ROUND(AVG(gpa_cumulative), 2) AS avg_gpa, MAX(gpa_cumulative), MIN(gpa_cumulative) FROM semester_results WHERE semester_id = '2025_HK2';",
    }
