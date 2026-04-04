const express = require('express');
const router = express.Router();
const WorkspaceService = require('../services/workspaceService');
const db = require('../db/database');
const fs = require('fs');

const authorizedDeletions = new Map();

router.post('/authorize-deletion', (req, res) => {
  try {
    if (!req.user || !req.user.id) throw new Error("Authentication required");
    const { projectId, path: targetPath } = req.body;
    if (!projectId || targetPath === undefined) throw new Error("projectId and path required");

    const normTarget = targetPath.replace(/^[\/\\]+/, '');
    const expiry = Date.now() + 120000;
    const key = `${req.user.id}:${projectId}`;
    
    authorizedDeletions.set(key, { expiry, path: normTarget });
    
    console.log(`[FS] Auth granted to ${key} for path '${normTarget}' until ${new Date(expiry).toISOString()}`);
    res.json({ authorized: true, path: normTarget });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function getUserProject(req, projectId) {
  if (projectId) {
    const project = db.prepare('SELECT id, user_id FROM projects WHERE id = ?').get(projectId);
    if (!project || project.user_id !== req.user.id) {
      throw new Error('Access denied');
    }
    return project;
  }

  // Fall back to the most recent project for the user
  const project = db.prepare('SELECT id, user_id FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.user.id);
  if (!project) {
    throw new Error('No project found for user');
  }
  return project;
}

/**
 * File System Routes
 * All operations are sandboxed to project workspace
 */

// ─────────────────────────────────────────────────────────────────────────────
// GET /download/:projectId - Download entire workspace as ZIP
// ─────────────────────────────────────────────────────────────────────────────
router.get('/download/:projectId', (req, res) => {
  try {
    const project = getUserProject(req, req.params.projectId);
    const workspacePath = WorkspaceService.getProjectPath(project.id);

    if (!fs.existsSync(workspacePath)) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 6 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="workspace.zip"`);

    archive.on('error', (err) => {
      console.error('[FS] ZIP error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'ZIP generation failed' });
    });

    archive.pipe(res);
    archive.directory(workspacePath, false);
    archive.finalize();
  } catch (err) {
    console.error('[FS] Download error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});



// ─────────────────────────────────────────────────────────────────────────────
// GET /files/:projectId - List files in directory
// ─────────────────────────────────────────────────────────────────────────────
router.get('/files/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const { dir = '' } = req.query;

    const project = getUserProject(req, projectId);

    const files = WorkspaceService.listFiles(projectId, dir);
    res.json({
      projectId,
      directory: dir || '/',
      files,
      stats: WorkspaceService.getWorkspaceStats(projectId),
    });
  } catch (err) {
    console.error('[FS] List error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /file/:projectId/* - Read file content
// ─────────────────────────────────────────────────────────────────────────────
router.get('/file/:projectId/*', (req, res) => {
  try {
    const { projectId } = req.params;
    const filePath = req.params[0]; // Capture everything after projectId/

    const project = getUserProject(req, projectId);

    const file = WorkspaceService.readFile(projectId, filePath);
    res.json(file);
  } catch (err) {
    console.error('[FS] Read error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /file/:projectId/* - Create or update file
// ─────────────────────────────────────────────────────────────────────────────
router.post('/file/:projectId/*', (req, res) => {
  try {
    const { projectId } = req.params;
    const filePath = req.params[0];
    const { content } = req.body;

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content must be a string' });
    }

    const project = getUserProject(req, projectId);

    const result = WorkspaceService.writeFile(projectId, filePath, content);
    res.json(result);
  } catch (err) {
    console.error('[FS] Write error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /file/:projectId/* - Delete file
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/file/:projectId/*', (req, res) => {
  try {
    const { projectId } = req.params;
    const filePath = req.params[0];

    const project = getUserProject(req, projectId);

    const normReqPath = filePath.replace(/^[\/\\]+/, '');
    let isAuthorized = false;
    const key = `${req.user.id}:${projectId}`;
    const authRecord = authorizedDeletions.get(key);

    if (authRecord) {
      if (Date.now() < authRecord.expiry) {
        if (normReqPath === authRecord.path || normReqPath.startsWith(authRecord.path !== '' ? authRecord.path + '/' : '')) {
          isAuthorized = true;
          authorizedDeletions.delete(key);
        }
      } else {
        authorizedDeletions.delete(key);
      }
    }

    const result = WorkspaceService.deleteFile(projectId, filePath, isAuthorized);
    console.log(JSON.stringify({ AUDIT: 'DELETE', timestamp: new Date().toISOString(), userId: req.user.id, projectId, filePath, result: 'SUCCESS' }));
    res.json(result);
  } catch (err) {
    console.log(JSON.stringify({ AUDIT: 'DELETE', timestamp: new Date().toISOString(), userId: req.user?.id, projectId: req.params.projectId, filePath: req.params[0], result: 'FAILED', reason: err.message }));
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /download/:projectId - Download workspace zip
// ─────────────────────────────────────────────────────────────────────────────
router.get('/download/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const project = getUserProject(req, projectId);
    const workspacePath = WorkspaceService.getProjectPath(project.id);
    
    if (!require('fs').existsSync(workspacePath)) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.attachment(`${project.title.replace(/[^a-z0-9]/gi, '_') || 'workspace'}.zip`);
    archive.pipe(res);
    archive.directory(workspacePath, false);
    archive.finalize();
  } catch (err) {
    console.error('[FS] Download error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /folder/:projectId/* - Create directory
// ─────────────────────────────────────────────────────────────────────────────
router.post('/folder/:projectId/*', (req, res) => {
  try {
    const { projectId } = req.params;
    const dirPath = req.params[0];

    const project = getUserProject(req, projectId);

    const result = WorkspaceService.createDirectory(projectId, dirPath);
    res.json(result);
  } catch (err) {
    console.error('[FS] Folder create error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Compatibility endpoints used by the IDE frontend
// ─────────────────────────────────────────────────────────────────────────────

router.get('/tree', (req, res) => {
  try {
    const project = getUserProject(req, req.query.projectId);
    const dir = req.query.dir || '';
    const files = WorkspaceService.listFiles(project.id, dir);
    res.json({ projectId: project.id, directory: dir || '/', tree: files });
  } catch (err) {
    console.error('[FS] Tree error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.get('/file', (req, res) => {
  try {
    const project = getUserProject(req, req.query.projectId);
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path query param required' });

    const file = WorkspaceService.readFile(project.id, filePath);
    res.json(file);
  } catch (err) {
    console.error('[FS] Read error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/file', (req, res) => {
  try {
    const project = getUserProject(req, req.body.projectId);
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path required' });
    if (typeof content !== 'string') return res.status(400).json({ error: 'content must be a string' });

    const result = WorkspaceService.writeFile(project.id, filePath, content);
    res.json(result);
  } catch (err) {
    console.error('[FS] Write error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/touch', (req, res) => {
  try {
    const project = getUserProject(req, req.body.projectId);
    const { path: filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path required' });

    const result = WorkspaceService.writeFile(project.id, filePath, '');
    res.json(result);
  } catch (err) {
    console.error('[FS] Touch error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/mkdir', (req, res) => {
  try {
    const project = getUserProject(req, req.body.projectId);
    const { path: dirPath } = req.body;
    if (!dirPath) return res.status(400).json({ error: 'path required' });

    const result = WorkspaceService.createDirectory(project.id, dirPath);
    res.json(result);
  } catch (err) {
    console.error('[FS] Mkdir error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.put('/rename', (req, res) => {
  try {
    const project = getUserProject(req, req.body.projectId);
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) return res.status(400).json({ error: 'oldPath and newPath required' });

    const result = WorkspaceService.renameFile(project.id, oldPath, newPath);
    res.json(result);
  } catch (err) {
    console.error('[FS] Rename error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.delete('/file', (req, res) => {
  try {
    const project = getUserProject(req, req.query.projectId);
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path required' });

    const normReqPath = filePath.replace(/^[\/\\]+/, '');
    let isAuthorized = false;
    const key = `${req.user.id}:${project.id}`;
    const authRecord = authorizedDeletions.get(key);

    if (authRecord) {
      if (Date.now() < authRecord.expiry) {
        if (normReqPath === authRecord.path || normReqPath.startsWith(authRecord.path !== '' ? authRecord.path + '/' : '')) {
          isAuthorized = true;
          authorizedDeletions.delete(key);
        }
      } else {
        authorizedDeletions.delete(key);
      }
    }

    const result = WorkspaceService.deleteFile(project.id, filePath, isAuthorized);
    console.log(JSON.stringify({ AUDIT: 'DELETE', timestamp: new Date().toISOString(), userId: req.user.id, projectId: project.id, filePath, result: 'SUCCESS' }));
    res.json(result);
  } catch (err) {
    console.log(JSON.stringify({ AUDIT: 'DELETE', timestamp: new Date().toISOString(), userId: req.user?.id, projectId: req.query.projectId, filePath: req.query.path, result: 'FAILED', reason: err.message }));
    res.status(400).json({ error: err.message });
  }
});

router.post('/upload', (req, res) => {
  try {
    const project = getUserProject(req, req.body.projectId);
    const { path: filePath, content, encoding } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path required' });
    
    if (encoding === 'base64') {
      const fullPath = WorkspaceService.validateFilePath(project.id, filePath);
      const fs = require('fs');
      const pathUtils = require('path');
      const dir = pathUtils.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, Buffer.from(content, 'base64'));
      res.json({ path: filePath, created: true });
    } else {
      const result = WorkspaceService.writeFile(project.id, filePath, content);
      res.json(result);
    }
  } catch (err) {
    console.error('[FS] Upload error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/git-clone', async (req, res) => {
  try {
    const project = getUserProject(req, req.body.projectId);
    const { url, targetDir = '' } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    // Ensure it's inside the workspace
    const fullPath = WorkspaceService.validateFilePath(project.id, targetDir);

    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('Invalid git URL');
    }
    
    // We clone directly into the fullPath, ensure it exists!
    const fs = require('fs');
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    await execPromise(`git clone "${url.replace(/"/g, '')}" .`, { cwd: fullPath });
    
    res.json({ success: true, path: targetDir });
  } catch (err) {
    console.error('[FS] Git clone error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /git-push - Commit and push all workspace changes
// ─────────────────────────────────────────────────────────────────────────────
router.post('/git-push', async (req, res) => {
  try {
    const project = getUserProject(req, req.body.projectId);
    const { message = 'AMIT-BODHIT: auto-save checkpoint' } = req.body;
    
    const workspacePath = WorkspaceService.getProjectPath(project.id);
    
    if (!fs.existsSync(workspacePath)) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    // Check if git is initialized
    if (!fs.existsSync(require('path').join(workspacePath, '.git'))) {
      return res.status(400).json({ error: 'No git repository found. Use Git Clone first or run `git init` in the terminal.' });
    }

    // Stage all, commit, push
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const commitMsg = `${message} [${timestamp}]`;
    
    await execPromise('git add -A', { cwd: workspacePath });
    
    try {
      await execPromise(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: workspacePath });
    } catch (commitErr) {
      // No changes to commit is not an error — check stdout, stderr AND message (Windows puts it in stdout)
      const errText = (commitErr.stdout || '') + (commitErr.stderr || '') + (commitErr.message || '');
      if (errText.includes('nothing to commit')) {
        return res.json({ success: true, message: 'Nothing to commit — workspace is clean ✓' });
      }
      throw commitErr;
    }
    
    try {
      const { stdout } = await execPromise('git push', { cwd: workspacePath, timeout: 30000 });
      res.json({ success: true, message: `Pushed successfully`, output: stdout });
    } catch (pushErr) {
      // Push failed — still committed locally
      res.json({ success: true, committed: true, pushFailed: true, message: 'Committed locally but push failed. Check remote config.', error: pushErr.stderr || pushErr.message });
    }
  } catch (err) {
    console.error('[FS] Git push error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/touch', (req, res) => {
  try {
    const project = getUserProject(req, req.body.projectId);
    const { path: filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path required' });

    const result = WorkspaceService.writeFile(project.id, filePath, '');
    res.json(result);
  } catch (err) {
    console.error('[FS] Touch error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/mkdir', (req, res) => {
  try {
    const project = getUserProject(req, req.body.projectId);
    const { path: dirPath } = req.body;
    if (!dirPath) return res.status(400).json({ error: 'path required' });

    const result = WorkspaceService.createDirectory(project.id, dirPath);
    res.json(result);
  } catch (err) {
    console.error('[FS] Mkdir error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /init/:projectId - Initialize project workspace
// ─────────────────────────────────────────────────────────────────────────────
router.post('/init/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const { template = 'nodejs' } = req.body;

    // Verify project belongs to user
    const project = db.prepare('SELECT id, user_id FROM projects WHERE id = ?').get(projectId);
    if (!project || project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = WorkspaceService.initializeProjectStructure(projectId, template);
    res.json(result);
  } catch (err) {
    console.error('[FS] Init error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /stats/:projectId - Get workspace statistics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project belongs to user
    const project = db.prepare('SELECT id, user_id FROM projects WHERE id = ?').get(projectId);
    if (!project || project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = WorkspaceService.getWorkspaceStats(projectId);
    res.json({ projectId, ...stats });
  } catch (err) {
    console.error('[FS] Stats error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

