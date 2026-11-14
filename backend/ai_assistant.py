# -*- coding: utf-8 -*-
"""
EduAlert — Hybrid AI Assistant (Grounded Rule-based RAG + Google Gemini API)

Kiến trúc "Grounded Generation":
  1. Tầng xác định (deterministic): backend.copilot trích thực thể (MSSV, lớp), chạy SQL chỉ đọc,
     truy xuất Điều 11 Thông tư 08/2021 -> tạo "ngữ cảnh sự thật" (facts) có trích dẫn.
  2. Tầng sinh ngôn ngữ (generative, tùy chọn): nếu có GEMINI_API_KEY, gửi facts + lịch sử hội thoại
     sang Google Gemini (gói miễn phí của Google AI Studio) để diễn đạt tự nhiên, linh hoạt.
     Gemini KHÔNG được bịa số liệu: prompt ràng buộc chỉ dùng facts được cung cấp.
  3. Fallback: không có khóa / lỗi mạng / hết quota -> trả lời bằng tầng xác định (hệ thống vẫn chạy offline).

Không phụ thuộc thư viện ngoài: gọi REST API bằng urllib (chuẩn thư viện Python).
Author: Huynh Le Thanh Hai — HCMC Open University
"""

import os
import json
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.copilot import KNOWLEDGE_BASE, answer_copilot_query

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = "gemini-2.5-flash"

_last_error: Dict[str, Any] = {"message": None, "at": None}


def _load_dotenv() -> None:
    """Nạp biến môi trường từ tệp .env ở thư mục gốc dự án (nếu có) — không cần python-dotenv."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


_load_dotenv()


def _api_key(override_key: Optional[str] = None) -> Optional[str]:
    if override_key and override_key.strip():
        return override_key.strip()
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")


def _model(override_model: Optional[str] = None) -> str:
    if override_model and override_model.strip():
        return override_model.strip()
    return os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)


def set_gemini_config(api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
    if api_key is not None:
        os.environ["GEMINI_API_KEY"] = api_key.strip()
    if model and model.strip():
        os.environ["GEMINI_MODEL"] = model.strip()
    return ai_status()


def ai_status() -> Dict[str, Any]:
    enabled = bool(_api_key())
    return {
        "provider": "Google Gemini API (Google AI Studio)" if enabled else "Rule-based RAG (offline)",
        "model": _model() if enabled else "edualert-rag-v2 (deterministic)",
        "gemini_enabled": enabled,
        "mode": "HYBRID_GROUNDED" if enabled else "OFFLINE_RAG",
        "last_error": _last_error["message"],
        "how_to_enable": (
            "Tạo khóa miễn phí tại https://aistudio.google.com/apikey rồi nhập trực tiếp trên giao diện "
            "hoặc đặt biến môi trường GEMINI_API_KEY (tệp .env cục bộ hoặc App Settings trên Azure)."
        ),
    }


ROLE_PERSONA = {
    "STUDENT": "sinh viên (chỉ được xem dữ liệu của chính mình)",
    "ADVISOR": "Cố vấn học tập (chỉ xem các lớp được phân công)",
    "FACULTY_BOARD": "Ban Chủ nhiệm Khoa",
    "TRAINING_DEPT": "Phòng Quản lý Đào tạo",
    "ADMIN": "Quản trị hệ thống",
}

SYSTEM_PROMPT = """Bạn là EduAlert AI — trợ lý học vụ của Trường Đại học Mở TP.HCM.
Nhiệm vụ: giải thích quy chế Điều 11 Thông tư 08/2021/TT-BGDĐT, phân tích hồ sơ cảnh báo học tập,
và đề xuất kế hoạch can thiệp/cải thiện cụ thể, khả thi.

