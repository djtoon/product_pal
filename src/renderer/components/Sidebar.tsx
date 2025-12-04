import React, { useState, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import FileTree from './FileTree';
import { FileItem, EditorFile } from '../../shared/types';
import { isMediaFile } from './MediaViewer';
import './Sidebar.css';

const { ipcRenderer } = window.require('electron');

const Sidebar: React.FC = () => {
  const { workspacePath, fileTree, addOpenFile, refreshFileTree } = useAppContext();
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<'file' | 'folder'>('file');
  const [width, setWidth] = useState(250);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = e.clientX - 48; // 48px is IconSidebar width
      setWidth(Math.max(150, Math.min(500, newWidth)));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleFileClick = async (file: FileItem) => {
    if (!file.isDirectory) {
      try {
        const ext = file.path.split('.').pop()?.toLowerCase() || 'txt';
        
        // For media files, don't read content - just pass the path
        if (isMediaFile(file.path)) {
          addOpenFile({
            path: file.path,
            content: '', // Media files don't need text content
            language: ext
          });
        } else {
          // For text files, read the content
          const content = await ipcRenderer.invoke('fs:readFile', file.path);
          addOpenFile({
            path: file.path,
            content: content,
            language: ext
          });
        }
      } catch (error) {
        console.error('Error opening file:', error);
      }
    }
  };

  const handleCreateNew = async () => {
    if (!newItemName || !workspacePath) return;

    try {
      const newPath = `${workspacePath}/${newItemName}`;
      
      if (newItemType === 'file') {
        await ipcRenderer.invoke('fs:createFile', newPath);
      } else {
        await ipcRenderer.invoke('fs:createDirectory', newPath);
      }
      
      await refreshFileTree();
      setIsCreatingNew(false);
      setNewItemName('');
    } catch (error) {
      console.error('Error creating new item:', error);
      alert('Failed to create item');
    }
  };

  return (
    <div className="sidebar" ref={sidebarRef} style={{ width: `${width}px` }}>
      <div className="sidebar-header">
        Explorer
        {workspacePath && (
          <button
            className="new-item-btn"
            onClick={() => setIsCreatingNew(!isCreatingNew)}
            title="New File/Folder"
          >
            +
          </button>
        )}
      </div>
      
      {isCreatingNew && (
        <div className="new-file-controls">
          <input
            type="text"
            className="new-file-input"
            placeholder="Enter name..."
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateNew();
              if (e.key === 'Escape') {
                setIsCreatingNew(false);
                setNewItemName('');
              }
            }}
            autoFocus
          />
          <div className="new-file-buttons">
            <button
              className="new-file-btn"
              onClick={() => {
                setNewItemType('file');
                handleCreateNew();
              }}
            >
              File
            </button>
            <button
              className="new-file-btn"
              onClick={() => {
                setNewItemType('folder');
                handleCreateNew();
              }}
            >
              Folder
            </button>
            <button
              className="new-file-btn cancel"
              onClick={() => {
                setIsCreatingNew(false);
                setNewItemName('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      <div className="sidebar-content">
        {workspacePath ? (
          <FileTree
            items={fileTree}
            onFileClick={handleFileClick}
            onRefresh={refreshFileTree}
            workspacePath={workspacePath}
          />
        ) : (
          <div className="sidebar-empty">
            <p>No workspace selected</p>
          </div>
        )}
      </div>
      
      {/* Resize handle */}
      <div className="sidebar-resize-handle" onMouseDown={handleMouseDown} />
    </div>
  );
};

export default Sidebar;

