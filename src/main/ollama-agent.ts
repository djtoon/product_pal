import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { TodoItem } from '../shared/types';

// Import ollama dynamically to avoid webpack issues
let Ollama: any = null;
const loadOllama = async () => {
  if (Ollama) return Ollama;
  const ollamaModule = await import(/* webpackIgnore: true */ 'ollama');
  Ollama = ollamaModule.Ollama;
  return Ollama;
};

export interface OllamaAgentConfig {
  modelId: string;
  baseUrl: string;
  systemPrompt: string;
}

export interface OllamaStreamEvent {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'error' | 'done';
  data?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolUseId?: string;
}

// Models that support the 'think' parameter for extended reasoning
const THINKING_CAPABLE_MODELS = [
  'qwen3',      // Qwen 3 supports thinking
  'deepseek-r1', // DeepSeek R1 supports thinking
  'qwq',        // QwQ supports thinking
];

// Check if a model supports thinking mode
const supportsThinking = (modelId: string): boolean => {
  const lowerModel = modelId.toLowerCase();
  return THINKING_CAPABLE_MODELS.some(pattern => lowerModel.startsWith(pattern));
};

// Define tools in Ollama format - using simple parameter names for better model compatibility
const OLLAMA_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: "List contents of a directory. Leave path empty for workspace root.",
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (empty for root)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: "Read file contents.",
      parameters: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string', description: 'File path to read' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or update a file. MUST provide both path and content.',
      parameters: {
        type: 'object',
        required: ['path', 'content'],
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Complete file content to write' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_directory',
      description: "Create a new directory.",
      parameters: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string', description: 'Directory path to create' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: "Delete a file or directory.",
      parameters: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string', description: 'Path to delete' }
        }
      }
    }
  }
];

export class OllamaAgentService extends EventEmitter {
  private client: any = null;
  private config: OllamaAgentConfig | null = null;
  private workspacePath: string | null = null;
  private messages: any[] = [];
  private todos: TodoItem[] = [];

  setWorkspacePath(workspacePath: string | null) {
    this.workspacePath = workspacePath;
  }

  async initialize(config: OllamaAgentConfig): Promise<void> {
    console.log('[OLLAMA-AGENT] Initializing with config:', JSON.stringify(config, null, 2));
    
    const OllamaClass = await loadOllama();
    this.client = new OllamaClass({ host: config.baseUrl });
    this.config = config;
    this.messages = [];
    
    // Add system prompt as first message
    if (config.systemPrompt) {
      this.messages.push({ role: 'system', content: config.systemPrompt });
    }
    
    console.log('[OLLAMA-AGENT] Initialized successfully');
  }

