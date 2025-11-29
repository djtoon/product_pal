import React, { useState, useEffect } from 'react';
import './StakeholdersPanel.css';
import { Stakeholder } from '../../shared/types';
import peopleIcon from '../assets/icons/people.svg';

const { ipcRenderer } = window.require('electron');

interface StakeholdersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onStakeholdersChange?: (stakeholders: Stakeholder[]) => void;
}

const StakeholdersPanel: React.FC<StakeholdersPanelProps> = ({ isOpen, onClose, onStakeholdersChange }) => {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStakeholders();
    }
  }, [isOpen]);

  const loadStakeholders = async () => {
    try {
      const saved = await ipcRenderer.invoke('stakeholders:load');
      if (saved) {
        setStakeholders(saved);
      }
    } catch (error) {
      console.error('Error loading stakeholders:', error);
    }
  };

  const saveStakeholders = async (updated: Stakeholder[]) => {
    setIsSaving(true);
    try {
      await ipcRenderer.invoke('stakeholders:save', updated);
      setStakeholders(updated);
      onStakeholdersChange?.(updated);
    } catch (error) {
      console.error('Error saving stakeholders:', error);
      alert('Failed to save stakeholders');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newRole.trim()) {
      alert('Please enter both name and role');
      return;
    }

    const newStakeholder: Stakeholder = {
      id: Date.now().toString(),
      name: newName.trim(),
      role: newRole.trim()
    };

    const updated = [...stakeholders, newStakeholder];
    await saveStakeholders(updated);
    setNewName('');
    setNewRole('');
  };

  const handleDelete = async (id: string) => {
    const updated = stakeholders.filter(s => s.id !== id);
    await saveStakeholders(updated);
  };

  const handleStartEdit = (stakeholder: Stakeholder) => {
    setEditingId(stakeholder.id);
    setEditName(stakeholder.name);
    setEditRole(stakeholder.role);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditRole('');
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editRole.trim()) {
      alert('Please enter both name and role');
      return;
    }

    const updated = stakeholders.map(s => 
      s.id === editingId 
        ? { ...s, name: editName.trim(), role: editRole.trim() }
        : s
    );
    await saveStakeholders(updated);
    handleCancelEdit();
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: 'add' | 'edit') => {
    if (e.key === 'Enter') {
      if (action === 'add') {
        handleAdd();
      } else {
        handleSaveEdit();
      }
    } else if (e.key === 'Escape' && action === 'edit') {
      handleCancelEdit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="stakeholders-overlay" onClick={onClose}>
      <div className="stakeholders-panel" onClick={(e) => e.stopPropagation()}>
        <div className="stakeholders-header">
          <h2>
            <img src={peopleIcon} alt="" className="stakeholders-icon" />
            Stakeholders
          </h2>
          <button className="stakeholders-close" onClick={onClose}>×</button>
        </div>

        <div className="stakeholders-content">
          <div className="stakeholders-section">
            <h3>Add New Stakeholder</h3>
            <div className="stakeholders-add-form">
              <input
                type="text"
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => handleKeyPress(e, 'add')}
                disabled={isSaving}
              />
              <input
                type="text"
                placeholder="Role (e.g., Product Manager)"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => handleKeyPress(e, 'add')}
                disabled={isSaving}
              />
              <button 
                className="stakeholders-btn primary"
                onClick={handleAdd}
                disabled={isSaving || !newName.trim() || !newRole.trim()}
              >
                Add
              </button>
            </div>
          </div>

          <div className="stakeholders-section">
            <h3>Current Stakeholders ({stakeholders.length})</h3>
            {stakeholders.length === 0 ? (
              <div className="stakeholders-empty">
                No stakeholders added yet. Add your first stakeholder above.
              </div>
            ) : (
              <div className="stakeholders-list">
                {stakeholders.map((stakeholder) => (
                  <div key={stakeholder.id} className="stakeholder-item">
                    {editingId === stakeholder.id ? (
                      <div className="stakeholder-edit">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => handleKeyPress(e, 'edit')}
                          placeholder="Name"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          onKeyDown={(e) => handleKeyPress(e, 'edit')}
                          placeholder="Role"
                        />
                        <div className="stakeholder-edit-actions">
                          <button 
                            className="stakeholders-btn small primary"
                            onClick={handleSaveEdit}
                            disabled={isSaving}
                          >
                            Save
                          </button>
                          <button 
                            className="stakeholders-btn small secondary"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="stakeholder-info">
                          <span className="stakeholder-name">{stakeholder.name}</span>
                          <span className="stakeholder-role">{stakeholder.role}</span>
                        </div>
                        <div className="stakeholder-actions">
                          <button 
                            className="stakeholder-action-btn"
                            onClick={() => handleStartEdit(stakeholder)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button 
                            className="stakeholder-action-btn delete"
                            onClick={() => handleDelete(stakeholder.id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="stakeholders-note">
            <strong>Tip:</strong> You can mention stakeholders in AI chat using @[Name] or include all 
            stakeholders with the checkbox. The AI will include their names and roles in documents.
          </div>
        </div>

        <div className="stakeholders-footer">
          <button className="stakeholders-btn secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StakeholdersPanel;

