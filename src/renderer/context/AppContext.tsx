import React, { createContext, useContext, useState, ReactNode } from 'react';
import { EditorFile, FileItem } from '../../shared/types';

const { ipcRenderer } = window.require('electron');

interface AppContextType {
  currentFile: EditorFile | null;
  openFiles: EditorFile[];
  workspacePath: string | null;
  fileTree: FileItem[];
  setCurrentFile: (file: EditorFile | null) => void;
  setOpenFiles: (files: EditorFile[]) => void;
  setWorkspacePath: (path: string | null) => void;
  addOpenFile: (file: EditorFile) => void;
  closeFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  setFileTree: (tree: FileItem[]) => void;
  refreshFileTree: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentFile, setCurrentFile] = useState<EditorFile | null>(null);
  const [openFiles, setOpenFiles] = useState<EditorFile[]>([]);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileItem[]>([]);

  const addOpenFile = (file: EditorFile) => {
    setOpenFiles(prevFiles => {
      const exists = prevFiles.find(f => f.path === file.path);
      if (!exists) {
        return [...prevFiles, file];
      }
      return prevFiles;
    });
    setCurrentFile(file);
  };

  const closeFile = (path: string) => {
    setOpenFiles(prevFiles => {
      const newOpenFiles = prevFiles.filter(f => f.path !== path);
      
      setCurrentFile(prevCurrent => {
        if (prevCurrent?.path === path) {
          return newOpenFiles.length > 0 ? newOpenFiles[0] : null;
        }
        return prevCurrent;
      });
      
      return newOpenFiles;
    });
  };

  const updateFileContent = (path: string, content: string) => {
    setOpenFiles(prevFiles => 
      prevFiles.map(f => f.path === path ? { ...f, content } : f)
    );
    
    setCurrentFile(prevFile => 
      prevFile?.path === path ? { ...prevFile, content } : prevFile
    );
  };

  const refreshFileTree = async () => {
    if (workspacePath) {
      try {
        const files = await ipcRenderer.invoke('fs:readDirectory', workspacePath);
        setFileTree(files);
      } catch (error) {
        console.error('Error refreshing file tree:', error);
      }
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentFile,
        openFiles,
        workspacePath,
        fileTree,
        setCurrentFile,
        setOpenFiles,
        setWorkspacePath,
        addOpenFile,
        closeFile,
        updateFileContent,
        setFileTree,
        refreshFileTree
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

