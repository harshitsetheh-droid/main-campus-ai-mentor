@echo off
rem CampusAI Mentor local dev - Supabase DB hota hai, koi deploy nahi.
start "CampusAI Backend (port 5000)" cmd /k "cd /d %~dp0backend && npm run dev"
start "CampusAI Frontend (http://localhost:5173)" cmd /k "cd /d %~dp0react && npm run dev"