  async *stream(
    message: string,
    context?: { workspacePath?: string; currentFile?: string }
  ): AsyncGenerator<OllamaStreamEvent> {
    if (!this.client || !this.config) {
      yield { type: 'error', data: 'Ollama agent not initialized' };
      return;
    }

    if (context?.workspacePath) {
      this.workspacePath = context.workspacePath;
    }

    // Build context prefix
    let contextPrefix = '';
    if (context?.workspacePath) {
      contextPrefix += `[Current Working Folder: ${context.workspacePath}]\n`;
    }
    if (context?.currentFile) {
      contextPrefix += `[Current Open File: ${context.currentFile}]\n`;
    }
    if (contextPrefix) {
      contextPrefix += '\n';
    }

    const fullMessage = contextPrefix + message;
    this.messages.push({ role: 'user', content: fullMessage });

    try {
      // Agent loop - keep going until no more tool calls
      let iterations = 0;
      const MAX_ITERATIONS = 100; // Prevent infinite loops
      let thinkingOnlyCount = 0; // Track consecutive thinking-only responses
      
      while (iterations < MAX_ITERATIONS) {
        iterations++;
        console.log('[OLLAMA-AGENT] Iteration', iterations, 'of', MAX_ITERATIONS);
        console.log('[OLLAMA-AGENT] Sending chat request with', this.messages.length, 'messages');
        console.log('[OLLAMA-AGENT] Messages:', JSON.stringify(this.messages.slice(-2), null, 2));
        
        // Build chat options - only enable thinking for models that support it
        const chatOptions: any = {
          model: this.config.modelId,
          messages: this.messages,
          tools: OLLAMA_TOOLS,
          stream: false, // Use non-streaming for simpler tool handling
        };
        
        // Only add think option for models that support it
        if (supportsThinking(this.config.modelId)) {
          chatOptions.think = true;
          console.log('[OLLAMA-AGENT] Thinking mode enabled for', this.config.modelId);
        }
        
        const response = await this.client.chat(chatOptions);

        console.log('[OLLAMA-AGENT] Full response:', JSON.stringify(response, null, 2));
        console.log('[OLLAMA-AGENT] Response received:', JSON.stringify({
          hasContent: !!response.message.content,
          hasThinking: !!response.message.thinking,
          hasToolCalls: !!response.message.tool_calls?.length,
          toolCalls: response.message.tool_calls?.map((tc: any) => tc.function.name),
          content: response.message.content?.substring(0, 200),
          thinking: response.message.thinking?.substring(0, 200),
        }));

        // Add assistant message to history
        this.messages.push(response.message);

        // Yield any thinking content
        if (response.message.thinking) {
          console.log('[OLLAMA-AGENT] Yielding thinking:', response.message.thinking.substring(0, 100));
          yield { type: 'thinking', data: response.message.thinking };
        }

        // Yield text content
        if (response.message.content) {
          console.log('[OLLAMA-AGENT] Yielding content:', response.message.content.substring(0, 100));
          yield { type: 'text', data: response.message.content };
        }

        // Check for tool calls
        const toolCalls = response.message.tool_calls || [];
        console.log('[OLLAMA-AGENT] Tool calls count:', toolCalls.length);
        
        if (toolCalls.length === 0) {
          // No tool calls - check if we should continue or stop
          
          if (response.message.content) {
            // Has content, we're done
            console.log('[OLLAMA-AGENT] Response has content, finishing');
            break;
          }
          
          if (response.message.thinking && !response.message.content) {
            // Model only produced thinking but no action - prompt it to continue
            thinkingOnlyCount++;
            console.log('[OLLAMA-AGENT] Thinking-only response #', thinkingOnlyCount);
            
            if (thinkingOnlyCount >= 3) {
              // Too many thinking-only responses, give up
              console.log('[OLLAMA-AGENT] Too many thinking-only responses, stopping');
              yield { type: 'text', data: '(Model got stuck in thinking mode. Try a simpler request or use a larger model.)' };
              break;
            }
            
            // Add a nudge to continue with action
            this.messages.push({
              role: 'user',
              content: 'Continue. Execute the next step using the available tools, or provide your final response.'
            });
            continue; // Loop again to get actual action
          }
          
          if (!response.message.content && !response.message.thinking) {
            console.log('[OLLAMA-AGENT] WARNING: No content, no thinking, no tool calls');
            yield { type: 'text', data: '(Model returned empty response. Try rephrasing your question.)' };
            break;
          }
          
          break;
        }
        
        // Reset thinking-only counter since we got tool calls
        thinkingOnlyCount = 0;

        // Process each tool call
        for (const call of toolCalls) {
          const toolName = call.function.name;
          const toolArgs = call.function.arguments || {};

          yield {
            type: 'tool_use',
            toolName,
            toolInput: toolArgs,
            toolUseId: `tool-${Date.now()}`
          };

          // Execute the tool
          const result = await this.executeTool(toolName, toolArgs);
          
          yield {
            type: 'tool_result',
            toolUseId: `tool-${Date.now()}`,
            data: result
          };

          // Add tool result to messages
          this.messages.push({
            role: 'tool',
            content: result
          });
        }
      }
      
      if (iterations >= MAX_ITERATIONS) {
        console.log('[OLLAMA-AGENT] Max iterations reached');
        yield { type: 'text', data: '\n\n(Reached maximum steps. The task may be incomplete.)' };
      }

      yield { type: 'done' };
    } catch (error: any) {
      console.error('[OLLAMA-AGENT] Error:', error);
      yield { type: 'error', data: error.message };
    }
  }

