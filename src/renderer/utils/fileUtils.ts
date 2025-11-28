import path from 'path';

const iconMap: { [key: string]: string } = {
  // Documents
  md: '📝',
  txt: '📄',
  prd: '📋',
  pdf: '📕',
  doc: '📘',
  docx: '📘',
  
  // Code
  js: '📜',
  ts: '📜',
  jsx: '⚛️',
  tsx: '⚛️',
  py: '🐍',
  java: '☕',
  cpp: '⚙️',
  c: '⚙️',
  cs: '⚙️',
  go: '🔷',
  rs: '🦀',
  php: '🐘',
  rb: '💎',
  
  // Web
  html: '🌐',
  css: '🎨',
  scss: '🎨',
  json: '⚙️',
  xml: '📋',
  
  // Images
  png: '🖼️',
  jpg: '🖼️',
  jpeg: '🖼️',
  gif: '🖼️',
  svg: '🎨',
  
  // Others
  zip: '📦',
  gitignore: '🔒'
};

export const getFileIcon = (filename: string): string => {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return iconMap[ext] || '📄';
};

export const getLanguageFromExtension = (filename: string): string => {
  const ext = path.extname(filename).slice(1).toLowerCase();
  
  const languageMap: { [key: string]: string } = {
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    md: 'markdown',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    rb: 'ruby',
    xml: 'xml'
  };
  
  return languageMap[ext] || 'plaintext';
};

