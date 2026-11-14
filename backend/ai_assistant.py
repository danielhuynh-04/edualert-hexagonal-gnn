# -*- coding: utf-8 -*-
"""
EduAlert — Hybrid AI Assistant (Least-Privilege Read-Only SQL Explorer + Google Gemini Free-Tier Cascade)

Kiến trúc 3 tầng bảo mật & chính xác:
  1. Tầng CSDL Quyền Tối Thiểu (Least-Privilege SQLite Authorizer):
     backend.copilot mở kết nối Read-Only (`PRAGMA query_only = ON` + `sqlite3.set_authorizer`),
     chặn tuyệt đối INSERT/UPDATE/DELETE/DROP và ẩn các cột nhạy cảm (`users.password_hash`, `anon_hash`).
  2. Tầng Biên dịch Ngữ nghĩa NL-to-SQL (Semantic SQL Compiler):
     Tự động phân tích câu hỏi tiếng Việt (Top SV tốt nhất, Top SV nguy cơ cao, So sánh các lớp,
     Điểm rèn luyện, Cảnh báo sớm Sheaf GNN, Đối sánh mô hình AI, Lọc nợ tín chỉ/GPA...) và chạy SQL thật.
  3. Tầng Sinh Ngôn Ngữ Google AI Studio (Free-Tier Multi-Model Cascade):
     Nếu có khóa `AIzaSy...` hợp lệ, xoay vòng qua 5 mô hình miễn phí (`gemini-2.5-flash-lite`,
     `gemini-2.5-flash`, `gemini-2.0-flash-lite`, `gemini-2.0-flash`, `gemma-3-27b-it`).

Author: Huynh Le Thanh Hai — HCMC Open University
"""

import os
import json
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.copilot import KNOWLEDGE_BASE, DB_SCHEMA_SUMMARY, answer_copilot_query, execute_safe_readonly_sql

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = "gemini-2.5-flash-lite"

FREE_TIER_CASCADE = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemma-3-27b-it",
]

PERSISTENT_CONFIG_PATHS = [
    Path("/home/site/edualert_ai_config.json"),
    Path(__file__).resolve().parent.parent / ".edualert_ai_config.json",
]

_last_error: Dict[str, Any] = {"message": None, "at": None}


def _is_valid_key_format(val: Optional[str]) -> bool:
    if not val:
        return False
    s = val.strip()
    return s.startswith("AIza") and len(s) >= 30 and " " not in s


def _clear_invalid_saved_key() -> None:
    os.environ.pop("GEMINI_API_KEY", None)
    for cfg_path in PERSISTENT_CONFIG_PATHS:
        try:
            if cfg_path.exists():
                cfg_path.unlink()
        except Exception:
            pass


