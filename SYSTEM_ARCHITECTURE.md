# PROJECT-SKILL (AMIT-BODHIT) - System Architecture

## Overview

Project-Skill is an **AI-powered project execution mentor** that transforms vague user goals into structured, executable project plans. The system guides users through the complete project lifecycle: clarification → planning → execution → feedback → completion.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                          │
├─────────────────────────────────────────────────────────────────────┤
│ • Next.js/React Frontend                                            │
│ • Monaco Editor (Browser IDE)                                       │
│ • Terminal Emulator (xterm.js)                                      │
│ • Chat Interface (AI Mentor)                                        │
│ • Progress Dashboard                                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                   (REST API + WebSocket)
                             │
┌─────────────────────────────▼────────────────────────────────────────┐
│                       API GATEWAY LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│ • Express.js Server                                                 │
│ • JWT Authentication Middleware                                     │
│ • CORS & Security Headers                                           │
│ • Error Handling & Logging                                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼─────────┐  ┌──────▼──────┐  ┌──────────▼──────┐
│  AI ENGINES     │  │   FILE OPS  │  │   SERVICES      │
├─────────────────┤  ├─────────────┤  ├─────────────────┤
│ • Goal          │  │ • File      │  │ • Progress      │
│   Clarifier     │  │   Explorer  │  │   Tracker       │
│ • Milestone     │  │ • Editor    │  │ • Terminal      │
│   Generator     │  │ • Workspace │  │   Service       │
│ • Task Planner  │  │   Manager   │  │ • Chat History  │
│ • Guided Exec   │  │             │  │   Service       │
│ • QA Critic     │  │             │  │                 │
│ • Automation    │  │             │  │                 │
│   Advisor       │  │             │  │                 │
└───────┬─────────┘  └──────┬──────┘  └────────┬────────┘
        │                   │                   │
        │ (LLM API calls)   │                   │
        │ (File I/O)        │                   │
        └───────────────────┼───────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────────────┐
│                    DATA PERSISTENCE LAYER                          │
├────────────────────────────────────────────────────────────────────┤
│ • SQLite Database (node:sqlite)                                    │
│ • User Management                                                  │
│ • Project Metadata                                                 │
│ • Milestone & Task Definitions                                    │
│ • Conversation History                                            │
│ • Progress Tracking                                               │
│ • Workspace Files                                                 │
│ • Command Execution Logs                                          │
└────────────────────────────────────────────────────────────────────┘
        │
        └──────────────────────┬──────────────────────┐
                               │                      │
                    ┌──────────▼──────────┐   ┌──────▼───────┐
                    │  LLM Providers      │   │  File System │
                    ├─────────────────────┤   ├──────────────┤
                    │ • Groq API          │   │ • Workspace  │
                    │ • Anthropic Claude  │   │   Projects   │
                    │ • Google Gemini     │   │ • Logs       │
                    │ • OpenAI            │   │ • Artifacts  │
                    └─────────────────────┘   └──────────────┘