  private async executeTool(toolName: string, args: Record<string, any>): Promise<string> {
    console.log(`[OLLAMA-AGENT] Executing tool: ${toolName}`, args);
    
    // Normalize path parameter - model might use 'path', 'file_path', or 'dir_path'
    const filePath = args.path || args.file_path || args.dir_path || '';
    
    try {
      switch (toolName) {
        case 'list_directory':
          return await this.listDirectory(filePath);
        case 'read_file':
          return await this.readFile(filePath);
        case 'write_file':
          if (!filePath) {
            return 'Error: path is required for write_file';
          }
          if (!args.content && args.content !== '') {
            return 'Error: content is required for write_file. Please provide the file content.';
          }
          return await this.writeFile(filePath, args.content);
        case 'create_directory':
          return await this.createDirectory(filePath);
        case 'delete_file':
          return await this.deleteFile(filePath);
        default:
          return `Unknown tool: ${toolName}`;
      }
    } catch (error: any) {
      return `Error executing ${toolName}: ${error.message}`;
    }
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    if (this.workspacePath) {
      return path.join(this.workspacePath, filePath);
    }
    return path.resolve(filePath);
  }

  private async listDirectory(dirPath?: string): Promise<string> {
    try {
      let targetPath: string;
      const normalizedPath = dirPath?.trim() || '';
      
      if (!normalizedPath || normalizedPath === '.' || normalizedPath === './') {
        targetPath = this.workspacePath || process.cwd();
      } else {
        targetPath = this.resolvePath(normalizedPath);
      }

      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const items = entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`)
        .join('\n');

      return `Directory: ${targetPath}\n\n${items || '(empty)'}`;
    } catch (error: any) {
      return `Error listing directory: ${error.message}`;
    }
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      const fullPath = this.resolvePath(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return `Content of ${filePath}:\n\n${content}`;
    } catch (error: any) {
      return `Error reading file: ${error.message}`;
    }
  }

  private async writeFile(filePath: string, content: string): Promise<string> {
    try {
      if (!filePath) return 'Error: file_path is required';
      
      const fullPath = this.resolvePath(filePath);
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content || '', 'utf-8');
      return `File created/updated successfully: ${filePath}`;
    } catch (error: any) {
      return `Error writing file: ${error.message}`;
    }
  }

  private async createDirectory(dirPath: string): Promise<string> {
    try {
      const fullPath = this.resolvePath(dirPath);
      await fs.mkdir(fullPath, { recursive: true });
      return `Directory created: ${dirPath}`;
    } catch (error: any) {
      return `Error creating directory: ${error.message}`;
    }
  }

  private async deleteFile(filePath: string): Promise<string> {
    try {
      const fullPath = this.resolvePath(filePath);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        await fs.rm(fullPath, { recursive: true });
      } else {
        await fs.unlink(fullPath);
      }
      return `Deleted: ${filePath}`;
    } catch (error: any) {
      return `Error deleting: ${error.message}`;
    }
  }

  clearHistory() {
    this.messages = [];
    if (this.config?.systemPrompt) {
      this.messages.push({ role: 'system', content: this.config.systemPrompt });
    }
    this.todos = [];
    this.emit('todosUpdated', this.todos);
  }

  getTodos(): TodoItem[] {
    return [...this.todos];
  }

  clearTodos() {
    this.todos = [];
    this.emit('todosUpdated', this.todos);
  }
}

// Singleton instance
export const ollamaAgent = new OllamaAgentService();
