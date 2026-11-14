/**
 * ============================================================================
 * EduAlert UX Layer v3 — tải TRƯỚC react_app.jsx
 *  - LoginScreen: Cổng đăng nhập phân quyền 5 cấp (LV1 Sinh viên → LV5 Quản trị)
 *  - AiAssistant: Trợ lý AI lai (Google Gemini + RAG/SQL chỉ đọc có kiểm soát)
 *  - AiFloatingAssistant: nút nổi + drawer truy cập trợ lý AI từ mọi màn hình
 *  - MarkdownView: render Markdown an toàn (không dùng innerHTML)
 * Lưu ý: tệp này chạy như script cổ điển dùng chung phạm vi toàn cục với react_app.jsx,
 * vì vậy KHÔNG khai báo lại `const { useState } = React` — dùng React.useState trực tiếp.
 * ============================================================================
 */

const LEVEL_COLORS = { 1: "var(--lv1)", 2: "var(--lv2)", 3: "var(--lv3)", 4: "var(--lv4)", 5: "var(--lv5)" };

function LevelBadge({ level, label }) {
  const lv = level || 2;
  return <span className={`lvb l${lv}`}>{label || `LV${lv}`}</span>;
}

// ---------------------------------------------------------------------------
// Markdown an toàn (tiêu đề, danh sách, **đậm**, *nghiêng*, `code`, > trích dẫn)
// ---------------------------------------------------------------------------
function renderInline(text, keyPrefix) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g);
  return parts.map((p, i) => {
    const k = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={k}>{p.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(p)) return <code key={k}>{p.slice(1, -1)}</code>;
    if (/^\*[^*]+\*$/.test(p)) return <em key={k}>{p.slice(1, -1)}</em>;
    return <React.Fragment key={k}>{p}</React.Fragment>;
  });
}

