# -*- coding: utf-8 -*-
"""
EduAlert — Hexagonal Architecture: Domain Entities & Value Objects (Pure Core)
Zero external framework dependencies. Models Circular 08/2021/TT-BGDĐT & Sheaf GNN Risk Assessment.
Author: Huynh Le Thanh Hai — HCMC Open University
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional


class RiskLevel(str, Enum):
    NORMAL = "NORMAL"
    ATTENTION = "ATTENTION"
    HIGH_RISK = "HIGH_RISK"


@dataclass(frozen=True)
class SemesterSnapshot:
    student_id: str
    semester_id: str
    study_year: int
    semester_seq: int
    registered_credits: int
    passed_credits: int
    failed_credits: int
    accumulated_debt_credits: int
    gpa_semester: float
    gpa_cumulative: float
    planned_credits_next: int = 16
    planned_easy_courses: int = 2
    planned_mid_courses: int = 2
    planned_hard_courses: int = 1


@dataclass(frozen=True)
class RuleCheckResult:
    rule_code: str
    triggered: bool
    actual_value: str
    threshold_value: str
    explanation: str
    legal_ref: str


@dataclass(frozen=True)
class FactorAttribution:
    factor_code: str
    factor_label: str
    contribution: float
    direction: str  # INCREASE or DECREASE


@dataclass
class AssessmentSlip:
    """
    Domain Aggregate Root for an Early Academic Alert Assessment.
    Enforces the Golden Compliance Invariant:
    Deterministic Regulatory Rules ALWAYS take priority over ML/GNN probability.
    """
    student_id: str
    semester_id: str
    model_run_id: str
    raw_model_probability: float
    predicted_next_gpa: float
    predicted_gpa_std: float
    rule_checks: List[RuleCheckResult] = field(default_factory=list)
    factors: List[FactorAttribution] = field(default_factory=list)
    explanation_text: str = ""
    recommendations: List[str] = field(default_factory=list)

    @property
    def rule_triggered(self) -> bool:
        return any(r.triggered for r in self.rule_checks)

    @property
    def final_risk_probability(self) -> float:
        if self.rule_triggered:
            return max(self.raw_model_probability, 0.82)
        return self.raw_model_probability

    @property
    def final_risk_score(self) -> float:
        return round(self.final_risk_probability * 100.0, 1)

    @property
    def final_risk_level(self) -> RiskLevel:
        # Golden Rule Invariant: Regulatory Trigger -> HIGH_RISK unconditionally
        if self.rule_triggered:
            return RiskLevel.HIGH_RISK
        if self.raw_model_probability >= 0.65:
            return RiskLevel.HIGH_RISK
        if self.raw_model_probability >= 0.35:
            return RiskLevel.ATTENTION
        return RiskLevel.NORMAL

