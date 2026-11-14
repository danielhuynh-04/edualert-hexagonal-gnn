# -*- coding: utf-8 -*-
"""
Root WSGI entrypoint for Azure App Service (Oryx auto-detection) & Gunicorn.
Allows Azure App Service to boot EduAlert automatically without custom startup commands.
"""
from backend.wsgi import app, application

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=False)

