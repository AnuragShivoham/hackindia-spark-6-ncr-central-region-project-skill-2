# AMIT-BODHIT

AI Project Mentor that forces execution.

**Goal → Milestones → Daily Tasks → Guided Steps → QA → Completion**

---

## Stack

| Layer    | Tech                          |
|----------|-------------------------------|
| Backend  | Node.js + Express             |
| Database | SQLite via better-sqlite3     |
| AI       | Anthropic Claude API          |
| Frontend | React 18 + Vite               |
| State    | Zustand                       |

---

## Setup

### Prerequisites
- Node.js 18+
- Anthropic API key → https://console.anthropic.com

### Step 1 — Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### Step 2 — Configure API key

```bash
cd backend
cp .env.example .env
# Open .env and set ANTHROPIC_API_KEY=sk-ant-YOUR_KEY
```

### Step 3 — Start backend (Terminal 1)

```bash
cd backend
npm run dev
# Running at http://localhost:3001
```

### Step 4 — Start frontend (Terminal 2)

```bash
cd frontend
npm run dev
# Running at http://localhost:5173
```

Open **http://localhost:5173**

The database (SQLite) auto-creates at `backend/data/amitbodhit.db` on first run.

---

## How It Works

1. Register (or skip as guest)
2. Submit your project goal — must include tech, domain, deadline
3. Answer clarifying questions if needed (max 3 rounds)
4. Receive your milestone plan + first task
5. Execute tasks using the provided commands, folder structure, and starter templates
6. Ask questions — get hints, not solutions
7. Submit your work — QA engine reviews pass/fail/partial with specific corrections
8. Repeat until all milestones are complete

---

## API Endpoints

| Method | Path                          | Description                    |
|--------|-------------------------------|--------------------------------|
| POST   | /api/v1/users                 | Register user                  |
| POST   | /api/v1/goals/submit          | Submit raw goal                |
| POST   | /api/v1/goals/clarify         | Answer clarification questions |
| GET    | /api/v1/projects/:id          | Get project state              |
| GET    | /api/v1/projects/:id/resume   | Resume from last checkpoint    |
| GET    | /api/v1/projects/:id/milestones | All milestones               |
| GET    | /api/v1/milestones/:id/tasks  | Tasks in milestone             |
| POST   | /api/v1/tasks/:id/start       | Start task                     |
| POST   | /api/v1/tasks/:id/ask         | Ask for guidance               |
| POST   | /api/v1/tasks/:id/hint        | Get progressive hint           |
| POST   | /api/v1/tasks/submit          | Submit work for QA review      |
| GET    | /api/v1/projects/:id/conversation | Full chat history          |
| GET    | /api/v1/projects/:id/automations  | Automation suggestions     |

---

## Project Structure

```
amit-bodhit/
├── README.md
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js              ← Express entry (port 3001)
│       ├── config.js
│       ├── db/
│       │   ├── database.js        ← SQLite schema + init
│       │   └── claude.js          ← Anthropic client wrapper
│       ├── engines/
│       │   ├── goalClarifier.js
│       │   ├── milestoneGenerator.js
│       │   ├── taskPlanner.js
│       │   ├── guidedExecution.js
│       │   ├── qaCritic.js
│       │   └── automationAdvisor.js
│       ├── services/
│       │   └── progressTracker.js ← All DB state mutations
│       └── routes/
│           └── api.js             ← All 14 REST endpoints
└── frontend/
    ├── index.html
    ├── vite.config.js             ← Proxies /api → localhost:3001
    └── src/
        ├── main.jsx
        ├── App.jsx                ← Routing
        ├── index.css              ← Design system
        ├── api/client.js          ← All API calls
        ├── store/index.js         ← Zustand global state
        ├── components/UI.jsx      ← Shared UI components
        └── pages/
            ├── GoalPage.jsx
            ├── ClarifyPage.jsx
            ├── DashboardPage.jsx
            └── CompletePage.jsx
```
