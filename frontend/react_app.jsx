/**
 * ============================================================================
 * EduAlert — React 18 Hexagonal SPA (Single Page Application)
 * Impeccable Visual Craftsmanship & Academic Authority Design System
 * 
 * Compliant with:
 *  - Decision 08/2021/TT-BGDĐT (Article 11 — Mandatory Override)
 *  - Decree 13/2023/NĐ-CP (Personal Data Protection & Privacy)
 *  - pbakaus/impeccable Design Philosophy (Zero AI Slop, Charter Serif,
 *    Tabular Figures, Ink & Archival Paper, Symmetric Diverging SHAP Bars,
 *    Registrar Seal with Double Stamped Border, Error Boundary Protection)
 * 
 * Author: Huynh Le Thanh Hai — HCMC Open University
 * ============================================================================
 */

const { useState, useEffect, useMemo, useCallback, useRef, Component } = React;

// ============================================================================
// 0. REACT ERROR BOUNDARY (CHỐNG TRẮNG MÀN HÌNH - CRASH-SAFE GUARD)
// ============================================================================
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("EduAlert ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "30px",
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: "10px",
          margin: "24px auto",
          maxWidth: "860px",
          color: "#991B1B",
          fontFamily: "system-ui, sans-serif"
        }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "1.15rem" }}>
            ⚠️ Đã xảy ra lỗi giao diện hiển thị
          </h3>
          <p style={{ margin: "0 0 14px", fontSize: "0.85rem", color: "#7F1D1D" }}>
            Chi tiết lỗi: <code>{String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error)}</code>
          </p>
          <button
            type="button"
            className="primary"
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              if (this.props.onReset) this.props.onReset();
            }}
          >
            ↺ Thử khôi phục giao diện
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// 1. DATA ADAPTER & DEFENSIVE MAPPERS (CHUẨN HÓA DỮ LIỆU ĐA DẠNG)
// ============================================================================
const LEVEL_CONFIG = {
  NORMAL: { label: "Bình thường", stampClass: "lv-ok", badgeClass: "b-ok", color: "#166534", bg: "#F0FDF4" },
  ATTENTION: { label: "Cần chú ý", stampClass: "lv-mid", badgeClass: "b-mid", color: "#854D0E", bg: "#FEFCE8" },
  HIGH_RISK: { label: "Nguy cơ cao", stampClass: "lv-bad", badgeClass: "b-bad", color: "#991B1B", bg: "#FEF2F2" },
};

function getLevelMeta(lvl) {
  return LEVEL_CONFIG[lvl] || LEVEL_CONFIG.NORMAL;
}

function normalizeAssessment(raw) {
  if (!raw) return null;
  const a = raw.assessment || raw;
  const s = raw.student || {};

  // Extract recommendations string
  let hint = "";
  if (Array.isArray(a.recommendations)) {
    hint = a.recommendations.map((r) => r.replace(/<[^>]*>?/gm, "")).join(" ");
  } else if (typeof a.recommendations === "string") {
    hint = a.recommendations;
  } else if (a.advisor_action_hint) {
    hint = a.advisor_action_hint;
  }

  // Extract rule results
  const rawRules = raw.rule_checks || a.rule_results || [];
  const rule_results = rawRules.map((r) => ({
    rule_code: r.rule_code || "RULE",
    description: r.explanation || r.description || "Quy chế đào tạo",
    is_triggered: !!(r.triggered || r.is_triggered),
    detail: r.actual_value || r.detail || "",
  }));

  // Extract SHAP factors
  const rawFactors = raw.factors || a.shap_contributions || [];
  const shap_contributions = rawFactors.map((f) => {
    let val = 0;
    if (f.contribution != null) {
      val = Number(f.contribution);
      if (f.direction === "DECREASE" && val > 0) val = -val;
    } else if (f.value != null) {
      val = Number(f.value);
    }
    return {
      factor_name: f.factor_label || f.factor_name || f.factor_code || "Yếu tố",
      value: isNaN(val) ? 0 : val,
    };
  });

  // Extract sheaf peers
  const rawPeers = raw.peers || raw.peer_edges || a.neighbors_sheaf || [];
  const neighbors_sheaf = rawPeers.map((p) => ({
    neighbor_id: p.peer_id || p.neighbor_id || "SV---",
    neighbor_name: p.peer_name || p.neighbor_name || "",
    edge_type: p.edge_type || "Cùng học phần",
    gpa: p.peer_gpa != null ? Number(p.peer_gpa) : (p.gpa != null ? Number(p.gpa) : 0),
    alpha_weight: p.sheaf_attention != null ? Number(p.sheaf_attention) : (p.alpha_weight != null ? Number(p.alpha_weight) : 0.2),
  }));

  // Extract historical semesters
  const rawSems = raw.semesters || a.history || [];
  const history = rawSems.map((sem, idx) => ({
    semester: String(sem.semester_id || sem.semester || `HK${idx + 1}`),
    gpa_term: sem.gpa_semester != null ? Number(sem.gpa_semester) : (sem.gpa_term != null ? Number(sem.gpa_term) : 0),
    gpa_cum: sem.gpa_cumulative != null ? Number(sem.gpa_cumulative) : 0,
    failed_credits: sem.failed_credits != null ? Number(sem.failed_credits) : 0,
  }));

  const predGpa = a.predicted_next_gpa != null ? Number(a.predicted_next_gpa) : (a.predicted_gpa_next != null ? Number(a.predicted_gpa_next) : null);

  return {
    student_id: s.student_id || a.student_id || "SV002",
    student_name: s.full_name || s.student_name || a.student_name || "Sinh viên",
    class_name: s.class_name || a.class_name || "Chưa phân lớp",
    class_id: s.class_id || a.class_id || "",
    advisor_name: s.advisor_name || a.advisor_name || "TS. Nguyễn Thị Lan",
    risk_level: a.risk_level || "NORMAL",
    risk_score: Number(a.risk_score || (a.risk_probability ? a.risk_probability * 100 : 0)),
    predicted_gpa_next: predGpa,
    predicted_gpa_std: a.predicted_gpa_std != null ? Number(a.predicted_gpa_std) : 0.15,
    explanation_text: a.explanation_text || "Đang phân tích dữ liệu học tập.",
    advisor_action_hint: hint || "Theo dõi tiến độ học tập thường kỳ.",
    rule_results,
    shap_contributions,
    neighbors_sheaf,
    history,
    assessed_at: a.assessed_at || "2026-11-08",
  };
}

function normalizeCohorts(raw) {
  if (!raw) return [];
  const list = raw.rows || raw.cohorts || (Array.isArray(raw) ? raw : []);
  return list.map((r) => ({
    student_id: r.student_id || "",
    student_name: r.full_name || r.student_name || "",
    class_id: r.class_id || "",
    gpa_cumulative: r.gpa_cumulative != null ? Number(r.gpa_cumulative) : 0,
    failed_credits_cumulative: r.accumulated_debt_credits != null ? Number(r.accumulated_debt_credits) : (r.failed_credits_cumulative || 0),
    risk_score: r.risk_score != null ? Number(r.risk_score) : 0,
    risk_level: r.risk_level || "NORMAL",
    rule_violations_count: r.rule_triggered != null ? Number(r.rule_triggered) : (r.rule_violations_count || 0),
  }));
}

function normalizeGraph(raw) {
  if (!raw) return { nodes: [], edges: [] };
  const rawNodes = raw.nodes || [];
  const rawEdges = raw.edges || [];

  const nodes = rawNodes.map((n) => ({
    id: n.student_id || n.id || "",
    label: n.full_name || n.label || n.student_id || "",
    class_id: n.class_id || "DH23CS01",
    gpa: n.gpa_cumulative != null ? Number(n.gpa_cumulative) : (n.gpa != null ? Number(n.gpa) : 2.5),
    risk_level: n.risk_level || "NORMAL",
  }));

  const edges = rawEdges.map((e) => ({
    source: e.src_student || e.source || "",
    target: e.dst_student || e.target || "",
    sheaf_alpha: e.sheaf_attention != null ? Number(e.sheaf_attention) : (e.sheaf_alpha != null ? Number(e.sheaf_alpha) : 0.2),
    edge_type: e.edge_type || "SHARED_COURSE",
    weight: e.weight != null ? Number(e.weight) : 0.5,
  })).filter((e) => e.source && e.target);

  return { nodes, edges };
}

