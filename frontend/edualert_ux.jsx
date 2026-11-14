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
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/auth/roles")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && Array.isArray(d.roles) && d.roles.length) setAccounts(d.roles); })
      .catch(() => {});
  }, []);

  const login = async (uname) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uname }),
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

  const submit = (e) => {
    e.preventDefault();
    if (!username.trim()) { setError("Vui lòng nhập tên đăng nhập hoặc MSSV."); return; }
    login(username.trim());
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
            <li><span className="ico">✦</span><span><b>Trợ lý AI Google Gemini</b>Trả lời dựa trên dữ liệu thật (grounded), trích dẫn quy chế, SQL chỉ đọc.</span></li>
            <li><span className="ico">🔒</span><span><b>Phân quyền 5 cấp + RLS</b>Bảo vệ dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP.</span></li>
          </ul>
        </div>
        <div className="lg-foot">
          Môi trường demo: mật khẩu không được kiểm tra. Mọi lượt đăng nhập được ghi vào <code>audit_log</code>.
        </div>
      </aside>

      <main className="lg-main">
        <h2>Đăng nhập</h2>
        <p className="lg-sub">Chọn nhanh một tài khoản demo theo cấp thẩm quyền, hoặc nhập tài khoản bên dưới.</p>

        {error && <div className="lg-err" role="alert">⚠ {error}</div>}

        <div className="lg-levels">
          {accounts.map((a) => (
            <button
              key={a.username}
              type="button"
              className="lg-card"
              style={{ "--lvc": LEVEL_COLORS[a.level] }}
              onClick={() => login(a.username)}
              disabled={busy}
              title={`Đăng nhập nhanh: ${a.username}`}
            >
              <div className="meta">
                <LevelBadge level={a.level} label={a.level_label} />
                <code>{a.username}</code>
              </div>
              <span className="who">{a.display_name}</span>
              <span className="desc">{a.description}</span>
              <div className="meta">
                <span>{a.assigned_classes && a.assigned_classes.length ? `Lớp: ${a.assigned_classes.join(", ")}` : "Phạm vi rộng"}</span>
                <span className="go">Vào →</span>
              </div>
            </button>
          ))}
        </div>

        <div className="lg-divider">hoặc đăng nhập bằng tài khoản</div>

        <form className="lg-form" onSubmit={submit}>
          <label htmlFor="lg-user">Tên đăng nhập / Mã số sinh viên</label>
          <input id="lg-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="VD: cvht_lan hoặc SV002" autoComplete="username" />
          <div className="hint">Cán bộ dùng tên đăng nhập; sinh viên dùng MSSV (SV001 … SV180).</div>
          <label htmlFor="lg-pass">Mật khẩu</label>
          <input id="lg-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          <button type="submit" className="primary" style={{ width: "100%", padding: "11px", fontWeight: 700 }} disabled={busy}>
            {busy ? "Đang xác thực…" : "Đăng nhập"}
          </button>
        </form>
      </main>
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
      "Tôi cần làm gì để không bị cảnh báo học tập kỳ tới?",
      "Điều kiện cảnh báo học tập theo Thông tư 08 là gì?",
      "Bị cảnh báo 2 lần liên tiếp thì sao?",
    ];
  }
  const cls = user && user.assigned_classes && user.assigned_classes[0];
  return [
    "Top sinh viên cần ưu tiên can thiệp kỳ này?",
    cls ? `Danh sách sinh viên nợ trên 10 tín chỉ lớp ${cls}` : "Danh sách sinh viên nợ trên 10 tín chỉ lớp DH23CS01",
    "Vì sao SV002 bị cảnh báo sớm dù chưa chạm quy chế?",
    "Lập kế hoạch khắc phục cho sinh viên SV003",
    "Trường hợp nào sinh viên bị buộc thôi học?",
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
    ? `Chào ${activeUser.display_name || "bạn"}! Mình là trợ lý học vụ EduAlert. Bạn có thể hỏi về tình hình học tập của mình hoặc quy chế Thông tư 08/2021.`
    : `Xin chào ${activeUser ? activeUser.display_name : "Thầy/Cô"}! Tôi có thể phân tích hồ sơ sinh viên, lọc danh sách theo lớp/nợ tín chỉ và giải thích Điều 11 Thông tư 08/2021.`;

  const [messages, setMessages] = React.useState([{ sender: "bot", text: greeting, engine: "system" }]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [openSql, setOpenSql] = React.useState({});
  const [apiKeyInput, setApiKeyInput] = React.useState(() => localStorage.getItem("edualert_gemini_key") || "");
  const [modelSelect, setModelSelect] = React.useState(() => localStorage.getItem("edualert_gemini_model") || "gemini-2.5-flash");
  const [configSavedMsg, setConfigSavedMsg] = React.useState("");
  const listRef = React.useRef(null);

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    localStorage.setItem("edualert_gemini_key", apiKeyInput.trim());
    localStorage.setItem("edualert_gemini_model", modelSelect);
    try {
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKeyInput.trim(), model: modelSelect }),
      });
      if (res.ok) {
        const st = await res.json();
        setStatus(st);
        setConfigSavedMsg(st.gemini_enabled ? "✓ Đã kích hoạt Google Gemini API!" : "Đã chuyển về chế độ RAG Offline.");
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
    if (m.engine.startsWith("gemini")) return <span className="ai-tag gem">✦ {m.engine.replace("gemini:", "Gemini ")}</span>;
    if (m.engine === "rls-guard") return <span className="ai-tag rls">🔒 Chặn bởi RLS</span>;
    if (m.engine === "error") return <span className="ai-tag rls">Lỗi</span>;
    return <span className="ai-tag">RAG offline</span>;
  };

  const panel = (
    <section className="ai-panel" aria-label="Trợ lý AI EduAlert">
      <div className="ai-head">
        <h2>✦ Trợ lý AI EduAlert</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`ai-status ${gemOn ? "on" : ""}`} title={status ? status.how_to_enable : ""}>
            <span className="dot" />
            {status ? (gemOn ? `Google ${status.model}` : "Chế độ offline (RAG)") : "Đang kiểm tra…"}
          </span>
          <button type="button" className="small" onClick={() => setMessages([{ sender: "bot", text: greeting, engine: "system" }])} title="Xóa hội thoại">↺</button>
        </div>
      </div>

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
              <option value="gemini-2.5-flash">gemini-2.5-flash (Khuyên dùng - Free)</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash (Nhanh - Free)</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash (Ổn định - Free)</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro (Chuyên sâu)</option>
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