def _load_dotenv() -> None:
    """Nạp biến môi trường từ tệp .env hoặc file cấu hình bền vững trên Azure (/home/site)."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key, val = key.strip(), val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val
    for cfg_path in PERSISTENT_CONFIG_PATHS:
        try:
            if cfg_path.exists():
                data = json.loads(cfg_path.read_text(encoding="utf-8"))
                saved_key = data.get("api_key", "")
                if _is_valid_key_format(saved_key) and not _is_valid_key_format(os.environ.get("GEMINI_API_KEY")):
                    os.environ["GEMINI_API_KEY"] = saved_key.strip()
                if data.get("model") and not os.environ.get("GEMINI_MODEL"):
                    os.environ["GEMINI_MODEL"] = data["model"]
                break
        except Exception:
            pass


_load_dotenv()


def _api_key(override_key: Optional[str] = None) -> Optional[str]:
    if _is_valid_key_format(override_key):
        return override_key.strip()  # type: ignore
    env_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if _is_valid_key_format(env_key):
        return env_key.strip()  # type: ignore
    return None


def _model(override_model: Optional[str] = None) -> str:
    if override_model and override_model.strip():
        return override_model.strip()
    return os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)


def set_gemini_config(api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
    if api_key is not None:
        cleaned = api_key.strip()
        if _is_valid_key_format(cleaned):
            os.environ["GEMINI_API_KEY"] = cleaned
            _last_error["message"] = None
        else:
            _clear_invalid_saved_key()
            if cleaned:
                _last_error["message"] = "Khóa API không hợp lệ (Khóa Google AI Studio phải bắt đầu bằng 'AIzaSy...' và dài ~39 ký tự)."
    if model and model.strip():
        os.environ["GEMINI_MODEL"] = model.strip()

    if _api_key():
        payload = {
            "api_key": _api_key(),
            "model": os.environ.get("GEMINI_MODEL", DEFAULT_MODEL),
        }
        for cfg_path in PERSISTENT_CONFIG_PATHS:
            try:
                if cfg_path.parent.exists():
                    cfg_path.write_text(json.dumps(payload), encoding="utf-8")
                    break
            except Exception:
                continue
    return ai_status()


def ai_status() -> Dict[str, Any]:
    enabled = bool(_api_key())
    return {
        "provider": "Google AI Studio + Least-Privilege SQL" if enabled else "Least-Privilege SQL + RAG Engine",
        "model": _model() if enabled else "SQL-Explorer-v3 (Read-Only Least Privilege)",
        "gemini_enabled": enabled,
        "least_privilege_sql": True,
        "mode": "HYBRID_GROUNDED" if enabled else "SQL_RAG_ENGINE",
        "free_cascade_models": FREE_TIER_CASCADE,
        "last_error": _last_error["message"],
        "how_to_enable": (
            "Đang bật sẵn truy vấn trực tiếp CSDL dưới quyền tối thiểu (Read-Only SQLite Authorizer). "
            "Có thể gắn thêm khóa miễn phí AIzaSy... từ https://aistudio.google.com/apikey để kích hoạt thêm Google Gemini."
        ),
    }


ROLE_PERSONA = {
    "STUDENT": "sinh viên (chỉ được xem dữ liệu của chính mình)",
    "ADVISOR": "Cố vấn học tập (chỉ xem các lớp được phân công)",
    "FACULTY_BOARD": "Ban Chủ nhiệm Khoa",
    "TRAINING_DEPT": "Phòng Quản lý Đào tạo",
    "ADMIN": "Quản trị hệ thống",
}

SYSTEM_PROMPT = f"""Bạn là EduAlert AI — trợ lý phân tích dữ liệu học vụ của Trường Đại học Mở TP.HCM.
Bạn được cấp quyền ĐỌC TỐI THIỂU (Read-Only Least Privilege) trên CSDL 18 bảng của EduAlert.

{DB_SCHEMA_SUMMARY}

