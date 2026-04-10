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
        let stackArr = [];
        let delivArr = [];
        try { stackArr = typeof project.tech_stack === 'string' ? JSON.parse(project.tech_stack) : (project.tech_stack || []); } catch(e) {}
        try { delivArr = typeof project.deliverables === 'string' ? JSON.parse(project.deliverables) : (project.deliverables || []); } catch(e) {}
        
        const stack = stackArr.join(',').toLowerCase();
        const deliverables = delivArr.join(',').toLowerCase();
        const combined = stack + deliverables;

        if (combined.includes('react')) return 'frontend';
        if (combined.includes('express') || combined.includes('node')) return 'backend';
        if (combined.includes('java')) return 'java';
        if (combined.includes('pandas') || combined.includes('numpy') || combined.includes('matplotlib') || combined.includes('python')) return 'python_ds';
        if (combined.includes('ml')) return 'ml';
        return 'general';
    }

    getCommand(projectType, customEntryFile = null, projectId = null) {
        let prefix = '';
        
        // If a file is selected, determine its directory to detect sub-projects (like 'my-app')
        if (customEntryFile) {
            const dirParts = customEntryFile.split('/');
            if (dirParts.length > 1) {
                const subDir = dirParts[0]; 
                prefix = `cd ${subDir} && `;
            }
            
            // If they explicitly have a Node script open, run it directly
            if (customEntryFile.endsWith('.js') && !customEntryFile.endsWith('App.js') && !customEntryFile.endsWith('index.js')) {
                 return `${prefix}node ${dirParts.pop()}`;
            }
            if (customEntryFile.endsWith('.py')) {
                 return `${prefix}python ${dirParts.pop()}`;
            }
            if (customEntryFile.endsWith('.java')) {
                 const className = dirParts.pop().replace('.java', '');
                 return `${prefix}javac ${className}.java && java ${className}`;
            }
        }

        switch (projectType?.toLowerCase()) {
            case 'frontend':
                // For React/Vite: if they are in a subfolder like my-app, we cd first
                return `${prefix}npm run dev || npm start`;
            case 'backend':
                return `${prefix}node server.js || npm start`;
            case 'java':
                return `${prefix}javac Main.java && java Main`;
            case 'python_ds':
            case 'ml':
            case 'python':
                return `${prefix}python main.py`;
            default:
                return `${prefix}npm start`;
        }
    }

    getTestingInstructions(projectType, task) {
        // Guidance based on project context
        if (projectType === 'java') {
            return {
                title: "Java Execution Check",
                steps: [
                    "Verify .class files are generated after compilation.",
                    "Check for 'public static void main' entry point.",
                    "Review console for JVM exceptions."
                ],
                executable: "java Main"
            };
        }
        if (projectType === 'python_ds') {
            return {
                title: "Data Analysis Check",
                steps: [
                    "Inspect dataframes with df.head() in output.",
                    "Check for generated .png or .sqllite files if applicable.",
                    "Ensure numpy arrays match expected shapes."
                ],
                executable: "python -c 'import pandas; import numpy; print(\"DS Stack Ready\")'"
            };
        }
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
