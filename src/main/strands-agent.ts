import { Agent, tool, BedrockModel } from '@strands-agents/sdk';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';
import { TodoItem } from '../shared/types';
import { AIProvider } from '../shared/settings';

// Dynamic import for OpenAI model
// Note: SDK v0.1.2 exports './openai' in package.json
let OpenAIModelClass: any = null;
const loadOpenAIModel = async (): Promise<any> => {
  if (OpenAIModelClass) return OpenAIModelClass;
  try {
    // Use dynamic import with webpackIgnore to load at runtime from node_modules
    const openaiModule = await import(/* webpackIgnore: true */ '@strands-agents/sdk/openai');
    OpenAIModelClass = openaiModule.OpenAIModel;
    return OpenAIModelClass;
  } catch (e) {
    console.warn('OpenAI model not available:', e);
    return null;
  }
};

// Re-export TodoItem for use by IPC handlers
export type { TodoItem };

export interface AgentConfig {
  provider: AIProvider;
  // Bedrock settings
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bedrockModelId?: string;
  // OpenAI settings
  openaiApiKey?: string;
  openaiModelId?: string;
  openaiBaseUrl?: string;
  // Common
  systemPrompt: string;
}

export interface AgentStreamEvent {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'error' | 'done';
  data?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolUseId?: string;
  requiresConfirmation?: boolean;
}

// Agent service class
export class StrandsAgentService extends EventEmitter {
  private agent: Agent | null = null;
  private config: AgentConfig | null = null;
  private workspacePath: string | null = null;
  private todos: TodoItem[] = [];
  private abortController: AbortController | null = null;

  // Tools that auto-execute without user permission
  private autoExecuteTools = new Set([
    'create_todo_list',
    'update_todo',
    'read_todo_list',
    'read_templates',
    'create_mockup'
  ]);

  setWorkspacePath(workspacePath: string | null) {
    this.workspacePath = workspacePath;
  }

  // Initialize or reinitialize the agent with config
  async initialize(config: AgentConfig): Promise<void> {
    this.config = config;
    
    let model;
    
    if (config.provider === 'openai') {
      // Dynamically load OpenAI model
      const OpenAIModelClass = await loadOpenAIModel();
      if (!OpenAIModelClass) {
        throw new Error('OpenAI model provider is not available. Please check your installation.');
      }
      
      // Create OpenAI model
      const openaiConfig: any = {
        apiKey: config.openaiApiKey,
        modelId: config.openaiModelId || 'gpt-5.1',
        maxTokens: 4096,
      };
      
      // Add custom base URL if provided
      if (config.openaiBaseUrl) {
        openaiConfig.clientConfig = {
          baseURL: config.openaiBaseUrl,
        };
      }
      
      model = new OpenAIModelClass(openaiConfig);
    } else {
      // Set AWS credentials in environment for Bedrock
      process.env.AWS_ACCESS_KEY_ID = config.accessKeyId;
      process.env.AWS_SECRET_ACCESS_KEY = config.secretAccessKey;
      process.env.AWS_REGION = config.region;

      // Create Bedrock model
      model = new BedrockModel({
        modelId: config.bedrockModelId || 'us.anthropic.claude-sonnet-4-20250514-v1:0',
        region: config.region,
      });
    }

    // Create agent with built-in tools
    // Note: MCP tools integration with Strands TypeScript SDK is still experimental
    // For now, we use only the built-in tools
    this.agent = new Agent({
      model,
      systemPrompt: config.systemPrompt,
      tools: this.createBuiltInTools(),
      printer: false, // Disable console output, we'll handle streaming
    });
  }

  // Connect to MCP servers (placeholder for future Strands MCP integration)
  async connectMCPServers(mcpConfigs: Record<string, any>): Promise<Record<string, { status: string; tools: any[]; error?: string }>> {
    const results: Record<string, { status: string; tools: any[]; error?: string }> = {};

    // Note: MCP integration with Strands TypeScript SDK is experimental
    // For now, we return a placeholder message
    for (const [name, serverConfig] of Object.entries(mcpConfigs)) {
      const config = serverConfig as any;
      
      if (config.disabled) {
        results[name] = { status: 'disabled', tools: [] };
      } else {
        // MCP tools will be integrated when Strands TypeScript SDK stabilizes
        results[name] = {
          status: 'info',
          tools: [],
          error: 'MCP integration with Strands SDK is in development. Tools are managed by the agent internally.',
        };
      }
    }

    return results;
  }

