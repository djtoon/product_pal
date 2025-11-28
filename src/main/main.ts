import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { setupIpcHandlers } from './ipc-handlers';
import { createMenu } from './menu';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    frame: false, // Completely frameless window
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    icon: path.join(__dirname, '../../assets/icons/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Remove the native menu bar completely - we use custom menu in renderer
  Menu.setApplicationMenu(null);

  // Window control handlers
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    mainWindow?.close();
  });

  // Send maximize state changes to renderer
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized', false);
  });

  // Relay menu events from custom title bar back to renderer
  ipcMain.on('menu:openFolder', () => {
    mainWindow?.webContents.send('menu:openFolder');
  });

  ipcMain.on('menu:newFile', () => {
    mainWindow?.webContents.send('menu:newFile');
  });

  ipcMain.on('menu:save', () => {
    mainWindow?.webContents.send('menu:save');
  });

  ipcMain.on('menu:newTemplate', (_, templateType: string) => {
    mainWindow?.webContents.send('menu:newTemplate', templateType);
  });

  ipcMain.on('menu:saveAsTemplate', () => {
    console.log('[main.ts] Received menu:saveAsTemplate, forwarding to renderer');
    mainWindow?.webContents.send('menu:saveAsTemplate');
  });

  ipcMain.on('menu:openTemplatesFolder', () => {
    console.log('[main.ts] Received menu:openTemplatesFolder, forwarding to renderer');
    mainWindow?.webContents.send('menu:openTemplatesFolder');
  });

  ipcMain.on('menu:setTheme', (_, theme: string) => {
    mainWindow?.webContents.send('menu:setTheme', theme);
  });
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers(mainWindow!);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

export { mainWindow };

