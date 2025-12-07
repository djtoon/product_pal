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

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
}