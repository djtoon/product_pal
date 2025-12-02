import React, { useState, useCallback, useEffect, useRef } from 'react';
import './TimelineEditor.css';

type EventStatus = 'completed' | 'in_progress' | 'upcoming' | 'delayed';

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  status: EventStatus;
}

interface TimelinePhase {
  id: string;
  title: string;
  events: TimelineEvent[];
}

interface TimelineEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Format date for display
const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  } catch {
    return dateStr;
  }
};

// Parse markdown content into timeline structure
const parseTimelineMarkdown = (content: string): { title: string; phases: TimelinePhase[] } => {
  const lines = content.split('\n');
  let timelineTitle = 'Project Timeline';
  const phases: TimelinePhase[] = [];
  let currentPhase: TimelinePhase | null = null;
  let currentEvent: TimelineEvent | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Timeline title: # [TIMELINE] Title
    const titleMatch = line.match(/^#\s*\[TIMELINE\]\s*(.*)/);
    if (titleMatch) {
      timelineTitle = titleMatch[1].trim() || 'Project Timeline';
      continue;
    }

    // Phase: ## Phase Name
    const phaseMatch = line.match(/^##\s+(.+)/);
    if (phaseMatch) {
      if (currentPhase) {
        if (currentEvent) {
          currentPhase.events.push(currentEvent);
          currentEvent = null;
        }
        phases.push(currentPhase);
      }
      currentPhase = {
        id: generateId(),
        title: phaseMatch[1].trim(),
        events: []
      };
      continue;
    }

    // Event: - [YYYY-MM-DD] **Title** | status:xxx
    const eventMatch = line.match(/^-\s*\[(\d{4}-\d{2}-\d{2})\]\s*\*\*(.+?)\*\*(?:\s*\|\s*status:(\w+))?/);
    if (eventMatch && currentPhase) {
      if (currentEvent) {
        currentPhase.events.push(currentEvent);
      }
      currentEvent = {
        id: generateId(),
        date: eventMatch[1],
        title: eventMatch[2].trim(),
        description: '',
        status: (eventMatch[3] as EventStatus) || 'upcoming'
      };
      continue;
    }

    // Description lines (indented text after an event)
    if (currentEvent && line.match(/^\s{2,}/) && line.trim()) {
      currentEvent.description += (currentEvent.description ? '\n' : '') + line.trim();
    }
  }

  // Push last event and phase
  if (currentPhase) {
    if (currentEvent) {
      currentPhase.events.push(currentEvent);
    }
    phases.push(currentPhase);
  }

  // Ensure at least one default phase if none exist
  if (phases.length === 0) {
    phases.push(
      { id: generateId(), title: 'Phase 1', events: [] }
    );
  }

  return { title: timelineTitle, phases };
};

// Serialize timeline structure back to markdown
const serializeToMarkdown = (title: string, phases: TimelinePhase[]): string => {
  let md = `# [TIMELINE] ${title}\n\n`;

  for (const phase of phases) {
    md += `## ${phase.title}\n`;
    
    for (const event of phase.events) {
      const status = event.status !== 'upcoming' ? ` | status:${event.status}` : ' | status:upcoming';
      md += `- [${event.date}] **${event.title}**${status}\n`;
      
      if (event.description) {
        const descLines = event.description.split('\n');
        for (const descLine of descLines) {
          md += `  ${descLine}\n`;
        }
      }
    }
    
    md += '\n';
  }

  return md.trim() + '\n';
};

const STATUS_COLORS: Record<EventStatus, string> = {
  completed: '#22c55e',
  in_progress: '#3b82f6',
  upcoming: '#6b7280',
  delayed: '#ef4444'
};

const STATUS_LABELS: Record<EventStatus, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  upcoming: 'Upcoming',
  delayed: 'Delayed'
};

