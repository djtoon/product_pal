import React, { useState, useCallback, useEffect, useRef } from 'react';
import './KanbanEditor.css';

type Priority = 'high' | 'medium' | 'low' | 'none';

interface KanbanCard {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  completed: boolean;
}

interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

interface KanbanEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Parse markdown content into kanban structure
const parseKanbanMarkdown = (content: string): { title: string; columns: KanbanColumn[] } => {
  const lines = content.split('\n');
  let boardTitle = 'Kanban Board';
  const columns: KanbanColumn[] = [];
  let currentColumn: KanbanColumn | null = null;
  let currentCard: KanbanCard | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Board title: # [KANBAN] Title
    const titleMatch = line.match(/^#\s*\[KANBAN\]\s*(.*)/);
    if (titleMatch) {
      boardTitle = titleMatch[1].trim() || 'Kanban Board';
      continue;
    }

    // Column: ## Column Name
    const columnMatch = line.match(/^##\s+(.+)/);
    if (columnMatch) {
      if (currentColumn) {
        if (currentCard) {
          currentColumn.cards.push(currentCard);
          currentCard = null;
        }
        columns.push(currentColumn);
      }
      currentColumn = {
        id: generateId(),
        title: columnMatch[1].trim(),
        cards: []
      };
      continue;
    }

    // Card: - [ ] **Title** | priority:xxx or - [x] **Title** | priority:xxx
    const cardMatch = line.match(/^-\s*\[([ x])\]\s*\*\*(.+?)\*\*(?:\s*\|\s*priority:(\w+))?/);
    if (cardMatch && currentColumn) {
      if (currentCard) {
        currentColumn.cards.push(currentCard);
      }
      currentCard = {
        id: generateId(),
        title: cardMatch[2].trim(),
        description: '',
        priority: (cardMatch[3] as Priority) || 'none',
        completed: cardMatch[1] === 'x'
      };
      continue;
    }

    // Description lines (indented text after a card)
    if (currentCard && line.match(/^\s{2,}/) && line.trim()) {
      currentCard.description += (currentCard.description ? '\n' : '') + line.trim();
    }
  }

  // Push last card and column
  if (currentColumn) {
    if (currentCard) {
      currentColumn.cards.push(currentCard);
    }
    columns.push(currentColumn);
  }

  // Ensure at least 3 default columns if none exist
  if (columns.length === 0) {
    columns.push(
      { id: generateId(), title: 'Backlog', cards: [] },
      { id: generateId(), title: 'In Progress', cards: [] },
      { id: generateId(), title: 'Done', cards: [] }
    );
  }

  return { title: boardTitle, columns };
};

// Serialize kanban structure back to markdown
const serializeToMarkdown = (title: string, columns: KanbanColumn[]): string => {
  let md = `# [KANBAN] ${title}\n\n`;

  for (const column of columns) {
    md += `## ${column.title}\n`;
    
    for (const card of column.cards) {
      const checkbox = card.completed ? '[x]' : '[ ]';
      const priority = card.priority !== 'none' ? ` | priority:${card.priority}` : '';
      md += `- ${checkbox} **${card.title}**${priority}\n`;
      
      if (card.description) {
        const descLines = card.description.split('\n');
        for (const descLine of descLines) {
          md += `  ${descLine}\n`;
        }
      }
    }
    
    md += '\n';
  }

  return md.trim() + '\n';
};

const PRIORITY_COLORS: Record<Priority, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
  none: 'transparent'
};