```

---

## Component Architecture

### 1. Frontend Layer (React 18 + Vite)

**Responsibilities:**
- Render UI pages and components
- Manage application state (Zustand)
- Handle WebSocket connections for terminal
- Edit files with Monaco Editor
- Consume REST API

**Key Components:**
```
frontend/
├── src/
│   ├── pages/
│   │   ├── LoginPage.jsx          → Auth & registration
│   │   ├── GoalPage.jsx           → Initial goal submission
│   │   ├── ClarifyPage.jsx        → Clarification questions
│   │   ├── DashboardPage.jsx      → Project list & overview
│   │   ├── IdePage.jsx            → Workspace IDE
│   │   └── CompletePage.jsx       → Project completion
│   ├── components/
│   │   ├── Editor.jsx             → Monaco editor wrapper
│   │   ├── Terminal.jsx           → xterm.js terminal
│   │   ├── ChatBot.jsx            → AI mentor chat
│   │   ├── FileExplorer.jsx       → File tree navigation
│   │   ├── ProgressWidget.jsx     → Progress indicator
│   │   └── UI.jsx                 → Reusable UI components
│   ├── store/
│   │   └── index.js               → Zustand state management
│   ├── api/
│   │   └── client.js              → API client wrapper
│   └── App.jsx                    → Main app router
```

### 2. API Gateway Layer (Express.js)

**Responsibilities:**
- Route HTTP requests
- Validate JWT tokens
- Execute business logic
- Connect to database
- Orchestrate AI services

**Middleware Stack:**
```
Request → CORS → Body Parser → JWT Auth → Rate Limit → Route Handler → Response
```

### 3. AI Engines (Business Logic)

Each engine is responsible for a specific aspect of project guidance:

#### `goalClarifier.js`
- Analyzes raw user goal
- Identifies ambiguities
- Generates clarifying questions
- Validates goal completeness

#### `milestoneGenerator.js`
- Converts goals to milestone structure
- Creates milestone descriptions
- Defines measurable outputs
- Estimates timeline

#### `taskPlanner.js`
- Breaks milestones into daily tasks
- Creates task descriptions
- Suggests commands & folder structure
- Provides starter templates

#### `guidedExecution.js`
- Provides real-time guidance during task execution
- Offers hints (progressive hints)
- Explains concepts
- Validates approach

#### `qaCritic.js`
- Reviews submitted work
- Checks against requirements
- Provides feedback
- Suggests corrections

#### `automationAdvisor.js`
- Suggests workflow automation
- Recommends tools
- Creates automation scripts

### 4. Services Layer

#### `progressTracker.js`
- Tracks project progress
- Updates task/milestone status
- Calculates completion percentages
- Logs conversation turns

#### `terminalService.js`
- Manages WebSocket connection
- Executes commands in sandbox
- Restricts to project directory
- Logs command execution

#### `workspaceService.js` (new)
- Manages file operations
- Creates/reads/updates/deletes files
- Maintains folder structure
- Validates file paths

### 5. Database Layer (SQLite via node:sqlite)

**Advantages:**
- Zero external dependencies (built into Node.js 22+)
- Perfect for single-server deployments
- ACID compliance
- File-based portability

---

## Data Flow Workflows

### Workflow 1: Goal Submission → Project Planning

```
User submits raw goal
        ↓
goalClarifier analyzes goal
        ↓
Is goal valid? 
  ├─ Yes: Proceed
  └─ No: Request clarification (max 3 rounds)
        ↓
milestoneGenerator creates milestones (LLM)
        ↓
Create milestone records in DB
        ↓
For first milestone:
  ├─ Unlock milestone
  ├─ taskPlanner generates tasks (LLM)
  ├─ Create task records
  └─ Set current pointers
        ↓
Return project + milestones + first task
```

### Workflow 2: Task Execution → Submission → QA

```
User starts task
        ↓
guidedExecution provides guidance on demand
  ├─ Request hint → Progressive hints
  ├─ Ask question → Contextual response
  └─ Get concept explanation → Teaching material
        ↓
User executes commands in terminal
        ↓
User submits work for review
        ↓
qaCritic reviews submission (LLM)
  ├─ Checks against requirements
  ├─ Validates code/output
  └─ Scores submission
        ↓
Score >= 70%?
  ├─ Yes: Mark task complete, unlock next task
  └─ No: Provide feedback, allow resubmission
        ↓
All tasks in milestone complete?
  ├─ Yes: Unlock next milestone
  └─ No: Continue with current milestone
        ↓
All milestones complete?
  ├─ Yes: Project marked complete
  └─ No: Continue with next milestone
```

### Workflow 3: Terminal Command Execution

```
User types command in terminal
        ↓
WebSocket message sent to backend
        ↓
terminalService validates:
  ├─ Command is in allowed list
  ├─ Working directory is within project
  └─ No system-level operations
        ↓
Command approved?
  ├─ Yes: Execute in child process
  └─ No: Return error message
        ↓
Capture stdout/stderr
        ↓
Log command to CommandLogs table
        ↓
