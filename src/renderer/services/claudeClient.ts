import { BedrockRuntimeClient, ConverseCommand, Tool, ToolSpecification, ToolInputSchema } from '@aws-sdk/client-bedrock-runtime';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface AIResponse {
  text: string;
  thinking?: string; // Extended thinking content
  toolUse?: ToolCall;
  toolUses?: ToolCall[]; // Support multiple tool calls
  stopReason: string;
}

export interface AIClientConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  modelId: string;
  systemPrompt?: string;
}

export interface MCPToolDefinition {
  name: string;
  serverName: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

// Define the tools available to Claude
const createTools = (): Tool[] => {
  return [
    {
      toolSpec: {
        name: 'list_directory',
        description: 'List contents of the user\'s workspace folder. The workspace folder is specified in the [Current Working Folder: ...] context. All paths are relative to this workspace.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'OPTIONAL: Relative path to a subfolder within the workspace (e.g., "src" or "docs/api"). Leave EMPTY or omit entirely to list the workspace root. Do NOT use "." - just omit the parameter or use empty string.'
              }
            },
            required: []
          }
        } as ToolInputSchema
      } as ToolSpecification
    },
    {
      toolSpec: {
        name: 'read_file',
        description: 'Read the contents of a file in the user\'s workspace. Use relative paths only (e.g., "README.md" or "src/index.ts").',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'Relative path to the file within the workspace (e.g., "package.json", "src/main.ts"). Do NOT use absolute paths.'
              }
            },
            required: ['file_path']
          }
        } as ToolInputSchema
      } as ToolSpecification
    },
    {
      toolSpec: {
        name: 'write_file',
        description: 'Create or update a file. CRITICAL: Both file_path and content are MANDATORY. Never call this tool without providing the full file content in the content parameter. The tool will fail if content is missing or empty.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'REQUIRED: Relative path for the file (e.g., "docs/PRD.md"). Must be provided.'
              },
              content: {
                type: 'string',
                description: 'REQUIRED: The COMPLETE file content as a string. This is MANDATORY - the tool will fail without it. Include the entire file content here.'
              }
            },
            required: ['file_path', 'content']
          }
        } as ToolInputSchema
      } as ToolSpecification
    },
    {
      toolSpec: {
        name: 'create_directory',
        description: 'Create a new directory in the user\'s workspace. Use relative paths only.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              dir_path: {
                type: 'string',
                description: 'Relative path for the new directory within the workspace (e.g., "docs/specs").'
              }
            },
            required: ['dir_path']
          }
        } as ToolInputSchema
      } as ToolSpecification
    },
    {
      toolSpec: {
        name: 'delete_file',
        description: 'Delete a file or directory from the user\'s workspace. Use relative paths only.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'Relative path to the file or directory to delete within the workspace.'
              }
            },
            required: ['file_path']
          }
        } as ToolInputSchema
      } as ToolSpecification
    },
    {
      toolSpec: {
        name: 'read_templates',
        description: 'Read available document templates. Returns a list of templates with their names and content. Use these templates as a starting point when creating PRDs, tech specs, user stories, or other product documents. Always check available templates before creating new documents.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              template_name: {
                type: 'string',
                description: 'OPTIONAL: Specific template filename to read (e.g., "prd-template.md"). If omitted, returns a list of all available templates with their content.'
              }
            },
            required: []
          }
        } as ToolInputSchema
      } as ToolSpecification
    },
    {
      toolSpec: {
        name: 'create_todo_list',
        description: 'Create a todo list to track progress on the current task. Use this at the START of any multi-step task to plan and track work. The todo list is displayed to the user and helps them understand your progress.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                description: 'Array of todo items to create. Each item should be a clear, actionable step.',
                items: {
                  type: 'object',
                  properties: {
                    content: {
                      type: 'string',
                      description: 'Description of the task to complete'
                    },
                    status: {
                      type: 'string',
                      enum: ['pending', 'in_progress'],
                      description: 'Initial status. Use "in_progress" for the first task you will work on immediately.'
                    }
                  },
                  required: ['content']
                }
              }
            },
            required: ['items']
          }
        } as ToolInputSchema
      } as ToolSpecification
    },
    {
      toolSpec: {
        name: 'update_todo',
        description: 'Update a todo item status. Use this to mark tasks as completed, in_progress, or cancelled. Update todos as you complete each step to keep the user informed of your progress.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              todo_id: {
                type: 'string',
                description: 'Todo number (1, 2, 3...) or exact ID to update'
              },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed', 'cancelled'],
                description: 'New status for the todo item'
              },
              content: {
                type: 'string',
                description: 'OPTIONAL: New content/description for the todo item'
              }
            },
            required: ['todo_id', 'status']
          }
        } as ToolInputSchema
      } as ToolSpecification
    },
    {
      toolSpec: {
        name: 'read_todo_list',
        description: 'Read the current todo list to check progress. Use this periodically during long tasks to verify you are on track and haven\'t missed any steps.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {},
            required: []
          }
        } as ToolInputSchema
      } as ToolSpecification
    }
  ];
};

export class ClaudeBedrockClient {
  private client: BedrockRuntimeClient;
  private modelId: string;
  private systemPrompt: string;
  private conversationHistory: any[] = [];
  private builtInTools: Tool[];
  private mcpTools: MCPToolDefinition[] = [];

