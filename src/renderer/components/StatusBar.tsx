import React from 'react';
import { useAppContext } from '../context/AppContext';

const StatusBar: React.FC = () => {
  const { currentFile, workspacePath, openFiles } = useAppContext();

  const getFileLanguage = () => {
    if (!currentFile) return 'No file open';
    const ext = currentFile.path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'md':
        return 'Markdown';
      case 'txt':
        return 'Plain Text';
      case 'prd':
        return 'PRD';
      case 'js':
        return 'JavaScript';
      case 'ts':
        return 'TypeScript';
      case 'tsx':
        return 'TypeScript React';
      case 'jsx':
        return 'JavaScript React';
      case 'json':
        return 'JSON';
      case 'html':
        return 'HTML';
      case 'css':
        return 'CSS';
      default:
        return 'Text';
    }
  };

  const getLineCount = () => {
    if (!currentFile) return 0;
    return currentFile.content.split('\n').length;
  };

  const getCharCount = () => {
    if (!currentFile) return 0;
    return currentFile.content.length;
  };

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {workspacePath && (
          <span title={workspacePath}>
            📁 {workspacePath.split(/[\\/]/).pop()}
          </span>
        )}
        {openFiles.length > 0 && (
          <span>{openFiles.length} file{openFiles.length !== 1 ? 's' : ''} open</span>
        )}
      </div>
      <div className="status-bar-right">
        {currentFile && (
          <>
            <span>{getLineCount()} lines</span>
            <span>{getCharCount()} characters</span>
            <span>{getFileLanguage()}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default StatusBar;

