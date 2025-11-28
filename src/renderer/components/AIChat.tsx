import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import './AIChat.css';
import { ChatMessage } from '../../shared/settings';
import { ClaudeBedrockClient, ToolCall as ClaudeToolCall, MCPToolDefinition } from '../services/claudeClient';
import { fileSystemTools, ToolResult, TodoItem } from '../services/fileSystemTools';
import ToolCallConfirmation, { ToolCall } from './ToolCallConfirmation';
import TodoListPanel from './TodoListPanel';
import systemPromptMd from '../system_prompt.md';

const { ipcRenderer } = window.require('electron');

// Import icons
import aiAvatarIcon from '../assets/icons/ai_avatar.svg';
import workspaceIcon from '../assets/icons/workspace.svg';
import currentFileIcon from '../assets/icons/current_file.svg';
import chatIcon from '../assets/icons/chat.svg';
import sendIcon from '../assets/icons/send.svg';
import sendCancelIcon from '../assets/icons/send_cancel.svg';

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  settings: any;
  workspacePath: string | null;
  currentFile?: { path: string; content: string } | null;
}

// Thinking text component - shows reasoning in darker grey
const ThinkingText: React.FC<{ thinking: string }> = ({ thinking }) => {
  return (
    <div className="thinking-text">{thinking}</div>
  );
};