Return output to client via WebSocket
```

---

## API Endpoints Structure

### Authentication Routes (`/api/v1/auth`)
- `POST /register` → Create user account
- `POST /login` → JWT token generation
- `POST /logout` → Token invalidation
- `POST /refresh` → Token refresh

### Project Routes (`/api/v1/projects`)
- `POST /` → Create new project (goal submission)
- `GET /:id` → Get project details
- `GET /` → List all user projects
- `PUT /:id` → Update project metadata

### Goal Clarification Routes (`/api/v1/goals`)
- `POST /submit` → Submit initial goal
- `POST /clarify` → Answer clarification questions
- `GET /:id/status` → Check clarification status

### Milestone Routes (`/api/v1/milestones`)
- `GET /:id` → Get milestone details
- `GET /:id/tasks` → Get all tasks in milestone
- `PUT /:id/status` → Update milestone status

### Task Routes (`/api/v1/tasks`)
- `GET /:id` → Get task details
- `POST /:id/start` → Mark task as started
- `POST /:id/hint` → Request hint
- `POST /:id/ask` → Ask guidance question
- `POST /:id/submit` → Submit work for review
- `GET /:id/qa-history` → Get QA review history

### Chat Routes (`/api/v1/chat`)
- `POST /message` → Send message to AI mentor
- `GET /history/:projectId` → Get conversation history
- `DELETE /history/:projectId` → Clear history

### Workspace Routes (`/api/v1/fs`)
- `GET /files/:projectId` → List project files
- `GET /file/:projectId/:path` → Read file
- `POST /file/:projectId/:path` → Create/update file
- `DELETE /file/:projectId/:path` → Delete file
- `POST /folder/:projectId/:path` → Create folder

### Terminal Routes (`WebSocket /api/v1/terminal`)
- `execute` → Execute command
- `stdout/stderr` → Stream output
- `terminate` → Kill process

---

## Database Schema

### Core Tables

```sql
users
├─ id (PK)
├─ email (UNIQUE)
├─ name
├─ skill_level
├─ role
├─ google_id
├─ avatar
└─ created_at

projects
├─ id (PK)
├─ user_id (FK → users)
├─ raw_goal
├─ title
├─ tech_stack (JSON)
├─ scope
├─ deadline_days
├─ skill_level
├─ deliverables (JSON)
├─ status (clarifying|planning|executing|reviewing|completed)
├─ progress_pct
├─ total_tasks
├─ completed_tasks
├─ current_milestone_id
├─ current_task_id
└─ created_at

milestones
├─ id (PK)
├─ project_id (FK → projects)
├─ ord
├─ title
├─ description
├─ duration_days
├─ measurable_output
├─ status (locked|unlocked|in_progress|completed)
├─ started_at
└─ completed_at

tasks
├─ id (PK)
├─ milestone_id (FK → milestones)
├─ ord
├─ day
├─ title
├─ description
├─ estimated_hours
├─ commands (JSON)
├─ folder_structure (JSON)
├─ starter_template
├─ concepts_taught (JSON)
├─ status (pending|started|submitted|passed|failed)
├─ submission_text
├─ attempts
├─ started_at
├─ submitted_at
└─ completed_at

qa_reviews
├─ id (PK)
├─ task_id (FK → tasks)
├─ attempt_number
├─ verdict (pass|fail|partial)
├─ score (0-1)
├─ passed_checks (JSON)
├─ failed_checks (JSON)
├─ corrections (JSON)
├─ feedback_text
└─ created_at

conversation_turns
├─ id (PK)
├─ project_id (FK → projects)
├─ task_id (FK → tasks)
├─ role (user|mentor)
├─ content
├─ context_type (clarification|guidance|feedback)
└─ created_at

workspace_files
├─ id (PK)
├─ project_id (FK → projects)
├─ file_path
├─ content
├─ file_type
├─ created_at
└─ updated_at

