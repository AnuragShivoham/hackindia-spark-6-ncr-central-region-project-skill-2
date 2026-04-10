require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const config = require('./config');
const apiRouter = require('./routes/api');
const fsRouter = require('./routes/fs');
const authRouter = require('./routes/auth');
const authMiddleware = require('./middleware/auth');
const { setupTerminalWS } = require('./services/terminalService');
const { handleConnection, initHeartbeat } = require('./services/socketService');
const previewRouter = require('./routes/preview');

const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'], credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Debug Middleware: Log all requests
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'AMIT-BODHIT', version: '1.0.0' }));
app.use('/api/v1/preview', previewRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/fs', authMiddleware, fsRouter);
app.use('/api/v1', authMiddleware, apiRouter);

app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message }); });

const server = http.createServer(app);

// WebSocket Routing
const terminalWss = new WebSocketServer({ noServer: true });
const projectWss = new WebSocketServer({ noServer: true });

setupTerminalWS(terminalWss);
projectWss.on('connection', handleConnection);
initHeartbeat(projectWss);

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  console.log(`[UPGRADE] ${pathname}`);

  if (pathname === '/api/v1/terminal') {
    terminalWss.handleUpgrade(request, socket, head, (ws) => {
      terminalWss.emit('connection', ws, request);
    });
  } else if (pathname === '/api/v1/session') {
    projectWss.handleUpgrade(request, socket, head, (ws) => {
      projectWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(config.PORT, () => {
  console.log(`
 ╔══════════════════════════════════════╗
 ║  AMIT-BODHIT Backend                 ║
 ║  http://localhost:${config.PORT}              ║
 ╚══════════════════════════════════════╝`);
});
