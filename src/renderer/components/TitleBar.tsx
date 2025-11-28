import React, { useState, useEffect, useRef } from 'react';
import './TitleBar.css';
import logoIcon from '../assets/icons/logo.svg';

const { ipcRenderer } = window.require('electron');

interface MenuItem {
  label: string;
  action?: () => void;
  submenu?: MenuItem[];
  type?: 'separator';
  accelerator?: string;
}

interface Template {
  id: string;
  name: string;
  filename: string;
}

interface TitleBarProps {
  templates?: Template[];
}

const TitleBar: React.FC<TitleBarProps> = ({ templates = [] }) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close menu when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };

    const handleMaximized = (_: any, maximized: boolean) => {
      setIsMaximized(maximized);
    };

    document.addEventListener('mousedown', handleClickOutside);
    ipcRenderer.on('window:maximized', handleMaximized);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      ipcRenderer.removeListener('window:maximized', handleMaximized);
    };
  }, []);

  const handleMinimize = () => ipcRenderer.send('window:minimize');
  const handleMaximize = () => ipcRenderer.send('window:maximize');
  const handleClose = () => ipcRenderer.send('window:close');

  const menuItems: { [key: string]: MenuItem[] } = {
    File: [
      { label: 'Open Folder...', accelerator: 'Ctrl+O', action: () => ipcRenderer.send('menu:openFolder') },
      { label: 'New File', accelerator: 'Ctrl+N', action: () => ipcRenderer.send('menu:newFile') },
      { label: 'Save', accelerator: 'Ctrl+S', action: () => ipcRenderer.send('menu:save') },
      { type: 'separator', label: '' },
      { label: 'Exit', accelerator: 'Ctrl+Q', action: () => ipcRenderer.send('window:close') }
    ],
    Edit: [
      { label: 'Undo', accelerator: 'Ctrl+Z', action: () => document.execCommand('undo') },
      { label: 'Redo', accelerator: 'Ctrl+Y', action: () => document.execCommand('redo') },
      { type: 'separator', label: '' },
      { label: 'Cut', accelerator: 'Ctrl+X', action: () => document.execCommand('cut') },
      { label: 'Copy', accelerator: 'Ctrl+C', action: () => document.execCommand('copy') },
      { label: 'Paste', accelerator: 'Ctrl+V', action: () => document.execCommand('paste') },
      { type: 'separator', label: '' },
      { label: 'Select All', accelerator: 'Ctrl+A', action: () => document.execCommand('selectAll') }
    ],
    View: [
      { 
        label: 'Theme',
        submenu: [
          { label: 'Dark', action: () => ipcRenderer.send('menu:setTheme', 'theme-dark') },
          { label: 'Light', action: () => ipcRenderer.send('menu:setTheme', 'theme-light') },
          { label: 'High Contrast', action: () => ipcRenderer.send('menu:setTheme', 'theme-high-contrast') }
        ]
      }
    ],
    Templates: [
      // Dynamic templates from props
      ...templates.map(template => ({
        label: `New ${template.name}`,
        action: () => ipcRenderer.send('menu:newTemplate', template.id)
      })),
      { type: 'separator', label: '' },
      { label: 'Save as Template', action: () => { console.log('[TitleBar] Save as Template clicked'); ipcRenderer.send('menu:saveAsTemplate'); } },
      { label: 'Open Templates Folder', action: () => { console.log('[TitleBar] Open Templates Folder clicked'); ipcRenderer.send('menu:openTemplatesFolder'); } }
    ],
    Help: [
      { label: 'About Collie', action: () => alert('Collie v1.0.0\nBuild: 2024-11-28\n\nAI-powered document editor for Product Managers') }
    ]
  };

  const handleMenuClick = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleMenuItemClick = (item: MenuItem) => {
    if (item.action) {
      item.action();
    }
    setActiveMenu(null);
  };

  return (
    <div className="title-bar">
      <div className="title-bar-drag-region">
        {/* App Icon/Logo */}
        <div className="title-bar-icon">
          <img src={logoIcon} alt="Collie" />
        </div>

        {/* Menu Bar */}
        <div className="title-bar-menu" ref={menuRef}>
          {Object.keys(menuItems).map(menuName => (
            <div key={menuName} className="menu-item-container">
              <div
                className={`menu-item ${activeMenu === menuName ? 'active' : ''}`}
                onClick={() => handleMenuClick(menuName)}
                onMouseEnter={() => activeMenu && setActiveMenu(menuName)}
              >
                {menuName}
              </div>
              {activeMenu === menuName && (
                <div className="menu-dropdown">
                  {menuItems[menuName].map((item, index) => (
                    item.type === 'separator' ? (
                      <div key={index} className="menu-separator" />
                    ) : item.submenu ? (
                      <div key={index} className="menu-dropdown-item has-submenu">
                        <span className="menu-dropdown-label">{item.label}</span>
                        <span className="menu-dropdown-arrow">▶</span>
                        <div className="menu-submenu">
                          {item.submenu.map((subItem, subIndex) => (
                            <div
                              key={subIndex}
                              className="menu-dropdown-item"
                              onClick={() => handleMenuItemClick(subItem)}
                            >
                              <span className="menu-dropdown-label">{subItem.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div
                        key={index}
                        className="menu-dropdown-item"
                        onClick={() => handleMenuItemClick(item)}
                      >
                        <span className="menu-dropdown-label">{item.label}</span>
                        {item.accelerator && (
                          <span className="menu-dropdown-accelerator">{item.accelerator}</span>
                        )}
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Title */}
        <div className="title-bar-title">Collie</div>
      </div>

      {/* Window Controls */}
      <div className="title-bar-controls">
        <button className="title-bar-button" onClick={handleMinimize} title="Minimize">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="5.5" width="10" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button className="title-bar-button" onClick={handleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="3" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1"/>
              <rect x="1" y="3" width="8" height="8" fill="#202020" stroke="currentColor" strokeWidth="1"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1"/>
            </svg>
          )}
        </button>
        <button className="title-bar-button close" onClick={handleClose} title="Close">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
