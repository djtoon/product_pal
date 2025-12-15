import React, { useEffect, useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import TitleBar from './components/TitleBar';
import IconSidebar from './components/IconSidebar';
import Sidebar from './components/Sidebar';
import EditorPane from './components/EditorPane';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
import SettingsPanel from './components/SettingsPanel';
import AIChat from './components/AIChat';
import WelcomeScreen from './components/WelcomeScreen';
import FileNameDialog from './components/FileNameDialog';
import MCPPanel from './components/MCPPanel';
import TerminalPanel from './components/TerminalPanel';
import StakeholdersPanel from './components/StakeholdersPanel';
import './styles/App.css';
import { AppSettings, DEFAULT_SETTINGS } from '../shared/settings';
import { Stakeholder } from '../shared/types';

const { ipcRenderer } = window.require('electron');

// Template type for dynamic loading
interface Template {
  id: string;
  name: string;
  filename: string;
}

const AppContent: React.FC = () => {
  const { addOpenFile, workspacePath, setWorkspacePath, setFileTree, refreshFileTree, currentFile } = useAppContext();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isMCPPanelOpen, setIsMCPPanelOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isStakeholdersPanelOpen, setIsStakeholdersPanelOpen] = useState(false);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [mcpStatus, setMcpStatus] = useState<'connected' | 'disconnected' | 'error' | 'loading'>('disconnected');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isFileNameDialogOpen, setIsFileNameDialogOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<{ type: string; content: string; defaultName: string } | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<Template[]>([]);
  const [isSaveTemplateDialogOpen, setIsSaveTemplateDialogOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('theme-dark');

  // Apply theme to document
  useEffect(() => {
    // Remove existing theme classes
    document.documentElement.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    // Add new theme class
    document.documentElement.classList.add(currentTheme);
    // Also save to localStorage
    localStorage.setItem('app-theme', currentTheme);
  }, [currentTheme]);

  // Load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme) {
      setCurrentTheme(savedTheme);
    }
  }, []);

  // Initialize templates and load settings
  useEffect(() => {
    // Initialize templates folder with defaults
    const initTemplates = async () => {
      try {
        await ipcRenderer.invoke('templates:init');
        const templates = await ipcRenderer.invoke('templates:list');
        setAvailableTemplates(templates);
      } catch (error) {
        console.error('Error initializing templates:', error);
      }
    };

    // Load stakeholders
    const loadStakeholders = async () => {
      try {
        const saved = await ipcRenderer.invoke('stakeholders:load');
        if (saved) {
          setStakeholders(saved);
        }
      } catch (error) {
        console.error('Error loading stakeholders:', error);
      }
    };

    initTemplates();
    loadStakeholders();
  }, []);

  useEffect(() => {
    // Load settings from file
    const loadSettings = async () => {
      try {
        const savedSettings = await ipcRenderer.invoke('settings:load');
        if (savedSettings) {
          setSettings(savedSettings);
          // Also cache in localStorage for quick access
          localStorage.setItem('appSettings', JSON.stringify(savedSettings));
        } else {
          // Fallback to localStorage
          const localSettings = localStorage.getItem('appSettings');
          if (localSettings) {
            setSettings(JSON.parse(localSettings));
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        // Fallback to localStorage
        const localSettings = localStorage.getItem('appSettings');
        if (localSettings) {
          setSettings(JSON.parse(localSettings));
        }
      }
    };

    loadSettings();

    // Load last workspace
    const savedWorkspace = localStorage.getItem('lastWorkspace');
    if (savedWorkspace) {
      handleOpenFolder(savedWorkspace);
    }
  }, []);

  const handleOpenFolder = async (folderPath?: string) => {
    const path = folderPath || await ipcRenderer.invoke('dialog:openFolder');
    if (path) {
      setWorkspacePath(path);
      localStorage.setItem('lastWorkspace', path);
      const files = await ipcRenderer.invoke('fs:readDirectory', path);
      setFileTree(files);
      
      // Start watching the folder for changes
      await ipcRenderer.invoke('fs:watch', path);
    }
  };

  // Listen for file system changes - separate effect to avoid re-running on refreshFileTree change
  useEffect(() => {
    const handleFsChanged = async () => {
      console.log('File system changed, refreshing...');
      // Get fresh files directly
      if (workspacePath) {
        const files = await ipcRenderer.invoke('fs:readDirectory', workspacePath);
        setFileTree(files);
      }
    };

    ipcRenderer.on('fs:changed', handleFsChanged);

    return () => {
      ipcRenderer.removeListener('fs:changed', handleFsChanged);
    };
  }, [workspacePath, setFileTree]);

  // Start/stop watcher when workspace changes
  useEffect(() => {
    if (workspacePath) {
      ipcRenderer.invoke('fs:watch', workspacePath);
    }
    
    return () => {
      // Only stop watching on unmount, not on workspace change
    };
  }, [workspacePath]);

  // Auto-init MCP servers when workspace changes
  useEffect(() => {
    const initMcp = async () => {
      if (!workspacePath) {
        setMcpStatus('disconnected');
        return;
      }
      
      setMcpStatus('loading');
      try {
        // Auto-connect to MCP servers
        await ipcRenderer.invoke('mcp:connect', workspacePath);
        // Get status
        const status = await ipcRenderer.invoke('mcp:getStatus');
        setMcpStatus(status.status);
      } catch (error) {
        console.error('Failed to init MCP:', error);
        setMcpStatus('error');
      }
    };

    initMcp();
  }, [workspacePath]);

  // Listen for MCP status changes
  useEffect(() => {
    const handleStatusChanged = async () => {
      try {
        const status = await ipcRenderer.invoke('mcp:getStatus');
        setMcpStatus(status.status);
      } catch (error) {
        console.error('Failed to get MCP status:', error);
      }
    };

    ipcRenderer.on('mcp:statusChanged', handleStatusChanged);
    return () => {
      ipcRenderer.removeListener('mcp:statusChanged', handleStatusChanged);
    };
  }, []);

  // Cleanup watcher on unmount only
  useEffect(() => {
    return () => {
      ipcRenderer.invoke('fs:unwatch');
    };
  }, []);

  const handleToggleAI = () => {
    if (settings.aiEnabled) {
      setIsAIChatOpen(!isAIChatOpen);
    } else {
      alert('Please enable AI Assistant in Settings first.');
      setIsSettingsOpen(true);
    }
  };

  const handleNewDocument = () => {
    setIsCommandPaletteOpen(true);
  };

  useEffect(() => {
    // Listen for menu commands
    const handleMenuOpenFolder = () => {
      handleOpenFolder();
    };

    const handleNewFile = () => {
      if (!workspacePath) {
        alert('Please select a workspace folder first.');
        return;
      }
      createNewFile('Untitled.txt');
    };

    const handleNewTemplate = async (event: any, templateId: string) => {
      console.log('[App.tsx] handleNewTemplate called with:', templateId);
      console.log('[App.tsx] availableTemplates:', availableTemplates.map(t => t.id));
      if (!workspacePath) {
        alert('Please select a workspace folder first.');
        return;
      }
      // templateId comes directly from the menu now (no mapping needed)
      await createFromTemplate(templateId);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette: Ctrl+Shift+P
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      // New File: Ctrl+N
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewFile();
      }
      // Settings: Ctrl+,
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
      // AI Chat: Ctrl+Shift+A
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setIsAIChatOpen(!isAIChatOpen);
      }
      // Close AI Chat: Esc
      if (e.key === 'Escape' && isAIChatOpen) {
        setIsAIChatOpen(false);
      }
    };

    const handleOpenTemplatesFolder = () => {
      console.log('[App.tsx] Received menu:openTemplatesFolder event');
      openTemplatesFolder();
    };

    const handleSaveAsTemplate = () => {
      console.log('[App.tsx] Received menu:saveAsTemplate event');
      saveAsTemplate();
    };

    const handleSetTheme = (_: any, theme: string) => {
      setCurrentTheme(theme);
    };

    ipcRenderer.on('menu:openFolder', handleMenuOpenFolder);
    ipcRenderer.on('menu:newFile', handleNewFile);
    ipcRenderer.on('menu:newTemplate', handleNewTemplate);
    ipcRenderer.on('menu:openTemplatesFolder', handleOpenTemplatesFolder);
    ipcRenderer.on('menu:saveAsTemplate', handleSaveAsTemplate);
    ipcRenderer.on('menu:setTheme', handleSetTheme);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      ipcRenderer.removeListener('menu:openFolder', handleMenuOpenFolder);
      ipcRenderer.removeListener('menu:newFile', handleNewFile);
      ipcRenderer.removeListener('menu:newTemplate', handleNewTemplate);
      ipcRenderer.removeListener('menu:openTemplatesFolder', handleOpenTemplatesFolder);
      ipcRenderer.removeListener('menu:saveAsTemplate', handleSaveAsTemplate);
      ipcRenderer.removeListener('menu:setTheme', handleSetTheme);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [workspacePath, isAIChatOpen, currentFile, availableTemplates]);

  const createNewFile = (filename: string) => {
    if (!workspacePath) {
      alert('Please select a workspace folder first.');
      return;
    }
    
    const fullPath = `${workspacePath}/${filename}`;
    addOpenFile({
      path: fullPath,
      content: '',
      language: 'plaintext'
    });
  };

  const createFromTemplate = async (templateId: string) => {
    if (!workspacePath) {
      alert('Please select a workspace folder first.');
      return;
    }

    try {
      // Find the template
      const template = availableTemplates.find(t => t.id === templateId);
      if (!template) {
        console.error('Template not found:', templateId);
        return;
      }

      // Load template content from file
      const content = await ipcRenderer.invoke('templates:read', template.filename);
      
      // Generate default filename from template name
      const defaultName = template.name.replace(/\s+/g, '-') + 
        (template.filename.endsWith('.prd') ? '.prd' : '.md');

      // Show file name dialog
      setPendingTemplate({ type: templateId, content, defaultName });
      setIsFileNameDialogOpen(true);
    } catch (error) {
      console.error('Error loading template:', error);
      alert('Failed to load template');
    }
  };

  const openTemplatesFolder = async () => {
    console.log('[App.tsx] openTemplatesFolder() called, invoking templates:openFolder');
    try {
      const result = await ipcRenderer.invoke('templates:openFolder');
      console.log('[App.tsx] templates:openFolder result:', result);
    } catch (error) {
      console.error('[App.tsx] templates:openFolder error:', error);
    }
  };

  const refreshTemplates = async () => {
    try {
      const templates = await ipcRenderer.invoke('templates:list');
      setAvailableTemplates(templates);
    } catch (error) {
      console.error('Error refreshing templates:', error);
    }
  };

  const saveAsTemplate = () => {
    console.log('[App.tsx] saveAsTemplate() called, currentFile:', currentFile?.path);
    if (!currentFile) {
      alert('No file is currently open. Please open a file first.');
      return;
    }
    setIsSaveTemplateDialogOpen(true);
  };

  const handleSaveTemplateConfirm = async (templateName: string) => {
    if (!currentFile) return;

    try {
      const result = await ipcRenderer.invoke('templates:save', templateName, currentFile.content);
      if (result.success) {
        alert(`Template saved successfully: ${result.filename}`);
        await refreshTemplates();
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }

    setIsSaveTemplateDialogOpen(false);
  };

  const handleFileNameConfirm = async (fileName: string) => {
    if (!workspacePath || !pendingTemplate) return;

    // Ensure file has proper extension
    const ext = fileName.includes('.') ? '' : (pendingTemplate.type === 'prd' ? '.prd' : '.md');
    const fullFileName = fileName + ext;
    const fullPath = `${workspacePath}/${fullFileName}`;

    // Create the file on disk
    try {
      await ipcRenderer.invoke('fs:writeFile', fullPath, pendingTemplate.content);
      
      // Refresh file tree
      await refreshFileTree();
      
      // Open it in the editor
      addOpenFile({
        path: fullPath,
        content: pendingTemplate.content,
        language: 'markdown'
      });
    } catch (error) {
      console.error('Error creating file:', error);
      alert('Failed to create file');
    }

    setIsFileNameDialogOpen(false);
    setPendingTemplate(null);
  };

  // Build commands dynamically based on available templates
  const templateCommands = availableTemplates.map(template => ({
    id: `new-${template.id}`,
    label: `New ${template.name}`,
    action: () => createFromTemplate(template.id),
    shortcut: `Templates > ${template.name}`
  }));

  const commands = [
    ...templateCommands,
    {
      id: 'save-as-template',
      label: 'Save Current File as Template',
      action: saveAsTemplate,
      shortcut: 'Save for reuse'
    },
    {
      id: 'open-templates-folder',
      label: 'Open Templates Folder',
      action: openTemplatesFolder,
      shortcut: 'Edit templates externally'
    },
    {
      id: 'refresh-templates',
      label: 'Refresh Templates',
      action: refreshTemplates,
      shortcut: 'Reload template list'
    },
    {
      id: 'new-file',
      label: 'New File',
      action: () => createNewFile('Untitled.txt'),
      shortcut: 'Ctrl+N'
    },
    {
      id: 'open-settings',
      label: 'Open Settings',
      action: () => setIsSettingsOpen(true),
      shortcut: 'Ctrl+,'
    },
    {
      id: 'toggle-ai-chat',
      label: settings.aiEnabled ? 'Toggle AI Assistant' : 'AI Assistant (Configure in Settings)',
      action: () => {
        if (settings.aiEnabled) {
          setIsAIChatOpen(!isAIChatOpen);
        } else {
          alert('Please enable AI Assistant in Settings first.');
          setIsSettingsOpen(true);
        }
      },
      shortcut: 'Ctrl+Shift+A'
    }
  ];

  return (
    <>
      {!workspacePath && (
        <WelcomeScreen onSelectWorkspace={() => handleOpenFolder()} />
      )}
      
      <div className="app-container">
        <TitleBar templates={availableTemplates} />
        <div className="app-main">
          <IconSidebar
            onOpenSettings={() => setIsSettingsOpen(true)}
            onToggleAI={handleToggleAI}
            onNewDocument={handleNewDocument}
            onOpenMCP={() => setIsMCPPanelOpen(true)}
            onToggleTerminal={() => setIsTerminalOpen(!isTerminalOpen)}
            onOpenStakeholders={() => setIsStakeholdersPanelOpen(true)}
            aiEnabled={settings.aiEnabled}
            isAIChatOpen={isAIChatOpen}
            isTerminalOpen={isTerminalOpen}
            mcpStatus={mcpStatus}
          />
          <Sidebar />
          <div className="main-content-area">
            <EditorPane />
            <TerminalPanel 
              isOpen={isTerminalOpen}
              onClose={() => setIsTerminalOpen(false)}
              workspacePath={workspacePath || undefined}
            />
          </div>
          <AIChat 
            isOpen={isAIChatOpen} 
            onClose={() => setIsAIChatOpen(false)}
            settings={settings}
            workspacePath={workspacePath}
            currentFile={currentFile}
            stakeholders={stakeholders}
            templates={availableTemplates}
          />
        </div>
        <StatusBar />
      </div>
      
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commands}
      />
      
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          // Force repaint after settings close (Electron rendering bug workaround)
          requestAnimationFrame(() => {
            document.body.style.opacity = '0.999';
            requestAnimationFrame(() => {
              document.body.style.opacity = '1';
            });
          });
        }}
        onSave={setSettings}
      />

      <FileNameDialog
        isOpen={isFileNameDialogOpen}
        defaultName={pendingTemplate?.defaultName || ''}
        title="Create New Document"
        onConfirm={handleFileNameConfirm}
        onCancel={() => {
          setIsFileNameDialogOpen(false);
          setPendingTemplate(null);
        }}
      />

      <FileNameDialog
        isOpen={isSaveTemplateDialogOpen}
        defaultName={currentFile?.path.split(/[\\/]/).pop()?.replace(/\.(md|prd|txt)$/, '-template.md') || 'my-template.md'}
        title="Save as Template"
        onConfirm={handleSaveTemplateConfirm}
        onCancel={() => setIsSaveTemplateDialogOpen(false)}
      />

      <MCPPanel
        isOpen={isMCPPanelOpen}
        onClose={() => setIsMCPPanelOpen(false)}
        workspacePath={workspacePath}
      />

      <StakeholdersPanel
        isOpen={isStakeholdersPanelOpen}
        onClose={() => setIsStakeholdersPanelOpen(false)}
        onStakeholdersChange={setStakeholders}
      />
    </>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;

