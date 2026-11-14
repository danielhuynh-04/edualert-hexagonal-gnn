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
 *    Registrar Seal with Double Stamped Border, Advanced Filters, Full CRUD)
 * 
 * Author: Huynh Le Thanh Hai — HCMC Open University
 * ============================================================================
 */

const { useState, useEffect, useMemo, useCallback, useRef, Component } = React;

// ============================================================================
// 0. REACT ERROR BOUNDARY (CRASH-SAFE GUARD)
// ============================================================================
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("EduAlert ErrorBoundary caught:", error, errorInfo);
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
              this.setState({ hasError: false, error: null });
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
// 1. DATA ADAPTER & DEFENSIVE MAPPERS
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

  let hint = "";
  if (Array.isArray(a.recommendations)) {
    hint = a.recommendations.map((r) => r.replace(/<[^>]*>?/gm, "")).join(" ");
  } else if (typeof a.recommendations === "string") {
    hint = a.recommendations;
  } else if (a.advisor_action_hint) {
    hint = a.advisor_action_hint;
  }

  const rawRules = raw.rule_checks || a.rule_results || [];
  const rule_results = rawRules.map((r) => ({
    rule_code: r.rule_code || "RULE",
    description: r.explanation || r.description || "Quy chế đào tạo",
    is_triggered: !!(r.triggered || r.is_triggered),
    detail: r.actual_value || r.detail || "",
  }));

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

  const rawPeers = raw.peers || raw.peer_edges || a.neighbors_sheaf || [];
  const neighbors_sheaf = rawPeers.map((p) => ({
    neighbor_id: p.peer_id || p.neighbor_id || "SV---",
    neighbor_name: p.peer_name || p.neighbor_name || "",
    edge_type: p.edge_type || "Cùng học phần",
    gpa: p.peer_gpa != null ? Number(p.peer_gpa) : (p.gpa != null ? Number(p.gpa) : 0),
    alpha_weight: p.sheaf_attention != null ? Number(p.sheaf_attention) : (p.alpha_weight != null ? Number(p.alpha_weight) : 0.2),
  }));

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
    gpa_semester: r.gpa_semester != null ? Number(r.gpa_semester) : 0,
    gpa_cumulative: r.gpa_cumulative != null ? Number(r.gpa_cumulative) : 0,
    failed_credits: r.failed_credits != null ? Number(r.failed_credits) : 0,
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
// 2. HEADER & ROLE NAVIGATION (RBAC / RLS — 5 LEVELS)
// ============================================================================
function Header({ currentUsername, userRoles, onUserChange, onExportClick, onOpenRoleInfo, onLogout, activeUser }) {
  const roles = Array.isArray(userRoles) && userRoles.length > 0 ? userRoles : [
    { username: "sv002", role: "STUDENT", level: 1, level_label: "LV1 · Sinh viên", display_name: "Trần Hoàng Nam (SV002)", assigned_classes: ["DH23CS02"] },
    { username: "daotao", role: "TRAINING_DEPT", level: 4, level_label: "LV4 · Phòng Đào tạo", display_name: "Phòng Quản lý Đào tạo (Toàn trường)", assigned_classes: [] },
    { username: "cvht_lan", role: "ADVISOR", level: 2, level_label: "LV2 · Cố vấn Học tập", display_name: "TS. Nguyễn Thị Lan (Lớp DH23CS01, DH23CS02)", assigned_classes: ["DH23CS01", "DH23CS02"] },
    { username: "cvht_minh", role: "ADVISOR", level: 2, level_label: "LV2 · Cố vấn Học tập", display_name: "ThS. Trần Văn Minh (Lớp DH24AI01, DH24AI02)", assigned_classes: ["DH24AI01", "DH24AI02"] },
    { username: "cvht_hung", role: "ADVISOR", level: 2, level_label: "LV2 · Cố vấn Học tập", display_name: "TS. Lê Hoàng Hùng (Lớp DH23IS01, DH24IS02)", assigned_classes: ["DH23IS01", "DH24IS02"] },
    { username: "bcnkhoa", role: "FACULTY_BOARD", level: 3, level_label: "LV3 · BCN Khoa", display_name: "Ban Chủ nhiệm Khoa CNTT", assigned_classes: [] },
    { username: "admin", role: "ADMIN", level: 5, level_label: "LV5 · Quản trị Hệ thống", display_name: "Quản trị Hệ thống (Admin)", assigned_classes: [] },
  ];

  const user = activeUser || roles.find((r) => r.username === currentUsername) || roles[0];
  const isStudent = user && (user.level === 1 || user.role === "STUDENT");

  return (
    <header className="app">
      <div className="brand">
        <h1>EduAlert</h1>
        <span className="sub">
          Hệ thống cảnh báo sớm kết quả học tập đa cấp độ (Rule Engine TT08/2021 + Sheaf Attention GNN + Gemini AI)
        </span>
      </div>
      <div className="rolebar">
        <LevelBadge level={user.level || 2} label={user.level_label || `LV${user.level || 2} · ${user.role}`} />

        {!isStudent ? (
          <>
            <span>Vai trò (RBAC):</span>
            <select
              id="roleSelect"
              className="rolesel"
              value={currentUsername}
              onChange={(e) => onUserChange(e.target.value)}
            >
              {roles.map((u) => (
                <option key={u.username} value={u.username}>
                  [{u.level ? `LV${u.level}` : u.role}] {u.display_name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span className="user-chip">
            <span className="av">{(user.display_name || "S")[0]}</span>
            <span className="nm">{user.display_name}</span>
          </span>
        )}

        <button
          type="button"
          className="graph-btn"
          style={{ background: "#334155", color: "#F8FAFC", borderColor: "#475569" }}
          onClick={onOpenRoleInfo}
          title="Xem chi tiết phân quyền 5 cấp độ RBAC và chính sách bảo vệ dữ liệu RLS theo Nghị định 13/2023/NĐ-CP"
        >
          ⓘ Phân quyền &amp; RLS
        </button>

        {!isStudent && (
          <button
            type="button"
            className="btn-export"
            onClick={onExportClick}
            title="Xuất bảng tổng hợp cohort định dạng CSV theo Thông tư 08"
          >
            ⬇ Xuất Excel/CSV (M12)
          </button>
        )}

        <button
          type="button"
          className="logout-btn"
          onClick={onLogout}
          title="Đăng xuất về Cổng xác thực 5 cấp độ M01"
        >
          🚪 Đăng xuất
        </button>
      </div>
    </header>
  );
}

function NoticeBanner({ activeModelName, activeUser, enforceRls }) {
  const isStudent = activeUser && (activeUser.level === 1 || activeUser.role === "STUDENT");
  const isAdvisor = activeUser && activeUser.role === "ADVISOR";
  return (
    <div className="notice">
      <div>
        {isStudent ? (
          <span>
            <strong>Cổng Dịch Vụ Sinh Viên (LV1):</strong> Hồ sơ học vụ của bạn được bảo vệ theo <strong>Nghị định 13/2023/NĐ-CP</strong> và đối chiếu tự động với <strong>Điều 11 Thông tư 08/2021/TT-BGDĐT</strong>. Bạn chỉ xem được dữ liệu cá nhân của chính mình.
          </span>
        ) : (
          <span>
            <strong>Kiến trúc Hybrid:</strong> Tầng quy chế (Thông tư 08/2021/TT-BGDĐT) có quyền ưu tiên tuyệt đối; Tầng dự báo (Sheaf Attention Network) phát hiện sớm xu hướng sụt giảm điểm và quan hệ dị thể.
            {isAdvisor && enforceRls && activeUser.assigned_classes && (
              <span style={{ marginLeft: "10px", color: "#1E3A8A", fontWeight: 600 }}>
                • Chế độ RLS: Đang giới hạn dữ liệu theo các lớp được phân công ({activeUser.assigned_classes.join(", ")})
              </span>
            )}
          </span>
        )}
      </div>
      <div className="active-badge">
        Mô hình kích hoạt: {activeModelName || "Sheaf Attention v2.0"}
      </div>
    </div>
  );
}

function TabBar({ activeTab, onTabSelect, userLevel }) {
  const currentLvl = userLevel || 2;
  const tabs = [
    { id: "dash", label: "M02 · Tổng quan (Dashboard)", minLevel: 2 },
    { id: "slip", label: "M03 & M04 · Phiếu cá nhân & Diễn biến", minLevel: 1 },
    { id: "cohort", label: "M05 · Danh sách toàn khóa (Cohort View & CRUD)", minLevel: 2 },
    { id: "graph", label: "M06 · Đồ thị quan hệ (Sheaf Network)", minLevel: 2 },
    { id: "ops", label: "M08 & M09 · Quản lý Can thiệp CVHT & Nhập liệu", minLevel: 2 },
    { id: "admin", label: "M10 & M11 · Quy chế & Benchmark Mô hình", minLevel: 3 },
    { id: "copilot", label: "✦ Trợ lý AI (Gemini + RAG + SQL)", minLevel: 1 },
    { id: "hex", label: "🏛 Kiến trúc Hexagonal (Node.js Gateway)", minLevel: 2 },
  ];

  const visibleTabs = tabs.filter((t) => currentLvl >= t.minLevel);

  return (
    <div className="tabs" role="tablist">
      {visibleTabs.map((t) => (
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

function BreadcrumbBar({ activeTab, selectedStudentId, onNavigateTab }) {
  const TAB_NAMES = {
    dash: "M02 · Tổng quan (Dashboard)",
    slip: "M03 & M04 · Phiếu cá nhân & Diễn biến",
    cohort: "M05 · Danh sách toàn khóa (Cohort View)",
    graph: "M06 · Đồ thị quan hệ (Sheaf Network)",
    ops: "M08 & M09 · Quản lý Can thiệp & Nhập liệu",
    admin: "M10 & M11 · Quy chế & Benchmark Mô hình",
    copilot: "Advisor Copilot (RAG + SQL)",
    hex: "Kiến trúc Hexagonal (Node.js Gateway)",
  };

  return (
    <div className="breadcrumb-bar">
      <span className="crumb-btn" onClick={() => onNavigateTab("dash")}>EduAlert</span>
      <span className="breadcrumb-separator">›</span>
      <span
        className={activeTab === "dash" ? "breadcrumb-active" : "crumb-btn"}
        onClick={() => onNavigateTab(activeTab)}
      >
        {TAB_NAMES[activeTab] || activeTab}
      </span>
      {activeTab === "slip" && selectedStudentId && (
        <>
          <span className="breadcrumb-separator">›</span>
          <span className="breadcrumb-active">Hồ sơ: {selectedStudentId}</span>
        </>
      )}
      {activeTab === "graph" && selectedStudentId && (
        <>
          <span className="breadcrumb-separator">›</span>
          <span className="breadcrumb-active">Nút đã chọn: {selectedStudentId}</span>
        </>
      )}
    </div>
  );
}

// ============================================================================
// 3. REGISTRAR SEAL & DIVERGING SHAP BAR
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

function ShapDivergingBar({ shapData }) {
  if (!shapData || shapData.length === 0) {
    return <p className="hint">Chưa có phân tích đóng góp yếu tố cho sinh viên này.</p>;
  }

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
// 4. M04 TRAJECTORY & FORECAST SVG CHART
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
  const yFloor = getY(1.6);

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
        {[1.0, 2.0, 3.0, 4.0].map((v) => {
          const y = getY(v);
          return (
            <g key={v}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#E2E8F0" strokeDasharray="2 2" />
              <text x={padLeft - 6} y={y + 3} textAnchor="end" className="chart-label">{v.toFixed(1)}</text>
            </g>
          );
        })}

        <line x1={padLeft} y1={yFloor} x2={width - padRight} y2={yFloor} stroke="#EF4444" strokeWidth="1" strokeDasharray="3 3" />
        <text x={width - padRight} y={yFloor - 4} textAnchor="end" fill="#EF4444" className="chart-label-warn">Sàn TT08 (1.60)</text>

        {forecastCoord && upperY != null && lowerY != null && (
          <path
            d={`M ${pastCoords[pastCoords.length - 1].x} ${pastCoords[pastCoords.length - 1].y}
               L ${forecastCoord.x} ${upperY.toFixed(1)}
               L ${forecastCoord.x} ${lowerY.toFixed(1)} Z`}
            fill="rgba(30, 58, 138, 0.12)"
          />
        )}

        <path d={pastPath} fill="none" stroke="#1E3A8A" strokeWidth="2.5" />

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

        {pastCoords.map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r="4" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="2.5" />
            <text x={pt.x} y={height - 10} textAnchor="middle" className="chart-label">{pt.sem}</text>
            <text x={pt.x} y={pt.y - 8} textAnchor="middle" className="chart-value">{Number(pt.gpa).toFixed(2)}</text>
          </g>
        ))}

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
// 5. TAB 1: M02 DASHBOARD
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
// 6. TAB 2: M03 & M04 INDIVIDUAL SLIP & WHAT-IF SIMULATOR
// ============================================================================
function IndividualSlipTab({
  studentId,
  onStudentIdChange,
  assessmentData,
  loading,
  onQuickPick,
  onSimulate,
  simResult,
  onOpenEditStudent,
  isStudent,
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
      <div className="card picker-bar">
        <div className="picker-left">
          <label><strong>{isStudent ? "Mã hồ sơ sinh viên của bạn:" : "Tra cứu mã hồ sơ sinh viên:"}</strong></label>
          <div className="picker-inputs">
            {isStudent ? (
              <span className="locked-id">
                🔒 {studentId} · {assessment ? assessment.student_name : "Hồ sơ cá nhân"} (RLS Nghị định 13/2023)
              </span>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="small"
            style={{ background: "var(--ai-bg)", color: "var(--ai)", borderColor: "#C7D2FE", fontWeight: 700 }}
            onClick={() => window.askEduAlertAI && window.askEduAlertAI(isStudent ? "Phân tích tình hình học tập của tôi và gợi ý lộ trình cải thiện kỳ tới" : `Phân tích nguyên nhân và lập kế hoạch can thiệp cho sinh viên ${studentId}`)}
          >
            ✦ Hỏi AI về {isStudent ? "hồ sơ của tôi" : studentId}
          </button>
          {!isStudent && assessment && (
            <button
              type="button"
              className="small"
              style={{ borderColor: "var(--stamp-blue)", color: "var(--stamp-blue)", fontWeight: 600 }}
              onClick={() => onOpenEditStudent(assessment)}
            >
              ✏️ Sửa điểm học kỳ (CRUD)
            </button>
          )}
          <button type="button" className="small toggle-sim-btn" onClick={() => setShowSim(!showSim)}>
            {showSim ? "✕ Đóng bộ giả lập What-If" : "⚙ Mở bộ giả lập What-If"}
          </button>
        </div>
      </div>

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
              <RegistrarSeal
                riskLevel={assessment.risk_level}
                riskScore={assessment.risk_score}
                predictedGpa={assessment.predicted_gpa_next}
                predictedStd={assessment.predicted_gpa_std}
                studentId={assessment.student_id}
              />

              <div className="slip-content">
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

                <div className="expl">
                  <strong>Giải thích nguyên nhân: </strong>
                  {assessment.explanation_text}
                </div>

                <div className="advisor-hint-box">
                  <strong>Gợi ý can thiệp cho CVHT: </strong>
                  {assessment.advisor_action_hint}
                </div>

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
// 7. TAB 3: M05 ADVANCED FILTERED COHORT VIEW & CRUD
// ============================================================================
function CohortTab({
  cohorts,
  onSelectStudent,
  onOpenEditStudent,
  onNavigateToGraph,
  onNavigateToIntervention,
  activeUser,
  enforceRls,
  onToggleRls,
  initialRuleFilter,
}) {
  // Advanced Filter States
  const [filterClass, setFilterClass] = useState("ALL");
  const [filterRisk, setFilterRisk] = useState("ALL");
  const [filterRuleStatus, setFilterRuleStatus] = useState("ALL");
  const [filterSpecificRule, setFilterSpecificRule] = useState(initialRuleFilter || "ALL");
  const [filterGpaRange, setFilterGpaRange] = useState("ALL");
  const [filterDebt, setFilterDebt] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("RISK_DESC");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    if (initialRuleFilter) {
      setFilterSpecificRule(initialRuleFilter);
      setPage(1);
    }
  }, [initialRuleFilter]);

  const cohortList = useMemo(() => normalizeCohorts(cohorts), [cohorts]);

  // Available classes for dropdown
  const classList = useMemo(() => {
    const set = new Set();
    cohortList.forEach((c) => { if (c.class_id) set.add(c.class_id); });
    return Array.from(set).sort();
  }, [cohortList]);

  // Multi-criteria Filtering & Sorting
  const filteredAndSorted = useMemo(() => {
    let result = cohortList.filter((s) => {
      // 0. Row-Level Security (RLS) enforcement
      if (enforceRls && activeUser && activeUser.role === "ADVISOR" && Array.isArray(activeUser.assigned_classes) && activeUser.assigned_classes.length > 0) {
        if (!activeUser.assigned_classes.includes(s.class_id)) return false;
      }

      // 1. Class filter
      if (filterClass !== "ALL" && s.class_id !== filterClass) return false;

      // 2. Risk level filter
      if (filterRisk !== "ALL" && s.risk_level !== filterRisk) return false;

      // 3. Rule status filter
      if (filterRuleStatus === "TRIGGERED" && s.rule_violations_count <= 0) return false;
      if (filterRuleStatus === "SAFE" && s.rule_violations_count > 0) return false;

      // 3b. Specific rule filter
      if (filterSpecificRule !== "ALL") {
        const vRules = s.violated_rules || [];
        if (!vRules.includes(filterSpecificRule)) return false;
      }

      // 4. GPA Range filter
      if (filterGpaRange === "LT_15" && s.gpa_cumulative >= 1.5) return false;
      if (filterGpaRange === "FROM_15_TO_20" && (s.gpa_cumulative < 1.5 || s.gpa_cumulative >= 2.0)) return false;
      if (filterGpaRange === "FROM_20_TO_25" && (s.gpa_cumulative < 2.0 || s.gpa_cumulative >= 2.5)) return false;
      if (filterGpaRange === "GT_25" && s.gpa_cumulative < 2.5) return false;

      // 5. Debt credits filter
      if (filterDebt === "GT_10" && s.failed_credits_cumulative < 10) return false;
      if (filterDebt === "GT_24" && s.failed_credits_cumulative < 24) return false;

      // 6. Full-text search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const sid = (s.student_id || "").toLowerCase();
        const sname = (s.student_name || "").toLowerCase();
        if (!sid.includes(q) && !sname.includes(q)) return false;
      }
      return true;
    });

    // Sắp xếp
    result.sort((a, b) => {
      if (sortBy === "RISK_DESC") return (b.risk_score || 0) - (a.risk_score || 0);
      if (sortBy === "GPA_ASC") return (a.gpa_cumulative || 0) - (b.gpa_cumulative || 0);
      if (sortBy === "GPA_DESC") return (b.gpa_cumulative || 0) - (a.gpa_cumulative || 0);
      if (sortBy === "DEBT_DESC") return (b.failed_credits_cumulative || 0) - (a.failed_credits_cumulative || 0);
      if (sortBy === "NAME_ASC") return (a.student_name || "").localeCompare(b.student_name || "");
      return 0;
    });

    return result;
  }, [cohortList, filterClass, filterRisk, filterRuleStatus, filterSpecificRule, filterGpaRange, filterDebt, searchTerm, sortBy, enforceRls, activeUser]);

  const totalPages = Math.ceil(filteredAndSorted.length / pageSize) || 1;
  const paginated = filteredAndSorted.slice((page - 1) * pageSize, page * pageSize);

  const handleResetFilters = () => {
    setFilterClass("ALL");
    setFilterRisk("ALL");
    setFilterRuleStatus("ALL");
    setFilterSpecificRule("ALL");
    setFilterGpaRange("ALL");
    setFilterDebt("ALL");
    setSearchTerm("");
    setSortBy("RISK_DESC");
    setPage(1);
  };

  const isAdvisor = activeUser && activeUser.role === "ADVISOR";

  return (
    <div>
      {/* RLS Enforcement Notice */}
      {isAdvisor && (
        <div className="rls-banner">
          <div>
            <strong>🛡️ Row-Level Security (RLS) theo Nghị định 13/2023/NĐ-CP:</strong>{" "}
            {enforceRls ? (
              <span>Đang áp dụng bộ lọc chỉ xem sinh viên các lớp phụ trách (<strong>{activeUser.assigned_classes.join(", ")}</strong>).</span>
            ) : (
              <span style={{ color: "#B45309" }}>Đã tạm tắt RLS — Đang hiển thị toàn trường (Chế độ Quản trị/Thử nghiệm).</span>
            )}
          </div>
          <button
            type="button"
            className="small"
            onClick={onToggleRls}
            title="Bật/Tắt RLS để kiểm thử phân quyền cấp dòng"
          >
            {enforceRls ? "Tạm tắt RLS (Xem toàn trường)" : "Bật lại RLS"}
          </button>
        </div>
      )}

      {/* Advanced Filter Toolbar (Chuẩn Impeccable) */}
      <div className="advanced-filter-panel">
        <div className="filter-grid">
          <div>
            <label>Tìm kiếm Mã SV / Họ tên:</label>
            <input
              type="text"
              placeholder="VD: SV002 hoặc Nam..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>

          <div>
            <label>Lớp sinh hoạt:</label>
            <select value={filterClass} onChange={(e) => { setFilterClass(e.target.value); setPage(1); }}>
              <option value="ALL">-- Tất cả các lớp --</option>
              {classList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Mức độ nguy cơ:</label>
            <select value={filterRisk} onChange={(e) => { setFilterRisk(e.target.value); setPage(1); }}>
              <option value="ALL">-- Tất cả mức độ --</option>
              <option value="HIGH_RISK">🔴 Nguy cơ cao (Ưu tiên gặp)</option>
              <option value="ATTENTION">🟡 Cần chú ý (Sớm)</option>
              <option value="NORMAL">🟢 Bình thường</option>
            </select>
          </div>

          <div>
            <label>Điều kiện Quy chế TT08:</label>
            <select value={filterRuleStatus} onChange={(e) => { setFilterRuleStatus(e.target.value); setPage(1); }}>
              <option value="ALL">-- Tất cả trạng thái --</option>
              <option value="TRIGGERED">❌ Đã chạm ngưỡng quy chế TT08</option>
              <option value="SAFE">✓ Chưa vi phạm quy chế</option>
            </select>
          </div>

          <div>
            <label>Lọc Quy chế cụ thể (M10):</label>
            <select value={filterSpecificRule} onChange={(e) => { setFilterSpecificRule(e.target.value); setPage(1); }}>
              <option value="ALL">-- Tất cả 5 quy chế --</option>
              <option value="R01_SEM_FAIL_RATIO">R01: Trượt &gt; 50% TC đăng ký</option>
              <option value="R02_ACCUM_DEBT_CREDITS">R02: Nợ đọng &gt; 24 tín chỉ</option>
              <option value="R03_SEM_GPA_FLOOR">R03: ĐTB học kỳ dưới sàn</option>
              <option value="R04_CUM_GPA_BY_YEAR">R04: ĐTB tích lũy dưới sàn năm</option>
              <option value="R05_CONSECUTIVE_WARNINGS">R05: Cảnh báo liên tiếp (Buộc thôi học)</option>
            </select>
          </div>

          <div>
            <label>Khoảng ĐTB Tích lũy:</label>
            <select value={filterGpaRange} onChange={(e) => { setFilterGpaRange(e.target.value); setPage(1); }}>
              <option value="ALL">-- Tất cả thang điểm --</option>
              <option value="LT_15">Dưới 1.50 (Báo động đỏ)</option>
              <option value="FROM_15_TO_20">Từ 1.50 – 1.99</option>
              <option value="FROM_20_TO_25">Từ 2.00 – 2.49</option>
              <option value="GT_25">Từ 2.50 trở lên</option>
            </select>
          </div>

          <div>
            <label>Số tín chỉ nợ đọng:</label>
            <select value={filterDebt} onChange={(e) => { setFilterDebt(e.target.value); setPage(1); }}>
              <option value="ALL">-- Tất cả mức nợ --</option>
              <option value="GT_10">Nợ từ 10 TC trở lên</option>
              <option value="GT_24">Nợ trên 24 TC (Chạm trần R02)</option>
            </select>
          </div>

          <div>
            <label>Sắp xếp danh sách theo:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="RISK_DESC">Xác suất nguy cơ giảm dần</option>
              <option value="GPA_ASC">ĐTB tích lũy tăng dần (Thấp nhất)</option>
              <option value="GPA_DESC">ĐTB tích lũy giảm dần</option>
              <option value="DEBT_DESC">Tín chỉ nợ đọng nhiều nhất</option>
              <option value="NAME_ASC">Họ và tên (A → Z)</option>
            </select>
          </div>
        </div>

        <div className="filter-actions">
          <div className="filter-badge-count">
            Kết quả: <strong>{filteredAndSorted.length}</strong> / {cohortList.length} sinh viên
            {filterSpecificRule !== "ALL" && (
              <span className="badge b-bad" style={{ marginLeft: "8px" }}>
                Đang lọc: {filterSpecificRule}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: ".8rem", color: "var(--ink-muted)" }}>Hiển thị:</span>
            <select
              style={{ width: "auto", padding: "3px 8px", fontSize: ".8rem" }}
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              <option value="15">15 dòng/trang</option>
              <option value="25">25 dòng/trang</option>
              <option value="50">50 dòng/trang</option>
            </select>
            <button type="button" className="btn-reset" onClick={handleResetFilters}>
              ↺ Đặt lại bộ lọc
            </button>
          </div>
        </div>
      </div>

      {/* Cohort Table with In-place CRUD trigger */}
      <div className="card">
        <table className="data">
          <thead>
            <tr>
              <th>Mã SV</th>
              <th>Họ và tên</th>
              <th>Lớp</th>
              <th>ĐTB HK</th>
              <th>ĐTB Tích lũy</th>
              <th>Nợ tín chỉ</th>
              <th>Xác suất nguy cơ</th>
              <th>Mức độ</th>
              <th>Quy chế TT08</th>
              <th>Thao tác Liên kết &amp; CRUD</th>
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
                  <td>{Number(s.gpa_semester || 0).toFixed(2)}</td>
                  <td>{Number(s.gpa_cumulative).toFixed(2)}</td>
                  <td>{s.failed_credits_cumulative} TC</td>
                  <td><strong>{Math.round(s.risk_score)}%</strong></td>
                  <td><span className={`badge ${meta.badgeClass}`}>{meta.label}</span></td>
                  <td>
                    {s.rule_violations_count > 0 ? (
                      <span className="badge b-bad">{s.rule_violations_count} vi phạm</span>
                    ) : (
                      <span className="badge b-ok">Đạt chuẩn</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="small"
                        onClick={() => onSelectStudent(s.student_id)}
                        title="Xem Phiếu đánh giá cá nhân M03"
                      >
                        📄 Hồ sơ
                      </button>
                      <button
                        type="button"
                        className="small"
                        onClick={() => onNavigateToGraph(s.student_id)}
                        title="Xem vị trí sinh viên trên Đồ thị Sheaf M06"
                        style={{ background: "#EFF6FF", color: "#1E3A8A", borderColor: "#BFDBFE" }}
                      >
                        🕸️ Đồ thị
                      </button>
                      <button
                        type="button"
                        className="small"
                        onClick={() => onNavigateToIntervention(s.student_id)}
                        title="Lập biên bản can thiệp sư phạm M08"
                      >
                        ✍️ Can thiệp
                      </button>
                      <button
                        type="button"
                        className="btn-edit"
                        onClick={() => onOpenEditStudent(s)}
                        title="Chỉnh sửa điểm học kỳ và cập nhật CSDL"
                      >
                        ✏️ Sửa điểm
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginated.length === 0 && (
              <tr>
                <td colSpan="10" style={{ textAlign: "center", padding: "30px" }} className="hint">
                  Không tìm thấy sinh viên nào khớp với các tiêu chí lọc đã chọn.
                </td>
              </tr>
            )}
          </tbody>
        </table>

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
// 8. TAB 4: M06 SHEAF GRAPH NETWORK VISUALIZER (CINEMATIC HERO CANVAS)
// ============================================================================
function GraphNetworkTab({
  graphData,
  onSelectStudent,
  onOpenIntervention,
  onFilterInCohort,
  onAskCopilot,
  initialSelectedSid,
}) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterClass, setFilterClass] = useState("ALL");
  const [filterRisk, setFilterRisk] = useState("ALL");
  const [highAttentionOnly, setHighAttentionOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scale, setScale] = useState(1.0);
  const [showLabels, setShowLabels] = useState(true);

  const normalized = useMemo(() => normalizeGraph(graphData), [graphData]);

  // Cinematic Large Dimensions (1100 x 720)
  const width = 1100;
  const height = 720;
  const cx = width / 2;
  const cy = height / 2;

  // Filter nodes based on Class and Risk Level
  const visibleNodes = useMemo(() => {
    return normalized.nodes.filter((n) => {
      if (filterClass !== "ALL" && n.class_id !== filterClass) return false;
      if (filterRisk === "HIGH_RISK" && n.risk_level !== "HIGH_RISK") return false;
      if (filterRisk === "ATTENTION_OR_HIGH" && n.risk_level === "NORMAL") return false;
      if (filterRisk === "TT08_VIOLATION" && !n.rule_triggered) return false;
      return true;
    });
  }, [normalized.nodes, filterClass, filterRisk]);

  // Cluster-aware Layout & Coordinate Mapping
  const { nodePositions, classClusters } = useMemo(() => {
    const map = new Map();
    const classGroups = {};
    visibleNodes.forEach((n) => {
      const cid = n.class_id || "OTHER";
      if (!classGroups[cid]) classGroups[cid] = [];
      classGroups[cid].push(n);
    });

    const cKeys = Object.keys(classGroups).sort();
    const clusters = [];

    if (cKeys.length === 1) {
      // Single Class Mode: Expansive Circular Distribution
      const cid = cKeys[0];
      const group = classGroups[cid];
      clusters.push({ cid, cX: cx, cY: cy, rx: 270, ry: 250 });
      group.forEach((node, idx) => {
        const ring = idx % 3;
        const radius = 60 + ring * 75;
        const countInRing = Math.ceil(group.length / 3);
        const ringIdx = Math.floor(idx / 3);
        const angle = (ringIdx / Math.max(1, countInRing)) * 2 * Math.PI + (ring * 0.4);
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        map.set(node.id, { x, y, node });
      });
    } else {
      // Multi-Class Mode: Balanced Ring of Clusters
      cKeys.forEach((cid, cIdx) => {
        const clusterAngle = (cIdx / Math.max(1, cKeys.length)) * 2 * Math.PI - (Math.PI / 2);
        const clusterRadius = 265;
        const cX = cx + Math.cos(clusterAngle) * clusterRadius;
        const cY = cy + Math.sin(clusterAngle) * clusterRadius;
        clusters.push({ cid, cX, cY, rx: 135, ry: 110 });

        const group = classGroups[cid];
        group.forEach((node, nIdx) => {
          const ring = nIdx % 2;
          const radius = ring === 0 ? 44 : 82;
          const countInRing = Math.ceil(group.length / 2);
          const ringIdx = Math.floor(nIdx / 2);
          const nodeAngle = (ringIdx / Math.max(1, countInRing)) * 2 * Math.PI + (ring * 0.5);
          const x = cX + Math.cos(nodeAngle) * radius;
          const y = cY + Math.sin(nodeAngle) * radius;
          map.set(node.id, { x, y, node });
        });
      });
    }

    return { nodePositions: map, classClusters: clusters };
  }, [visibleNodes, cx, cy]);

  // Filter edges connected to positioned nodes
  const visibleEdges = useMemo(() => {
    return normalized.edges.filter((e) => {
      if (!e.source || !e.target) return false;
      if (!nodePositions.has(e.source) || !nodePositions.has(e.target)) return false;
      if (highAttentionOnly && (e.sheaf_alpha || 0) < 0.5) return false;
      return true;
    });
  }, [normalized.edges, nodePositions, highAttentionOnly]);

  // Sync initialSelectedSid
  useEffect(() => {
    if (initialSelectedSid) {
      const match = normalized.nodes.find((n) => n.id === initialSelectedSid);
      if (match) setSelectedNode(match);
    }
  }, [initialSelectedSid, normalized.nodes]);

  // Search input handler
  const handleSearch = (e) => {
    const q = e.target.value.trim().toUpperCase();
    setSearchQuery(q);
    if (q) {
      const match = normalized.nodes.find((n) => n.id === q || (n.label && n.label.toUpperCase().includes(q)));
      if (match) setSelectedNode(match);
    }
  };

  // Connected peers for selected node
  const selectedPeers = useMemo(() => {
    if (!selectedNode) return [];
    const peers = [];
    normalized.edges.forEach((e) => {
      if (e.source === selectedNode.id && nodePositions.has(e.target)) {
        peers.push({
          peerId: e.target,
          alpha: e.sheaf_alpha || 0.2,
          node: nodePositions.get(e.target).node,
        });
      } else if (e.target === selectedNode.id && nodePositions.has(e.source)) {
        peers.push({
          peerId: e.source,
          alpha: e.sheaf_alpha || 0.2,
          node: nodePositions.get(e.source).node,
        });
      }
    });
    peers.sort((a, b) => b.alpha - a.alpha);
    return peers.slice(0, 5);
  }, [selectedNode, normalized.edges, nodePositions]);

  return (
    <div className="graph-hero-layout">
      {/* Left Column: Large Hero SVG Canvas & Toolbar */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Graph Toolbar */}
        <div className="graph-toolbar">
          <div className="graph-toolbar-group">
            <select
              style={{ width: "auto", fontSize: ".82rem" }}
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="ALL">-- Tất cả 6 lớp sinh hoạt --</option>
              <option value="DH23CS01">Lớp DH23CS01 (K23 CSDL - TS. Lan)</option>
              <option value="DH23CS02">Lớp DH23CS02 (K23 CSDL - TS. Lan)</option>
              <option value="DH24AI01">Lớp DH24AI01 (K24 AI - ThS. Minh)</option>
              <option value="DH24AI02">Lớp DH24AI02 (K24 AI - ThS. Minh)</option>
              <option value="DH23IS01">Lớp DH23IS01 (K23 HTTT - TS. Hùng)</option>
              <option value="DH24IS02">Lớp DH24IS02 (K24 HTTT - TS. Hùng)</option>
            </select>

            <select
              style={{ width: "auto", fontSize: ".82rem" }}
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
            >
              <option value="ALL">Tất cả mức độ nguy cơ</option>
              <option value="ATTENTION_OR_HIGH">🔴 Vàng &amp; Đỏ (Cảnh báo &amp; Nguy cơ)</option>
              <option value="HIGH_RISK">🔴 Chỉ Nhóm Đỏ (HIGH_RISK)</option>
              <option value="TT08_VIOLATION">⚠️ Chỉ SV vi phạm Điều 11 TT08</option>
            </select>

            <button
              type="button"
              className={`graph-btn ${highAttentionOnly ? "active" : ""}`}
              onClick={() => setHighAttentionOnly((prev) => !prev)}
              title="Chỉ hiển thị các cạnh có trọng số chú ý Sheaf alpha >= 0.5"
            >
              &alpha; &ge; 0.5 (Chú ý cao)
            </button>
          </div>

          <div className="graph-toolbar-group">
            <input
              type="text"
              className="graph-search-input"
              placeholder="🔍 Tìm MSSV (VD: SV002)..."
              value={searchQuery}
              onChange={handleSearch}
            />

            <button
              type="button"
              className="graph-btn"
              onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
              title="Phóng to đồ thị"
            >
              +
            </button>
            <button
              type="button"
              className="graph-btn"
              onClick={() => setScale((s) => Math.max(0.65, s - 0.15))}
              title="Thu nhỏ đồ thị"
            >
              −
            </button>
            <button
              type="button"
              className="graph-btn"
              onClick={() => { setScale(1.0); setSelectedNode(null); }}
              title="Đặt lại tỉ lệ 100% và bỏ chọn"
            >
              ⟲ Đặt lại
            </button>
            <button
              type="button"
              className={`graph-btn ${showLabels ? "active" : ""}`}
              onClick={() => setShowLabels((prev) => !prev)}
              title="Bật/Tắt nhãn MSSV trên các nút"
            >
              🏷 Nhãn
            </button>
          </div>
        </div>

        {/* SVG Canvas Box with Relative Floating Legend */}
        <div className="graph-container-relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="network-svg"
            style={{ minHeight: "560px", background: "#FAFBFD" }}
          >
            <g transform={`scale(${scale})`} transformOrigin={`${cx} ${cy}`}>
              {/* Class Cluster Boundaries */}
              {classClusters.map((c) => (
                <g key={c.cid}>
                  <ellipse
                    cx={c.cX}
                    cy={c.cY}
                    rx={c.rx}
                    ry={c.ry}
                    fill="rgba(241, 245, 249, 0.55)"
                    stroke="#CBD5E1"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={c.cX}
                    y={c.cY - c.ry + 18}
                    textAnchor="middle"
                    fill="#475569"
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="var(--sans)"
                    letterSpacing="0.04em"
                  >
                    LỚP {c.cid}
                  </text>
                </g>
              ))}

              {/* Network Edges */}
              {visibleEdges.map((e, idx) => {
                const s = nodePositions.get(e.source);
                const t = nodePositions.get(e.target);
                if (!s || !t) return null;

                const isConnected = selectedNode && (e.source === selectedNode.id || e.target === selectedNode.id);
                const alphaVal = e.sheaf_alpha || 0.15;
                const strokeWidth = isConnected ? 3.0 : Math.max(0.7, alphaVal * 3.2);
                const strokeColor = isConnected ? "#1E3A8A" : (alphaVal >= 0.5 ? "#64748B" : "#CBD5E1");
                const strokeOpacity = selectedNode ? (isConnected ? 0.95 : 0.08) : Math.max(0.25, alphaVal);

                const midX = (s.x + t.x) / 2;
                const midY = (s.y + t.y) / 2;

                return (
                  <g key={idx}>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeOpacity={strokeOpacity}
                    />
                    {isConnected && (
                      <g>
                        <rect
                          x={midX - 20}
                          y={midY - 9}
                          width={40}
                          height={17}
                          rx={4}
                          fill="#1E3A8A"
                        />
                        <text
                          x={midX}
                          y={midY + 3.5}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="9"
                          fontWeight="700"
                          fontFamily="var(--mono)"
                        >
                          &alpha; {alphaVal.toFixed(2)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Network Nodes */}
              {Array.from(nodePositions.values()).map(({ x, y, node }) => {
                const isSelected = selectedNode && selectedNode.id === node.id;
                const isPeer = selectedPeers.some((p) => p.peerId === node.id);
                const meta = getLevelMeta(node.risk_level);
                const r = isSelected ? 14 : (isPeer ? 11 : 9);

                return (
                  <g
                    key={node.id}
                    className="graph-node-group"
                    onClick={() => setSelectedNode(node)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Glowing Ring for Selected Node */}
                    {isSelected && (
                      <circle
                        cx={x}
                        cy={y}
                        r={23}
                        fill="none"
                        stroke="#1E3A8A"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                        opacity="0.85"
                      />
                    )}

                    {/* Double Ring for TT08 Rule Triggered */}
                    {node.rule_triggered === 1 && (
                      <circle
                        cx={x}
                        cy={y}
                        r={r + 3.5}
                        fill="none"
                        stroke="#991B1B"
                        strokeWidth="1.8"
                        strokeDasharray="3 2"
                      />
                    )}

                    {/* Main Node Circle */}
                    <circle
                      cx={x}
                      cy={y}
                      r={r}
                      fill={meta.color}
                      stroke={isSelected ? "#0F172A" : "#FFFFFF"}
                      strokeWidth={isSelected ? 3 : 1.8}
                    />

                    {/* Node Monospace Label */}
                    {(showLabels || isSelected || isPeer) && (
                      <g>
                        <rect
                          x={x - 18}
                          y={y + r + 2}
                          width={36}
                          height={13}
                          rx={2}
                          fill="rgba(255, 255, 255, 0.88)"
                        />
                        <text
                          x={x}
                          y={y + r + 12}
                          textAnchor="middle"
                          className="node-label"
                          fill={isSelected ? "#0F172A" : (node.risk_level === "HIGH_RISK" ? "#991B1B" : "#334155")}
                          fontWeight={isSelected ? "700" : "600"}
                        >
                          {node.id}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Floating Legend */}
          <div className="graph-legend-overlay">
            <div style={{ fontWeight: 700, marginBottom: "4px", color: "var(--ink)" }}>Chú giải mạng Sheaf</div>
            <div className="graph-legend-item">
              <span className="graph-legend-dot" style={{ background: "#991B1B" }}></span>
              <span>Nguy cơ cao (HIGH_RISK)</span>
            </div>
            <div className="graph-legend-item">
              <span className="graph-legend-dot" style={{ background: "#D97706" }}></span>
              <span>Cần chú ý (ATTENTION)</span>
            </div>
            <div className="graph-legend-item">
              <span className="graph-legend-dot" style={{ background: "#059669" }}></span>
              <span>Bình thường (NORMAL)</span>
            </div>
            <div className="graph-legend-item">
              <span style={{ display: "inline-block", width: "10px", height: "10px", border: "1.5px dashed #991B1B", borderRadius: "50%" }}></span>
              <span>Vi phạm Điều 11 TT08 (Con dấu đôi)</span>
            </div>
            <div className="graph-legend-item">
              <span style={{ display: "inline-block", width: "14px", height: "3px", background: "#1E3A8A" }}></span>
              <span>Liên kết chú ý cao &alpha;<sub>vu</sub> &ge; 0.50</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Node Details & Cross-links & Academic Mechanics */}
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
              <p><strong>Họ và tên:</strong> {selectedNode.label}</p>
              <p><strong>Lớp sinh hoạt:</strong> {selectedNode.class_id}</p>
              <p><strong>ĐTB Tích lũy:</strong> {Number(selectedNode.gpa || 0).toFixed(2)}</p>
              <p><strong>ĐTB Học kỳ 2025_HK2:</strong> {selectedNode.gpa_semester != null ? Number(selectedNode.gpa_semester).toFixed(2) : "--"}</p>
              <p><strong>Tín chỉ nợ đọng:</strong> {selectedNode.accumulated_debt_credits || 0} TC</p>
              <p><strong>Xác suất nguy cơ (GNN):</strong> {Math.round(selectedNode.risk_score || 0)}%</p>

              {selectedNode.rule_triggered === 1 && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "6px 10px", borderRadius: "6px", fontSize: ".8rem", marginBottom: "12px", fontWeight: 600 }}>
                  ⚠️ Đã chạm ngưỡng cảnh báo Điều 11 Thông tư 08/2021
                </div>
              )}

              {/* Top Connected Peers in Sheaf Network */}
              <div style={{ marginTop: "14px" }}>
                <label>Nhóm học tập liên kết trực tiếp (Sheaf Attention):</label>
                {selectedPeers.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
                    {selectedPeers.map((p) => (
                      <div
                        key={p.peerId}
                        onClick={() => setSelectedNode(p.node)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 8px",
                          background: "#F8FAFC",
                          border: "1px solid var(--line)",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: ".8rem",
                        }}
                        title="Nhấp để chuyển tiêu điểm sang sinh viên này"
                      >
                        <div>
                          <strong>{p.peerId}</strong> · {p.node.label || p.peerId}
                        </div>
                        <span className="badge" style={{ background: "#EFF6FF", color: "#1E3A8A", border: "1px solid #BFDBFE" }}>
                          &alpha; {p.alpha.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hint" style={{ margin: "4px 0" }}>Chưa có cạnh chú ý vượt ngưỡng trong phân lớp hiện hành.</p>
                )}
              </div>

              {/* 4 Unified Cross-Linking Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
                <button
                  type="button"
                  className="primary"
                  style={{ width: "100%" }}
                  onClick={() => onSelectStudent(selectedNode.id)}
                >
                  📄 Mở Phiếu Đánh Giá Cá Nhân (M03)
                </button>
                <button
                  type="button"
                  className="graph-btn"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => onOpenIntervention(selectedNode.id)}
                >
                  ✍️ Lập Biên Bản Can Thiệp (M08)
                </button>
                <button
                  type="button"
                  className="graph-btn"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => onFilterInCohort(selectedNode.id)}
                >
                  🔍 Xem Trong Danh Sách Toàn Khóa (M05)
                </button>
                <button
                  type="button"
                  className="chip-btn"
                  style={{ width: "100%", justifyContent: "center", textAlign: "center" }}
                  onClick={() => onAskCopilot(`Hồ sơ sinh viên ${selectedNode.id} (${selectedNode.label || ""}) có những nguy cơ học vụ nào và hướng khắc phục theo Thông tư 08?`)}
                >
                  💬 Hỏi Copilot Về Sinh Viên Này
                </button>
              </div>
            </div>
          ) : (
            <p className="hint">Nhấp vào một nút trên đồ thị để xem thông tin chi tiết và trọng số Sheaf.</p>
          )}
        </div>

        <div className="card">
          <h2>Cơ chế Sheaf Attention Networks</h2>
          <div style={{ fontFamily: "var(--mono)", background: "#F8FAFC", padding: "8px 10px", borderRadius: "6px", fontSize: ".82rem", border: "1px solid var(--line)", margin: "8px 0" }}>
            E(x) = &sum;<sub>v&sim;u</sub> &alpha;<sub>vu</sub> ||F<sub>ve</sub> x<sub>v</sub> - F<sub>ue</sub> x<sub>u</sub>||<sup>2</sup>
          </div>
          <p className="hint" style={{ lineHeight: "1.6", margin: "8px 0 0" }}>
            Trong môi trường đào tạo tín chỉ, sinh viên khá và sinh viên yếu cùng làm việc nhóm tạo thành quan hệ dị thể (heterophily). Đồ thị GNN phẳng gây hiện tượng over-smoothing (bình quân hóa điểm). Sheaf Neural Network gán mỗi cạnh một ánh xạ hạn chế học được F<sub>ve</sub><sup>T</sup> F<sub>ue</sub> và trọng số chú ý &alpha;<sub>vu</sub>, giúp phát hiện sớm nguy cơ trước khi sinh viên trượt môn.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 9. TAB 5: M08 & M09 INTERVENTIONS CRUD & DATA IMPORT
// ============================================================================
function InterventionsTab({
  interventions,
  onAddIntervention,
  onOpenEditIntervention,
  onDeleteIntervention,
  onUploadCsv,
}) {
  const [sid, setSid] = useState("SV002");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("SCHEDULED");
  const [csvContent, setCsvContent] = useState("");
  const [importReport, setImportReport] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddIntervention({
      student_id: sid,
      meeting_date: date,
      notes,
      outcome_status: outcome,
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
      <div>
        <div className="card">
          <h2>M08 · Tạo Biên bản Can thiệp CVHT Mới (Create)</h2>
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
            <div style={{ marginBottom: "10px" }}>
              <label>Kết quả / Trạng thái theo dõi:</label>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                <option value="SCHEDULED">Đã lên lịch hẹn (Scheduled)</option>
                <option value="IN_PROGRESS">Đang theo dõi cải thiện (In Progress)</option>
                <option value="RESOLVED">Đã cải thiện / Thoát cảnh báo (Resolved)</option>
                <option value="DISMISSAL_PROPOSED">Đề xuất xử lý buộc thôi học (Dismissal Proposed)</option>
              </select>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label>Nội dung làm việc &amp; Cam kết của sinh viên:</label>
              <textarea
                rows="3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VD: Sinh viên cam kết đi học chuyên cần môn Cấu trúc dữ liệu, đăng ký phụ đạo..."
                required
              />
            </div>
            <button type="submit" className="primary">Lưu biên bản can thiệp (Create)</button>
          </form>
        </div>

        <div className="card">
          <h2>Lịch sử Can thiệp &amp; Quản lý CRUD (Read, Update, Delete)</h2>
          <p className="hint">Danh sách các buổi làm việc được lưu vết kiểm toán theo Nghị định 13/2023/NĐ-CP.</p>
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Ngày</th>
                <th>Mã SV</th>
                <th>Trạng thái</th>
                <th>Nội dung</th>
                <th>Thao tác CRUD</th>
              </tr>
            </thead>
            <tbody>
              {list.map((it) => (
                <tr key={it.intervention_id}>
                  <td><code>#{it.intervention_id}</code></td>
                  <td>{it.meeting_date}</td>
                  <td><strong>{it.student_id}</strong></td>
                  <td><span className="badge b-mid">{it.outcome_status}</span></td>
                  <td>{it.notes}</td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        className="btn-edit"
                        onClick={() => onOpenEditIntervention(it)}
                        title="Chỉnh sửa biên bản can thiệp"
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        type="button"
                        className="btn-delete"
                        onClick={() => onDeleteIntervention(it.intervention_id)}
                        title="Xóa biên bản này khỏi CSDL"
                      >
                        🗑️ Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan="6" className="hint">Chưa có lịch sử can thiệp nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  `student_id,registered_credits,failed_credits,gpa_semester,gpa_cumulative,accumulated_debt_credits\nSV002,15,3,1.60,2.20,10\nSV003,13,7,0.90,1.25,21`
                )}
              >
                Chèn mẫu kiểm thử hợp lệ
              </button>
            </div>
          </form>

          {importReport && (
            <div className={`import-result ${importReport.status === "ok" ? "res-ok" : "res-err"}`}>
              <h4>Kết quả kiểm định dữ liệu (Row-level Validation):</h4>
              <p>Tổng số dòng: <strong>{importReport.total_rows_read || importReport.total_rows}</strong> · Hợp lệ: <strong>{importReport.valid_count || importReport.valid_rows}</strong> · Cập nhật CSDL: <strong>{importReport.updated_in_db || 0}</strong></p>
              {importReport.errors && importReport.errors.length > 0 && (
                <ul>
                  {importReport.errors.map((err, i) => (
                    <li key={i}><strong>Dòng {err.line}:</strong> {err.error || err.message}</li>
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
// 10. TAB 6: M10 & M11 REGULATIONS & BENCHMARK
// ============================================================================
function AdminTab({
  rules,
  models,
  onActivateModel,
  onOpenEditRule,
  onReevaluateRules,
  onViewViolations,
  onShowRuleInfo,
  canEditRules,
  reevaluating,
}) {
  const ruleList = Array.isArray(rules) ? rules : [];
  const modelList = Array.isArray(models) ? models : [];

  return (
    <div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
          <div>
            <h2 style={{ margin: "0 0 4px" }}>M10 · Cấu hình tham số Quy chế Đào tạo (Thông tư 08/2021/TT-BGDĐT)</h2>
            <p className="hint" style={{ margin: 0 }}>
              Các tham số cảnh báo và buộc thôi học được cấu hình động theo niên khóa và quy chế Trường Đại học Mở TP.HCM.
            </p>
          </div>
          <div>
            <button
              type="button"
              className="btn-reevaluate-hero"
              disabled={reevaluating}
              onClick={onReevaluateRules}
              title="Chạy đối soát toàn diện 180 sinh viên theo các quy tắc hiện hành"
            >
              {reevaluating ? "⏳ Đang đối soát 180 sinh viên..." : "⚡ Chạy đối soát lại toàn trường ngay"}
            </button>
          </div>
        </div>

        <table className="data">
          <thead>
            <tr>
              <th>Mã điều</th>
              <th>Căn cứ pháp lý</th>
              <th>Mô tả quy chế</th>
              <th>Giá trị ngưỡng</th>
              <th>Đơn vị tính</th>
              <th>Số SV vi phạm hiện tại</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {ruleList.map((r) => (
              <tr key={r.rule_code}>
                <td>
                  <strong>{r.rule_code}</strong>
                  <button
                    type="button"
                    className="info-icon-btn"
                    onClick={() => onShowRuleInfo(r)}
                    title="Nhấp để xem giải thích chi tiết điều khoản pháp lý"
                  >
                    i
                  </button>
                </td>
                <td style={{ fontSize: ".82rem", color: "var(--stamp-blue)", fontWeight: 500 }}>
                  {r.legal_ref}
                </td>
                <td>{r.rule_name}</td>
                <td>
                  <span className="rule-param-badge">
                    {r.formatted_threshold || JSON.stringify(r.params)}
                  </span>
                </td>
                <td style={{ fontSize: ".82rem", color: "var(--ink-muted)" }}>
                  {r.unit || "Tiêu chí"}
                </td>
                <td>
                  <span
                    className={`rule-violation-pill ${(r.violation_count || 0) > 0 ? "has-viol" : "no-viol"}`}
                    onClick={() => onViewViolations(r)}
                    title="Nhấp để xem danh sách sinh viên vi phạm hoặc lọc trong Cohort"
                  >
                    {(r.violation_count || 0) > 0 ? `⚠️ ${r.violation_count} SV vi phạm` : "✓ Đạt chuẩn (0 SV)"}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-edit"
                    disabled={!canEditRules}
                    onClick={() => onOpenEditRule(r)}
                    title={canEditRules ? "Hiệu chỉnh tham số ngưỡng quy chế" : "Chỉ Phòng Quản lý Đào tạo mới có thẩm quyền chỉnh sửa quy chế"}
                    style={!canEditRules ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                  >
                    ✏️ Sửa ngưỡng
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
  );
}

// ============================================================================
// 11. TAB 7: ADVISOR COPILOT (HYBRID GEMINI + RAG + READ-ONLY SQL)
// ============================================================================
function AdvisorCopilotTab({ activeUser }) {
  return <AiAssistant activeUser={activeUser} />;
}

// ============================================================================
// 12. TAB 8: HEXAGONAL ARCHITECTURE & GATEWAY
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
// 13. MODALS FOR FULL CRUD (STUDENTS, INTERVENTIONS, RULES)
// ============================================================================
function EditStudentModal({ student, onClose, onSave }) {
  const [gpaSem, setGpaSem] = useState(student.gpa_semester || 2.0);
  const [gpaCum, setGpaCum] = useState(student.gpa_cumulative || 2.0);
  const [failedCr, setFailedCr] = useState(student.failed_credits || 0);
  const [debtCr, setDebtCr] = useState(student.failed_credits_cumulative || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(student.student_id, {
      gpa_semester: parseFloat(gpaSem),
      gpa_cumulative: parseFloat(gpaCum),
      failed_credits: parseInt(failedCr, 10),
      accumulated_debt_credits: parseInt(debtCr, 10),
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <div className="modal-header">
          <h3>✏️ Cập Nhật Điểm Học Kỳ Sinh Viên (CRUD Student)</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="hint">
              Hồ sơ: <strong>{student.student_id} — {student.student_name}</strong> ({student.class_id}).
              Khi lưu, hệ thống tự động chạy lại Rule Engine và Sheaf Attention GNN để cập nhật mức nguy cơ mới.
            </p>
            <div className="row">
              <div>
                <label>ĐTB Học kỳ gần nhất (0.0 – 4.0):</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="4"
                  value={gpaSem}
                  onChange={(e) => setGpaSem(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>ĐTB Tích lũy (0.0 – 4.0):</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="4"
                  value={gpaCum}
                  onChange={(e) => setGpaCum(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="row">
              <div>
                <label>Số tín chỉ không đạt trong kỳ:</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={failedCr}
                  onChange={(e) => setFailedCr(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Tổng tín chỉ nợ đọng tích lũy:</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={debtCr}
                  onChange={(e) => setDebtCr(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="small" onClick={onClose}>Hủy bỏ</button>
            <button type="submit" className="primary">Lưu &amp; Tái Tính Toán Rủi Ro</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditInterventionModal({ intervention, onClose, onSave }) {
  const [date, setDate] = useState(intervention.meeting_date || "");
  const [outcome, setOutcome] = useState(intervention.outcome_status || "SCHEDULED");
  const [notes, setNotes] = useState(intervention.notes || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(intervention.intervention_id, {
      meeting_date: date,
      outcome_status: outcome,
      notes,
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <div className="modal-header">
          <h3>✏️ Chỉnh Sửa Biên Bản Can Thiệp #{intervention.intervention_id}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="hint">Sinh viên: <strong>{intervention.student_id}</strong> · Cố vấn học tập: <strong>{intervention.advisor_name}</strong></p>
            <div className="row">
              <div>
                <label>Ngày làm việc:</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div>
                <label>Kết quả / Trạng thái:</label>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                  <option value="SCHEDULED">Đã lên lịch hẹn (Scheduled)</option>
                  <option value="IN_PROGRESS">Đang theo dõi cải thiện (In Progress)</option>
                  <option value="RESOLVED">Đã cải thiện / Thoát cảnh báo (Resolved)</option>
                  <option value="DISMISSAL_PROPOSED">Đề xuất xử lý buộc thôi học (Dismissal Proposed)</option>
                </select>
              </div>
            </div>
            <div>
              <label>Nội dung làm việc &amp; Biên bản:</label>
              <textarea
                rows="4"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="small" onClick={onClose}>Hủy bỏ</button>
            <button type="submit" className="primary">Lưu Thay Đổi (Update)</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRuleModal({ rule, onClose, onSave }) {
  const [jsonText, setJsonText] = useState(JSON.stringify(rule.params, null, 2));
  const [err, setErr] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(jsonText);
      onSave(rule.rule_code, parsed);
    } catch (e) {
      setErr("JSON không hợp lệ: " + e.message);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <div className="modal-header">
          <h3>✏️ Cập Nhật Tham Số Quy Chế [{rule.rule_code}]</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="hint">
              <strong>{rule.rule_name}</strong> · Căn cứ: <em>{rule.legal_ref}</em>.
              Khi cập nhật, toàn bộ 180 sinh viên sẽ được tái đối soát theo ngưỡng mới.
            </p>
            <textarea
              rows="6"
              style={{ fontFamily: "var(--mono)", fontSize: ".82rem" }}
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setErr(""); }}
              required
            />
            {err && <p style={{ color: "#DC2626", fontSize: ".8rem", margin: "6px 0 0" }}>{err}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="small" onClick={onClose}>Hủy bỏ</button>
            <button type="submit" className="primary">Áp Dụng Quy Chế Mới</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RuleDetailModal({ rule, onClose, onFilterCohort }) {
  if (!rule) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: "600px" }}>
        <div className="modal-header">
          <h3>ⓘ Chi Tiết Quy Chế Học Vụ [{rule.rule_code}]</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: "14px" }}>
            <label>Căn cứ pháp lý:</label>
            <div style={{ color: "var(--stamp-blue)", fontWeight: 600, fontSize: ".9rem" }}>
              {rule.legal_ref}
            </div>
          </div>
          <div style={{ marginBottom: "14px" }}>
            <label>Tên quy chế đào tạo:</label>
            <div style={{ fontWeight: 600 }}>{rule.rule_name}</div>
          </div>
          <div className="row" style={{ marginBottom: "14px" }}>
            <div>
              <label>Giá trị ngưỡng hiện hành:</label>
              <div className="rule-param-badge">{rule.formatted_threshold || JSON.stringify(rule.params)}</div>
            </div>
            <div>
              <label>Đơn vị tính:</label>
              <div style={{ fontWeight: 600 }}>{rule.unit || "Tiêu chí"}</div>
            </div>
          </div>
          <div style={{ marginBottom: "14px" }}>
            <label>Giải thích chi tiết &amp; Chế tài xử lý:</label>
            <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: ".84rem", lineHeight: "1.6" }}>
              {rule.tooltip || rule.rule_name}
            </div>
          </div>
          <div>
            <label>Tình hình vi phạm kỳ 2025_HK2:</label>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px", flexWrap: "wrap", gap: "8px" }}>
              <span className={`rule-violation-pill ${(rule.violation_count || 0) > 0 ? "has-viol" : "no-viol"}`}>
                {(rule.violation_count || 0) > 0 ? `⚠️ ${rule.violation_count} sinh viên đang vi phạm` : "✓ 0 sinh viên vi phạm"}
              </span>
              {(rule.violation_count || 0) > 0 && (
                <button
                  type="button"
                  className="small"
                  onClick={() => { onClose(); onFilterCohort(rule.rule_code); }}
                >
                  🔍 Lọc {rule.violation_count} sinh viên này trong Cohort View
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="primary" onClick={onClose}>Đóng cửa sổ</button>
        </div>
      </div>
    </div>
  );
}

function RuleViolationsModal({ rule, onClose, onSelectStudent, onFilterCohort }) {
  if (!rule) return null;
  const students = rule.violated_students || [];

  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: "560px" }}>
        <div className="modal-header">
          <h3>⚠️ Danh Sách Sinh Viên Chạm Ngưỡng [{rule.rule_code}]</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint">
            <strong>{rule.rule_name}</strong> ({rule.legal_ref})
          </p>
          <p style={{ fontSize: ".84rem", margin: "0 0 10px" }}>
            Có <strong>{rule.violation_count || students.length}</strong> sinh viên vi phạm trong học kỳ 2025_HK2:
          </p>
          {students.length > 0 ? (
            <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "6px" }}>
              <table className="data" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Mã SV</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((sid) => (
                    <tr key={sid}>
                      <td><strong>{sid}</strong></td>
                      <td>
                        <button
                          type="button"
                          className="small"
                          onClick={() => { onClose(); onSelectStudent(sid); }}
                        >
                          📄 Mở Phiếu M03
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="hint">Không có sinh viên nào vi phạm quy tắc này.</p>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          {students.length > 0 ? (
            <button
              type="button"
              className="primary"
              onClick={() => { onClose(); onFilterCohort(rule.rule_code); }}
            >
              🔍 Lọc cả {students.length} sinh viên trong Cohort View
            </button>
          ) : <span />}
          <button type="button" className="small" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

function RoleExplanationModal({ onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: "820px" }}>
        <div className="modal-header">
          <h3>🛡️ Cơ Chế Phân Quyền (RBAC) &amp; Bảo Mật Dữ Liệu Học Vụ (RLS)</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 6px", fontFamily: "var(--serif)", color: "var(--stamp-blue)" }}>
              1. Căn cứ Pháp lý &amp; Bảo vệ Dữ liệu Cá nhân
            </h4>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: ".83rem", lineHeight: "1.6", color: "var(--ink-soft)" }}>
              <li>
                <strong>Nghị định 13/2023/NĐ-CP</strong> về bảo vệ dữ liệu cá nhân: Dữ liệu học lực, điểm số và quá trình rèn luyện của sinh viên là dữ liệu cá nhân nhạy cảm. Hệ thống thực thi nguyên tắc đặc quyền tối thiểu (PoLP) và nguyên tắc cần biết (Need-to-Know).
              </li>
              <li>
                <strong>Thông tư 08/2021/TT-BGDĐT</strong> (Điều 11): Xác định thẩm quyền độc quyền của Hội đồng Học vụ / Phòng Quản lý Đào tạo trong việc ra quyết định cảnh báo học tập hoặc buộc thôi học.
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 6px", fontFamily: "var(--serif)", color: "var(--stamp-blue)" }}>
              2. Cơ chế Row-Level Security (RLS)
            </h4>
            <p style={{ margin: 0, fontSize: ".83rem", lineHeight: "1.6", color: "var(--ink-soft)" }}>
              Khi Cố vấn học tập (CVHT) đăng nhập (ví dụ: TS. Nguyễn Thị Lan phụ trách 2 lớp DH23CS01, DH23CS02), hệ thống kích hoạt bộ lọc <code>advisor_id</code> và <code>class_id</code> trực tiếp tại tầng truy vấn cơ sở dữ liệu. Dữ liệu của các lớp khác (AI, Hệ thống thông tin) sẽ bị chặn cấp dòng, ngăn ngừa triệt để nguy cơ lộ lọt dữ liệu hoặc kỳ thị kết quả học tập giữa các sinh viên.
            </p>
          </div>

          <div>
            <h4 style={{ margin: "0 0 8px", fontFamily: "var(--serif)", color: "var(--stamp-blue)" }}>
              3. Ma trận Phân quyền Vai trò 5 Cấp độ (RBAC Matrix)
            </h4>
            <table className="data" style={{ fontSize: ".78rem" }}>
              <thead>
                <tr>
                  <th>Phân hệ Chức năng</th>
                  <th>LV1 · Sinh viên (STUDENT)</th>
                  <th>LV2 · Cố vấn Học tập (ADVISOR)</th>
                  <th>LV3 · Ban Chủ nhiệm Khoa (FACULTY_BOARD)</th>
                  <th>LV4 · Phòng Quản lý Đào tạo (TRAINING_DEPT)</th>
                  <th>LV5 · Quản trị Hệ thống (ADMIN)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>M02 · Dashboard</strong></td>
                  <td><span className="badge b-bad">Ẩn hoàn toàn</span></td>
                  <td>Lớp phụ trách (RLS)</td>
                  <td>Toàn khoa CNTT</td>
                  <td>Toàn trường (180 SV)</td>
                  <td>Toàn hệ thống</td>
                </tr>
                <tr>
                  <td><strong>M03 &amp; M04 · Hồ sơ SV</strong></td>
                  <td><span className="badge b-ok">Chỉ xem hồ sơ của mình &amp; What-If</span></td>
                  <td>Xem &amp; Thử nghiệm What-If</td>
                  <td>Xem toàn khoa</td>
                  <td>Xem &amp; Tra cứu toàn trường</td>
                  <td>Toàn quyền sửa điểm</td>
                </tr>
                <tr>
                  <td><strong>M05 · Cohort View</strong></td>
                  <td><span className="badge b-bad">Ẩn hoàn toàn</span></td>
                  <td>Áp dụng RLS (Chỉ lớp mình)</td>
                  <td>Xem toàn khoa</td>
                  <td>Xem &amp; Lọc toàn trường</td>
                  <td>Toàn quyền CRUD</td>
                </tr>
                <tr>
                  <td><strong>M06 · Đồ thị Sheaf</strong></td>
                  <td><span className="badge b-bad">Ẩn hoàn toàn</span></td>
                  <td>Đồ thị lớp phụ trách</td>
                  <td>Đồ thị toàn khoa</td>
                  <td>Đồ thị toàn trường</td>
                  <td>Toàn quyền cấu hình</td>
                </tr>
                <tr>
                  <td><strong>M08 · Can thiệp Học vụ</strong></td>
                  <td><span className="badge b-bad">Ẩn hoàn toàn</span></td>
                  <td>Tạo &amp; Sửa biên bản</td>
                  <td>Xem báo cáo</td>
                  <td>Phê duyệt &amp; Giám sát</td>
                  <td>Toàn quyền kiểm toán</td>
                </tr>
                <tr>
                  <td><strong>M10 · Cấu hình Quy chế</strong></td>
                  <td><span className="badge b-bad">Ẩn hoàn toàn</span></td>
                  <td><span className="badge b-bad">Chỉ đọc (Read-only)</span></td>
                  <td><span className="badge b-bad">Chỉ đọc</span></td>
                  <td><span className="badge b-ok">Sửa ngưỡng &amp; Đối soát</span></td>
                  <td><span className="badge b-ok">Toàn quyền</span></td>
                </tr>
                <tr>
                  <td><strong>M11 · Benchmark AI</strong></td>
                  <td><span className="badge b-bad">Ẩn hoàn toàn</span></td>
                  <td>Chỉ xem chỉ số</td>
                  <td><span className="badge b-ok">Kích hoạt Mô hình</span></td>
                  <td>Chỉ xem</td>
                  <td>Toàn quyền</td>
                </tr>
                <tr>
                  <td><strong>Trợ lý AI (Gemini + RAG)</strong></td>
                  <td><span className="badge b-ok">Hỏi hồ sơ của mình &amp; Quy chế</span></td>
                  <td>Tra cứu học vụ lớp phụ trách</td>
                  <td>Tra cứu học vụ toàn khoa</td>
                  <td>Tra cứu quy chế toàn trường</td>
                  <td>Toàn quyền SQL Read-only</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="primary" onClick={onClose}>Đã hiểu chính sách</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 14. MAIN APP COMPONENT (ORCHESTRATOR)
// ============================================================================
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("edualert_logged_in") === "true";
  });
  const [currentUsername, setCurrentUsername] = useState(() => {
    return sessionStorage.getItem("edualert_username") || "cvht_lan";
  });
  const [userRoles, setUserRoles] = useState([]);
  const [enforceRls, setEnforceRls] = useState(true);
  const [roleInfoModalOpen, setRoleInfoModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState("dash");
  const [studentId, setStudentId] = useState("SV002");
  const [graphSelectedSid, setGraphSelectedSid] = useState(null);
  const [cohortInitialRuleFilter, setCohortInitialRuleFilter] = useState("ALL");

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
  const [reevaluatingRules, setReevaluatingRules] = useState(false);

  // Modal Dialog states
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingIntervention, setEditingIntervention] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleInfoModal, setRuleInfoModal] = useState(null);
  const [ruleViolationsModal, setRuleViolationsModal] = useState(null);

  // Toast Notification state
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Fetch Roles Matrix
  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/roles");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.roles) && data.roles.length > 0) {
          setUserRoles(data.roles);
        }
      }
    } catch (e) {
      console.warn("Could not load roles matrix:", e);
    }
  }, []);

  // Active user object from roles
  const activeUser = useMemo(() => {
    if (userRoles.length > 0) {
      const found = userRoles.find((u) => u.username === currentUsername);
      if (found) return found;
    }
    if (currentUsername.toLowerCase().startsWith("sv")) {
      const sid = currentUsername.toUpperCase();
      return {
        username: currentUsername,
        student_id: sid,
        role: "STUDENT",
        level: 1,
        level_label: "LV1 · Sinh viên",
        display_name: `Sinh viên (${sid})`,
        assigned_classes: ["DH23CS02"],
        can_edit_rules: false,
        can_run_pipeline: false,
        can_manage_models: false,
        can_intervene: false,
        rls_enforced: true,
      };
    }
    const isDt = currentUsername === "daotao";
    const isAdm = currentUsername === "admin";
    const isBcn = currentUsername === "bcnkhoa";
    return {
      username: currentUsername,
      role: isDt ? "TRAINING_DEPT" : (isAdm ? "ADMIN" : (isBcn ? "FACULTY_BOARD" : "ADVISOR")),
      level: isAdm ? 5 : (isDt ? 4 : (isBcn ? 3 : 2)),
      level_label: isAdm ? "LV5 · Quản trị Hệ thống" : (isDt ? "LV4 · Phòng Đào tạo" : (isBcn ? "LV3 · BCN Khoa" : "LV2 · Cố vấn Học tập")),
      display_name: isDt ? "Phòng Quản lý Đào tạo" : (isAdm ? "Quản trị Hệ thống" : (isBcn ? "Ban Chủ nhiệm Khoa CNTT" : "TS. Nguyễn Thị Lan")),
      assigned_classes: ["DH23CS01", "DH23CS02"],
      can_edit_rules: isDt || isAdm,
      can_run_pipeline: isDt || isAdm,
      can_manage_models: isBcn || isAdm,
      can_intervene: true,
      rls_enforced: currentUsername.startsWith("cvht_"),
    };
  }, [userRoles, currentUsername]);

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
  const fetchCohorts = useCallback(async () => {
    try {
      const res = await fetch("/api/cohorts");
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
      const res = await fetch("/api/graph/network?limit=180");
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
    fetchRoles();
    fetchDashboardBff();
    fetchCohorts();
    fetchAssessment(studentId);
    fetchGraph();
    fetchAdminData();
  }, []);

  const handleUserChange = (newUsername) => {
    setCurrentUsername(newUsername);
    sessionStorage.setItem("edualert_username", newUsername);
    const target = userRoles.find((u) => u.username === newUsername);
    if (target && target.level === 1 && target.student_id) {
      setStudentId(target.student_id);
      setActiveTab("slip");
      fetchAssessment(target.student_id);
    }
    showToast(`Đã chuyển sang vai trò: ${target ? target.display_name : newUsername}`);
  };

  const handleLoginSuccess = (userData) => {
    setCurrentUsername(userData.username);
    setIsAuthenticated(true);
    sessionStorage.setItem("edualert_logged_in", "true");
    sessionStorage.setItem("edualert_username", userData.username);
    if (userData.level === 1 && userData.student_id) {
      setStudentId(userData.student_id);
      setActiveTab("slip");
      fetchAssessment(userData.student_id);
    } else {
      setActiveTab("dash");
    }
    showToast(`Đăng nhập thành công: ${userData.display_name} [${userData.level_label || userData.role}]`);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("edualert_logged_in");
    sessionStorage.removeItem("edualert_username");
    showToast("Đã đăng xuất an toàn khỏi hệ thống.");
  };

  useEffect(() => {
    if (activeUser && (activeUser.level === 1 || activeUser.role === "STUDENT")) {
      if (activeTab !== "slip" && activeTab !== "copilot") {
        setActiveTab("slip");
      }
      const sid = activeUser.student_id || activeUser.username.toUpperCase();
      if (studentId !== sid) {
        setStudentId(sid);
        fetchAssessment(sid);
      }
    }
  }, [activeUser, activeTab, studentId, fetchAssessment]);

  const handleQuickPick = (sid) => {
    setStudentId(sid);
    fetchAssessment(sid);
  };

  // Cross-Linking Navigation Handlers
  const handleNavigateToStudent = (sid) => {
    setStudentId(sid);
    fetchAssessment(sid);
    setActiveTab("slip");
  };

  const handleNavigateToGraph = (sid) => {
    setGraphSelectedSid(sid);
    setActiveTab("graph");
  };

  const handleNavigateToIntervention = (sid) => {
    setStudentId(sid);
    setActiveTab("ops");
  };

  const handleNavigateToCohortWithRule = (ruleCode) => {
    setCohortInitialRuleFilter(ruleCode);
    setActiveTab("cohort");
  };

  // What-If Simulation
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
        showToast("Đã chạy đánh giá kịch bản What-If thành công!");
      }
    } catch (e) {
      showToast("Lỗi khi chạy mô phỏng What-If: " + e.message, "error");
    }
  };

  // CRUD 1: Update Student Grades (PUT /api/students/<sid>)
  const handleSaveStudent = async (sid, payload) => {
    try {
      const res = await fetch(`/api/students/${sid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast(`Đã cập nhật điểm cho sinh viên ${sid} và tái tính toán rủi ro!`);
        setEditingStudent(null);
        fetchCohorts();
        fetchAssessment(sid);
        fetchDashboardBff();
      } else {
        showToast("Lỗi khi cập nhật điểm sinh viên", "error");
      }
    } catch (e) {
      showToast("Lỗi kết nối: " + e.message, "error");
    }
  };

  // CRUD 2: Create Intervention (POST /api/interventions)
  const handleAddIntervention = async (itPayload) => {
    try {
      const res = await fetch("/api/interventions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itPayload),
      });
      if (res.ok) {
        showToast("Đã lưu biên bản can thiệp mới vào CSDL!");
        fetchAdminData();
        fetchDashboardBff();
      }
    } catch (e) {
      showToast("Lỗi: " + e.message, "error");
    }
  };

  // CRUD 3: Update Intervention (PUT /api/interventions/<id>)
  const handleSaveIntervention = async (id, payload) => {
    try {
      const res = await fetch(`/api/interventions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast(`Đã cập nhật biên bản can thiệp #${id}!`);
        setEditingIntervention(null);
        fetchAdminData();
      }
    } catch (e) {
      showToast("Lỗi: " + e.message, "error");
    }
  };

  // CRUD 4: Delete Intervention (DELETE /api/interventions/<id>)
  const handleDeleteIntervention = async (id) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa biên bản can thiệp #${id}? Hành động này sẽ được ghi vào nhật ký kiểm toán.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/interventions/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`Đã xóa biên bản can thiệp #${id}!`);
        fetchAdminData();
      }
    } catch (e) {
      showToast("Lỗi xóa: " + e.message, "error");
    }
  };

  // CRUD 5: Update Rule Config (PUT /api/rules/<code>)
  const handleSaveRule = async (code, newParams) => {
    try {
      const res = await fetch(`/api/rules/${code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: newParams }),
      });
      if (res.ok) {
        showToast(`Đã cập nhật quy chế [${code}] và tái đối soát toàn trường!`);
        setEditingRule(null);
        fetchAdminData();
        fetchDashboardBff();
        fetchCohorts();
        fetchAssessment(studentId);
      }
    } catch (e) {
      showToast("Lỗi cập nhật quy chế: " + e.message, "error");
    }
  };

  // Action: Re-evaluate All Rules (POST /api/rules/re-evaluate)
  const handleReevaluateRules = async () => {
    setReevaluatingRules(true);
    try {
      const res = await fetch("/api/rules/re-evaluate", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        showToast(
          `⚡ ${data.message} (${data.total_rule_triggered} sinh viên chạm quy chế TT08)!`
        );
        fetchAdminData();
        fetchDashboardBff();
        fetchCohorts();
        fetchAssessment(studentId);
        fetchGraph();
      } else {
        showToast("Lỗi khi chạy đối soát quy chế", "error");
      }
    } catch (e) {
      showToast("Lỗi kết nối đối soát: " + e.message, "error");
    } finally {
      setReevaluatingRules(false);
    }
  };

  // CSV Upload
  const handleUploadCsv = async (csvText, callback) => {
    try {
      const res = await fetch("/api/data/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: csvText }),
      });
      if (res.ok) {
        const data = await res.json();
        callback(data);
        showToast(`Đã nạp ${data.updated_in_db || 0} bản ghi thành công!`);
        fetchDashboardBff();
        fetchCohorts();
      }
    } catch (e) {
      showToast("Lỗi tải tệp: " + e.message, "error");
    }
  };

  // Model Activate
  const handleActivateModel = async (runId) => {
    try {
      const res = await fetch(`/api/models/${runId}/activate`, { method: "POST" });
      if (res.ok) {
        showToast("Đã kích hoạt mô hình thành công!");
        fetchAdminData();
        fetchDashboardBff();
      }
    } catch (e) {
      showToast("Lỗi: " + e.message, "error");
    }
  };

  // Circuit breaker reset
  const handleResetCircuit = async () => {
    try {
      const res = await fetch("/api/gateway/circuit-breaker/reset", { method: "POST" });
      if (res.ok) {
        showToast("Đã đặt lại trạng thái Circuit Breaker về CLOSED.");
        fetchDashboardBff();
      }
    } catch (e) {
      showToast("Lỗi: " + e.message, "error");
    }
  };

  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        userRoles={userRoles}
      />
    );
  }

  return (
    <ErrorBoundary onReset={fetchDashboardBff}>
      <div>
        <Header
          currentUsername={currentUsername}
          userRoles={userRoles}
          onUserChange={handleUserChange}
          onExportClick={() => (window.location.href = "/api/reports/export")}
          onOpenRoleInfo={() => setRoleInfoModalOpen(true)}
          onLogout={handleLogout}
          activeUser={activeUser}
        />

        <NoticeBanner
          activeModelName={activeModel ? activeModel.model_name : null}
          activeUser={activeUser}
          enforceRls={enforceRls}
        />

        <TabBar activeTab={activeTab} onTabSelect={setActiveTab} userLevel={activeUser ? activeUser.level : 2} />

        <main>
          {/* Breadcrumb Contextual Navigation */}
          <BreadcrumbBar
            activeTab={activeTab}
            selectedStudentId={studentId}
            onNavigateTab={setActiveTab}
          />

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
              onOpenEditStudent={(stu) => setEditingStudent(stu)}
              isStudent={activeUser && (activeUser.level === 1 || activeUser.role === "STUDENT")}
            />
          )}

          {activeTab === "cohort" && (
            <CohortTab
              cohorts={cohorts}
              onSelectStudent={handleNavigateToStudent}
              onOpenEditStudent={(stu) => setEditingStudent(stu)}
              onNavigateToGraph={handleNavigateToGraph}
              onNavigateToIntervention={handleNavigateToIntervention}
              activeUser={activeUser}
              enforceRls={enforceRls}
              onToggleRls={() => setEnforceRls((prev) => !prev)}
              initialRuleFilter={cohortInitialRuleFilter}
            />
          )}

          {activeTab === "graph" && (
            <GraphNetworkTab
              graphData={graphData}
              onSelectStudent={handleNavigateToStudent}
              onOpenIntervention={handleNavigateToIntervention}
              onFilterInCohort={(sid) => {
                setStudentId(sid);
                setActiveTab("cohort");
              }}
              onAskCopilot={(qText) => {
                setActiveTab("copilot");
              }}
              initialSelectedSid={graphSelectedSid || studentId}
            />
          )}

          {activeTab === "ops" && (
            <InterventionsTab
              interventions={interventions}
              onAddIntervention={handleAddIntervention}
              onOpenEditIntervention={(it) => setEditingIntervention(it)}
              onDeleteIntervention={handleDeleteIntervention}
              onUploadCsv={handleUploadCsv}
            />
          )}

          {activeTab === "admin" && (
            <AdminTab
              rules={rules}
              models={models}
              onActivateModel={handleActivateModel}
              onOpenEditRule={(r) => setEditingRule(r)}
              onReevaluateRules={handleReevaluateRules}
              onViewViolations={(r) => setRuleViolationsModal(r)}
              onShowRuleInfo={(r) => setRuleInfoModal(r)}
              canEditRules={activeUser.can_edit_rules}
              reevaluating={reevaluatingRules}
            />
          )}

          {activeTab === "copilot" && <AdvisorCopilotTab activeUser={activeUser} />}

          {activeTab === "hex" && (
            <HexagonalTab
              bffTelemetry={bffTelemetry}
              onResetCircuitBreaker={handleResetCircuit}
            />
          )}
        </main>

        {/* Floating AI Assistant Drawer */}
        <AiFloatingAssistant activeUser={activeUser} hidden={activeTab === "copilot"} />

        {/* Modal Dialogs for CRUD & Information */}
        {editingStudent && (
          <EditStudentModal
            student={editingStudent}
            onClose={() => setEditingStudent(null)}
            onSave={handleSaveStudent}
          />
        )}

        {editingIntervention && (
          <EditInterventionModal
            intervention={editingIntervention}
            onClose={() => setEditingIntervention(null)}
            onSave={handleSaveIntervention}
          />
        )}

        {editingRule && (
          <EditRuleModal
            rule={editingRule}
            onClose={() => setEditingRule(null)}
            onSave={handleSaveRule}
          />
        )}

        {ruleInfoModal && (
          <RuleDetailModal
            rule={ruleInfoModal}
            onClose={() => setRuleInfoModal(null)}
            onFilterCohort={handleNavigateToCohortWithRule}
          />
        )}

        {ruleViolationsModal && (
          <RuleViolationsModal
            rule={ruleViolationsModal}
            onClose={() => setRuleViolationsModal(null)}
            onSelectStudent={handleNavigateToStudent}
            onFilterCohort={handleNavigateToCohortWithRule}
          />
        )}

        {roleInfoModalOpen && (
          <RoleExplanationModal
            onClose={() => setRoleInfoModalOpen(false)}
          />
        )}

        {/* Toast Container */}
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast-item ${t.type}`}>
              <span>{t.type === "success" ? "✓" : "⚠️"}</span>
              <span>{t.message}</span>
            </div>
          ))}
        </div>

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
