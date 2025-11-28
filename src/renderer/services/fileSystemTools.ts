const { ipcRenderer } = window.require('electron');
const fs = window.require('fs');
const path = window.require('path');

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
}

export type TodoUpdateCallback = (todos: TodoItem[]) => void;

export class FileSystemTools {
  private workspacePath: string | null = null;
  private todos: TodoItem[] = [];
  private todoUpdateCallback: TodoUpdateCallback | null = null;

  setWorkspacePath(path: string | null) {
    this.workspacePath = path;
  }

  // Todo list management
  setTodoUpdateCallback(callback: TodoUpdateCallback | null) {
    this.todoUpdateCallback = callback;
  }

  getTodos(): TodoItem[] {
    return [...this.todos];
  }

  clearTodos() {
    this.todos = [];
    this.notifyTodoUpdate();
  }

  private notifyTodoUpdate() {
    if (this.todoUpdateCallback) {
      this.todoUpdateCallback([...this.todos]);
    }
  }

  async createTodoList(items: { content: string; status?: 'pending' | 'in_progress' }[]): Promise<ToolResult> {
    try {
      // Clear existing todos and create new list
      this.todos = items.map((item, index) => ({
        id: `todo-${Date.now()}-${index}`,
        content: item.content,
        status: item.status || 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }));

      this.notifyTodoUpdate();

      const output = this.formatTodoList();
      return {
        success: true,
        output: `Todo list created with ${this.todos.length} items:\n\n${output}`
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  async updateTodoItem(todoId: string, updates: { status?: TodoItem['status']; content?: string }): Promise<ToolResult> {
    try {
      const todoIndex = this.todos.findIndex(t => t.id === todoId);
      
      if (todoIndex === -1) {
        // Try to find by index number (1-based)
        const indexNum = parseInt(todoId, 10);
        if (!isNaN(indexNum) && indexNum >= 1 && indexNum <= this.todos.length) {
          const todo = this.todos[indexNum - 1];
          if (updates.status) todo.status = updates.status;
          if (updates.content) todo.content = updates.content;
          todo.updatedAt = Date.now();
          
          this.notifyTodoUpdate();
          
          return {
            success: true,
            output: `Updated todo #${indexNum}: "${todo.content}" → ${todo.status}\n\n${this.formatTodoList()}`
          };
        }
        
        return {
          success: false,
          output: '',
          error: `Todo not found: ${todoId}. Use todo number (1, 2, 3...) or exact ID.`
        };
      }

      const todo = this.todos[todoIndex];
      if (updates.status) todo.status = updates.status;
      if (updates.content) todo.content = updates.content;
      todo.updatedAt = Date.now();

      this.notifyTodoUpdate();

      return {
        success: true,
        output: `Updated todo: "${todo.content}" → ${todo.status}\n\n${this.formatTodoList()}`
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  async readTodoList(): Promise<ToolResult> {
    try {
      if (this.todos.length === 0) {
        return {
          success: true,
          output: 'No todos in the current task. Create a todo list to track progress.'
        };
      }

      const output = this.formatTodoList();
      const completed = this.todos.filter(t => t.status === 'completed').length;
      const total = this.todos.length;
      const progress = Math.round((completed / total) * 100);

      return {
        success: true,
        output: `Task Progress: ${completed}/${total} (${progress}%)\n\n${output}`
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  private formatTodoList(): string {
    if (this.todos.length === 0) return 'No todos.';

    return this.todos.map((todo, index) => {
      const statusIcon = {
        'pending': '⬜',
        'in_progress': '🔄',
        'completed': '✅',
        'cancelled': '❌'
      }[todo.status];
      
      return `${index + 1}. ${statusIcon} ${todo.content}`;
    }).join('\n');
  }

  async listDirectory(dirPath?: string): Promise<ToolResult> {
    try {
      // Normalize path: treat ".", "./", empty, undefined as workspace root
      let normalizedPath = dirPath?.trim() || '';
      if (normalizedPath === '.' || normalizedPath === './') {
        normalizedPath = '';
      }
      
      // Resolve the target path
      let targetPath: string;
      if (!normalizedPath) {
        // Empty path = workspace root
        targetPath = this.workspacePath || process.cwd();
      } else if (this.workspacePath) {
        // Relative path within workspace
        targetPath = path.join(this.workspacePath, normalizedPath);
      } else {
        targetPath = normalizedPath;
      }
      
      const items = await ipcRenderer.invoke('fs:readDirectory', targetPath);
      
      const output = this.formatDirectoryTree(items, 0);
      return {
        success: true,
        output: `Directory listing for: ${targetPath}\n\n${output}`
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  async readFile(filePath: string): Promise<ToolResult> {
    try {
      const fullPath = this.resolvePath(filePath);
      const content = await ipcRenderer.invoke('fs:readFile', fullPath);
      
      return {
        success: true,
        output: `Content of ${filePath}:\n\n${content}`
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  async writeFile(filePath: string, content: string): Promise<ToolResult> {
    try {
      // Validate parameters
      if (!filePath) {
        return {
          success: false,
          output: '',
          error: 'file_path is required'
        };
      }
      
      // Ensure content is a string (default to empty string if undefined)
      const safeContent = content ?? '';
      
      const fullPath = this.resolvePath(filePath);
      await ipcRenderer.invoke('fs:writeFile', fullPath, safeContent);
      
      return {
        success: true,
        output: `File created/updated successfully: ${filePath}`
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  async createDirectory(dirPath: string): Promise<ToolResult> {
    try {
      const fullPath = this.resolvePath(dirPath);
      await ipcRenderer.invoke('fs:createDirectory', fullPath);
      
      return {
        success: true,
        output: `Directory created successfully: ${dirPath}`
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  async deleteFile(filePath: string): Promise<ToolResult> {
    try {
      const fullPath = this.resolvePath(filePath);
      await ipcRenderer.invoke('fs:delete', fullPath);
      
      return {
        success: true,
        output: `File/directory deleted successfully: ${filePath}`
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  async readTemplates(templateName?: string): Promise<ToolResult> {
    try {
      // Get list of available templates
      const templates = await ipcRenderer.invoke('templates:list');
      
      if (!templates || templates.length === 0) {
        return {
          success: true,
          output: 'No templates available. Templates folder is empty.'
        };
      }

      // If specific template requested, return just that one
      if (templateName) {
        const template = templates.find((t: any) => 
          t.filename === templateName || t.id === templateName.replace(/\.(md|prd)$/, '')
        );
        
        if (!template) {
          return {
            success: false,
            output: '',
            error: `Template not found: ${templateName}. Available templates: ${templates.map((t: any) => t.filename).join(', ')}`
          };
        }

        const content = await ipcRenderer.invoke('templates:read', template.filename);
        return {
          success: true,
          output: `Template: ${template.name} (${template.filename})\n\n---\n\n${content}`
        };
      }

      // Return all templates with their content
      let output = `Available Templates (${templates.length}):\n\n`;
      
      for (const template of templates) {
        const content = await ipcRenderer.invoke('templates:read', template.filename);
        output += `## ${template.name} (${template.filename})\n\n`;
        output += content;
        output += '\n\n---\n\n';
      }

      return {
        success: true,
        output
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  private resolvePath(filePath: string): string {
    // If absolute path, use as is
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    
    // If relative path and workspace exists, resolve relative to workspace
    if (this.workspacePath) {
      return path.join(this.workspacePath, filePath);
    }
    
    // Otherwise resolve relative to current working directory
    return path.resolve(filePath);
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

  // Execute tool based on name and parameters
  async executeTool(toolName: string, parameters: any): Promise<ToolResult> {
    // Ensure parameters is an object
    const params = parameters || {};
    
    switch (toolName) {
      case 'list_directory':
        return this.listDirectory(params.path);
      
      case 'read_file':
        if (!params.file_path) {
          return { success: false, output: '', error: 'Missing required parameter: file_path' };
        }
        return this.readFile(params.file_path);
      
      case 'write_file':
        // Debug: log received parameters
        console.log('[FileSystemTools] write_file params:', JSON.stringify(params, null, 2));
        console.log('[FileSystemTools] content type:', typeof params.content);
        console.log('[FileSystemTools] content length:', params.content?.length);
        
        if (!params.file_path) {
          return { success: false, output: '', error: 'Missing required parameter: file_path' };
        }
        if (params.content === undefined || params.content === null) {
          console.error('[FileSystemTools] write_file missing content. Full params:', params);
          return { success: false, output: '', error: 'Missing required parameter: content. You must provide the file content.' };
        }
        return this.writeFile(params.file_path, params.content);
      
      case 'create_directory':
        if (!params.dir_path) {
          return { success: false, output: '', error: 'Missing required parameter: dir_path' };
        }
        return this.createDirectory(params.dir_path);
      
      case 'delete_file':
        if (!params.file_path) {
          return { success: false, output: '', error: 'Missing required parameter: file_path' };
        }
        return this.deleteFile(params.file_path);
      
      case 'read_templates':
        return this.readTemplates(params.template_name);
      
      case 'create_todo_list':
        if (!params.items || !Array.isArray(params.items)) {
          return { success: false, output: '', error: 'Missing required parameter: items (array of {content, status?})' };
        }
        return this.createTodoList(params.items);
      
      case 'update_todo':
        if (!params.todo_id) {
          return { success: false, output: '', error: 'Missing required parameter: todo_id (number or ID)' };
        }
        return this.updateTodoItem(params.todo_id, { 
          status: params.status, 
          content: params.content 
        });
      
      case 'read_todo_list':
        return this.readTodoList();
      
      default:
        return {
          success: false,
          output: '',
          error: `Unknown tool: ${toolName}`
        };
    }
  }
}

export const fileSystemTools = new FileSystemTools();