// Collapsible tool result component
const CollapsibleToolResult: React.FC<{ result: string }> = ({ result }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get a preview of the result (first line or first 50 chars)
  const preview = result.split('\n')[0].substring(0, 60) + (result.length > 60 ? '...' : '');
  
  return (
    <div className={`tool-result ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div 
        className="tool-result-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="tool-result-toggle">{isExpanded ? '▼' : '▶'}</span>
        <span className="tool-result-label">Result</span>
        {!isExpanded && <span className="tool-result-preview">{preview}</span>}
      </div>
      {isExpanded && (
        <div className="tool-result-content">{result}</div>
      )}
    </div>
  );
};

interface MessageWithTool extends ChatMessage {
  pendingToolCall?: ToolCall;
  toolResult?: string;
  thinking?: string;
}

const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose, settings, workspacePath, currentFile }) => {
  const [messages, setMessages] = useState<MessageWithTool[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [width, setWidth] = useState(400);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [mcpServers, setMcpServers] = useState<string[]>([]);
  const isResizing = useRef(false);

  // Connect to MCP servers and load tools when workspace changes
  useEffect(() => {
    const connectMcpServers = async () => {
      if (!workspacePath) {
        setMcpServers([]);
        // Clear MCP tools from Claude client
        if (claudeClientRef.current) {
          claudeClientRef.current.setMCPTools([]);
        }
        return;
      }
      
      try {
        // Connect to all MCP servers
        const results = await ipcRenderer.invoke('mcp:connect', workspacePath);
        const connectedServers = Object.keys(results).filter(
          name => results[name].status === 'connected'
        );
        setMcpServers(connectedServers);
        
        // Get all tools from connected servers
        const allTools = await ipcRenderer.invoke('mcp:getTools');
        
        // Update Claude client with MCP tools
        if (claudeClientRef.current && allTools.length > 0) {
          const mcpToolDefs: MCPToolDefinition[] = allTools.map((tool: any) => ({
            name: tool.name,
            serverName: tool.serverName,
            description: tool.description || '',
            inputSchema: tool.inputSchema || { type: 'object', properties: {} }
          }));
          claudeClientRef.current.setMCPTools(mcpToolDefs);
          console.log(`[AIChat] Loaded ${mcpToolDefs.length} MCP tools from ${connectedServers.length} servers`);
        }
      } catch (err) {
        console.error('[AIChat] Error connecting to MCP servers:', err);
        setMcpServers([]);
      }
    };
    
    connectMcpServers();
    
    // Cleanup on unmount
    return () => {
      ipcRenderer.invoke('mcp:disconnect').catch(console.error);
    };
  }, [workspacePath]);

  // Set up todo update callback
  useEffect(() => {
    fileSystemTools.setTodoUpdateCallback(setTodos);
    return () => {
      fileSystemTools.setTodoUpdateCallback(null);
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.max(300, Math.min(700, newWidth)));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);
  const [pendingToolCall, setPendingToolCall] = useState<{ toolCall: ToolCall; toolUseId: string } | null>(null);
  const [pendingToolCalls, setPendingToolCalls] = useState<Array<{ toolCall: ToolCall; toolUseId: string; autoExecute: boolean }>>([]);
  const [collectedToolResults, setCollectedToolResults] = useState<Array<{ toolUseId: string; result: string; isError?: boolean }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const claudeClientRef = useRef<ClaudeBedrockClient | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Update workspace path for file tools
  useEffect(() => {
    fileSystemTools.setWorkspacePath(workspacePath);
  }, [workspacePath]);

  const scrollToBottom = useCallback(() => {
    // Use setTimeout to ensure DOM is updated before scrolling
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Also scroll when loading state changes (typing indicator appears/disappears)
  useEffect(() => {
    scrollToBottom();
  }, [isLoading, scrollToBottom]);

  // Scroll when pending tool call changes
  useEffect(() => {
    scrollToBottom();
  }, [pendingToolCall, scrollToBottom]);

  // Ref to hold the process function to avoid closure issues
  const processPendingToolCallsRef = useRef<((
    tools: Array<{ toolCall: ToolCall; toolUseId: string; autoExecute: boolean }>,
    results: Array<{ toolUseId: string; result: string; isError?: boolean }>
  ) => Promise<void>) | null>(null);

  // Internal handler for Claude responses
  const handleClaudeResponseInternal = useCallback(async (response: { text: string; thinking?: string; toolUse?: ClaudeToolCall; toolUses?: ClaudeToolCall[]; stopReason: string }) => {
    // Check if cancelled - ignore response if so
    if (isCancelledRef.current) {
      console.log('[AIChat] Response ignored - cancelled');
      return;
    }
    
    // Add text response if any
    if (response.text || response.thinking) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.text || '',
        timestamp: Date.now(),
        thinking: response.thinking
      }]);
      scrollToBottom();
    }

    // Handle multiple tool calls
    const toolCalls = response.toolUses || (response.toolUse ? [response.toolUse] : []);
    
    if (toolCalls.length === 0) return;

    // Check if ALL tools are auto-execute (no permission required)
    const allAutoExecute = toolCalls.every(t => isAutoExecuteTool(t.name));

    if (allAutoExecute) {
      // All tools can auto-execute - execute all and send results together
      const results: Array<{ toolUseId: string; result: string; isError?: boolean }> = [];
      
      for (const tool of toolCalls) {
        // Check cancellation before each tool
        if (isCancelledRef.current) {
          console.log('[AIChat] Tool execution cancelled');
          return;
        }
        
        const toolCall: ToolCall = {
          id: tool.id,
          name: tool.name,
          description: getToolDescription(tool.name, tool.input),
          parameters: tool.input
        };
        
        const result = await executeToolCall(toolCall);
        results.push({
          toolUseId: tool.id,
          result: result.success ? result.output : `Error: ${result.error}`,
          isError: !result.success
        });
      }

      // Check cancellation before sending results
      if (isCancelledRef.current) return;

      // Send all results together
      if (claudeClientRef.current && results.length > 0) {
        try {
          const nextResponse = await claudeClientRef.current.sendMultipleToolResults(results);
          if (isCancelledRef.current) return;
          await handleClaudeResponseInternal(nextResponse);
        } catch (error: any) {
          if (isCancelledRef.current || error.name === 'AbortError') return;
          throw error;
        }
      }
      return;
    }

    // Some tools need permission - process them with our helper
    const toolsToProcess = toolCalls.map(t => ({
      toolCall: {
        id: t.id,
        name: t.name,
        description: getToolDescription(t.name, t.input),
        parameters: t.input
      },
      toolUseId: t.id,
      autoExecute: isAutoExecuteTool(t.name)
    }));

    if (processPendingToolCallsRef.current) {
      await processPendingToolCallsRef.current(toolsToProcess, []);
    }
  }, [scrollToBottom]);

  // Process pending tool calls
  const processPendingToolCalls = useCallback(async (
    tools: Array<{ toolCall: ToolCall; toolUseId: string; autoExecute: boolean }>,
    results: Array<{ toolUseId: string; result: string; isError?: boolean }>
  ) => {
    // Check if cancelled
    if (isCancelledRef.current) {
      console.log('[AIChat] Tool processing cancelled');
      return;
    }
    
    if (tools.length === 0) {
      // All tools processed, send results
      if (results.length > 0 && claudeClientRef.current) {
        setIsLoading(true);
        try {
          const response = await claudeClientRef.current.sendMultipleToolResults(results);
          // Check again after await
          if (isCancelledRef.current) return;
          await handleClaudeResponseInternal(response);
        } catch (error: any) {
          // Ignore abort errors
          if (isCancelledRef.current || error.name === 'AbortError') return;
          console.error('Error sending tool results:', error);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Error: ${error.message}`,
            timestamp: Date.now()
          }]);
        } finally {
          if (!isCancelledRef.current) {
            setIsLoading(false);
          }
        }
      }
      return;
    }

    const currentTool = tools[0];
    const remainingTools = tools.slice(1);

    if (currentTool.autoExecute) {
      // Auto-execute this tool
      const result = await executeToolCall(currentTool.toolCall);
      const toolResult = {
        toolUseId: currentTool.toolUseId,
        result: result.success ? result.output : `Error: ${result.error}`,
        isError: !result.success
      };
      
      // Continue processing remaining tools
      await processPendingToolCalls(remainingTools, [...results, toolResult]);
    } else {
      // Need permission - store state and wait for user
      setPendingToolCalls(remainingTools);
      setCollectedToolResults(results);
      setPendingToolCall({ toolCall: currentTool.toolCall, toolUseId: currentTool.toolUseId });
    }
  }, [handleClaudeResponseInternal]);

  // Update ref when processPendingToolCalls changes
  useEffect(() => {
    processPendingToolCallsRef.current = processPendingToolCalls;
  }, [processPendingToolCalls]);

  // Show welcome message when chat opens and no messages exist
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const modelName = settings.bedrockModel?.includes('opus') ? 'Claude Opus 4.5' : 'Claude Sonnet 4.5';
      const welcomeMessage = `Hi! I'm your AI assistant powered by ${modelName}.

I can help you with:
- Creating and editing product documents
- Writing PRDs, technical specs, and user stories
- Reading and analyzing files in your workspace
- Product strategy and roadmap planning

How can I help you today?`;
      
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: welcomeMessage,
        timestamp: Date.now()
      }]);
    }
  }, [isOpen, messages.length, settings.bedrockModel]);

  // Initialize Claude client ONLY when settings change (not on show/hide)
  useEffect(() => {
    if (settings.aiEnabled && settings.awsAccessKeyId && settings.awsSecretAccessKey) {
      // Only create new client if settings actually changed
      claudeClientRef.current = new ClaudeBedrockClient({
        region: settings.awsRegion,
        accessKeyId: settings.awsAccessKeyId,
        secretAccessKey: settings.awsSecretAccessKey,
        modelId: settings.bedrockModel,
        systemPrompt: systemPromptMd
      });
    }
  }, [settings.aiEnabled, settings.awsAccessKeyId, settings.awsSecretAccessKey, settings.awsRegion, settings.bedrockModel]);

  // Todo tools that auto-execute without user permission
  const AUTO_EXECUTE_TOOLS = ['create_todo_list', 'update_todo', 'read_todo_list'];

  const isAutoExecuteTool = (toolName: string): boolean => {
    // MCP tools should NOT auto-execute
    if (toolName.startsWith('mcp_')) return false;
    return AUTO_EXECUTE_TOOLS.includes(toolName);
  };

  // Check if tool is an MCP tool
  const isMCPTool = (toolName: string): boolean => {
    return toolName.startsWith('mcp_');
  };

  // Parse MCP tool name to get server and actual tool name
  const parseMCPToolName = (toolName: string): { serverName: string; toolName: string } | null => {
    if (!toolName.startsWith('mcp_')) return null;
    const parts = toolName.substring(4).split('_');
    if (parts.length < 2) return null;
    const serverName = parts[0];
    const actualToolName = parts.slice(1).join('_');
    return { serverName, toolName: actualToolName };
  };

  const executeToolCall = async (toolCall: ToolCall): Promise<ToolResult> => {
    try {
      console.log('[AIChat] Executing tool:', toolCall.name);
      console.log('[AIChat] Tool parameters:', JSON.stringify(toolCall.parameters, null, 2));
      
      // Check if this is an MCP tool
      if (isMCPTool(toolCall.name)) {
        const parsed = parseMCPToolName(toolCall.name);
        if (!parsed) {
          return { success: false, error: 'Invalid MCP tool name', output: '' };
        }
        
        // Call MCP tool via IPC
        const result = await ipcRenderer.invoke('mcp:callTool', parsed.serverName, parsed.toolName, toolCall.parameters);
        
        if (result.success) {
          // Format MCP result
          const content = result.result?.content;
          let output = '';
          if (Array.isArray(content)) {
            output = content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
          } else if (typeof content === 'string') {
            output = content;
          } else {
            output = JSON.stringify(result.result, null, 2);
          }
          return { success: true, output, error: '' };
        } else {
          return { success: false, error: result.error, output: '' };
        }
      }
      
      // Built-in tool
      return await fileSystemTools.executeTool(toolCall.name, toolCall.parameters);
    } catch (error: any) {
      return { success: false, error: error.message, output: '' };
    }
  };

  const handleToolAccept = async () => {
    if (!pendingToolCall) return;

    const { toolCall, toolUseId } = pendingToolCall;
    setPendingToolCall(null);

    try {
      // Execute the tool
      const result = await executeToolCall(toolCall);
      const resultText = result.success ? result.output : `Error: ${result.error}`;

      // Update UI with tool result
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Tool executed: ${toolCall.name}`,
        timestamp: Date.now(),
        toolResult: resultText
      }]);
      scrollToBottom();

      // Add to collected results
      const toolResult = {
        toolUseId: toolUseId,
        result: resultText,
        isError: !result.success
      };

      // Continue processing remaining tools (or send all results if done)
      const newResults = [...collectedToolResults, toolResult];
      setCollectedToolResults([]);
      await processPendingToolCalls(pendingToolCalls, newResults);
    } catch (error: any) {
      console.error('Tool execution error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error executing tool: ${error.message}`,
        timestamp: Date.now()
      }]);
    }
  };

  const handleToolDeny = async () => {
    if (!pendingToolCall) return;

    const { toolUseId } = pendingToolCall;
    setPendingToolCall(null);

    // Add denial as error result
    const toolResult = {
      toolUseId: toolUseId,
      result: 'User denied this tool execution. Please proceed without this action or suggest an alternative.',
      isError: true
    };

    // Continue processing remaining tools (or send all results if done)
    const newResults = [...collectedToolResults, toolResult];
    setCollectedToolResults([]);
    await processPendingToolCalls(pendingToolCalls, newResults);
  };

  const handleClaudeResponse = async (response: { text: string; toolUse?: ClaudeToolCall; toolUses?: ClaudeToolCall[]; stopReason: string }) => {
    await handleClaudeResponseInternal(response);
  };

  const getToolDescription = (name: string, params: Record<string, any>): string => {
    // Handle MCP tools
    if (name.startsWith('mcp_')) {
      const parsed = parseMCPToolName(name);
      if (parsed) {
        const paramStr = Object.keys(params).length > 0 
          ? ` with ${JSON.stringify(params)}` 
          : '';
        return `[MCP: ${parsed.serverName}] ${parsed.toolName}${paramStr}`;
      }
    }
    
    switch (name) {
      case 'list_directory':
        return params.path ? `List files in "${params.path}"` : 'List files in workspace';
      case 'read_file':
        return `Read file "${params.file_path}"`;
      case 'write_file':
        return `Write to file "${params.file_path}"`;
      case 'create_directory':
        return `Create directory "${params.dir_path}"`;
      case 'delete_file':
        return `Delete "${params.file_path}"`;
      case 'read_templates':
        return params.template_name ? `Read template "${params.template_name}"` : 'Read available templates';
      default:
        return `Execute ${name}`;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!settings.aiEnabled || !claudeClientRef.current) {
      alert('Please enable and configure Collie in Settings first.');
      return;
    }

    // Reset cancellation flag for new request
    isCancelledRef.current = false;

    const userMessage: MessageWithTool = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send message with context including MCP servers
      const response = await claudeClientRef.current.sendMessage(input, {
        workspacePath: workspacePath || undefined,
        currentFile: currentFile?.path,
        mcpServers: mcpServers.length > 0 ? mcpServers : undefined
      });

      // Check if cancelled before processing response
      if (isCancelledRef.current) {
        console.log('[AIChat] Response ignored - request was cancelled');
        return;
      }

      await handleClaudeResponse(response);
    } catch (error: any) {
      // Ignore errors if cancelled (including AbortError)
      if (isCancelledRef.current || error.name === 'AbortError') {
        console.log('[AIChat] Request cancelled/aborted');
        return;
      }
      
      console.error('AI Chat error:', error);
      let errorContent = 'Sorry, I encountered an error. ';
      
      if (error.name === 'AccessDeniedException') {
        errorContent += 'Please check your AWS credentials and permissions in Settings.';
      } else if (error.name === 'ThrottlingException') {
        errorContent += 'Too many requests. Please wait a moment and try again.';
      } else {
        errorContent += error.message || 'Please try again.';
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: Date.now()
      }]);
    } finally {
      // Only reset loading if not cancelled (handleStop handles that)
      if (!isCancelledRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Stop/cancel the current agent flow and remove last user message
  const handleStop = () => {
    if (!isLoading) return;
    
    console.log('[AIChat] Stopping current request...');
    
    // Set cancellation flag FIRST - this prevents any async operations from continuing
    isCancelledRef.current = true;
    
    // Abort the current API request
    claudeClientRef.current?.abort();
    
    // Remove the last user message from Claude's history
    claudeClientRef.current?.removeLastMessage();
    
    // Remove the last user message from UI
    setMessages(prev => {
      // Find the last user message and remove it
      const lastUserIndex = [...prev].reverse().findIndex(m => m.role === 'user');
      if (lastUserIndex !== -1) {
        const indexToRemove = prev.length - 1 - lastUserIndex;
        return prev.filter((_, i) => i !== indexToRemove);
      }
      return prev;
    });
    
    // Clear any pending operations
    setPendingToolCall(null);
    setPendingToolCalls([]);
    setCollectedToolResults([]);
    
    // Reset loading state immediately
    setIsLoading(false);
    
    console.log('[AIChat] Request stopped');
  };

  const handleNewChat = () => {
    if (messages.length <= 1 || confirm('Are you sure you want to start a new chat? This will stop the current agent and clear all history.')) {
      // Set cancellation flag to stop any async operations
      isCancelledRef.current = true;
      
      // Stop any running operations
      claudeClientRef.current?.abort();
      setIsLoading(false);
      
      // Clear Claude history
      claudeClientRef.current?.clearHistory();
      
      // Clear all state - set to empty, then useEffect will add welcome message
      setPendingToolCall(null);
      setPendingToolCalls([]);
      setCollectedToolResults([]);
      setInput('');
      
      // Clear todos
      fileSystemTools.clearTodos();
      
      // Set messages to empty to trigger welcome message via useEffect
      setMessages([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ai-chat-panel" style={{ width: `${width}px` }}>
      {/* Resize handle */}
      <div className="ai-chat-resize-handle" onMouseDown={handleMouseDown} />
      
      <div className="ai-chat-header">
        <div className="ai-chat-title">
          <img src={aiAvatarIcon} alt="AI" className="ai-icon" />
          <div>
            <div style={{ fontWeight: 600 }}>Collie</div>
            <div style={{ fontSize: '11px', color: '#888888', fontWeight: 400 }}>
              How can I help you today?
            </div>
          </div>
        </div>
        <div className="ai-chat-actions">
          <button className="ai-chat-new" onClick={handleNewChat} title="New chat">
            <img src={chatIcon} alt="New chat" />
          </button>
          <button className="ai-chat-close" onClick={onClose} title="Close (Esc)">
            ×
          </button>
        </div>
      </div>

      {/* Context bar showing current directory and open file */}
      <div className="ai-context-bar">
        <div className="ai-context-item">
          <img src={workspaceIcon} alt="" className="ai-context-icon" />
          <span className="ai-context-label">Directory:</span>
          <span className="ai-context-value" title={workspacePath || 'No workspace'}>
            {workspacePath ? workspacePath.split(/[\\/]/).pop() || workspacePath : 'No workspace'}
          </span>
        </div>
        <div className="ai-context-item">
          <img src={currentFileIcon} alt="" className="ai-context-icon" />
          <span className="ai-context-label">File:</span>
          <span className="ai-context-value" title={currentFile?.path || 'No file open'}>
            {currentFile?.path ? currentFile.path.split(/[\\/]/).pop() : 'No file open'}
          </span>
        </div>
      </div>

      <div className="ai-chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`ai-message ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="ai-message-avatar">
                <img src={aiAvatarIcon} alt="AI" />
              </div>
            )}
            <div className="ai-message-content">
              {msg.thinking && (
                <ThinkingText thinking={msg.thinking} />
              )}
              <div className="ai-message-text">
                {msg.role === 'assistant' ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              
              {msg.toolResult && (
                <CollapsibleToolResult result={msg.toolResult} />
              )}

              <div className="ai-message-time">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {/* Pending tool call confirmation */}
        {pendingToolCall && (
          <div className="ai-message assistant">
            <div className="ai-message-avatar"><img src={aiAvatarIcon} alt="AI" /></div>
            <div className="ai-message-content">
              <ToolCallConfirmation
                toolCall={pendingToolCall.toolCall}
                onAccept={handleToolAccept}
                onDeny={handleToolDeny}
              />
            </div>
          </div>
        )}

        {isLoading && !pendingToolCall && (
          <div className="ai-message assistant">
            <div className="ai-message-avatar"><img src={aiAvatarIcon} alt="AI" /></div>
            <div className="ai-message-content">
              <div className="ai-typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <TodoListPanel todos={todos} />

      <div className="ai-chat-input-container">
        <textarea
          className="ai-chat-input"
          placeholder="Ask me anything... (Shift+Enter for new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={2}
          disabled={!!pendingToolCall}
        />
        {isLoading ? (
          <button 
            className="ai-chat-stop"
            onClick={handleStop}
            title="Stop generating"
          >
            <img src={sendCancelIcon} alt="Stop" />
          </button>
        ) : (
          <button 
            className="ai-chat-send"
            onClick={handleSend}
            disabled={!input.trim() || !!pendingToolCall}
          >
            <img src={sendIcon} alt="Send" />
          </button>
        )}
      </div>

      {!settings.aiEnabled && (
        <div className="ai-chat-warning">
          Collie is disabled. Enable it in Settings.
        </div>
      )}
    </div>
  );
};

export default AIChat;