  constructor(config: AIClientConfig) {
    this.client = new BedrockRuntimeClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
    this.modelId = config.modelId;
    this.systemPrompt = config.systemPrompt || 'You are a helpful AI assistant for product managers.';
    this.builtInTools = createTools();
  }

  // Set MCP tools from connected servers
  setMCPTools(tools: MCPToolDefinition[]) {
    this.mcpTools = tools;
    console.log(`[ClaudeClient] MCP tools updated: ${tools.length} tools from ${new Set(tools.map(t => t.serverName)).size} servers`);
  }

  // Get all tools including MCP tools
  private getAllTools(): Tool[] {
    const allTools = [...this.builtInTools];
    
    // Convert MCP tools to Bedrock format
    for (const mcpTool of this.mcpTools) {
      allTools.push({
        toolSpec: {
          name: `mcp_${mcpTool.serverName}_${mcpTool.name}`,
          description: `[MCP: ${mcpTool.serverName}] ${mcpTool.description}`,
          inputSchema: {
            json: mcpTool.inputSchema
          } as ToolInputSchema
        } as ToolSpecification
      });
    }
    
    return allTools;
  }

  // Check if a tool is an MCP tool
  isMCPTool(toolName: string): boolean {
    return toolName.startsWith('mcp_');
  }

  // Parse MCP tool name to get server and tool name
  parseMCPToolName(toolName: string): { serverName: string; toolName: string } | null {
    if (!toolName.startsWith('mcp_')) return null;
    const parts = toolName.substring(4).split('_');
    if (parts.length < 2) return null;
    const serverName = parts[0];
    const actualToolName = parts.slice(1).join('_');
    return { serverName, toolName: actualToolName };
  }

  async sendMessage(userMessage: string, context?: { workspacePath?: string; currentFile?: string; mcpServers?: string[] }): Promise<AIResponse> {
    // Build context prefix
    let contextPrefix = '';
    if (context?.workspacePath) {
      contextPrefix += `[Current Working Folder: ${context.workspacePath}]\n`;
    }
    if (context?.currentFile) {
      contextPrefix += `[Current Open File: ${context.currentFile}]\n`;
    }
    if (context?.mcpServers && context.mcpServers.length > 0) {
      contextPrefix += `[Connected MCP Servers: ${context.mcpServers.join(', ')}]\n`;
    }
    if (contextPrefix) {
      contextPrefix += '\n';
    }

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: [{ text: contextPrefix + userMessage }]
    });

    return this.callClaude();
  }

  async sendToolResult(toolUseId: string, result: string, isError: boolean = false): Promise<AIResponse> {
    // Add tool result to history
    this.conversationHistory.push({
      role: 'user',
      content: [{
        toolResult: {
          toolUseId: toolUseId,
          content: [{ text: result }],
          status: isError ? 'error' : 'success'
        }
      }]
    });

    return this.callClaude();
  }

  async sendMultipleToolResults(results: Array<{ toolUseId: string; result: string; isError?: boolean }>): Promise<AIResponse> {
    // Add all tool results in a single message
    this.conversationHistory.push({
      role: 'user',
      content: results.map(r => ({
        toolResult: {
          toolUseId: r.toolUseId,
          content: [{ text: r.result }],
          status: r.isError ? 'error' : 'success'
        }
      }))
    });

    return this.callClaude();
  }

  private async callClaude(): Promise<AIResponse> {
    try {
      const allTools = this.getAllTools();
      const command = new ConverseCommand({
        modelId: this.modelId,
        system: [{ text: this.systemPrompt }],
        messages: this.conversationHistory,
        toolConfig: {
          tools: allTools
        },
        inferenceConfig: {
          maxTokens: 16000
        },
        additionalModelRequestFields: {
          thinking: {
            type: 'enabled',
            budget_tokens: 10000
          }
        }
      });

      const response = await this.client.send(command);
      
      // Process response
      let text = '';
      let thinking = '';
      let toolUse: ToolCall | undefined;
      const toolUses: ToolCall[] = [];

      if (response.output?.message?.content) {
        // Add assistant response to history
        this.conversationHistory.push({
          role: 'assistant',
          content: response.output.message.content
        });

        for (const block of response.output.message.content) {
          if ('text' in block && block.text) {
            text += block.text;
          }
          // Handle extended thinking content
          if ('reasoningContent' in block && (block as any).reasoningContent?.reasoningText?.text) {
            thinking += (block as any).reasoningContent.reasoningText.text;
          }
          if ('toolUse' in block && block.toolUse) {
            const tu = block.toolUse;
            // Debug: log the raw tool use input
            console.log('[ClaudeClient] Tool use received:', tu.name, 'input:', JSON.stringify(tu.input, null, 2));
            
            const toolCall: ToolCall = {
              id: tu.toolUseId || '',
              name: tu.name || '',
              input: (typeof tu.input === 'object' && tu.input !== null ? tu.input : {}) as Record<string, any>
            };
            toolUses.push(toolCall);
            // Keep first one for backward compatibility
            if (!toolUse) {
              toolUse = toolCall;
            }
          }
        }
      }

      return {
        text,
        thinking: thinking || undefined,
        toolUse,
        toolUses: toolUses.length > 0 ? toolUses : undefined,
        stopReason: response.stopReason || 'end_turn'
      };
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  async testConnection(): Promise<boolean> {
    try {
      const command = new ConverseCommand({
        modelId: this.modelId,
        messages: [
          {
            role: 'user',
            content: [{ text: 'Hi' }]
          }
        ],
        inferenceConfig: {
          maxTokens: 10
        }
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}
