import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tree, NodeRendererProps, NodeApi } from 'react-arborist';
import { FileItem } from '../../shared/types';
import './FileTree.css';

const { ipcRenderer } = window.require('electron');
const path = window.require('path');

interface FileTreeProps {
  items: FileItem[];
  onFileClick: (file: FileItem) => void;
  onRefresh: () => Promise<void>;
  workspacePath: string | null;
}

interface TreeNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: TreeNode | null;
}

interface ClipboardData {
  items: TreeNode[];
  operation: 'copy' | 'cut';
}

// Convert FileItem to TreeNode format for react-arborist
const convertToTreeNodes = (items: FileItem[]): TreeNode[] => {
  return items.map(item => ({
    id: item.path,
    name: item.name,
    path: item.path,
    isDirectory: item.isDirectory,
    children: item.children ? convertToTreeNodes(item.children) : undefined
  }));
};

// Custom node renderer
const createNodeRenderer = (
  onNodeContextMenu: (e: React.MouseEvent, node: NodeApi<TreeNode>) => void,
  clipboard: ClipboardData | null
) => {
  return function Node({ node, style, dragHandle }: NodeRendererProps<TreeNode>) {
    const data = node.data;
    const isCut = clipboard?.operation === 'cut' && clipboard.items.some(item => item.path === data.path);
    
    const getFileIcon = () => {
      if (data.isDirectory) {
        return node.isOpen ? '📂' : '📁';
      }
      const ext = data.name.split('.').pop()?.toLowerCase();
      switch (ext) {
        // Documents
        case 'md': return '📝';
        case 'prd': return '📋';
        case 'txt': return '📄';
        // Code
        case 'js':
        case 'ts': return '📜';
        case 'json': return '⚙️';
        // Images
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
        case 'bmp':
        case 'svg':
        case 'ico': return '🖼️';
        // Video
        case 'mp4':
        case 'webm':
        case 'ogg':
        case 'mov':
        case 'avi':
        case 'mkv': return '🎬';
        // Audio
        case 'mp3':
        case 'wav':
        case 'flac':
        case 'aac':
        case 'm4a':
        case 'wma': return '🎵';
        default: return '📄';
      }
    };

    return (
      <div
        ref={dragHandle}
        style={style}
        className={`file-tree-item ${node.isSelected ? 'selected' : ''} ${node.willReceiveDrop ? 'drag-over' : ''} ${isCut ? 'cut' : ''}`}
        onClick={() => node.isInternal ? node.toggle() : node.select()}
        onContextMenu={(e) => onNodeContextMenu(e, node)}
        onDoubleClick={() => {
          if (node.isInternal) {
            node.toggle();
          }
        }}
      >
        <span className="file-icon">{getFileIcon()}</span>
        {node.isEditing ? (
          <input
            type="text"
            className="file-rename-input"
            defaultValue={data.name}
            autoFocus
            onFocus={(e) => {
              const dotIndex = data.name.lastIndexOf('.');
              if (dotIndex > 0 && !data.isDirectory) {
                e.target.setSelectionRange(0, dotIndex);
              } else {
                e.target.select();
              }
            }}
            onBlur={() => node.reset()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                node.submit((e.target as HTMLInputElement).value);
              }
              if (e.key === 'Escape') {
                node.reset();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="file-name">{data.name}</span>
        )}
      </div>
    );
  };
};

const FileTree: React.FC<FileTreeProps> = ({ items, onFileClick, onRefresh, workspacePath }) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, node: null });
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<'file' | 'folder' | null>(null);
  const [newItemParentPath, setNewItemParentPath] = useState<string | null>(null);
  const [treeHeight, setTreeHeight] = useState(400);
  const treeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const treeData = convertToTreeNodes(items);

  // Watch for container resize to update tree height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        // Get the bounding rect of the main file-tree container
        const rect = containerRef.current.getBoundingClientRect();
        // Subtract space for the new-item-inline if visible (approx 40px when visible)
        const newItemHeight = isCreatingNew ? 40 : 0;
        const availableHeight = rect.height - newItemHeight;
        if (availableHeight > 100) {
          setTreeHeight(availableHeight);
        }
      }
    };

    // Initial height with a small delay to ensure layout is complete
    const timeoutId = setTimeout(updateHeight, 50);

    // Watch for resize on the main container
    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Also listen for window resize
    window.addEventListener('resize', updateHeight);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [isCreatingNew]);

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  const handleContextMenu = (e: React.MouseEvent, node: NodeApi<TreeNode>) => {
    e.preventDefault();
    e.stopPropagation();
    node.select();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node: node.data
    });
  };

  const handleEmptyAreaContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('file-tree') || 
        (e.target as HTMLElement).classList.contains('file-tree-container')) {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        node: null // null means empty area / workspace root
      });
    }
  };

  // Get selected nodes from tree
  const getSelectedNodes = (): TreeNode[] => {
    if (!treeRef.current) return [];
    const selectedNodes = treeRef.current.selectedNodes as NodeApi<TreeNode>[];
    return selectedNodes.map(n => n.data);
  };

  // Copy operation
  const handleCopy = useCallback(() => {
    const selected = contextMenu.node ? [contextMenu.node] : getSelectedNodes();
    if (selected.length > 0) {
      setClipboard({ items: selected, operation: 'copy' });
    }
    closeContextMenu();
  }, [contextMenu.node]);

  // Cut operation
  const handleCut = useCallback(() => {
    const selected = contextMenu.node ? [contextMenu.node] : getSelectedNodes();
    if (selected.length > 0) {
      setClipboard({ items: selected, operation: 'cut' });
    }
    closeContextMenu();
  }, [contextMenu.node]);

  // Paste operation with auto-rename
  const handlePaste = useCallback(async () => {
    if (!clipboard || clipboard.items.length === 0) {
      closeContextMenu();
      return;
    }

    // Determine target directory
    let targetDir: string;
    if (contextMenu.node) {
      targetDir = contextMenu.node.isDirectory 
        ? contextMenu.node.path 
        : path.dirname(contextMenu.node.path);
    } else if (workspacePath) {
      targetDir = workspacePath;
    } else {
      closeContextMenu();
      return;
    }

    try {
      for (const item of clipboard.items) {
        const fileName = path.basename(item.path);
        let destPath = path.join(targetDir, fileName);
        
        // Get unique path if file exists
        destPath = await ipcRenderer.invoke('fs:getUniquePath', destPath);
        
        if (clipboard.operation === 'cut') {
          // Move operation
          if (item.path !== destPath) {
            await ipcRenderer.invoke('fs:rename', item.path, destPath);
          }
        } else {
          // Copy operation
          if (item.isDirectory) {
            await ipcRenderer.invoke('fs:copyDirectory', item.path, destPath);
          } else {
            await ipcRenderer.invoke('fs:copyFile', item.path, destPath);
          }
        }
      }
      
      // Clear clipboard after cut
      if (clipboard.operation === 'cut') {
        setClipboard(null);
      }
      
      await onRefresh();
    } catch (error) {
      console.error('Error pasting:', error);
      alert('Failed to paste item(s)');
    }
    closeContextMenu();
  }, [clipboard, contextMenu.node, workspacePath, onRefresh]);

  // Delete operation
  const handleDelete = useCallback(async () => {
    const selected = contextMenu.node ? [contextMenu.node] : getSelectedNodes();
    if (selected.length === 0) {
      closeContextMenu();
      return;
    }
    
    const names = selected.map(n => n.name).join(', ');
    if (confirm(`Are you sure you want to delete ${names}?`)) {
      try {
        for (const item of selected) {
          await ipcRenderer.invoke('fs:delete', item.path);
        }
        await onRefresh();
      } catch (error) {
        console.error('Error deleting:', error);
        alert('Failed to delete item(s)');
      }
    }
    closeContextMenu();
  }, [contextMenu.node, onRefresh]);

  // Rename operation
  const handleRename = useCallback(() => {
    if (!contextMenu.node || !treeRef.current) {
      closeContextMenu();
      return;
    }
    const node = treeRef.current.get(contextMenu.node.id);
    if (node) {
      node.edit();
    }
    closeContextMenu();
  }, [contextMenu.node]);

  // Copy path to clipboard
  const handleCopyPath = useCallback(() => {
    if (contextMenu.node) {
      navigator.clipboard.writeText(contextMenu.node.path);
    }
    closeContextMenu();
  }, [contextMenu.node]);

  // Reveal in file explorer
  const handleRevealInExplorer = useCallback(async () => {
    if (contextMenu.node) {
      await ipcRenderer.invoke('fs:revealInExplorer', contextMenu.node.path);
    }
    closeContextMenu();
  }, [contextMenu.node]);

  // New file
  const handleNewFile = useCallback(() => {
    let parentPath: string;
    if (contextMenu.node) {
      parentPath = contextMenu.node.isDirectory 
        ? contextMenu.node.path 
        : path.dirname(contextMenu.node.path);
    } else if (workspacePath) {
      parentPath = workspacePath;
    } else {
      closeContextMenu();
      return;
    }
    setNewItemParentPath(parentPath);
    setIsCreatingNew('file');
    closeContextMenu();
  }, [contextMenu.node, workspacePath]);

  // New folder
  const handleNewFolder = useCallback(() => {
    let parentPath: string;
    if (contextMenu.node) {
      parentPath = contextMenu.node.isDirectory 
        ? contextMenu.node.path 
        : path.dirname(contextMenu.node.path);
    } else if (workspacePath) {
      parentPath = workspacePath;
    } else {
      closeContextMenu();
      return;
    }
    setNewItemParentPath(parentPath);
    setIsCreatingNew('folder');
    closeContextMenu();
  }, [contextMenu.node, workspacePath]);

  // Create new item
  const handleCreateNewItem = async (name: string) => {
    if (!name || !newItemParentPath) {
      setIsCreatingNew(null);
      setNewItemParentPath(null);
      return;
    }

    try {
      const newPath = path.join(newItemParentPath, name);
      
      if (isCreatingNew === 'file') {
        await ipcRenderer.invoke('fs:createFile', newPath);
      } else {
        await ipcRenderer.invoke('fs:createDirectory', newPath);
      }
      
      await onRefresh();
    } catch (error) {
      console.error('Error creating new item:', error);
      alert('Failed to create item');
    }
    
    setIsCreatingNew(null);
    setNewItemParentPath(null);
  };

  // Handle rename submit from tree
  const handleRenameSubmit = async (args: { id: string; name: string; node: NodeApi<TreeNode> }) => {
    const { node, name } = args;
    if (name && name !== node.data.name) {
      try {
        const newPath = path.join(path.dirname(node.data.path), name);
        await ipcRenderer.invoke('fs:rename', node.data.path, newPath);
        await onRefresh();
      } catch (error) {
        console.error('Error renaming:', error);
        alert('Failed to rename item');
      }
    }
  };

  // Handle move (drag & drop)
  const handleMove = async (args: { dragIds: string[]; parentId: string | null; index: number }) => {
    const { dragIds, parentId } = args;
    
    if (dragIds.length === 0) return;
    
    // Use workspace path if dropping at root level (parentId is null)
    const targetDir = parentId || workspacePath;
    if (!targetDir) return;
    
    try {
      for (const dragId of dragIds) {
        const fileName = path.basename(dragId);
        let newPath = path.join(targetDir, fileName);
        
        // Get unique path if needed and only move if path changed
        if (dragId !== newPath) {
          newPath = await ipcRenderer.invoke('fs:getUniquePath', newPath);
          await ipcRenderer.invoke('fs:rename', dragId, newPath);
        }
      }
      await onRefresh();
    } catch (error) {
      console.error('Error moving file:', error);
      alert('Failed to move item');
    }
  };

  // Handle file selection
  const handleSelect = (nodes: NodeApi<TreeNode>[]) => {
    if (nodes.length === 1 && !nodes[0].data.isDirectory) {
      onFileClick({
        name: nodes[0].data.name,
        path: nodes[0].data.path,
        isDirectory: false
      });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if file tree is focused
      if (!containerRef.current?.contains(document.activeElement)) return;
      
      const selected = getSelectedNodes();
      
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'c':
            e.preventDefault();
            if (selected.length > 0) {
              setClipboard({ items: selected, operation: 'copy' });
            }
            break;
          case 'x':
            e.preventDefault();
            if (selected.length > 0) {
              setClipboard({ items: selected, operation: 'cut' });
            }
            break;
          case 'v':
            e.preventDefault();
            if (clipboard) {
              // Trigger paste with current selection as target
              const target = selected.length > 0 ? selected[0] : null;
              setContextMenu({ visible: false, x: 0, y: 0, node: target });
              handlePaste();
            }
            break;
        }
      } else {
        switch (e.key) {
          case 'F2':
            e.preventDefault();
            if (selected.length === 1 && treeRef.current) {
              const node = treeRef.current.get(selected[0].path);
              if (node) node.edit();
            }
            break;
          case 'Delete':
            e.preventDefault();
            if (selected.length > 0) {
              setContextMenu({ visible: false, x: 0, y: 0, node: selected[0] });
              handleDelete();
            }
            break;
          case 'Enter':
            e.preventDefault();
            if (selected.length === 1) {
              if (selected[0].isDirectory && treeRef.current) {
                const node = treeRef.current.get(selected[0].path);
                if (node) node.toggle();
              } else {
                onFileClick({
                  name: selected[0].name,
                  path: selected[0].path,
                  isDirectory: false
                });
              }
            }
            break;
          default:
            // Jump to file/folder by letter key
            if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key) && treeRef.current) {
              const letter = e.key.toLowerCase();
              // Get all visible nodes from the tree
              const allNodes = treeRef.current.visibleNodes as NodeApi<TreeNode>[];
              if (allNodes && allNodes.length > 0) {
                // Find the first node starting with this letter
                const matchingNode = allNodes.find((node: NodeApi<TreeNode>) => 
                  node.data.name.toLowerCase().startsWith(letter)
                );
                if (matchingNode) {
                  matchingNode.select();
                  // Scroll the node into view
                  treeRef.current.scrollTo(matchingNode.id);
                }
              }
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clipboard, handlePaste, handleDelete, onFileClick]);

  return (
    <div 
      ref={containerRef}
      className="file-tree"
      onContextMenu={handleEmptyAreaContextMenu}
      tabIndex={0}
    >
      {/* New item input */}
      {isCreatingNew && (
        <div className="new-item-inline">
          <span className="file-icon">{isCreatingNew === 'folder' ? '📁' : '📄'}</span>
          <input
            type="text"
            className="file-rename-input"
            placeholder={isCreatingNew === 'folder' ? 'New folder name...' : 'New file name...'}
            autoFocus
            onBlur={(e) => handleCreateNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateNewItem((e.target as HTMLInputElement).value);
              }
              if (e.key === 'Escape') {
                setIsCreatingNew(null);
                setNewItemParentPath(null);
              }
            }}
          />
        </div>
      )}

      {items.length > 0 ? (
        <div className="file-tree-container">
          <Tree
            ref={treeRef}
            data={treeData}
            openByDefault={false}
            width="100%"
            height={treeHeight}
            indent={16}
            rowHeight={28}
            overscanCount={5}
            onRename={handleRenameSubmit}
            onMove={handleMove}
            onSelect={handleSelect}
            disableDrag={false}
            disableDrop={false}
            childrenAccessor="children"
          >
            {createNodeRenderer(handleContextMenu, clipboard)}
          </Tree>
        </div>
      ) : (
        <div className="file-tree-empty">
          <p>No files yet</p>
          <p style={{ fontSize: '11px', marginTop: '8px' }}>
            Right-click to create files
          </p>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <>
          <div className="context-menu-overlay" onClick={closeContextMenu} />
          <div 
            className="context-menu" 
            style={{ 
              position: 'fixed',
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`
            }}
          >
            <div className="context-menu-item" onClick={handleNewFile}>
              New File
            </div>
            <div className="context-menu-item" onClick={handleNewFolder}>
              New Folder
            </div>
            <div className="context-menu-separator" />
            
            {contextMenu.node && (
              <>
                <div className="context-menu-item" onClick={handleCut}>
                  Cut
                  <span className="context-menu-shortcut">Ctrl+X</span>
                </div>
                <div className="context-menu-item" onClick={handleCopy}>
                  Copy
                  <span className="context-menu-shortcut">Ctrl+C</span>
                </div>
              </>
            )}
            
            {clipboard && clipboard.items.length > 0 && (
              <div className="context-menu-item" onClick={handlePaste}>
                Paste
                <span className="context-menu-shortcut">Ctrl+V</span>
              </div>
            )}
            
            {contextMenu.node && (
              <>
                <div className="context-menu-separator" />
                <div className="context-menu-item" onClick={handleCopyPath}>
                  Copy Path
                </div>
                <div className="context-menu-item" onClick={handleRevealInExplorer}>
                  Reveal in File Explorer
                </div>
                <div className="context-menu-separator" />
                <div className="context-menu-item" onClick={handleRename}>
                  Rename
                  <span className="context-menu-shortcut">F2</span>
                </div>
                <div className="context-menu-item danger" onClick={handleDelete}>
                  Delete
                  <span className="context-menu-shortcut">Del</span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FileTree;
