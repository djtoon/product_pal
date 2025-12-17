import React, { useState, useEffect } from 'react';
import './StakeholderSimulator.css';
import { Stakeholder } from '../../shared/types';
import simulateIcon from '../assets/icons/simulate.svg';

const { ipcRenderer } = window.require('electron');

interface StakeholderFeedback {
  stakeholderId: string;
  stakeholderName: string;
  stakeholderRole: string;
  emoji: string;
  blockers: string[];
  concerns: string[];
  questions: string[];
  suggestions: string[];
  verdict: 'approve' | 'concerns' | 'block';
}

interface SimulationResult {
  feedback: StakeholderFeedback[];
  summary: {
    totalBlockers: number;
    totalConcerns: number;
    readyForReview: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

interface StakeholderSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  prdContent: string;
  stakeholders: Stakeholder[];
}

const StakeholderSimulator: React.FC<StakeholderSimulatorProps> = ({
  isOpen,
  onClose,
  prdContent,
  stakeholders
}) => {
  const [selectedStakeholders, setSelectedStakeholders] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; stakeholder: string } | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedStakeholders(stakeholders.map(s => s.id));
      setResult(null);
      setError(null);
      setProgress(null);
    }
  }, [isOpen, stakeholders]);

  // Listen for progress updates
  useEffect(() => {
    const handleProgress = (_: any, data: any) => {
      setProgress(data);
    };

    ipcRenderer.on('simulator:progress', handleProgress);
    return () => {
      ipcRenderer.removeListener('simulator:progress', handleProgress);
    };
  }, []);

  const toggleStakeholder = (id: string) => {
    setSelectedStakeholders(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const runSimulation = async () => {
    if (selectedStakeholders.length === 0) {
      setError('Please select at least one stakeholder');
      return;
    }

    if (!prdContent.trim()) {
      setError('No document content to review. Please open a PRD file first.');
      return;
    }

    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const selectedList = stakeholders.filter(s => selectedStakeholders.includes(s.id));
      const response = await ipcRenderer.invoke(
        'simulator:run',
        prdContent,
        selectedList
      );

      if (response.success) {
        setResult(response.result);
      } else {
        setError(response.error || 'Simulation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  };

  if (!isOpen) return null;

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'approve':
        return <span className="verdict-badge approve">✅ Approved</span>;
      case 'block':
        return <span className="verdict-badge block">🚫 Blocked</span>;
      default:
        return <span className="verdict-badge concerns">⚠️ Has Concerns</span>;
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low':
        return <div className="risk-banner low">✅ Low Risk - Ready for stakeholder review</div>;
      case 'medium':
        return <div className="risk-banner medium">⚠️ Medium Risk - Address concerns before review</div>;
      default:
        return <div className="risk-banner high">🚨 High Risk - Blockers must be resolved</div>;
    }
  };

  return (
    <div className="simulator-overlay" onClick={onClose}>
      <div className="simulator-panel" onClick={e => e.stopPropagation()}>
        <div className="simulator-header">
          <h2><img src={simulateIcon} alt="" className="simulator-title-icon" /> Stakeholder Simulator</h2>
          <button className="simulator-close" onClick={onClose}>×</button>
        </div>

        <div className="simulator-content">
          {/* Setup Phase */}
          {!result && !isRunning && (
            <>
              <p className="simulator-description">
                Simulate how your stakeholders would review this PRD before the real meeting.
                The AI will role-play each stakeholder based on their role.
              </p>

              {stakeholders.length === 0 ? (
                <div className="simulator-empty">
                  <p>No stakeholders defined yet.</p>
                  <p>Add stakeholders in the Stakeholders panel first (👥 icon in sidebar).</p>
                </div>
              ) : (
                <>
                  <h3>Select Reviewers ({selectedStakeholders.length}/{stakeholders.length})</h3>
                  <div className="stakeholder-checkboxes">
                    {stakeholders.map(s => (
                      <label key={s.id} className="stakeholder-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedStakeholders.includes(s.id)}
                          onChange={() => toggleStakeholder(s.id)}
                        />
                        <span className="stakeholder-label">
                          <strong>{s.name}</strong>
                          <span className="stakeholder-role-label">{s.role}</span>
                        </span>
                      </label>
                    ))}
                  </div>

                  {error && <div className="simulator-error">{error}</div>}

                  <button
                    className="simulator-run-btn"
                    onClick={runSimulation}
                    disabled={selectedStakeholders.length === 0}
                  >
                    🚀 Run Simulation
                  </button>
                </>
              )}
            </>
          )}

          {/* Running Phase */}
          {isRunning && progress && (
            <div className="simulator-running">
              <div className="simulator-spinner" />
              <p className="simulator-progress-text">
                Reviewing as <strong>{progress.stakeholder}</strong>...
              </p>
              <p className="simulator-progress-count">
                {progress.current} of {progress.total} stakeholders
              </p>
              <div className="simulator-progress-bar">
                <div
                  className="simulator-progress-fill"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Results Phase */}
          {result && (
            <div className="simulator-results">
              {getRiskBadge(result.summary.riskLevel)}

              <div className="results-summary">
                <div className="summary-stat">
                  <span className="stat-value">{result.summary.totalBlockers}</span>
                  <span className="stat-label">Blockers</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-value">{result.summary.totalConcerns}</span>
                  <span className="stat-label">Concerns</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-value">{result.feedback.filter(f => f.verdict === 'approve').length}</span>
                  <span className="stat-label">Approvals</span>
                </div>
              </div>

              <div className="feedback-list">
                {result.feedback.map(fb => (
                  <div key={fb.stakeholderId} className={`feedback-card verdict-${fb.verdict}`}>
                    <div className="feedback-header">
                      <span className="feedback-name">
                        {fb.emoji} {fb.stakeholderName}
                      </span>
                      <span className="feedback-role">{fb.stakeholderRole}</span>
                      {getVerdictBadge(fb.verdict)}
                    </div>

                    {fb.blockers.length > 0 && (
                      <div className="feedback-section blockers">
                        <h4>🚨 Blockers</h4>
                        <ul>
                          {fb.blockers.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    )}

                    {fb.concerns.length > 0 && (
                      <div className="feedback-section concerns">
                        <h4>⚠️ Concerns</h4>
                        <ul>
                          {fb.concerns.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    )}

                    {fb.questions.length > 0 && (
                      <div className="feedback-section questions">
                        <h4>❓ Questions</h4>
                        <ul>
                          {fb.questions.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    )}

                    {fb.suggestions.length > 0 && (
                      <div className="feedback-section suggestions">
                        <h4>💡 Suggestions</h4>
                        <ul>
                          {fb.suggestions.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    )}

                    {fb.blockers.length === 0 && fb.concerns.length === 0 && 
                     fb.questions.length === 0 && fb.suggestions.length === 0 && (
                      <p className="feedback-empty">No issues raised ✨</p>
                    )}
                  </div>
                ))}
              </div>

              <button className="simulator-run-again-btn" onClick={() => setResult(null)}>
                ← Run Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StakeholderSimulator;
