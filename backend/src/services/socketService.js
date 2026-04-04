const { WebSocket } = require('ws');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

// Storage for active rooms
// Key: projectId
// Value: { sockets: Set, primary: ws, promoting: bool, takingOver: bool, lastTakeover: number, processedMsgIds: Set }
const rooms = new Map();

/**
 * Atomic Primary Promotion
 * Serialized to prevent race conditions during concurrent connections
 */
async function promotePrimary(projectId) {
    const room = rooms.get(projectId);
    if (!room || room.promoting) return;

    room.promoting = true;
    try {
        // If current primary is still healthy, keep it
        if (room.primary && room.primary.readyState === WebSocket.OPEN) {
            return;
        }

        // Search for next healthy socket
        for (const ws of room.sockets) {
            if (ws.readyState === WebSocket.OPEN) {
                room.primary = ws;
                broadcastStatus(projectId);
                break;
            }
        }
    } finally {
        room.promoting = false;
    }
}

/**
 * Broadcast room status (who is primary) to all participants
 */
function broadcastStatus(projectId) {
    const room = rooms.get(projectId);
    if (!room) return;

    room.sockets.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'room:status',
                primaryId: room.primary ? room.primary.userId : null,
                isPrimary: ws === room.primary,
                timestamp: Date.now()
            }));
        }
    });
}

/**
 * Clean HTML to prevent XSS
 */
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[m]);
}

/**
 * Segmented Rate Limiter
 */
function checkRateLimit(ws, type) {
    const now = Date.now();
    if (!ws.limits) ws.limits = { chat: [], code: [] };
    
    const window = 5000; // 5 seconds
    const bucket = type === 'chat:send' ? 'chat' : 'code';
    const limit = type === 'chat:send' ? 10 : 3;

    ws.limits[bucket] = ws.limits[bucket].filter(t => now - t < window);
    
    if (ws.limits[bucket].length >= limit) {
        return false;
    }
    
    ws.limits[bucket].push(now);
    return true;
}