const TimelineEditor: React.FC<TimelineEditorProps> = ({ content, onChange, onSave }) => {
  const [timelineTitle, setTimelineTitle] = useState('Project Timeline');
  const [phases, setPhases] = useState<TimelinePhase[]>([]);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newPhaseTitle, setNewPhaseTitle] = useState('');
  const [showNewPhaseInput, setShowNewPhaseInput] = useState(false);
  
  // Track the last content we sent to parent to avoid re-parsing our own changes
  const lastSentContentRef = useRef<string>('');

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
    // Skip if this is content we just sent (internal change)
    // Normalize both for comparison (trim whitespace)
    if (content.trim() === lastSentContentRef.current.trim()) {
      return;
    }
    
    // Parse on initial load or when content changes externally
    const parsed = parseTimelineMarkdown(content);
    setTimelineTitle(parsed.title);
    setPhases(parsed.phases);
  }, [content]);

  // Serialize and notify parent of changes
  const saveChanges = useCallback((newTitle: string, newPhases: TimelinePhase[]) => {
    const markdown = serializeToMarkdown(newTitle, newPhases);
    lastSentContentRef.current = markdown;
    onChange(markdown);
  }, [onChange]);

  // Add new event
  const addEvent = (phaseId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const newEvent: TimelineEvent = {
      id: generateId(),
      date: today,
      title: 'New Event',
      description: '',
      status: 'upcoming'
    };

    setPhases(prev => {
      const newPhases = prev.map(phase => {
        if (phase.id === phaseId) {
          return { ...phase, events: [...phase.events, newEvent] };
        }
        return phase;
      });
      saveChanges(timelineTitle, newPhases);
      return newPhases;
    });

    setEditingEvent(newEvent.id);
  };

  // Update event
  const updateEvent = (phaseId: string, eventId: string, updates: Partial<TimelineEvent>) => {
    setPhases(prev => {
      const newPhases = prev.map(phase => {
        if (phase.id === phaseId) {
          return {
            ...phase,
            events: phase.events.map(event => 
              event.id === eventId ? { ...event, ...updates } : event
            )
          };
        }
        return phase;
      });
      saveChanges(timelineTitle, newPhases);
      return newPhases;
    });
  };

  // Delete event
  const deleteEvent = (phaseId: string, eventId: string) => {
    setPhases(prev => {
      const newPhases = prev.map(phase => {
        if (phase.id === phaseId) {
          return {
            ...phase,
            events: phase.events.filter(event => event.id !== eventId)
          };
        }
        return phase;
      });
      saveChanges(timelineTitle, newPhases);
      return newPhases;
    });
  };

  // Add new phase
  const addPhase = () => {
    if (!newPhaseTitle.trim()) return;
    
    const newPhase: TimelinePhase = {
      id: generateId(),
      title: newPhaseTitle.trim(),
      events: []
    };

    setPhases(prev => {
      const newPhases = [...prev, newPhase];
      saveChanges(timelineTitle, newPhases);
      return newPhases;
    });

    setNewPhaseTitle('');
    setShowNewPhaseInput(false);
  };

  // Update phase title
  const updatePhaseTitle = (phaseId: string, title: string) => {
    setPhases(prev => {
      const newPhases = prev.map(phase => 
        phase.id === phaseId ? { ...phase, title } : phase
      );
      saveChanges(timelineTitle, newPhases);
      return newPhases;
    });
    setEditingPhase(null);
  };

  // Delete phase
  const deletePhase = (phaseId: string) => {
    if (!confirm('Delete this phase and all its events?')) return;
    
    setPhases(prev => {
      const newPhases = prev.filter(phase => phase.id !== phaseId);
      saveChanges(timelineTitle, newPhases);
      return newPhases;
    });
  };

  // Update timeline title
  const updateTimelineTitle = (title: string) => {
    setTimelineTitle(title);
    saveChanges(title, phases);
    setEditingTitle(false);
  };

  return (
    <div className="timeline-editor">
      <div className="timeline-header">
        {editingTitle ? (
          <input
            type="text"
            className="timeline-title-input"
            defaultValue={timelineTitle}
            autoFocus
            onBlur={(e) => updateTimelineTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateTimelineTitle((e.target as HTMLInputElement).value);
              if (e.key === 'Escape') setEditingTitle(false);
            }}
          />
        ) : (
          <h1 className="timeline-title" onClick={() => setEditingTitle(true)}>
            {timelineTitle}
          </h1>
        )}
      </div>

      <div className="timeline-content">
        {phases.map((phase, phaseIndex) => (
          <div key={phase.id} className="timeline-phase">
            <div className="timeline-phase-header">
              {editingPhase === phase.id ? (
                <input
                  type="text"
                  className="timeline-phase-title-input"
                  defaultValue={phase.title}
                  autoFocus
                  onBlur={(e) => updatePhaseTitle(phase.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') updatePhaseTitle(phase.id, (e.target as HTMLInputElement).value);
                    if (e.key === 'Escape') setEditingPhase(null);
                  }}
                />
              ) : (
                <h2 
                  className="timeline-phase-title"
                  onClick={() => setEditingPhase(phase.id)}
                >
                  {phase.title}
                  <span className="timeline-phase-count">{phase.events.length} events</span>
                </h2>
              )}
              <button 
                className="timeline-phase-delete" 
                onClick={() => deletePhase(phase.id)}
                title="Delete phase"
              >
                ×
              </button>
            </div>

            <div className="timeline-events">
              <div className="timeline-line" />
              
              {phase.events.map((event, eventIndex) => (
                <div
                  key={event.id}
                  className={`timeline-event status-${event.status}`}
                >
                  <div 
                    className="timeline-event-dot"
                    style={{ backgroundColor: STATUS_COLORS[event.status] }}
                  />
                  
                  {editingEvent === event.id ? (
                    <div className="timeline-event-edit">
                      <div className="timeline-event-edit-row">
                        <input
                          type="date"
                          className="timeline-event-date-input"
                          defaultValue={event.date}
                          onChange={(e) => updateEvent(phase.id, event.id, { date: e.target.value })}
                        />
                        <select
                          className="timeline-status-select"
                          defaultValue={event.status}
                          onChange={(e) => updateEvent(phase.id, event.id, { status: e.target.value as EventStatus })}
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="delayed">Delayed</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        className="timeline-event-title-input"
                        defaultValue={event.title}
                        autoFocus
                        placeholder="Event title"
                        onBlur={(e) => updateEvent(phase.id, event.id, { title: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            updateEvent(phase.id, event.id, { title: (e.target as HTMLInputElement).value });
                          }
                        }}
                      />
                      <textarea
                        className="timeline-event-desc-input"
                        defaultValue={event.description}
                        placeholder="Description (optional)"
                        rows={2}
                        onBlur={(e) => updateEvent(phase.id, event.id, { description: e.target.value })}
                      />
                      <button
                        className="timeline-event-done-btn"
                        onClick={() => setEditingEvent(null)}
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <div className="timeline-event-content" onClick={() => setEditingEvent(event.id)}>
                      <div className="timeline-event-date">
                        {formatDate(event.date)}
                      </div>
                      <div className="timeline-event-header">
                        <span className="timeline-event-title">{event.title}</span>
                        <span 
                          className={`timeline-event-status status-${event.status}`}
                          style={{ backgroundColor: `${STATUS_COLORS[event.status]}20`, color: STATUS_COLORS[event.status] }}
                        >
                          {STATUS_LABELS[event.status]}
                        </span>
                      </div>
                      {event.description && (
                        <p className="timeline-event-description">{event.description}</p>
                      )}
                      <button
                        className="timeline-event-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEvent(phase.id, event.id);
                        }}
                        title="Delete event"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              ))}
              
              <button 
                className="timeline-add-event"
                onClick={() => addEvent(phase.id)}
              >
                + Add Event
              </button>
            </div>
          </div>
        ))}

        <div className="timeline-add-phase">
          {showNewPhaseInput ? (
            <div className="timeline-new-phase-form">
              <input
                type="text"
                className="timeline-new-phase-input"
                placeholder="Phase title"
                value={newPhaseTitle}
                autoFocus
                onChange={(e) => setNewPhaseTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addPhase();
                  if (e.key === 'Escape') {
                    setShowNewPhaseInput(false);
                    setNewPhaseTitle('');
                  }
                }}
              />
              <div className="timeline-new-phase-buttons">
                <button className="timeline-new-phase-add" onClick={addPhase}>Add</button>
                <button 
                  className="timeline-new-phase-cancel" 
                  onClick={() => {
                    setShowNewPhaseInput(false);
                    setNewPhaseTitle('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button 
              className="timeline-add-phase-btn"
              onClick={() => setShowNewPhaseInput(true)}
            >
              + Add Phase
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimelineEditor;

