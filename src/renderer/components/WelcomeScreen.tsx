import React from 'react';
import './WelcomeScreen.css';

// Import icons
import welcomeIcon from '../assets/icons/weclome.svg';
import folderIcon from '../assets/icons/folder.svg';
import newFileIcon from '../assets/icons/newfile.svg';
import aiIcon from '../assets/icons/ai_avatar.svg';
import settingsIcon from '../assets/icons/settings.svg';

interface WelcomeScreenProps {
  onSelectWorkspace: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectWorkspace }) => {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-logo">
          <img src={welcomeIcon} alt="Collie" className="welcome-icon" />
        </div>
        
        <p className="welcome-tagline">
          Your AI-Powered Product Management IDE
        </p>

        <div className="welcome-features">
          <div className="welcome-feature">
            <img src={newFileIcon} alt="" className="feature-icon" /> Create PRDs & Technical Specs
          </div>
          <div className="welcome-feature">
            <img src={aiIcon} alt="" className="feature-icon" /> AI Assistant powered by Claude
          </div>
          <div className="welcome-feature">
            <img src={settingsIcon} alt="" className="feature-icon" /> Fast editing with Monaco Editor
          </div>
        </div>

        <button className="welcome-btn" onClick={onSelectWorkspace}>
          <img src={folderIcon} alt="" className="btn-icon" />
          Select Workspace Folder
        </button>

        <p className="welcome-hint">
          Choose a folder where your product documents will be saved
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;

