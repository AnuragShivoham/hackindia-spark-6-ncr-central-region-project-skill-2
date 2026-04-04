const os = require('os');
const path = require('path');
const pty = require('node-pty');
const { v4: uuid } = require('uuid');
const db = require('../db/database');
const jwt = require('jsonwebtoken');
const config = require('../config');/**
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

    ws.on('message', (msg) => {
      try {
        const parsed = JSON.parse(msg);

        if (parsed.type === 'input') {
          // Send raw strokes directly to PTY - intercepting keystrokes breaks ANSI shells
          ptyProcess.write(parsed.data);
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

module.exports = { setupTerminalWS };
