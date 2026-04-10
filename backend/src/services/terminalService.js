const os = require('os');
const path = require('path');
const pty = require('node-pty');
const { v4: uuid } = require('uuid');
const db = require('../db/database');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');

// In-memory project authorizations (Reset on server restart for security)
const projectAuthorizations = new Map(); // projectId -> Set of keyword strings

/**
 * Grants temporary permission for a specific command keyword
 */
function authorizeCommand(projectId, keyword) {
  if (!projectAuthorizations.has(projectId)) {
    projectAuthorizations.set(projectId, new Set());
  }
  projectAuthorizations.get(projectId).add(keyword.toLowerCase());
  
  // Auto-expire after 10 minutes
  setTimeout(() => {
    const auths = projectAuthorizations.get(projectId);
    if (auths) auths.delete(keyword.toLowerCase());
  }, 10 * 60 * 1000);
}

/**
 * Setup WebSocket terminal connections
 */
function setupTerminalWS(wss, authenticate) {
  wss.on('connection', (ws, req) => {
    // Extract auth from URL params
    const url = new URL(req.url, `http://${req.headers.host}`);
    const projectId = url.searchParams.get('projectId');
    const token = url.searchParams.get('token');

    if (!projectId || !token) {
      ws.close(1008, 'Missing credentials');
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET);
    } catch (err) {
      ws.close(1008, 'Invalid token');
      return;
    }

    const project = db.prepare('SELECT user_id FROM projects WHERE id = ?').get(projectId);
    if (!project || project.user_id !== decoded.id) {
      ws.close(1008, 'Access denied or project not found');
      return;
    }

    console.log(`[Terminal] New connection for project: ${projectId}`);

    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const shellArgs = os.platform() === 'win32' 
      ? ['-NoLogo', '-ExecutionPolicy', 'Bypass'] 
      : [];

    const BASE_WORKSPACE = process.env.WORKSPACE_PATH || path.join(__dirname, '../../../workspace');
    const workspacePath = path.resolve(path.join(BASE_WORKSPACE, projectId));

    const fs = require('fs');
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }

    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: workspacePath,
      env: { ...process.env, PROJECT_ID: projectId, WORKSPACE_ROOT: workspacePath },
    });

    ptyProcess.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }));
      }
    });

    let commandBuffer = '';
    const dangerousPatterns = ['rm', 'del', 'mv', 'rd', 'sudo', 'format', 'fdisk', ' > ', '> /dev', ':(){'];

    ws.on('message', (msg) => {
      try {
        const parsed = JSON.parse(msg);

        if (parsed.type === 'input') {
          const data = parsed.data;
          
          // Accumulate command buffer to inspect full lines
          if (data === '\r' || data === '\n') {
            const cmd = commandBuffer.trim().toLowerCase();
            const isRisky = dangerousPatterns.some(p => cmd.includes(p));
            
            if (isRisky) {
              const auths = projectAuthorizations.get(projectId);
              const allowed = Array.from(auths || []).some(keyword => cmd.includes(keyword));
              
              if (!allowed) {
                ws.send(JSON.stringify({ 
                    type: 'output', 
                    data: '\r\n\x1b[31;1m[SECURITY BLOCK] This command is restricted. Please ask your AI Mentor: "Authorize [command]" to run destructive actions.\x1b[0m\r\n' 
                }));
                ptyProcess.write('\u0015'); // Ctrl+U to clear line
                commandBuffer = '';
                return;
              }
            }
            commandBuffer = '';
          } else if (data === '\u007f' || data === '\b') { // Backspace
            commandBuffer = commandBuffer.slice(0, -1);
          } else if (data.length === 1) { // Single char
            commandBuffer += data;
          }

          // Send raw strokes directly to PTY
          ptyProcess.write(data);
        } else if (parsed.type === 'resize') {
          ptyProcess.resize(parsed.cols || 80, parsed.rows || 24);
        } else if (parsed.type === 'clear') {
          ptyProcess.write(os.platform() === 'win32' ? 'clear\r\n' : 'clear\n');
        } else if (parsed.type === 'cd') {
          const target = parsed.path.replace(/^\/+/, '');
          if (os.platform() === 'win32') {
            ptyProcess.write(`cd "$env:WORKSPACE_ROOT\\${target.replace(/\//g, '\\')}"\r\n`);
          } else {
            ptyProcess.write(`cd "$WORKSPACE_ROOT/${target}"\n`);
          }
        }
      } catch (err) {
        console.error('[Terminal] Message parsing error:', err.message);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });

    ws.on('close', () => {
      try {
        ptyProcess.kill();
        console.log(`[Terminal] Connection closed for project: ${projectId}`);
      } catch (err) {
        console.error('[Terminal] Error closing PTY:', err.message);
      }
    });

    ws.on('error', (err) => {
      console.error(`[Terminal] WebSocket error (${projectId}):`, err.message);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      message: `Connected to project workspace: ${projectId}`,
      platform: os.platform(),
      cwd: workspacePath,
    }));
  });
}

module.exports = { setupTerminalWS, authorizeCommand };
