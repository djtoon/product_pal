import React, { useState, useEffect } from 'react';
import './MCPPanel.css';

const { ipcRenderer } = window.require('electron');

interface MCPServer {
  name: string;
  type?: string;
  command?: string;
  url?: string;
  status: 'connected' | 'disconnected' | 'error';
  tools?: { name: string; description: string }[];
  error?: string;
}

interface MCPPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string | null;
}

const MCPPanel: React.FC<MCPPanelProps> = ({ isOpen, onClose, workspacePath }) => {
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [mcpJson, setMcpJson] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reconnecting, setReconnecting] = useState<string | null>(null);

  // Load MCP config when panel opens
  useEffect(() => {
    if (isOpen && workspacePath) {
      loadMcpConfig();
    }
  }, [isOpen, workspacePath]);

  const loadMcpConfig = async () => {
    if (!workspacePath) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load the JSON config
      const config = await ipcRenderer.invoke('mcp:read', workspacePath);
      if (config) {
        setMcpJson(JSON.stringify(config, null, 2));
        
        // Get current connection status (don't reconnect - they auto-connect on init)
        const connections: Array<{ name: string; status: string; tools: any[]; error?: string }> = 
          await ipcRenderer.invoke('mcp:getConnections');
        const connectionMap = new Map(connections.map(c => [c.name, c]));
        
        // Build server list with current status
        const servers: MCPServer[] = [];
        if (config?.mcpServers) {
          for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
            const cfg = serverConfig as any;
            const conn = connectionMap.get(name);
            servers.push({
              name,
              type: cfg.type || (cfg.url ? 'sse' : 'stdio'),
              command: cfg.command,
              url: cfg.url,
              status: (conn?.status as MCPServer['status']) || 'disconnected',
              tools: conn?.tools || [],
              error: conn?.error
            });
          }
        }
        setMcpServers(servers);
      } else {
        // Create default empty config
        const defaultConfig = { mcpServers: {} };
        setMcpJson(JSON.stringify(defaultConfig, null, 2));
        setMcpServers([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load MCP config');
      setMcpJson('{\n  "mcpServers": {}\n}');
      setMcpServers([]);
    } finally {
      setLoading(false);
    }
  };

  // Refresh all - actually reconnects all servers
  const refreshAllMcp = async () => {
    if (!workspacePath) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const config = await ipcRenderer.invoke('mcp:read', workspacePath);
      if (config) {
        // This actually reconnects all servers
        const connectionResults = await ipcRenderer.invoke('mcp:connect', workspacePath);
        
        const servers: MCPServer[] = [];
        if (config?.mcpServers) {
          for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
            const cfg = serverConfig as any;
            const result = connectionResults[name];
            servers.push({
              name,
              type: cfg.type || (cfg.url ? 'sse' : 'stdio'),
              command: cfg.command,
              url: cfg.url,
              status: result?.status || 'disconnected',
              tools: result?.tools || [],
              error: result?.error
            });
          }
        }
        setMcpServers(servers);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  };

  const parseMcpServersFromJson = (config: any) => {
    const servers: MCPServer[] = [];
    
    if (config?.mcpServers) {
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        const cfg = serverConfig as any;
        servers.push({
          name,
          type: cfg.type || 'stdio',
          command: cfg.command,
          url: cfg.url,
          status: 'disconnected'
        });
      }
    }
    
    setMcpServers(servers);
  };

  const handleJsonChange = (value: string) => {
    setMcpJson(value);
    setHasChanges(true);
    setError(null);
    
    // Try to parse and update server list preview
    try {
      const parsed = JSON.parse(value);
      parseMcpServersFromJson(parsed);
    } catch {
      // Invalid JSON, don't update servers
    }
  };

  const handleSave = async () => {
    if (!workspacePath) return;
    
    try {
      const parsed = JSON.parse(mcpJson);
      await ipcRenderer.invoke('mcp:write', workspacePath, parsed);
      setHasChanges(false);
      setError(null);
      // Reload to refresh status
      await loadMcpConfig();
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format');
      } else {
        setError(err.message || 'Failed to save');
      }
    }
  };

  const handleRefresh = () => {
    refreshAllMcp();
    setHasChanges(false);
  };

  const handleReconnectServer = async (serverName: string) => {
    if (!workspacePath) return;
    
    setReconnecting(serverName);
    try {
      const result = await ipcRenderer.invoke('mcp:reconnect', workspacePath, serverName);
      
      // Update the server in the list
      setMcpServers(prev => prev.map(server => 
        server.name === serverName 
          ? { ...server, status: result.status, tools: result.tools, error: result.error }
          : server
      ));
    } catch (err: any) {
      console.error('Failed to reconnect server:', err);
    } finally {
      setReconnecting(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return '#4ec9b0';
      case 'error': return '#f48771';
      default: return '#888888';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '●';
      case 'error': return '✕';
      default: return '○';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="mcp-panel-overlay" onClick={onClose}>
      <div className="mcp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mcp-panel-header">
          <h2>MCP Servers</h2>
          <button className="mcp-panel-close" onClick={onClose}>×</button>
        </div>

        {!workspacePath ? (
          <div className="mcp-panel-empty">
            <p>Please select a workspace folder first to configure MCP servers.</p>
          </div>
        ) : (
          <div className="mcp-panel-content">
            <div className="mcp-servers-section">
              <div className="mcp-section-header">
                <h3>Connected Servers</h3>
                <button className="mcp-refresh-btn" onClick={handleRefresh} title="Refresh">
                  ↻
                </button>
              </div>
              
              {loading ? (
                <div className="mcp-loading">Loading...</div>
              ) : mcpServers.length === 0 ? (
                <div className="mcp-no-servers">
                  No MCP servers configured. Add servers in the JSON editor below.
                </div>
              ) : (
                <div className="mcp-servers-list">
                  {mcpServers.map((server) => (
                    <div key={server.name} className={`mcp-server-item ${server.status}`}>
                      <span 
                        className="mcp-server-status"
                        style={{ color: getStatusColor(server.status) }}
                      >
                        {getStatusIcon(server.status)}
                      </span>
                      <div className="mcp-server-info">
                        <div className="mcp-server-header">
                          <span className="mcp-server-name">{server.name}</span>
                          {server.status === 'connected' && server.tools && (
                            <span className="mcp-server-tools-count">
                              {server.tools.length} tools
                            </span>
                          )}
                        </div>
                        <span className="mcp-server-type">
                          {server.type === 'sse' || server.type === 'http' 
                            ? server.url 
                            : server.command}
                        </span>
                        {server.error && (
                          <span className="mcp-server-error">{server.error}</span>
                        )}
                        {server.status === 'connected' && server.tools && server.tools.length > 0 && (
                          <div className="mcp-server-tools">
                            {server.tools.slice(0, 5).map(tool => (
                              <span key={tool.name} className="mcp-tool-name" title={tool.description}>
                                {tool.name}
                              </span>
                            ))}
                            {server.tools.length > 5 && (
                              <span className="mcp-tool-more">+{server.tools.length - 5} more</span>
                            )}
                          </div>
                        )}
                      </div>
                      <button 
                        className="mcp-server-reconnect"
                        onClick={() => handleReconnectServer(server.name)}
                        disabled={reconnecting === server.name}
                        title="Reconnect this server"
                      >
                        {reconnecting === server.name ? '...' : '↻'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mcp-editor-section">
              <div className="mcp-section-header">
                <h3>.mcp.json</h3>
                <div className="mcp-editor-actions">
                  {hasChanges && (
                    <span className="mcp-unsaved-indicator">Unsaved changes</span>
                  )}
                  <button 
                    className="mcp-save-btn"
                    onClick={handleSave}
                    disabled={!hasChanges}
                  >
                    Save
                  </button>
                </div>
              </div>

              {error && (
                <div className="mcp-error">{error}</div>
              )}

              <textarea
                className="mcp-json-editor"
                value={mcpJson}
                onChange={(e) => handleJsonChange(e.target.value)}
                spellCheck={false}
                placeholder='{\n  "mcpServers": {}\n}'
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MCPPanel;

