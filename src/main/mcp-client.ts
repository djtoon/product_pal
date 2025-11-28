import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface MCPServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: 'stdio' | 'sse' | 'http';
  url?: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

export interface MCPServerConnection {
  name: string;
  config: MCPServerConfig;
  process?: ChildProcess;
  sseEndpoint?: string; // For SSE servers - endpoint to POST requests
  status: 'connected' | 'disconnected' | 'error';
  tools: MCPTool[];
  error?: string;
}

interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

export class MCPClientManager extends EventEmitter {
  private connections: Map<string, MCPServerConnection> = new Map();
  private requestId = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private messageBuffers: Map<string, string> = new Map();

  // Emit log for terminal display
  private emitLog(serverName: string, type: 'stdout' | 'stderr' | 'info' | 'error', message: string) {
    this.emit('log', { serverName, type, message });
  }

  async connectToServer(name: string, config: MCPServerConfig): Promise<MCPServerConnection> {
    // Disconnect existing connection if any
    await this.disconnectServer(name);

    const connection: MCPServerConnection = {
      name,
      config,
      status: 'disconnected',
      tools: []
    };

    try {
      // Auto-detect SSE/HTTP servers by presence of url
      const isHttpServer = config.type === 'sse' || config.type === 'http' || config.url;
      
      if (isHttpServer) {
        // Handle SSE/HTTP servers
        return await this.connectToSSEServer(name, config, connection);
      }

      // Stdio server - spawn the process
      if (!config.command) {
        throw new Error('Command is required for stdio servers');
      }

      const env = { ...process.env, ...config.env };
      const isWindows = process.platform === 'win32';
      
      let command = config.command;
      let args = config.args || [];
      
      if (isWindows) {
        // On Windows, certain commands need special handling
        const fs = require('fs');
        
        if (config.command === 'npx') {
          // Transform npx command to use node directly when possible
          const filteredArgs = args.filter(a => a !== '-y' && a !== '--yes');
          if (filteredArgs.length > 0) {
            const packageName = filteredArgs[0];
            const remainingArgs = filteredArgs.slice(1);
            
            // Try to find the globally installed package
            const npmGlobalPath = process.env.APPDATA 
              ? `${process.env.APPDATA}\\npm\\node_modules\\${packageName}\\dist\\index.js`
              : null;
            
            if (npmGlobalPath && fs.existsSync(npmGlobalPath)) {
              command = 'node';
              args = [npmGlobalPath, ...remainingArgs];
              console.log(`[MCP ${name}] Using global install: ${npmGlobalPath}`);
            } else {
              // Fallback: use npx.cmd
              command = 'npx.cmd';
              console.log(`[MCP ${name}] Package not found globally, using npx.cmd`);
            }
          }
        } else if (config.command === 'uvx' || config.command === 'uv') {
          // uvx/uv might be .exe or .cmd on Windows
          // Try to find it with extensions
          const { execSync } = require('child_process');
          try {
            const result = execSync(`where ${config.command}`, { encoding: 'utf8', timeout: 5000 });
            const foundPath = result.trim().split('\n')[0];
            if (foundPath) {
              command = foundPath;
              console.log(`[MCP ${name}] Found ${config.command} at: ${foundPath}`);
            }
          } catch (e) {
            // Command not found, will fail gracefully
            console.log(`[MCP ${name}] ${config.command} not found, will try anyway`);
            this.emitLog(name, 'error', `${config.command} not found on system. Install it with: pip install uv`);
          }
        }
      }
      
      const spawnMsg = `Spawning: ${command} ${args.join(' ')}`;
      console.log(`[MCP ${name}] ${spawnMsg}`);
      this.emitLog(name, 'info', spawnMsg);
      
      const proc = spawn(command, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: isWindows // Use shell on Windows to handle command resolution
      });

      connection.process = proc;
      this.messageBuffers.set(name, '');

      // Handle stdout (JSON-RPC messages)
      proc.stdout?.on('data', (data: Buffer) => {
        this.handleServerData(name, data.toString());
      });

      // Handle stderr (logging) - emit to terminal
      proc.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) {
          console.log(`[MCP ${name}] stderr:`, msg);
          this.emitLog(name, 'stderr', msg);
        }
      });

      // Track if process errored before we could initialize
      let processError: Error | null = null;
      let initializationComplete = false;

      proc.on('error', (err) => {
        console.error(`[MCP ${name}] Process error:`, err);
        this.emitLog(name, 'error', `Process error: ${err.message}`);
        processError = err;
        connection.status = 'error';
        connection.error = err.message;
      });

      // Handle process exit - but only mark as disconnected AFTER initialization
      // On Windows with shell commands, the shell may exit while node continues
      proc.on('exit', (code) => {
        const exitMsg = `Process exited with code ${code}`;
        console.log(`[MCP ${name}] ${exitMsg}`);
        this.emitLog(name, 'info', exitMsg);
        // Only mark as disconnected if we were previously connected
        // During initialization, the shell might exit but the actual process continues
        if (initializationComplete) {
          const conn = this.connections.get(name);
          if (conn) {
            conn.status = 'disconnected';
            conn.process = undefined;
          }
          this.emit('serverDisconnected', name);
        }
      });

      // Store connection early so we can track it
      this.connections.set(name, connection);

      // Wait a bit for the process to start and check for immediate errors
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (processError) {
        throw processError;
      }
      
      if (!proc.pid) {
        throw new Error('Process failed to start');
      }

      const startMsg = `Process started with PID ${proc.pid}, initializing...`;
      console.log(`[MCP ${name}] ${startMsg}`);
      this.emitLog(name, 'info', startMsg);

      // Initialize the connection
      await this.initialize(name);
      
      // List available tools
      const tools = await this.listTools(name);
      connection.tools = tools;
      connection.status = 'connected';
      initializationComplete = true;

      console.log(`[MCP ${name}] Connected with ${tools.length} tools`);
      this.emit('serverConnected', name, connection);
      
      return connection;
    } catch (error: any) {
      connection.status = 'error';
      connection.error = error.message;
      this.connections.set(name, connection);
      return connection;
    }
  }

  // Connect to SSE/HTTP MCP server
  // SSE MCP Protocol: 
  // 1. Connect to SSE endpoint (GET) - server sends "endpoint" event with message URL
  // 2. POST JSON-RPC requests to message endpoint
  // 3. Responses come back through SSE stream (matched by request ID)
  private async connectToSSEServer(name: string, config: MCPServerConfig, connection: MCPServerConnection): Promise<MCPServerConnection> {
    const url = config.url;
    if (!url) {
      connection.status = 'error';
      connection.error = 'URL is required for SSE/HTTP servers';
      this.connections.set(name, connection);
      return connection;
    }

    const msg = `Connecting to SSE server: ${url}`;
    console.log(`[MCP ${name}] ${msg}`);
    this.emitLog(name, 'info', msg);

    try {
      const http = require('http');
      const https = require('https');
      const { URL } = require('url');
      
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      // Default message endpoint - may be overridden by SSE "endpoint" event
      const baseUrl = url.replace(/\/sse\/?$/, '');
      connection.sseEndpoint = `${baseUrl}/message`;
      this.connections.set(name, connection);

      // Buffer for SSE data
      let sseBuffer = '';
      
      // Connect to SSE endpoint
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        const req = client.get(url, {
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            ...config.headers
          }
        }, (res: any) => {
          clearTimeout(timeout);
          
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            return;
          }

          console.log(`[MCP ${name}] SSE connection established`);
          this.emitLog(name, 'info', 'SSE connection established');

          // Parse SSE events
          res.on('data', (chunk: Buffer) => {
            sseBuffer += chunk.toString();
            
            // Process complete events (double newline separated)
            const events = sseBuffer.split('\n\n');
            sseBuffer = events.pop() || ''; // Keep incomplete event
            
            for (const eventBlock of events) {
              if (!eventBlock.trim()) continue;
              
              let eventType = 'message';
              let eventData = '';
              
              for (const line of eventBlock.split('\n')) {
                if (line.startsWith('event: ')) {
                  eventType = line.substring(7).trim();
                } else if (line.startsWith('data: ')) {
                  eventData += line.substring(6);
                }
              }
              
              if (eventData) {
                this.handleSSEEvent(name, eventType, eventData, connection);
              }
            }
          });

          res.on('end', () => {
            console.log(`[MCP ${name}] SSE connection closed`);
            this.emitLog(name, 'info', 'SSE connection closed');
            const conn = this.connections.get(name);
            if (conn) {
              conn.status = 'disconnected';
            }
            this.emit('serverDisconnected', name);
          });

          res.on('error', (err: Error) => {
            console.error(`[MCP ${name}] SSE stream error:`, err.message);
            this.emitLog(name, 'error', err.message);
          });

          // Connected - resolve after short delay to allow endpoint event
          setTimeout(resolve, 500);
        });

        req.on('error', (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Initialize the connection
      console.log(`[MCP ${name}] Sending initialize request to ${connection.sseEndpoint}`);
      await this.initializeSSE(name);
      
      // List tools
      const tools = await this.listToolsSSE(name);
      connection.tools = tools;
      connection.status = 'connected';

      console.log(`[MCP ${name}] Connected with ${tools.length} tools`);
      this.emitLog(name, 'info', `Connected with ${tools.length} tools`);
      this.emit('serverConnected', name, connection);

      return connection;
    } catch (error: any) {
      const errMsg = error.message || 'Failed to connect';
      console.error(`[MCP ${name}] SSE connection error:`, errMsg);
      this.emitLog(name, 'error', errMsg);
      connection.status = 'error';
      connection.error = errMsg;
      this.connections.set(name, connection);
      return connection;
    }
  }

  private handleSSEEvent(name: string, eventType: string, data: string, connection: MCPServerConnection) {
    console.log(`[MCP ${name}] SSE event: ${eventType}`);
    
    if (eventType === 'endpoint') {
      // Server tells us where to send messages
      const endpoint = data.trim();
      if (endpoint) {
        // Handle relative or absolute URLs
        const { URL } = require('url');
        try {
          const baseUrl = new URL(connection.config.url!);
          const messageUrl = new URL(endpoint, baseUrl);
          connection.sseEndpoint = messageUrl.href;
          console.log(`[MCP ${name}] Message endpoint: ${connection.sseEndpoint}`);
          this.emitLog(name, 'info', `Message endpoint: ${connection.sseEndpoint}`);
        } catch (e) {
          console.error(`[MCP ${name}] Invalid endpoint URL: ${endpoint}`);
        }
      }
    } else if (eventType === 'message') {
      // JSON-RPC response
      try {
        const message = JSON.parse(data);
        this.handleServerMessage(name, message);
      } catch (e) {
        console.error(`[MCP ${name}] Invalid JSON in SSE message: ${data.substring(0, 100)}`);
      }
    }
  }

  private async initializeSSE(name: string): Promise<void> {
    console.log(`[MCP ${name}] Sending SSE initialize request...`);
    const result = await this.sendSSERequest(name, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'Collie',
        version: '0.1.0'
      }
    });
    console.log(`[MCP ${name}] SSE Initialize response:`, JSON.stringify(result || {}).substring(0, 200));
  }

  private async listToolsSSE(name: string): Promise<MCPTool[]> {
    try {
      const result = await this.sendSSERequest(name, 'tools/list', {});
      return result?.tools || [];
    } catch (error) {
      console.error(`[MCP ${name}] Failed to list SSE tools:`, error);
      return [];
    }
  }

  private async sendSSERequest(name: string, method: string, params?: any): Promise<any> {
    const connection = this.connections.get(name);
    if (!connection?.sseEndpoint) {
      throw new Error(`SSE server ${name} not connected`);
    }

    const http = require('http');
    const https = require('https');
    const { URL } = require('url');
    
    const parsedUrl = new URL(connection.sseEndpoint);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const id = ++this.requestId;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      // Set up listener for response via SSE stream
      const responseHandler = (result: any) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        resolve(result);
      };
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`SSE request timeout for ${method}`));
      }, 15000);

      // Register pending request - response will come via SSE
      this.pendingRequests.set(id, { 
        resolve: responseHandler, 
        reject: (err: any) => {
          clearTimeout(timeout);
          reject(err);
        }
      });

      const postData = JSON.stringify(request);
      console.log(`[MCP ${name}] POST ${connection.sseEndpoint}: ${method}`);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + (parsedUrl.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...connection.config.headers
        }
      };

      const req = client.request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          // Some servers return response directly, others via SSE
          if (data && data.trim()) {
            try {
              const response = JSON.parse(data);
              if (response.jsonrpc) {
                // Direct JSON-RPC response
                clearTimeout(timeout);
                this.pendingRequests.delete(id);
                if (response.error) {
                  reject(new Error(response.error.message));
                } else {
                  resolve(response.result);
                }
              } else if (response.error) {
                clearTimeout(timeout);
                this.pendingRequests.delete(id);
                reject(new Error(response.error.message || JSON.stringify(response.error)));
              }
              // else: wait for SSE response
            } catch (e) {
              // Not JSON - might be "accepted" or similar, wait for SSE response
              console.log(`[MCP ${name}] POST response (non-JSON): ${data.substring(0, 50)}`);
            }
          }
          // If no direct response, keep waiting for SSE
        });
      });

      req.on('error', (err: Error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(err);
      });

      req.write(postData);
      req.end();
    });
  }

  private handleServerData(name: string, data: string) {
    let buffer = this.messageBuffers.get(name) || '';
    buffer += data;

    // Process complete JSON-RPC messages (newline-delimited)
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer
    this.messageBuffers.set(name, buffer);

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        this.handleServerMessage(name, message);
      } catch (e) {
        console.error(`[MCP ${name}] Failed to parse message:`, line);
      }
    }
  }

  private handleServerMessage(name: string, message: JSONRPCResponse) {
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    }
  }

  private async sendRequest(name: string, method: string, params?: any): Promise<any> {
    const connection = this.connections.get(name);
    if (!connection?.process?.stdin) {
      throw new Error(`Server ${name} not connected`);
    }

    const id = ++this.requestId;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        console.error(`[MCP] Request timeout for ${method} (id: ${id})`);
        reject(new Error(`Request timeout for ${method}`));
      }, 10000); // 10 second timeout

      connection.process!.stdin!.write(JSON.stringify(request) + '\n', (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          reject(err);
        }
      });

      // Clear timeout on response
      const originalResolve = this.pendingRequests.get(id)?.resolve;
      if (originalResolve) {
        this.pendingRequests.set(id, {
          resolve: (result: any) => {
            clearTimeout(timeout);
            originalResolve(result);
          },
          reject: (err: any) => {
            clearTimeout(timeout);
            reject(err);
          }
        });
      }
    });
  }

  private async initialize(name: string): Promise<void> {
    console.log(`[MCP ${name}] Sending initialize request...`);
    const result = await this.sendRequest(name, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'Collie',
        version: '0.1.0'
      }
    });
    console.log(`[MCP ${name}] Initialize response:`, JSON.stringify(result).substring(0, 200));

    // Send initialized notification
    const connection = this.connections.get(name);
    if (connection?.process?.stdin) {
      const notification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      };
      connection.process.stdin.write(JSON.stringify(notification) + '\n');
    }
  }

  private async listTools(name: string): Promise<MCPTool[]> {
    try {
      const result = await this.sendRequest(name, 'tools/list', {});
      return result.tools || [];
    } catch (error) {
      console.error(`[MCP ${name}] Failed to list tools:`, error);
      return [];
    }
  }

  async callTool(serverName: string, toolName: string, args: Record<string, any>): Promise<any> {
    const result = await this.sendRequest(serverName, 'tools/call', {
      name: toolName,
      arguments: args
    });
    return result;
  }

  async disconnectServer(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (connection?.process) {
      connection.process.kill();
      connection.process = undefined;
      connection.status = 'disconnected';
    }
    this.connections.delete(name);
    this.messageBuffers.delete(name);
  }

  async disconnectAll(): Promise<void> {
    for (const name of this.connections.keys()) {
      await this.disconnectServer(name);
    }
  }

  getConnection(name: string): MCPServerConnection | undefined {
    return this.connections.get(name);
  }

  getAllConnections(): MCPServerConnection[] {
    return Array.from(this.connections.values());
  }

  getAllTools(): Array<MCPTool & { serverName: string }> {
    const allTools: Array<MCPTool & { serverName: string }> = [];
    for (const [name, connection] of this.connections) {
      if (connection.status === 'connected') {
        for (const tool of connection.tools) {
          allTools.push({ ...tool, serverName: name });
        }
      }
    }
    return allTools;
  }
}

// Singleton instance
export const mcpManager = new MCPClientManager();

