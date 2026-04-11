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

// FileSystem Handle Persistence via IndexedDB
const idbSetHandle = async (handle) => {
    return new Promise((resolve) => {
        const req = indexedDB.open('AmitBodhitIDE', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('handles');
        req.onsuccess = () => {
            try {
                const tx = req.result.transaction('handles', 'readwrite');
                tx.objectStore('handles').put(handle, 'localSyncHandle');
                tx.oncomplete = () => resolve();
            } catch (e) { resolve(); }
        };
    });
};
const idbGetHandle = async () => {
    return new Promise((resolve) => {
        const req = indexedDB.open('AmitBodhitIDE', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('handles');
        req.onsuccess = () => {
            try {
                if (!req.result.objectStoreNames.contains('handles')) return resolve(null);
                const tx = req.result.transaction('handles', 'readonly');
                const getReq = tx.objectStore('handles').get('localSyncHandle');
                getReq.onsuccess = () => resolve(getReq.result || null);
            } catch (e) { resolve(null); }
        };
    });
};
const verifyHandlePermission = async (handle) => {
    if (!handle) return false;
    const opts = { mode: 'readwrite' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if ((await handle.requestPermission(opts)) === 'granted') return true;
    return false;
};

// ─── CONTEXT MENU ─────────────────────────────────────────────────────────────
function ContextMenu({ x, y, node, onClose, onNewFile, onNewFolder, onRename, onDelete, onPreview, setImportTarget, onRunDir, onAskAI, projectId }) {
    const isDir = checkIsDir(node);
    const isHtml = node?.name?.toLowerCase()?.endsWith('.html');
    const ref = useRef(null);
    const [showRunSub, setShowRunSub] = useState(false);
    const [detectedCmds, setDetectedCmds] = useState(null);
    const [detecting, setDetecting] = useState(false);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    // Fetch smart commands when sub-menu opens
    useEffect(() => {
        if (showRunSub && isDir && !detectedCmds && projectId) {
            setDetecting(true);
            api.detectCommands(projectId, node.path)
                .then(data => { setDetectedCmds(data); setDetecting(false); })
                .catch(() => { setDetectedCmds({ commands: [], detectedStack: [] }); setDetecting(false); });
        }
    }, [showRunSub, isDir, node?.path, projectId]);

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

    const cmdIcons = {
        'npm run dev': <Zap size={12} color="#3fb950" />,
        'npm start': <PlayCircle size={12} color="#58a6ff" />,
        'npm install': <Download size={12} color="#e6a700" />,
        'npm test': <Target size={12} color="#a371f7" />,
        'npm run build': <Square size={12} color="#f0883e" />,
    };
    const defaultIcon = <Play size={12} color="#8b949e" />;

    return (
        <div ref={ref} style={{ position: 'fixed', top: y, left: x, zIndex: 1000, background: '#161b22', border: '1px solid #30363d', borderRadius: 6, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'visible' }}>
            {isDir && item(<FilePlus size={13} />, 'New File', () => onNewFile(node))}
            {isDir && item(<FolderPlus size={13} />, 'New Folder', () => onNewFolder(node))}
            {isDir && item(<FolderOpen size={13} />, 'Import File', () => { setImportTarget(node.path); document.getElementById('hidden-file-input')?.click(); })}
            {isDir && item(<Upload size={13} />, 'Import Folder', () => { setImportTarget(node.path); document.getElementById('hidden-folder-input')?.click(); })}
            {isDir && (
                <div style={{ position: 'relative' }}
                    onMouseEnter={() => setShowRunSub(true)}
                    onMouseLeave={() => setShowRunSub(false)}
                >
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
                        cursor: 'pointer', fontSize: 12, color: '#3fb950',
                        justifyContent: 'space-between', transition: 'background 0.1s'
                    }}
                        onMouseEnter={e => e.currentTarget.style.background = '#21262d'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TerminalSquare size={13} />
                            Run in Terminal
                        </span>
                        <ChevronRight size={12} />
                    </div>
                    {showRunSub && (
                        <div style={{
                            position: 'absolute', left: '100%', top: -1, background: '#161b22',
                            border: '1px solid #30363d', borderRadius: 6, minWidth: 240, maxWidth: 320,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 1001
                        }}>
                            {/* Header */}
                            <div style={{ padding: '8px 12px', fontSize: 9, fontWeight: 800, color: '#484f58', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>RUN IN: {node.name}/</span>
                                {detectedCmds?.detectedStack?.length > 0 && (
                                    <span style={{ fontSize: 8, color: '#58a6ff', background: 'rgba(88,166,255,0.1)', padding: '1px 6px', borderRadius: 4 }}>
                                        {detectedCmds.detectedStack.join(' + ')}
                                    </span>
                                )}
                            </div>

                            {/* Loading state */}
                            {detecting && (
                                <div style={{ padding: '14px', textAlign: 'center', color: '#484f58', fontSize: 11 }}>
                                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: 6 }} />
                                    Scanning folder...
                                </div>
                            )}

                            {/* Detected commands */}
                            {!detecting && detectedCmds?.commands?.length > 0 && detectedCmds.commands.map((rc, idx) => (
                                <div key={rc.cmd + idx}
                                    onClick={() => { onRunDir(node.path, rc.cmd); onClose(); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
                                        cursor: 'pointer', fontSize: 12, color: '#c9d1d9', transition: 'background 0.1s',
                                        justifyContent: 'space-between'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#21262d'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {cmdIcons[rc.cmd] || defaultIcon}
                                        <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{rc.label}</span>
                                    </span>
                                    {rc.tag && (
                                        <span style={{ fontSize: 8, color: rc.tag.includes('⚠') ? '#e6a700' : '#484f58', background: rc.tag.includes('⚠') ? 'rgba(230,167,0,0.12)' : '#21262d', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
                                            {rc.tag}
                                        </span>
                                    )}
                                </div>
                            ))}

                            {/* Empty state — no commands found */}
                            {!detecting && detectedCmds && detectedCmds.commands?.length === 0 && (
                                <div style={{ padding: '12px 14px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 11, color: '#484f58', marginBottom: 6 }}>No known project files detected.</div>
                                    <div style={{ fontSize: 10, color: '#30363d' }}>Try "Ask AI" or "Custom Command"</div>
                                </div>
                            )}

                            <div style={{ borderTop: '1px solid #21262d', margin: '2px 0' }} />

                            {/* Ask AI button */}
                            <div
                                onClick={() => { onAskAI(node.path, node.name, detectedCmds?.detectedStack || []); onClose(); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
                                    cursor: 'pointer', fontSize: 12, color: '#a371f7', transition: 'background 0.1s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#21262d'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <MessageSquare size={12} />
                                Ask AI what to run
                            </div>

                            {/* Custom command */}
                            <div
                                onClick={() => { onRunDir(node.path, null); onClose(); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
                                    cursor: 'pointer', fontSize: 12, color: '#58a6ff', transition: 'background 0.1s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#21262d'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <Pencil size={12} />
                                Custom Command...
                            </div>
                        </div>
                    )}
                </div>
            )}
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
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
    const [showSyncPrompt, setShowSyncPrompt] = useState(false);
    const [localSyncAbsPath, setLocalSyncAbsPath] = useState(localStorage.getItem('localSyncAbsPath') || '');
    const [pendingSyncFile, setPendingSyncFile] = useState(null);
    const [showSyncDropdown, setShowSyncDropdown] = useState(false);
    const [localSyncPath, setLocalSyncPath] = useState(null);

    // Layout Dimensions State
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [chatWidth, setChatWidth] = useState(340);
    const [termHeight, setTermHeight] = useState(240);

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
    const [showAdmin, setShowAdmin] = useState(false);

    // Global Store
    const { project, currentTask, chatLog, addChatMessage, token, setAuth } = useStore();
    const [chatMode, setChatMode] = useState('AI'); // AI or HUMAN
    const [mentorChatLog, setMentorChatLog] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isAsking, setIsAsking] = useState(false);
    const [intelligenceData, setIntelligenceData] = useState(null);
    const [loadingIntel, setLoadingIntel] = useState(false);

    // Learning & Sync Ref
    const behaviorMetrics = useRef({ pasteSize: 0, typingSpeed: 0, keystrokeCount: 0, sessionStart: Date.now() });
    const [gitPushing, setGitPushing] = useState(false);
    const [localSyncHandle, setLocalSyncHandle] = useState(null);
    const syncDropdownRef = useRef(null);

    // Refs
    const termRef = useRef(null);
    const wsRef = useRef(null);
    const termObjRef = useRef(null);
    const fitAddonRef = useRef(null);
    const isResizing = useRef(null);
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    const status = (msg, err = false) => {
        setStatusMsg(msg); setStatusErr(err);
        setTimeout(() => setStatusMsg(''), 3000);
    };

    const reconcileLocalChanges = useCallback(async () => {
        if (!localSyncHandle || !fsTree.length || !autoSyncEnabled) return;
        
        // Ensure we have permission
        const opts = { mode: 'readwrite' };
        if ((await localSyncHandle.queryPermission(opts)) !== 'granted') return;

        let deletedCount = 0;
        const checkNode = async (nodes, dirHandle) => {
            for (const node of nodes) {
                try {
                    const name = node.name;
                    if (node.children) {
                        const sub = await dirHandle.getDirectoryHandle(name);
                        await checkNode(node.children, sub);
                    } else {
                        await dirHandle.getFileHandle(name);
                    }
                } catch (e) {
                    if (e.name === 'NotFoundError') {
                        await api.deleteFile(node.path, project.id);
                        deletedCount++;
                    }
                }
            }
        };

        try {
            await checkNode(fsTree, localSyncHandle);
            if (deletedCount > 0) {
                status(`Local deletion detected. Synced ${deletedCount} item(s) to cloud.`);
                // We don't call loadFsTree() here to avoid infinite loops, but we trust the backend deletion will refresh correctly next time
            }
        } catch (e) {}
    }, [localSyncHandle, fsTree, autoSyncEnabled, project?.id]);

    const loadFsTree = useCallback(async () => {
        if (!project?.id) return;
        try {
            const res = await api.getFsTree(project.id);
            setFsTree(res.tree || []);
            // Run reconciliation when user manually refreshes
            reconcileLocalChanges(); 

            // Also load intelligence data
            setLoadingIntel(true);
            const intelRes = await api.getCurrentTask(project.id, currentTask?.id);
            setIntelligenceData(intelRes.intelligence);
            
            // Sync mentor state
            if (intelRes.active_mentor_id && project.active_mentor_id !== intelRes.active_mentor_id) {
                setAuth({ project: { ...project, active_mentor_id: intelRes.active_mentor_id } });
                status('Human Mentor is now online!', false);
            }
            
            setLoadingIntel(false);
        } catch (e) { 
            status('Sync Error: ' + e.message, true);
            setLoadingIntel(false);
        }
    }, [project?.id, currentTask?.id, reconcileLocalChanges, setAuth, project]);

    const loadMentorChat = useCallback(async () => {
        if (!project?.id) return;
        try {
            const history = await api.req('GET', `/projects/${project.id}/chat`);
            setMentorChatLog(history.map(m => ({
                role: m.role,
                content: m.content,
                userName: m.role === 'mentor' ? m.userName : 'YOU'
            })));
        } catch(e) {}
    }, [project?.id]);

    useEffect(() => {
        if (rightSidebarTab === 'mentor' && chatMode === 'HUMAN' && project?.active_mentor_id) {
            loadMentorChat();
            const interval = setInterval(loadMentorChat, 4000);
            return () => clearInterval(interval);
        }
    }, [rightSidebarTab, chatMode, project?.active_mentor_id, loadMentorChat]);

    // Background sync checker for deletions (every 15 seconds)
    useEffect(() => {
        const timer = setInterval(() => {
            if (autoSyncEnabled && localSyncHandle) reconcileLocalChanges();
        }, 15000);
        return () => clearInterval(timer);
    }, [autoSyncEnabled, localSyncHandle, reconcileLocalChanges]);

    useEffect(() => { loadFsTree(); }, [loadFsTree]);

    // Auto-revive local sync handle from IndexedDB
    useEffect(() => {
        const revive = async () => {
            try {
                const handle = await idbGetHandle();
                if (handle) {
                    const opts = { mode: 'readwrite' };
                    if (await handle.queryPermission(opts) === 'granted') {
                        setLocalSyncHandle(handle);
                        setLocalSyncPath(handle.name);
                        setAutoSyncEnabled(true);
                    }
                }
            } catch (e) { console.error('[IDB] Revive failed', e); }
        };
        revive();
    }, []);

    // Resizing Logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing.current) return;
            if (isResizing.current === 'sidebar') {
                const newWidth = Math.max(150, Math.min(e.clientX - 44, window.innerWidth - 300));
                setSidebarWidth(newWidth);
            } else if (isResizing.current === 'chat') {
                const newWidth = Math.max(200, Math.min(window.innerWidth - e.clientX, window.innerWidth - 300));
                setChatWidth(newWidth);
            } else if (isResizing.current === 'term') {
                const newHeight = Math.max(100, Math.min(window.innerHeight - e.clientY - 20, window.innerHeight - 200));
                setTermHeight(newHeight);
            }
        };
        const handleMouseUp = () => {
            if (isResizing.current) {
                isResizing.current = null;
                document.body.style.cursor = 'default';
                if (fitAddonRef.current) fitAddonRef.current.fit();
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

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

    const writeToLocalDir = async (dirHandle, filePath, content) => {
        try {
            const parts = filePath.split('/').filter(p => p);
            let current = dirHandle;
            for (let i = 0; i < parts.length - 1; i++) {
                current = await current.getDirectoryHandle(parts[i], { create: true });
            }
            const fileHandle = await current.getFileHandle(parts[parts.length - 1], { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            return true;
        } catch (err) {
            console.error('[Sync] Error', err);
            return false;
        }
    };

    const promptAndSyncToLocal = async (filePath, content) => {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
            setLocalSyncHandle(handle);
            setLocalSyncPath(handle.name);
            const ok = await writeToLocalDir(handle, filePath, content);
            if (ok) {
                status('Synced to local: ' + filePath.split('/').pop());
            } else {
                status('Local sync write failed', true);
            }
        } catch (err) {
            if (err.name !== 'AbortError') status('Local sync cancelled', true);
        }
    };

    const handleSave = useCallback(async () => {
        const fileToSave = activeFile;
        const content = fileContents[fileToSave?.path];
        if (!fileToSave || content === undefined || !project?.id) return;
        setIsSaving(true);
        try {
            await api.saveFile(fileToSave.path, content, project.id);
            setDirtyFiles(prev => { const n = new Set(prev); n.delete(fileToSave.path); return n; });
            status('Saved ' + fileToSave.name);

            // Save to local path if enabled
            if (autoSyncEnabled) {
                let activeHandle = localSyncHandle;
                
                // Try recovering handle from IndexedDB if we don't have it in memory
                if (!activeHandle) {
                    const storedHandle = await idbGetHandle();
                    if (storedHandle && await verifyHandlePermission(storedHandle)) {
                        activeHandle = storedHandle;
                        setLocalSyncHandle(storedHandle);
                    }
                }

                if (activeHandle) {
                    await writeToLocalDir(activeHandle, fileToSave.path, content);
                    status('Saved & Synced ' + fileToSave.name);
                } else {
                    setPendingSyncFile({ path: fileToSave.path, content });
                    setShowSyncPrompt(true);
                }
            }
        } catch (e) { status('Save failed', true); }
        setIsSaving(false);
    }, [activeFile, fileContents, dirtyFiles, project?.id, autoSyncEnabled, localSyncHandle]);

    const handleSyncPromptConfirm = async () => {
        setShowSyncPrompt(false);
        if (pendingSyncFile) {
            try {
                const handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
                setLocalSyncHandle(handle);
                await idbSetHandle(handle);
                setLocalSyncPath(handle.name);
                setAutoSyncEnabled(true);
                await writeToLocalDir(handle, pendingSyncFile.path, pendingSyncFile.content);
                status('Saved & Synced ' + pendingSyncFile.path.split('/').pop());
            } catch (err) {
                if (err.name !== 'AbortError') status('Local sync cancelled', true);
            }
            setPendingSyncFile(null);
        }
    };

    const handleSyncPromptSkip = () => {
        setShowSyncPrompt(false);
        setPendingSyncFile(null);
    };

    const handleToggleSync = () => {
        setAutoSyncEnabled(prev => !prev);
    };

    const handleAbsPathChange = (val) => {
        setLocalSyncAbsPath(val);
        localStorage.setItem('localSyncAbsPath', val);
    };

    const handleSyncTerminalPath = () => {
        if (localSyncAbsPath && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'input', data: `\rcd "${localSyncAbsPath}"\r` }));
            setShowTerm(true);
        }
    };

    const handleChangeSyncFolder = async () => {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
            setLocalSyncHandle(handle);
            await idbSetHandle(handle);
            setLocalSyncPath(handle.name);
            setAutoSyncEnabled(true);
            status('Sync folder set: ' + handle.name);
            setShowSyncDropdown(false);
        } catch (err) {
            if (err.name !== 'AbortError') status('Folder selection cancelled', true);
        }
    };

    const syncAllWorkspaceToLocal = async () => {
        let activeHandle = localSyncHandle;
        
        // Recover from IDB if memory is lost
        if (!activeHandle) {
            const storedHandle = await idbGetHandle();
            if (storedHandle && await verifyHandlePermission(storedHandle)) {
                activeHandle = storedHandle;
                setLocalSyncHandle(storedHandle);
            }
        }

        if (!activeHandle) {
            status('Please change folder to grant access first.', true);
            return;
        }
        status('Syncing entire workspace...');
        try {
            const filesToSync = [];
            const traverseTree = (nodes, pathPrefix = '') => {
                for (const node of nodes) {
                    if (node.children) traverseTree(node.children, pathPrefix + node.name + '/');
                    else filesToSync.push({ path: pathPrefix + node.name });
                }
            };
            traverseTree(fsTree);
            
            for (const file of filesToSync) {
                const res = await api.getFile(file.path, project.id);
                if (res?.content !== undefined) {
                    await writeToLocalDir(localSyncHandle, file.path, res.content);
                }
            }
            status(`Synced ${filesToSync.length} files successfully!`);
            setShowSyncDropdown(false);
        } catch (e) {
            status('Bulk sync failed: ' + e.message, true);
        }
    };

    // Close sync dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (syncDropdownRef.current && !syncDropdownRef.current.contains(e.target)) {
                setShowSyncDropdown(false);
            }
        };
        if (showSyncDropdown) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showSyncDropdown]);

    const handleRunCode = async () => {
        if (!project?.id) return;
        try {
            // Auto-save ALL dirty files before running so terminal gets latest content
            const dirtyPaths = Array.from(dirtyFiles);
            if (dirtyPaths.length > 0) {
                status('Auto-saving before run...');
                for (const dp of dirtyPaths) {
                    const content = fileContents[dp];
                    if (content !== undefined) {
                        await api.saveFile(dp, content, project.id);
                    }
                }
                setDirtyFiles(new Set());
            }

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
                // Send cd and command as separate inputs (PowerShell doesn't support &&)
                if (res.cdPath) {
                    wsRef.current.send(JSON.stringify({ type: 'input', data: `\rcd ${res.cdPath}\r` }));
                    setTimeout(() => {
                        wsRef.current.send(JSON.stringify({ type: 'input', data: `${res.runCmd}\r` }));
                    }, 300);
                } else {
                    wsRef.current.send(JSON.stringify({ type: 'input', data: `\r${res.runCmd}\r` }));
                }
                status(`Running...`);
                if (!showTerm) setShowTerm(true);
            }
        } catch (err) { status('Run failed', true); }
    };

    const handleRunInDir = (dirPath, command) => {
        if (command === null) {
            // Open custom command modal
            setModal({ type: 'runCustomCmd', node: { path: dirPath } });
            setModalValue('');
            return;
        }
        const folderName = dirPath.replace(/^\/+/, '').replace(/\/+$/, '');
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            // Send cd and command as separate inputs (PowerShell doesn't support &&)
            if (folderName) {
                wsRef.current.send(JSON.stringify({ type: 'input', data: `\rcd ${folderName}\r` }));
                setTimeout(() => {
                    wsRef.current.send(JSON.stringify({ type: 'input', data: `${command}\r` }));
                }, 300);
            } else {
                wsRef.current.send(JSON.stringify({ type: 'input', data: `\r${command}\r` }));
            }
            status(`Running: ${command} in ${folderName || '/'}`); 
            if (!showTerm) setShowTerm(true);
        } else {
            status('Terminal not connected', true);
        }
    };

    const handleAskAIRun = async (dirPath, folderName, detectedStack) => {
        const stackHint = detectedStack.length > 0 ? ` (detected: ${detectedStack.join(', ')})` : '';
        const question = `I right-clicked the folder "${folderName}/"${stackHint}. What terminal command should I run to start or run this project folder? Give me the exact command.`;
        setChatInput(question);
        setRightSidebarTab('mentor');
        if (!showChat) setShowChat(true);
        // Auto-send the question
        addChatMessage({ role: 'user', content: question });
        setIsAsking(true);
        try {
            const content = activeFile ? fileContents[activeFile.path] : null;
            const res = await api.askProjectQuestion(project.id, question, content, activeFile?.path);
            addChatMessage({ role: 'mentor', content: res.message });
        } catch (e) {
            addChatMessage({ role: 'system', content: 'Failed to get AI suggestion. Try "Custom Command" instead.' });
        }
        setIsAsking(false);
        setChatInput('');
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

    const handleRequestSOS = async (targetMentorId = null) => {
        if (!project?.id) return;
        try {
            // Enhanced with target mentor support
            const res = await api.req('POST', '/task/help', { projectId: project.id, targetMentorId });
            status(res.message);
        } catch (e) {
            status(e.message, true);
        }
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

        if (chatMode === 'HUMAN') {
            const msg = chatInput; setChatInput('');
            try {
                await api.req('POST', `/projects/${project.id}/chat`, { message: msg });
                loadMentorChat();
            } catch(e) { status('Mentor Chat Error', true); }
            return;
        }

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
        } catch (e) {
            addChatMessage({ role: 'system', content: `Chat Error: ${e.message || 'Failed to connect'}` });
        }
        setIsAsking(false);
    };

    useEffect(() => {
        const term = new Terminal({ theme: { background: '#0a0a0a' }, fontSize: 13, cursorBlink: true });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon); term.open(termRef.current); fitAddon.fit();
        termObjRef.current = term;
        fitAddonRef.current = fitAddon;
        if (!project?.id || !token) return;
        const host = window.location.host.split(':')[0]; 
        const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${host}:3001/api/v1/terminal?projectId=${project.id}&token=${token}`);
        wsRef.current = ws;
        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
            if (localSyncAbsPath) {
                setTimeout(() => {
                    ws.send(JSON.stringify({ type: 'input', data: `\rcd "${localSyncAbsPath}"\r` }));
                }, 500); // slight delay to allow shell to load
            }
        };
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
            else if (type === 'runCustomCmd') {
                handleRunInDir(node.path, val);
                return;
            }
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
                    <div ref={syncDropdownRef} style={{ position: 'relative' }}>
                        <button title="Local Auto-Save" onClick={() => setShowSyncDropdown(prev => !prev)} style={{ ...iconBtn, color: autoSyncEnabled ? '#3fb950' : '#8b949e', position: 'relative' }}>
                            <HardDrive size={16} />
                            {autoSyncEnabled && <span style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: '#3fb950', border: '1.5px solid #010409' }} />}
                        </button>
                        {showSyncDropdown && (
                            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, zIndex: 5000, background: '#161b22', border: '1px solid #30363d', borderRadius: 10, minWidth: 280, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
                                {/* Arrow */}
                                <div style={{ position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 10, height: 10, background: '#161b22', borderTop: '1px solid #30363d', borderLeft: '1px solid #30363d' }} />
                                {/* Header */}
                                <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #21262d' }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: '#e6edf3', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <HardDrive size={14} color="#58a6ff" />
                                        Local Auto-Save
                                    </div>
                                </div>
                                {/* Status */}
                                <div style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <span style={{ fontSize: 11, color: '#8b949e' }}>Status</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: autoSyncEnabled ? '#3fb950' : '#f87171', background: autoSyncEnabled ? 'rgba(63,185,80,0.12)' : 'rgba(248,113,113,0.12)', padding: '2px 10px', borderRadius: 20 }}>
                                            {autoSyncEnabled ? '● ON' : '○ OFF'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Active path</div>
                                    <div style={{ fontSize: 12, color: (localSyncAbsPath || localSyncPath) ? '#e6edf3' : '#484f58', background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: '8px 10px', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.5, marginBottom: 12 }}>
                                        {(localSyncAbsPath || localSyncPath)
                                            ? <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}><FolderOpen size={13} color="#e6a700" style={{ flexShrink: 0, marginTop: 2 }} /> <span>{localSyncAbsPath || localSyncPath}</span></span>
                                            : <span style={{ fontStyle: 'italic' }}>No folder selected yet</span>
                                        }
                                    </div>
                                    
                                    <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Terminal Path (Absolute)</span>
                                    </div>
                                    <input 
                                        type="text" 
                                        value={localSyncAbsPath} 
                                        onChange={e => handleAbsPathChange(e.target.value)} 
                                        onBlur={handleSyncTerminalPath}
                                        onKeyDown={e => e.key === 'Enter' && handleSyncTerminalPath()}
                                        placeholder="e.g. C:\Users\Dev\Project"
                                        style={{ width: '100%', boxSizing: 'border-box', background: '#010409', border: '1px solid #30363d', borderRadius: 6, padding: '6px 8px', color: '#e6edf3', fontSize: 11, fontFamily: 'monospace' }}
                                    />
                                    <div style={{ fontSize: 9, color: '#484f58', marginTop: 6 }}>
                                        Paste the full path here so the terminal can automatically navigate to it.
                                    </div>
                                </div>
                                {/* Actions */}
                                <div style={{ padding: '8px 16px 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button onClick={handleToggleSync} style={{ flex: 1, background: autoSyncEnabled ? 'rgba(248,113,113,0.1)' : 'rgba(63,185,80,0.1)', border: '1px solid ' + (autoSyncEnabled ? '#f87171' : '#3fb950'), color: autoSyncEnabled ? '#f87171' : '#3fb950', borderRadius: 6, padding: '7px 0', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = autoSyncEnabled ? 'rgba(248,113,113,0.2)' : 'rgba(63,185,80,0.2)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = autoSyncEnabled ? 'rgba(248,113,113,0.1)' : 'rgba(63,185,80,0.1)'; }}
                                    >{autoSyncEnabled ? 'Disable' : 'Enable'}</button>
                                    <button onClick={handleChangeSyncFolder} style={{ flex: 1, background: 'rgba(88,166,255,0.1)', border: '1px solid #58a6ff', color: '#58a6ff', borderRadius: 6, padding: '7px 0', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(88,166,255,0.2)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(88,166,255,0.1)'}
                                    ><FolderOpen size={12} /> Change</button>
                                    <button onClick={syncAllWorkspaceToLocal} style={{ flex: '1 0 100%', background: 'rgba(230,167,0,0.1)', border: '1px solid #e6a700', color: '#e6a700', borderRadius: 6, padding: '7px 0', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4 }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(230,167,0,0.2)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(230,167,0,0.1)'}
                                    ><RefreshCw size={12} /> Sync Entire Workspace Now</button>
                                </div>
                            </div>
                        )}
                    </div>
                    <button title="ZIP" onClick={handleDownloadWorkspace} style={iconBtn}><Download size={16} /></button>
                </div>
                <div style={{ width: 1, height: 20, background: '#30363d', margin: '0 4px' }} />
                <button title="Save (Ctrl+S)" onClick={handleSave} disabled={isSaving || !activeFile} style={{ ...iconBtn, color: activeFile ? (dirtyFiles.has(activeFile.path) ? '#58a6ff' : '#8b949e') : '#484f58' }}><Save size={16} /></button>
                
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
                    <>
                    <div style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column', background: '#010409' }}>
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
                    <div 
                        onMouseDown={() => { isResizing.current = 'sidebar'; document.body.style.cursor = 'col-resize'; }}
                        style={{ width: 4, cursor: 'col-resize', background: '#21262d', transition: 'background 0.2s', zIndex: 10 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#58a6ff'}
                        onMouseLeave={e => e.currentTarget.style.background = '#21262d'}
                    />
                    </>
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
                        <>
                        <div 
                            onMouseDown={() => { isResizing.current = 'term'; document.body.style.cursor = 'row-resize'; }}
                            style={{ height: 4, cursor: 'row-resize', background: '#21262d', transition: 'background 0.2s', zIndex: 10 }}
                            onMouseEnter={e => e.currentTarget.style.background = '#58a6ff'}
                            onMouseLeave={e => e.currentTarget.style.background = '#21262d'}
                        />
                        <div style={{ height: termHeight, background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', padding: '4px 12px', background: '#010409', borderBottom: '1px solid #21262d', fontSize: 10, color: '#8b949e', justifyContent: 'space-between' }}>
                                <span>TERMINAL</span>
                                <button onClick={() => setShowTerm(false)} style={iconBtn}><X size={12} /></button>
                            </div>
                            <div style={{ flex: 1, padding: 8 }} ref={termRef} />
                        </div>
                        </>
                    )}
                </div>

                {showChat && (
                    <>
                    <div 
                        onMouseDown={() => { isResizing.current = 'chat'; document.body.style.cursor = 'col-resize'; }}
                        style={{ width: 4, cursor: 'col-resize', background: '#21262d', transition: 'background 0.2s', zIndex: 10 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#58a6ff'}
                        onMouseLeave={e => e.currentTarget.style.background = '#21262d'}
                    />
                    <div style={{ width: chatWidth, display: 'flex', flexDirection: 'column', background: '#0d1117' }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid #21262d', background: '#010409', height: 44 }}>
                            <button onClick={() => setRightSidebarTab('mentor')} style={{ flex: 1, background: 'transparent', border: 'none', color: rightSidebarTab === 'mentor' ? '#e6edf3' : '#484f58' }}><MessageSquare size={18} /></button>
                            <button onClick={() => setRightSidebarTab('intelligence')} style={{ flex: 1, background: 'transparent', border: 'none', color: rightSidebarTab === 'intelligence' ? '#e6edf3' : '#484f58' }}><BrainCircuit size={18} /></button>
                            <button onClick={() => setRightSidebarTab('preview')} style={{ flex: 1, background: 'transparent', border: 'none', color: rightSidebarTab === 'preview' ? '#e6edf3' : '#484f58' }}><MonitorIcon size={18} /></button>
                            <button onClick={() => setRightSidebarTab('extensions')} style={{ flex: 1, background: 'transparent', border: 'none', color: rightSidebarTab === 'extensions' ? '#e6edf3' : '#484f58' }}><PuzzleIcon size={18} /></button>
                            <button onClick={() => setShowChat(false)} style={iconBtn}><X size={16} /></button>
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            {rightSidebarTab === 'mentor' && (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    {project?.active_mentor_id && (
                                        <div style={{ display: 'flex', borderBottom: '1px solid #30363d', background: '#010409' }}>
                                            <button 
                                                onClick={() => setChatMode('AI')} 
                                                style={{ flex: 1, padding: '8px', background: chatMode === 'AI' ? '#161b22' : 'transparent', color: chatMode === 'AI' ? '#58a6ff' : '#8b949e', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                            > AI ASSISTANT </button>
                                            <button 
                                                onClick={() => setChatMode('HUMAN')} 
                                                style={{ flex: 1, padding: '8px', background: chatMode === 'HUMAN' ? '#161b22' : 'transparent', color: chatMode === 'HUMAN' ? '#58a6ff' : '#8b949e', border: 'none', borderLeft: '1px solid #30363d', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                            > HUMAN MENTOR </button>
                                        </div>
                                    )}
                                    <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                                        {((chatMode === 'AI') ? chatLog : mentorChatLog).map((m, i) => (
                                            <div key={i} style={{ marginBottom: 16 }}>
                                                <div style={{ fontSize: 9, fontWeight: 800, color: '#8b949e', marginBottom: 4 }}>
                                                    {m.role === 'user' ? 'YOU' : (chatMode === 'AI' ? 'AMIT-BODHIT' : (m.userName || 'MENTOR'))}
                                                </div>
                                                <div style={{ fontSize: 13, background: m.role === 'user' ? '#1f6feb' : '#21262d', padding: 10, borderRadius: 8 }}>
                                                    <MarkdownRenderer content={m.content} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ padding: 12, borderTop: '1px solid #30363d' }}>
                                        <textarea style={{ width: '100%', background: '#010409', color: 'white', borderRadius: 8, padding: 8, border: '1px solid #30363d', resize: 'none' }} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleChat())} placeholder={chatMode === 'AI' ? "Ask AI..." : "Message Mentor..."} />
                                    </div>
                                </div>
                            )}
                            {rightSidebarTab === 'intelligence' && (
                                <ProgressPanel 
                                    data={intelligenceData} 
                                    loading={loadingIntel} 
                                    onToggleSOS={handleRequestSOS} 
                                />
                            )}
                            {rightSidebarTab === 'preview' && <WebPreview projectId={project?.id} initialUrl={previewSubpath} />}
                            {rightSidebarTab === 'extensions' && <ExtensionHub currentStack={project?.tech_stack} onToggleExtension={loadFsTree} />}
                        </div>
                    </div>
                    </>
                )}
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
            {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} node={ctxMenu.node} projectId={project?.id} onClose={() => setCtxMenu(null)} onNewFile={n => openModal('newFile', n)} onNewFolder={n => openModal('newFolder', n)} onRename={n => openModal('rename', n)} onDelete={setDeleteTarget} onPreview={p => { setPreviewSubpath(p); setRightSidebarTab('preview'); if (!showChat) setShowChat(true); }} setImportTarget={setImportTarget} onRunDir={handleRunInDir} onAskAI={handleAskAIRun} />}
            {modal?.type === 'newFile' && <Modal title="New File" value={modalValue} onChange={setModalValue} onConfirm={handleModalConfirm} onCancel={() => setModal(null)} />}
            {modal?.type === 'newFolder' && <Modal title="New Folder" value={modalValue} onChange={setModalValue} onConfirm={handleModalConfirm} onCancel={() => setModal(null)} />}
            {modal?.type === 'rename' && <Modal title="Rename" value={modalValue} onChange={setModalValue} onConfirm={handleModalConfirm} onCancel={() => setModal(null)} />}
            {modal?.type === 'gitClone' && <Modal title="Git Clone" placeholder="Repository URL" value={modalValue} onChange={setModalValue} onConfirm={handleModalConfirm} onCancel={() => setModal(null)} />}
            {modal?.type === 'runCustomCmd' && <Modal title={`Run in ${modal.node?.path || '/'}`} placeholder="e.g. npm run dev" value={modalValue} onChange={setModalValue} onConfirm={handleModalConfirm} onCancel={() => setModal(null)} confirmLabel="Run" />}
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

            {/* Local Sync Prompt Modal — asks user to pick folder every time */}
            {showSyncPrompt && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 28, minWidth: 420, maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <HardDrive size={22} color="#58a6ff" />
                            <span style={{ fontSize: 16, fontWeight: 800, color: '#e6edf3' }}>Save to Local Storage</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 8, lineHeight: 1.6 }}>
                            Your file <strong style={{ color: '#e6edf3' }}>{pendingSyncFile?.path?.split('/').pop()}</strong> has been saved to the cloud workspace.
                        </div>
                        <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 20, lineHeight: 1.6 }}>
                            Choose a local folder to also save a copy to your computer. A native folder picker will open next.
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button onClick={handleSyncPromptSkip} style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = '#484f58'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = '#30363d'}
                            >Skip</button>
                            <button onClick={() => { setAutoSyncEnabled(false); setShowSyncPrompt(false); setPendingSyncFile(null); status('Auto local sync disabled'); }} style={{ background: 'transparent', border: '1px solid #f87171', color: '#f87171', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#f87171'; e.currentTarget.style.color = 'white'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#f87171'; }}
                            >Don't Ask</button>
                            <button onClick={async () => {
                                status('Checking saved folder...');
                                try {
                                    const storedHandle = await idbGetHandle();
                                    if (storedHandle) {
                                        if (await verifyHandlePermission(storedHandle)) {
                                            setLocalSyncHandle(storedHandle);
                                            setLocalSyncPath(storedHandle.name);
                                            setAutoSyncEnabled(true);
                                            if (pendingSyncFile) {
                                                await writeToLocalDir(storedHandle, pendingSyncFile.path, pendingSyncFile.content);
                                                status('Saved & Synced ' + pendingSyncFile.path.split('/').pop());
                                            } else {
                                                status('Folder re-authorized: ' + storedHandle.name);
                                            }
                                            setShowSyncPrompt(false);
                                            setPendingSyncFile(null);
                                            return;
                                        } else {
                                            status('Permission denied for: ' + storedHandle.name, true);
                                        }
                                    } else {
                                        status('No saved folder found. Please Choose Folder.', true);
                                    }
                                } catch (err) {
                                    status('Revival error: ' + err.message, true);
                                }
                            }} style={{ background: 'transparent', border: '1px solid #58a6ff', color: '#58a6ff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(88,166,255,0.1)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><HardDrive size={14} /> Use Selected Folder</span>
                            </button>
                            <button onClick={handleSyncPromptConfirm} style={{ background: 'linear-gradient(135deg, #238636, #2ea043)', border: 'none', color: 'white', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 700, boxShadow: '0 4px 12px rgba(35,134,54,0.4)', transition: 'all 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FolderOpen size={14} /> Choose Folder</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {showAdmin && <ProjectAdminModal project={project} onClose={() => setShowAdmin(false)} onUpdate={() => { status('Project settings updated.'); setShowAdmin(false); window.location.reload(); }} />}
        </div>
    );
}
