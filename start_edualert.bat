@echo off
title EduAlert Hexagonal Platform (Node.js BFF :3000 + Python Core :8000)
echo [1/2] Starting Python Hexagonal Core Service on http://127.0.0.1:8000 ...
start "EduAlert-Python-Core" cmd /k "python e:\cnlthd\edualert\backend\app.py"
timeout /t 2 /nobreak >nul
echo [2/2] Starting Node.js v24 Enterprise BFF Gateway on http://127.0.0.1:3000 ...
start "EduAlert-NodeJS-Gateway" cmd /k "node e:\cnlthd\edualert\node_gateway\server.js"
timeout /t 2 /nobreak >nul
echo Opening browser at http://127.0.0.1:3000 ...
start http://127.0.0.1:3000