  // Stream agent response
  async *stream(
    message: string,
    context?: { workspacePath?: string; currentFile?: string }
  ): AsyncGenerator<AgentStreamEvent> {
    if (!this.agent) {
      yield { type: 'error', data: 'Agent not initialized' };
      return;
    }

    // Update workspace path if provided
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

    try {
      this.abortController = new AbortController();

      // Use agent.stream() for real-time events
      // Cast events to any for flexibility with SDK types
      for await (const event of this.agent.stream(fullMessage)) {
        const ev = event as any;
        
        // Handle different event types from Strands
        switch (ev.type) {
          case 'modelContentBlockDeltaEvent':
            // Handle text delta
            if (ev.delta?.type === 'textDelta' && ev.delta.text) {
              yield { type: 'text', data: ev.delta.text };
            }
            // Handle reasoning/thinking delta
            if (ev.delta?.type === 'reasoningContentDelta' && ev.delta.text) {
              yield { type: 'thinking', data: ev.delta.text };
            }
            break;

          case 'modelContentBlockStartEvent':
            if (ev.start?.type === 'toolUseStart') {
              const toolName = ev.start.name;
              yield {
                type: 'tool_use',
                toolName,
                toolUseId: ev.start.toolUseId,
                requiresConfirmation: !this.autoExecuteTools.has(toolName),
              };
            }
            break;

          case 'beforeToolsEvent':
            // Tool is about to be executed
            const toolUseBlocks = (ev.message?.content || []).filter(
              (c: any) => c.type === 'toolUseBlock'
            );
            
            for (const toolBlock of toolUseBlocks) {
              yield {
                type: 'tool_use',
                toolName: toolBlock.name,
                toolInput: toolBlock.input,
                toolUseId: toolBlock.toolUseId,
                requiresConfirmation: !this.autoExecuteTools.has(toolBlock.name),
              };
            }
            break;

          case 'afterToolsEvent':
            // Tool execution completed
            const resultBlocks = (ev.message?.content || []).filter(
              (c: any) => c.type === 'toolResultBlock'
            );
            
            for (const resultBlock of resultBlocks) {
              const content = resultBlock.content?.[0];
              const resultData = content?.text || (content?.json ? JSON.stringify(content.json) : 'Done');
              yield {
                type: 'tool_result',
                toolUseId: resultBlock.toolUseId,
                data: resultData,
              };
            }
            break;

          case 'afterInvocationEvent':
            // Agent finished - check for error property
            if (ev.error) {
              yield { type: 'error', data: ev.error.message || String(ev.error) };
            }
            break;
        }
      }

      yield { type: 'done' };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        yield { type: 'done', data: 'Cancelled' };
      } else {
        yield { type: 'error', data: error.message };
      }
    }
  }

  // Abort current request
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // Clear conversation history
  clearHistory() {
    if (this.agent) {
      // Create new agent to clear history
      if (this.config) {
        this.initialize(this.config);
      }
    }
    this.clearTodos();
  }

  // Todo management
  getTodos(): TodoItem[] {
    return [...this.todos];
  }

  clearTodos() {
    this.todos = [];
    this.emit('todosUpdated', this.todos);
  }

  // Create built-in tools with Zod schemas
  private createBuiltInTools() {
    const self = this;

    // List directory tool
    const listDirectoryTool = tool({
      name: 'list_directory',
      description: "List contents of the user's workspace folder. The workspace folder is specified in the [Current Working Folder: ...] context. All paths are relative to this workspace.",
      inputSchema: z.object({
        path: z.string().optional().describe('OPTIONAL: Relative path to a subfolder within the workspace (e.g., "src" or "docs/api"). Leave EMPTY or omit entirely to list the workspace root.'),
      }),
      callback: async (input) => {
        return await self.executeListDirectory(input.path);
      },
    });

    // Read file tool
    const readFileTool = tool({
      name: 'read_file',
      description: "Read the contents of a file in the user's workspace. Use relative paths only.",
      inputSchema: z.object({
        file_path: z.string().describe('Relative path to the file within the workspace (e.g., "package.json", "src/main.ts"). Do NOT use absolute paths.'),
      }),
      callback: async (input) => {
        return await self.executeReadFile(input.file_path);
      },
    });

    // Write file tool
    const writeFileTool = tool({
      name: 'write_file',
      description: 'Create or update a file. CRITICAL: Both file_path and content are MANDATORY.',
      inputSchema: z.object({
        file_path: z.string().describe('REQUIRED: Relative path for the file (e.g., "docs/PRD.md"). Must be provided.'),
        content: z.string().describe('REQUIRED: The COMPLETE file content as a string. This is MANDATORY.'),
      }),
      callback: async (input) => {
        return await self.executeWriteFile(input.file_path, input.content);
      },
    });

    // Create directory tool
    const createDirectoryTool = tool({
      name: 'create_directory',
      description: "Create a new directory in the user's workspace. Use relative paths only.",
      inputSchema: z.object({
        dir_path: z.string().describe('Relative path for the new directory within the workspace (e.g., "docs/specs").'),
      }),
      callback: async (input) => {
        return await self.executeCreateDirectory(input.dir_path);
      },
    });

    // Delete file tool
    const deleteFileTool = tool({
      name: 'delete_file',
      description: "Delete a file or directory from the user's workspace. Use relative paths only.",
      inputSchema: z.object({
        file_path: z.string().describe('Relative path to the file or directory to delete within the workspace.'),
      }),
      callback: async (input) => {
        return await self.executeDeleteFile(input.file_path);
      },
    });

    // Read templates tool
    const readTemplatesTool = tool({
      name: 'read_templates',
      description: 'Read available document templates. Returns a list of templates with their names and content.',
      inputSchema: z.object({
        template_name: z.string().optional().describe('OPTIONAL: Specific template filename to read. If omitted, returns all available templates.'),
      }),
      callback: async (input) => {
        return await self.executeReadTemplates(input.template_name);
      },
    });

    // Create todo list tool
    const createTodoListTool = tool({
      name: 'create_todo_list',
      description: 'Create a todo list to track progress on the current task. Use this at the START of any multi-step task.',
      inputSchema: z.object({
        items: z.array(z.object({
          content: z.string().describe('Description of the task to complete'),
          status: z.enum(['pending', 'in_progress']).optional().describe('Initial status. Use "in_progress" for the first task.'),
        })).describe('Array of todo items to create.'),
      }),
      callback: (input) => {
        return self.executeCreateTodoList(input.items);
      },
    });

    // Update todo tool
    const updateTodoTool = tool({
      name: 'update_todo',
      description: 'Update a todo item status. Use this to mark tasks as completed, in_progress, or cancelled.',
      inputSchema: z.object({
        todo_id: z.string().describe('Todo number (1, 2, 3...) or exact ID to update'),
        status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).describe('New status for the todo item'),
        content: z.string().optional().describe('OPTIONAL: New content/description for the todo item'),
      }),
      callback: (input) => {
        return self.executeUpdateTodo(input.todo_id, input.status, input.content);
      },
    });

    // Read todo list tool
    const readTodoListTool = tool({
      name: 'read_todo_list',
      description: "Read the current todo list to check progress.",
      inputSchema: z.object({}),
      callback: () => {
        return self.executeReadTodoList();
      },
    });

    // Create mockup tool (simplified - actual canvas rendering happens in renderer)
    const createMockupTool = tool({
      name: 'create_mockup',
      description: 'Create a UI mockup/wireframe image. The output is a PNG image saved to the workspace.',
      inputSchema: z.object({
        file_path: z.string().describe('REQUIRED: Output file path for the mockup image (e.g., "mockups/login-screen.png"). Must end with .png'),
        width: z.number().optional().describe('Canvas width in pixels (default: 800)'),
        height: z.number().optional().describe('Canvas height in pixels (default: 600)'),
        title: z.string().optional().describe('Optional title displayed at top of mockup'),
        elements: z.array(z.object({
          type: z.enum(['rect', 'line', 'text', 'circle', 'button', 'input', 'image-placeholder', 'nav-bar', 'card', 'list-item']).describe('Element type'),
          x: z.number().describe('X position from left'),
          y: z.number().describe('Y position from top'),
          width: z.number().optional(),
          height: z.number().optional(),
          x2: z.number().optional(),
          y2: z.number().optional(),
          radius: z.number().optional(),
          text: z.string().optional(),
          fontSize: z.number().optional(),
          fill: z.boolean().optional(),
          dashed: z.boolean().optional(),
        })).describe('Array of UI elements to draw on the mockup'),
      }),
      callback: async (input) => {
        // Emit event for renderer to handle mockup creation
        self.emit('createMockup', input);
        return `Mockup request sent: ${input.file_path}`;
      },
    });

    return [
      listDirectoryTool,
      readFileTool,
      writeFileTool,
      createDirectoryTool,
      deleteFileTool,
      readTemplatesTool,
      createTodoListTool,
      updateTodoTool,
      readTodoListTool,
      createMockupTool,
    ];
  }

  // Tool execution methods
  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    if (this.workspacePath) {
      return path.join(this.workspacePath, filePath);
    }
    return path.resolve(filePath);
  }

  private async executeListDirectory(dirPath?: string): Promise<string> {
    try {
      let normalizedPath = dirPath?.trim() || '';
      if (normalizedPath === '.' || normalizedPath === './') {
        normalizedPath = '';
      }

      let targetPath: string;
      if (!normalizedPath) {
        targetPath = this.workspacePath || process.cwd();
      } else if (this.workspacePath) {
        targetPath = path.join(this.workspacePath, normalizedPath);
      } else {
        targetPath = normalizedPath;
      }

      const items = await this.readDirectoryRecursive(targetPath, 0);
      const output = this.formatDirectoryTree(items, 0);
      return `Directory listing for: ${targetPath}\n\n${output}`;
    } catch (error: any) {
      return `Error listing directory: ${error.message}`;
    }
  }

  private async readDirectoryRecursive(dirPath: string, depth: number): Promise<any[]> {
    const items: any[] = [];
    if (depth > 5) return items;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const item: any = {
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
        };

        if (entry.isDirectory()) {
          item.children = await this.readDirectoryRecursive(fullPath, depth + 1);
        }

        items.push(item);
      }
    } catch (error) {
      console.error('Error reading directory:', error);
    }

    return items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  private formatDirectoryTree(items: any[], depth: number): string {
    let output = '';
    const indent = '  '.repeat(depth);
    
    for (const item of items) {
      const icon = item.isDirectory ? '📁' : '📄';
      output += `${indent}${icon} ${item.name}\n`;
      
      if (item.isDirectory && item.children && item.children.length > 0) {
        output += this.formatDirectoryTree(item.children, depth + 1);
      }
    }
    
    return output;
  }

  private async executeReadFile(filePath: string): Promise<string> {
    try {
      const fullPath = this.resolvePath(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return `Content of ${filePath}:\n\n${content}`;
    } catch (error: any) {
      return `Error reading file: ${error.message}`;
    }
  }

  private async executeWriteFile(filePath: string, content: string): Promise<string> {
    try {
      if (!filePath) {
        return 'Error: file_path is required';
      }
      
      const safeContent = content ?? '';
      const fullPath = this.resolvePath(filePath);
      
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(fullPath, safeContent, 'utf-8');
      return `File created/updated successfully: ${filePath}`;
    } catch (error: any) {
      return `Error writing file: ${error.message}`;
    }
  }

  private async executeCreateDirectory(dirPath: string): Promise<string> {
    try {
      const fullPath = this.resolvePath(dirPath);
      await fs.mkdir(fullPath, { recursive: true });
      return `Directory created successfully: ${dirPath}`;
    } catch (error: any) {
      return `Error creating directory: ${error.message}`;
    }
  }

  private async executeDeleteFile(filePath: string): Promise<string> {
    try {
      const fullPath = this.resolvePath(filePath);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        await fs.rm(fullPath, { recursive: true });
      } else {
        await fs.unlink(fullPath);
      }
      
      return `File/directory deleted successfully: ${filePath}`;
    } catch (error: any) {
      return `Error deleting: ${error.message}`;
    }
  }

  private getTemplatesPath(): string {
    const appPath = app.isPackaged 
      ? path.dirname(app.getPath('exe'))
      : path.join(__dirname, '../../');
    return path.join(appPath, 'templates');
  }

  private async executeReadTemplates(templateName?: string): Promise<string> {
    try {
      const templatesPath = this.getTemplatesPath();
      const files = await fs.readdir(templatesPath);
      const templateFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.prd'));
      
      if (templateFiles.length === 0) {
        return 'No templates available. Templates folder is empty.';
      }

      if (templateName) {
        const template = templateFiles.find(f => 
          f === templateName || f.replace(/\.(md|prd)$/, '') === templateName.replace(/\.(md|prd)$/, '')
        );
        
        if (!template) {
          return `Template not found: ${templateName}. Available templates: ${templateFiles.join(', ')}`;
        }

        const content = await fs.readFile(path.join(templatesPath, template), 'utf-8');
        return `Template: ${template}\n\n---\n\n${content}`;
      }

      let output = `Available Templates (${templateFiles.length}):\n\n`;
      
      for (const file of templateFiles) {
        const content = await fs.readFile(path.join(templatesPath, file), 'utf-8');
        const name = file.replace(/\.(md|prd)$/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        output += `## ${name} (${file})\n\n${content}\n\n---\n\n`;
      }

      return output;
    } catch (error: any) {
      return `Error reading templates: ${error.message}`;
    }
  }

  private executeCreateTodoList(items: Array<{ content: string; status?: 'pending' | 'in_progress' }>): string {
    this.todos = items.map((item, index) => ({
      id: `todo-${Date.now()}-${index}`,
      content: item.content,
      status: item.status || 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    this.emit('todosUpdated', this.todos);
    return `Todo list created with ${this.todos.length} items:\n\n${this.formatTodoList()}`;
  }

  private executeUpdateTodo(todoId: string, status: TodoItem['status'], content?: string): string {
    const indexNum = parseInt(todoId, 10);
    let todo: TodoItem | undefined;
    
    if (!isNaN(indexNum) && indexNum >= 1 && indexNum <= this.todos.length) {
      todo = this.todos[indexNum - 1];
    } else {
      todo = this.todos.find(t => t.id === todoId);
    }

    if (!todo) {
      return `Todo not found: ${todoId}. Use todo number (1, 2, 3...) or exact ID.`;
    }

    todo.status = status;
    if (content) todo.content = content;
    todo.updatedAt = Date.now();

    this.emit('todosUpdated', this.todos);
    return `Updated todo: "${todo.content}" → ${todo.status}\n\n${this.formatTodoList()}`;
  }

  private executeReadTodoList(): string {
    if (this.todos.length === 0) {
      return 'No todos in the current task. Create a todo list to track progress.';
    }

    const completed = this.todos.filter(t => t.status === 'completed').length;
    const total = this.todos.length;
    const progress = Math.round((completed / total) * 100);

    return `Task Progress: ${completed}/${total} (${progress}%)\n\n${this.formatTodoList()}`;
  }

  private formatTodoList(): string {
    if (this.todos.length === 0) return 'No todos.';

    return this.todos.map((todo, index) => {
      const statusIcon: Record<string, string> = {
        'pending': '⬜',
        'in_progress': '🔄',
        'completed': '✅',
        'cancelled': '❌',
      };
      return `${index + 1}. ${statusIcon[todo.status]} ${todo.content}`;
    }).join('\n');
  }
}

// Singleton instance
export const strandsAgent = new StrandsAgentService();

