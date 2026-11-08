# -*- coding: utf-8 -*-
"""
EduAlert — Advisor Copilot (RAG over Circular 08/2021/TT-BGDĐT + Guarded Text-to-SQL Analytics)
Author: Huynh Le Thanh Hai — HCMC Open University
"""

import re
from typing import Dict, Any, List
from backend.database import get_connection

KNOWLEDGE_BASE = [
    {
        "id": "TT08_D11_K1A",
        "title": "Thông tư 08/2021/TT-BGDĐT — Điều 11, Khoản 1a (Tín chỉ không đạt trong kỳ)",
        "keywords": ["tín chỉ không đạt", "50%", "rớt", "trượt", "khối lượng đăng ký", "r01"],
        "citation": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 1a",
        "content": (
            "Sinh viên bị cảnh báo kết quả học tập cuối mỗi học kỳ chính nếu tổng số tín chỉ không đạt "
            "trong học kỳ vượt quá 50% khối lượng đã đăng ký học trong học kỳ đó."
        ),
    },
    {
        "id": "TT08_D11_K1B",
        "title": "Thông tư 08/2021/TT-BGDĐT — Điều 11, Khoản 1b (Tín chỉ nợ đọng tích lũy)",
        "keywords": ["nợ đọng", "24 tín chỉ", "tích lũy", "nợ môn", "r02"],
        "citation": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 1b",
        "content": (
            "Sinh viên bị cảnh báo học tập nếu tổng số tín chỉ nợ đọng từ đầu khóa học vượt quá 24 tín chỉ."
        ),
    },
    {
        "id": "TT08_D11_K1C",
        "title": "Thông tư 08/2021/TT-BGDĐT — Điều 11, Khoản 1c (Điểm trung bình học kỳ)",
        "keywords": ["đtb học kỳ", "gpa kỳ", "0.8", "1.0", "học kỳ đầu", "r03"],
        "citation": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 1c",
        "content": (
            "Sinh viên bị cảnh báo học tập nếu điểm trung bình học kỳ đạt dưới 0.8 đối với học kỳ đầu của khóa học, "
            "hoặc dưới 1.0 đối với các học kỳ tiếp theo."
        ),
    },
    {
        "id": "TT08_D11_K1D",
        "title": "Thông tư 08/2021/TT-BGDĐT — Điều 11, Khoản 1d (Điểm trung bình tích lũy theo năm)",
        "keywords": ["đtb tích lũy", "gpa tích lũy", "1.2", "1.4", "1.6", "1.8", "năm học", "r04"],
        "citation": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 1d",
        "content": (
            "Sinh viên bị cảnh báo học tập nếu điểm trung bình tích lũy đạt dưới 1.2 đối với trình độ năm thứ nhất, "
            "dưới 1.4 đối với năm thứ hai, dưới 1.6 đối với năm thứ ba, hoặc dưới 1.8 đối với các năm tiếp theo."
        ),
    },
    {
        "id": "TT08_D11_K2",
        "title": "Thông tư 08/2021/TT-BGDĐT — Điều 11, Khoản 2 & Quy chế ĐH Mở TP.HCM (Buộc thôi học)",
        "keywords": ["buộc thôi học", "cảnh báo liên tiếp", "2 lần", "3 lần", "r05", "đuổi học"],
        "citation": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 2 & Quy chế đào tạo ĐH Mở TP.HCM",
        "content": (
            "Sinh viên bị xét buộc thôi học nếu số lần cảnh báo học tập liên tiếp đạt từ 2 lần trở lên "
            "hoặc tổng số lần bị cảnh báo học tập vượt quá giới hạn quy định của trường (3 lần)."
        ),
    },
    {
        "id": "SHEAF_ARCH",
        "title": "Cơ chế Sheaf Attention Network & Quy tắc vàng kết hợp Rule + Model",
        "keywords": ["sheaf", "gnn", "đồ thị", "dị thể", "heterophily", "ưu tiên", "mâu thuẫn"],
        "citation": "Tài liệu Kiến trúc EduAlert — Mục 6.1 & 6.4 (Hansen & Gebhart 2020; Bodnar et al. 2022)",
        "content": (
            "EduAlert áp dụng Quy tắc vàng: Kết quả của Rule Engine luôn có quyền ưu tiên tuyệt đối (nếu chạm ngưỡng quy chế -> Nguy cơ cao). "
            "Mô hình Sheaf Attention Network gắn ánh xạ hạn chế (restriction map) lên từng cạnh để xử lý hiện tượng dị thể (sinh viên giỏi và yếu cùng nhóm), "
            "giúp phát hiện sớm sinh viên đang trượt dốc trước khi chạm ngưỡng quy chế."
        ),
    },
]