const KanbanEditor: React.FC<KanbanEditorProps> = ({ content, onChange, onSave }) => {
  const [boardTitle, setBoardTitle] = useState('Kanban Board');
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [draggedCard, setDraggedCard] = useState<{ card: KanbanCard; columnId: string } | null>(null);
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [showNewColumnInput, setShowNewColumnInput] = useState(false);
  
  const initialParseRef = useRef(false);

  // Handle Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Blur any active input to commit pending changes
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        // Small delay to let blur handlers complete
        setTimeout(() => {
          if (onSave) {
            onSave();
          }
        }, 10);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSave]);

  // Parse content on mount and when content changes externally
  useEffect(() => {
    if (!initialParseRef.current || content !== serializeToMarkdown(boardTitle, columns)) {
      const parsed = parseKanbanMarkdown(content);
      setBoardTitle(parsed.title);
      setColumns(parsed.columns);
      initialParseRef.current = true;
    }
  }, [content]);

  // Serialize and notify parent of changes
  const saveChanges = useCallback((newTitle: string, newColumns: KanbanColumn[]) => {
    const markdown = serializeToMarkdown(newTitle, newColumns);
    onChange(markdown);
  }, [onChange]);

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, card: KanbanCard, columnId: string) => {
    setDraggedCard({ card, columnId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.id);
    
    // Find the card element and add dragging class
    const cardElement = (e.target as HTMLElement).closest('.kanban-card');
    if (cardElement) {
      cardElement.classList.add('dragging');
    }
  };

  // Handle drag end
  const handleDragEnd = (e: React.DragEvent) => {
    // Remove dragging class from all cards
    document.querySelectorAll('.kanban-card.dragging').forEach(el => {
      el.classList.remove('dragging');
    });
    setDraggedCard(null);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop on column
  const handleDrop = (e: React.DragEvent, targetColumnId: string, targetIndex?: number) => {
    e.preventDefault();
    if (!draggedCard) return;

    const { card, columnId: sourceColumnId } = draggedCard;

    setColumns(prev => {
      const newColumns = prev.map(col => ({
        ...col,
        cards: [...col.cards]
      }));

      // Find source and target columns
      const sourceColumn = newColumns.find(col => col.id === sourceColumnId);
      const targetColumn = newColumns.find(col => col.id === targetColumnId);

      if (!sourceColumn || !targetColumn) return prev;

      // Remove from source
      const cardIndex = sourceColumn.cards.findIndex(c => c.id === card.id);
      if (cardIndex === -1) return prev;
      sourceColumn.cards.splice(cardIndex, 1);

      // Add to target
      const insertIndex = targetIndex !== undefined ? targetIndex : targetColumn.cards.length;
      targetColumn.cards.splice(insertIndex, 0, card);

      saveChanges(boardTitle, newColumns);
      return newColumns;
    });

    setDraggedCard(null);
  };

  // Add new card
  const addCard = (columnId: string) => {
    const newCard: KanbanCard = {
      id: generateId(),
      title: 'New Card',
      description: '',
      priority: 'none',
      completed: false
    };

    setColumns(prev => {
      const newColumns = prev.map(col => {
        if (col.id === columnId) {
          return { ...col, cards: [...col.cards, newCard] };
        }
        return col;
      });
      saveChanges(boardTitle, newColumns);
      return newColumns;
    });

    setEditingCard(newCard.id);
  };

  // Update card
  const updateCard = (columnId: string, cardId: string, updates: Partial<KanbanCard>) => {
    setColumns(prev => {
      const newColumns = prev.map(col => {
        if (col.id === columnId) {
          return {
            ...col,
            cards: col.cards.map(card => 
              card.id === cardId ? { ...card, ...updates } : card
            )
          };
        }
        return col;
      });
      saveChanges(boardTitle, newColumns);
      return newColumns;
    });
  };

  // Delete card
  const deleteCard = (columnId: string, cardId: string) => {
    setColumns(prev => {
      const newColumns = prev.map(col => {
        if (col.id === columnId) {
          return {
            ...col,
            cards: col.cards.filter(card => card.id !== cardId)
          };
        }
        return col;
      });
      saveChanges(boardTitle, newColumns);
      return newColumns;
    });
  };

  // Add new column
  const addColumn = () => {
    if (!newColumnTitle.trim()) return;
    
    const newColumn: KanbanColumn = {
      id: generateId(),
      title: newColumnTitle.trim(),
      cards: []
    };

    setColumns(prev => {
      const newColumns = [...prev, newColumn];
      saveChanges(boardTitle, newColumns);
      return newColumns;
    });

    setNewColumnTitle('');
    setShowNewColumnInput(false);
  };

  // Update column title
  const updateColumnTitle = (columnId: string, title: string) => {
    setColumns(prev => {
      const newColumns = prev.map(col => 
        col.id === columnId ? { ...col, title } : col
      );
      saveChanges(boardTitle, newColumns);
      return newColumns;
    });
    setEditingColumn(null);
  };

  // Delete column
  const deleteColumn = (columnId: string) => {
    if (!confirm('Delete this column and all its cards?')) return;
    
    setColumns(prev => {
      const newColumns = prev.filter(col => col.id !== columnId);
      saveChanges(boardTitle, newColumns);
      return newColumns;
    });
  };

  // Update board title
  const updateBoardTitle = (title: string) => {
    setBoardTitle(title);
    saveChanges(title, columns);
    setEditingTitle(false);
  };

  return (
    <div className="kanban-editor">
      <div className="kanban-header">
        {editingTitle ? (
          <input
            type="text"
            className="kanban-title-input"
            defaultValue={boardTitle}
            autoFocus
            onBlur={(e) => updateBoardTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateBoardTitle((e.target as HTMLInputElement).value);
              if (e.key === 'Escape') setEditingTitle(false);
            }}
          />
        ) : (
          <h1 className="kanban-title" onClick={() => setEditingTitle(true)}>
            {boardTitle}
          </h1>
        )}
      </div>

      <div className="kanban-board">
        {columns.map(column => (
          <div 
            key={column.id} 
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="kanban-column-header">
              {editingColumn === column.id ? (
                <input
                  type="text"
                  className="kanban-column-title-input"
                  defaultValue={column.title}
                  autoFocus
                  onBlur={(e) => updateColumnTitle(column.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') updateColumnTitle(column.id, (e.target as HTMLInputElement).value);
                    if (e.key === 'Escape') setEditingColumn(null);
                  }}
                />
              ) : (
                <h2 
                  className="kanban-column-title"
                  onClick={() => setEditingColumn(column.id)}
                >
                  {column.title}
                  <span className="kanban-column-count">{column.cards.length}</span>
                </h2>
              )}
              <button 
                className="kanban-column-delete" 
                onClick={() => deleteColumn(column.id)}
                title="Delete column"
              >
                ×
              </button>
            </div>

            <div className="kanban-cards">
              {column.cards.map((card, index) => (
                <div
                  key={card.id}
                  className={`kanban-card ${card.completed ? 'completed' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    handleDrop(e, column.id, index);
                  }}
                >
                  {card.priority !== 'none' && (
                    <div 
                      className="kanban-card-priority"
                      style={{ backgroundColor: PRIORITY_COLORS[card.priority] }}
                    />
                  )}
                  
                  {editingCard === card.id ? (
                    <div className="kanban-card-edit">
                      <input
                        type="text"
                        className="kanban-card-title-input"
                        defaultValue={card.title}
                        autoFocus
                        placeholder="Card title"
                        onBlur={(e) => {
                          updateCard(column.id, card.id, { title: e.target.value });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            updateCard(column.id, card.id, { title: (e.target as HTMLInputElement).value });
                          }
                        }}
                      />
                      <textarea
                        className="kanban-card-desc-input"
                        defaultValue={card.description}
                        placeholder="Description (optional)"
                        rows={3}
                        onBlur={(e) => {
                          updateCard(column.id, card.id, { description: e.target.value });
                        }}
                      />
                      <div className="kanban-card-edit-row">
                        <select
                          className="kanban-priority-select"
                          defaultValue={card.priority}
                          onChange={(e) => updateCard(column.id, card.id, { priority: e.target.value as Priority })}
                        >
                          <option value="none">No Priority</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <button
                          className="kanban-card-done-btn"
                          onClick={() => setEditingCard(null)}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div 
                        className="kanban-card-drag-handle"
                        draggable
                        onDragStart={(e) => handleDragStart(e, card, column.id)}
                        onDragEnd={handleDragEnd}
                        title="Drag to move"
                      >
                        <span className="drag-icon">⋮⋮</span>
                      </div>
                      <div className="kanban-card-content" onClick={() => setEditingCard(card.id)}>
                        <div className="kanban-card-header">
                          <input
                            type="checkbox"
                            className="kanban-card-checkbox"
                            checked={card.completed}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateCard(column.id, card.id, { completed: e.target.checked });
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="kanban-card-title">{card.title}</span>
                        </div>
                        {card.description && (
                          <p className="kanban-card-description">{card.description}</p>
                        )}
                        {card.priority !== 'none' && (
                          <span className={`kanban-card-priority-label priority-${card.priority}`}>
                            {card.priority}
                          </span>
                        )}
                      </div>
                      <button
                        className="kanban-card-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCard(column.id, card.id);
                        }}
                        title="Delete card"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <button 
              className="kanban-add-card"
              onClick={() => addCard(column.id)}
            >
              + Add Card
            </button>
          </div>
        ))}

        <div className="kanban-add-column">
          {showNewColumnInput ? (
            <div className="kanban-new-column-form">
              <input
                type="text"
                className="kanban-new-column-input"
                placeholder="Column title"
                value={newColumnTitle}
                autoFocus
                onChange={(e) => setNewColumnTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addColumn();
                  if (e.key === 'Escape') {
                    setShowNewColumnInput(false);
                    setNewColumnTitle('');
                  }
                }}
              />
              <div className="kanban-new-column-buttons">
                <button className="kanban-new-column-add" onClick={addColumn}>Add</button>
                <button 
                  className="kanban-new-column-cancel" 
                  onClick={() => {
                    setShowNewColumnInput(false);
                    setNewColumnTitle('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button 
              className="kanban-add-column-btn"
              onClick={() => setShowNewColumnInput(true)}
            >
              + Add Column
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KanbanEditor;

