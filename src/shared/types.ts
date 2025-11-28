export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileItem[];
}

export interface EditorFile {
  path: string;
  content: string;
  language: string;
}

export interface AppState {
  currentFile: EditorFile | null;
  openFiles: EditorFile[];
  workspacePath: string | null;
}