// ============================================================================
// COMPONENT 1: HEADER & ROLE NAVIGATION (RBAC / RLS)
// ============================================================================
function Header({ currentRole, onRoleChange, onExportClick }) {
  return (
    <header className="app">
      <div className="brand">
        <h1>EduAlert</h1>
        <span className="sub">
          Hệ thống cảnh báo sớm kết quả học tập đa cấp độ (Rule Engine TT08/2021 + Sheaf Attention GNN)
        </span>
      </div>
      <div className="rolebar">
        <span>Vai trò (RBAC/RLS):</span>
        <select
          id="roleSelect"
          className="rolesel"
          value={currentRole}
          onChange={(e) => onRoleChange(e.target.value)}
        >
          <option value="ALL">Phòng Đào tạo / BCN Khoa (Toàn trường)</option>
          <option value="1">CVHT: TS. Nguyễn Thị Lan (Phụ trách K23 CSDL)</option>
          <option value="2">CVHT: ThS. Trần Văn Minh (Phụ trách K24 AI)</option>
          <option value="3">CVHT: TS. Lê Hoàng Hùng (Phụ trách K23-24 HTTT)</option>
        </select>
        <button
          type="button"
          className="btn-export"
          onClick={onExportClick}
          title="Xuất bảng tổng hợp cohort định dạng CSV theo Thông tư 08"
        >
          ⬇ Xuất Excel/CSV (M12)
        </button>
      </div>
    </header>
  );
}

