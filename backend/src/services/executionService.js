const path = require('path');
const fs = require('fs');

/**
 * ExecutionService manages the logic of RUNNING and TESTING the code.
 * It interfaces with the TerminalService to send commands to the PTY.
 */
class ExecutionService {
    constructor() {
        this.activeProcesses = new Map(); // projectId -> status
    }

    getProjectType(project) {
        const stack = (project.tech_stack || []).join(',').toLowerCase();
        if (stack.includes('react')) return 'frontend';
        if (stack.includes('express') || stack.includes('node')) return 'backend';
        if (stack.includes('python') || stack.includes('ml')) return 'python';
        return 'general';
    }

    getCommand(projectType, customEntryFile = null) {
        switch (projectType?.toLowerCase()) {
            case 'frontend':
                return 'npm run dev';
            case 'backend':
                return customEntryFile ? `node ${customEntryFile}` : 'node server.js';
            case 'python':
            case 'ml':
                return customEntryFile ? `python ${customEntryFile}` : 'python train.py';
            default:
                return 'npm start';
        }
    }

    getTestingInstructions(projectType, task) {
        // Guidance based on project context
        if (projectType === 'backend') {
            return {
                title: "Backend Verification",
                steps: [
                    "Ensure terminal shows 'Server listening' message.",
                    "Use a tool like Postman or 'curl' to hit your endpoints.",
                    "Check database for persisted data after requests."
                ],
                executable: "curl http://localhost:3000/api/health"
            };
        }
        if (projectType === 'frontend') {
            return {
                title: "Frontend Verification",
                steps: [
                    "Open the local URL provided in the terminal (usually http://localhost:5173).",
                    "Verify UI components match the task requirements.",
                    "Check browser console for errors."
                ],
                executable: "http://localhost:5173"
            };
        }
        return {
            title: "Manual Verification",
            steps: ["Check terminal output for success flags.", "Verify file outputs if applicable."],
            executable: null
        };
    }

    isDangerous(command) {
        const dangerousPatterns = [
            'rm -rf /',
            'rm -rf *',
            'mkfs',
            ':(){ :|:& };:', // Fork bomb
            '> /dev/sda',
            'process.exit'
        ];
        return dangerousPatterns.some(p => command.includes(p));
    }
}

module.exports = new ExecutionService();
