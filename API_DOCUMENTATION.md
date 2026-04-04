# API Documentation - PROJECT-SKILL (AMIT-BODHIT)

## Base URL

```
Development: http://localhost:3001/api/v1
Production: https://api.amitbodhit.app/api/v1
```

## Authentication

All authenticated endpoints require a JWT bearer token:

```
Authorization: Bearer <jwt_token>
```

---

## Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "securepassword123",
  "skillLevel": "beginner"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "skillLevel": "beginner",
  "createdAt": "2026-03-18T10:00:00Z"
}
```

### POST /auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "7d"
}
```

### POST /auth/google
Login/register with Google OAuth.

**Request:**
```json
{
  "idToken": "google_id_token"
}
```

**Response (200):**
```json
{
  "user": { ... },
  "token": "jwt_token",
  "isNewUser": false
}
```

### POST /auth/logout
Invalidate current session.

**Request:** (Requires auth)

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

### POST /auth/refresh
Refresh JWT token.

**Request:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response (200):**
```json
{
  "token": "new_jwt_token",
  "expiresIn": "7d"
}
```

---

## User Endpoints

### GET /users/:id
Get user profile.

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "skillLevel": "beginner",
  "avatar": "https://...",
  "createdAt": "2026-03-18T10:00:00Z",
  "projectCount": 5,
  "totalTasksCompleted": 42
}
```

### PUT /users/:id
Update user profile.

**Request:**
```json
{
  "name": "Jane Doe",
  "skillLevel": "intermediate",
  "avatar": "https://..."
}
```

**Response (200):**
```json
{
  "message": "Profile updated",
  "user": { ... }
}
```

---

## Project Endpoints

### POST /projects
Create new project (goal submission).

**Request:**
```json
{
  "title": "Build a Chat App",
  "rawGoal": "I want to build a real-time chat application using React and Node.js...",
  "techStack": ["React", "Node.js", "MongoDB"],
  "deadline": 30,
  "skillLevel": "intermediate"
}
```

**Response (201):**
```json
{
  "action": "plan_ready",
  "project": {
    "id": "proj_uuid",
    "title": "Build a Chat App",
    "status": "executing",
    "progress": 0,
    "createdAt": "2026-03-18T10:00:00Z"
  },
  "milestones": [ ... ],
  "currentTask": { ... }
}
```

### GET /projects
List all user projects.

**Query Parameters:**
- `status` (optional): "clarifying|executing|completed"
- `limit` (optional): 10
- `offset` (optional): 0

**Response (200):**
```json
{
  "projects": [
    {
      "id": "proj_uuid",
      "title": "Build a Chat App",
      "status": "executing",
      "progress": 25,
      "lastActivity": "2026-03-18T15:30:00Z"
    }
  ],
  "total": 5,
  "offset": 0,
  "limit": 10
}
```

### GET /projects/:id
Get project details.

**Response (200):**
```json
{
  "id": "proj_uuid",
  "title": "Build a Chat App",
  "description": "...",
  "techStack": ["React", "Node.js", "MongoDB"],
  "status": "executing",
  "progress": 25,
  "currentMilestoneId": "ms_uuid",
  "currentTaskId": "task_uuid",
  "milestones": [ ... ],
  "createdAt": "2026-03-18T10:00:00Z"
}
```

### PUT /projects/:id
Update project.

**Request:**
```json
{
  "title": "New Title",
  "deadline": 45
}
```

**Response (200):**
```json
{
  "message": "Project updated",
  "project": { ... }
}
```

### DELETE /projects/:id
Delete project (soft delete).

**Response (200):**
```json
{
  "message": "Project archived"
}
```

---

## Goal Clarification Endpoints

### POST /goals/submit
Submit initial project goal.

**Request:**
```json
{
  "rawGoal": "I want to build a chat app..."
}
```

**Response (201):**
```json
{
  "action": "needs_clarification|plan_ready|rejected",
  "message": "Answer these questions:",
  "project": { ... },
  "clarificationQuestions": [
    "What specific features do you want?",
    "What is your timeline?"
  ]
}
```

### POST /goals/clarify
Answer clarification questions.

**Request:**
```json
{
  "projectId": "proj_uuid",
  "answers": [
    "Messages, user profiles, real-time notifications",
    "2-3 months"
  ]
}
```

**Response (200):**
```json
{
  "action": "plan_ready",
  "project": { ... },
  "milestones": [ ... ]
}
```

---

## Milestone Endpoints

### GET /milestones/:id
Get milestone details.

**Response (200):**
```json
{
  "id": "ms_uuid",
  "ord": 1,
  "title": "Project Setup",
  "description": "...",
  "status": "in_progress",
  "durationDays": 7,
  "measurableOutput": "Running development server",
  "tasks": [ ... ],
  "progress": 50,
  "createdAt": "2026-03-18T10:00:00Z"
}
```

### GET /projects/:id/milestones
Get all milestones for project.

**Response (200):**
```json
{
  "milestones": [
    {
      "id": "ms_uuid",
      "title": "Project Setup",
      "status": "completed",
      "order": 1
    },
    {
      "id": "ms_uuid_2",
      "title": "Authentication",
      "status": "in_progress",
      "order": 2
    }
  ]
}
```

---

## Task Endpoints

### GET /tasks/:id
Get task details.

**Response (200):**
```json
{
  "id": "task_uuid",
  "title": "Setup React Project",
  "description": "Initialize a new React project using Vite...",
  "milestoneId": "ms_uuid",
  "day": 1,
  "estimatedHours": 2,
  "status": "in_progress",
  "commands": [
    "npm create vite@latest",
    "npm install"
  ],
  "starterTemplate": "...",
  "concepts": ["React hooks", "State management"],
  "createdAt": "2026-03-18T10:00:00Z"
}
```

### POST /tasks/:id/start
Mark task as started.

**Request:** (No body)

**Response (200):**
```json
{
  "message": "Task started",
  "task": { ... }
}
```

### POST /tasks/:id/hint
Get progressive hint for current task.

**Request:**
```json
{
  "level": 1
}
```

**Response (200):**
```json
{
  "hint": "Look at the command npm create vite@latest in your terminal...",
  "level": 1,
  "canAskAgain": true
}
```

### POST /tasks/:id/ask
Ask guidance question.

**Request:**
```json
{
  "question": "How do I install dependencies?"
}
```

**Response (200):**
```json
{
  "answer": "Use npm install to install all dependencies listed in package.json...",
  "suggestions": [
    "Run: npm install",
    "Check: package.json for dependencies"
  ]
}
```

### POST /tasks/:id/submit
Submit task work for QA review.

**Request:**
```json
{
  "submissionText": "I've set up the React project and it's running on localhost:5173",
  "artifacts": [
    "/path/to/file"
  ]
}
```

**Response (201):**
```json
{
  "action": "review_submitted",
  "message": "Your work is being reviewed...",
  "quid": "qa_uuid"
}
```

### GET /tasks/:id/qa-history
Get QA review history for task.

**Response (200):**
```json
{
  "attempts": [
    {
      "attemptNumber": 1,
      "verdict": "fail",
      "score": 0.4,
      "feedback": "Missing required files...",
      "createdAt": "2026-03-18T14:00:00Z"
    },
    {
      "attemptNumber": 2,
      "verdict": "pass",
      "score": 0.95,
      "feedback": "Excellent work!",
      "createdAt": "2026-03-18T15:30:00Z"
    }
  ]
}
```

---

## Chat Endpoints

### POST /chat/message
Send message to AI Mentor.

**Request:**
```json
{
  "projectId": "proj_uuid",
  "taskId": "task_uuid",
  "content": "How do I set up authentication?"
}
```

**Response (200):**
```json
{
  "response": "To set up authentication...",
  "structuredData": {
    "goal": "Implement JWT authentication",
    "steps": ["Create auth middleware", "Add login endpoint"],
    "commands": ["npm install jsonwebtoken"],
    "explanation": "JWT tokens are..."
  }
}
```

### GET /projects/:id/conversation
Get conversation history for project.

**Query Parameters:**
- `taskId` (optional): Filter by task
- `limit` (optional): 50
- `offset` (optional): 0

**Response (200):**
```json
{
  "messages": [
    {
      "id": "msg_uuid",
      "role": "user",
      "content": "How do I start?",
      "timestamp": "2026-03-18T10:00:00Z"
    },
    {
      "id": "msg_uuid",
      "role": "mentor",
      "content": "Let's start with...",
      "timestamp": "2026-03-18T10:05:00Z"
    }
  ],
  "total": 25
}
```

### DELETE /chat/history/:id
Clear conversation history.

**Response (200):**
```json
{
  "message": "History cleared"
}
```

---

## File System Endpoints

### GET /fs/files/:projectId
List files in project directory.

**Query Parameters:**
- `dir` (optional): Subdirectory path

**Response (200):**
```json
{
  "projectId": "proj_uuid",
  "directory": "/",
  "files": [
    {
      "name": "src",
      "type": "directory",
      "path": "src"
    },
    {
      "name": "package.json",
      "type": "file",
      "path": "package.json",
      "size": 512
    }
  ],
  "stats": {
    "files": 15,
    "directories": 5,
    "totalSize": 2097152
  }
}
```

### GET /fs/file/:projectId/*
Read file content.

**Response (200):**
```json
{
  "path": "src/App.jsx",
  "content": "import React from 'react'...",
  "size": 1024,
  "type": "javascript"
}
```

### POST /fs/file/:projectId/*
Create or update file.

**Request:**
```json
{
  "content": "console.log('Hello');"
}
```

**Response (201):**
```json
{
  "path": "src/index.js",
  "size": 28,
  "created": true
}
```

### DELETE /fs/file/:projectId/*
Delete file.

**Response (200):**
```json
{
  "path": "src/index.js",
  "deleted": true
}
```

### POST /fs/init/:projectId
Initialize project workspace with template.

**Request:**
```json
{
  "template": "nodejs|react|python|vue"
}
```

**Response (201):**
```json
{
  "projectId": "proj_uuid",
  "template": "nodejs",
  "initialized": true
}
```

---

## Terminal Endpoints

### WebSocket /terminal
Real-time terminal connection.

**Query Parameters:**
- `projectId`: Project ID
- `token`: JWT token

**Message Types:**

**Input:**
```json
{
  "type": "input",
  "data": "npm install\n"
}
```

**Resize:**
```json
{
  "type": "resize",
  "cols": 120,
  "rows": 30
}
```

**Output (received):**
```json
{
  "type": "output",
  "data": "npm notice..."
}
```

**Error (received):**
```json
{
  "type": "error",
  "message": "Command not allowed"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": {
    "email": "Invalid email format"
  }
}
```

### 401 Unauthorized
```json
{
  "error": "Authorization required",
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied",
  "message": "You don't have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found",
  "message": "Project with ID xyz not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

All endpoints are rate-limited per user:
- **Default**: 100 requests per 15 minutes
- **Chat**: 30 requests per hour
- **File Operations**: 200 requests per hour
- **Terminal**: 500 commands per hour

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1710779400
```

---

## Pagination

List endpoints support pagination:

```
GET /projects?limit=10&offset=20
```

**Response:**
```json
{
  "data": [ ... ],
  "pagination": {
    "limit": 10,
    "offset": 20,
    "total": 150,
    "hasMore": true
  }
}
```

---

## Webhook Events

Subscribe to webhook events:

```
POST /api/v1/webhooks/subscribe
{
  "events": ["task.completed", "project.milestone_unlocked"],
  "url": "https://yourapp.com/webhook"
}
```

**Events:**
- `task.started`
- `task.submitted`
- `task.completed`
- `task.failed`
- `milestone.unlocked`
- `milestone.completed`
- `project.created`
- `project.completed`

---

## SDK / Client Examples

### JavaScript/Node.js
```javascript
const client = new APIClient({
  baseURL: 'http://localhost:3001/api/v1',
  token: 'jwt_token'
});

// Create project
const project = await client.projects.create({
  title: 'My Project',
  rawGoal: 'Build a chat app'
});

// Send chat message
const response = await client.chat.send(project.id, {
  content: 'How do I start?'
});
```

### Python
```python
from amit_bodhit import Client

client = Client(
    base_url='http://localhost:3001/api/v1',
    token='jwt_token'
)

# Create project
project = client.projects.create(
    title='My Project',
    raw_goal='Build a chat app'
)

# Send message
response = client.chat.send(project_id=project.id, content='How do I start?')
```

---

**API Version**: 1.0.0  
**Last Updated**: March 2026
