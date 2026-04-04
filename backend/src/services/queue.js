const { Queue, Worker } = require('bullmq');
const { pub } = require('./redis');

// Centralize connection
const connection = {
    host: '127.0.0.1',
    port: 6379,
};

// 1. Core Queues
const validateQueue = new Queue('validate', { connection });
const explainQueue = new Queue('explain', { connection });
const behaviorQueue = new Queue('behavior', { connection });

// 2. Generic Worker Shell
const processJobAsync = (queueName, processorFn) => {
    return new Worker(queueName, async (job) => {
        try {
            console.log(`[Worker] Starting Job ${job.id} on ${queueName}`);
            
            // Execute the heavily blocking DB or AI task
            const result = await processorFn(job.data);
            
            // 3. WS Result Broadcast (Idempotent Delivery)
            if (job.data.projectId) {
                const eventId = require('crypto').randomUUID();
                pub.publish(`room:${job.data.projectId}`, JSON.stringify({
                    eventId,
                    type: `job:${queueName}:done`,
                    payload: { jobId: job.id, result }
                }));
            }
            return result;
        } catch (error) {
            console.error(`[Worker] Job ${job.id} failed:`, error);
            throw error;
        }
    }, {
        connection,
        attempts: 2,           // Retry strictness
        backoff: { type: 'exponential', delay: 1000 },
        timeout: 30000         // Strict timeout constraints
    });
};

module.exports = {
    validateQueue,
    explainQueue,
    behaviorQueue,
    processJobAsync
};
