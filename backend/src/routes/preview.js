const express = require('express');
const path = require('path');
const fs = require('fs');
const WorkspaceService = require('../services/workspaceService');

const router = express.Router();

// ─── LIVE PREVIEW MIDDLEWARE ────────────────────────────────────────────────
// Serves static files from a project's workspace
router.get('/:projectId/*', (req, res) => {
    const { projectId } = req.params;
    const subPath = req.params[0] || 'index.html';
    
    try {
        const workspacePath = WorkspaceService.getProjectPath(projectId);
        const fullPath = path.join(workspacePath, subPath);

        // Security: Prevent Directory Traversal
        if (!fullPath.startsWith(workspacePath)) {
            return res.status(403).send('Access Denied');
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).send('File not found in workspace');
        }

        // Handle directories - look for index.html
        if (fs.statSync(fullPath).isDirectory()) {
            const indexFile = path.join(fullPath, 'index.html');
            if (fs.existsSync(indexFile)) {
                return res.sendFile(indexFile);
            }
            return res.status(404).send('Directory index not found');
        }

        // Special handling for HTML to inject live reload script (Simulated)
        if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            const injectScript = `
                <script>
                    console.log('[LiveServer] System Online');
                    // Simple interval check for updates (simulated HMR)
                    let lastUpdate = Date.now();
                    setInterval(async () => {
                        try {
                            const r = await fetch(window.location.href, { method: 'HEAD' });
                            const newDate = new Date(r.headers.get('last-modified')).getTime();
                            if (newDate > lastUpdate) {
                                window.location.reload();
                            }
                        } catch(e) {}
                    }, 2000);
                </script>
            `;
            content = content.replace('</body>', `${injectScript}</body>`);
            return res.send(content);
        }

        res.sendFile(fullPath);
    } catch (e) {
        console.error('[Preview Error]', e.message);
        res.status(500).send('Preview Error: ' + e.message);
    }
});

module.exports = router;
