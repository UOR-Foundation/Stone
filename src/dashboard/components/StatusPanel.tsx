import React from 'react';

interface StatusPanelProps {
  title: string;
  current: number;
  max: number;
  unit: string;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ title, current, max, unit }) => {
  const percentage = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  
  let color = 'var(--success-color)';
  if (percentage > 80) {
    color = 'var(--error-color)';
  } else if (percentage > 60) {
    color = 'var(--warning-color)';
  }
  
  return (
    <div className="status-panel">
      <div className="status-panel-title">{title}</div>
      <div className="status-panel-value" style={{ color }}>
        {current.toLocaleString()} / {max.toLocaleString()}
      </div>
      <div className="status-panel-subtitle">
        {unit} ({percentage.toFixed(1)}%)
      </div>
      <div className="progress-bar">
        <div 
          className="progress-bar-fill" 
          style={{ 
            width: `${percentage}%`,
            backgroundColor: color
          }}
        />
      </div>
    </div>
  );
};
