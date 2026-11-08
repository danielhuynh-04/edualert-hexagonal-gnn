# -*- coding: utf-8 -*-
"""
EduAlert — Deterministic Rule Engine (Circular 08/2021/TT-BGDĐT & HCMC OU Credit Regulations)
Author: Huynh Le Thanh Hai — HCMC Open University
"""

import json
import sqlite3
from typing import Dict, List, Any

DEFAULT_RULES = [
    {
        "rule_code": "R01_SEM_FAIL_RATIO",
        "rule_name": "Tỷ lệ tín chỉ không đạt trong học kỳ vượt ngưỡng 50%",
        "param_json": {"max_fail_ratio": 0.50},
        "effective_from": "2021-05-03",
        "legal_ref": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 1a",
    },
    {
        "rule_code": "R02_ACCUM_DEBT_CREDITS",
        "rule_name": "Tổng số tín chỉ nợ đọng từ đầu khóa vượt quá 24 tín chỉ",
        "param_json": {"max_debt_credits": 24},
        "effective_from": "2021-05-03",
        "legal_ref": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 1b",
    },
    {
        "rule_code": "R03_SEM_GPA_FLOOR",
        "rule_name": "Điểm trung bình học kỳ dưới ngưỡng tối thiểu (0.8 HK đầu, 1.0 các HK tiếp theo)",
        "param_json": {"first_sem_floor": 0.80, "later_sem_floor": 1.00},
        "effective_from": "2021-05-03",
        "legal_ref": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 1c",
    },
    {
        "rule_code": "R04_CUM_GPA_BY_YEAR",
        "rule_name": "Điểm trung bình tích lũy dưới ngưỡng theo năm học (1.2 / 1.4 / 1.6 / 1.8)",
        "param_json": {"year_1": 1.20, "year_2": 1.40, "year_3": 1.60, "year_4_plus": 1.80},
        "effective_from": "2021-05-03",
        "legal_ref": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 1d",
    },
    {
        "rule_code": "R05_CONSECUTIVE_WARNINGS",
        "rule_name": "Nguy cơ buộc thôi học do bị cảnh báo học vụ liên tiếp hoặc vượt tổng số lần tối đa",
        "param_json": {"max_consecutive_warnings": 2, "max_total_warnings": 3},
        "effective_from": "2021-05-03",
        "legal_ref": "Thông tư 08/2021/TT-BGDĐT, Điều 11, Khoản 2 & Quy chế ĐH Mở TP.HCM",
    },
]


def seed_default_rules(conn: sqlite3.Connection) -> None:
    for r in DEFAULT_RULES:
        conn.execute(
            """
            INSERT OR IGNORE INTO rule_config
            (rule_code, rule_name, param_json, effective_from, legal_ref, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
            """,
            (
                r["rule_code"],
                r["rule_name"],
                json.dumps(r["param_json"], ensure_ascii=False),
                r["effective_from"],
                r["legal_ref"],
            ),
        )
    conn.commit()


def load_active_rules(conn: sqlite3.Connection) -> Dict[str, Dict[str, Any]]:
    rows = conn.execute("SELECT * FROM rule_config WHERE is_active = 1 ORDER BY rule_id").fetchall()
    rules = {}
    for r in rows:
        d = dict(r)
        d["params"] = json.loads(d["param_json"])
        rules[d["rule_code"]] = d
    return rules


def get_cumulative_gpa_threshold(study_year: int, params: Dict[str, float]) -> float:
    if study_year <= 1:
        return float(params.get("year_1", 1.20))
    if study_year == 2:
        return float(params.get("year_2", 1.40))
    if study_year == 3:
        return float(params.get("year_3", 1.60))
    return float(params.get("year_4_plus", 1.80))


