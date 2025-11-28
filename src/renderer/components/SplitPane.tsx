import React, { useState, useRef, useEffect } from 'react';
import './SplitPane.css';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultSplitPercentage?: number;
}

const SplitPane: React.FC<SplitPaneProps> = ({ left, right, defaultSplitPercentage = 50 }) => {
  const [splitPercentage, setSplitPercentage] = useState(defaultSplitPercentage);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const percentage = (offsetX / rect.width) * 100;

      // Limit between 20% and 80%
      if (percentage >= 20 && percentage <= 80) {
        setSplitPercentage(percentage);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div ref={containerRef} className="split-pane-container">
      <div className="split-pane-left" style={{ width: `${splitPercentage}%` }}>
        {left}
      </div>
      <div
        className={`split-pane-divider ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div className="split-pane-divider-handle"></div>
      </div>
      <div className="split-pane-right" style={{ width: `${100 - splitPercentage}%` }}>
        {right}
      </div>
    </div>
  );
};

export default SplitPane;

