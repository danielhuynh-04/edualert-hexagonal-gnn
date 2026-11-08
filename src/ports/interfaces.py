# -*- coding: utf-8 -*-
"""
EduAlert — Hexagonal Architecture: Inbound & Outbound Ports (Interfaces / Protocols)
Decouples Core Domain & Use Cases from Databases (SQLite/PostgreSQL), ML Engines (PyG/Sheaf), and Web Gateways (Node.js/Flask).
Author: Huynh Le Thanh Hai — HCMC Open University
"""

from typing import Protocol, List, Dict, Any, Tuple
from src.domain.entities import SemesterSnapshot, RuleCheckResult, FactorAttribution, AssessmentSlip


class StudentRepositoryPort(Protocol):
    """Outbound Port for Student, Cohort, and Assessment Persistence."""

    def get_overview_stats(self, semester_id: str) -> Dict[str, Any]:
        ...

    def list_cohort(
        self, class_id: str = "", risk_level: str = "", search_q: str = "", advisor_id: str = ""
    ) -> List[Dict[str, Any]]:
        ...

    def get_student_full_assessment(self, student_id: str) -> Dict[str, Any] | None:
        ...


class RegulationPort(Protocol):
    """Outbound Port for Loading & Evaluating Circular 08/2021/TT-BGDĐT Rules."""

    def evaluate(
        self, snapshot: SemesterSnapshot, consecutive_warnings: int = 0, total_warnings: int = 0
    ) -> List[RuleCheckResult]:
        ...


class GraphInferencePort(Protocol):
    """Outbound Port for Spatio-Temporal / Sheaf Attention GNN Scoring & XAI Attribution."""

    def score_trajectory(
        self,
        snapshots: List[SemesterSnapshot],
        entrance_score_30: float,
        sheaf_peer_signal: float = 0.0,
    ) -> Tuple[float, float, List[FactorAttribution], str, List[str]]:
        ...


class AuditPort(Protocol):
    """Outbound Port for Immutable Compliance Audit Logging & Outbox Events."""

    def record_event(self, user_id: int, action: str, target_entity: str, payload: Dict[str, Any]) -> None:
        ...

