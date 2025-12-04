const { ipcRenderer } = window.require('electron');
const fs = window.require('fs');
const path = window.require('path');

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

// Mockup element types
export interface MockupElement {
  type: 'rect' | 'line' | 'text' | 'circle' | 'button' | 'input' | 'image-placeholder' | 'nav-bar' | 'card' | 'list-item';
  x: number;
  y: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  radius?: number;
  text?: string;
  fontSize?: number;
  fill?: boolean;
  dashed?: boolean;
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

  async createMockup(
    filePath: string,
    elements: MockupElement[],
    options: { width?: number; height?: number; title?: string } = {}
  ): Promise<ToolResult> {
    try {
      const width = options.width || 800;
      const height = options.height || 600;
      
      // Create an offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        return {
          success: false,
          output: '',
          error: 'Failed to create canvas context'
        };
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
      if (options.title) {
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(options.title, width / 2, 30);
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
            // Rounded rectangle button with text
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
            
            // Button text centered
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
            // Text input field
            const inputW = el.width || 200;
            const inputH = el.height || 32;
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(el.x, el.y, inputW, inputH);
            ctx.strokeRect(el.x, el.y, inputW, inputH);
            
            // Placeholder text
            if (el.text) {
              ctx.fillStyle = '#999999';
              ctx.textBaseline = 'middle';
              ctx.fillText(el.text, el.x + 8, el.y + inputH / 2);
              ctx.textBaseline = 'alphabetic';
            }
            break;

          case 'image-placeholder':
            // Crossed box representing an image
            const imgW = el.width || 100;
            const imgH = el.height || 100;
            
            ctx.fillStyle = '#F5F5F5';
            ctx.fillRect(el.x, el.y, imgW, imgH);
            ctx.strokeRect(el.x, el.y, imgW, imgH);
            
            // Draw X
            ctx.beginPath();
            ctx.moveTo(el.x, el.y);
            ctx.lineTo(el.x + imgW, el.y + imgH);
            ctx.moveTo(el.x + imgW, el.y);
            ctx.lineTo(el.x, el.y + imgH);
            ctx.stroke();
            
            // Optional label
            if (el.text) {
              ctx.fillStyle = '#666666';
              ctx.textAlign = 'center';
              ctx.fillText(el.text, el.x + imgW / 2, el.y + imgH + 16);
              ctx.textAlign = 'left';
            }
            break;

          case 'nav-bar':
            // Navigation bar at top
            const navW = el.width || width - 40;
            const navH = el.height || 50;
            
            ctx.fillStyle = '#F8F8F8';
            ctx.fillRect(el.x, el.y, navW, navH);
            ctx.strokeRect(el.x, el.y, navW, navH);
            
            // Nav title/brand
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
            // Card with optional title
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
            
            // Card title
            if (el.text) {
              ctx.fillStyle = '#000000';
              ctx.font = 'bold 14px Arial, sans-serif';
              ctx.fillText(el.text, el.x + 12, el.y + 24);
              ctx.font = '14px Arial, sans-serif';
              
              // Separator line under title
              ctx.beginPath();
              ctx.moveTo(el.x, el.y + 36);
              ctx.lineTo(el.x + cardW, el.y + 36);
              ctx.stroke();
            }
            break;

          case 'list-item':
            // List item with bullet
            const itemH = el.height || 32;
            const itemW = el.width || 200;
            
            // Bullet point
            ctx.beginPath();
            ctx.arc(el.x + 8, el.y + itemH / 2, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Text
            if (el.text) {
              ctx.fillStyle = '#000000';
              ctx.textBaseline = 'middle';
              ctx.fillText(el.text, el.x + 20, el.y + itemH / 2);
              ctx.textBaseline = 'alphabetic';
            }
            
            // Optional bottom border
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
      const buffer = Buffer.from(base64Data, 'base64');

      // Ensure file path ends with .png
      let outputPath = filePath;
      if (!outputPath.toLowerCase().endsWith('.png')) {
        outputPath += '.png';
      }

      // Resolve full path
      const fullPath = this.resolvePath(outputPath);

      // Ensure directory exists
      const dir = path.dirname(fullPath);
      try {
        await ipcRenderer.invoke('fs:createDirectory', dir);
      } catch {
        // Directory might already exist, that's fine
      }

      // Write the file
      await ipcRenderer.invoke('fs:writeFileBinary', fullPath, buffer);

      return {
        success: true,
        output: `Mockup created successfully: ${outputPath}\nDimensions: ${width}x${height}px\nElements drawn: ${elements.length}`
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
      
      case 'create_mockup':
        if (!params.file_path) {
          return { success: false, output: '', error: 'Missing required parameter: file_path' };
        }
        if (!params.elements || !Array.isArray(params.elements)) {
          return { success: false, output: '', error: 'Missing required parameter: elements (array of UI elements)' };
        }
        return this.createMockup(params.file_path, params.elements, {
          width: params.width,
          height: params.height,
          title: params.title
        });
      
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

