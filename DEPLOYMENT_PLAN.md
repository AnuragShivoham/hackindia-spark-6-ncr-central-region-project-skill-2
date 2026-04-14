# AMIT-BODHIT: Production Deployment Plan (REVISED)

This document outlines the clean, deterministic deployment plan for the AMIT-BODHIT platform. 

## 1. Target Infrastructure Selection

**Architecture:**
* **Frontend:** Vercel (Fast iteration, great developer experience, automated preview environments)
* **Backend:** Render (Persistent, long-running process for WebSockets and SQLite, native Docker support)

## 2. CI/CD Pipeline (GitHub Actions)

We implement a rigorous, deterministic CI/CD pipeline preventing untested code from reaching production.

### Failure Guarantees
| Condition | Result |
| :--- | :--- |
| Build fails | ❌ No deploy |
| Tests fail | ❌ No deploy |
| Deploy fails | Old version stays |

This is enforced by `.github/workflows/production.yml`.

### Deterministic Builds
All dependency installations now use `npm ci` instead of `npm install` to enforce strict version pinning via `package-lock.json`. This solves the "works locally, fails in CI" drift.

## 3. Automation Strategy
1. **GitHub Push:** The developer pushes code to `main`.
2. **Build & Test Automation:** The GitHub action checks out code, sets up Node, installs dependencies using `npm ci`, and verifies code builds and test scripts run successfully.
3. **Deployment Trigger:** Only if tests pass, the backend triggers Render via a deploy hook (`RENDER_DEPLOY_HOOK`). 
4. **Vercel Deploy:** Vercel tracks the GitHub repository directly and handles the frontend bundle deployment immutably.

## 4. Next Steps
1. Set up a project on Vercel and connect your GitHub repository for the frontend.
2. Set up a Web Service on Render and link it to the backend directory via Dockerfile.
3. Configure the `RENDER_DEPLOY_HOOK` secret in your GitHub repository settings.
