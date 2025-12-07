import React, { useState, useEffect } from 'react';
import './SettingsPanel.css';
import { AppSettings, DEFAULT_SETTINGS, BEDROCK_MODELS, OPENAI_MODELS, AIProvider } from '../../shared/settings';

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
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    // Load settings from file via IPC
    const loadSettings = async () => {
      try {
        const savedSettings = await ipcRenderer.invoke('settings:load');
        if (savedSettings) {
          // Migrate old settings if needed
          const migratedSettings = {
            ...DEFAULT_SETTINGS,
            ...savedSettings,
            aiProvider: savedSettings.aiProvider || 'bedrock',
          };
          setSettings(migratedSettings);
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

  const handleTestBedrock = async () => {
    if (!settings.awsAccessKeyId || !settings.awsSecretAccessKey) {
      alert('Please enter your AWS credentials first.');
      return;
    }

    setTestingConnection(true);
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
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestOpenAI = async () => {
    if (!settings.openaiApiKey) {
      alert('Please enter your OpenAI API key first.');
      return;
    }

    setTestingConnection(true);
    try {
      const baseUrl = settings.openaiBaseUrl || 'https://api.openai.com/v1';
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: settings.openaiModel,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10,
        }),
      });

      if (response.ok) {
        alert('✅ Connection successful! Your OpenAI API key is working.');
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }
    } catch (error: any) {
      console.error('OpenAI connection test error:', error);
      let errorMessage = '❌ Connection failed!\n\n';
      
      if (error.message?.includes('401')) {
        errorMessage += 'Invalid API key. Please check your OpenAI API key.';
      } else if (error.message?.includes('429')) {
        errorMessage += 'Rate limited. Please try again later.';
      } else if (error.message?.includes('model')) {
        errorMessage += 'Model not available. Please check your model selection.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      alert(errorMessage);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTest = () => {
    if (settings.aiProvider === 'openai') {
      handleTestOpenAI();
    } else {
      handleTestBedrock();
    }
  };

  const handleProviderChange = (provider: AIProvider) => {
    setSettings({ ...settings, aiProvider: provider });
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
            <h3>AI Assistant</h3>
            
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
              <label>AI Provider</label>
              <div className="provider-tabs">
                <button
                  className={`provider-tab ${settings.aiProvider === 'bedrock' ? 'active' : ''}`}
                  onClick={() => handleProviderChange('bedrock')}
                  disabled={!settings.aiEnabled}
                >
                  AWS Bedrock
                </button>
                <button
                  className={`provider-tab ${settings.aiProvider === 'openai' ? 'active' : ''}`}
                  onClick={() => handleProviderChange('openai')}
                  disabled={!settings.aiEnabled}
                >
                  OpenAI
                </button>
              </div>
            </div>

            {/* Bedrock Settings */}
            {settings.aiProvider === 'bedrock' && (
              <>
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
                    {BEDROCK_MODELS.map((model) => (
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
              </>
            )}

            {/* OpenAI Settings */}
            {settings.aiProvider === 'openai' && (
              <>
                <div className="settings-field">
                  <label>OpenAI Model</label>
                  <select
                    value={settings.openaiModel}
                    onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
                    disabled={!settings.aiEnabled}
                  >
                    {OPENAI_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="settings-field">
                  <label>OpenAI API Key</label>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={settings.openaiApiKey}
                    onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                    placeholder="sk-..."
                    disabled={!settings.aiEnabled}
                  />
                </div>

                <div className="settings-field">
                  <label>Custom Base URL (optional)</label>
                  <input
                    type="text"
                    value={settings.openaiBaseUrl || ''}
                    onChange={(e) => setSettings({ ...settings, openaiBaseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    disabled={!settings.aiEnabled}
                  />
                  <span className="settings-hint">For OpenAI-compatible APIs (Azure, local LLMs, etc.)</span>
                </div>
              </>
            )}

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
          <button 
            className="settings-btn secondary" 
            onClick={handleTest} 
            disabled={!settings.aiEnabled || isSaving || testingConnection}
          >
            {testingConnection ? 'Testing...' : 'Test Connection'}
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