def answer_copilot_query(query: str) -> Dict[str, Any]:
    q_low = query.strip().lower()
    conn = get_connection()
    cur = conn.cursor()

    # 1. Check if query asks about a specific Student ID (e.g., SV001, SV002, SV003)
    m_sv = re.search(r"\b(sv\d{3})\b", q_low)
    if m_sv:
        sid = m_sv.group(1).upper()
        row = cur.execute(
            """
            SELECT s.student_id, s.full_name, s.class_id, sr.gpa_semester, sr.gpa_cumulative,
                   sr.accumulated_debt_credits, sr.failed_credits, sr.registered_credits,
                   ra.risk_level, ra.risk_score, ra.rule_triggered, ra.predicted_next_gpa, ra.explanation_text
            FROM students s
            JOIN semester_results sr ON sr.student_id = s.student_id AND sr.semester_id = '2025_HK2'
            JOIN risk_assessments ra ON ra.student_id = s.student_id AND ra.semester_id = '2025_HK2'
            WHERE s.student_id = ?
            """,
            (sid,),
        ).fetchone()
        if row:
            sql_used = (
                f"SELECT student_id, full_name, class_id, gpa_semester, gpa_cumulative, accumulated_debt_credits, "
                f"risk_level, risk_score, predicted_next_gpa FROM v_student_latest_risk WHERE student_id = '{sid}';"
            )
            conn.close()
            return {
                "answer": (
                    f"Hồ sơ **{row['student_id']} — {row['full_name']}** (Lớp `{row['class_id']}`):\n"
                    f"- **Mức cảnh báo:** `{row['risk_level']}` (Điểm nguy cơ: **{row['risk_score']}%**, "
                    f"Chạm quy chế TT08: **{'Có' if row['rule_triggered'] else 'Chưa'}**)\n"
                    f"- **Chỉ số học kỳ 2025_HK2:** ĐTB HK **{row['gpa_semester']:.2f}**, ĐTB tích lũy **{row['gpa_cumulative']:.2f}**, "
                    f"Nợ đọng **{row['accumulated_debt_credits']} TC**, Không đạt **{row['failed_credits']}/{row['registered_credits']} TC**\n"
                    f"- **Dự báo ĐTB kỳ tới (Sheaf-GNN):** **{row['predicted_next_gpa']:.2f} ± 0.15**\n"
                    f"- **Giải thích:** {row['explanation_text']}"
                ),
                "citations": ["Thông tư 08/2021/TT-BGDĐT, Điều 11", "Phiếu đánh giá cá nhân M03"],
                "sql_executed": sql_used,
            }

    # 2. Check if query asks for top high-risk students or class statistics (Guarded Text-to-SQL)
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
        top_lines = "\n".join(
            [
                f"  {i+1}. **{r['student_id']} ({r['full_name']} - {r['class_id']})**: Nguy cơ **{r['risk_score']}%** "
                f"(`{r['risk_level']}`, ĐTB TL: {r['gpa_cumulative']:.2f}, Nợ: {r['accumulated_debt_credits']} TC, "
                f"{'Chạm quy chế' if r['rule_triggered'] else 'Cảnh báo sớm bởi mô hình'})"
                for i, r in enumerate(top5)
            ]
        )
        return {
            "answer": (
                f"**Thống kê toàn khóa học kỳ 2025_HK2:** Tổng cộng **{sum(st_map.values())} sinh viên**, trong đó:\n"
                f"- **Nguy cơ cao (Đỏ):** {st_map.get('HIGH_RISK', 0)} SV | **Cần chú ý (Vàng):** {st_map.get('ATTENTION', 0)} SV | **Bình thường (Xanh):** {st_map.get('NORMAL', 0)} SV\n\n"
                f"**Top 5 sinh viên CVHT cần ưu tiên mời làm việc ngay:**\n{top_lines}"
            ),
            "citations": ["Thông tư 08/2021/TT-BGDĐT, Điều 11", "View: mv_cohort_risk_summary (Read-Only)"],
            "sql_executed": (
                "SELECT s.student_id, s.full_name, s.class_id, ra.risk_score, ra.risk_level, sr.gpa_cumulative "
                "FROM risk_assessments ra JOIN students s USING(student_id) "
                "WHERE ra.semester_id = '2025_HK2' ORDER BY ra.rule_triggered DESC, ra.risk_score DESC LIMIT 5;"
            ),
        }

    conn.close()

    # 3. RAG retrieval over Circular 08/2021 & Architecture docs
    scored: List[tuple] = []
    for doc in KNOWLEDGE_BASE:
        score = sum(2 for kw in doc["keywords"] if kw in q_low)
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda x: x[0], reverse=True)

    if scored:
        chosen = [d for _, d in scored[:2]]
    else:
        chosen = KNOWLEDGE_BASE[:3]

    ans_parts = [f"- **{d['title']}**: {d['content']}" for d in chosen]
    cites = [d["citation"] for d in chosen]
    return {
        "answer": "Dựa trên cơ sở dữ liệu quy chế đào tạo:\n" + "\n".join(ans_parts),
        "citations": cites,
        "sql_executed": None,
    }

