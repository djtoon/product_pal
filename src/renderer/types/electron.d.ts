// Global type declarations for Electron in renderer process

declare global {
  interface Window {
    require: (module: 'electron') => {
      ipcRenderer: import('electron').IpcRenderer;
    };
  }
}

export {};