command_logs
├─ id (PK)
├─ project_id (FK → projects)
├─ task_id (FK → tasks)
├─ command
├─ exit_code
├─ stdout
├─ stderr
├─ executed_at
└─ duration_ms
```

---

## Key Design Principles

### 1. **User Empowerment Over Automation**
- System guides but doesn't build for the user
- Progressive hints instead of complete solutions
- Requires understanding, not just copying

### 2. **Structured Guidance**
- Clear milestone breakdown
- Daily task focus
- Defined success criteria

### 3. **Security & Sandboxing**
- Terminal restricted to project directory
- JWT-based authentication
- Command whitelist validation
- User isolation

### 4. **Scalability Considerations**
- SQLite suitable for 10K+ concurrent users
- Stateless API design for horizontal scaling
- WebSocket for real-time updates
- File system operations cached

### 5. **Developer Experience**
- Clear error messages
- Detailed logging
- Progress visibility
- Multiple guidance channels (hints, QA, chat)

---

## Error Handling Strategy

```
User Action
    ↓
Validation (400 Bad Request)
    ↓
Authentication (401 Unauthorized)
    ↓
Authorization (403 Forbidden)
    ↓
Business Logic (422 Unprocessable Entity)
    ↓
System Error (500 Internal Server Error)
    ↓
Response with error details & context
```

---

## Deployment Architecture

```
Production Environment
├─ Load Balancer
│  ├─ Frontend (CDN) → React SPA
│  ├─ API Cluster
│  │  ├─ Instance 1 (Express + SQLite)
│  │  ├─ Instance 2
│  │  └─ Instance N (Shared SQLite via Network)
│  └─ Reverse Proxy (Nginx)
├─ Database
│  └─ SQLite (Primary) + Backup Strategy
├─ Storage
│  └─ Project Workspaces (S3 or Local)
└─ Monitoring
   ├─ Error Tracking (Sentry)
   ├─ Performance Monitoring
   └─ Logs (CloudWatch/ELK)
```

---

## Technology Justification

| Component | Choice | Reason |
|-----------|--------|--------|
| Frontend | React 18 + Vite | Fast dev experience, modern tooling |
| State | Zustand | Lightweight, minimal boilerplate |
| Editor | Monaco | Industry standard, feature-rich |
| Terminal | xterm.js | Battle-tested, good UX |
| Backend | Express.js | Lightweight, flexible routing |
| Database | SQLite (node:sqlite) | Zero dependencies, ACID, portable |
| Auth | JWT | Stateless, scalable |
| LLM | Groq/Anthropic | Fast inference, quality outputs |
| Real-time | WebSocket | Low latency, bidirectional |

---

## Security Considerations

1. **Authentication**: JWT tokens with expiration
2. **Authorization**: Role-based access control
3. **Input Validation**: All inputs sanitized & validated
4. **Terminal Sandbox**: Commands executed in restricted context
5. **File Operations**: Paths validated to prevent directory traversal
6. **CORS**: Whitelist allowed origins
7. **Rate Limiting**: Prevent abuse & DOS
8. **SQL Injection**: Parameterized queries via sqlite prepare/bind
9. **HTTPS**: All production traffic encrypted
10. **Environment Variables**: Sensitive config not in code

---

## Future Enhancements

1. **Multi-language Support**: Translate UI & guidance
2. **Mobile App**: React Native version
3. **Collaborative Projects**: Real-time pair programming
4. **Code Review System**: Peer code reviews
5. **Marketplace**: Community templates & solutions
6. **Analytics**: User journey & success metrics
7. **Gamification**: Badges, leaderboards, streaks
8. **Integrations**: GitHub, GitLab, IDE plugins
9. **Advanced AI**: Fine-tuned models for specific domains
10. **Offline Mode**: Progressive Web App capabilities

---

## Performance Metrics

- **Page Load**: < 2 seconds
- **API Response**: < 500ms (p95)
- **Editor Operations**: < 100ms
- **Terminal Command Exec**: < 1 second
- **Database Query**: < 50ms
- **LLM Response**: < 5 seconds (with streaming)

---

This architecture provides a solid foundation for scaling from MVP to enterprise-grade platform while maintaining security, performance, and excellent user experience.