QUY TẮC BẮT BUỘC:
1. Chỉ dùng số liệu có trong mục [DỮ LIỆU TRUY VẤN TỪ CSDL]. Tuyệt đối không bịa MSSV, điểm, tín chỉ hay tên người.
2. Phân biệt rõ câu hỏi về nhóm sinh viên TỐT/GIỎI/ĐIỂM CAO với nhóm sinh viên YẾU/NGUY CƠ CAO.
3. Khi nêu quy định pháp lý, trích dẫn rõ (ví dụ: "Điều 11, Khoản 1b TT08/2021").
4. Tôn trọng Nghị định 13/2023/NĐ-CP và nguyên lý Least Privilege: không tiết lộ dữ liệu ngoài phạm vi quyền của người hỏi.
5. Trả lời bằng tiếng Việt, trình bày rõ ràng bằng Markdown (tiêu đề ###, danh sách đánh số, **in đậm** số liệu chính)."""


def _build_prompt(question: str, facts: Dict[str, Any], role: str, display_name: str) -> str:
    regulation = "\n".join(f"- [{d['citation']}] {d['content']}" for d in KNOWLEDGE_BASE)
    sql = facts.get("sql_executed") or "(không truy vấn CSDL)"
    return (
        f"[NGƯỜI HỎI] {display_name or 'Người dùng'} — vai trò: {ROLE_PERSONA.get(role, role)}\n\n"
        f"[DỮ LIỆU TRUY VẤN TỪ CSDL — Đã thực thi dưới quyền Read-Only Least Privilege]\n"
        f"Câu lệnh SQL đã chạy: {sql}\n"
        f"Kết quả trích xuất:\n{facts.get('answer', '')}\n\n"
        f"[QUY CHẾ THAM CHIẾU]\n{regulation}\n\n"
        f"[CÂU HỎI CỦA NGƯỜI DÙNG] {question}\n\n"
        f"Hãy tổng hợp và trình bày câu trả lời thật chính xác, bám sát 100% danh sách và số liệu trong [DỮ LIỆU TRUY VẤN TỪ CSDL]."
    )


def _call_single_model(candidate_model: str, prompt: str, history: List[Dict[str, str]], key: str) -> Optional[str]:
    is_gemma = candidate_model.startswith("gemma-")
    contents = []
    for turn in (history or [])[-6:]:
        text = (turn.get("text") or "").strip()
        if not text:
            continue
        contents.append({
            "role": "user" if turn.get("sender") == "user" else "model",
            "parts": [{"text": text[:2000]}],
        })
    final_user_text = f"{SYSTEM_PROMPT}\n\n---\n\n{prompt}" if is_gemma else prompt
    contents.append({"role": "user", "parts": [{"text": final_user_text}]})

    payload: Dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"temperature": 0.25, "maxOutputTokens": 1500},
    }
    if not is_gemma:
        payload["systemInstruction"] = {"parts": [{"text": SYSTEM_PROMPT}]}

    req = urllib.request.Request(
        GEMINI_ENDPOINT.format(model=candidate_model),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=22) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    parts = data["candidates"][0]["content"]["parts"]
    text = "".join(p.get("text", "") for p in parts).strip()
    return text or None


def _call_gemini(
    prompt: str,
    history: List[Dict[str, str]],
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> Tuple[Optional[str], str]:
    key = _api_key(api_key)
    if not key:
        return None, ""
    preferred = _model(model)
    candidates = [preferred] + [m for m in FREE_TIER_CASCADE if m != preferred]

    for candidate in candidates:
        try:
            text = _call_single_model(candidate, prompt, history, key)
            if text:
                _last_error["message"] = None
                return text, candidate
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="ignore")[:240]
            if e.code in (400, 401, 403) and ("API_KEY_INVALID" in detail or "API key not valid" in detail):
                _clear_invalid_saved_key()
                _last_error.update(
                    message="Khóa Google AI API không hợp lệ — đã tự động chuyển về Bộ máy SQL Least-Privilege nội bộ.",
                    at=time.time(),
                )
                return None, ""
            _last_error.update(message=f"{candidate} HTTP {e.code}", at=time.time())
            continue
        except Exception as e:
            _last_error.update(message=f"{candidate}: {str(e)[:120]}", at=time.time())
            continue
    return None, preferred


def ask_assistant(
    question: str,
    history: Optional[List[Dict[str, str]]] = None,
    role: str = "ADVISOR",
    display_name: str = "",
    restrict_student_id: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Điểm vào duy nhất cho Trợ lý AI:
    1. Luôn chạy Bộ máy NL-to-SQL Least-Privilege (backend.copilot) để lấy dữ liệu thật từ SQLite.
    2. Nếu có khóa Gemini hợp lệ, Gemini sẽ diễn đạt sâu hơn dựa trên kết quả SQL đó.
    """
    t0 = time.time()
    facts = answer_copilot_query(question, restrict_student_id=restrict_student_id)

    if facts.get("blocked"):
        facts["engine"] = "rls-guard"
        return facts

    generated, used_model = _call_gemini(
        _build_prompt(question, facts, role, display_name),
        history or [],
        api_key=api_key,
        model=model,
    )
    if generated:
        return {
            "answer": generated,
            "citations": facts.get("citations", []),
            "sql_executed": facts.get("sql_executed"),
            "engine": f"gemini:{used_model}",
            "grounded": True,
            "latency_ms": int((time.time() - t0) * 1000),
        }

    facts["engine"] = "sql-least-privilege"
    facts["grounded"] = True
    facts["latency_ms"] = max(1, int((time.time() - t0) * 1000))
    return facts
