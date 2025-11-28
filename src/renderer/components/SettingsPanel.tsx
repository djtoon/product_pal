import React, { useState, useEffect } from 'react';
import './SettingsPanel.css';
import { AppSettings, DEFAULT_SETTINGS, AVAILABLE_MODELS } from '../../shared/settings';

const { ipcRenderer } = window.require('electron');

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showSecrets, setShowSecrets] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load settings from file via IPC
    const loadSettings = async () => {
      try {
        const savedSettings = await ipcRenderer.invoke('settings:load');
        if (savedSettings) {
          setSettings(savedSettings);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to file via IPC
      await ipcRenderer.invoke('settings:save', settings);
      // Also keep in localStorage for quick access
      localStorage.setItem('appSettings', JSON.stringify(settings));
      onSave(settings);
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!settings.awsAccessKeyId || !settings.awsSecretAccessKey) {
      alert('Please enter your AWS credentials first.');
      return;
    }

    try {
      // Test AWS Bedrock connection
      const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
      
      const client = new BedrockRuntimeClient({
        region: settings.awsRegion,
        credentials: {
          accessKeyId: settings.awsAccessKeyId,
          secretAccessKey: settings.awsSecretAccessKey
        }
      });

      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hi'
          }
        ]
      };

      const command = new InvokeModelCommand({
        modelId: settings.bedrockModel,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload)
      });

      await client.send(command);
      alert('✅ Connection successful! Your AWS Bedrock credentials are working.');
    } catch (error: any) {
      console.error('Connection test error:', error);
      let errorMessage = '❌ Connection failed!\n\n';
      
      if (error.name === 'AccessDeniedException') {
        errorMessage += 'Access denied. Please check:\n• Your AWS credentials are correct\n• Your IAM user has Bedrock permissions\n• The model is available in your region';
      } else if (error.name === 'ResourceNotFoundException') {
        errorMessage += 'Model not found. The selected model may not be available in your region.';
      } else if (error.message?.includes('credentials')) {
        errorMessage += 'Invalid credentials. Please check your Access Key ID and Secret Access Key.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      alert(errorMessage);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <h3>Profile</h3>
            
            <div className="settings-field">
              <label>Profile Name</label>
              <input
                type="text"
                value={settings.profileName}
                onChange={(e) => setSettings({ ...settings, profileName: e.target.value })}
                placeholder="My Profile"
              />
            </div>
          </div>

          <div className="settings-section">
            <h3>AI Assistant (AWS Bedrock)</h3>
            
            <div className="settings-field">
              <label>
                <input
                  type="checkbox"
                  checked={settings.aiEnabled}
                  onChange={(e) => setSettings({ ...settings, aiEnabled: e.target.checked })}
                />
                Enable AI Assistant
              </label>
            </div>

            <div className="settings-field">
              <label>AWS Region</label>
              <select
                value={settings.awsRegion}
                onChange={(e) => setSettings({ ...settings, awsRegion: e.target.value })}
                disabled={!settings.aiEnabled}
              >
                <option value="us-east-1">us-east-1</option>
                <option value="us-west-2">us-west-2</option>
                <option value="eu-west-1">eu-west-1</option>
                <option value="eu-central-1">eu-central-1</option>
                <option value="ap-southeast-1">ap-southeast-1</option>
                <option value="ap-northeast-1">ap-northeast-1</option>
              </select>
            </div>

            <div className="settings-field">
              <label>Claude Model</label>
              <select
                value={settings.bedrockModel}
                onChange={(e) => setSettings({ ...settings, bedrockModel: e.target.value })}
                disabled={!settings.aiEnabled}
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-field">
              <label>AWS Access Key ID</label>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={settings.awsAccessKeyId}
                onChange={(e) => setSettings({ ...settings, awsAccessKeyId: e.target.value })}
                placeholder="AKIA..."
                disabled={!settings.aiEnabled}
              />
            </div>

            <div className="settings-field">
              <label>AWS Secret Access Key</label>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={settings.awsSecretAccessKey}
                onChange={(e) => setSettings({ ...settings, awsSecretAccessKey: e.target.value })}
                placeholder="Enter your secret key"
                disabled={!settings.aiEnabled}
              />
            </div>

            <div className="settings-field">
              <label>
                <input
                  type="checkbox"
                  checked={showSecrets}
                  onChange={(e) => setShowSecrets(e.target.checked)}
                />
                Show credentials
              </label>
            </div>
          </div>

          <div className="settings-note">
            <strong>Note:</strong> Credentials are stored locally on your machine. 
            Never share them with anyone.
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-btn secondary" onClick={handleTest} disabled={!settings.aiEnabled || isSaving}>
            Test Connection
          </button>
          <button className="settings-btn secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="settings-btn primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;

