🚀 PROJECT-SKILL (AMIT-BODHIT)

🧠 AI-Powered Project Building Mentor System (Not Just Another ChatGPT but: A Real Builder)

=> Ideas are cheap. Execution is everything.
=> This platform forces execution — step by step — until your project is DONE.


🧩 Problem Statement

Most students & developers:

1 Have ideas but no structured roadmap
2 Get stuck in tutorial hell
3 Use AI tools that give answers, not learning
4 Start projects… but never finish them

👉 Result: 0% real projects, 0% confidence

HERE WE GO:

💡 Our Solution

PROJECT-SKILL (AMIT-BODHIT) is an **AI Mentor that doesn’t let you quit.

It transforms:

💭Idea=>🎯Goal=>🧱Milestones=>📅Daily-Tasks=>🧑‍💻Execution=>✅Completion

Unlike ChatGPT:

1 ❌ No full solutions
2 ✅ Only guided execution + hints
3 ✅ Forces real building, not copying


⚡ Key Innovation

🔥 1. Execution-First AI (NOT Chatbot)

 AI behaves like:

  i 🧑‍💼 Project Manager
  ii 🏗️ Architect
  iii 🧑‍🏫 Mentor
  iv 🔍 QA Reviewer

  ==> Each role is enforced via " multi agent prompt system "   <==


🧠 2. Strict Learning Mode (Main Game)

1 ❌ No direct answers
2 ✅ Progressive hints
3 ✅ Step-by-step thinking guidance
4 ✅ Forces user to actually learn


🧪 3. Built-in QA Engine

 User submits work → AI reviews:

   ✔ Pass
   ❌ Fail
   ⚠ Partial
 Gives specific corrections


 💻 4. Full Browser IDE + Terminal

  Monaco Editor (VS Code inside browser)
  Real terminal (xterm.js + PTY)
  File system sandbox
  Execute commands live


🔐 5. Secure AI System (Advanced)

1 Prompt injection protection
2 Command denylist (`rm -rf`, `exec`, etc.)
3 File sandboxing
4 JWT + OAuth auth


🏗️ Architecture Overview


Frontend (React + Vite)
   ↓
API Layer (Express + JWT)
   ↓
AI Engines (Multi-Agent System)
   ↓
Services Layer (Terminal, FS, Progress)
   ↓
Database (SQLite / PostgreSQL-ready)


🧠 AI Engine System

| Engine              | Role                   |

| Goal Clarifier      | Cleans vague ideas     |
| Milestone Generator | Creates roadmap        |
| Task Planner        | Daily actionable tasks |
| Guided Execution    | Hints & mentoring      |
| QA Critic           | Reviews submissions    |
| Automation Advisor  | Suggests optimizations |



🛠️ Tech Stack

🔹 Frontend

i React 18 + Vite
ii Monaco Editor
iii xterm.js
iv Zustand

🔹 Backend

i Node.js + Express
ii WebSocket (real-time terminal)
iii JWT + Google OAuth

🔹 AI

i Groq / Claude / Gemini
ii Custom Prompt Engine

🔹 Database

=> SQLite (default)
=> PostgreSQL-ready (Prisma)

✨ Features

✅ AI Mentor Chat
✅ Goal → Milestone → Task pipeline
✅ Real-time IDE + Terminal
✅ Automated QA system
✅ Progress tracking
✅ Workspace sandbox
✅ Multi-LLM support
✅ Secure execution environment

🎯 User Flow

1. User enters project idea
2. AI asks clarification questions
3. Generates milestones
4. Breaks into daily tasks
5. User builds inside IDE
6. AI gives hints (not answers)
7. User submits work
8. AI reviews & gives feedback
9. Repeat → until completion


 Demo Flow (case study):

👉 Build a Chat App

=> Input vague idea
=> AI asks:

   Which tech stack you want to use?

 Generates:

  => Milestone 1: Backend setup
  => Task 1: Create Express server
1 User codes in IDE
2 Submits
3 AI says:

  ❌ Missing input validation

=> User fixes → passes

🔥 This is learning + building combined

🧪 Security Highlights

