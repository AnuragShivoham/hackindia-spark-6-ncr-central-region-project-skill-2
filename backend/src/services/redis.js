const Redis = require('ioredis');

// Connect to local or remote Redis
const redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

redisClient.on('error', (err) => console.error('[Redis] Main Error', err));
pubClient.on('error', (err) => console.error('[Redis] Pub Error', err));
subClient.on('error', (err) => console.error('[Redis] Sub Error', err));

const Presence = {
    // 1. TTL-based presence (Auto-removes ghost users if server crashes)
    markActive: async (userId, projectId) => {
        const key = `user:${userId}:active`;
        await redisClient.set(key, projectId, 'EX', 30); // 30s TTL
        await redisClient.sadd(`room:${projectId}:users`, userId);
    },
    
    // Refresh TTL (Called by WS Heartbeat every 10s)
    heartbeat: async (userId) => {
        const key = `user:${userId}:active`;
        const exists = await redisClient.exists(key);
        if (exists) {
            await redisClient.expire(key, 30);
        }
    },

    removeActive: async (userId, projectId) => {
        await redisClient.del(`user:${userId}:active`);
        await redisClient.srem(`room:${projectId}:users`, userId);
    }
};

const NODE_ID = `node-${require('crypto').randomUUID()}`;

const StreamSync = {
    // 1. Durable Real-Time Broadcasts (Lossless)
    broadcast: async (projectId, eventName, payload) => {
        const eventId = require('crypto').randomUUID(); // Idempotency
        const streamKey = `stream:room:${projectId}`;
        
        // Trim to max length to optimize memory (Cost Optimization Phase C)
        await redisClient.xadd(
            streamKey, 
            'MAXLEN', '~', 1000, 
            '*', 
            'eventId', eventId, 
            'type', eventName, 
            'payload', JSON.stringify(payload)
        );
    },
    
    // 2. Consume Real-Time Streams (BLOCKING Consumer Group Pattern)
    initConsumer: async (projectId, callback) => {
        const streamKey = `stream:room:${projectId}`;
        const groupName = 'ws-group';
        
        // Ensure group exists, ignore if already created
        try {
            await redisClient.xgroup('CREATE', streamKey, groupName, '$', 'MKSTREAM');
        } catch (e) {
            if (!e.message.includes('BUSYGROUP')) console.warn('[Redis] Consumer Group error', e.message);
        }

        // Dedicated blocking loop for this node
        const consumeLoop = async () => {
            try {
                // BLOCK 2000ms prevents CPU thrashing
                const result = await subClient.xreadgroup(
                    'GROUP', groupName, NODE_ID,
                    'BLOCK', 2000,
                    'COUNT', 10,
                    'STREAMS', streamKey, '>'
                );

                if (result) {
                    const streamData = result[0];
                    const messages = streamData[1];
                    for (const msg of messages) {
                        const [streamId, fields] = msg;
                        
                        // Parse Redis array to object format
                        const dataObj = {};
                        for (let i = 0; i < fields.length; i += 2) {
                            dataObj[fields[i]] = fields[i+1];
                        }

                        // Payload parsing
                        let parsedPayload = {};
                        try { parsedPayload = JSON.parse(dataObj.payload); } catch(ex){}

                        callback({
                            streamId, // Helps track lastSeenId on the client
                            eventId: dataObj.eventId,
                            type: dataObj.type,
                            payload: parsedPayload
                        });

                        // Ack the message immediately (prevent pending pileups)
                        await subClient.xack(streamKey, groupName, streamId);
                    }
                }
            } catch (err) {
                if (err.message !== 'Connection is closed.') {
                    console.error('[Streams] Consume Error:', err);
                }
            }
            
            // Loop until process dies
            if (subClient.status === 'ready') setImmediate(consumeLoop);
        };
        
        consumeLoop();
    },

    // 3. Reconnect Recovery (The true value of Streams over Pub/Sub)
    fetchMissedEvents: async (projectId, lastSeenId) => {
        if (!lastSeenId) return [];
        const streamKey = `stream:room:${projectId}`;
        
        // Exclusively fetch everything AFTER lastSeenId
        const results = await redisClient.xrange(streamKey, `(${lastSeenId}`, '+');
        return results.map(msg => {
            const [id, fields] = msg;
            let type = '';
            let payload = {};
            for (let i = 0; i < fields.length; i += 2) {
                if (fields[i] === 'type') type = fields[i+1];
                if (fields[i] === 'payload') payload = JSON.parse(fields[i+1]);
            }
            return { streamId: id, type, payload };
        });
    }
};

module.exports = {
    redis: redisClient,
    pub: pubClient,
    sub: subClient,
    Presence,
    StreamSync
};