QUY TẮC BẮT BUỘC:
1. Chỉ dùng số liệu có trong mục [DỮ LIỆU HỆ THỐNG]. Tuyệt đối không bịa MSSV, điểm, tín chỉ hay tên người.
2. Khi nêu quy định, trích dẫn rõ (ví dụ: "Điều 11, Khoản 1b TT08/2021").
3. Quyết định cảnh báo/buộc thôi học thuộc thẩm quyền Nhà trường; mô hình AI chỉ mang tính hỗ trợ.
4. Tôn trọng Nghị định 13/2023/NĐ-CP: không tiết lộ dữ liệu ngoài phạm vi quyền của người hỏi.
5. Trả lời bằng tiếng Việt, ngắn gọn, có cấu trúc Markdown (tiêu đề ###, gạch đầu dòng, **in đậm** số liệu chính).
6. Nếu dữ liệu không đủ để trả lời, nói rõ và gợi ý câu hỏi cụ thể hơn.
7. Giọng điệu: chuyên nghiệp, ân cần; với sinh viên thì động viên, mang tính hướng dẫn."""


def _build_prompt(question: str, facts: Dict[str, Any], role: str, display_name: str) -> str:
    regulation = "\n".join(f"- [{d['citation']}] {d['content']}" for d in KNOWLEDGE_BASE)
    sql = facts.get("sql_executed") or "(không truy vấn CSDL)"
    return (
        f"[NGƯỜI HỎI] {display_name or 'Người dùng'} — vai trò: {ROLE_PERSONA.get(role, role)}\n\n"
        f"[QUY CHẾ THAM CHIẾU]\n{regulation}\n\n"
        f"[DỮ LIỆU HỆ THỐNG — kết quả truy xuất xác định, SQL chỉ đọc]\n"
        f"SQL: {sql}\n"
        f"Kết quả:\n{facts.get('answer', '')}\n\n"
        f"[CÂU HỎI] {question}\n\n"
        f"Hãy trả lời câu hỏi dựa trên dữ liệu trên. Nếu là câu hỏi về một sinh viên, hãy giải thích nguyên nhân "
        f"và đưa ra kế hoạch hành động 3–5 bước có mốc thời gian."
    )


def _call_gemini(prompt: str, history: List[Dict[str, str]], api_key: Optional[str] = None, model: Optional[str] = None) -> Optional[str]:
    key = _api_key(api_key)
    if not key:
        return None
    use_model = _model(model)

    contents = []
    for turn in (history or [])[-6:]:
        text = (turn.get("text") or "").strip()
        if not text:
            continue
        contents.append({
            "role": "user" if turn.get("sender") == "user" else "model",
            "parts": [{"text": text[:2000]}],
        })
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.35, "maxOutputTokens": 1400},
    }
    req = urllib.request.Request(
        GEMINI_ENDPOINT.format(model=use_model),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        parts = data["candidates"][0]["content"]["parts"]
        text = "".join(p.get("text", "") for p in parts).strip()
        _last_error["message"] = None
        return text or None
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")[:300]
        _last_error.update(message=f"HTTP {e.code}: {detail}", at=time.time())
    except Exception as e:  # network error, timeout, malformed response
        _last_error.update(message=str(e)[:300], at=time.time())
    return None


def ask_assistant(
    question: str,
    history: Optional[List[Dict[str, str]]] = None,
    role: str = "ADVISOR",
    display_name: str = "",
    restrict_student_id: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """Điểm vào duy nhất cho Copilot: luôn chạy tầng xác định trước, sau đó (tùy chọn) Gemini diễn đạt."""
    facts = answer_copilot_query(question, restrict_student_id=restrict_student_id)

    if facts.get("blocked"):
        facts["engine"] = "rls-guard"
        return facts

    t0 = time.time()
    use_model = _model(model)
    generated = _call_gemini(_build_prompt(question, facts, role, display_name), history or [], api_key=api_key, model=use_model)
    if generated:
        return {
            "answer": generated,
            "citations": facts.get("citations", []),
            "sql_executed": facts.get("sql_executed"),
            "engine": f"gemini:{use_model}",
            "grounded": True,
            "latency_ms": int((time.time() - t0) * 1000),
        }

    facts["engine"] = "rule-based-rag"
    facts["grounded"] = True
    if _api_key(api_key) and _last_error["message"]:
        facts["fallback_reason"] = f"Gemini tạm thời không phản hồi ({_last_error['message'][:80]}) — đã chuyển sang chế độ RAG offline."
    return facts