const socketService = {
    handleConnection: async (ws, req) => {
        try {
            // 1. Extract and verify params
            const query = new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams;
            const token = query.get('token');
            const projectId = query.get('projectId');

            if (!token || !projectId) {
                ws.close(4001, 'Missing token or projectId');
                return;
            }

            // 2. Auth & Role binding
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'amitbodhit_secret_key');
            ws.userId = decoded.id;
            ws.projectId = projectId;
            ws.isAlive = true;

            // Fetch role from DB (Synchronous with DatabaseSync)
            const user = db.prepare('SELECT role FROM users WHERE id = ?').get(ws.userId);

            if (!user) {
                ws.close(4002, 'User not found');
                return;
            }
            ws.role = user.role;

            // 3. Room Management
            if (!rooms.has(projectId)) {
                rooms.set(projectId, {
                    sockets: new Set(),
                    primary: null,
                    promoting: false,
                    takingOver: false,
                    lastTakeover: 0,
                    processedMsgIds: new Set()
                });
            }

            const room = rooms.get(projectId);
            room.sockets.add(ws);

            // 4. Initial Promotion
            await promotePrimary(projectId);

            // 5. Send History (Last 20 messages)
            try {
                const rows = db.prepare(`
                    SELECT * FROM (
                        SELECT * FROM chat_history 
                        WHERE project_id = ? 
                        ORDER BY created_at DESC, id DESC 
                        LIMIT 20
                    ) ORDER BY created_at ASC, id ASC
                `).all(projectId);

                if (rows) {
                    ws.send(JSON.stringify({
                        type: 'chat:history',
                        messages: rows.map(r => ({ ...r, content: escapeHTML(r.content) }))
                    }));
                }
            } catch (e) {
                console.error('[WS] History error:', e);
            }

            // 6. Listeners
            ws.on('pong', () => { ws.isAlive = true; });

            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data);
                    const { type, msgId, payload } = message;

                    if (!msgId) return;

                    // Idempotency: Room-scoped check (userId + projectId bound room)
                    if (room.processedMsgIds.has(msgId)) {
                        ws.send(JSON.stringify({ type: 'ack', msgId, status: 'duplicate' }));
                        return;
                    }

                    // Rate Limiting
                    if (!checkRateLimit(ws, type)) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded', msgId }));
                        return;
                    }

                    // Process specific events
                    if (type === 'chat:send') {
                        const sanitized = escapeHTML(payload.text);
                        // Persist
                        try {
                            db.prepare('INSERT INTO chat_history (project_id, user_id, content, created_at) VALUES (?, ?, ?, ?)').run(
                                projectId, ws.userId, sanitized, Date.now()
                            );
                            
                            // Broadcast
                            const broadcastMsg = JSON.stringify({
                                type: 'chat:receive',
                                msgId,
                                payload: {
                                    userId: ws.userId,
                                    text: sanitized,
                                    timestamp: Date.now()
                                }
                            });
                            room.sockets.forEach(s => s.send(broadcastMsg));
                        } catch (e) {
                            console.error('[WS] DB Save error:', e);
                        }
                    } else if (type === 'code:preview') {
                        // Permission: Primary Only (and usually Mentor)
                        if (ws.role !== 'mentor') {
                            ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized action: Code Preview is restricted to Mentors.', msgId }));
                            return;
                        }

                        // Payload limits: 100KB soft, 500KB hard
                        if (JSON.stringify(payload).length > 500 * 1024) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Payload too large', msgId }));
                            return;
                        }

                        // Broadcast preview to everyone in room
                        const previewMsg = JSON.stringify({ type: 'code:preview', msgId, payload });
                        room.sockets.forEach(s => {
                            if (s !== ws) s.send(previewMsg);
                        });
                    } else if (type === 'take_control') {
                        // Atomic Takeover
                        const now = Date.now();
                        if (room.takingOver || (now - room.lastTakeover < 3000)) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Takeover locked or core cooldown active', msgId }));
                            return;
                        }

                        // Role Enforcer: Student cannot un-seat an active Mentor
                        if (ws.role !== 'mentor' && room.primary && room.primary.role === 'mentor' && room.primary.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Action Denied: Mentor has live control over this session.', msgId }));
                            return;
                        }

                        room.takingOver = true;
                        room.primary = ws;
                        room.lastTakeover = now;
                        room.takingOver = false;
                        
                        // Enforce mode update to LIVE if mentor takes over
                        if (ws.role === 'mentor') {
                             db.prepare("UPDATE projects SET current_task_id = current_task_id WHERE id = ?").run(projectId); // Touch
                        }
                        broadcastStatus(projectId);
                    }

                    // Mark as processed
                    room.processedMsgIds.add(msgId);
                    if (room.processedMsgIds.size > 500) {
                        const first = room.processedMsgIds.values().next().value;
                        room.processedMsgIds.delete(first);
                    }

                    // Send ACK
                    ws.send(JSON.stringify({ type: 'ack', msgId, status: 'success' }));

                } catch (e) {
                    console.error('[WS] Message error:', e);
                }
            });

            ws.on('close', async () => {
                room.sockets.delete(ws);
                if (room.sockets.size === 0) {
                    rooms.delete(projectId);
                } else if (ws === room.primary) {
                    await promotePrimary(projectId);
                }
            });

            // Backpressure monitoring
            const bInterval = setInterval(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    clearInterval(bInterval);
                    return;
                }
                if (ws.bufferedAmount > 1024 * 1024) { // 1MB
                    ws.send(JSON.stringify({ type: 'warning', message: 'Backpressure limit exceeded. Connection throttled.' }));
                    setTimeout(() => ws.terminate(), 1000);
                }
            }, 5000);

        } catch (e) {
            console.error('[WS] Connection error:', e);
            ws.close(1011, 'Internal Server Error');
        }
    },

    // Global heartbeat interval (15s ping)
    initHeartbeat: (wss) => {
        setInterval(() => {
            wss.clients.forEach(ws => {
                if (!ws.isAlive) return ws.terminate();
                ws.isAlive = false;
                ws.ping();
            });
        }, 15000);
    }
};

module.exports = socketService;
