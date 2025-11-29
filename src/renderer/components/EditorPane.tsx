import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import MonacoEditor from './MonacoEditor';
import MarkdownPreview from './MarkdownPreview';
import SplitPane from './SplitPane';
import KanbanEditor from './KanbanEditor';
import { EditorFile } from '../../shared/types';

// Import icons
import welcomeIcon from '../assets/icons/weclome.svg';
import newFileIcon from '../assets/icons/newfile.svg';
import aiIcon from '../assets/icons/ai_avatar.svg';
import settingsIcon from '../assets/icons/settings.svg';

const { ipcRenderer } = window.require('electron');

const EditorPane: React.FC = () => {
  const { currentFile, openFiles, setCurrentFile, closeFile, updateFileContent } = useAppContext();
  const [showPreview, setShowPreview] = useState(false);
  
  // Use ref to always have access to latest currentFile in callbacks
  const currentFileRef = useRef(currentFile);
  currentFileRef.current = currentFile;

  const isMarkdownFile = currentFile?.path.toLowerCase().endsWith('.md') || 
                         currentFile?.path.toLowerCase().endsWith('.prd');

  // Detect if file is a Kanban document by checking for [KANBAN] header
  const isKanbanDocument = currentFile?.content?.match(/^#\s*\[KANBAN\]/m) !== null;

  const saveCurrentFile = useCallback(async () => {
    const file = currentFileRef.current;
    if (!file) return;
    
    try {
      console.log('Saving file:', file.path, 'Content length:', file.content.length);
      await ipcRenderer.invoke('fs:writeFile', file.path, file.content);
      console.log('File saved successfully:', file.path);
    } catch (error) {
      console.error('Error saving file:', error);
    }
  }, []);

  useEffect(() => {
    // Listen for menu save command
    ipcRenderer.on('menu:save', saveCurrentFile);

    return () => {
      ipcRenderer.removeListener('menu:save', saveCurrentFile);
    };
  }, [saveCurrentFile]);

  const handleEditorChange = (value: string | undefined) => {
    if (currentFile && value !== undefined) {
      updateFileContent(currentFile.path, value);
    }
  };

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'md':
        return 'markdown';
      case 'js':
        return 'javascript';
      case 'ts':
        return 'typescript';
      case 'json':
        return 'json';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'py':
        return 'python';
      default:
        return 'plaintext';
    }
  };

  return (
    <div className="editor-pane">
      {openFiles.length > 0 && (
        <div className="editor-tabs">
          {openFiles.map((file: EditorFile) => (
            <div
              key={file.path}
              className={`editor-tab ${currentFile?.path === file.path ? 'active' : ''}`}
              onClick={() => setCurrentFile(file)}
            >
              <span>{file.path.split(/[\\/]/).pop()}</span>
              <span
                className="editor-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file.path);
                }}
              >
                ×
              </span>
            </div>
          ))}
          {isMarkdownFile && !isKanbanDocument && (
            <div className="editor-tab-action">
              <button
                className="preview-toggle-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPreview(!showPreview);
                }}
                title={showPreview ? 'Hide Preview' : 'Show Preview'}
              >
                {showPreview ? '📝 Editor Only' : '👁️ Split Preview'}
              </button>
            </div>
          )}
        </div>
      )}
      <div className="editor-content">
        {currentFile ? (
          isKanbanDocument ? (
            <KanbanEditor
              content={currentFile.content}
              onChange={handleEditorChange}
              onSave={saveCurrentFile}
            />
          ) : showPreview && isMarkdownFile ? (
            <SplitPane
              left={
                <MonacoEditor
                  value={currentFile.content}
                  language={getLanguageFromPath(currentFile.path)}
                  onChange={handleEditorChange}
                  onSave={saveCurrentFile}
                />
              }
              right={
                <MarkdownPreview content={currentFile.content} />
              }
              defaultSplitPercentage={50}
            />
          ) : (
            <MonacoEditor
              value={currentFile.content}
              language={getLanguageFromPath(currentFile.path)}
              onChange={handleEditorChange}
              onSave={saveCurrentFile}
            />
          )
        ) : (
          <div className="editor-welcome">
            <div className="editor-welcome-content">
              <img src={welcomeIcon} alt="Collie" className="editor-welcome-icon" />
              <p className="editor-welcome-tagline">Your AI-Powered Product Management IDE</p>
              
              <div className="editor-welcome-features">
                <div className="editor-welcome-feature">
                  <img src={newFileIcon} alt="" className="feature-icon" />
                  <span>Create PRDs & Technical Specs</span>
                </div>
                <div className="editor-welcome-feature">
                  <img src={aiIcon} alt="" className="feature-icon" />
                  <span>AI Assistant powered by Claude</span>
                </div>
                <div className="editor-welcome-feature">
                  <img src={settingsIcon} alt="" className="feature-icon" />
                  <span>Fast editing with Monaco Editor</span>
                </div>
              </div>

              <div className="editor-welcome-shortcuts">
                <div className="shortcut-item">
                  <kbd>Ctrl+Shift+P</kbd>
                  <span>Command Palette</span>
                </div>
                <div className="shortcut-item">
                  <kbd>Ctrl+N</kbd>
                  <span>New File</span>
                </div>
                <div className="shortcut-item">
                  <kbd>Ctrl+Shift+A</kbd>
                  <span>AI Assistant</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorPane;

