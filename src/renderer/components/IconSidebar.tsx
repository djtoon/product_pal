import React from 'react';
import './IconSidebar.css';

// Import custom icons
import newFileIcon from '../assets/icons/newfile.svg';
import chatIcon from '../assets/icons/chat.svg';
import settingsIcon from '../assets/icons/settings.svg';
import mcpIcon from '../assets/icons/mcp.svg';

interface IconSidebarProps {
  onOpenSettings: () => void;
  onToggleAI: () => void;
  onNewDocument: () => void;
  onOpenMCP: () => void;
  onToggleTerminal: () => void;
  aiEnabled: boolean;
  isAIChatOpen: boolean;
  isTerminalOpen: boolean;
  mcpStatus: 'connected' | 'disconnected' | 'error' | 'loading';
}

const IconSidebar: React.FC<IconSidebarProps> = ({ 
  onOpenSettings, 
  onToggleAI, 
  onNewDocument,
  onOpenMCP,
  onToggleTerminal,
  aiEnabled,
  isAIChatOpen,
  isTerminalOpen,
  mcpStatus
}) => {
  const getMcpStatusColor = () => {
    switch (mcpStatus) {
      case 'connected': return '#4ec9b0';
      case 'error': return '#f48771';
      case 'loading': return '#dcdcaa';
      default: return '#888888';
    }
  };
  return (
    <div className="icon-sidebar">
      <div className="icon-sidebar-items">
        <button 
          className="icon-sidebar-btn" 
          onClick={onNewDocument}
          title="New Document (Ctrl+N)"
        >
          <span className="icon"><img src={newFileIcon} alt="New" /></span>
        </button>

        <button 
          className={`icon-sidebar-btn ${isAIChatOpen ? 'active' : ''}`}
          onClick={onToggleAI}
          title={isAIChatOpen ? "Hide AI Chat (Ctrl+Shift+A)" : aiEnabled ? "Show AI Chat (Ctrl+Shift+A)" : "Configure AI in Settings"}
        >
          <span className="icon"><img src={chatIcon} alt="AI" /></span>
          {!aiEnabled && <span className="icon-badge">!</span>}
        </button>

        <button 
          className="icon-sidebar-btn" 
          onClick={onOpenMCP}
          title={`MCP Servers (${mcpStatus})`}
        >
          <span className="icon"><img src={mcpIcon} alt="MCP" /></span>
          <span 
            className="mcp-status-dot" 
            style={{ backgroundColor: getMcpStatusColor() }}
          />
        </button>

        <button 
          className={`icon-sidebar-btn ${isTerminalOpen ? 'active' : ''}`}
          onClick={onToggleTerminal}
          title={isTerminalOpen ? "Hide Terminal" : "Show Terminal"}
        >
          <span className="icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
          </span>
        </button>

        <button 
          className="icon-sidebar-btn" 
          onClick={onOpenSettings}
          title="Settings (Ctrl+,)"
        >
          <span className="icon"><img src={settingsIcon} alt="Settings" /></span>
        </button>
      </div>
    </div>
  );
};

export default IconSidebar;

