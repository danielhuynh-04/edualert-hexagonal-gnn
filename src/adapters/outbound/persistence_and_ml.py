# -*- coding: utf-8 -*-
"""
EduAlert — Hexagonal Architecture: Outbound Adapters
Implements RegulationPort, GraphInferencePort, and AuditPort using SQLite/PostgreSQL and Sheaf Attention GNN.
Author: Huynh Le Thanh Hai — HCMC Open University
"""

from typing import List, Dict, Any, Tuple
from src.domain.entities import SemesterSnapshot, RuleCheckResult, FactorAttribution
from backend.database import get_connection, log_audit
from backend.rule_engine import load_active_rules, evaluate_student_rules, get_cumulative_gpa_threshold
from backend.ml_pipeline import compute_student_features, generate_explanation_and_advice, FACTOR_META


class Circular08RegulationAdapter:
    """Outbound Adapter implementing RegulationPort for Circular 08/2021/TT-BGDĐT."""

    def evaluate(
        self, snapshot: SemesterSnapshot, consecutive_warnings: int = 0, total_warnings: int = 0
    ) -> List[RuleCheckResult]:
        conn = get_connection()
        active_rules = load_active_rules(conn)
        conn.close()

        rec = {
            "semester_seq": snapshot.semester_seq,
            "study_year": snapshot.study_year,
            "registered_credits": snapshot.registered_credits,
            "passed_credits": snapshot.passed_credits,
            "failed_credits": snapshot.failed_credits,
            "accumulated_debt_credits": snapshot.accumulated_debt_credits,
            "gpa_semester": snapshot.gpa_semester,
            "gpa_cumulative": snapshot.gpa_cumulative,
        }
        res = evaluate_student_rules(rec, consecutive_warnings, total_warnings, active_rules)
        return [
            RuleCheckResult(
                rule_code=c["rule_code"],
                triggered=bool(c["triggered"]),
                actual_value=c["actual_value"],
                threshold_value=c["threshold_value"],
                explanation=c["explanation"],
                legal_ref=c.get("legal_ref", "Thông tư 08/2021/TT-BGDĐT"),
            )
            for c in res["checks"]
        ]


class SheafAttentionInferenceAdapter:
    """Outbound Adapter implementing GraphInferencePort for Sheaf Attention GNN & XAI."""

    def score_trajectory(
        self,
        snapshots: List[SemesterSnapshot],
        entrance_score_30: float,
        sheaf_peer_signal: float = 0.0,
    ) -> Tuple[float, float, List[FactorAttribution], str, List[str]]:
        conn = get_connection()
        active_rules = load_active_rules(conn)
        conn.close()

        sems_dicts = [
            {
                "semester_seq": s.semester_seq,
                "study_year": s.study_year,
                "registered_credits": s.registered_credits,
                "passed_credits": s.passed_credits,
                "failed_credits": s.failed_credits,
                "accumulated_debt_credits": s.accumulated_debt_credits,
                "gpa_semester": s.gpa_semester,
                "gpa_cumulative": s.gpa_cumulative,
                "planned_credits_next": s.planned_credits_next,
                "planned_easy_courses": s.planned_easy_courses,
                "planned_mid_courses": s.planned_mid_courses,
                "planned_hard_courses": s.planned_hard_courses,
            }
            for s in snapshots
        ]
        p4_params = active_rules["R04_CUM_GPA_BY_YEAR"]["params"]
        th = get_cumulative_gpa_threshold(snapshots[-1].study_year, p4_params)

        _, contrib, prob, pred_gpa = compute_student_features(
            sems_dicts, entrance_score_30, sheaf_peer_signal, th
        )
        lvl = "HIGH_RISK" if prob >= 0.65 else ("ATTENTION" if prob >= 0.35 else "NORMAL")
        expl, advice = generate_explanation_and_advice(contrib, sems_dicts[-1], lvl, False)

        factors = [
            FactorAttribution(
                factor_code=k,
                factor_label=FACTOR_META[k],
                contribution=v,
                direction="INCREASE" if v >= 0 else "DECREASE",
            )
            for k, v in sorted(contrib.items(), key=lambda item: abs(item[1]), reverse=True)
        ]
        return prob, pred_gpa, factors, expl, advice


class SqliteAuditAdapter:
    """Outbound Adapter implementing AuditPort for Compliance Logging."""

    def record_event(self, user_id: int, action: str, target_entity: str, payload: Dict[str, Any]) -> None:
        conn = get_connection()
        log_audit(conn, user_id, action, target_entity, payload)
        conn.commit()
        conn.close()

