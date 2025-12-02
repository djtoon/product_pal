import { Menu, BrowserWindow, dialog } from 'electron';

export function createMenu(mainWindow: BrowserWindow): Menu {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu:openFolder');
          }
        },
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu:newFile');
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu:save');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            mainWindow.close();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Templates',
      submenu: [
        {
          label: 'New PRD',
          click: () => {
            mainWindow.webContents.send('menu:newTemplate', 'prd-template');
          }
        },
        {
          label: 'New Tech Spec',
          click: () => {
            mainWindow.webContents.send('menu:newTemplate', 'tech-spec-template');
          }
        },
        {
          label: 'New User Story',
          click: () => {
            mainWindow.webContents.send('menu:newTemplate', 'user-story-template');
          }
        },
        {
          label: 'New Kanban Board',
          click: () => {
            mainWindow.webContents.send('menu:newTemplate', 'kanban-template');
          }
        },
        {
          label: 'New Timeline',
          click: () => {
            mainWindow.webContents.send('menu:newTemplate', 'timeline-template');
          }
        },
        { type: 'separator' },
        {
          label: 'Save Current File as Template',
          click: () => {
            mainWindow.webContents.send('menu:saveAsTemplate');
          }
        },
        {
          label: 'Open Templates Folder',
          click: () => {
            mainWindow.webContents.send('menu:openTemplatesFolder');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Collie',
          click: async () => {
            await dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Collie',
              message: 'Collie v1.0.0 (Build: 2024-11-28)',
              detail: 'AI-powered document editor for Product Managers'
            });
          }
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}

