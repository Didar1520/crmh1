@echo off
REM -----------------------------------------------------------
REM Запуск CRM (сервер + UI) одним двойным щелчком
REM -----------------------------------------------------------

REM 1) Backend
start "CRM Server" cmd /k ^
  "cd /d \"D:\Didar1520\CRM\" && node server.js"

REM 2) Front‑end (UI)
start "CRM UI" cmd /k ^
  "cd /d \"D:\Didar1520\CRM\UI\" && npm run dev"

exit