function MarkdownView({ text }) {
  const lines = String(text || "").split("\n");
  const blocks = [];
  let list = null;
  const flush = () => {
    if (list) {
      const Tag = list.ordered ? "ol" : "ul";
      blocks.push(<Tag key={`l${blocks.length}`}>{list.items.map((it, i) => <li key={i}>{renderInline(it, `li${blocks.length}-${i}`)}</li>)}</Tag>);
      list = null;
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const t = line.trim();
    let m;
    if (!t) { flush(); return; }
    if ((m = t.match(/^#{1,4}\s+(.*)$/))) { flush(); blocks.push(<h3 key={idx}>{renderInline(m[1], `h${idx}`)}</h3>); return; }
    if ((m = t.match(/^>\s?(.*)$/))) { flush(); blocks.push(<blockquote key={idx}>{renderInline(m[1], `q${idx}`)}</blockquote>); return; }
    if ((m = t.match(/^[-•*]\s+(.*)$/))) {
      if (!list || list.ordered) { flush(); list = { ordered: false, items: [] }; }
      list.items.push(m[1]); return;
    }
    if ((m = t.match(/^\d+[.)]\s+(.*)$/))) {
      if (!list || !list.ordered) { flush(); list = { ordered: true, items: [] }; }
      list.items.push(m[1]); return;
    }
    flush();
    blocks.push(<p key={idx}>{renderInline(t, `p${idx}`)}</p>);
  });
  flush();
  return <div className="md">{blocks}</div>;
}

// ---------------------------------------------------------------------------
// M01 · LOGIN GATE 5 CẤP
// ---------------------------------------------------------------------------
const FALLBACK_ACCOUNTS = [
  { username: "sv002", level: 1, level_label: "LV1 · Sinh viên", display_name: "Trần Hoàng Nam (SV002)", description: "Xem phiếu cảnh báo của chính mình, mô phỏng What-If, hỏi trợ lý AI." },
  { username: "cvht_lan", level: 2, level_label: "LV2 · Cố vấn Học tập", display_name: "TS. Nguyễn Thị Lan", description: "Quản lý lớp được phân công (RLS), lập biên bản can thiệp." },
  { username: "bcnkhoa", level: 3, level_label: "LV3 · Ban Chủ nhiệm Khoa", display_name: "Ban Chủ nhiệm Khoa CNTT", description: "Giám sát toàn khoa, đối sánh và kích hoạt mô hình AI." },
  { username: "daotao", level: 4, level_label: "LV4 · Phòng Đào tạo", display_name: "Phòng Quản lý Đào tạo", description: "Cấu hình quy chế TT08, đối soát toàn trường, xuất báo cáo." },
  { username: "admin", level: 5, level_label: "LV5 · Quản trị Hệ thống", display_name: "Quản trị Hệ thống", description: "Toàn quyền, Gateway, Audit Log." },
];

function LoginScreen({ onLoginSuccess }) {
  const [accounts, setAccounts] = React.useState(FALLBACK_ACCOUNTS);
  const [username, setUsername] = React.useState("cvht_lan");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [infoMsg, setInfoMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const passInputRef = React.useRef(null);

  React.useEffect(() => {
    fetch("/api/auth/roles")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && Array.isArray(d.roles) && d.roles.length) setAccounts(d.roles); })
      .catch(() => {});
  }, []);

  const login = async (uname, pw) => {
    setBusy(true);
    setError("");
    setInfoMsg("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uname, password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Đăng nhập thất bại.");
      onLoginSuccess(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSelectAccountCard = (uname) => {
    setUsername(uname);
    setError("");
    setInfoMsg(`Đã chọn tài khoản '${uname}'. Vui lòng nhập mật khẩu (mặc định lần đầu là: 123) rồi bấm Đăng nhập.`);
    if (passInputRef.current) passInputRef.current.focus();
  };

  const handleResetDefaultPassword = async () => {
    if (!username.trim()) {
      setError("Vui lòng chọn hoặc nhập tên tài khoản cần khôi phục mật khẩu mặc định '123'.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không thể khôi phục mật khẩu.");
      setPassword("123");
      setInfoMsg(`✓ ${data.message} Bạn có thể bấm Đăng nhập ngay.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!username.trim()) { setError("Vui lòng nhập tên đăng nhập hoặc MSSV."); return; }
    if (!password.trim()) { setError("Vui lòng nhập mật khẩu (mật khẩu mặc định lần đầu là: 123)."); return; }
    login(username.trim(), password.trim());
  };

  return (
    <div className="lg-shell">
      <aside className="lg-aside">
        <div>
          <h1 className="lg-brand">EduAlert</h1>
          <p className="lg-tag">
            Hệ thống cảnh báo sớm kết quả học tập đa cấp độ — Trường Đại học Mở TP.HCM.
            Quy chế Thông tư 08/2021 có quyền ưu tiên tuyệt đối; AI phát hiện xu hướng sớm.
          </p>
          <ul className="lg-points">
            <li><span className="ico">⚖</span><span><b>Tuân thủ Điều 11 TT08/2021</b>5 quy tắc R01–R05 cấu hình động, đối soát tức thời.</span></li>
            <li><span className="ico">◈</span><span><b>Sheaf Attention GNN</b>Dự báo ĐTB kỳ tới, phát hiện sinh viên tụt điểm trước khi chạm ngưỡng.</span></li>
            <li><span className="ico">✦</span><span><b>Trợ lý AI Least-Privilege SQL</b>Dò xét CSDL chỉ đọc (Read-Only), hỗ trợ học vụ và tự động lập kế hoạch can thiệp.</span></li>
            <li><span className="ico">🔒</span><span><b>Bảo mật Mật khẩu &amp; RLS 5 Cấp</b>Mật khẩu mặc định lần đầu <code>123</code>, bắt buộc tự đổi mật khẩu mới khi đăng nhập.</span></li>
          </ul>
        </div>
        <div className="lg-foot">
          Mật khẩu mặc định lần đầu: <code>123</code> · Mọi lượt đăng nhập &amp; đổi mật khẩu được ghi vào <code>audit_log</code>.
        </div>
      </aside>

      <main className="lg-main">
        <h2>Cổng Đăng Nhập Bắt Buộc (M01)</h2>
        <p className="lg-sub">
          Chọn một tài khoản theo 5 cấp phân quyền bên dưới hoặc tự nhập MSSV (`SV001`–`SV180`).
          <br />
          <strong style={{ color: "#1E40AF" }}>🔑 Mật khẩu mặc định lần đầu của tất cả tài khoản là: <code>123</code></strong> (Hệ thống sẽ yêu cầu bạn tự đổi sang mật khẩu mới ngay sau khi đăng nhập lần đầu).
        </p>

        {error && <div className="lg-err" role="alert">⚠ {error}</div>}
        {infoMsg && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E3A8A", fontSize: ".84rem", marginBottom: 12, fontWeight: 600 }}>
            {infoMsg}
          </div>
        )}

        <form className="lg-form" onSubmit={submit} style={{ marginBottom: 18, padding: 16, background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
            <div>
              <label htmlFor="lg-user">Tên đăng nhập / Mã số sinh viên</label>
              <input id="lg-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="VD: cvht_lan, admin, SV002..." autoComplete="username" />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="lg-pass">Mật khẩu bắt buộc</label>
                <button
                  type="button"
                  onClick={() => setPassword("123")}
                  style={{ border: "none", background: "none", color: "#2563EB", fontSize: ".75rem", fontWeight: 700, cursor: "pointer", padding: 0 }}
                >
                  Điền nhanh: 123
                </button>
              </div>
              <input
                id="lg-pass"
                ref={passInputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu (mặc định: 123)"
                autoComplete="current-password"
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
            <button type="submit" className="primary" style={{ flex: "1 1 200px", padding: "11px", fontWeight: 700 }} disabled={busy}>
              {busy ? "Đang xác thực…" : "🔐 Đăng nhập vào Hệ thống"}
            </button>
            <button
              type="button"
              onClick={handleResetDefaultPassword}
              disabled={busy}
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#fff", color: "#475569", fontSize: ".78rem", fontWeight: 600, cursor: "pointer" }}
              title="Nếu bạn đã đổi mật khẩu và quên, bấm để đặt lại về 123"
            >
              ↺ Khôi phục mật khẩu gốc (123)
            </button>
          </div>
        </form>

        <div className="lg-divider">Chọn nhanh tài khoản theo 5 cấp độ phân quyền (RBAC/RLS)</div>

        <div className="lg-levels">
          {accounts.map((a) => (
            <button
              key={a.username}
              type="button"
              className="lg-card"
              style={{
                "--lvc": LEVEL_COLORS[a.level],
                outline: username.toLowerCase() === a.username.toLowerCase() ? "2px solid #2563EB" : "none",
              }}
              onClick={() => handleSelectAccountCard(a.username)}
              disabled={busy}
              title={`Chọn tài khoản: ${a.username}`}
            >
              <div className="meta">
                <LevelBadge level={a.level} label={a.level_label} />
                <code>{a.username}</code>
              </div>
              <span className="who">{a.display_name}</span>
              <span className="desc">{a.description}</span>
              <div className="meta">
                <span>{a.assigned_classes && a.assigned_classes.length ? `Lớp: ${a.assigned_classes.join(", ")}` : "Phạm vi toàn trường/khoa"}</span>
                <span className="go">Chọn tài khoản →</span>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

function ChangePasswordModal({ username, displayName, forced, onClose, onSuccess }) {
  const [oldPassword, setOldPassword] = React.useState(forced ? "123" : "");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!oldPassword.trim() || !newPassword.trim()) {
      setError("Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.");
      return;
    }
    if (newPassword.trim() === "123") {
      setError("Mật khẩu mới KHÔNG được trùng với mật khẩu mặc định '123'!");
      return;
    }
    if (newPassword.trim().length < 3) {
      setError("Mật khẩu mới phải có ít nhất 3 ký tự.");
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setError("Xác nhận mật khẩu mới không khớp!");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          old_password: oldPassword.trim(),
          new_password: newPassword.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Đổi mật khẩu thất bại.");
      onSuccess(data.message || "Đã đổi mật khẩu thành công!");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.72)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, maxWidth: 460, width: "100%", padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.3)", border: "1px solid #E2E8F0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#0F172A" }}>
            {forced ? "🔐 Bắt Buộc Đổi Mật Khẩu Lần Đầu" : "🔑 Đổi Mật Khẩu Tài Khoản"}
          </h3>
          {!forced && (
            <button type="button" onClick={onClose} style={{ border: "none", background: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748B" }}>✕</button>
          )}
        </div>
        <p style={{ fontSize: ".85rem", color: "#475569", lineHeight: 1.5, marginTop: 0 }}>
          Tài khoản: <strong>{displayName || username}</strong> (<code>{username}</code>)<br />
          {forced
            ? "Bạn vừa đăng nhập bằng mật khẩu mặc định '123'. Theo chính sách bảo mật, bạn bắt buộc phải tự đặt mật khẩu mới (khác '123') trước khi sử dụng hệ thống."
            : "Nhập mật khẩu hiện tại và mật khẩu mới bạn muốn thay đổi."}
        </p>

        {error && (
          <div style={{ padding: "9px 12px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: ".82rem", marginBottom: 12, fontWeight: 600 }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: ".78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>Mật khẩu hiện tại</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Mật khẩu hiện tại (mặc định: 123)"
              style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: ".88rem", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: ".78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>Mật khẩu mới (khác 123, tối thiểu 3 ký tự)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới của riêng bạn"
              autoFocus
              style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: ".88rem", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: ".78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>Xác nhận mật khẩu mới</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: ".88rem", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="submit"
              disabled={busy}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", fontWeight: 700, fontSize: ".88rem", cursor: "pointer" }}
            >
              {busy ? "Đang lưu…" : "✓ Lưu Mật Khẩu Mới & Tiếp Tục"}
            </button>
            {!forced && (
              <button
                type="button"
                onClick={onClose}
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#fff", color: "#475569", fontWeight: 600, fontSize: ".85rem", cursor: "pointer" }}
              >
                Hủy
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TRỢ LÝ AI (Gemini + RAG)
// ---------------------------------------------------------------------------
function suggestionsFor(user) {
  if (user && user.level === 1) {
    return [
      "Tình hình học tập của tôi hiện nay thế nào?",
      "Giúp tôi lập kế hoạch học tập học kỳ tới để thoát cảnh báo",
      "Điều kiện cảnh báo học tập theo Thông tư 08 là gì?",
      "Bị cảnh báo 2 lần liên tiếp thì xử lý thế nào?",
    ];
  }
  const cls = user && user.assigned_classes && user.assigned_classes[0];
  return [
    "Dò xét lỗ hổng can thiệp & lập kế hoạch 4 tuần cho Khoa/CVHT",
    "Top 5 sinh viên thành tích tốt nhất toàn khóa",
    "Top 5 sinh viên tệ / nguy cơ cao nhất cần ưu tiên",
    "So sánh chất lượng học vụ giữa các lớp",
    cls ? `Danh sách sinh viên nợ trên 10 tín chỉ lớp ${cls}` : "Danh sách sinh viên được AI phát hiện sớm (chưa vi phạm TT08)",
    "Kiểm tra quyền truy cập Database Least-Privilege của AI",
    "Phân tích hồ sơ SV002 và lập kế hoạch khắc phục",
  ];
}

function useAiStatus() {
  const [status, setStatus] = React.useState(null);
  const refresh = React.useCallback(() => {
    fetch("/api/ai/status").then((r) => (r.ok ? r.json() : null)).then(setStatus).catch(() => {});
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);
  return [status, setStatus, refresh];
}

function AiAssistant({ activeUser, compact, pendingQuestion, onPendingConsumed }) {
  const [status, setStatus] = useAiStatus();
  const isStudent = activeUser && activeUser.level === 1;
  const greeting = isStudent
    ? `Chào ${activeUser.display_name || "bạn"}! Mình là trợ lý học vụ EduAlert (đã kết nối CSDL dưới quyền tối thiểu Read-Only RLS). Bạn có thể hỏi về kết quả học tập của mình hoặc quy chế Thông tư 08/2021.`
    : `Xin chào ${activeUser ? activeUser.display_name : "Thầy/Cô"}! Trợ lý AI đã được cấp quyền ĐỌC TỐI THIỂU (Least-Privilege Read-Only SQL) trên 18 bảng CSDL. Thầy/Cô có thể tra cứu Top SV tốt nhất, Top SV nguy cơ cao, so sánh các lớp, điểm rèn luyện hoặc phân tích từng MSSV.`;

  const [messages, setMessages] = React.useState([{ sender: "bot", text: greeting, engine: "system" }]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [openSql, setOpenSql] = React.useState({});
  const [showKeyForm, setShowKeyForm] = React.useState(false);
  const [apiKeyInput, setApiKeyInput] = React.useState(() => {
    const saved = (localStorage.getItem("edualert_gemini_key") || "").trim();
    if (saved && (!saved.startsWith("AIza") || saved.length < 30)) {
      localStorage.removeItem("edualert_gemini_key");
      return "";
    }
    return saved;
  });
  const [modelSelect, setModelSelect] = React.useState(() => localStorage.getItem("edualert_gemini_model") || "gemini-2.5-flash-lite");
  const [configSavedMsg, setConfigSavedMsg] = React.useState("");
  const listRef = React.useRef(null);

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    const trimmed = apiKeyInput.trim();
    if (trimmed && (!trimmed.startsWith("AIza") || trimmed.length < 30)) {
      setConfigSavedMsg("⚠ Khóa Google AI Studio phải bắt đầu bằng 'AIzaSy...' (~39 ký tự).");
      return;
    }
    localStorage.setItem("edualert_gemini_key", trimmed);
    localStorage.setItem("edualert_gemini_model", modelSelect);
    try {
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: trimmed, model: modelSelect }),
      });
      if (res.ok) {
        const st = await res.json();
        setStatus(st);
        setConfigSavedMsg(st.gemini_enabled ? "✓ Đã kích hoạt Google Gemini + SQL Least-Privilege!" : "✓ Đang dùng Bộ máy SQL Least-Privilege + RAG.");
        setTimeout(() => setConfigSavedMsg(""), 3500);
      }
    } catch (_) {}
  };

  const send = React.useCallback(async (text) => {
    const q = (text != null ? text : input).trim();
    if (!q || loading) return;
    const history = messages.filter((m) => m.engine !== "system").slice(-6).map((m) => ({ sender: m.sender, text: m.text }));
    setMessages((prev) => [...prev, { sender: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/copilot/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          history,
          role: activeUser ? activeUser.role : "ADVISOR",
          student_id: activeUser ? activeUser.student_id : undefined,
          display_name: activeUser ? activeUser.display_name : "",
          api_key: apiKeyInput.trim() || undefined,
          model: modelSelect || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Trợ lý AI không phản hồi.");
      setMessages((prev) => [...prev, {
        sender: "bot",
        text: data.answer || "Không có phản hồi.",
        citations: Array.isArray(data.citations) ? data.citations : [],
        sql: data.sql_executed,
        engine: data.engine,
        note: data.fallback_reason,
        latency: data.latency_ms,
      }]);
    } catch (e) {
      setMessages((prev) => [...prev, { sender: "bot", text: "⚠ " + e.message, engine: "error" }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, activeUser, apiKeyInput, modelSelect]);

  React.useEffect(() => {
    if (pendingQuestion) {
      send(pendingQuestion);
      if (onPendingConsumed) onPendingConsumed();
    }
    // eslint-disable-next-line
  }, [pendingQuestion]);

  const copy = (t) => { if (navigator.clipboard) navigator.clipboard.writeText(t); };
  const gemOn = status && status.gemini_enabled;

  const engineTag = (m) => {
    if (!m.engine || m.engine === "system") return null;
    if (m.engine.startsWith("gemini")) return <span className="ai-tag gem">✦ {m.engine.replace("gemini:", "Gemini ")} + SQL</span>;
    if (m.engine === "rls-guard") return <span className="ai-tag rls">🔒 Chặn bởi RLS</span>;
    if (m.engine === "error") return <span className="ai-tag rls">Lỗi</span>;
    return <span className="ai-tag gem">⚡ SQL Least-Privilege + RAG</span>;
  };

  const panel = (
    <section className="ai-panel" aria-label="Trợ lý AI EduAlert">
      <div className="ai-head">
        <h2>✦ Trợ lý AI EduAlert</h2>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="small"
            onClick={() => setShowKeyForm((v) => !v)}
            style={{ cursor: "pointer", fontWeight: 700, border: "1px solid #C7D2FE", borderRadius: 999, padding: "4px 10px", background: gemOn ? "#DCFCE7" : "#EEF2FF", color: gemOn ? "#15803D" : "#4338CA", fontSize: ".74rem" }}
            title="Bấm để cấu hình thêm Google Gemini API Key miễn phí"
          >
            <span className="dot" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#16A34A", marginRight: 5 }} />
            {status ? (gemOn ? `✦ ${status.model} + SQL Least-Privilege` : "⚡ SQL Least-Privilege (Đang bật) · ⚙ Gắn thêm Gemini Key") : "Đang kiểm tra…"}
          </button>
          <button type="button" className="small" onClick={() => setMessages([{ sender: "bot", text: greeting, engine: "system" }])} title="Xóa hội thoại">↺</button>
        </div>
      </div>

      {showKeyForm && (
        <form onSubmit={handleSaveConfig} style={{ padding: "10px 14px", background: "#EEF2FF", borderBottom: "1px solid #C7D2FE", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: ".75rem", color: "#312E81", fontWeight: 700 }}>
            🔑 Lấy Key 100% Free (không cần thẻ) tại <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: "#4338CA", textDecoration: "underline" }}>aistudio.google.com/apikey ↗</a>:
          </span>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Dán mã AIzaSy... vào đây"
            style={{ flex: "1 1 180px", padding: "5px 8px", borderRadius: 6, border: "1px solid #C7D2FE", fontSize: ".78rem" }}
          />
          <select
            value={modelSelect}
            onChange={(e) => setModelSelect(e.target.value)}
            style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #C7D2FE", fontSize: ".78rem", background: "#fff" }}
          >
            <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (Free cao nhất · 1000+ req/ngày)</option>
            <option value="gemini-2.5-flash">gemini-2.5-flash (Thông minh · Free)</option>
            <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite (Siêu nhanh · 1500 req/ngày)</option>
            <option value="gemini-2.0-flash">gemini-2.0-flash (Ổn định · 1500 req/ngày)</option>
            <option value="gemma-3-27b-it">gemma-3-27b-it (Siêu Free · 14,400 req/ngày)</option>
          </select>
          <button type="submit" style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#4F46E5", color: "#fff", fontWeight: 700, fontSize: ".78rem", cursor: "pointer" }}>
            ⚡ Lưu &amp; Bật
          </button>
          {configSavedMsg && <span style={{ fontSize: ".75rem", color: "#15803D", fontWeight: 700 }}>{configSavedMsg}</span>}
        </form>
      )}

      <div className="ai-msgs" ref={listRef} aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.sender}`}>
            <div className="ai-av">{m.sender === "user" ? (activeUser && activeUser.display_name ? activeUser.display_name.trim()[0] : "U") : "AI"}</div>
            <div className="ai-bubble">
              {m.sender === "user" ? m.text : <MarkdownView text={m.text} />}
              {m.sender === "bot" && m.engine !== "system" && (
                <div className="ai-meta">
                  {engineTag(m)}
                  {m.latency ? <span>{m.latency} ms</span> : null}
                  {m.citations && m.citations.length > 0 && <span title={m.citations.join("\n")}>📎 {m.citations.length} căn cứ</span>}
                  {m.sql && <button type="button" className="ai-linkbtn" onClick={() => setOpenSql((s) => ({ ...s, [i]: !s[i] }))}>{openSql[i] ? "Ẩn SQL" : "Xem SQL"}</button>}
                  <button type="button" className="ai-linkbtn" onClick={() => copy(m.text)}>Sao chép</button>
                </div>
              )}
              {m.note && <div className="ai-meta">ℹ {m.note}</div>}
              {m.citations && m.citations.length > 0 && !compact && (
                <div className="ai-meta" style={{ borderTop: "none", paddingTop: 0 }}>Căn cứ: {m.citations.join(" · ")}</div>
              )}
              {m.sql && openSql[i] && <pre className="ai-sql">{m.sql}</pre>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="ai-msg bot">
            <div className="ai-av">AI</div>
            <div className="ai-bubble"><span className="ai-typing"><i /><i /><i /></span></div>
          </div>
        )}
      </div>

      {compact && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "8px 12px 0", background: "#fff" }}>
          {suggestionsFor(activeUser).slice(0, 3).map((s) => (
            <button key={s} type="button" className="ai-chip" style={{ width: "auto", whiteSpace: "nowrap", marginBottom: 0 }} onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      <div className="ai-input">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={isStudent ? "Hỏi về kết quả học tập của bạn…" : "Hỏi về quy chế, sinh viên, lớp… (Enter để gửi, Shift+Enter xuống dòng)"}
          aria-label="Câu hỏi cho trợ lý AI"
        />
        <button type="button" className="ai-send" onClick={() => send()} disabled={loading || !input.trim()}>Gửi</button>
      </div>
    </section>
  );

  if (compact) return panel;

  return (
    <div className="ai-wrap">
      {panel}
      <aside className="ai-side">
        <div className="ai-card">
          <h4>Gợi ý câu hỏi</h4>
          {suggestionsFor(activeUser).map((s) => (
            <button key={s} type="button" className="ai-chip" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
        <div className="ai-card">
          <h4>Cách trợ lý hoạt động</h4>
          <ol>
            <li>Nhận diện MSSV/lớp, chạy <b>SQL chỉ đọc</b> trên CSDL.</li>
            <li>Truy xuất <b>Điều 11 TT08/2021</b> làm căn cứ.</li>
            <li>{gemOn ? <span><b>Google Gemini</b> diễn đạt câu trả lời chỉ từ dữ liệu trên.</span> : <span>Trả lời theo mẫu xác định (offline).</span>}</li>
            <li>Kiểm soát <b>RLS</b>: sinh viên chỉ hỏi được về chính mình.</li>
          </ol>
        </div>
        <div className="ai-card" style={{ borderColor: "#C7D2FE", background: "var(--ai-bg)" }}>
          <h4 style={{ color: "var(--ai)" }}>⚙ Cấu hình Google Gemini API (Free)</h4>
          <p>Lấy khóa miễn phí tại <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: "var(--ai)", fontWeight: 700 }}>aistudio.google.com/apikey ↗</a></p>
          <form onSubmit={handleSaveConfig} style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Nhập Google AI API Key (AIza...)"
              style={{ width: "100%", padding: "7px 9px", borderRadius: "6px", border: "1px solid #C7D2FE", fontSize: ".8rem", boxSizing: "border-box" }}
            />
            <select
              value={modelSelect}
              onChange={(e) => setModelSelect(e.target.value)}
              style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #C7D2FE", fontSize: ".8rem", background: "#fff" }}
            >
              <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (Free cao nhất · 1000+ req/ngày)</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash (Thông minh · Free)</option>
              <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite (Siêu nhanh · 1500 req/ngày)</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash (Ổn định · 1500 req/ngày)</option>
              <option value="gemma-3-27b-it">gemma-3-27b-it (Siêu Free · 14,400 req/ngày)</option>
            </select>
            <button type="submit" className="primary" style={{ padding: "7px", fontSize: ".8rem", fontWeight: 700, background: "var(--ai)" }}>
              ⚡ Lưu &amp; Kích hoạt Gemini
            </button>
            {configSavedMsg && (
              <div style={{ fontSize: ".76rem", color: "#15803D", fontWeight: 600, marginTop: "2px" }}>
                {configSavedMsg}
              </div>
            )}
          </form>
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nút nổi + Drawer trợ lý AI (mọi màn hình). Gọi window.askEduAlertAI("…") để mở kèm câu hỏi.
// ---------------------------------------------------------------------------
function AiFloatingAssistant({ activeUser, hidden }) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(null);

  React.useEffect(() => {
    const handler = (e) => { setOpen(true); setPending((e.detail && e.detail.question) || null); };
    window.addEventListener("edualert:ask-ai", handler);
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("edualert:ask-ai", handler); window.removeEventListener("keydown", esc); };
  }, []);

  if (hidden) return null;
  return (
    <>
      {!open && (
        <button type="button" className="ai-fab" onClick={() => setOpen(true)} aria-label="Mở trợ lý AI">✦ Hỏi trợ lý AI</button>
      )}
      {open && (
        <>
          <div className="ai-drawer-bg" onClick={() => setOpen(false)} />
          <div className="ai-drawer" role="dialog" aria-modal="true" aria-label="Trợ lý AI">
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 10px", background: "#fff", borderBottom: "1px solid var(--line)" }}>
              <button type="button" className="small" onClick={() => setOpen(false)}>Đóng ✕</button>
            </div>
            <AiAssistant activeUser={activeUser} compact pendingQuestion={pending} onPendingConsumed={() => setPending(null)} />
          </div>
        </>
      )}
    </>
  );
}

window.askEduAlertAI = function (question) {
  window.dispatchEvent(new CustomEvent("edualert:ask-ai", { detail: { question } }));
};

