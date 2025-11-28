import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import './TerminalPanel.css';

const { ipcRenderer } = window.require('electron');

interface TerminalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath?: string;
}

interface MCPLogEntry {
  serverName: string;
  type: 'stdout' | 'stderr' | 'info' | 'error';
  message: string;
  timestamp: Date;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ isOpen, onClose, workspacePath }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [activeTab, setActiveTab] = useState<'mcp' | 'shell'>('mcp');
  const [mcpLogs, setMcpLogs] = useState<MCPLogEntry[]>([]);

  // Initialize xterm
  useEffect(() => {
    if (!isOpen || !terminalRef.current) return;

    if (!xtermRef.current) {
      const term = new Terminal({
        theme: {
          background: '#1a1a2e',
          foreground: '#e0e0e0',
          cursor: '#5a7886',
          cursorAccent: '#1a1a2e',
          selectionBackground: '#5a788644',
          black: '#1a1a2e',
          red: '#ff6b6b',
          green: '#4ecdc4',
          yellow: '#ffe66d',
          blue: '#5a7886',
          magenta: '#c678dd',
          cyan: '#56b6c2',
          white: '#e0e0e0',
        },
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.2,
        cursorBlink: true,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Welcome message
      term.writeln('\x1b[36m╔══════════════════════════════════════════╗\x1b[0m');
      term.writeln('\x1b[36m║\x1b[0m   \x1b[1;33mMCP Server Monitor\x1b[0m                    \x1b[36m║\x1b[0m');
      term.writeln('\x1b[36m╚══════════════════════════════════════════╝\x1b[0m');
      term.writeln('');
    }

    return () => {
      // Don't dispose on every render, only when truly unmounting
    };
  }, [isOpen]);

  // Handle resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          // Ignore fit errors
        }
      }
    };

    window.addEventListener('resize', handleResize);
    // Fit after a short delay to ensure DOM is ready
    setTimeout(handleResize, 100);

    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Listen for MCP logs from main process
  useEffect(() => {
    const handleMcpLog = (_: any, log: MCPLogEntry) => {
      setMcpLogs(prev => [...prev.slice(-500), { ...log, timestamp: new Date() }]);
      
      if (xtermRef.current) {
        const color = log.type === 'error' ? '\x1b[31m' : 
                      log.type === 'stderr' ? '\x1b[33m' : 
                      log.type === 'info' ? '\x1b[36m' : '\x1b[0m';
        const serverColor = '\x1b[35m';
        const reset = '\x1b[0m';
        
        xtermRef.current.writeln(
          `${serverColor}[${log.serverName}]${reset} ${color}${log.message}${reset}`
        );
      }
    };

    ipcRenderer.on('mcp:log', handleMcpLog);
    return () => {
      ipcRenderer.removeListener('mcp:log', handleMcpLog);
    };
  }, []);

  const clearTerminal = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.writeln('\x1b[36m--- Terminal Cleared ---\x1b[0m');
    }
    setMcpLogs([]);
  };

  if (!isOpen) return null;

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <div className="terminal-tabs">
          <button 
            className={`terminal-tab ${activeTab === 'mcp' ? 'active' : ''}`}
            onClick={() => setActiveTab('mcp')}
          >
            MCP Servers
          </button>
        </div>
        <div className="terminal-actions">
          <button className="terminal-action-btn" onClick={clearTerminal} title="Clear">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
            </svg>
          </button>
          <button className="terminal-action-btn" onClick={onClose} title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="terminal-content">
        <div ref={terminalRef} className="xterm-container" />
      </div>
    </div>
  );
};

export default TerminalPanel;

