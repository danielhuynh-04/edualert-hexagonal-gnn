# -*- coding: utf-8 -*-
"""
WSGI entry point cho môi trường production (Azure App Service / Docker / gunicorn).
Startup command:  gunicorn --bind=0.0.0.0:8000 --timeout 600 --workers 2 backend.wsgi:app
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app import app, ensure_initialized  # noqa: E402

ensure_initialized()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)

