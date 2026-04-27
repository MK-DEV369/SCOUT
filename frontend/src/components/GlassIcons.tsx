import React from 'react';
import './GlassIcons.css';

export interface GlassIconsItem {
  icon: React.ReactElement;
  color: string;
  label: string;
  onClick?: () => void;
  active?: boolean;
  customClass?: string;
}

export interface GlassIconsProps {
  items: GlassIconsItem[];
  className?: string;
  colorful?: boolean;
}

const gradientMapping: Record<string, string> = {
  blue: 'linear-gradient(hsl(223, 90%, 50%), hsl(208, 90%, 50%))',
  purple: 'linear-gradient(hsl(283, 90%, 50%), hsl(268, 90%, 50%))',
  red: 'linear-gradient(hsl(3, 90%, 50%), hsl(348, 90%, 50%))',
  indigo: 'linear-gradient(hsl(253, 90%, 50%), hsl(238, 90%, 50%))',
  orange: 'linear-gradient(hsl(43, 90%, 50%), hsl(28, 90%, 50%))',
  green: 'linear-gradient(hsl(123, 90%, 40%), hsl(108, 90%, 40%))'
};

const GlassIcons: React.FC<GlassIconsProps> = ({ items, className, colorful = true }) => {
  const getBackgroundStyle = (color: string): React.CSSProperties => {
    if (!colorful) {
      return { background: 'linear-gradient(hsl(216, 20%, 32%), hsl(216, 20%, 24%))' };
    }

    if (gradientMapping[color]) {
      return { background: gradientMapping[color] };
    }
    return { background: color };
  };

  return (
    <div className={`icon-btns ${className || ''}`}>
      {items.map((item, index) => (
        <button
          key={index}
          type="button"
          className={`icon-btn ${item.active ? 'icon-btn--active' : ''} ${item.customClass || ''}`.trim()}
          aria-label={item.label}
          aria-current={item.active ? 'page' : undefined}
          onClick={item.onClick}
        >
          <span className="icon-btn__back" style={getBackgroundStyle(item.color)}></span>
          <span className="icon-btn__front">
            <span className="icon-btn__icon" aria-hidden="true">
              {item.icon}
            </span>
          </span>
          <span className="icon-btn__label">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default GlassIcons;