1 Prompt Injection Protection
2 Command Filtering Engine
3 File Path Validation
4 Sandboxed Execution
5 JWT Authentication

📊 Impact

🚀 Helps students:

1 Finish real projects
2 Build portfolio
3 Learn by doing

💡 Helps ecosystem:

1 Reduces fake learning
2 Encourages execution mindset


⚙️How to Setup on your system

 ==> bash
 Install
cd backend && npm install
cd ../frontend && npm install

==> Run backend
cd backend
npm run dev

==> Run frontend
cd frontend
npm run dev

Open → http://localhost:5173

🔮 Future Scope

=> 📱 Mobile app
=>🤝 Team collaboration
=>🧑‍🏫 Mentor marketplace
=>📊 Analytics dashboard
=>🧾 Certification system


👨‍💻 Team Vision

=> “We don’t want users to just " learn about coding " for months then build for months.
=> We want them to " ship real projects. in best TIME possible with Learning." EQUALLY   


❤️ Final Note

This is not another AI tool.
This is a discipline system Presented as a product.

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

Project Structure

amit-bodhit/
│
├── backend/                         => Node.js + Express API
│   ├── src/
│   │   ├── server.js                => Entry point (Express + WebSocket)
│   │   ├── config.js                => App configuration
│   │   │
│   │   ├── routes/                 => API routes
│   │   │   ├── api.js               => Core application APIs
│   │   │   ├── auth.js              => Authentication routes
│   │   │   └── fs.js                => File system APIs
│   │   │
│   │   ├── middleware/
│   │   │   └── auth.js              => JWT authentication middleware
│   │   │
│   │   ├── db/                     => Database layer
│   │   │   ├── database.js          => SQLite schema & connection
│   │   │   └── pg.js                => PostgreSQL support (optional)
│   │   │
│   │   ├── engines/                => AI Brain (Core Logic)
│   │   │   ├── goalClarifier.js
│   │   │   ├── milestoneGenerator.js
│   │   │   ├── taskPlanner.js
│   │   │   ├── guidedExecution.js
│   │   │   ├── qaCritic.js
│   │   │   ├── mentorEngine.js
│   │   │   └── automationAdvisor.js
│   │   │
│   │   ├── services/               => System services
│   │   │   ├── aiService.js         => LLM provider switch (Groq/Ollama)
│   │   │   ├── terminalService.js   => WebSocket terminal (PTY)
│   │   │   ├── workspaceService.js  => File system sandbox
│   │   │   ├── progressTracker.js   => Progress logic
│   │   │   ├── socketService.js     => Real-time sessions
│   │   │   └── memoryService.js     => Context management
│   │
│   ├── scripts/                    => Utility scripts
│   ├── .env.example                => Environment variables template
│   └── package.json
│
├── frontend/                       => React + Vite App
│   ├── src/
│   │   ├── App.jsx                 => Main router
│   │   ├── main.jsx                => Entry point
│   │   │
│   │   ├── pages/                 => Application screens
│   │   │   ├── LoginPage.jsx
│   │   │   ├── GoalPage.jsx
│   │   │   ├── ClarifyPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── IdePage.jsx         => Browser IDE
│   │   │   ├── ProjectsPage.jsx
│   │   │   ├── MentorPage.jsx
│   │   │   └── CompletePage.jsx
│   │   │
│   │   ├── components/            => Reusable UI components
│   │   │   ├── Terminal.jsx        => Terminal emulator
│   │   │   ├── UI.jsx              => Shared UI elements
│   │   │   └── mentor/             => Mentor dashboard components
│   │   │
│   │   ├── api/
│   │   │   └── client.js           => API communication layer
│   │   │
│   │   ├── store/
│   │   │   └── index.js            => Zustand state management
│   │   │
│   │   └── hooks/                 => Custom React hooks
│   │
│   ├── index.html
│   └── vite.config.js
│
├── docs/ (implicit via root files)
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── API_DOCUMENTATION.md
│   ├── SETUP_GUIDE.md
│   ├── FEATURE_IMPLEMENTATION.md
│   └── PROJECT_SUMMARY.md
│
├── package.json                    => Root scripts (monorepo)
└── README.md                       => Main project documentation
