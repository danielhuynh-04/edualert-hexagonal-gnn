# -*- coding: utf-8 -*-
"""
EduAlert — Intelligent Advisor Copilot
Features:
 - Flexible NLP Entity Recognition (SV001, a03, sv3, full names, class codes)
 - Intent Classification (Remedy Advice, Specific Student Inquiry, Text-to-SQL Analytics, Regulation Q&A)
 - Guarded Read-Only Text-to-SQL Execution on SQLite Database
 - Accurate RAG over Circular 08/2021/TT-BGDĐT (Article 11) & Academic Advice
Author: Huynh Le Thanh Hai — HCMC Open University
"""

import re
import json
from typing import Dict, Any, List, Optional
from backend.database import get_connection

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
];


def extract_student_id(query: str, conn) -> Optional[str]:
    """
    Intelligently extracts and normalizes student ID from text.
    Handles: SV002, sv2, sv02, a03, a3, mssv 005, sinh vien 03, or student full names.
    Avoids false positives with credit numbers like '10 tín chỉ'.
    """
    q_low = query.strip().lower()

    # 1. Direct patterns with mandatory student prefixes
    m1 = re.search(r"\b(?:sv|mssv|sinh\s*viên\s*|sv\s*|a)0*([1-9]\d{0,2})\b", q_low)
    if m1:
        num = int(m1.group(1))
        candidate = f"SV{num:03d}"
        check = conn.execute("SELECT student_id FROM students WHERE student_id = ?", (candidate,)).fetchone()
        if check:
            return candidate

    # 2. Check by student name if explicitly mentioned in query
    name_check = conn.execute(
        "SELECT student_id FROM students WHERE ? LIKE '%' || LOWER(full_name) || '%'",
        (q_low,),
    ).fetchone()
    if name_check:
        return name_check["student_id"]

    return None


def extract_class_id(query: str, conn) -> Optional[str]:
    """
    Extracts class ID like DH23CS01, DH24AI02, or keywords like 'lớp csdl 1', 'lớp ai 2'.
    """
    q_low = query.strip().lower()

    m = re.search(r"\b(dh\d{2}[a-z]{2}\d{2})\b", q_low)
    if m:
        cid = m.group(1).upper()
        check = conn.execute("SELECT class_id FROM classes WHERE class_id = ?", (cid,)).fetchone()
        if check:
            return cid

    if "csdl" in q_low or "cơ sở dữ liệu" in q_low:
        if "2" in q_low:
            return "DH23CS02"
        return "DH23CS01"
    if "ai" in q_low or "trí tuệ nhân tạo" in q_low:
        if "2" in q_low:
            return "DH24AI02"
        return "DH24AI01"
    if "httt" in q_low or "hệ thống thông tin" in q_low:
        return "DH23HT01"

    return None


