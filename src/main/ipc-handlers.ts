import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as fss from 'fs';
import * as path from 'path';
import { FileItem } from '../shared/types';
import { mcpManager, MCPServerConfig } from './mcp-client';

// Get settings file path in user data directory
const getSettingsPath = () => {
  return path.join(app.getPath('userData'), 'settings.json');
};

// Get templates directory path (in app folder)
const getTemplatesPath = () => {
  // Use app directory for templates (works in dev and production)
  const appPath = app.isPackaged 
    ? path.dirname(app.getPath('exe'))  // Production: next to the .exe
    : path.join(__dirname, '../../');    // Development: project root
  return path.join(appPath, 'templates');
};


// File watcher instance
let currentWatcher: fss.FSWatcher | null = null;
let watchedPath: string | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

// Debounced function to notify renderer of file changes
const notifyFileChange = (mainWindow: BrowserWindow | null) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  debounceTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('fs:changed');
    }
  }, 300); // 300ms debounce to avoid rapid-fire events
};

export function setupIpcHandlers(mainWindow?: BrowserWindow) {
  // Forward MCP logs to renderer for terminal display
  mcpManager.on('log', (log) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mcp:log', log);
    }
  });

  // Open folder dialog
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Read directory recursively
  ipcMain.handle('fs:readDirectory', async (event, dirPath: string) => {
    try {
      const items = await readDirectoryRecursive(dirPath);
      return items;
    } catch (error) {
      console.error('Error reading directory:', error);
      return [];
    }
  });

  // Read file content
  ipcMain.handle('fs:readFile', async (event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  });

  // Write file content
  ipcMain.handle('fs:writeFile', async (event, filePath: string, content: string) => {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error('Error writing file:', error);
      throw error;
    }
  });

  // Create new file
  ipcMain.handle('fs:createFile', async (event, filePath: string) => {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, '', 'utf-8');
      return true;
    } catch (error) {
      console.error('Error creating file:', error);
      throw error;
    }
  });

  // Create new directory
  ipcMain.handle('fs:createDirectory', async (event, dirPath: string) => {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return true;
    } catch (error) {
      console.error('Error creating directory:', error);
      throw error;
    }
  });

  // Delete file or directory
  ipcMain.handle('fs:delete', async (event, itemPath: string) => {
    try {
      const stats = await fs.stat(itemPath);
      if (stats.isDirectory()) {
        await fs.rm(itemPath, { recursive: true });
      } else {
        await fs.unlink(itemPath);
      }
      return true;
    } catch (error) {
      console.error('Error deleting:', error);
      throw error;
    }
  });

  // Rename file or directory
  ipcMain.handle('fs:rename', async (event, oldPath: string, newPath: string) => {
    try {
      await fs.rename(oldPath, newPath);
      return true;
    } catch (error) {
      console.error('Error renaming:', error);
      throw error;
    }
  });

  // Copy file
  ipcMain.handle('fs:copyFile', async (event, sourcePath: string, destPath: string) => {
    try {
      await fs.copyFile(sourcePath, destPath);
      return true;
    } catch (error) {
      console.error('Error copying file:', error);
      throw error;
    }
  });

  // Check if file/folder exists
  ipcMain.handle('fs:exists', async (event, itemPath: string) => {
    try {
      await fs.access(itemPath);
      return true;
    } catch {
      return false;
    }
  });

  // Get unique path (auto-rename if exists)
  ipcMain.handle('fs:getUniquePath', async (event, targetPath: string) => {
    let uniquePath = targetPath;
    let counter = 1;
    const ext = path.extname(targetPath);
    const base = path.basename(targetPath, ext);
    const dir = path.dirname(targetPath);
    
    const fileExists = async (p: string) => {
      try {
        await fs.access(p);
        return true;
      } catch {
        return false;
      }
    };
    
    while (await fileExists(uniquePath)) {
      uniquePath = path.join(dir, `${base} (${counter})${ext}`);
      counter++;
    }
    return uniquePath;
  });

  // Copy directory recursively
  ipcMain.handle('fs:copyDirectory', async (event, sourcePath: string, destPath: string) => {
    try {
      await copyDirectoryRecursive(sourcePath, destPath);
      return true;
    } catch (error) {
      console.error('Error copying directory:', error);
      throw error;
    }
  });

  // Reveal in file explorer
  ipcMain.handle('fs:revealInExplorer', async (event, itemPath: string) => {
    const { shell } = require('electron');
    shell.showItemInFolder(itemPath);
    return true;
  });

  // Save settings to file
  ipcMain.handle('settings:save', async (event, settings: any) => {
    try {
      const settingsPath = getSettingsPath();
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  });

  // Load settings from file
  ipcMain.handle('settings:load', async () => {
    try {
      const settingsPath = getSettingsPath();
      const content = await fs.readFile(settingsPath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      // Return null if file doesn't exist
      if (error.code === 'ENOENT') {
        return null;
      }
      console.error('Error loading settings:', error);
      throw error;
    }
  });

  // Start watching a directory for changes
  ipcMain.handle('fs:watch', async (event, dirPath: string) => {
    try {
      // Skip if already watching this path
      if (watchedPath === dirPath && currentWatcher) {
        console.log(`[WATCHER] Already watching: ${dirPath}`);
        return true;
      }
      
      // Stop existing watcher if any
      if (currentWatcher) {
        currentWatcher.close();
        currentWatcher = null;
      }

      watchedPath = dirPath;
      
      // Use recursive watch on the directory
      currentWatcher = fss.watch(dirPath, { recursive: true }, (eventType, filename) => {
        // Skip hidden files and node_modules
        if (filename && (filename.startsWith('.') || filename.includes('node_modules'))) {
          return;
        }
        
        console.log(`[WATCHER] File ${eventType}: ${filename}`);
        console.log(`[WATCHER] Sending fs:changed event to renderer`);
        notifyFileChange(mainWindow || null);
      });

      currentWatcher.on('error', (error) => {
        console.error('Watcher error:', error);
      });

      console.log(`Started watching: ${dirPath}`);
      return true;
    } catch (error) {
      console.error('Error setting up watcher:', error);
      return false;
    }
  });

  // Stop watching
  ipcMain.handle('fs:unwatch', async () => {
    if (currentWatcher) {
      currentWatcher.close();
      currentWatcher = null;
      watchedPath = null;
      console.log('Stopped watching');
    }
    return true;
  });

  // Initialize templates - just returns the path (templates are in app folder)
  ipcMain.handle('templates:init', async () => {
    try {
      const templatesPath = getTemplatesPath();
      console.log('Templates path:', templatesPath);
      return templatesPath;
    } catch (error) {
      console.error('Error initializing templates:', error);
      throw error;
    }
  });

  // List all templates
  ipcMain.handle('templates:list', async () => {
    try {
      const templatesPath = getTemplatesPath();
      const files = await fs.readdir(templatesPath);
      const templates: { id: string; name: string; filename: string }[] = [];
      
      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.prd')) {
          // Generate a nice name from filename
          const name = file
            .replace(/\.md$|\.prd$/, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
          
          templates.push({
            id: file.replace(/\.md$|\.prd$/, ''),
            name,
            filename: file
          });
        }
      }
      
      return templates;
    } catch (error) {
      console.error('Error listing templates:', error);
      return [];
    }
  });

  // Read a specific template
  ipcMain.handle('templates:read', async (event, filename: string) => {
    try {
      const templatesPath = getTemplatesPath();
      const filePath = path.join(templatesPath, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error('Error reading template:', error);
      throw error;
    }
  });

  // Get templates folder path
  ipcMain.handle('templates:getPath', async () => {
    return getTemplatesPath();
  });

  // Open templates folder in file explorer
  ipcMain.handle('templates:openFolder', async () => {
    console.log('[ipc-handlers] templates:openFolder called');
    const { shell } = require('electron');
    const templatesPath = getTemplatesPath();
    console.log('[ipc-handlers] Templates path:', templatesPath);
    
    // Ensure the templates folder exists
    try {
      await fs.mkdir(templatesPath, { recursive: true });
      console.log('[ipc-handlers] Templates folder ensured');
    } catch (e) {
      console.log('[ipc-handlers] mkdir error (may be OK):', e);
    }
    
    // Open the folder
    console.log('[ipc-handlers] Calling shell.openPath...');
    const result = await shell.openPath(templatesPath);
    if (result) {
      console.error('[ipc-handlers] Error opening templates folder:', result);
    } else {
      console.log('[ipc-handlers] shell.openPath succeeded');
    }
    return true;
  });

  // Save content as a new template
  ipcMain.handle('templates:save', async (event, filename: string, content: string) => {
    try {
      const templatesPath = getTemplatesPath();
      
      // Ensure filename ends with .md or .prd
      let safeFilename = filename;
      if (!safeFilename.endsWith('.md') && !safeFilename.endsWith('.prd')) {
        safeFilename += '.md';
      }
      
      // Sanitize filename (remove invalid characters)
      safeFilename = safeFilename.replace(/[<>:"/\\|?*]/g, '-');
      
      const filePath = path.join(templatesPath, safeFilename);
      await fs.writeFile(filePath, content, 'utf-8');
      
      return { success: true, filename: safeFilename, path: filePath };
    } catch (error) {
      console.error('Error saving template:', error);
      throw error;
    }
  });

  // Read MCP config from workspace
  ipcMain.handle('mcp:read', async (event, workspacePath: string) => {
    try {
      const mcpPath = path.join(workspacePath, '.mcp.json');
      const content = await fs.readFile(mcpPath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return null
        return null;
      }
      console.error('Error reading MCP config:', error);
      throw error;
    }
  });

  // Write MCP config to workspace
  ipcMain.handle('mcp:write', async (event, workspacePath: string, config: any) => {
    try {
      const mcpPath = path.join(workspacePath, '.mcp.json');
      await fs.writeFile(mcpPath, JSON.stringify(config, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('Error writing MCP config:', error);
      throw error;
    }
  });

  // Connect to all MCP servers in config
  ipcMain.handle('mcp:connect', async (event, workspacePath: string) => {
    try {
      const mcpPath = path.join(workspacePath, '.mcp.json');
      const content = await fs.readFile(mcpPath, 'utf-8');
      const config = JSON.parse(content);
      
      const results: Record<string, { status: string; tools: any[]; error?: string }> = {};
      
      if (config?.mcpServers) {
        for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
          try {
            const connection = await mcpManager.connectToServer(name, serverConfig as MCPServerConfig);
            results[name] = {
              status: connection.status,
              tools: connection.tools,
              error: connection.error
            };
          } catch (err: any) {
            results[name] = {
              status: 'error',
              tools: [],
              error: err.message
            };
          }
        }
      }
      
      return results;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {}; // No config file
      }
      console.error('Error connecting to MCP servers:', error);
      throw error;
    }
  });

  // Disconnect all MCP servers
  ipcMain.handle('mcp:disconnect', async () => {
    await mcpManager.disconnectAll();
    return true;
  });

  // Get all connected MCP servers and their tools
  ipcMain.handle('mcp:getConnections', async () => {
    const connections = mcpManager.getAllConnections();
    return connections.map(c => ({
      name: c.name,
      status: c.status,
      tools: c.tools,
      error: c.error
    }));
  });

  // Reconnect a single MCP server
  ipcMain.handle('mcp:reconnect', async (event, workspacePath: string, serverName: string) => {
    try {
      // First disconnect the server
      await mcpManager.disconnectServer(serverName);
      
      // Read config and reconnect just this server
      const mcpPath = path.join(workspacePath, '.mcp.json');
      const content = await fs.readFile(mcpPath, 'utf-8');
      const config = JSON.parse(content);
      
      if (config?.mcpServers?.[serverName]) {
        const connection = await mcpManager.connectToServer(serverName, config.mcpServers[serverName] as MCPServerConfig);
        return {
          name: serverName,
          status: connection.status,
          tools: connection.tools,
          error: connection.error
        };
      }
      
      return { name: serverName, status: 'error', tools: [], error: 'Server not found in config' };
    } catch (error: any) {
      return { name: serverName, status: 'error', tools: [], error: error.message };
    }
  });

  // Get MCP connection status summary (for status indicator)
  ipcMain.handle('mcp:getStatus', async () => {
    const connections = mcpManager.getAllConnections();
    const total = connections.length;
    const connected = connections.filter(c => c.status === 'connected').length;
    const hasErrors = connections.some(c => c.status === 'error');
    
    return {
      total,
      connected,
      hasErrors,
      status: connected > 0 ? 'connected' : (hasErrors ? 'error' : 'disconnected')
    };
  });

  // Forward MCP status changes to renderer
  mcpManager.on('serverConnected', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mcp:statusChanged');
    }
  });
  
  mcpManager.on('serverDisconnected', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mcp:statusChanged');
    }
  });

  // Get all available tools from all connected servers
  ipcMain.handle('mcp:getTools', async () => {
    return mcpManager.getAllTools();
  });

  // Call an MCP tool
  ipcMain.handle('mcp:callTool', async (event, serverName: string, toolName: string, args: Record<string, any>) => {
    try {
      const result = await mcpManager.callTool(serverName, toolName, args);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}

// Helper function to copy directory recursively
async function copyDirectoryRecursive(source: string, destination: string): Promise<void> {
  await fs.mkdir(destination, { recursive: true });
  
  const entries = await fs.readdir(source, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectoryRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function readDirectoryRecursive(dirPath: string, depth: number = 0): Promise<FileItem[]> {
  const items: FileItem[] = [];
  
  if (depth > 5) return items; // Limit recursion depth

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      // Skip hidden files and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const item: FileItem = {
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory()
      };

      if (entry.isDirectory()) {
        item.children = await readDirectoryRecursive(fullPath, depth + 1);
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
