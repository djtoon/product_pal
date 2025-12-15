import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import './AIChat.css';
import { ChatMessage } from '../../shared/settings';
import ToolCallConfirmation, { ToolCall } from './ToolCallConfirmation';
import TodoListPanel from './TodoListPanel';
import systemPromptMd from '../system_prompt.md';
import { Stakeholder, TodoItem } from '../../shared/types';

const { ipcRenderer } = window.require('electron');

// Import icons
import aiAvatarIcon from '../assets/icons/ai_avatar.svg';
import workspaceIcon from '../assets/icons/workspace.svg';
import currentFileIcon from '../assets/icons/current_file.svg';
import chatIcon from '../assets/icons/chat.svg';
import sendIcon from '../assets/icons/send.svg';
import sendCancelIcon from '../assets/icons/send_cancel.svg';

// Template interface
interface Template {
  id: string;
  name: string;
  filename: string;
}

// Template command descriptions for the AI
const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  'prd-template': 'Product Requirements Document - detailed product specification',
  'tech-spec-template': 'Technical Specification - architecture and implementation details',
  'user-story-template': 'User Story - agile user story format with acceptance criteria',
  'kanban-template': 'Kanban Board - visual project board with columns and cards',
  'timeline-template': 'Timeline - project timeline with phases and milestones',
};

