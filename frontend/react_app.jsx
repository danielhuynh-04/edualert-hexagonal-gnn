/**
 * ============================================================================
 * EduAlert — React 18 Hexagonal UI Components (Modular Reference Bundle)
 * Demonstrates Clean Frontend Architecture (Custom Hooks + Presentational Components)
 * communicating with the Node.js v24 BFF Gateway (/api/*).
 * Author: Huynh Le Thanh Hai — HCMC Open University
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from "react";

/**
 * Custom React Hook encapsulating BFF Gateway communication with X-Correlation-Id
 */
export function useStudentAssessment(initialStudentId = "SV002") {
  const [studentId, setStudentId] = useState(initialStudentId);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAssessment = useCallback(async (sid) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(sid)}/assessment`, {
        headers: { "X-Requested-With": "React-18-Hexagonal-Client" },
      });
      if (res.ok) {
        const payload = await res.json();
        setData(payload);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssessment(studentId);
  }, [studentId, fetchAssessment]);

  return { studentId, setStudentId, data, loading, refresh: () => fetchAssessment(studentId) };
}

/**
 * Signature Circular Stamp Component (Official Visual Assessment Slip)
 */
export function RiskStamp({ riskLevel, riskScore, predictedGpa, predictedStd }) {
  const levelConfig = {
    NORMAL: { label: "Bình thường", className: "lv-ok" },
    ATTENTION: { label: "Cần chú ý (Sớm)", className: "lv-mid" },
    HIGH_RISK: { label: "Nguy cơ cao", className: "lv-bad" },
  }[riskLevel] || { label: "Bình thường", className: "lv-ok" };

  return (
    <div className="stamp-wrapper">
      <div className={`stamp ${levelConfig.className}`}>
        <span className="lv">{levelConfig.label}</span>
        <span className="pv">{Math.round(riskScore)}%</span>
        <span className="pl">xác suất nguy cơ</span>
      </div>
      <div className="gpa-forecast">
        Dự báo ĐTB HK tới: <strong>{Number(predictedGpa).toFixed(2)} ± {Number(predictedStd).toFixed(2)}</strong>
      </div>
    </div>
  );
}

