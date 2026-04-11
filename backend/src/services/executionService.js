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
        let cdPath = '';
        let fileName = '';
        
        if (customEntryFile) {
            // Normalize: strip leading slashes
            const normalized = customEntryFile.replace(/^\/+/, '');
            const parts = normalized.split('/');
            fileName = parts[parts.length - 1];
            
            // Extract the directory path
            if (parts.length > 1) {
                cdPath = parts.slice(0, -1).join('/');
            }
            
            // Direct file execution by extension
            if (fileName.endsWith('.py')) {
                return { cdPath, runCmd: `python ${fileName}` };
            }
            if (fileName.endsWith('.js') && !fileName.endsWith('App.js') && !fileName.endsWith('index.js')) {
                return { cdPath, runCmd: `node ${fileName}` };
            }
            if (fileName.endsWith('.ts') && !fileName.endsWith('.d.ts')) {
                return { cdPath, runCmd: `npx ts-node ${fileName}` };
            }
            if (fileName.endsWith('.java')) {
                const className = fileName.replace('.java', '');
                return { cdPath, runCmd: `javac ${className}.java; java ${className}` }; // Use ; for powershell compatibility
            }
            if (fileName.endsWith('.c')) {
                const outName = fileName.replace('.c', '');
                return { cdPath, runCmd: `gcc ${fileName} -o ${outName}; ./${outName}` };
            }
            if (fileName.endsWith('.cpp')) {
                const outName = fileName.replace('.cpp', '');
                return { cdPath, runCmd: `g++ ${fileName} -o ${outName}; ./${outName}` };
            }
            if (fileName.endsWith('.go')) {
                return { cdPath, runCmd: `go run ${fileName}` };
            }
            if (fileName.endsWith('.rs')) {
                return { cdPath, runCmd: `rustc ${fileName}; ./${fileName.replace('.rs', '')}` };
            }
            if (fileName.endsWith('.rb')) {
                return { cdPath, runCmd: `ruby ${fileName}` };
            }
            if (fileName.endsWith('.sh')) {
                return { cdPath, runCmd: `bash ${fileName}` };
            }
            // If package.json is selected, run npm start in that directory
            if (fileName === 'package.json') {
                return { cdPath, runCmd: `npm start` };
            }
        }

        switch (projectType?.toLowerCase()) {
            case 'frontend':
                return { cdPath, runCmd: `npm run dev || npm start` };
            case 'backend':
                return { cdPath, runCmd: `node server.js || npm start` };
            case 'java':
                return { cdPath, runCmd: `javac Main.java; java Main` };
            case 'python_ds':
            case 'ml':
            case 'python':
                return { cdPath, runCmd: `python main.py` };
            default:
                return { cdPath, runCmd: `npm start` };
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
