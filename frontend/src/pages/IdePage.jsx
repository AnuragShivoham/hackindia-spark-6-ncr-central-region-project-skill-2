import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
    Play, Loader2, Send, Save, FolderOpen, File,
    PanelRightClose, PanelRightOpen, TerminalSquare, AlertCircle,
    FilePlus, FolderPlus, Pencil, Trash2, GitBranchPlus, RefreshCw, ChevronRight, ChevronDown,
    MessageSquare, Download, Upload, HardDrive, ArrowLeft, GitCommitHorizontal,
    Files, LayoutDashboard, Target, Zap, MapPin,
    Square, CheckSquare, PlayCircle, Puzzle, Monitor, ShieldCheck, User2, Laptop, Palette,
    Monitor as MonitorIcon, Puzzle as PuzzleIcon, PanelLeft, Layout, ExternalLink, X, XCircle, Settings
} from 'lucide-react';
import { api } from '../api/client';
import { useStore } from '../store';
import '@xterm/xterm/css/xterm.css';
import ExplainModal from '../components/mentor/ExplainModal';
import ProgressPanel from '../components/ide/ProgressPanel.jsx';
import ExtensionHub from '../components/ide/ExtensionHub.jsx';
import WebPreview from '../components/ide/WebPreview.jsx';
import MarkdownRenderer from '../components/MarkdownRenderer.jsx';
import ProjectAdminModal from '../components/ide/ProjectAdminModal.jsx';

// ─── UTILS ───────────────────────────────────────────────────────────────────
const getLanguage = (filename) => {
    if (!filename) return 'javascript';
    const ext = filename.split('.').pop().toLowerCase();
    const map = { js: 'javascript', jsx: 'javascript', py: 'python', java: 'java', html: 'html', css: 'css', json: 'json', md: 'markdown' };
    return map[ext] || 'javascript';
};

const iconBtn = { 
    background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', 
    padding: '6px', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s'
};

// Universal Directory Detector
const checkIsDir = (node) => {
    if (!node) return false;
    // Rule 1: Explicit flags
    if (node.isDir || node.isDirectory || node.type === 'directory' || (node.children && Array.isArray(node.children))) return true;
    // Rule 2: Path-based fallback (No extension = likely directory, excluding common dotfiles)
    if (node.name && !node.name.includes('.') && node.name !== 'LICENSE' && node.name !== 'README') return true;
    return false;
};