// ============================================================================
// COMPONENT 2: NOTICE BANNER (HYBRID ENGINE STATUS)
// ============================================================================
function NoticeBanner({ activeModelName }) {
  return (
    <div className="notice">
      <div>
        <strong>Kiến trúc Hybrid:</strong> Tầng quy chế (Thông tư 08/2021/TT-BGDĐT) có quyền ưu tiên tuyệt đối; Tầng dự báo (Sheaf Attention Network) phát hiện sớm xu hướng sụt giảm điểm và quan hệ dị thể giữa các nhóm sinh viên.
      </div>
      <div className="active-badge">
        Mô hình kích hoạt: {activeModelName || "Sheaf Attention v2.0"}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT 3: TAB NAVIGATION BAR (8 WORKFLOW TABS)
// ============================================================================
function TabBar({ activeTab, onTabSelect }) {
  const tabs = [
    { id: "dash", label: "M02 · Tổng quan (Dashboard)" },
    { id: "slip", label: "M03 & M04 · Phiếu cá nhân & Diễn biến" },
    { id: "cohort", label: "M05 · Danh sách toàn khóa (Cohort View)" },
    { id: "graph", label: "M06 · Đồ thị quan hệ (Sheaf Network)" },
    { id: "ops", label: "M08 & M09 · Can thiệp CVHT & Nhập liệu" },
    { id: "admin", label: "M10 & M11 · Quy chế & Benchmark Mô hình" },
    { id: "copilot", label: "🤖 Advisor Copilot (RAG + SQL)" },
    { id: "hex", label: "🏛 Kiến trúc Hexagonal (Node.js Gateway)" },
  ];

  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={activeTab === t.id}
          onClick={() => onTabSelect(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// COMPONENT 4: REGISTRAR SEAL (CON DẤU TRÒN ĐÓNG DẤU ĐÁNH GIÁ NGUY CƠ)
// ============================================================================
function RegistrarSeal({ riskLevel, riskScore, predictedGpa, predictedStd, studentId }) {
  const meta = getLevelMeta(riskLevel);
  return (
    <div className="seal-container">
      <div className={`stamp ${meta.stampClass}`} title={`Hội đồng đánh giá học vụ — ${meta.label}`}>
        <div className="seal-top-text">KHOA CNTT · ĐH MỞ TP.HCM</div>
        <div className="lv">{meta.label}</div>
        <div className="pv">{Math.round(riskScore || 0)}%</div>
        <div className="pl">Xác suất nguy cơ</div>
        <div className="seal-code">{studentId || "SV---"}</div>
      </div>
      <div className="gpa-forecast-box">
        <span className="fc-label">Dự báo ĐTB HK kế tiếp:</span>
        <strong className="fc-value">
          {predictedGpa != null ? Number(predictedGpa).toFixed(2) : "--"} 
          {predictedStd != null ? ` ± ${Number(predictedStd).toFixed(2)}` : ""}
        </strong>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT 5: DIVERGING SHAP CONTRIBUTIONS BAR (ĐỐI XỨNG QUA TRỤC 0)
// ============================================================================
function ShapDivergingBar({ shapData }) {
  if (!shapData || shapData.length === 0) {
    return <p className="hint">Chưa có phân tích đóng góp yếu tố cho sinh viên này.</p>;
  }

  // Find max absolute value to calibrate 50% midpoint
  const validVals = shapData.map((d) => Math.abs(Number(d.value) || 0));
  const maxAbs = Math.max(...validVals, 0.35);

  return (
    <div className="shap-block">
      <div className="shap-header">
        <span className="shap-title">Phân tích yếu tố đóng góp (SHAP Feature Attribution):</span>
        <span className="shap-sub">← Giảm nguy cơ (An toàn) | Tăng nguy cơ (Cảnh báo) →</span>
      </div>
      <div className="shap-list">
        {shapData.map((item, idx) => {
          const val = Number(item.value) || 0;
          const isPositive = val >= 0;
          const widthPct = Math.min(50, (Math.abs(val) / maxAbs) * 50);

          return (
            <div key={idx} className="fbar">
              <span className="fbar-name" title={item.factor_name}>{item.factor_name}</span>
              <div className="track">
                <div
                  className={`fill ${isPositive ? "pos" : "neg"}`}
                  style={{
                    width: `${widthPct.toFixed(1)}%`,
                    [isPositive ? "left" : "right"]: "50%",
                  }}
                />
              </div>
              <span className={`val ${isPositive ? "val-bad" : "val-ok"}`}>
                {isPositive ? `+${val.toFixed(2)}` : val.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT 6: M04 TRAJECTORY & FORECAST SVG CHART
// ============================================================================
function TrajectoryChart({ history, predictedGpa, predictedStd }) {
  if (!history || history.length === 0) {
    return (
      <div className="hint" style={{ padding: "20px", background: "#F8FAFC", borderRadius: "8px", textAlign: "center" }}>
        Chưa có dữ liệu lịch sử điểm từng kỳ của sinh viên này.
      </div>
    );
  }

  const width = 480;
  const height = 180;
  const padLeft = 45;
  const padRight = 35;
  const padTop = 20;
  const padBottom = 30;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const totalPoints = history.length + (predictedGpa != null ? 1 : 0);
  const stepX = chartW / Math.max(1, totalPoints - 1);

  const getY = (val) => padTop + chartH - ((Math.min(4.0, Math.max(0, Number(val) || 0)) / 4.0) * chartH);

  // Regulation floor at 1.60
  const yFloor = getY(1.6);

  // Past coordinates
  const pastCoords = history.map((item, idx) => ({
    x: padLeft + idx * stepX,
    y: getY(item.gpa_term),
    sem: String(item.semester || `HK${idx + 1}`).replace(/20/g, ""),
    gpa: item.gpa_term,
  }));

  let forecastCoord = null;
  let upperY = null;
  let lowerY = null;

  if (predictedGpa != null && pastCoords.length > 0) {
    const std = Number(predictedStd) || 0.15;
    forecastCoord = {
      x: padLeft + pastCoords.length * stepX,
      y: getY(predictedGpa),
      gpa: Number(predictedGpa),
      std,
    };
    upperY = getY(Math.min(4.0, Number(predictedGpa) + std));
    lowerY = getY(Math.max(0.0, Number(predictedGpa) - std));
  }

  const pastPath = pastCoords.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");

  return (
    <div className="svg-chart-wrapper">
      <svg viewBox={`0 0 ${width} ${height}`} className="trajectory-svg">
        {/* Background grid lines */}
        {[1.0, 2.0, 3.0, 4.0].map((v) => {
          const y = getY(v);
          return (
            <g key={v}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#E2E8F0" strokeDasharray="2 2" />
              <text x={padLeft - 6} y={y + 3} textAnchor="end" className="chart-label">{v.toFixed(1)}</text>
            </g>
          );
        })}

        {/* Regulation Floor threshold 1.6 */}
        <line x1={padLeft} y1={yFloor} x2={width - padRight} y2={yFloor} stroke="#EF4444" strokeWidth="1" strokeDasharray="3 3" />
        <text x={width - padRight} y={yFloor - 4} textAnchor="end" fill="#EF4444" className="chart-label-warn">Sàn TT08 (1.60)</text>

        {/* Forecast confidence band */}
        {forecastCoord && upperY != null && lowerY != null && (
          <path
            d={`M ${pastCoords[pastCoords.length - 1].x} ${pastCoords[pastCoords.length - 1].y}
               L ${forecastCoord.x} ${upperY.toFixed(1)}
               L ${forecastCoord.x} ${lowerY.toFixed(1)} Z`}
            fill="rgba(30, 58, 138, 0.12)"
          />
        )}

        {/* Past line */}
        <path d={pastPath} fill="none" stroke="#1E3A8A" strokeWidth="2.5" />

        {/* Forecast dotted connection */}
        {forecastCoord && (
          <line
            x1={pastCoords[pastCoords.length - 1].x}
            y1={pastCoords[pastCoords.length - 1].y}
            x2={forecastCoord.x}
            y2={forecastCoord.y}
            stroke="#1E3A8A"
            strokeWidth="2.5"
            strokeDasharray="4 4"
          />
        )}

        {/* Past points */}
        {pastCoords.map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r="4" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="2.5" />
            <text x={pt.x} y={height - 10} textAnchor="middle" className="chart-label">{pt.sem}</text>
            <text x={pt.x} y={pt.y - 8} textAnchor="middle" className="chart-value">{Number(pt.gpa).toFixed(2)}</text>
          </g>
        ))}

        {/* Forecast point */}
        {forecastCoord && (
          <g>
            <circle cx={forecastCoord.x} cy={forecastCoord.y} r="5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
            <text x={forecastCoord.x} y={height - 10} textAnchor="middle" className="chart-label-warn">Dự báo</text>
            <text x={forecastCoord.x} y={forecastCoord.y - 8} textAnchor="middle" fill="#EF4444" className="chart-value-bold">
              {Number(forecastCoord.gpa).toFixed(2)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ============================================================================
// TAB 1: M02 DASHBOARD OVERVIEW
// ============================================================================
function DashboardTab({ stats, bffTelemetry, onClassClick }) {
  if (!stats) return <div className="card loading-state">Đang tải dữ liệu tổng quan từ Node.js BFF Gateway...</div>;

  const counts = stats.counts || { NORMAL: 0, ATTENTION: 0, HIGH_RISK: 0 };
  const total = stats.total_students || 1;
  const safeRate = (((counts.NORMAL || 0) / total) * 100).toFixed(1);

  const trends = stats.semester_trends || stats.trend_4_semesters || [];
  const fairness = stats.fairness_by_admission || stats.fairness_audit || [];
  const classes = stats.class_breakdown || [];

  return (
    <div>
      {/* 5 KPI Pills */}
      <div className="kpi-row">
        <div className="pill">
          <span>Tổng sinh viên theo dõi</span>
          <b>{total}</b>
          <span className="sub-hint">Bảo vệ dữ liệu Nghị định 13</span>
        </div>
        <div className="pill" style={{ borderColor: "#FECACA", background: "#FEF2F2" }}>
          <span style={{ color: "#991B1B" }}>Nguy cơ cao (Đỏ)</span>
          <b style={{ color: "#991B1B" }}>{counts.HIGH_RISK || 0}</b>
          <span className="sub-hint">Cần can thiệp khẩn cấp</span>
        </div>
        <div className="pill" style={{ borderColor: "#FEF08A", background: "#FEFCE8" }}>
          <span style={{ color: "#854D0E" }}>Cần chú ý (Vàng)</span>
          <b style={{ color: "#854D0E" }}>{counts.ATTENTION || 0}</b>
          <span className="sub-hint">Phát hiện sớm trước sàn TT08</span>
        </div>
        <div className="pill" style={{ borderColor: "#BBF7D0", background: "#F0FDF4" }}>
          <span style={{ color: "#166534" }}>Bình thường (Xanh)</span>
          <b style={{ color: "#166534" }}>{counts.NORMAL || 0}</b>
          <span className="sub-hint">Học tập ổn định ({safeRate}%)</span>
        </div>
        <div className="pill">
          <span>ĐTB tích lũy trung bình</span>
          <b>{Number(stats.avg_gpa || 2.45).toFixed(2)}</b>
          <span className="sub-hint">{stats.total_interventions || 0} buổi can thiệp CVHT</span>
        </div>
      </div>

      {/* Gateway Telemetry Banner (From Node.js v24 BFF) */}
      {bffTelemetry && (
        <div className="gateway-telemetry-banner">
          <div className="gw-item">
            <span className="gw-dot green" />
            <span>Node.js v24 BFF Gateway: <strong>Circuit Breaker {bffTelemetry.circuit_breaker_state}</strong></span>
          </div>
          <div className="gw-item">
            <span>Độ trễ trung bình: <strong>{bffTelemetry.avg_latency_ms} ms</strong></span>
          </div>
          <div className="gw-item">
            <span>Correlation ID: <code>{bffTelemetry.correlation_id}</code></span>
          </div>
        </div>
      )}

      {/* Row 2: Trend & Fairness */}
      <div className="grid-equal">
        <div className="card">
          <h2>Xu hướng ĐTB và diễn biến cảnh báo qua các kỳ</h2>
          <p className="hint">Thống kê diễn biến các học kỳ gần nhất trên toàn bộ sinh viên.</p>
          <div className="trend-table-box">
            <table className="data">
              <thead>
                <tr>
                  <th>Học kỳ</th>
                  <th>ĐTB Học kỳ</th>
                  <th>ĐTB Tích lũy</th>
                  <th>Cảnh báo vi phạm</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((t, idx) => (
                  <tr key={idx}>
                    <td><strong>{t.semester_id || t.semester}</strong></td>
                    <td>{Number(t.avg_gpa_sem || t.avg_gpa || 0).toFixed(2)}</td>
                    <td>{Number(t.avg_gpa_cum || t.avg_gpa || 0).toFixed(2)}</td>
                    <td><span className="badge b-bad">{t.rule_warn_count != null ? t.rule_warn_count : (t.high_risk || 0)} ca</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Kiểm định công bằng thuật toán (Algorithmic Fairness Audit)</h2>
          <p className="hint">Mục 6.6 bản thảo: đối chiếu sai số dự báo giữa các phương thức xét tuyển để không thiên lệch.</p>
          <table className="data">
            <thead>
              <tr>
                <th>Phương thức tuyển sinh</th>
                <th>Số SV</th>
                <th>ĐTB Tích lũy</th>
                <th>Xác suất nguy cơ TB</th>
                <th>Sai số MAE dự báo</th>
              </tr>
            </thead>
            <tbody>
              {fairness.map((f, idx) => (
                <tr key={idx}>
                  <td><strong>{f.admission_method || f.method}</strong></td>
                  <td>{f.total || f.count}</td>
                  <td>{Number(f.avg_gpa || 0).toFixed(2)}</td>
                  <td>{Number(f.avg_risk_pct || f.avg_risk_score || 0).toFixed(1)}%</td>
                  <td><span className="badge b-ok">{Number(f.mae_gap || 0.05).toFixed(3)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Class Breakdown */}
      <div className="card">
        <h2>Thống kê mức độ nguy cơ theo Lớp sinh hoạt &amp; Cố vấn học tập</h2>
        <p className="hint">Nhấp vào dòng bất kỳ để chuyển sang lọc lớp tương ứng trong Cohort View (M05).</p>
        <table className="data">
          <thead>
            <tr>
              <th>Mã Lớp</th>
              <th>Tên lớp</th>
              <th>Cố vấn học tập</th>
              <th>Sĩ số</th>
              <th>ĐTB Lớp</th>
              <th>Nguy cơ cao (Đỏ)</th>
              <th>Cần chú ý (Vàng)</th>
              <th>Bình thường (Xanh)</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c, idx) => (
              <tr key={idx} onClick={() => onClassClick(c.class_id)} style={{ cursor: "pointer" }}>
                <td><strong>{c.class_id}</strong></td>
                <td>{c.class_name}</td>
                <td>{c.advisor_name}</td>
                <td>{c.total_students || c.total || 0}</td>
                <td>{Number(c.avg_gpa || 0).toFixed(2)}</td>
                <td><span className="badge b-bad">{c.high_risk || 0}</span></td>
                <td><span className="badge b-mid">{c.attention || 0}</span></td>
                <td><span className="badge b-ok">{c.normal || 0}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 2: M03 & M04 INDIVIDUAL SLIP & WHAT-IF SIMULATOR
// ============================================================================
function IndividualSlipTab({
  studentId,
  onStudentIdChange,
  assessmentData,
  loading,
  onQuickPick,
  onSimulate,
  simResult,
}) {
  const [showSim, setShowSim] = useState(false);
  const [simGpa, setSimGpa] = useState(1.45);
  const [simDebt, setSimDebt] = useState(10);
  const [simConduct, setSimConduct] = useState(65);
  const [simConsec, setSimConsec] = useState(0);

  const displayRaw = simResult || assessmentData;
  const assessment = useMemo(() => normalizeAssessment(displayRaw), [displayRaw]);

  const handleSimSubmit = (e) => {
    e.preventDefault();
    onSimulate({
      student_id: studentId,
      sim_gpa: parseFloat(simGpa),
      sim_debt: parseInt(simDebt, 10),
      sim_conduct: parseInt(simConduct, 10),
      consecutive_warnings: parseInt(simConsec, 10),
    });
  };

  return (
    <div>
      {/* Search and Quick Pick Bar */}
      <div className="card picker-bar">
        <div className="picker-left">
          <label><strong>Tra cứu mã hồ sơ sinh viên:</strong></label>
          <div className="picker-inputs">
            <input
              type="text"
              value={studentId}
              onChange={(e) => onStudentIdChange(e.target.value.toUpperCase().trim())}
              placeholder="VD: SV002"
              style={{ maxWidth: "140px" }}
            />
            <button type="button" className="small" onClick={() => onQuickPick("SV002")}>Mẫu Vàng sớm (SV002 - Tụt điểm)</button>
            <button type="button" className="small" onClick={() => onQuickPick("SV003")}>Mẫu Đỏ TT08 (SV003)</button>
            <button type="button" className="small" onClick={() => onQuickPick("SV001")}>Mẫu An toàn (SV001)</button>
            <button type="button" className="small" onClick={() => onQuickPick("SV005")}>Mẫu Thôi học (SV005)</button>
          </div>
        </div>
        <div>
          <button type="button" className="small toggle-sim-btn" onClick={() => setShowSim(!showSim)}>
            {showSim ? "✕ Đóng bộ giả lập What-If" : "⚙ Mở bộ giả lập What-If trực tiếp"}
          </button>
        </div>
      </div>

      {/* Optional What-If Simulator Panel */}
      {showSim && (
        <div className="card sim-panel">
          <h2>Bộ giả lập học vụ What-If (Thử nghiệm kịch bản học kỳ tới)</h2>
          <p className="hint">
            Điều chỉnh trực tiếp các chỉ số giả định để kiểm tra phản ứng tức thời của Rule Engine Thông tư 08 và Sheaf Attention GNN mà không làm thay đổi cơ sở dữ liệu thật.
          </p>
          <form onSubmit={handleSimSubmit} className="grid2">
            <div>
              <div className="row">
                <div>
                  <label>ĐTB dự kiến HK tới (0.0 – 4.0):</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="4"
                    value={simGpa}
                    onChange={(e) => setSimGpa(e.target.value)}
                  />
                </div>
                <div>
                  <label>Số tín chỉ nợ tích lũy:</label>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={simDebt}
                    onChange={(e) => setSimDebt(e.target.value)}
                  />
                </div>
              </div>
              <div className="row">
                <div>
                  <label>Điểm rèn luyện giả định (0 – 100):</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={simConduct}
                    onChange={(e) => setSimConduct(e.target.value)}
                  />
                </div>
                <div>
                  <label>Số lần cảnh báo liên tiếp trước:</label>
                  <input
                    type="number"
                    min="0"
                    max="3"
                    value={simConsec}
                    onChange={(e) => setSimConsec(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" className="primary" style={{ marginTop: "10px" }}>
                ▶ Chạy đánh giá kịch bản What-If
              </button>
              {simResult && (
                <button
                  type="button"
                  className="small"
                  style={{ marginLeft: "8px" }}
                  onClick={() => onSimulate(null)}
                >
                  Khôi phục dữ liệu gốc
                </button>
              )}
            </div>
            <div className="sim-expl">
              <strong>Nguyên tắc đánh giá tức thời:</strong>
              <ul>
                <li>Nếu ĐTB tích lũy chạm sàn năm học (Điều 11.1.d) hoặc nợ quá 24 TC (11.1.b) → Rule Engine kích hoạt ngay mức <strong>Nguy cơ cao</strong>.</li>
                <li>Nếu 2 lần cảnh báo liên tiếp (Điều 11.2) → Kích hoạt điều kiện <strong>Buộc thôi học</strong>.</li>
                <li>Nếu các quy chế không chạm nhưng xu hướng giảm dốc → Sheaf GNN gán mức <strong>Cần chú ý</strong>.</li>
              </ul>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="card loading-state">Đang tải hồ sơ sinh viên {studentId}...</div>}

      {!loading && !assessment && (
        <div className="card hint">Không tìm thấy dữ liệu cho mã sinh viên: {studentId}</div>
      )}

      {!loading && assessment && (
        <div className="grid2">
          {/* Left Column: Visual Charts & Sheaf Relations */}
          <div>
            <div className="card">
              <h2>M04 · Diễn biến học tập &amp; Dự báo kỳ tới</h2>
              <p className="hint">Đường nét liền là quá khứ, đoạn nét đứt chuyển tiếp sang kỳ kế tiếp dự báo bởi Sheaf Attention.</p>
              <TrajectoryChart
                history={assessment.history}
                predictedGpa={assessment.predicted_gpa_next}
                predictedStd={assessment.predicted_gpa_std}
              />
            </div>

            <div className="card">
              <h2>Quan hệ đồ thị lân cận (Top cạnh Sheaf Attention)</h2>
              <p className="hint">Trọng số attention &alpha;<sub>vu</sub> cho biết nhóm sinh viên nào có ảnh hưởng tương hỗ lớn nhất.</p>
              <table className="data">
                <thead>
                  <tr>
                    <th>SV Lân cận</th>
                    <th>Quan hệ cạnh</th>
                    <th>ĐTB TL</th>
                    <th>Trọng số Sheaf &alpha;</th>
                  </tr>
                </thead>
                <tbody>
                  {(assessment.neighbors_sheaf || []).map((nb, i) => (
                    <tr key={i} onClick={() => onStudentIdChange(nb.neighbor_id)} style={{ cursor: "pointer" }}>
                      <td><strong>{nb.neighbor_id}</strong> - {nb.neighbor_name}</td>
                      <td>{nb.edge_type}</td>
                      <td>{Number(nb.gpa).toFixed(2)}</td>
                      <td><span className="badge b-mid">{Number(nb.alpha_weight).toFixed(3)}</span></td>
                    </tr>
                  ))}
                  {(!assessment.neighbors_sheaf || assessment.neighbors_sheaf.length === 0) && (
                    <tr><td colSpan="4" className="hint">Không có cạnh liên kết đồ thị đáng kể.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Signature Result Slip (Phiếu Đánh Giá Chính Thức) */}
          <div className="slip">
            <div className="slip-head">
              <div className="org">TRƯỜNG ĐẠI HỌC MỞ THÀNH PHỐ HỒ CHÍ MINH — KHOA CÔNG NGHỆ THÔNG TIN</div>
              <h3>PHIẾU ĐÁNH GIÁ NGUY CƠ HỌC VỤ &amp; HỌC TẬP</h3>
              <div className="meta">
                Mã SV: <strong>{assessment.student_id}</strong> · Họ tên: <strong>{assessment.student_name}</strong> · Lớp: <strong>{assessment.class_name}</strong>
              </div>
              <div className="meta-sub">
                Cố vấn học tập: <strong>{assessment.advisor_name}</strong> · Đánh giá lúc: <strong>{assessment.assessed_at}</strong>
              </div>
            </div>

            <div className="slip-body">
              {/* Registrar Seal */}
              <RegistrarSeal
                riskLevel={assessment.risk_level}
                riskScore={assessment.risk_score}
                predictedGpa={assessment.predicted_gpa_next}
                predictedStd={assessment.predicted_gpa_std}
                studentId={assessment.student_id}
              />

              {/* Detail Content */}
              <div className="slip-content">
                {/* Rule box */}
                <div className={`rulebox ${assessment.rule_results && assessment.rule_results.some((r) => r.is_triggered) ? "trig" : "clear"}`}>
                  <h4>Kết luận Tầng Quy chế (Thông tư 08/2021/TT-BGDĐT):</h4>
                  {assessment.rule_results && assessment.rule_results.length > 0 ? (
                    <ul>
                      {assessment.rule_results.map((r, idx) => (
                        <li key={idx} className={r.is_triggered ? "hit" : ""}>
                          {r.is_triggered ? "❌ " : "✓ "} <strong>[{r.rule_code}]</strong> {r.description}: {r.detail}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Không vi phạm điều kiện quy chế đào tạo tín chỉ nào.</p>
                  )}
                </div>

                {/* Natural language explanation */}
                <div className="expl">
                  <strong>Giải thích nguyên nhân: </strong>
                  {assessment.explanation_text}
                </div>

                {/* Advisor Action Hint */}
                <div className="advisor-hint-box">
                  <strong>Gợi ý can thiệp cho CVHT: </strong>
                  {assessment.advisor_action_hint}
                </div>

                {/* SHAP Diverging Bar */}
                <ShapDivergingBar shapData={assessment.shap_contributions} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB 3: M05 COHORT VIEW
// ============================================================================
function CohortTab({ cohorts, onSelectStudent, currentRole }) {
  const [filterClass, setFilterClass] = useState("ALL");
  const [filterRisk, setFilterRisk] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const cohortList = useMemo(() => normalizeCohorts(cohorts), [cohorts]);

  const filtered = useMemo(() => {
    return cohortList.filter((s) => {
      if (filterClass !== "ALL" && s.class_id !== filterClass) return false;
      if (filterRisk !== "ALL" && s.risk_level !== filterRisk) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const sid = (s.student_id || "").toLowerCase();
        const sname = (s.student_name || "").toLowerCase();
        if (!sid.includes(q) && !sname.includes(q)) return false;
      }
      return true;
    });
  }, [cohortList, filterClass, filterRisk, searchTerm]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Available classes
  const classList = useMemo(() => {
    const set = new Set();
    cohortList.forEach((c) => { if (c.class_id) set.add(c.class_id); });
    return Array.from(set);
  }, [cohortList]);

  return (
    <div>
      <div className="card filter-bar">
        <div className="filter-item">
          <label>Lọc theo Lớp sinh hoạt:</label>
          <select value={filterClass} onChange={(e) => { setFilterClass(e.target.value); setPage(1); }}>
            <option value="ALL">-- Tất cả các lớp --</option>
            {classList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label>Lọc theo Mức độ nguy cơ:</label>
          <select value={filterRisk} onChange={(e) => { setFilterRisk(e.target.value); setPage(1); }}>
            <option value="ALL">-- Tất cả mức độ --</option>
            <option value="HIGH_RISK">🔴 Nguy cơ cao (Ưu tiên gặp)</option>
            <option value="ATTENTION">🟡 Cần chú ý (Sớm)</option>
            <option value="NORMAL">🟢 Bình thường</option>
          </select>
        </div>
        <div className="filter-item" style={{ flex: 1 }}>
          <label>Tìm kiếm Mã sinh viên hoặc Họ tên:</label>
          <input
            type="text"
            placeholder="Nhập MSSV (SV001...) hoặc tên sinh viên"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>
        <div className="filter-count">
          <span>Tìm thấy: <strong>{filtered.length}</strong> sinh viên</span>
        </div>
      </div>

      <div className="card">
        <table className="data">
          <thead>
            <tr>
              <th>Mã SV</th>
              <th>Họ và tên</th>
              <th>Lớp</th>
              <th>ĐTB Tích lũy</th>
              <th>Nợ tín chỉ</th>
              <th>Xác suất nguy cơ</th>
              <th>Mức độ</th>
              <th>Quy chế TT08</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((s) => {
              const meta = getLevelMeta(s.risk_level);
              return (
                <tr key={s.student_id}>
                  <td><strong>{s.student_id}</strong></td>
                  <td>{s.student_name}</td>
                  <td>{s.class_id}</td>
                  <td>{Number(s.gpa_cumulative).toFixed(2)}</td>
                  <td>{s.failed_credits_cumulative} TC</td>
                  <td>{Math.round(s.risk_score)}%</td>
                  <td><span className={`badge ${meta.badgeClass}`}>{meta.label}</span></td>
                  <td>
                    {s.rule_violations_count > 0 ? (
                      <span className="badge b-bad">{s.rule_violations_count} vi phạm</span>
                    ) : (
                      <span className="badge b-ok">Đạt chuẩn</span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="small" onClick={() => onSelectStudent(s.student_id)}>
                      Xem phiếu M03
                    </button>
                  </td>
                </tr>
              );
            })}
            {paginated.length === 0 && (
              <tr>
                <td colSpan="9" style={{ textAlign: "center", padding: "24px" }} className="hint">
                  Không tìm thấy sinh viên nào khớp với điều kiện lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <button type="button" className="small" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              ← Trang trước
            </button>
            <span className="page-indicator">Trang {page} / {totalPages}</span>
            <button type="button" className="small" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              Trang kế →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TAB 4: M06 SHEAF GRAPH NETWORK VISUALIZER (SVG CRASH-SAFE GRAPH)
// ============================================================================
function GraphNetworkTab({ graphData, onSelectStudent }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterClass, setFilterClass] = useState("ALL");

  const normalized = useMemo(() => normalizeGraph(graphData), [graphData]);

  const width = 840;
  const height = 520;
  const cx = width / 2;
  const cy = height / 2;

  // Filter nodes if needed
  const visibleNodes = useMemo(() => {
    return normalized.nodes.filter((n) => filterClass === "ALL" || n.class_id === filterClass);
  }, [normalized.nodes, filterClass]);

  // Position nodes radially / clustered by class
  const nodePositions = useMemo(() => {
    const map = new Map();
    const classGroups = {};
    visibleNodes.forEach((n) => {
      const cid = n.class_id || "OTHER";
      if (!classGroups[cid]) classGroups[cid] = [];
      classGroups[cid].push(n);
    });

    const cKeys = Object.keys(classGroups);
    cKeys.forEach((cid, cIdx) => {
      const clusterAngle = (cIdx / Math.max(1, cKeys.length)) * 2 * Math.PI;
      const clusterRadius = cKeys.length > 1 ? 140 : 0;
      const cX = cx + Math.cos(clusterAngle) * clusterRadius;
      const cY = cy + Math.sin(clusterAngle) * clusterRadius;

      const group = classGroups[cid];
      group.forEach((node, nIdx) => {
        const nodeAngle = (nIdx / Math.max(1, group.length)) * 2 * Math.PI;
        const nodeRadius = 35 + (nIdx % 3) * 35;
        const x = cX + Math.cos(nodeAngle) * nodeRadius;
        const y = cY + Math.sin(nodeAngle) * nodeRadius;
        map.set(node.id, { x, y, node });
      });
    });

    return map;
  }, [visibleNodes, cx, cy]);

  const visibleEdges = useMemo(() => {
    return normalized.edges.filter((e) => {
      return e.source && e.target && nodePositions.has(e.source) && nodePositions.has(e.target);
    });
  }, [normalized.edges, nodePositions]);

  return (
    <div className="grid2">
      <div>
        <div className="card">
          <div className="graph-controls">
            <h2>M06 · Đồ thị Sheaf Attention Network ({visibleNodes.length} Nodes / {visibleEdges.length} Edges)</h2>
            <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
              <option value="ALL">-- Hiển thị tất cả các lớp --</option>
              <option value="DH23CS01">Lớp DH23CS01 (Chuyên ngành CSDL)</option>
              <option value="DH24AI02">Lớp DH24AI02 (Chuyên ngành AI)</option>
              <option value="DH23HT01">Lớp DH23HT01 (Hệ thống thông tin)</option>
            </select>
          </div>
          <p className="hint">
            Nhấp chuột vào một nút sinh viên để highlight lân cận và xem trọng số attention &alpha;<sub>vu</sub>.
          </p>

          <div className="svg-graph-box">
            <svg viewBox={`0 0 ${width} ${height}`} className="network-svg">
              {/* Edges */}
              {visibleEdges.map((e, idx) => {
                const s = nodePositions.get(e.source);
                const t = nodePositions.get(e.target);
                if (!s || !t) return null;

                const isConnected = selectedNode && (e.source === selectedNode.id || e.target === selectedNode.id);
                const strokeWidth = isConnected ? 2.5 : Math.max(0.6, (e.sheaf_alpha || 0.15) * 3);
                const strokeColor = isConnected ? "#1E3A8A" : "#CBD5E1";

                return (
                  <line
                    key={idx}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={isConnected ? 0.9 : 0.45}
                  />
                );
              })}

              {/* Nodes */}
              {Array.from(nodePositions.values()).map(({ x, y, node }) => {
                const isSelected = selectedNode && selectedNode.id === node.id;
                const meta = getLevelMeta(node.risk_level);

                return (
                  <g
                    key={node.id}
                    className="graph-node-group"
                    onClick={() => setSelectedNode(node)}
                    style={{ cursor: "pointer" }}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 11 : 7.5}
                      fill={meta.color}
                      stroke={isSelected ? "#0F172A" : "#FFFFFF"}
                      strokeWidth={isSelected ? 3 : 1.5}
                    />
                    <text
                      x={x}
                      y={y - 10}
                      textAnchor="middle"
                      className="node-label"
                      fill={isSelected ? "#0F172A" : "#475569"}
                    >
                      {node.id}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Selected Node Details Sidecard */}
      <div>
        <div className="card">
          <h2>Chi tiết Nút mạng đã chọn</h2>
          {selectedNode ? (
            <div className="node-detail">
              <div className="node-badge-row">
                <span className="node-id-large">{selectedNode.id}</span>
                <span className={`badge ${getLevelMeta(selectedNode.risk_level).badgeClass}`}>
                  {getLevelMeta(selectedNode.risk_level).label}
                </span>
              </div>
              <p><strong>Họ tên:</strong> {selectedNode.label}</p>
              <p><strong>Lớp:</strong> {selectedNode.class_id}</p>
              <p><strong>ĐTB Tích lũy:</strong> {Number(selectedNode.gpa).toFixed(2)}</p>

              <button
                type="button"
                className="primary"
                style={{ width: "100%", marginTop: "12px" }}
                onClick={() => onSelectStudent(selectedNode.id)}
              >
                Mở Phiếu Đánh Giá Đầy Đủ (M03)
              </button>
            </div>
          ) : (
            <p className="hint">Nhấp vào một nút trên đồ thị để xem thông tin chi tiết và trọng số Sheaf.</p>
          )}
        </div>

        <div className="card">
          <h2>Cơ chế Sheaf Attention Networks</h2>
          <p className="hint" style={{ lineHeight: "1.6" }}>
            Trong môi trường đào tạo tín chỉ, sinh viên khá và sinh viên yếu cùng làm việc nhóm là quan hệ dị thể (heterophily). Mô hình Sheaf gán mỗi cạnh một ánh xạ hạn chế học được F<sub>ve</sub><sup>T</sup> F<sub>ue</sub> và trọng số chú ý &alpha;<sub>vu</sub>, triệt tiêu hiện tượng over-smoothing để phát hiện sớm sinh viên có nguy cơ rớt môn.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 5: M08 & M09 INTERVENTIONS & DATA IMPORT
// ============================================================================
function InterventionsTab({ interventions, onAddIntervention, onUploadCsv }) {
  const [sid, setSid] = useState("SV002");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [itype, setItype] = useState("Gặp trực tiếp");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("Theo dõi");
  const [csvContent, setCsvContent] = useState("");
  const [importReport, setImportReport] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddIntervention({
      student_id: sid,
      intervention_date: date,
      intervention_type: itype,
      notes,
      outcome,
    });
    setNotes("");
  };

  const handleCsvSubmit = (e) => {
    e.preventDefault();
    if (!csvContent.trim()) return;
    onUploadCsv(csvContent, (res) => {
      setImportReport(res);
    });
  };

  const list = Array.isArray(interventions) ? interventions : [];

  return (
    <div className="grid2">
      {/* M08: Intervention History & Form */}
      <div>
        <div className="card">
          <h2>M08 · Ghi nhận can thiệp của Cố vấn học tập</h2>
          <p className="hint">Ghi nhận biên bản làm việc, lịch hẹn và giải pháp hỗ trợ sinh viên có nguy cơ.</p>
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div>
                <label>Mã sinh viên:</label>
                <input type="text" value={sid} onChange={(e) => setSid(e.target.value.toUpperCase())} required />
              </div>
              <div>
                <label>Ngày làm việc:</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>
            <div className="row">
              <div>
                <label>Hình thức can thiệp:</label>
                <select value={itype} onChange={(e) => setItype(e.target.value)}>
                  <option value="Gặp trực tiếp">Gặp trực tiếp tại văn phòng</option>
                  <option value="Trao đổi trực tuyến">Trao đổi qua Google Meet / MS Teams</option>
                  <option value="Email thông báo">Gửi thông báo qua Email</option>
                  <option value="Liên hệ gia đình">Liên hệ phụ huynh / gia đình</option>
                </select>
              </div>
              <div>
                <label>Kết quả theo dõi:</label>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                  <option value="Theo dõi">Tiếp tục theo dõi tiến độ</option>
                  <option value="Đăng ký học lại">Đã hướng dẫn đăng ký học lại</option>
                  <option value="Cải thiện">Có chuyển biến tích cực</option>
                  <option value="Đề xuất thôi học">Đề xuất xử lý buộc thôi học</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: "10px" }}>
              <label>Nội dung làm việc &amp; Cam kết của sinh viên:</label>
              <textarea
                rows="3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VD: Sinh viên cam kết đi học chuyên cần môn Cấu trúc dữ liệu, đăng ký phụ đạo..."
                required
              />
            </div>
            <button type="submit" className="primary">Ghi nhận biên bản can thiệp</button>
          </form>
        </div>

        <div className="card">
          <h2>Lịch sử can thiệp gần đây</h2>
          <table className="data">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Mã SV</th>
                <th>Hình thức</th>
                <th>Kết quả</th>
                <th>Nội dung</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 8).map((it, idx) => (
                <tr key={idx}>
                  <td>{it.meeting_date || it.intervention_date}</td>
                  <td><strong>{it.student_id}</strong></td>
                  <td>{it.intervention_type}</td>
                  <td><span className="badge b-mid">{it.outcome}</span></td>
                  <td>{it.notes}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan="5" className="hint">Chưa có lịch sử can thiệp nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* M09: Data Import & Row-level Validation */}
      <div>
        <div className="card">
          <h2>M09 · Nhập dữ liệu học kỳ &amp; Kiểm tra hợp lệ từng dòng</h2>
          <p className="hint">
            Hỗ trợ Phòng Đào tạo tải lên tệp CSV/Excel điểm kết thúc học kỳ. Kiểm tra ràng buộc schema và tính toàn vẹn trước khi nạp vào CSDL.
          </p>
          <form onSubmit={handleCsvSubmit}>
            <div style={{ marginBottom: "10px" }}>
              <label>Dán nội dung CSV (hoặc sử dụng dữ liệu mẫu kiểm thử):</label>
              <textarea
                rows="8"
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`student_id,semester,gpa_term,gpa_cumulative,failed_credits\nSV002,2025_HK2,1.40,1.90,6\nSV003,2025_HK2,0.95,1.15,12`}
              />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" className="primary">Kiểm tra hợp lệ &amp; Nạp dữ liệu</button>
              <button
                type="button"
                className="small"
                onClick={() => setCsvContent(
                  `student_id,semester,gpa_term,gpa_cumulative,failed_credits\nSV002,2025_HK2,1.35,1.88,6\nSV003,2025_HK2,0.85,1.10,14\nSV099,2025_HK2,9.99,1.50,-2`
                )}
              >
                Chèn mẫu kiểm thử (Có lỗi)
              </button>
            </div>
          </form>

          {importReport && (
            <div className={`import-result ${importReport.status === "ok" ? "res-ok" : "res-err"}`}>
              <h4>Kết quả kiểm định dữ liệu (Row-level Validation):</h4>
              <p>Tổng số dòng: <strong>{importReport.total_rows}</strong> · Hợp lệ: <strong>{importReport.valid_rows}</strong> · Lỗi: <strong>{importReport.error_rows}</strong></p>
              {importReport.errors && importReport.errors.length > 0 && (
                <ul>
                  {importReport.errors.map((err, i) => (
                    <li key={i}><strong>Dòng {err.line}:</strong> {err.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 6: M10 & M11 REGULATIONS & MODEL BENCHMARK
// ============================================================================
function AdminTab({ rules, models, onActivateModel }) {
  const ruleList = Array.isArray(rules) ? rules : [];
  const modelList = Array.isArray(models) ? models : [];

  return (
    <div className="grid2">
      {/* M10: Regulation Config */}
      <div>
        <div className="card">
          <h2>M10 · Cấu hình tham số Quy chế Đào tạo (Thông tư 08/2021)</h2>
          <p className="hint">
            Các tham số cảnh báo và buộc thôi học được cấu hình động theo niên khóa và quy chế của Trường Đại học Mở TP.HCM.
          </p>
          <table className="data">
            <thead>
              <tr>
                <th>Mã điều</th>
                <th>Mô tả quy chế</th>
                <th>Giá trị ngưỡng</th>
                <th>Đơn vị</th>
              </tr>
            </thead>
            <tbody>
              {ruleList.map((r) => (
                <tr key={r.rule_code}>
                  <td><strong>{r.rule_code}</strong></td>
                  <td>{r.description}</td>
                  <td><span className="badge b-bad">{r.threshold}</span></td>
                  <td>{r.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* M11: Model Benchmark & Permutation Test */}
      <div>
        <div className="card">
          <h2>M11 · Đối sánh hiệu năng 6 Mô hình (Benchmarking)</h2>
          <p className="hint">
            Đối sánh với mô hình cơ sở bảng và kiểm định hoán vị nhãn (Permutation Test) 5 seed chống rò rỉ dữ liệu.
          </p>
          <table className="data">
            <thead>
              <tr>
                <th>Mô hình</th>
                <th>Macro-F1</th>
                <th>Recall Nhóm Đỏ</th>
                <th>PR-AUC</th>
                <th>MAE (GPA)</th>
                <th>Permutation p-val</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {modelList.map((m) => (
                <tr key={m.run_id} style={{ background: m.is_active ? "#EFF6FF" : "transparent" }}>
                  <td><strong>{m.model_name}</strong> {m.is_active && "★ (Active)"}</td>
                  <td>{Number(m.macro_f1).toFixed(3)}</td>
                  <td>{Number(m.recall_high_risk).toFixed(3)}</td>
                  <td>{Number(m.pr_auc).toFixed(3)}</td>
                  <td>{Number(m.gpa_mae || m.mae_gpa || 0.12).toFixed(3)}</td>
                  <td><span className="badge b-ok">{m.permutation_p_value || "< 0.001"}</span></td>
                  <td>
                    {m.is_active ? (
                      <span className="badge b-ok">Đang chạy</span>
                    ) : (
                      <button type="button" className="small" onClick={() => onActivateModel(m.run_id)}>
                        Kích hoạt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 7: ADVISOR COPILOT (RAG + TEXT-TO-SQL)
// ============================================================================
function AdvisorCopilotTab() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Xin chào Thầy/Cô Cố vấn học tập! Tôi là EduAlert Advisor Copilot. Tôi có thể hỗ trợ giải đáp nhanh các điều khoản Thông tư 08/2021/TT-BGDĐT hoặc tra cứu danh sách học vụ trong cơ sở dữ liệu.",
      citation: "Thông tư 08/2021/TT-BGDĐT · Điều 11",
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (qText) => {
    const textToSend = qText || query;
    if (!textToSend.trim()) return;

    const userMsg = { sender: "user", text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch("/api/copilot/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToSend, question: textToSend }),
      });
      if (res.ok) {
        const data = await res.json();
        const cit = Array.isArray(data.citations) ? data.citations.join(" · ") : (data.citations || data.legal_basis || "");
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: data.answer || "Không có phản hồi từ hệ thống.",
            citation: cit,
            sql: data.sql_executed || data.sql_query,
          },
        ]);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "Xin lỗi: " + (errJson.error || "Đã xảy ra lỗi khi kết nối tới Copilot Service.") },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Lỗi kết nối Copilot: " + e.message },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const chips = [
    "Điều kiện cảnh báo học tập và buộc thôi học theo Thông tư 08?",
    "Danh sách sinh viên nợ trên 10 tín chỉ lớp DH23CS01",
    "Vì sao sinh viên SV002 bị xếp vào mức Cần chú ý?",
    "Trường hợp nào sinh viên bị cảnh báo học tập lần thứ hai?",
  ];

  return (
    <div className="card copilot-container">
      <h2>🤖 EduAlert Advisor Copilot (RAG Quy chế &amp; Text-to-SQL An toàn)</h2>
      <p className="hint">
        Hệ thống truy xuất tăng cường (RAG) trích dẫn trực tiếp Điều 11 Thông tư 08/2021/TT-BGDĐT và sinh câu lệnh SQL chỉ đọc (Read-only) có kiểm soát.
      </p>

      {/* Suggestion Chips */}
      <div className="copilot-chips">
        {chips.map((chip, idx) => (
          <button key={idx} type="button" className="chip-btn" onClick={() => handleSend(chip)}>
            {chip}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div className="chat-window">
        {messages.map((m, idx) => (
          <div key={idx} className={`chat-bubble ${m.sender}`}>
            <div className="chat-text">{m.text}</div>
            {m.citation && (
              <div className="chat-citation">
                <strong>Căn cứ pháp lý:</strong> {m.citation}
              </div>
            )}
            {m.sql && (
              <div className="chat-sql">
                <code>{m.sql}</code>
              </div>
            )}
          </div>
        ))}
        {loading && <div className="chat-bubble bot hint">Copilot đang phân tích quy chế...</div>}
      </div>

      {/* Input row */}
      <div className="chat-input-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Nhập câu hỏi quy chế hoặc yêu cầu tra cứu..."
        />
        <button type="button" className="primary" onClick={() => handleSend()}>Gửi câu hỏi</button>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 8: HEXAGONAL ARCHITECTURE & GATEWAY TELEMETRY
// ============================================================================
function HexagonalTab({ bffTelemetry, onResetCircuitBreaker }) {
  return (
    <div>
      <div className="card">
        <h2>🏛 Kiến trúc Lục giác (Hexagonal Architecture / Ports &amp; Adapters)</h2>
        <p className="hint">
          EduAlert tách biệt hoàn toàn Lõi nghiệp vụ (Domain Core &amp; Golden Invariant) khỏi các giao tiếp công nghệ (Flask, Node.js Gateway, React SPA, SQLite, PyTorch GNN).
        </p>

        <div className="hex-diagram-box">
          <div className="hex-column driving">
            <h3>Primary / Driving Adapters</h3>
            <div className="hex-card">Node.js v24 BFF Gateway (Port 3000)</div>
            <div className="hex-card">React 18 Single Page App (Offline Bundle)</div>
            <div className="hex-card">Flask REST Controllers (/api/*)</div>
          </div>

          <div className="hex-column core">
            <h3>Hexagonal Domain Core (Lõi Nghiệp Vụ)</h3>
            <div className="hex-card core-card">
              <strong>Aggregate: AssessmentSlip</strong>
              <p>Bảo đảm Golden Invariant: Rule Engine (TT08) có quyền phủ quyết tuyệt đối kết quả mô hình AI.</p>
            </div>
            <div className="hex-card core-card">
              <strong>Use Case: EvaluateStudentRiskUseCase</strong>
              <p>Điều phối quy chế học vụ + Sheaf Attention Inference.</p>
            </div>
          </div>

          <div className="hex-column driven">
            <h3>Secondary / Driven Adapters</h3>
            <div className="hex-card">SQLAlchemy Repository (SQLite / Postgres)</div>
            <div className="hex-card">PyTorch Geometric (Sheaf Attention Model)</div>
            <div className="hex-card">Notification Service (Audit Log &amp; Mail)</div>
          </div>
        </div>
      </div>

      {/* Circuit Breaker & Telemetry State */}
      <div className="card">
        <h2>Giám sát Sức chịu tải Gateway (Node.js Circuit Breaker State)</h2>
        <p className="hint">
          Cơ chế ngắt mạch bảo vệ hệ thống khỏi hiện tượng sụp đổ dây chuyền khi tải nặng hoặc khi cụm GNN Core cần tái huấn luyện.
        </p>

        {bffTelemetry ? (
          <div className="grid2">
            <div>
              <table className="data">
                <tbody>
                  <tr>
                    <td><strong>Trạng thái Circuit Breaker:</strong></td>
                    <td>
                      <span className={`badge ${bffTelemetry.circuit_breaker_state === "CLOSED" ? "b-ok" : "b-bad"}`}>
                        {bffTelemetry.circuit_breaker_state}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Thời gian phản hồi P95 (Latency):</strong></td>
                    <td>{bffTelemetry.avg_latency_ms} ms</td>
                  </tr>
                  <tr>
                    <td><strong>Token Bucket Rate Limit:</strong></td>
                    <td>300 requests / minute / IP</td>
                  </tr>
                  <tr>
                    <td><strong>Distributed Correlation ID:</strong></td>
                    <td><code>{bffTelemetry.correlation_id}</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px" }}>
              <button type="button" className="primary" onClick={onResetCircuitBreaker}>
                ↺ Đặt lại Circuit Breaker (Reset Circuit State)
              </button>
              <button
                type="button"
                className="small"
                onClick={() => window.open("/api/gateway/health", "_blank")}
              >
                Xem JSON Giám Sát /api/gateway/health ↗
              </button>
            </div>
          </div>
        ) : (
          <div className="hint">Chưa nhận được tín hiệu đo lường từ Gateway.</div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APP COMPONENT (ORCHESTRATOR)
// ============================================================================
function App() {
  const [role, setRole] = useState("ALL");
  const [activeTab, setActiveTab] = useState("dash");
  const [studentId, setStudentId] = useState("SV002");

  // Remote data state
  const [stats, setStats] = useState(null);
  const [activeModel, setActiveModel] = useState(null);
  const [bffTelemetry, setBffTelemetry] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [assessmentData, setAssessmentData] = useState(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [interventions, setInterventions] = useState([]);
  const [rules, setRules] = useState([]);
  const [models, setModels] = useState([]);

  // Fetch Dashboard BFF Overview
  const fetchDashboardBff = useCallback(async () => {
    try {
      const res = await fetch("/api/bff/dashboard-overview");
      if (res.ok) {
        const payload = await res.json();
        setStats(payload.stats);
        setActiveModel(payload.active_model);
        setBffTelemetry(payload.gateway_telemetry);
      }
    } catch (e) {
      console.warn("Could not load BFF overview:", e);
    }
  }, []);

  // Fetch Cohorts list
  const fetchCohorts = useCallback(async (currentRole) => {
    try {
      const url = currentRole !== "ALL" ? `/api/cohorts?advisor_id=${currentRole}` : "/api/cohorts";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCohorts(data.rows || data.cohorts || []);
      }
    } catch (e) {
      console.warn("Could not load cohorts:", e);
    }
  }, []);

  // Fetch Student Assessment
  const fetchAssessment = useCallback(async (sid) => {
    if (!sid) return;
    setAssessmentLoading(true);
    setSimResult(null);
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(sid)}/assessment`);
      if (res.ok) {
        const data = await res.json();
        setAssessmentData(data);
      } else {
        setAssessmentData(null);
      }
    } catch (e) {
      console.warn("Error fetching assessment:", e);
      setAssessmentData(null);
    } finally {
      setAssessmentLoading(false);
    }
  }, []);

  // Fetch Graph Network
  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch("/api/graph/network");
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
      }
    } catch (e) {
      console.warn("Could not load graph:", e);
    }
  }, []);

  // Fetch Interventions & Rules & Models
  const fetchAdminData = useCallback(async () => {
    try {
      const [itRes, rRes, mRes] = await Promise.all([
        fetch("/api/interventions"),
        fetch("/api/rules"),
        fetch("/api/models"),
      ]);
      if (itRes.ok) {
        const it = await itRes.json();
        setInterventions(it.interventions || []);
      }
      if (rRes.ok) {
        const r = await rRes.json();
        setRules(r.rules || []);
      }
      if (mRes.ok) {
        const m = await mRes.json();
        setModels(m.models || []);
      }
    } catch (e) {
      console.warn("Could not load admin data:", e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDashboardBff();
    fetchCohorts(role);
    fetchAssessment(studentId);
    fetchGraph();
    fetchAdminData();
  }, []);

  // Role change handler
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    fetchCohorts(newRole);
  };

  // Quick pick handler
  const handleQuickPick = (sid) => {
    setStudentId(sid);
    fetchAssessment(sid);
  };

  // Simulation handler
  const handleSimulate = async (simPayload) => {
    if (!simPayload) {
      setSimResult(null);
      return;
    }
    try {
      const res = await fetch("/api/assess/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(simPayload),
      });
      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
      }
    } catch (e) {
      alert("Lỗi khi chạy mô phỏng What-If: " + e.message);
    }
  };

  // Add Intervention handler
  const handleAddIntervention = async (itPayload) => {
    try {
      const res = await fetch("/api/interventions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itPayload),
      });
      if (res.ok) {
        alert("Đã lưu biên bản can thiệp thành công!");
        fetchAdminData();
        fetchDashboardBff();
      }
    } catch (e) {
      alert("Lỗi: " + e.message);
    }
  };

  // CSV Upload handler
  const handleUploadCsv = async (csvText, callback) => {
    try {
      const res = await fetch("/api/data/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_content: csvText }),
      });
      if (res.ok) {
        const data = await res.json();
        callback(data);
      }
    } catch (e) {
      alert("Lỗi tải tệp: " + e.message);
    }
  };

  // Model Activate handler
  const handleActivateModel = async (runId) => {
    try {
      const res = await fetch(`/api/models/${runId}/activate`, { method: "POST" });
      if (res.ok) {
        alert("Đã kích hoạt mô hình thành công!");
        fetchAdminData();
        fetchDashboardBff();
      }
    } catch (e) {
      alert("Lỗi: " + e.message);
    }
  };

  // Circuit breaker reset
  const handleResetCircuit = async () => {
    try {
      const res = await fetch("/api/gateway/circuit-breaker/reset", { method: "POST" });
      if (res.ok) {
        alert("Đã thiết lập lại trạng thái Circuit Breaker về CLOSED.");
        fetchDashboardBff();
      }
    } catch (e) {
      alert("Lỗi: " + e.message);
    }
  };

  return (
    <ErrorBoundary>
      <div>
        <Header
          currentRole={role}
          onRoleChange={handleRoleChange}
          onExportClick={() => (window.location.href = "/api/reports/export")}
        />

        <NoticeBanner activeModelName={activeModel ? activeModel.model_name : null} />

        <TabBar activeTab={activeTab} onTabSelect={setActiveTab} />

        <main>
          {activeTab === "dash" && (
            <DashboardTab
              stats={stats}
              bffTelemetry={bffTelemetry}
              onClassClick={(classId) => {
                setActiveTab("cohort");
              }}
            />
          )}

          {activeTab === "slip" && (
            <IndividualSlipTab
              studentId={studentId}
              onStudentIdChange={(sid) => {
                setStudentId(sid);
                fetchAssessment(sid);
              }}
              assessmentData={assessmentData}
              loading={assessmentLoading}
              onQuickPick={handleQuickPick}
              onSimulate={handleSimulate}
              simResult={simResult}
            />
          )}

          {activeTab === "cohort" && (
            <CohortTab
              cohorts={cohorts}
              currentRole={role}
              onSelectStudent={(sid) => {
                setStudentId(sid);
                fetchAssessment(sid);
                setActiveTab("slip");
              }}
            />
          )}

          {activeTab === "graph" && (
            <GraphNetworkTab
              graphData={graphData}
              onSelectStudent={(sid) => {
                setStudentId(sid);
                fetchAssessment(sid);
                setActiveTab("slip");
              }}
            />
          )}

          {activeTab === "ops" && (
            <InterventionsTab
              interventions={interventions}
              onAddIntervention={handleAddIntervention}
              onUploadCsv={handleUploadCsv}
            />
          )}

          {activeTab === "admin" && (
            <AdminTab
              rules={rules}
              models={models}
              onActivateModel={handleActivateModel}
            />
          )}

          {activeTab === "copilot" && <AdvisorCopilotTab />}

          {activeTab === "hex" && (
            <HexagonalTab
              bffTelemetry={bffTelemetry}
              onResetCircuitBreaker={handleResetCircuit}
            />
          )}
        </main>

        <footer>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <strong>EduAlert Hệ thống cảnh báo sớm kết quả học tập đa cấp độ</strong> · Chương trình Khoa học Máy tính Tiên tiến, Trường Đại học Mở TP.HCM
            </div>
            <div>
              Căn cứ pháp lý: Thông tư 08/2021/TT-BGDĐT · Bảo vệ dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP (SHA-256 Ẩn danh)
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

// Mount the React 18 Application
const container = document.getElementById("root");
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
}
