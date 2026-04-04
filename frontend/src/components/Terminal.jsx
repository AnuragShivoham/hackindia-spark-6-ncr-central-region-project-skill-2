// frontend/src/components/Terminal.jsx

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { AlertCircle, RefreshCw } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import './Terminal.css';

export default function TerminalComponent({ projectId, token }) {
  const terminalRef = useRef(null);
  const wsRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(new FitAddon());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId || !token) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      cols: 120,
      rows: 30,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
      },
      fontFamily: "'Fira Code', 'Courier New', monospace",
      fontSize: 13,
    });

    termRef.current = term;
    term.loadAddon(fitAddonRef.current);
    term.open(terminalRef.current);
    fitAddonRef.current.fit();

    // Establish WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/terminal?projectId=${projectId}&token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Terminal] Connected to backend');
      setConnected(true);
      setError(null);
      term.write('\x1b[92m✓ Connected to workspace terminal\r\n\x1b[0m');
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'output') {
        term.write(msg.data);
      } else if (msg.type === 'welcome') {
        term.write(`\x1b[94m${msg.message}\x1b[0m\r\n`);
      } else if (msg.type === 'error') {
        term.write(`\x1b[91m[ERROR] ${msg.message}\x1b[0m\r\n`);
      }
    };

    ws.onerror = (err) => {
      console.error('[Terminal] WebSocket error:', err);
      setConnected(false);
      setError('Connection lost');
      term.write('\x1b[91mConnection lost. Attempting to reconnect...\x1b[0m\r\n');
    };

    ws.onclose = () => {
      console.log('[Terminal] WebSocket closed');
      setConnected(false);
    };

    // Send terminal input to backend
    const handleData = (data) => {
      if (connected && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    };

    term.onData(handleData);

    // Handle window resize
    const handleResize = () => {
      fitAddonRef.current.fit();
      if (connected && ws.readyState === WebSocket.OPEN) {
        const { cols, rows } = term;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      ws.close();
    };
  }, [projectId, token]);

  const handleReconnect = () => {
    if (termRef.current) {
      termRef.current.write('\x1b[92mAttempting to reconnect...\x1b[0m\r\n');
    }
    // WebSocket will attempt to reconnect automatically
  };

  const handleClear = () => {
    if (termRef.current) {
      termRef.current.clear();
    }
  };

  return (
    <div className="terminal-container">
      <div className="terminal-controls">
        <div className="terminal-status">
          <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="terminal-buttons">
          {error && (
            <button
              className="terminal-btn"
              onClick={handleReconnect}
              title="Reconnect"
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button
            className="terminal-btn"
            onClick={handleClear}
            title="Clear"
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="terminal-error">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button onClick={handleReconnect}>Reconnect</button>
        </div>
      )}

      <div ref={terminalRef} className="xterm-wrapper" />
    </div>
  );
}