// ─── CONTEXT MENU ─────────────────────────────────────────────────────────────
function ContextMenu({ x, y, node, onClose, onNewFile, onNewFolder, onRename, onDelete, onPreview, setImportTarget }) {
    const isDir = checkIsDir(node);
    const isHtml = node?.name?.toLowerCase()?.endsWith('.html');
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    const item = (icon, label, action, danger = false) => (
        <div
            onClick={() => { action(); onClose(); }}
            style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
                cursor: 'pointer', fontSize: 12, color: danger ? '#f87171' : '#c9d1d9',
                transition: 'background 0.1s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#21262d'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            {icon}
            {label}
        </div>
    );

    return (
        <div ref={ref} style={{ position: 'fixed', top: y, left: x, zIndex: 1000, background: '#161b22', border: '1px solid #30363d', borderRadius: 6, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            {isDir && item(<FilePlus size={13} />, 'New File', () => onNewFile(node))}
            {isDir && item(<FolderPlus size={13} />, 'New Folder', () => onNewFolder(node))}
            {isDir && item(<FolderOpen size={13} />, 'Import File', () => { setImportTarget(node.path); document.getElementById('hidden-file-input')?.click(); })}
            {isDir && item(<Upload size={13} />, 'Import Folder', () => { setImportTarget(node.path); document.getElementById('hidden-folder-input')?.click(); })}
            {isHtml && item(<Monitor size={13} />, 'Live Preview', () => onPreview(node.path))}
            {(isDir || isHtml) && <div style={{ borderTop: '1px solid #30363d', margin: '2px 0' }} />}
            {item(<Pencil size={13} />, 'Rename', () => onRename(node))}
            {item(<Trash2 size={13} />, 'Delete', () => onDelete(node), true)}
        </div>
    );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function Modal({ title, placeholder, value, onChange, onConfirm, onCancel, confirmLabel = 'OK', danger = false }) {
    const inputRef = useRef(null);
    useEffect(() => inputRef.current?.focus(), []);
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 24, minWidth: 360, boxShadow: '0 16px 48px rgba(0,0,0,0.8)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3', marginBottom: 16 }}>{title}</div>
                <input ref={inputRef} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} onKeyDown={e => { if (e.key === 'Enter') onConfirm(); if (e.key === 'Escape') onCancel(); }} style={{ width: '100%', background: '#010409', border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px', color: '#e6edf3', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                    <button onClick={onConfirm} style={{ background: danger ? '#b91c1c' : '#238636', border: 'none', color: 'white', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 12 }}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}

// ─── FILE TREE NODE ──────────────────────────────────────────────────────────
function TreeNode({ node, depth, activeFile, onOpen, onContextMenu, expandedDirs, toggleDir }) {
    const isDir = checkIsDir(node);
    const isExpanded = expandedDirs.has(node.path);
    return (
        <div>
            <div
                onClick={() => isDir ? toggleDir(node.path) : (node?.path && onOpen(node))}
                onContextMenu={e => { e.preventDefault(); onContextMenu(e, node); }}
                style={{
                    paddingLeft: 8 + depth * 14, paddingRight: 8, height: 26, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none',
                    background: !isDir && activeFile?.path === node.path ? 'rgba(88,166,255,0.12)' : 'transparent',
                    color: !isDir && activeFile?.path === node.path ? '#58a6ff' : (isDir ? '#e6edf3' : '#8b949e'),
                    fontSize: 12, borderRadius: 4, transition: 'background 0.1s'
                }}
                onMouseEnter={e => { if (!isDir && activeFile?.path !== node.path) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isDir && activeFile?.path !== node.path) e.currentTarget.style.background = 'transparent'; }}
            >
                {isDir ? (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span style={{ width: 12 }} />}
                {isDir ? <FolderOpen size={13} style={{ color: '#e6a700' }} /> : <File size={13} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
            </div>
            {isDir && isExpanded && (node.children || []).map(child => (
                <TreeNode key={child.path} node={child} depth={depth + 1} activeFile={activeFile} onOpen={onOpen} onContextMenu={onContextMenu} expandedDirs={expandedDirs} toggleDir={toggleDir} />
            ))}
        </div>
    );
}

// ─── IDE PAGE ─────────────────────────────────────────────────────────────────
export default function IDE() {
    const navigate = useNavigate();

    // FS State
    const [fsTree, setFsTree] = useState([]);
    const [openFiles, setOpenFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [fileContents, setFileContents] = useState({});
    const [dirtyFiles, setDirtyFiles] = useState(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [expandedDirs, setExpandedDirs] = useState(new Set());

    // UI/Selection State
    const [modal, setModal] = useState(null);
    const [modalValue, setModalValue] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [ctxMenu, setCtxMenu] = useState(null);
    const [importTarget, setImportTarget] = useState('/');
    const [statusMsg, setStatusMsg] = useState('');
    const [statusErr, setStatusErr] = useState(false);
    
    // Layout State
    const [showSidebar, setShowSidebar] = useState(true);
    const [showTerm, setShowTerm] = useState(true);
    const [showChat, setShowChat] = useState(true);
    const [activeSidebarTab, setActiveSidebarTab] = useState('explorer');
    const [rightSidebarTab, setRightSidebarTab] = useState('mentor');
    const [previewSubpath, setPreviewSubpath] = useState('index.html');
    const [termHeight, setTermHeight] = useState(240);
    const [showAdmin, setShowAdmin] = useState(false);

    // Global Store
    const { project, currentTask, chatLog, addChatMessage, token } = useStore();
    const [chatInput, setChatInput] = useState('');
    const [isAsking, setIsAsking] = useState(false);

    // Learning & Sync Ref
    const behaviorMetrics = useRef({ pasteSize: 0, typingSpeed: 0, keystrokeCount: 0, sessionStart: Date.now() });
    const [gitPushing, setGitPushing] = useState(false);
    const [localSyncHandle, setLocalSyncHandle] = useState(null);

    // Refs
    const termRef = useRef(null);
    const wsRef = useRef(null);
    const termObjRef = useRef(null);
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    const status = (msg, err = false) => {
        setStatusMsg(msg); setStatusErr(err);
        setTimeout(() => setStatusMsg(''), 3000);
    };

    const loadFsTree = useCallback(async () => {
        if (!project?.id) return;
        try {
            const res = await api.getFsTree(project.id);
            setFsTree(res.tree || []);
        } catch (e) { status('Failed to load tree: ' + e.message, true); }
    }, [project?.id]);

    useEffect(() => { loadFsTree(); }, [loadFsTree]);

    const toggleDir = (path) => {
        setExpandedDirs(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path); else next.add(path);
            return next;
        });
    };

    const handleOpenFile = async (file) => {
        if (!file || checkIsDir(file)) return;
        const filePath = file.path;
        if (!filePath) return;

        if (!openFiles.find(f => f.path === filePath)) setOpenFiles(prev => [...prev, file]);
        setActiveFile(file);
        
        if (!(filePath in fileContents)) {
            status('Opening ' + (file.name || 'file') + '...');
            try {
                const res = await api.getFile(filePath, project.id);
                setFileContents(prev => ({ ...prev, [filePath]: res.content || '' }));
            } catch (e) { status('Failed to open: ' + e.message, true); }
        }
    };

    const writeToLocalSync = useCallback(async (filePath, content, isDir = false) => {
        if (!localSyncHandle) return;
        try {
            const parts = filePath.split('/').filter(p => p);
            let current = localSyncHandle;
            for (let i = 0; i < parts.length - (isDir ? 0 : 1); i++) {
                current = await current.getDirectoryHandle(parts[i], { create: true });
            }
            if (!isDir) {
                const fileHandle = await current.getFileHandle(parts[parts.length - 1], { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
            }
        } catch (err) { console.error('[Sync] Error', err); }
    }, [localSyncHandle]);

    const handleSave = useCallback(async () => {
        const fileToSave = activeFile;
        const content = fileContents[fileToSave?.path];
        if (!fileToSave || !dirtyFiles.has(fileToSave.path) || content === undefined || !project?.id) return;
        setIsSaving(true);
        try {
            await api.saveFile(fileToSave.path, content, project.id);
            setDirtyFiles(prev => { const n = new Set(prev); n.delete(fileToSave.path); return n; });
            status('Saved ' + fileToSave.name);
            if (localSyncHandle) writeToLocalSync(fileToSave.path, content);
        } catch (e) { status('Save failed', true); }
        setIsSaving(false);
    }, [activeFile, fileContents, dirtyFiles, project?.id, localSyncHandle, writeToLocalSync]);

    const handleInitLocalSync = async () => {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
            setLocalSyncHandle(handle);
            status('Local sync active');
        } catch (err) { status('Sync setup cancelled', true); }
    };

    const handleRunCode = async () => {
        if (!project?.id) return;
        try {
            const res = await api.runProject(project.id, activeFile?.path);
            if (res.action === 'block') return status('Blocked: ' + res.reason, true);
            
            // Special handling for HTML Live Preview via RUN button
            if (res.action === 'preview') {
                setPreviewSubpath(res.path || 'index.html');
                setRightSidebarTab('preview');
                if (!showChat) setShowChat(true);
                return status('Live Preview Started');
            }

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'input', data: `\r${res.command}\r` }));
                status(`Running...`);
                if (!showTerm) setShowTerm(true);
            }
        } catch (err) { status('Run failed', true); }
    };

    const handleDownloadWorkspace = async () => {
        status('Preparing ZIP...');
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            const res = await fetch(`http://localhost:3000/api/v1/fs/download/${project.id}`, { headers });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${project.title || 'workspace'}.zip`;
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
            status('Downloaded!');
        } catch (err) { status('Download failed', true); }
    };

    const handleGitPush = async () => {
        if (!project?.id) return;
        setGitPushing(true); status('Git Push...');
        try {
            await api.gitPush(`Checkpoint: ${new Date().toLocaleString()}`, project.id);
            status('Pushed!');
        } catch (err) { status('Push failed', true); }
        setGitPushing(false);
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        status(`Uploading...`);
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const content = ev.target.result.split(',')[1];
                const targetPath = (importTarget === '/' ? '' : importTarget) + '/' + file.name;
                await api.uploadFile(targetPath, content, 'base64', project.id);
            };
            reader.readAsDataURL(file);
        }
        setTimeout(loadFsTree, 1000);
    };

    const handleChat = async () => {
        if (!chatInput.trim()) return;
        const msg = chatInput; setChatInput('');
        addChatMessage({ role: 'user', content: msg });
        setIsAsking(true);
        try {
            const content = activeFile ? fileContents[activeFile.path] : null;
            const res = await api.askProjectQuestion(project.id, msg, content, activeFile?.path);
            let displayMsg = res.message;
            
            // Extract and Execute Action Plans (Makes Tools Fully Operative)
            const actionMatch = displayMsg.match(/<ACTION_PLAN>([\s\S]*?)<\/ACTION_PLAN>/);
            if (actionMatch) {
                try {
                    const actions = JSON.parse(actionMatch[1]);
                    displayMsg = displayMsg.replace(/<ACTION_PLAN>[\s\S]*?<\/ACTION_PLAN>/, '').trim();
                    
                    for (const action of actions) {
                        if (action.type === 'terminal' && wsRef.current?.readyState === WebSocket.OPEN) {
                            wsRef.current.send(JSON.stringify({ type: 'input', data: `\r${action.command}\r` }));
                            if (!showTerm) setShowTerm(true);
                            displayMsg += `\n\n*(Executing terminal autonomous action...)*`;
                        } else if (action.type === 'create_file') {
                            await api.saveFile(action.path || action.file, action.content || '', project.id);
                            loadFsTree();
                            displayMsg += `\n\n*(Created file: ${action.path || action.file})*`;
                        } else if (action.type === 'mcp_query') {
                            let npxTool = '@modelcontextprotocol/server-sqlite';
                            if (action.server && action.server.includes('brave')) npxTool = '@modelcontextprotocol/server-brave-search';
                            const cmd = `npx -y ${npxTool} --query "${action.query.replace(/"/g, '\\"')}"`;
                            if (wsRef.current?.readyState === WebSocket.OPEN) {
                                wsRef.current.send(JSON.stringify({ type: 'input', data: `\r${cmd}\r` }));
                                if (!showTerm) setShowTerm(true);
                            }
                            displayMsg += `\n\n*(Running MCP tool command '${action.server}' in Terminal)*`;
                        }
                    }
                } catch(e) { console.error("Action Plan Parse Error", e); }
            }
            
            addChatMessage({ role: 'mentor', content: displayMsg });
        } catch (e) { addChatMessage({ role: 'system', content: 'Chat Error' }); }
        setIsAsking(false);
    };

    useEffect(() => {
        const term = new Terminal({ theme: { background: '#0a0a0a' }, fontSize: 13, cursorBlink: true });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon); term.open(termRef.current); fitAddon.fit();
        termObjRef.current = term;
        if (!project?.id || !token) return;
        const host = window.location.host.split(':')[0]; 
        const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${host}:3001/api/v1/terminal?projectId=${project.id}&token=${token}`);
        wsRef.current = ws;
        ws.onopen = () => ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === 'output') term.write(m.data); };
        term.onData(data => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'input', data })));
        
        // Auto-copy terminal selection to clipboard
        term.onSelectionChange(() => {
            const selection = term.getSelection();
            if (selection) navigator.clipboard.writeText(selection).catch(()=>{});
        });

        return () => { if(ws.readyState === WebSocket.OPEN) ws.close(); term.dispose(); };
    }, [project?.id, token]);

    const closeFile = (e, path) => {
        e.stopPropagation();
        setOpenFiles(prev => prev.filter(f => f.path !== path));
        if (activeFile?.path === path) {
            const remaining = openFiles.filter(f => f.path !== path);
            setActiveFile(remaining.length ? remaining[remaining.length - 1] : null);
        }
    };

    const openModal = (type, node = null) => { setModal({ type, node }); setModalValue(type === 'rename' ? node?.name : ''); };
    const handleModalConfirm = async () => {
        const { type, node } = modal;
        const val = modalValue.trim();
        if (!val) return;
        setModal(null);
        try {
            const path = (node?.path || '').replace(/\/+$/, '');
            if (type === 'newFile') await api.createFile(path + '/' + val, project.id);
            else if (type === 'newFolder') await api.createFolder(path + '/' + val, project.id);
            else if (type === 'rename') await api.renameFile(node.path, node.path.substring(0, node.path.lastIndexOf('/')) + '/' + val, project.id);
            else if (type === 'gitClone') await api.gitClone(val, path, project.id);
            loadFsTree();
        } catch (e) { status(e.message, true); }
    };

    const confirmDelete = async () => {
        const node = deleteTarget; setDeleteTarget(null);
        try {
            await api.deleteFile(node.path, project.id);
            loadFsTree();
            setOpenFiles(prev => prev.filter(f => !f.path.startsWith(node.path)));
            if (activeFile?.path && activeFile.path.startsWith(node.path)) setActiveFile(null);
        } catch (e) { status('Delete failed', true); }
    };

    return (
        <div style={{ display: 'flex', flex: 1, width: '100%', background: '#0d0d0d', color: '#c9d1d9', overflow: 'hidden', flexDirection: 'column' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#010409', borderBottom: '1px solid #21262d', flexShrink: 0 }}>
                <button title="Dashboard" onClick={() => navigate('/')} style={iconBtn}><ArrowLeft size={16} /></button>
                <div style={{ width: 1, height: 20, background: '#30363d', margin: '0 8px' }} />
                <span style={{ fontWeight: 800, fontSize: 13, color: 'white', marginRight: 8 }}>{project?.title || 'IDE'}</span>
                <button title="Project Admin / Settings" onClick={() => setShowAdmin(true)} style={{ background: '#21262d', border: '1px solid #30363d', color: '#e6edf3', borderRadius: 4, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Settings size={12} color="#8b949e" /> ADMIN
                </button>
                <div style={{ width: 1, height: 20, background: '#30363d', margin: '0 8px' }} />
                
                <div style={{ display: 'flex', gap: 2 }}>
                    <button title="New File" onClick={() => openModal('newFile', { path: '/' })} style={iconBtn}><FilePlus size={16} /></button>
                    <button title="New Folder" onClick={() => openModal('newFolder', { path: '/' })} style={iconBtn}><FolderPlus size={16} /></button>
                    <button title="Import" onClick={() => { setImportTarget('/'); fileInputRef.current?.click(); }} style={iconBtn}><Upload size={16} /></button>
                </div>
                <div style={{ width: 1, height: 20, background: '#30363d', margin: '0 4px' }} />
                <div style={{ display: 'flex', gap: 2 }}>
                    <button title="Git Clone" onClick={() => openModal('gitClone', { path: '/' })} style={iconBtn}><GitBranchPlus size={16} /></button>
                    <button title="Git Push" onClick={handleGitPush} disabled={gitPushing} style={iconBtn}><GitCommitHorizontal size={16} /></button>
                    <button title="Initialize Local Sync" onClick={handleInitLocalSync} style={{ ...iconBtn, color: localSyncHandle ? '#3fb950' : '#8b949e' }}><HardDrive size={16} /></button>
                    <button title="ZIP" onClick={handleDownloadWorkspace} style={iconBtn}><Download size={16} /></button>
                </div>
                <div style={{ width: 1, height: 20, background: '#30363d', margin: '0 4px' }} />
                <button title="Save (Ctrl+S)" onClick={handleSave} disabled={isSaving || !activeFile || !dirtyFiles.has(activeFile.path)} style={{ ...iconBtn, color: activeFile && dirtyFiles.has(activeFile.path) ? '#58a6ff' : '#484f58' }}><Save size={16} /></button>
                
                <div style={{ flex: 1 }} />
                {statusMsg && <span style={{ fontSize: 11, color: statusErr ? '#f87171' : '#3fb950', marginRight: 12 }}>{statusMsg}</span>}
                <button onClick={handleRunCode} style={{ background: '#238636', color: 'white', border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>RUN</button>
            </div>

            <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ width: 44, borderRight: '1px solid #21262d', display: 'flex', flexDirection: 'column', padding: '12px 0', alignItems: 'center', background: '#010409' }}>
                    <div onClick={() => setActiveSidebarTab('explorer')} style={{ cursor: 'pointer', marginBottom: 20, padding: 8, borderLeft: activeSidebarTab === 'explorer' ? '2px solid #58a6ff' : 'none' }}>
                        <Files size={20} color={activeSidebarTab === 'explorer' ? '#e6edf3' : '#484f58'} />
                    </div>
                </div>

                {showSidebar && (
                    <div style={{ width: 260, borderRight: '1px solid #21262d', display: 'flex', flexDirection: 'column', background: '#010409' }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #21262d', fontSize: 10, fontWeight: 700, color: '#8b949e', display: 'flex', justifyContent: 'space-between' }}>
                            <span>EXPLORER</span>
                            <button onClick={loadFsTree} style={iconBtn}><RefreshCw size={10} /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {fsTree.map(node => (
                                <TreeNode key={node.path} node={node} depth={0} activeFile={activeFile} onOpen={handleOpenFile} onContextMenu={(e, n) => setCtxMenu({ x: e.clientX, y: e.clientY, node: n })} expandedDirs={expandedDirs} toggleDir={toggleDir} />
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ height: 35, display: 'flex', background: '#010409', borderBottom: '1px solid #21262d', overflowX: 'auto' }}>
                        <button onClick={() => setShowSidebar(!showSidebar)} style={{ ...iconBtn, padding: '0 10px' }}><PanelLeft size={16} /></button>
                        {openFiles.map(f => (
                            <div key={f.path} onClick={() => handleOpenFile(f)} style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', cursor: 'pointer', borderRight: '1px solid #21262d',
                                background: activeFile?.path === f.path ? '#0d0d0d' : 'transparent',
                                color: activeFile?.path === f.path ? '#e6edf3' : '#8b949e', fontSize: 12, minWidth: 80
                            }}>
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                <span onClick={e => closeFile(e, f.path)}>×</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ flex: 1, minHeight: 0 }}>
                        {activeFile ? (
                            <Editor path={activeFile.path} language={getLanguage(activeFile.name)} theme="vs-dark" value={fileContents[activeFile.path]} onChange={val => { setFileContents(prev => ({ ...prev, [activeFile.path]: val })); setDirtyFiles(prev => new Set(prev).add(activeFile.path)); }} options={{ fontSize: 14, minimap: { enabled: false } }} />
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#484f58' }}>Select a file.</div>
                        )}
                    </div>

                    {showTerm && (
                        <div style={{ height: termHeight, borderTop: '1px solid #21262d', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', padding: '4px 12px', background: '#010409', borderBottom: '1px solid #21262d', fontSize: 10, color: '#8b949e', justifyContent: 'space-between' }}>
                                <span>TERMINAL</span>
                                <button onClick={() => setShowTerm(false)} style={iconBtn}><X size={12} /></button>
                            </div>
                            <div style={{ flex: 1, padding: 8 }} ref={termRef} />
                        </div>
                    )}
                </div>

                {showChat && (
                    <div style={{ width: 340, borderLeft: '1px solid #21262d', display: 'flex', flexDirection: 'column', background: '#0d1117' }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid #21262d', background: '#010409', height: 44 }}>
                            <button onClick={() => setRightSidebarTab('mentor')} style={{ flex: 1, background: 'transparent', border: 'none', color: rightSidebarTab === 'mentor' ? '#e6edf3' : '#484f58' }}><MessageSquare size={18} /></button>
                            <button onClick={() => setRightSidebarTab('preview')} style={{ flex: 1, background: 'transparent', border: 'none', color: rightSidebarTab === 'preview' ? '#e6edf3' : '#484f58' }}><MonitorIcon size={18} /></button>
                            <button onClick={() => setRightSidebarTab('extensions')} style={{ flex: 1, background: 'transparent', border: 'none', color: rightSidebarTab === 'extensions' ? '#e6edf3' : '#484f58' }}><PuzzleIcon size={18} /></button>
                            <button onClick={() => setShowChat(false)} style={iconBtn}><X size={16} /></button>
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            {rightSidebarTab === 'mentor' && (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                                        {chatLog.map((m, i) => (
                                            <div key={i} style={{ marginBottom: 16 }}>
                                                <div style={{ fontSize: 9, fontWeight: 800, color: '#8b949e', marginBottom: 4 }}>{m.role === 'user' ? 'YOU' : 'AMIT-BODHIT'}</div>
                                                <div style={{ fontSize: 13, background: m.role === 'user' ? '#1f6feb' : '#21262d', padding: 10, borderRadius: 8 }}>
                                                    <MarkdownRenderer content={m.content} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ padding: 12, borderTop: '1px solid #30363d' }}>
                                        <textarea style={{ width: '100%', background: '#010409', color: 'white', borderRadius: 8, padding: 8, border: '1px solid #30363d' }} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} placeholder="Ask anything..." />
                                    </div>
                                </div>
                            )}
                            {rightSidebarTab === 'preview' && <WebPreview projectId={project?.id} initialUrl={previewSubpath} />}
                            {rightSidebarTab === 'extensions' && <ExtensionHub currentStack={project?.tech_stack} onToggleExtension={loadFsTree} />}
                        </div>
                    </div>
                )}
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
            {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} node={ctxMenu.node} onClose={() => setCtxMenu(null)} onNewFile={n => openModal('newFile', n)} onNewFolder={n => openModal('newFolder', n)} onRename={n => openModal('rename', n)} onDelete={setDeleteTarget} onPreview={p => { setPreviewSubpath(p); setRightSidebarTab('preview'); if (!showChat) setShowChat(true); }} setImportTarget={setImportTarget} />}
            {modal?.type === 'newFile' && <Modal title="New File" value={modalValue} onChange={setModalValue} onConfirm={handleModalConfirm} onCancel={() => setModal(null)} />}
            {modal?.type === 'newFolder' && <Modal title="New Folder" value={modalValue} onChange={setModalValue} onConfirm={handleModalConfirm} onCancel={() => setModal(null)} />}
            {modal?.type === 'rename' && <Modal title="Rename" value={modalValue} onChange={setModalValue} onConfirm={handleModalConfirm} onCancel={() => setModal(null)} />}
            {modal?.type === 'gitClone' && <Modal title="Git Clone" placeholder="Repository URL" value={modalValue} onChange={setModalValue} onConfirm={handleModalConfirm} onCancel={() => setModal(null)} />}
            {deleteTarget && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#161b22', padding: 24, borderRadius: 12, border: '1px solid #f85149' }}>
                        <div style={{ marginBottom: 16 }}>Delete "{deleteTarget.name}"? This action is permanent.</div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setDeleteTarget(null)} style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', padding: '8px 16px', borderRadius: 6 }}>Cancel</button>
                            <button onClick={confirmDelete} style={{ background: '#f85149', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6 }}>Delete Anyway</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showAdmin && <ProjectAdminModal project={project} onClose={() => setShowAdmin(false)} onUpdate={() => { status('Project settings updated.'); setShowAdmin(false); window.location.reload(); }} />}
        </div>
    );
}
