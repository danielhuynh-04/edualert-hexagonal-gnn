# -*- coding: utf-8 -*-
"""
EduAlert — Hexagonal Architecture: Application Use Cases (Orchestrates Domain + Ports)
Author: Huynh Le Thanh Hai — HCMC Open University
"""

from typing import List, Dict, Any
from src.domain.entities import SemesterSnapshot, AssessmentSlip
from src.ports.interfaces import RegulationPort, GraphInferencePort, AuditPort


class EvaluateStudentRiskUseCase:
    """
    Inbound Use Case: Evaluates a student's academic risk by combining:
    1. Deterministic Regulation Port (Circular 08/2021/TT-BGDĐT)
    2. Sheaf Attention Graph Inference Port (Early warning before hitting rule floor)
    3. Golden Rule Domain Invariant on AssessmentSlip aggregate
    """

    def __init__(
        self,
        regulation_port: RegulationPort,
        inference_port: GraphInferencePort,
        audit_port: AuditPort | None = None,
    ) -> None:
        self.regulation_port = regulation_port
        self.inference_port = inference_port
        self.audit_port = audit_port

    def execute(
        self,
        student_id: str,
        semester_id: str,
        snapshots: List[SemesterSnapshot],
        entrance_score_30: float,
        consecutive_warnings: int = 0,
        total_warnings: int = 0,
        sheaf_peer_signal: float = 0.0,
        model_run_id: str = "RUN_SHEAF_ATTN",
    ) -> AssessmentSlip:
        latest = snapshots[-1]
        rule_checks = self.regulation_port.evaluate(
            latest, consecutive_warnings=consecutive_warnings, total_warnings=total_warnings
        )
        prob, pred_gpa, factors, expl_text, recommendations = self.inference_port.score_trajectory(
            snapshots=snapshots,
            entrance_score_30=entrance_score_30,
            sheaf_peer_signal=sheaf_peer_signal,
        )

        slip = AssessmentSlip(
            student_id=student_id,
            semester_id=semester_id,
            model_run_id=model_run_id,
            raw_model_probability=prob,
            predicted_next_gpa=pred_gpa,
            predicted_gpa_std=0.15,
            rule_checks=rule_checks,
            factors=factors,
            explanation_text=expl_text,
            recommendations=recommendations,
        )

        if self.audit_port is not None:
            self.audit_port.record_event(
                user_id=1,
                action="HEXAGONAL_EVALUATE_RISK",
                target_entity=student_id,
                payload={
                    "final_risk_level": slip.final_risk_level.value,
                    "final_risk_score": slip.final_risk_score,
                    "rule_triggered": slip.rule_triggered,
                },
            )
        return slip

