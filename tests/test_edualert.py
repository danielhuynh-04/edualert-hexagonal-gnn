# -*- coding: utf-8 -*-
"""
EduAlert — Automated Test Suite (Rule Engine, Hybrid Override, CSV Validation, API & RLS)
Author: Huynh Le Thanh Hai — HCMC Open University
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.rule_engine import evaluate_student_rules
from backend.app import app, ensure_initialized


class TestEduAlertSystem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ensure_initialized()
        cls.client = app.test_client()

    def test_rule_r01_sem_fail_ratio_over_50pct(self):
        rec = {
            "semester_seq": 2,
            "study_year": 1,
            "registered_credits": 16,
            "failed_credits": 9,  # 9/16 = 56.25% > 50%
            "accumulated_debt_credits": 9,
            "gpa_semester": 1.60,
            "gpa_cumulative": 1.85,
        }
        res = evaluate_student_rules(rec)
        self.assertTrue(res["rule_triggered"])
        hit_codes = [h["rule_code"] for h in res["hits"]]
        self.assertIn("R01_SEM_FAIL_RATIO", hit_codes)
        self.assertEqual(res["forced_risk_level"], "HIGH_RISK")

    def test_rule_r02_debt_over_24_credits(self):
        rec = {
            "semester_seq": 4,
            "study_year": 2,
            "registered_credits": 15,
            "failed_credits": 3,
            "accumulated_debt_credits": 25,  # > 24
            "gpa_semester": 1.80,
            "gpa_cumulative": 1.90,
        }
        res = evaluate_student_rules(rec)
        self.assertTrue(res["rule_triggered"])
        self.assertIn("R02_ACCUM_DEBT_CREDITS", [h["rule_code"] for h in res["hits"]])

    def test_rule_r03_first_vs_later_semester_floor(self):
        # Semester 1 with GPA 0.85 >= 0.80 -> should NOT trigger R03
        rec_sem1 = {
            "semester_seq": 1,
            "study_year": 1,
            "registered_credits": 15,
            "failed_credits": 3,
            "accumulated_debt_credits": 3,
            "gpa_semester": 0.85,
            "gpa_cumulative": 1.35,
        }
        res1 = evaluate_student_rules(rec_sem1)
        self.assertNotIn("R03_SEM_GPA_FLOOR", [h["rule_code"] for h in res1["hits"]])

        # Semester 2 with GPA 0.85 < 1.00 -> MUST trigger R03
        rec_sem2 = dict(rec_sem1, semester_seq=2)
        res2 = evaluate_student_rules(rec_sem2)
        self.assertIn("R03_SEM_GPA_FLOOR", [h["rule_code"] for h in res2["hits"]])

    def test_rule_r04_cumulative_gpa_by_year(self):
        # Year 2 threshold is 1.40; GPA 1.32 < 1.40 -> triggers R04
        rec = {
            "semester_seq": 4,
            "study_year": 2,
            "registered_credits": 16,
            "failed_credits": 3,
            "accumulated_debt_credits": 10,
            "gpa_semester": 1.45,
            "gpa_cumulative": 1.32,
        }
        res = evaluate_student_rules(rec)
        self.assertIn("R04_CUM_GPA_BY_YEAR", [h["rule_code"] for h in res["hits"]])

    def test_api_overview_and_archetypes(self):
        r_ov = self.client.get("/api/stats/overview")
        self.assertEqual(r_ov.status_code, 200)
        d_ov = r_ov.get_json()
        self.assertEqual(d_ov["total_students"], 180)
        self.assertGreater(d_ov["early_model_detected_count"], 0)

        # SV002: Early warning detected by model BEFORE hitting Circular 08 rule threshold
        r_sv2 = self.client.get("/api/students/SV002/assessment").get_json()
        self.assertEqual(r_sv2["assessment"]["rule_triggered"], 0)
        self.assertIn(r_sv2["assessment"]["risk_level"], ("ATTENTION", "HIGH_RISK"))

        # SV003: Regulatory violation (Rule Engine triggered -> forced HIGH_RISK)
        r_sv3 = self.client.get("/api/students/SV003/assessment").get_json()
        self.assertEqual(r_sv3["assessment"]["rule_triggered"], 1)
        self.assertEqual(r_sv3["assessment"]["risk_level"], "HIGH_RISK")

    def test_api_csv_import_row_validation(self):
        csv_payload = (
            "student_id,registered_credits,failed_credits,gpa_semester,gpa_cumulative,accumulated_debt_credits\n"
            "SV001,16,0,3.40,3.35,0\n"
            "SV004,14,18,2.10,2.20,6\n"
        )
        r = self.client.post("/api/data/import", json={"csv_text": csv_payload})
        self.assertEqual(r.status_code, 200)
        d = r.get_json()
        self.assertEqual(d["valid_count"], 1)
        self.assertEqual(d["error_count"], 1)

    def test_hexagonal_architecture_blueprint_and_use_case(self):
        r = self.client.get("/api/architecture/blueprint")
        self.assertEqual(r.status_code, 200)
        d = r.get_json()
        self.assertIn("Hexagonal Architecture", d["architecture_style"])
        self.assertEqual(d["live_hexagonal_probe"]["student_id"], "SV002")
        self.assertIn(d["live_hexagonal_probe"]["final_risk_level"], ("ATTENTION", "HIGH_RISK"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
