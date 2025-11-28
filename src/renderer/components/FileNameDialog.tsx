import React, { useState, useEffect, useRef } from 'react';
import './FileNameDialog.css';

interface FileNameDialogProps {
  isOpen: boolean;
  defaultName: string;
  title: string;
  onConfirm: (fileName: string) => void;
  onCancel: () => void;
}

const FileNameDialog: React.FC<FileNameDialogProps> = ({ 
  isOpen, 
  defaultName, 
  title, 
  onConfirm, 
  onCancel 
}) => {
  const [fileName, setFileName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync state when defaultName changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      setFileName(defaultName);
      // Focus input after state update
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, defaultName]);

  const handleConfirm = () => {
    if (fileName.trim()) {
      onConfirm(fileName.trim());
      setFileName(defaultName);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="filename-dialog-overlay" onClick={onCancel}>
      <div className="filename-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="filename-dialog-header">
          <h3>{title}</h3>
        </div>
        
        <div className="filename-dialog-content">
          <label>File Name:</label>
          <input
            ref={inputRef}
            type="text"
            className="filename-input"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Enter file name..."
          />
        </div>

        <div className="filename-dialog-actions">
          <button className="filename-btn secondary" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="filename-btn primary" 
            onClick={handleConfirm}
            disabled={!fileName.trim()}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileNameDialog;