// Agent stream event interface
interface AgentStreamEvent {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'error' | 'done';
  data?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolUseId?: string;
  requiresConfirmation?: boolean;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  settings: any;
  workspacePath: string | null;
  currentFile?: { path: string; content: string } | null;
  stakeholders?: Stakeholder[];
  templates?: Template[];
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

const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose, settings, workspacePath, currentFile, stakeholders = [], templates = [] }) => {
  const [messages, setMessages] = useState<MessageWithTool[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [width, setWidth] = useState(400);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [mcpServers, setMcpServers] = useState<string[]>([]);
  const [includeAllStakeholders, setIncludeAllStakeholders] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionCursorPos, setMentionCursorPos] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  // Slash command state
  const [showCommandDropdown, setShowCommandDropdown] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [commandCursorPos, setCommandCursorPos] = useState<number | null>(null);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isResizing = useRef(false);
  const [pendingToolCall, setPendingToolCall] = useState<{ toolCall: ToolCall; toolUseId: string } | null>(null);
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isCancelledRef = useRef<boolean>(false);
  const agentInitializedRef = useRef<boolean>(false);

  // Initialize agent when settings change
  useEffect(() => {
    const initializeAgent = async () => {
      // Reset initialization state when settings change
      agentInitializedRef.current = false;
      
      // Check if we have valid credentials for the selected provider
      const hasBedrockCredentials = settings.awsAccessKeyId && settings.awsSecretAccessKey;
      const hasOpenAICredentials = settings.openaiApiKey;
      const isConfigured = settings.aiProvider === 'openai' ? hasOpenAICredentials : hasBedrockCredentials;

      console.log(`[AIChat] Checking agent config - enabled: ${settings.aiEnabled}, provider: ${settings.aiProvider}, configured: ${isConfigured}`);

      if (settings.aiEnabled && isConfigured) {
        try {
          console.log(`[AIChat] Initializing agent with ${settings.aiProvider || 'bedrock'} provider...`);
          const result = await ipcRenderer.invoke('agent:initialize', {
            provider: settings.aiProvider || 'bedrock',
            // Bedrock settings
            region: settings.awsRegion,
            accessKeyId: settings.awsAccessKeyId,
            secretAccessKey: settings.awsSecretAccessKey,
            bedrockModelId: settings.bedrockModel,
            // OpenAI settings
            openaiApiKey: settings.openaiApiKey,
            openaiModelId: settings.openaiModel,
            openaiBaseUrl: settings.openaiBaseUrl,
            // Common
            systemPrompt: systemPromptMd,
          });
          
          if (result.success) {
            agentInitializedRef.current = true;
            console.log(`[AIChat] Agent initialized successfully with ${settings.aiProvider || 'bedrock'} provider`);
          } else {
            console.error('[AIChat] Agent initialization returned error:', result.error);
          }
        } catch (error) {
          console.error('[AIChat] Failed to initialize agent:', error);
          agentInitializedRef.current = false;
        }
      } else {
        console.log('[AIChat] Agent not configured - aiEnabled:', settings.aiEnabled, 'isConfigured:', isConfigured);
      }
    };

    initializeAgent();
  }, [settings.aiEnabled, settings.aiProvider, settings.awsAccessKeyId, settings.awsSecretAccessKey, settings.awsRegion, settings.bedrockModel, settings.openaiApiKey, settings.openaiModel, settings.openaiBaseUrl]);

  // Update workspace path in agent
  useEffect(() => {
    if (workspacePath) {
      ipcRenderer.invoke('agent:setWorkspacePath', workspacePath);
    }
  }, [workspacePath]);

  // Connect to MCP servers and load tools when workspace changes
  useEffect(() => {
    const connectMcpServers = async () => {
      if (!workspacePath) {
        setMcpServers([]);
        return;
      }
      
      try {
        // Connect to all MCP servers via the agent
        const results = await ipcRenderer.invoke('mcp:connect', workspacePath);
        const connectedServers = Object.keys(results).filter(
          name => results[name].status === 'connected'
        );
        setMcpServers(connectedServers);
        console.log(`[AIChat] MCP servers connected: ${connectedServers.join(', ')}`);
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

  // Listen for todo updates from the agent
  useEffect(() => {
    const handleTodosUpdated = (_event: any, updatedTodos: TodoItem[]) => {
      setTodos(updatedTodos);
    };

    ipcRenderer.on('agent:todosUpdated', handleTodosUpdated);

    return () => {
      ipcRenderer.removeListener('agent:todosUpdated', handleTodosUpdated);
    };
  }, []);

  // Listen for mockup creation requests from the agent
  useEffect(() => {
    const handleCreateMockup = async (_event: any, params: any) => {
      try {
        const { file_path, width = 800, height = 600, title, elements = [] } = params;
        
        // Create an offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.error('[AIChat] Failed to create canvas context');
          return;
        }

        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Set default styles
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.font = '14px Arial, sans-serif';

        // Draw title if provided
        if (title) {
          ctx.font = 'bold 18px Arial, sans-serif';
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.fillText(title, width / 2, 30);
          ctx.textAlign = 'left';
          ctx.font = '14px Arial, sans-serif';
          
          // Draw a separator line under title
          ctx.beginPath();
          ctx.moveTo(20, 45);
          ctx.lineTo(width - 20, 45);
          ctx.stroke();
        }

        // Draw each element
        for (const el of elements) {
          // Reset styles for each element
          ctx.strokeStyle = '#000000';
          ctx.fillStyle = el.fill ? '#F0F0F0' : '#000000';
          ctx.lineWidth = 2;
          ctx.setLineDash(el.dashed ? [5, 5] : []);
          
          if (el.fontSize) {
            ctx.font = `${el.fontSize}px Arial, sans-serif`;
          }

          switch (el.type) {
            case 'rect':
              if (el.width && el.height) {
                if (el.fill) {
                  ctx.fillStyle = '#F0F0F0';
                  ctx.fillRect(el.x, el.y, el.width, el.height);
                }
                ctx.strokeRect(el.x, el.y, el.width, el.height);
              }
              break;

            case 'line':
              ctx.beginPath();
              ctx.moveTo(el.x, el.y);
              ctx.lineTo(el.x2 || el.x, el.y2 || el.y);
              ctx.stroke();
              break;

            case 'text':
              ctx.fillStyle = '#000000';
              ctx.fillText(el.text || '', el.x, el.y);
              break;

            case 'circle':
              ctx.beginPath();
              ctx.arc(el.x, el.y, el.radius || 20, 0, Math.PI * 2);
              if (el.fill) {
                ctx.fillStyle = '#F0F0F0';
                ctx.fill();
              }
              ctx.stroke();
              break;

            case 'button':
              const btnW = el.width || 100;
              const btnH = el.height || 36;
              const btnR = 6;
              
              ctx.beginPath();
              ctx.moveTo(el.x + btnR, el.y);
              ctx.lineTo(el.x + btnW - btnR, el.y);
              ctx.quadraticCurveTo(el.x + btnW, el.y, el.x + btnW, el.y + btnR);
              ctx.lineTo(el.x + btnW, el.y + btnH - btnR);
              ctx.quadraticCurveTo(el.x + btnW, el.y + btnH, el.x + btnW - btnR, el.y + btnH);
              ctx.lineTo(el.x + btnR, el.y + btnH);
              ctx.quadraticCurveTo(el.x, el.y + btnH, el.x, el.y + btnH - btnR);
              ctx.lineTo(el.x, el.y + btnR);
              ctx.quadraticCurveTo(el.x, el.y, el.x + btnR, el.y);
              ctx.closePath();
              
              if (el.fill) {
                ctx.fillStyle = '#E0E0E0';
                ctx.fill();
              }
              ctx.stroke();
              
              if (el.text) {
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(el.text, el.x + btnW / 2, el.y + btnH / 2);
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
              }
              break;

            case 'input':
              const inputW = el.width || 200;
              const inputH = el.height || 32;
              
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(el.x, el.y, inputW, inputH);
              ctx.strokeRect(el.x, el.y, inputW, inputH);
              
              if (el.text) {
                ctx.fillStyle = '#999999';
                ctx.textBaseline = 'middle';
                ctx.fillText(el.text, el.x + 8, el.y + inputH / 2);
                ctx.textBaseline = 'alphabetic';
              }
              break;

            case 'image-placeholder':
              const imgW = el.width || 100;
              const imgH = el.height || 100;
              
              ctx.fillStyle = '#F5F5F5';
              ctx.fillRect(el.x, el.y, imgW, imgH);
              ctx.strokeRect(el.x, el.y, imgW, imgH);
              
              ctx.beginPath();
              ctx.moveTo(el.x, el.y);
              ctx.lineTo(el.x + imgW, el.y + imgH);
              ctx.moveTo(el.x + imgW, el.y);
              ctx.lineTo(el.x, el.y + imgH);
              ctx.stroke();
              
              if (el.text) {
                ctx.fillStyle = '#666666';
                ctx.textAlign = 'center';
                ctx.fillText(el.text, el.x + imgW / 2, el.y + imgH + 16);
                ctx.textAlign = 'left';
              }
              break;

            case 'nav-bar':
              const navW = el.width || width - 40;
              const navH = el.height || 50;
              
              ctx.fillStyle = '#F8F8F8';
              ctx.fillRect(el.x, el.y, navW, navH);
              ctx.strokeRect(el.x, el.y, navW, navH);
              
              if (el.text) {
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 16px Arial, sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(el.text, el.x + 16, el.y + navH / 2);
                ctx.font = '14px Arial, sans-serif';
                ctx.textBaseline = 'alphabetic';
              }
              break;

            case 'card':
              const cardW = el.width || 200;
              const cardH = el.height || 150;
              const cardR = 8;
              
              ctx.beginPath();
              ctx.moveTo(el.x + cardR, el.y);
              ctx.lineTo(el.x + cardW - cardR, el.y);
              ctx.quadraticCurveTo(el.x + cardW, el.y, el.x + cardW, el.y + cardR);
              ctx.lineTo(el.x + cardW, el.y + cardH - cardR);
              ctx.quadraticCurveTo(el.x + cardW, el.y + cardH, el.x + cardW - cardR, el.y + cardH);
              ctx.lineTo(el.x + cardR, el.y + cardH);
              ctx.quadraticCurveTo(el.x, el.y + cardH, el.x, el.y + cardH - cardR);
              ctx.lineTo(el.x, el.y + cardR);
              ctx.quadraticCurveTo(el.x, el.y, el.x + cardR, el.y);
              ctx.closePath();
              
              ctx.fillStyle = '#FAFAFA';
              ctx.fill();
              ctx.stroke();
              
              if (el.text) {
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 14px Arial, sans-serif';
                ctx.fillText(el.text, el.x + 12, el.y + 24);
                ctx.font = '14px Arial, sans-serif';
                
                ctx.beginPath();
                ctx.moveTo(el.x, el.y + 36);
                ctx.lineTo(el.x + cardW, el.y + 36);
                ctx.stroke();
              }
              break;

            case 'list-item':
              const itemH = el.height || 32;
              const itemW = el.width || 200;
              
              ctx.beginPath();
              ctx.arc(el.x + 8, el.y + itemH / 2, 3, 0, Math.PI * 2);
              ctx.fill();
              
              if (el.text) {
                ctx.fillStyle = '#000000';
                ctx.textBaseline = 'middle';
                ctx.fillText(el.text, el.x + 20, el.y + itemH / 2);
                ctx.textBaseline = 'alphabetic';
              }
              
              if (el.dashed !== false) {
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(el.x, el.y + itemH);
                ctx.lineTo(el.x + itemW, el.y + itemH);
                ctx.stroke();
                ctx.setLineDash([]);
              }
              break;
          }
        }

        // Reset line dash
        ctx.setLineDash([]);

        // Add a subtle border around the entire mockup
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, width, height);

        // Convert canvas to PNG data URL and then to buffer
        const dataUrl = canvas.toDataURL('image/png');
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        
        // Convert base64 to Uint8Array for IPC transfer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Ensure file path ends with .png
        let outputPath = file_path;
        if (!outputPath.toLowerCase().endsWith('.png')) {
          outputPath += '.png';
        }

        // Resolve full path relative to workspace
        const path = window.require('path');
        const fullPath = workspacePath ? path.join(workspacePath, outputPath) : outputPath;

        // Write the file via IPC
        await ipcRenderer.invoke('fs:writeFileBinary', fullPath, Buffer.from(bytes));

        console.log(`[AIChat] Mockup created: ${fullPath}`);
      } catch (error: any) {
        console.error('[AIChat] Error creating mockup:', error);
      }
    };

    ipcRenderer.on('agent:createMockup', handleCreateMockup);

    return () => {
      ipcRenderer.removeListener('agent:createMockup', handleCreateMockup);
    };
  }, [workspacePath]);

  // Listen for stream events from the agent
  useEffect(() => {
    const handleStreamEvent = (_event: any, { streamId, event }: { streamId: string; event: AgentStreamEvent }) => {
      // Ignore events from old streams
      if (streamId !== currentStreamId) return;

      // Check if cancelled
      if (isCancelledRef.current) return;

      switch (event.type) {
        case 'text':
          setStreamingText(prev => prev + (event.data || ''));
          break;

        case 'thinking':
          setStreamingThinking(prev => prev + (event.data || ''));
          break;

        case 'tool_use':
          if (event.requiresConfirmation && event.toolName && event.toolUseId) {
            // Pause streaming and show tool confirmation
            const toolCall: ToolCall = {
              id: event.toolUseId,
              name: event.toolName,
              description: getToolDescription(event.toolName, event.toolInput || {}),
              parameters: event.toolInput || {},
            };
            setPendingToolCall({ toolCall, toolUseId: event.toolUseId });
          }
          break;

        case 'tool_result':
          // Add tool result to messages
          if (event.data) {
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content: `Tool executed: ${event.toolUseId?.split('-')[0] || 'tool'}`,
              timestamp: Date.now(),
              toolResult: event.data,
            }]);
          }
          break;

        case 'error':
          // Show error message
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Error: ${event.data || 'Unknown error'}`,
            timestamp: Date.now(),
          }]);
          setIsLoading(false);
          break;

        case 'done':
          // Finalize the streaming message
          if (streamingText || streamingThinking) {
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content: streamingText,
              timestamp: Date.now(),
              thinking: streamingThinking || undefined,
            }]);
            setStreamingText('');
            setStreamingThinking('');
          }
          setIsLoading(false);
          setCurrentStreamId(null);
          break;
      }
    };

    ipcRenderer.on('agent:streamEvent', handleStreamEvent);

    return () => {
      ipcRenderer.removeListener('agent:streamEvent', handleStreamEvent);
    };
  }, [currentStreamId]);

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

  const scrollToBottom = useCallback(() => {
    // Use setTimeout to ensure DOM is updated before scrolling
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom, streamingText]);

  // Also scroll when loading state changes (typing indicator appears/disappears)
  useEffect(() => {
    scrollToBottom();
  }, [isLoading, scrollToBottom]);

  // Scroll when pending tool call changes
  useEffect(() => {
    scrollToBottom();
  }, [pendingToolCall, scrollToBottom]);

  // Show welcome message when chat opens and no messages exist
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage = `Hi, I'm Collie! How can I help you today?`;
      
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: welcomeMessage,
        timestamp: Date.now()
      }]);
    }
  }, [isOpen, messages.length]);

  // Auto-focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      // Force repaint workaround for Electron rendering bug
      const forceRepaint = () => {
        if (inputRef.current) {
          inputRef.current.style.opacity = '0.99';
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.style.opacity = '1';
            }
          });
        }
      };
      
      if (inputRef.current && !pendingToolCall) {
        const focusInput = () => {
          if (inputRef.current) {
            inputRef.current.focus();
            forceRepaint();
          }
        };
        
        focusInput();
        setTimeout(focusInput, 100);
        setTimeout(focusInput, 300);
      }
    }
  }, [isOpen, pendingToolCall, isLoading]);

  const getToolDescription = (name: string, params: Record<string, any>): string => {
    // Handle MCP tools
    if (name.startsWith('mcp_')) {
      const parts = name.substring(4).split('_');
      const serverName = parts[0];
      const toolName = parts.slice(1).join('_');
      const paramStr = Object.keys(params).length > 0 
        ? ` with ${JSON.stringify(params)}` 
        : '';
      return `[MCP: ${serverName}] ${toolName}${paramStr}`;
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

  const handleToolAccept = async () => {
    if (!pendingToolCall) return;
    setPendingToolCall(null);
    // Tool will be executed automatically by the agent
  };

  const handleToolDeny = async () => {
    if (!pendingToolCall) return;
    setPendingToolCall(null);
    // Abort the current stream since user denied the tool
    await ipcRenderer.invoke('agent:abort');
    setIsLoading(false);
    setCurrentStreamId(null);
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: 'Tool execution cancelled by user.',
      timestamp: Date.now(),
    }]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!settings.aiEnabled) {
      alert('Please enable AI Assistant in Settings first.');
      return;
    }
    
    if (!agentInitializedRef.current) {
      console.log('[AIChat] Agent not initialized, attempting to initialize...');
      // Try to reinitialize
      try {
        const hasBedrockCredentials = settings.awsAccessKeyId && settings.awsSecretAccessKey;
        const hasOpenAICredentials = settings.openaiApiKey;
        const isConfigured = settings.aiProvider === 'openai' ? hasOpenAICredentials : hasBedrockCredentials;
        
        if (!isConfigured) {
          alert('Please configure your API credentials in Settings first.');
          return;
        }
        
        const result = await ipcRenderer.invoke('agent:initialize', {
          provider: settings.aiProvider || 'bedrock',
          region: settings.awsRegion,
          accessKeyId: settings.awsAccessKeyId,
          secretAccessKey: settings.awsSecretAccessKey,
          bedrockModelId: settings.bedrockModel,
          openaiApiKey: settings.openaiApiKey,
          openaiModelId: settings.openaiModel,
          openaiBaseUrl: settings.openaiBaseUrl,
          systemPrompt: systemPromptMd,
        });
        
        if (!result.success) {
          alert(`Failed to initialize AI: ${result.error || 'Unknown error'}`);
          return;
        }
        agentInitializedRef.current = true;
        console.log('[AIChat] Agent initialized on-demand successfully');
      } catch (error: any) {
        alert(`Failed to initialize AI: ${error.message || 'Unknown error'}`);
        return;
      }
    }

    // Reset cancellation flag for new request
    isCancelledRef.current = false;
    setStreamingText('');
    setStreamingThinking('');

    // Parse @mentions from input
    const { cleanedText: textAfterMentions, mentionedStakeholders } = parseStakeholderContext(input);
    
    // Parse /template commands from input
    const { cleanedText, requestedTemplates } = parseTemplateCommands(textAfterMentions);
    
    // Determine which stakeholders to include
    let stakeholdersToInclude: Stakeholder[] = [];
    if (includeAllStakeholders) {
      stakeholdersToInclude = stakeholders;
    } else if (mentionedStakeholders.length > 0) {
      stakeholdersToInclude = mentionedStakeholders;
    }

    // Build the message with stakeholder and template context
    const stakeholderContext = buildStakeholderContextString(stakeholdersToInclude);
    const templateContext = buildTemplateContextString(requestedTemplates);
    const messageToSend = templateContext + stakeholderContext + cleanedText;

    const userMessage: MessageWithTool = {
      id: Date.now().toString(),
      role: 'user',
      content: input, // Show original input in UI
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setShowMentionDropdown(false);
    setShowCommandDropdown(false);
    setIsLoading(true);

    try {
      // Start streaming via IPC
      const { streamId } = await ipcRenderer.invoke('agent:stream', messageToSend, {
        workspacePath: workspacePath || undefined,
        currentFile: currentFile?.path,
      });
      
      setCurrentStreamId(streamId);
    } catch (error: any) {
      console.error('AI Chat error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${error.message || 'Please try again.'}`,
        timestamp: Date.now()
      }]);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get filtered stakeholders for mention dropdown
  const filteredStakeholders = stakeholders.filter(s => 
    s.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  // Get filtered templates for command dropdown
  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(commandFilter.toLowerCase()) ||
    t.id.toLowerCase().includes(commandFilter.toLowerCase())
  );

  // Handle input change with @mention and /command detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setInput(value);

    const textBeforeCursor = value.substring(0, cursorPos);

    // Check if we're typing a slash command
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      const textAfterSlash = textBeforeCursor.substring(lastSlashIndex + 1);
      // Only show dropdown if there's no space after / and it's either at start or after a space
      const charBeforeSlash = lastSlashIndex > 0 ? textBeforeCursor[lastSlashIndex - 1] : ' ';
      
      if ((charBeforeSlash === ' ' || charBeforeSlash === '\n' || lastSlashIndex === 0) && 
          !textAfterSlash.includes(' ') && !textAfterSlash.includes('\n')) {
        setShowCommandDropdown(true);
        setCommandFilter(textAfterSlash);
        setCommandCursorPos(lastSlashIndex);
        setSelectedCommandIndex(0);
        // Hide mention dropdown if showing
        setShowMentionDropdown(false);
        return;
      }
    }
    
    setShowCommandDropdown(false);
    setCommandFilter('');
    setCommandCursorPos(null);

    // Check if we're typing a mention
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Only show dropdown if there's no space after @ and it's either at start or after a space
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      
      if ((charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) && 
          !textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setShowMentionDropdown(true);
        setMentionFilter(textAfterAt);
        setMentionCursorPos(lastAtIndex);
        setSelectedMentionIndex(0);
        return;
      }
    }
    
    setShowMentionDropdown(false);
    setMentionFilter('');
    setMentionCursorPos(null);
  };

  // Handle keyboard navigation in dropdowns
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle command dropdown navigation
    if (showCommandDropdown && filteredTemplates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev < filteredTemplates.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev > 0 ? prev - 1 : filteredTemplates.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectCommand(filteredTemplates[selectedCommandIndex]);
      } else if (e.key === 'Escape') {
        setShowCommandDropdown(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        selectCommand(filteredTemplates[selectedCommandIndex]);
      }
      return;
    }

    // Handle mention dropdown navigation
    if (showMentionDropdown && filteredStakeholders.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < filteredStakeholders.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : filteredStakeholders.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectMention(filteredStakeholders[selectedMentionIndex]);
      } else if (e.key === 'Escape') {
        setShowMentionDropdown(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        selectMention(filteredStakeholders[selectedMentionIndex]);
      }
    }
  };

  // Select a template command from dropdown
  const selectCommand = (template: Template) => {
    if (commandCursorPos === null) return;

    const beforeCommand = input.substring(0, commandCursorPos);
    const afterCommand = input.substring(commandCursorPos + commandFilter.length + 1);
    const newInput = `${beforeCommand}/[${template.id}]${afterCommand}`;
    
    setInput(newInput);
    setShowCommandDropdown(false);
    setCommandFilter('');
    setCommandCursorPos(null);
    
    // Focus back to input
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = beforeCommand.length + template.id.length + 3; // /[id]
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // Select a stakeholder from dropdown
  const selectMention = (stakeholder: Stakeholder) => {
    if (mentionCursorPos === null) return;

    const beforeMention = input.substring(0, mentionCursorPos);
    const afterMention = input.substring(mentionCursorPos + mentionFilter.length + 1);
    const newInput = `${beforeMention}@[${stakeholder.name}]${afterMention}`;
    
    setInput(newInput);
    setShowMentionDropdown(false);
    setMentionFilter('');
    setMentionCursorPos(null);
    
    // Focus back to input
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = beforeMention.length + stakeholder.name.length + 3; // @[name]
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // Parse @mentions from input and build stakeholder context
  const parseStakeholderContext = (text: string): { cleanedText: string; mentionedStakeholders: Stakeholder[] } => {
    const mentionRegex = /@\[([^\]]+)\]/g;
    const mentionedNames: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentionedNames.push(match[1]);
    }

    const mentioned = stakeholders.filter(s => mentionedNames.includes(s.name));
    
    // Remove @[Name] tags from text, keeping just the name for readability
    const cleanedText = text.replace(/@\[([^\]]+)\]/g, '@$1');
    
    return { cleanedText, mentionedStakeholders: mentioned };
  };

  // Parse /[template] commands from input and build template context
  const parseTemplateCommands = (text: string): { cleanedText: string; requestedTemplates: Template[] } => {
    const commandRegex = /\/\[([^\]]+)\]/g;
    const templateIds: string[] = [];
    let match;
    
    while ((match = commandRegex.exec(text)) !== null) {
      templateIds.push(match[1]);
    }

    const requested = templates.filter(t => templateIds.includes(t.id));
    
    // Remove /[id] tags from text, keeping a readable version
    const cleanedText = text.replace(/\/\[([^\]]+)\]/g, (_, id) => {
      const template = templates.find(t => t.id === id);
      return template ? `/${template.name}` : `/${id}`;
    });
    
    return { cleanedText, requestedTemplates: requested };
  };

  // Build template context string for AI
  const buildTemplateContextString = (templateList: Template[]): string => {
    if (templateList.length === 0) return '';
    
    const templateLines = templateList.map(t => {
      const desc = TEMPLATE_DESCRIPTIONS[t.id] || t.name;
      return `- ${t.name} (${t.id}): ${desc}`;
    }).join('\n');
    
    return `[DOCUMENT REQUEST: The user wants you to WRITE A NEW DOCUMENT using the following template(s) as a format guide:
${templateLines}

Instructions:
1. First, use read_templates to load the template structure
2. Then WRITE A COMPLETE DOCUMENT following that template's format, filled with actual content based on the user's request and project context
3. Save the document to the workspace using write_file with a .prd extension

You are NOT creating a template - you are using the template as a blueprint to write a real document.]\n\n`;
  };

  // Build stakeholder context string for AI
  const buildStakeholderContextString = (stakeholderList: Stakeholder[]): string => {
    if (stakeholderList.length === 0) return '';
    
    const stakeholderLines = stakeholderList.map(s => `- ${s.name} (${s.role})`).join('\n');
    return `[Stakeholders in this request:\n${stakeholderLines}]\n\n`;
  };

  // Stop/cancel the current agent flow and remove last user message
  const handleStop = async () => {
    if (!isLoading) return;
    
    console.log('[AIChat] Stopping current request...');
    
    // Set cancellation flag FIRST - this prevents any async operations from continuing
    isCancelledRef.current = true;
    
    // Abort the agent request
    await ipcRenderer.invoke('agent:abort');
    
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
    
    // Clear pending state
    setPendingToolCall(null);
    setStreamingText('');
    setStreamingThinking('');
    setCurrentStreamId(null);
    
    // Reset loading state immediately
    setIsLoading(false);
    
    console.log('[AIChat] Request stopped');
  };

  const handleNewChat = async () => {
    if (messages.length <= 1 || confirm('Are you sure you want to start a new chat? This will stop the current agent and clear all history.')) {
      // Set cancellation flag to stop any async operations
      isCancelledRef.current = true;
      
      // Stop any running operations
      await ipcRenderer.invoke('agent:abort');
      setIsLoading(false);
      
      // Clear agent history
      await ipcRenderer.invoke('agent:clearHistory');
      
      // Clear all state - set to empty, then useEffect will add welcome message
      setPendingToolCall(null);
      setStreamingText('');
      setStreamingThinking('');
      setCurrentStreamId(null);
      setInput('');
      
      // Clear todos
      await ipcRenderer.invoke('agent:clearTodos');
      setTodos([]);
      
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

        {/* Streaming message in progress */}
        {(streamingText || streamingThinking) && (
          <div className="ai-message assistant">
            <div className="ai-message-avatar">
              <img src={aiAvatarIcon} alt="AI" />
            </div>
            <div className="ai-message-content">
              {streamingThinking && (
                <ThinkingText thinking={streamingThinking} />
              )}
              {streamingText && (
                <div className="ai-message-text">
                  <ReactMarkdown>{streamingText}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}

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

        {isLoading && !pendingToolCall && !streamingText && !streamingThinking && (
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

      {/* Stakeholder options bar */}
      {stakeholders.length > 0 && (
        <div className="ai-stakeholder-bar">
          <label className="ai-stakeholder-checkbox">
            <input
              type="checkbox"
              checked={includeAllStakeholders}
              onChange={(e) => setIncludeAllStakeholders(e.target.checked)}
            />
            <span>Include all stakeholders ({stakeholders.length})</span>
          </label>
          <span className="ai-stakeholder-hint">Type @ to mention, / for templates</span>
        </div>
      )}

      <div className="ai-chat-input-container">
        <div className="ai-chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="ai-chat-input"
            placeholder={templates.length > 0 ? "Ask me anything... (/ for templates, @ for stakeholders)" : "Ask me anything... (Shift+Enter for new line)"}
            value={input}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onKeyDown={handleInputKeyDown}
            onClick={() => inputRef.current?.focus()}
            rows={2}
            disabled={!!pendingToolCall}
          />
          
          {/* /Command dropdown for templates */}
          {showCommandDropdown && filteredTemplates.length > 0 && (
            <div className="command-dropdown">
              <div className="command-dropdown-header">Create from template</div>
              {filteredTemplates.map((template, index) => (
                <div
                  key={template.id}
                  className={`command-item ${index === selectedCommandIndex ? 'selected' : ''}`}
                  onClick={() => selectCommand(template)}
                  onMouseEnter={() => setSelectedCommandIndex(index)}
                >
                  <span className="command-name">{template.name}</span>
                  <span className="command-desc">{TEMPLATE_DESCRIPTIONS[template.id] || template.filename}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* @Mention dropdown */}
          {showMentionDropdown && filteredStakeholders.length > 0 && (
            <div className="mention-dropdown">
              {filteredStakeholders.map((stakeholder, index) => (
                <div
                  key={stakeholder.id}
                  className={`mention-item ${index === selectedMentionIndex ? 'selected' : ''}`}
                  onClick={() => selectMention(stakeholder)}
                  onMouseEnter={() => setSelectedMentionIndex(index)}
                >
                  <span className="mention-name">{stakeholder.name}</span>
                  <span className="mention-role">{stakeholder.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
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
