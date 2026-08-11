# CampusAI Mentor 🚀

> **Your Personal AI Career & Academic Partner**  
> MERN-style full-stack app: **React (frontend) + Express + Node.js + PostgreSQL (backend)**.

CampusAI Mentor is an intelligent, full-stack career and skill accelerator for university students. It empowers students to track skill growth, benchmark technical proficiencies against peer cohorts, optimize resumes with AI feedback, and receive 24/7 personalized mentorship.

---

## ✨ Key Features

- **📊 Student Command Dashboard**
- **👥 Peer Skill Comparison Matrix**
- **📄 Resume AI Analysis Engine**
- **🎓 Verified Student Profile**
- **🤖 24/7 AI Mentor Chat** (Google Gemini, server-side)
- **🎬 Live Interactive 2-Minute Presentation**

---

## 🛠️ Tech Stack

- **Frontend** (`react/`): React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion
- **Backend** (`backend/`): Express.js (Node.js), `pg`
- **Database**: PostgreSQL (seeded with default demo data)
- **AI Integration**: `@google/genai` (Gemini API server-side proxy)

---

## 📁 Project Structure

```
campus-ai-mentor-main/
├── backend/                 # Express + PostgreSQL API
│   ├── src/
│   │   ├── server.js        # Express app + API routes
│   │   ├── db.js            # pg connection pool
│   │   ├── seed-data.js     # Default seed data
│   │   ├── seed.js          # Run to (re)seed the database
│   │   ├── init-db.js       # Creates the database if missing
│   │   └── schema.sql       # Table definitions
│   └── .env.example
└── react/                   # React frontend (Vite)
    └── src/
        ├── api.ts           # API client
        ├── App.tsx
        └── components/
```

---

## ⚡ Quick Start

### 1. Install dependencies

```bash
npm install        # in backend/
npm install        # in react/
```

### 2. Set up PostgreSQL

Create a `.env` file in `backend/` (copy from `.env.example`):

```env
DATABASE_URL="postgres://postgres:YOUR_PASSWORD@localhost:5432/campus_ai_mentor"
GEMINI_API_KEY="your_gemini_api_key_here"   # optional for AI chat
PORT=5000
```

Create the database (once):

```bash
npm run db:setup   # in backend/
```

Seed the database with default demo data:

```bash
npm run seed       # in backend/
```

### 3. Run the backend

```bash
npm run dev        # in backend/  → http://localhost:5000
```

### 4. Run the React frontend

```bash
npm run dev        # in react/    → http://localhost:5173
```

The Vite dev server proxies `/api` requests to the backend on port 5000.

---

## 🏗️ Production Build

```bash
npm run build      # in react/    → outputs react/dist
npm start          # in backend/  → serves API + static React build on :5000
```

---

## 📄 License
MIT License. Created with Google AI Studio.
