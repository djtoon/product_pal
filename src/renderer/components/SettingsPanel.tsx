import React, { useState, useEffect } from 'react';
import './SettingsPanel.css';
import { AppSettings, DEFAULT_SETTINGS, BEDROCK_MODELS, OPENAI_MODELS, OLLAMA_MODELS, AIProvider } from '../../shared/settings';

const { ipcRenderer } = window.require('electron');

interface OllamaModel {
  id: string;
  name: string;
  size?: number | string; // Size in bytes (from API) or string (from config)
}

// Format bytes to human readable size
const formatSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
};

// Get display name with size for a model
const getModelDisplayName = (model: OllamaModel | { id: string; name: string; size?: string }): string => {
  let displayName = model.name;
  if (model.size) {
    // If size is a number (bytes from API), format it
    if (typeof model.size === 'number') {
      displayName += ` [${formatSize(model.size)}]`;
    } else {
      // If size is already a string (from config), append it
      displayName += ` [${model.size}]`;
    }
  }
  return displayName;
};

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
  const [detectedOllamaModels, setDetectedOllamaModels] = useState<OllamaModel[]>([]);
  const [detectingModels, setDetectingModels] = useState(false);
  const [pullingModel, setPullingModel] = useState(false);
  const [pullProgress, setPullProgress] = useState<string>('');
  const [deletingModel, setDeletingModel] = useState(false);

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
          
          // Auto-detect Ollama models if provider is ollama
          if (migratedSettings.aiProvider === 'ollama') {
            const result = await ipcRenderer.invoke('ollama:list-models', migratedSettings.ollamaBaseUrl);
            if (result.success && result.models.length > 0) {
              setDetectedOllamaModels(result.models);
              // Auto-select first model if current selection not installed
              const currentModelExists = result.models.some((m: OllamaModel) => m.id === migratedSettings.ollamaModel);
              if (!currentModelExists) {
                setSettings(prev => ({ ...prev, ollamaModel: result.models[0].id }));
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // Listen for Ollama pull progress events
  useEffect(() => {
    const handlePullProgress = (_event: any, data: { model: string; progress: string }) => {
      setPullProgress(data.progress);
    };

    ipcRenderer.on('ollama:pull-progress', handlePullProgress);
    return () => {
      ipcRenderer.removeListener('ollama:pull-progress', handlePullProgress);
    };
  }, []);

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
      alert('Connection successful! Your AWS Bedrock credentials are working.');
      // Restore focus after alert (Electron focus issue workaround)
      setTimeout(() => window.focus(), 100);
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
      // Restore focus after alert (Electron focus issue workaround)
      setTimeout(() => window.focus(), 100);
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
        alert('Connection successful! Your OpenAI API key is working.');
        setTimeout(() => window.focus(), 100);
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
      setTimeout(() => window.focus(), 100);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestOllama = async () => {
    setTestingConnection(true);
    try {
      const result = await ipcRenderer.invoke('ollama:check-connection', settings.ollamaBaseUrl);
      
      if (result.success) {
        alert(`Connection successful! Ollama version: ${result.version}`);
        setTimeout(() => window.focus(), 100);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Ollama connection test error:', error);
      let errorMessage = '❌ Connection failed!\n\n';
      
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch')) {
        errorMessage += 'Cannot connect to Ollama. Make sure:\n• Ollama is installed and running\n• The base URL is correct (default: http://localhost:11434)';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      alert(errorMessage);
      setTimeout(() => window.focus(), 100);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDetectOllamaModels = async () => {
    setDetectingModels(true);
    try {
      const result = await ipcRenderer.invoke('ollama:list-models', settings.ollamaBaseUrl);
      
      if (result.success && result.models.length > 0) {
        setDetectedOllamaModels(result.models);
        // Auto-select first model if current selection not in list
        const currentModelExists = result.models.some((m: OllamaModel) => m.id === settings.ollamaModel);
        if (!currentModelExists) {
          setSettings({ ...settings, ollamaModel: result.models[0].id });
        }
        alert(`Found ${result.models.length} model(s): ${result.models.map((m: OllamaModel) => m.name).join(', ')}`);
      } else if (result.success) {
        alert('No models found. Please pull a model first using:\n\nollama pull qwen2.5:3b');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error detecting Ollama models:', error);
      alert(`Failed to detect models: ${error.message}`);
    } finally {
      setDetectingModels(false);
      setTimeout(() => window.focus(), 100);
    }
  };

  const handleOllamaInstall = async () => {
    // First check if Ollama is already running
    const connectionResult = await ipcRenderer.invoke('ollama:check-connection', settings.ollamaBaseUrl);
    
    if (connectionResult.success) {
      // Ollama is already installed and running, just pull the model
      await handlePullModel();
    } else {
      // Ollama not running - open download page
      const confirmInstall = window.confirm(
        'Ollama is not detected. This will open the Ollama download page.\n\n' +
        'After installing Ollama:\n' +
        '1. Launch Ollama (it runs in the background)\n' +
        '2. Come back here and click "Install Model" again\n\n' +
        'Open download page?'
      );
      
      if (confirmInstall) {
        await ipcRenderer.invoke('ollama:open-download');
      }
    }
  };

  const handlePullModel = async () => {
    setPullingModel(true);
    setPullProgress('Starting download...');
    
    try {
      const result = await ipcRenderer.invoke('ollama:pull-model', settings.ollamaModel, settings.ollamaBaseUrl);

      if (result.success) {
        setPullProgress('Download complete!');
        alert(`Successfully installed ${settings.ollamaModel}!\n\nYou can now use the AI assistant.`);
        // Refresh detected models
        await handleDetectOllamaModels();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error pulling model:', error);
      setPullProgress('');
      
      if (error.message?.includes('not recognized') || error.message?.includes('not found')) {
        alert(
          'Ollama command not found.\n\n' +
          'Please make sure Ollama is installed and running.\n' +
          'Download from: https://ollama.ai'
        );
      } else {
        alert(`Failed to pull model: ${error.message}`);
      }
    } finally {
      setPullingModel(false);
      setTimeout(() => {
        setPullProgress('');
        window.focus();
      }, 2000);
    }
  };

  const handleDeleteModel = async () => {
    // Only allow deleting detected (installed) models
    const isInstalled = detectedOllamaModels.some(m => m.id === settings.ollamaModel);
    if (!isInstalled) {
      alert('This model is not installed locally.');
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to uninstall "${settings.ollamaModel}"?\n\n` +
      'This will free up disk space but you will need to download it again to use it.'
    );

    if (!confirmDelete) return;

    setDeletingModel(true);
    try {
      const result = await ipcRenderer.invoke('ollama:delete-model', settings.ollamaModel, settings.ollamaBaseUrl);

      if (result.success) {
        alert(`Successfully uninstalled ${settings.ollamaModel}`);
        // Refresh detected models
        await handleDetectOllamaModels();
        // Select next available model if current one was deleted
        if (detectedOllamaModels.length > 1) {
          const remaining = detectedOllamaModels.filter(m => m.id !== settings.ollamaModel);
          if (remaining.length > 0) {
            setSettings(prev => ({ ...prev, ollamaModel: remaining[0].id }));
          }
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error deleting model:', error);
      alert(`Failed to uninstall model: ${error.message}`);
    } finally {
      setDeletingModel(false);
    }
  };

  const handleTest = () => {
    if (settings.aiProvider === 'openai') {
      handleTestOpenAI();
    } else if (settings.aiProvider === 'ollama') {
      handleTestOllama();
    } else {
      handleTestBedrock();
    }
  };

  const handleProviderChange = async (provider: AIProvider) => {
    setSettings({ ...settings, aiProvider: provider });
    
    // Auto-detect models when switching to Ollama
    if (provider === 'ollama') {
      try {
        const result = await ipcRenderer.invoke('ollama:list-models', settings.ollamaBaseUrl);
        if (result.success && result.models.length > 0) {
          setDetectedOllamaModels(result.models);
          // Auto-select first model if current selection not installed
          const currentModelExists = result.models.some((m: OllamaModel) => m.id === settings.ollamaModel);
          if (!currentModelExists) {
            setSettings(prev => ({ ...prev, aiProvider: provider, ollamaModel: result.models[0].id }));
          }
        }
      } catch (error) {
        console.error('Error detecting Ollama models:', error);
      }
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
                <button
                  className={`provider-tab ${settings.aiProvider === 'ollama' ? 'active' : ''}`}
                  onClick={() => handleProviderChange('ollama')}
                  disabled={!settings.aiEnabled}
                >
                  Ollama (Local)
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

            {/* Ollama Settings (Local LLM) */}
            {settings.aiProvider === 'ollama' && (
              <>
                <div className="settings-field">
                  <label>Ollama Base URL</label>
                  <input
                    type="text"
                    value={settings.ollamaBaseUrl || 'http://localhost:11434'}
                    onChange={(e) => setSettings({ ...settings, ollamaBaseUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    disabled={!settings.aiEnabled}
                  />
                  <span className="settings-hint">Default: http://localhost:11434</span>
                </div>

                <div className="settings-field">
                  <label>Model</label>
                  <div className="model-selector-row">
                    <select
                      value={settings.ollamaModel}
                      onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
                      disabled={!settings.aiEnabled}
                    >
                      {/* Show detected models first if available */}
                      {detectedOllamaModels.length > 0 ? (
                        <>
                          <optgroup label="✓ Installed Models">
                            {detectedOllamaModels.map((model) => (
                              <option key={model.id} value={model.id}>
                                {getModelDisplayName(model)}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="📥 Available to Download">
                            {OLLAMA_MODELS.filter(m => !detectedOllamaModels.some(d => d.id === m.id)).map((model) => (
                              <option key={model.id} value={model.id}>
                                {getModelDisplayName(model)}
                              </option>
                            ))}
                          </optgroup>
                        </>
                      ) : (
                        OLLAMA_MODELS.map((model) => (
                          <option key={model.id} value={model.id}>
                            {getModelDisplayName(model)}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      className="settings-btn secondary detect-btn"
                      onClick={handleDetectOllamaModels}
                      disabled={!settings.aiEnabled || detectingModels}
                    >
                      {detectingModels ? 'Detecting...' : 'Detect Models'}
                    </button>
                  </div>
                  <span className="settings-hint">
                    Select a model and click "Install Model" to download. Only tool-capable models are shown.
                  </span>
                </div>

                {/* One-click install section */}
                <div className="ollama-install-section">
                  <div className="ollama-buttons-row">
                    <button
                      className="settings-btn install-btn"
                      onClick={handleOllamaInstall}
                      disabled={!settings.aiEnabled || pullingModel || deletingModel}
                    >
                      {pullingModel ? 'Installing...' : 'Install Model'}
                    </button>
                    <button
                      className="settings-btn danger delete-model-btn"
                      onClick={handleDeleteModel}
                      disabled={!settings.aiEnabled || pullingModel || deletingModel || !detectedOllamaModels.some(m => m.id === settings.ollamaModel)}
                      title={detectedOllamaModels.some(m => m.id === settings.ollamaModel) ? 'Uninstall this model' : 'Model not installed'}
                    >
                      {deletingModel ? 'Removing...' : 'Uninstall Model'}
                    </button>
                  </div>
                  
                  {pullProgress && (
                    <div className="pull-progress">
                      <div className="pull-progress-text">{pullProgress}</div>
                    </div>
                  )}
                  
                  <span className="settings-hint">
                    Install downloads the selected model. Uninstall removes it to free disk space.
                  </span>
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
