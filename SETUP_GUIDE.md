# PROJECT-SKILL (AMIT-BODHIT) - Complete Setup & Deployment Guide

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Local Development Setup](#local-development-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Migration](#database-migration)
5. [Running the Application](#running-the-application)
6. [Troubleshooting](#troubleshooting)
7. [Production Deployment](#production-deployment)
8. [Monitoring & Maintenance](#monitoring--maintenance)

---

## System Requirements

### Minimum Requirements
- **Node.js**: 18.0.0 or higher (22+ recommended for native SQLite support)
- **npm**: 8.0.0 or higher
- **RAM**: 2GB minimum (4GB recommended)
- **Disk Space**: 1GB minimum for dependencies and workspace

### Recommended Setup
- **OS**: Linux (Ubuntu 22.04+), macOS 12+, or Windows 11
- **RAM**: 8GB+
- **CPU**: 4 cores+
- **Database**: SQLite (built-in) or PostgreSQL for scalability

---

## Local Development Setup

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/project-skill.git
cd project-skill

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### Step 2: Create Environment Files

```bash
# Backend .env
cat > backend/.env << 'EOF'
# Server
PORT=3001
NODE_ENV=development

# Database
DB_PATH=./data/amitbodhit.db
WORKSPACE_PATH=./workspace

# AI Services
GROQ_API_KEY=your_groq_api_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GOOGLE_GEMINI_API_KEY=your_google_key_here

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_secret

# Email (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=AMIT-BODHIT <noreply@amitbodhit.app>

# CORS (Frontend URL)
FRONTEND_URL=http://localhost:5173
EOF

# Frontend .env
cat > frontend/.env.local << 'EOF'
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
GOOGLE_CLIENT_ID=your_google_oauth_client_id
EOF
```

### Step 3: Create Directories

```bash
# Create necessary directories
mkdir -p backend/data
mkdir -p workspace
```

### Step 4: Verify Installation

```bash
# Check Node version
node --version  # Should be 18+

# Check npm version
npm --version   # Should be 8+

# Test backend startup (should show no errors)
cd backend
npm run dev &   # Run in background

# Wait 3 seconds
sleep 3

# Test health check
curl http://localhost:3001/health

# Kill background process
kill %1

cd ..
```

---

## Environment Configuration

### Backend Environment Variables

```env
# === SERVER CONFIGURATION ===
PORT=3001                          # API server port
NODE_ENV=development               # development|production|test
LOG_LEVEL=debug                    # debug|info|warn|error

# === DATABASE ===
DB_PATH=./data/amitbodhit.db      # SQLite database file
WORKSPACE_PATH=./workspace         # User workspace directory
DB_BACKUP_INTERVAL=86400000        # Backup interval (24h in ms)

# === AI SERVICES ===
GROQ_API_KEY=sk-...               # Groq API key (free tier available)
ANTHROPIC_API_KEY=sk-ant-...      # Claude API key
GOOGLE_GEMINI_API_KEY=...         # Google Gemini API key

# === AUTHENTICATION ===
JWT_SECRET=change-this-in-prod    # JWT signing secret (min 32 chars)
JWT_EXPIRY=7d                      # Token expiry (7 days)
REFRESH_TOKEN_EXPIRY=30d           # Refresh token expiry

GOOGLE_CLIENT_ID=...              # Google OAuth 2.0 client ID
GOOGLE_CLIENT_SECRET=...          # Google OAuth 2.0 secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/auth/google/callback

# === EMAIL CONFIGURATION ===
EMAIL_HOST=smtp.gmail.com         # SMTP host
EMAIL_PORT=587                    # SMTP port
EMAIL_USER=noreply@example.com    # SMTP username
EMAIL_PASS=app_password           # SMTP password (use app passwords for Gmail)
EMAIL_FROM=AMIT-BODHIT <noreply@amitbodhit.app>
EMAIL_TLS=true                    # Use TLS

# === CORS & SECURITY ===
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
RATE_LIMIT_WINDOW=15m             # Rate limit window
RATE_LIMIT_MAX_REQUESTS=100       # Max requests per window

# === FEATURE FLAGS ===
ENABLE_GOOGLE_AUTH=true
ENABLE_EMAIL_VERIFICATION=true
ENABLE_PROJECT_TEMPLATES=true
MAX_WORKSPACE_SIZE_MB=500         # Max workspace size per project
MAX_PROJECTS_PER_USER=10          # Max projects per user
```

### Frontend Environment Variables

```env
# Vite environment variables (frontend/.env.local)
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_APP_NAME=AMIT-BODHIT
VITE_APP_VERSION=1.0.0
```

---

## Database Migration

### Initial Setup

The database automatically initializes on first run. No manual migration needed.

```bash
# Database will create at: backend/data/amitbodhit.db
# Tables created:
# - users
# - projects
# - milestones
# - tasks
# - qa_reviews
# - conversation_turns
# - workspace_files
# - command_logs
# - progress_snapshots
# - otp_sessions
```

### Backup Database

```bash
# Manual backup
cp backend/data/amitbodhit.db backend/data/amitbodhit.db.backup

# Restore from backup
cp backend/data/amitbodhit.db.backup backend/data/amitbodhit.db
```

### Reset Database (Development Only)

```bash
# WARNING: This will delete all data!
cd backend
rm -f data/amitbodhit.db
npm run dev  # Database will recreate on startup
```

---

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Output: Running at http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Output: Running at http://localhost:5173
```

**Terminal 3 - Monitor (optional):**
```bash
# Monitor file changes and logs
watch -n 1 'tail -20 backend/debug.log'
```

Then open: **http://localhost:5173**

### Using Root Scripts

```bash
# Install all dependencies
npm run install:all

# Start backend
npm run backend

# Start frontend (in another terminal)
npm run frontend

# Run both concurrently (requires concurrently package)
npm run dev  # if configured in root package.json
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. **Port Already in Use**

```bash
# Find process using port 3001
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# Kill the process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

#### 2. **Database Lock Error**

```bash
# SQLite database is locked (WAL mode issue)
# Solution 1: Restart the application
cd backend && npm run dev

# Solution 2: Clean database
rm backend/data/amitbodhit.db*
npm run dev  # Recreate
```

#### 3. **CORS Errors**

**Error**: `Access to XMLHttpRequest blocked by CORS policy`

**Solution**: Update CORS in `backend/src/server.js`

```javascript
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
```

#### 4. **Terminal Connection Failed**

**Error**: `WebSocket connection failed`

**Cause**: Terminal WebSocket endpoint not reachable

**Solution**:
- Ensure backend is running
- Check firewall settings
- Verify `VITE_WS_URL` in frontend environment

#### 5. **AI API Key Errors**

**Error**: `Invalid API key for Groq/Anthropic`

**Solution**:
```bash
# Verify API key format
# - Groq: should start with "gsk-"
# - Anthropic: should start with "sk-ant-"

# Test API key
curl -H "Authorization: Bearer YOUR_KEY" https://api.groq.com/health
```

#### 6. **File System Errors**

**Error**: `ENOENT: no such file or directory`

**Solution**:
```bash
# Create required directories
mkdir -p backend/data
mkdir -p workspace
```

#### 7. **Memory Issues**

**Error**: `JavaScript heap out of memory`

**Solution**:
```bash
# Increase Node.js memory limit
NODE_OPTIONS=--max-old-space-size=2048 npm run dev

# Or set in .env
NODE_MEMORY_LIMIT=2048
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database backed up
- [ ] SSL certificate obtained
- [ ] Domain DNS configured
- [ ] Rate limiting configured
- [ ] Error monitoring setup (Sentry)
- [ ] Email service configured
- [ ] API keys securely stored

### Deployment Steps

#### 1. **Using PM2 (Recommended)**

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem.config.js
cat > backend/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'amit-bodhit-backend',
    script: './src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    watch: false,
    ignore_watch: ['node_modules', 'data', 'workspace']
  }]
};
EOF

# Start with PM2
cd backend
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs

# Startup on reboot
pm2 startup
pm2 save
```

#### 2. **Using Docker**

```dockerfile
# backend/Dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY data ./data

EXPOSE 3001
ENV NODE_ENV=production

CMD ["node", "src/server.js"]
```

```dockerfile
# frontend/Dockerfile
FROM node:22-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Build and run
docker build -t amit-bodhit-backend ./backend
docker build -t amit-bodhit-frontend ./frontend

docker run -p 3001:3001 -e NODE_ENV=production amit-bodhit-backend
docker run -p 80:80 amit-bodhit-frontend
```

#### 3. **Using Systemd (Linux)**

```bash
# Create service file
sudo tee /etc/systemd/system/amit-bodhit.service << 'EOF'
[Unit]
Description=AMIT-BODHIT AI Mentor
After=network.target

[Service]
Type=simple
User=amit-bodhit
WorkingDirectory=/opt/amit-bodhit/backend
ExecStart=/usr/bin/node /opt/amit-bodhit/backend/src/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable amit-bodhit
sudo systemctl start amit-bodhit
sudo systemctl status amit-bodhit
```

#### 4. **Nginx Reverse Proxy**

```nginx
# /etc/nginx/sites-available/amit-bodhit
upstream backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name amitbodhit.example.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name amitbodhit.example.com;

    ssl_certificate /etc/letsencrypt/live/amitbodhit.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/amitbodhit.example.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    # API
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /api/v1/terminal {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Check backend health
curl http://localhost:3001/health
# Expected: { "status": "ok", "service": "AMIT-BODHIT", "version": "1.0.0" }

# Check database
curl http://localhost:3001/api/v1/health/db
```

### Logging

```bash
# View backend logs
cd backend
tail -f debug.log

# View PM2 logs
pm2 logs

# View Docker logs
docker logs amit-bodhit-backend
```

### Performance Monitoring

```bash
# Install clinic.js
npm install -g clinic

# Profile application
clinic doctor -- node src/server.js

# Generate reports
clinic doctor -- npm test
```

### Database Maintenance

```bash
# Vacuum database (compact)
sqlite3 backend/data/amitbodhit.db "VACUUM;"

# Check integrity
sqlite3 backend/data/amitbodhit.db "PRAGMA integrity_check;"

# View table sizes
sqlite3 backend/data/amitbodhit.db "SELECT name, page_count * page_size / 1024 / 1024 as size_mb FROM pragma_page_count(), pragma_page_size(), sqlite_master WHERE type='table';"
```

### Backup Strategy

```bash
#!/bin/bash
# backup.sh - Daily backup script

BACKUP_DIR="/backups/amit-bodhit"
DB_PATH="backend/data/amitbodhit.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
cp $DB_PATH $BACKUP_DIR/amitbodhit_$DATE.db

# Compress old backups
find $BACKUP_DIR -name "*.db" -mtime +7 -exec gzip {} \;

# Upload to cloud (optional)
# aws s3 cp $BACKUP_DIR s3://my-backups/amit-bodhit/ --recursive

echo "Backup completed: $DATE"
```

---

## Security Best Practices

1. **Environment Variables**: Never commit `.env` files to git
2. **JWT Secret**: Use strong, random secret (min 32 characters)
3. **API Keys**: Rotate keys regularly, use service accounts
4. **HTTPS**: Always use SSL/TLS in production
5. **Rate Limiting**: Implement per-user and per-IP limits
6. **Input Validation**: Sanitize all user inputs
7. **CORS**: Whitelist only trusted origins
8. **Database**: Regular backups and encryption at rest
9. **Access Logs**: Monitor and audit API access
10. **Dependency Updates**: Regular security updates

---

## Performance Optimization

### Frontend
- Lazy load components
- Code splitting
- Minify assets
- Cache API responses
- Use CDN for static files

### Backend
- Connection pooling
- Query optimization
- Caching with Redis
- Pagination for large datasets
- Async/await for non-blocking operations

### Database
- Indexing strategy
- Query analysis
- WAL mode enabled
- Regular VACUUM

---

## Support & Troubleshooting Resources

- **Discord**: https://discord.gg/amit-bodhit
- **GitHub Issues**: https://github.com/amitbodhit/project-skill/issues
- **Documentation**: https://docs.amitbodhit.app
- **Email**: support@amitbodhit.app

---

## License

MIT License - See LICENSE file for details

---

**Version**: 1.0.0  
**Last Updated**: March 2026
