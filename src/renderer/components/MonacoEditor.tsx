import React, { useRef, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import './MonacoEditor.css';

// Configure loader to use local monaco files
loader.config({ monaco: require('monaco-editor') });

interface MonacoEditorProps {
  value: string;
  language: string;
  onChange: (value: string | undefined) => void;
  onSave: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({ value, language, onChange, onSave }) => {
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Add save keyboard shortcut
    editor.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {
        onSave();
      }
    });

    // Ensure clipboard shortcuts work - override to use system clipboard
    editor.addAction({
      id: 'editor-copy',
      label: 'Copy',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC],
      run: async (ed: any) => {
        const selection = ed.getSelection();
        const selectedText = ed.getModel()?.getValueInRange(selection);
        if (selectedText) {
          await navigator.clipboard.writeText(selectedText);
        }
      }
    });

    editor.addAction({
      id: 'editor-cut',
      label: 'Cut',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX],
      run: async (ed: any) => {
        const selection = ed.getSelection();
        const selectedText = ed.getModel()?.getValueInRange(selection);
        if (selectedText) {
          await navigator.clipboard.writeText(selectedText);
          ed.executeEdits('', [{ range: selection, text: '' }]);
        }
      }
    });

    editor.addAction({
      id: 'editor-paste',
      label: 'Paste',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV],
      run: async (ed: any) => {
        const text = await navigator.clipboard.readText();
        const selection = ed.getSelection();
        ed.executeEdits('', [{ range: selection, text }]);
      }
    });

    // Focus the editor
    editor.focus();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  const hideContextMenu = () => {
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleCut = async () => {
    const editor = editorRef.current;
    if (editor) {
      const selection = editor.getSelection();
      const selectedText = editor.getModel()?.getValueInRange(selection);
      if (selectedText) {
        await navigator.clipboard.writeText(selectedText);
        editor.executeEdits('', [{ range: selection, text: '' }]);
      }
    }
    hideContextMenu();
  };

  const handleCopy = async () => {
    const editor = editorRef.current;
    if (editor) {
      const selection = editor.getSelection();
      const selectedText = editor.getModel()?.getValueInRange(selection);
      if (selectedText) {
        await navigator.clipboard.writeText(selectedText);
      }
    }
    hideContextMenu();
  };

  const handlePaste = async () => {
    const editor = editorRef.current;
    if (editor) {
      const text = await navigator.clipboard.readText();
      const selection = editor.getSelection();
      editor.executeEdits('', [{ range: selection, text }]);
    }
    hideContextMenu();
  };

  const handleFind = () => {
    const editor = editorRef.current;
    if (editor) {
      editor.trigger('keyboard', 'actions.find', null);
    }
    hideContextMenu();
  };

  const handleFindReplace = () => {
    const editor = editorRef.current;
    if (editor) {
      editor.trigger('keyboard', 'editor.action.startFindReplaceAction', null);
    }
    hideContextMenu();
  };

  return (
    <div 
      ref={containerRef}
      className="monaco-editor-container"
      onContextMenu={handleContextMenu}
      onClick={() => contextMenu.visible && hideContextMenu()}
    >
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={onChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        loading={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#cccccc' }}>Loading editor...</div>}
        options={{
          fontSize: 14,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          renderWhitespace: 'selection',
          lineNumbers: 'on',
          folding: true,
          glyphMargin: true,
          readOnly: false,
          contextmenu: false,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10
          }
        }}
      />
      
      {contextMenu.visible && (
        <div 
          className="editor-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="context-menu-item" onClick={handleCut}>
            <span className="context-menu-label">Cut</span>
            <span className="context-menu-shortcut">Ctrl+X</span>
          </div>
          <div className="context-menu-item" onClick={handleCopy}>
            <span className="context-menu-label">Copy</span>
            <span className="context-menu-shortcut">Ctrl+C</span>
          </div>
          <div className="context-menu-item" onClick={handlePaste}>
            <span className="context-menu-label">Paste</span>
            <span className="context-menu-shortcut">Ctrl+V</span>
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={handleFind}>
            <span className="context-menu-label">Find</span>
            <span className="context-menu-shortcut">Ctrl+F</span>
          </div>
          <div className="context-menu-item" onClick={handleFindReplace}>
            <span className="context-menu-label">Find and Replace</span>
            <span className="context-menu-shortcut">Ctrl+H</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonacoEditor;

