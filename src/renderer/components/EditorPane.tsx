import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import MonacoEditor from './MonacoEditor';
import MarkdownPreview from './MarkdownPreview';
import SplitPane from './SplitPane';
import KanbanEditor from './KanbanEditor';
import TimelineEditor from './TimelineEditor';
import MediaViewer, { isMediaFile, getMediaType } from './MediaViewer';
import { EditorFile } from '../../shared/types';
import { marked } from 'marked';

// Import icons
import welcomeIcon from '../assets/icons/weclome.svg';

const { ipcRenderer } = window.require('electron');
const path = window.require('path');

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

  // Detect if file is a Timeline document by checking for [TIMELINE] header
  const isTimelineDocument = currentFile?.content?.match(/^#\s*\[TIMELINE\]/m) !== null;

  // Detect if file is a media file (image, audio, video)
  const isMedia = currentFile ? isMediaFile(currentFile.path) : false;
  const mediaType = currentFile ? getMediaType(currentFile.path) : 'unknown';

  const [isExporting, setIsExporting] = useState(false);

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

  const exportToPdf = useCallback(async () => {
    const file = currentFileRef.current;
    if (!file) return;

    setIsExporting(true);
    try {
      // Parse markdown to HTML
      const htmlContent = await marked.parse(file.content);
      
      // Get the directory and base name of the current file
      const dir = path.dirname(file.path);
      const baseName = path.basename(file.path, path.extname(file.path));
      
      // Find unique filename
      let pdfPath = path.join(dir, `${baseName}.pdf`);
      let counter = 1;
      while (await ipcRenderer.invoke('fs:exists', pdfPath)) {
        pdfPath = path.join(dir, `${baseName}_${counter}.pdf`);
        counter++;
      }

      // Create a hidden iframe to render the HTML and print to PDF
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '800px';
      iframe.style.height = '600px';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('Could not access iframe document');

      // Write styled HTML content
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
              line-height: 1.6;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              color: #333;
            }
            h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 24px; }
            h3 { font-size: 1.25em; margin-top: 20px; }
            p { margin: 12px 0; }
            ul, ol { margin: 12px 0; padding-left: 24px; }
            li { margin: 6px 0; }
            code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
            pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
            pre code { background: none; padding: 0; }
            blockquote { border-left: 4px solid #ddd; margin: 16px 0; padding-left: 16px; color: #666; }
            table { border-collapse: collapse; width: 100%; margin: 16px 0; }
            th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
            th { background: #f4f4f4; }
            hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }
          </style>
        </head>
        <body>${htmlContent}</body>
        </html>
      `);
      iframeDoc.close();

      // Wait for content to render
      await new Promise(resolve => setTimeout(resolve, 500));

      // Use Electron's printToPDF via IPC
      const pdfData = await ipcRenderer.invoke('export:pdf', {
        htmlContent: iframeDoc.documentElement.outerHTML,
        outputPath: pdfPath
      });

      // Clean up
      document.body.removeChild(iframe);

      if (pdfData.success) {
        alert(`PDF exported successfully:\n${pdfPath}`);
      } else {
        throw new Error(pdfData.error || 'Export failed');
      }
    } catch (error: any) {
      console.error('Error exporting to PDF:', error);
      alert(`Failed to export PDF: ${error.message}`);
    } finally {
      setIsExporting(false);
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
          {openFiles.map((file: EditorFile) => {
            const fileMediaType = getMediaType(file.path);
            const tabIcon = fileMediaType === 'image' ? '🖼️ ' :
                           fileMediaType === 'video' ? '🎬 ' :
                           fileMediaType === 'audio' ? '🎵 ' :
                           fileMediaType === 'pdf' ? '📄 ' : '';
            return (
              <div
                key={file.path}
                className={`editor-tab ${currentFile?.path === file.path ? 'active' : ''}`}
                onClick={() => setCurrentFile(file)}
              >
                <span>{tabIcon}{file.path.split(/[\\/]/).pop()}</span>
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
            );
          })}
          {isMarkdownFile && !isKanbanDocument && !isTimelineDocument && (
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
              <button
                className="export-pdf-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  exportToPdf();
                }}
                disabled={isExporting}
                title="Export to PDF"
              >
                {isExporting ? '⏳ Exporting...' : '📄 Export PDF'}
              </button>
            </div>
          )}
        </div>
      )}
      <div className="editor-content">
        {currentFile ? (
          isMedia ? (
            <MediaViewer
              filePath={currentFile.path}
              fileName={currentFile.path.split(/[\\/]/).pop() || 'Media'}
            />
          ) : isKanbanDocument ? (
            <KanbanEditor
              content={currentFile.content}
              onChange={handleEditorChange}
              onSave={saveCurrentFile}
            />
          ) : isTimelineDocument ? (
            <TimelineEditor
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