def evaluate_student_rules(
    sem_record: Dict[str, Any],
    consecutive_warnings: int = 0,
    total_warnings: int = 0,
    active_rules: Dict[str, Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    """
    Evaluate all regulatory conditions on a student's latest semester record.
    Returns deterministic rule checks, triggered hits, and whether regulatory HIGH_RISK override applies.
    """
    if active_rules is None:
        active_rules = {
            r["rule_code"]: {**r, "params": r["param_json"]} for r in DEFAULT_RULES
        }

    reg_credits = int(sem_record.get("registered_credits", 0))
    fail_credits = int(sem_record.get("failed_credits", 0))
    debt_credits = int(sem_record.get("accumulated_debt_credits", 0))
    sem_seq = int(sem_record.get("semester_seq", 1))
    study_year = int(sem_record.get("study_year", max(1, (sem_seq + 1) // 2)))
    gpa_sem = float(sem_record.get("gpa_semester", 0.0))
    gpa_cum = float(sem_record.get("gpa_cumulative", 0.0))

    checks: List[Dict[str, Any]] = []

    # R01: Semester failed credit ratio > 50%
    if "R01_SEM_FAIL_RATIO" in active_rules:
        p1 = active_rules["R01_SEM_FAIL_RATIO"]["params"]
        max_ratio = float(p1.get("max_fail_ratio", 0.50))
        ratio = (fail_credits / reg_credits) if reg_credits > 0 else 0.0
        hit1 = reg_credits > 0 and ratio > max_ratio
        checks.append(
            {
                "rule_code": "R01_SEM_FAIL_RATIO",
                "triggered": hit1,
                "actual_value": f"{fail_credits}/{reg_credits} TC ({ratio*100:.1f}%)",
                "threshold_value": f"> {max_ratio*100:.0f}% TC đăng ký",
                "explanation": f"TC không đạt trong HK vượt {max_ratio*100:.0f}% TC đăng ký ({fail_credits}/{reg_credits} TC)",
                "legal_ref": active_rules["R01_SEM_FAIL_RATIO"]["legal_ref"],
            }
        )

    # R02: Accumulated owed credits > 24
    if "R02_ACCUM_DEBT_CREDITS" in active_rules:
        p2 = active_rules["R02_ACCUM_DEBT_CREDITS"]["params"]
        max_debt = int(p2.get("max_debt_credits", 24))
        hit2 = debt_credits > max_debt
        checks.append(
            {
                "rule_code": "R02_ACCUM_DEBT_CREDITS",
                "triggered": hit2,
                "actual_value": f"{debt_credits} TC",
                "threshold_value": f"> {max_debt} TC",
                "explanation": f"Tổng TC nợ đọng từ đầu khóa vượt {max_debt} (hiện: {debt_credits} TC)",
                "legal_ref": active_rules["R02_ACCUM_DEBT_CREDITS"]["legal_ref"],
            }
        )

    # R03: Semester GPA below floor
    if "R03_SEM_GPA_FLOOR" in active_rules:
        p3 = active_rules["R03_SEM_GPA_FLOOR"]["params"]
        hk_floor = float(p3.get("first_sem_floor", 0.80)) if sem_seq == 1 else float(p3.get("later_sem_floor", 1.00))
        hit3 = gpa_sem < hk_floor
        checks.append(
            {
                "rule_code": "R03_SEM_GPA_FLOOR",
                "triggered": hit3,
                "actual_value": f"{gpa_sem:.2f}",
                "threshold_value": f"< {hk_floor:.2f}",
                "explanation": f"ĐTB học kỳ dưới {hk_floor:.1f} (hiện: {gpa_sem:.2f})",
                "legal_ref": active_rules["R03_SEM_GPA_FLOOR"]["legal_ref"],
            }
        )

    # R04: Cumulative GPA below study-year threshold
    if "R04_CUM_GPA_BY_YEAR" in active_rules:
        p4 = active_rules["R04_CUM_GPA_BY_YEAR"]["params"]
        th_cum = get_cumulative_gpa_threshold(study_year, p4)
        hit4 = gpa_cum < th_cum
        checks.append(
            {
                "rule_code": "R04_CUM_GPA_BY_YEAR",
                "triggered": hit4,
                "actual_value": f"{gpa_cum:.2f}",
                "threshold_value": f"< {th_cum:.2f} (Năm {study_year})",
                "explanation": f"ĐTB tích lũy dưới {th_cum:.1f} đối với SV năm {study_year} (hiện: {gpa_cum:.2f})",
                "legal_ref": active_rules["R04_CUM_GPA_BY_YEAR"]["legal_ref"],
            }
        )

    # R05: Consecutive / Total warnings (Suspension Risk)
    if "R05_CONSECUTIVE_WARNINGS" in active_rules:
        p5 = active_rules["R05_CONSECUTIVE_WARNINGS"]["params"]
        max_consec = int(p5.get("max_consecutive_warnings", 2))
        max_tot = int(p5.get("max_total_warnings", 3))
        hit5 = (consecutive_warnings >= max_consec) or (total_warnings >= max_tot)
        checks.append(
            {
                "rule_code": "R05_CONSECUTIVE_WARNINGS",
                "triggered": hit5,
                "actual_value": f"{consecutive_warnings} lần liên tiếp ({total_warnings} tổng)",
                "threshold_value": f">= {max_consec} liên tiếp hoặc >= {max_tot} tổng",
                "explanation": f"Cảnh báo học vụ liên tiếp ({consecutive_warnings}/{max_consec} lần) — diện xét buộc thôi học",
                "legal_ref": active_rules["R05_CONSECUTIVE_WARNINGS"]["legal_ref"],
            }
        )

    hits = [c for c in checks if c["triggered"]]
    return {
        "checks": checks,
        "hits": hits,
        "rule_triggered": len(hits) > 0,
        "forced_risk_level": "HIGH_RISK" if len(hits) > 0 else None,
    }