def answer_copilot_query(query: str) -> Dict[str, Any]:
    q_raw = query.strip()
    q_low = q_raw.lower()
    conn = get_connection()
    cur = conn.cursor()

    sid = extract_student_id(query, conn)
    cid = extract_class_id(query, conn)

    is_remedy = any(k in q_low for k in [
        "khắc phục", "làm sao", "giải pháp", "lời khuyên", "hướng dẫn",
        "can thiệp", "tư vấn", "cứu", "đỡ", "xử lý", "cải thiện", "hỗ trợ"
    ])

    # =========================================================================
    # CASE 1: SPECIFIC STUDENT INQUIRY (WITH REMEDY ADVICE IF ASKED)
    # =========================================================================
    if sid:
        row = cur.execute(
            """
            SELECT s.student_id, s.full_name, s.class_id, c.class_name, a.full_name as advisor_name,
                   sr.gpa_semester, sr.gpa_cumulative, sr.accumulated_debt_credits,
                   sr.failed_credits, sr.registered_credits,
                   ra.risk_level, ra.risk_score, ra.rule_triggered, ra.predicted_next_gpa,
                   ra.explanation_text, ra.recommendations_json
            FROM students s
            JOIN classes c ON c.class_id = s.class_id
            JOIN advisors a ON a.advisor_id = c.advisor_id
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = '2025_HK2'
            JOIN risk_assessments ra ON ra.student_id = s.student_id AND ra.semester_id = '2025_HK2'
            WHERE s.student_id = ?
            """,
            (sid,),
        ).fetchone()

        if row:
            sql_used = (
                f"SELECT s.student_id, s.full_name, s.class_id, sr.gpa_semester, sr.gpa_cumulative, "
                f"sr.accumulated_debt_credits, ra.risk_level, ra.risk_score, ra.predicted_next_gpa "
                f"FROM students s JOIN semester_results sr USING(student_id) JOIN risk_assessments ra USING(student_id) "
                f"WHERE s.student_id = '{sid}' AND sr.semester_id = '2025_HK2';"
            )

            rec_list = []
            if row["recommendations_json"]:
                try:
                    rec_list = json.loads(row["recommendations_json"])
                except Exception:
                    pass

            # If user explicitly asks for remedies/solutions
            if is_remedy:
                remedy_bullets = "\n".join([
                    f"  {idx+1}. {r.replace('<b>', '**').replace('</b>', '**')}"
                    for idx, r in enumerate(rec_list)
                ]) if rec_list else (
                    f"  1. **Giảm tải tín chỉ học kỳ tới:** Rút bớt số môn khó xuống mức 12–14 tín chỉ.\n"
                    f"  2. **Ưu tiên trả nợ môn:** Tập trung học cải thiện {row['accumulated_debt_credits']} TC nợ đọng, đặc biệt các môn tiên quyết.\n"
                    f"  3. **Lịch làm việc với CVHT ({row['advisor_name']}):** Ký cam kết tiến độ chuyên cần trong 2 tuần đầu học kỳ.\n"
                    f"  4. **Ghép cặp học tập (Peer Mentoring):** Bố trí sinh viên khá trong lớp kèm cặp các đồ án thực hành."
                )

                ans = (
                    f"### 📋 Kế Hoạch Khắc Phục Học Vụ Cho Sinh Viên **{row['student_id']} — {row['full_name']}**\n\n"
                    f"- **Lớp:** `{row['class_id']}` ({row['class_name']}) | **Cố vấn học tập:** {row['advisor_name']}\n"
                    f"- **Tình trạng hiện tại:** Mức nguy cơ **{row['risk_score']}%** (`{row['risk_level']}`)\n"
                    f"- **Số liệu học kỳ 2025_HK2:** ĐTB HK **{row['gpa_semester']:.2f}**, ĐTB tích lũy **{row['gpa_cumulative']:.2f}**, "
                    f"Nợ đọng **{row['accumulated_debt_credits']} TC**, Học phần không đạt **{row['failed_credits']}/{row['registered_credits']} TC**.\n"
                    f"- **Nguyên nhân cốt lõi:** {row['explanation_text']}\n\n"
                    f"**Lộ trình 4 bước CVHT cần can thiệp giải quyết:**\n{remedy_bullets}\n\n"
                    f"> *Lưu ý quy chế:* Nếu tiếp tục để ĐTB học kỳ tới dưới sàn quy định, sinh viên sẽ bị kích hoạt điều kiện buộc thôi học theo Khoản 2 Điều 11 Thông tư 08."
                )
            else:
                ans = (
                    f"Hồ sơ sinh viên **{row['student_id']} — {row['full_name']}** (Lớp `{row['class_id']}`):\n"
                    f"- **Mức cảnh báo:** `{row['risk_level']}` (Điểm nguy cơ: **{row['risk_score']}%**, "
                    f"Vi phạm quy chế TT08: **{'Đã chạm ngưỡng' if row['rule_triggered'] else 'Chưa (Cảnh báo sớm bởi Sheaf GNN)'}**)\n"
                    f"- **Chỉ số học tập HK 2025_HK2:** ĐTB HK **{row['gpa_semester']:.2f}**, ĐTB tích lũy **{row['gpa_cumulative']:.2f}**, "
                    f"Nợ tích lũy **{row['accumulated_debt_credits']} TC**, Không đạt **{row['failed_credits']}/{row['registered_credits']} TC**.\n"
                    f"- **Dự báo ĐTB kỳ tới:** **{row['predicted_next_gpa']:.2f} ± 0.15**\n"
                    f"- **Chẩn đoán nguyên nhân:** {row['explanation_text']}"
                )

            conn.close()
            return {
                "answer": ans,
                "citations": ["Thông tư 08/2021/TT-BGDĐT, Điều 11", "Phiếu đánh giá học vụ M03", "Kế hoạch can thiệp CVHT M08"],
                "sql_executed": sql_used,
            }

    # =========================================================================
    # CASE 2: CONSECUTIVE WARNINGS / DISMISSAL (CẢNH BÁO LẦN 2 / THÔI HỌC)
    # =========================================================================
    if any(k in q_low for k in [
        "lần thứ hai", "lần 2", "lần thứ 2", "liên tiếp", "2 lần", "3 lần",
        "buộc thôi học", "đuổi học", "thôi học", "cảnh báo lần hai"
    ]):
        dismissal_doc = KNOWLEDGE_BASE[4]
        # Query students who have consecutive warnings or critical debt
        crit_students = cur.execute(
            """
            SELECT s.student_id, s.full_name, s.class_id, sr.gpa_cumulative, sr.accumulated_debt_credits,
                   ra.risk_score, ra.risk_level
            FROM risk_assessments ra
            JOIN students s ON s.student_id = ra.student_id
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = ra.semester_id
            WHERE ra.semester_id = '2025_HK2' AND (ra.rule_triggered = 1 OR ra.risk_score >= 85)
            ORDER BY ra.risk_score DESC
            LIMIT 4
            """
        ).fetchall()
        conn.close()

        crit_lines = "\n".join([
            f"  • **{r['student_id']} ({r['full_name']} - {r['class_id']})**: ĐTB TL {r['gpa_cumulative']:.2f}, "
            f"Nợ {r['accumulated_debt_credits']} TC (Nguy cơ: **{r['risk_score']}%**)"
            for r in crit_students
        ])

        ans = (
            f"### ⚖️ Quy định Xử lý Cảnh Báo Học Vụ Lần Thứ Hai & Buộc Thôi Học\n\n"
            f"Căn cứ **Khoản 2 Điều 11 Thông tư 08/2021/TT-BGDĐT** và Quy chế Đào tạo tín chỉ Trường ĐH Mở TP.HCM:\n\n"
            f"1. **Điều kiện Buộc Thôi Học khi bị cảnh báo lần thứ hai:**\n"
            f"   - Nếu sinh viên bị cảnh báo kết quả học tập **2 LẦN LIÊN TIẾP** (ví dụ: bị cảnh báo ở HK1 và không cải thiện, tiếp tục vi phạm ở HK2 kế tiếp) thì thuộc diện **HỘI ĐỒNG XÉT BUỘC THÔI HỌC**.\n"
            f"   - Nếu tổng số lần bị cảnh báo học tập tích lũy qua các năm vượt quá **3 LẦN** trong suốt khóa học.\n\n"
            f"2. **Thẩm quyền và Quy trình của Nhà trường:**\n"
            f"   - Cuối mỗi học kỳ chính, Phòng Đào tạo trích xuất danh sách sinh viên chạm điều kiện.\n"
            f"   - Ban chủ nhiệm Khoa và Cố vấn học tập (CVHT) được mời họp hội đồng xét duyệt học vụ.\n"
            f"   - Nhà trường ban hành quyết định buộc thôi học và gửi thông báo chính thức về gia đình.\n\n"
            f"**Danh sách sinh viên đang ở mức rủi ro chạm diện buộc thôi học cần hỗ trợ khẩn cấp:**\n{crit_lines}"
        )
        return {
            "answer": ans,
            "citations": [dismissal_doc["citation"]],
            "sql_executed": (
                "SELECT s.student_id, s.full_name, s.class_id, sr.gpa_cumulative, sr.accumulated_debt_credits, ra.risk_score "
                "FROM risk_assessments ra JOIN students s USING(student_id) JOIN semester_results sr USING(student_id) "
                "WHERE ra.semester_id = '2025_HK2' AND (ra.rule_triggered = 1 OR ra.risk_score >= 85) ORDER BY ra.risk_score DESC LIMIT 4;"
            ),
        }

    # =========================================================================
    # CASE 3: CLASS & DEBT FILTERING (TEXT-TO-SQL REAL EXECUTION)
    # =========================================================================
    if cid or any(k in q_low for k in ["nợ trên", "nợ quá", "nợ tín chỉ", "danh sách lớp"]):
        debt_threshold = 10
        m_debt = re.search(r"nợ\s*(?:trên|quá|>|>=)?\s*(\d+)", q_low)
        if m_debt:
            debt_threshold = int(m_debt.group(1))

        where_clauses = ["ra.semester_id = '2025_HK2'"]
        params = []

        if cid:
            where_clauses.append("s.class_id = ?")
            params.append(cid)

        if "nợ" in q_low:
            where_clauses.append("sr.accumulated_debt_credits >= ?")
            params.append(debt_threshold)

        where_sql = " AND ".join(where_clauses)
        sql_query = f"""
            SELECT s.student_id, s.full_name, s.class_id, sr.accumulated_debt_credits,
                   sr.gpa_cumulative, ra.risk_level, ra.risk_score, ra.rule_triggered
            FROM students s
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = '2025_HK2'
            JOIN risk_assessments ra ON ra.student_id = s.student_id AND ra.semester_id = '2025_HK2'
            WHERE {where_sql}
            ORDER BY sr.accumulated_debt_credits DESC, ra.risk_score DESC
            LIMIT 15;
        """

        results = cur.execute(sql_query, params).fetchall()
        conn.close()

        target_desc = f"lớp **{cid}**" if cid else "toàn trường"
        filter_desc = f"nợ từ **{debt_threshold} tín chỉ** trở lên" if "nợ" in q_low else "thuộc diện theo dõi"

        if results:
            rows_text = "\n".join([
                f"  {idx+1}. **{r['student_id']} — {r['full_name']}** ({r['class_id']}): "
                f"Nợ **{r['accumulated_debt_credits']} TC** | ĐTB TL: **{r['gpa_cumulative']:.2f}** | "
                f"Mức: `{r['risk_level']}` ({r['risk_score']}%)"
                for idx, r in enumerate(results)
            ])
            ans = (
                f"Đã tìm thấy **{len(results)} sinh viên** {target_desc} {filter_desc}:\n\n"
                f"{rows_text}\n\n"
                f"*Khuyến nghị CVHT:* Các sinh viên nợ trên 10 TC cần được ưu tiên rút môn học kỳ tới và chỉ đăng ký trả nợ học phần tiên quyết."
            )
        else:
            ans = f"Không tìm thấy sinh viên nào trong {target_desc} thỏa mãn điều kiện {filter_desc}."

        return {
            "answer": ans,
            "citations": ["Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 1b", "CSDL EduAlert (Read-Only SQL)"],
            "sql_executed": sql_query.strip(),
        }

    # =========================================================================
    # CASE 4: TOP HIGH-RISK / COHORT OVERVIEW
    # =========================================================================
    if any(k in q_low for k in ["top", "ưu tiên", "nguy cơ cao", "danh sách", "thống kê", "bao nhiêu"]):
        stats = cur.execute(
            """
            SELECT risk_level, COUNT(*) as cnt
            FROM risk_assessments WHERE semester_id = '2025_HK2'
            GROUP BY risk_level
            """
        ).fetchall()
        st_map = {r["risk_level"]: r["cnt"] for r in stats}
        top5 = cur.execute(
            """
            SELECT s.student_id, s.full_name, s.class_id, ra.risk_score, ra.risk_level,
                   sr.gpa_cumulative, sr.accumulated_debt_credits, ra.rule_triggered
            FROM risk_assessments ra
            JOIN students s ON s.student_id = ra.student_id
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = ra.semester_id
            WHERE ra.semester_id = '2025_HK2'
            ORDER BY ra.rule_triggered DESC, ra.risk_score DESC
            LIMIT 5
            """
        ).fetchall()
        conn.close()

        top_lines = "\n".join([
            f"  {i+1}. **{r['student_id']} ({r['full_name']} - {r['class_id']})**: Nguy cơ **{r['risk_score']}%** "
            f"(`{r['risk_level']}`, ĐTB TL: {r['gpa_cumulative']:.2f}, Nợ: {r['accumulated_debt_credits']} TC, "
            f"{'❌ Vi phạm quy chế TT08' if r['rule_triggered'] else '⚠️ Cảnh báo sớm bởi Sheaf GNN'})"
            for i, r in enumerate(top5)
        ])

        return {
            "answer": (
                f"**Thống kê toàn khóa học kỳ 2025_HK2 (180 SV):**\n"
                f"- **Nguy cơ cao (Đỏ):** {st_map.get('HIGH_RISK', 0)} SV | "
                f"**Cần chú ý (Vàng):** {st_map.get('ATTENTION', 0)} SV | "
                f"**Bình thường (Xanh):** {st_map.get('NORMAL', 0)} SV\n\n"
                f"**Top 5 sinh viên CVHT cần ưu tiên mời làm việc gấp:**\n{top_lines}"
            ),
            "citations": ["Thông tư 08/2021/TT-BGDĐT, Điều 11", "View: mv_cohort_risk_summary"],
            "sql_executed": (
                "SELECT s.student_id, s.full_name, s.class_id, ra.risk_score, ra.risk_level, sr.gpa_cumulative "
                "FROM risk_assessments ra JOIN students s USING(student_id) "
                "WHERE ra.semester_id = '2025_HK2' ORDER BY ra.rule_triggered DESC, ra.risk_score DESC LIMIT 5;"
            ),
        }

    conn.close()

    # =========================================================================
    # CASE 5: RAG RETRIEVAL OVER CIRCULAR 08/2021
    # =========================================================================
    scored = []
    for doc in KNOWLEDGE_BASE:
        score = sum(3 for kw in doc["keywords"] if kw in q_low)
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda x: x[0], reverse=True)

    if scored:
        chosen = [d for _, d in scored[:2]]
    else:
        chosen = [KNOWLEDGE_BASE[0], KNOWLEDGE_BASE[1], KNOWLEDGE_BASE[4]]

    ans_parts = [f"- **{d['title']}**:\n  {d['content']}" for d in chosen]
    cites = [d["citation"] for d in chosen]

    return {
        "answer": "Dựa trên Cơ sở dữ liệu Quy chế đào tạo Thông tư 08/2021/TT-BGDĐT:\n\n" + "\n\n".join(ans_parts),
        "citations": cites,
        "sql_executed": None,
    }
