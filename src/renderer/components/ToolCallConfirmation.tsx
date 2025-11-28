import React from 'react';
import './ToolCallConfirmation.css';
import alertIcon from '../assets/icons/alert.svg';

export interface ToolCall {
  id: string;
  name: string;
  description: string;
  parameters: any;
}

interface ToolCallConfirmationProps {
  toolCall: ToolCall;
  onAccept: () => void;
  onDeny: () => void;
}

const ToolCallConfirmation: React.FC<ToolCallConfirmationProps> = ({ 
  toolCall, 
  onAccept, 
  onDeny 
}) => {

  const formatParameters = (params: any) => {
    if (!params) return null;
    return Object.entries(params).map(([key, value]) => {
      // Truncate long content for display
      let displayValue = value;
      if (typeof value === 'string' && value.length > 200) {
        displayValue = value.substring(0, 200) + '... (' + value.length + ' chars)';
      }
      
      // Highlight missing required params for write_file
      const isMissing = value === undefined || value === null || value === '';
      
      return (
        <div key={key} className={`tool-param ${isMissing ? 'missing' : ''}`}>
          <span className="tool-param-key">{key}:</span>
          <span className="tool-param-value">
            {isMissing ? '⚠️ MISSING' : JSON.stringify(displayValue)}
          </span>
        </div>
      );
    });
  };

  return (
    <div className="tool-call-confirmation">
      <div className="tool-call-header">
        <img src={alertIcon} alt="" className="tool-call-icon" />
        <div className="tool-call-info">
          <div className="tool-call-title">Permission Required</div>
          <div className="tool-call-name">{toolCall.name}</div>
        </div>
      </div>

      <div className="tool-call-description">
        {toolCall.description}
      </div>

      {toolCall.parameters && Object.keys(toolCall.parameters).length > 0 && (
        <div className="tool-call-parameters">
          <div className="tool-params-label">Parameters:</div>
          {formatParameters(toolCall.parameters)}
        </div>
      )}

      <div className="tool-call-actions">
        <button 
          className="tool-call-btn deny"
          onClick={onDeny}
        >
          ✕ Deny
        </button>
        <button 
          className="tool-call-btn accept"
          onClick={onAccept}
        >
          ✓ Accept
        </button>
      </div>

      {/* Show specific warning for write_file with missing content */}
      {toolCall.name === 'write_file' && (!toolCall.parameters?.content) && (
        <div className="tool-call-error">
          ❌ ERROR: Missing 'content' parameter. The AI did not provide file content. Click Deny and ask the AI to provide the complete file content.
        </div>
      )}

      <div className="tool-call-warning">
        ⚠️ Review carefully before accepting
      </div>
    </div>
  );
};

export default ToolCallConfirmation;

