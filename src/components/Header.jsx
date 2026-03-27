import React from 'react';

export default function Header({ muted, onVolumeClick, onEnterTV }) {
  return (
    <header className="header">
      <div className="header-logo">Flapstr.</div>
      <div className="header-actions">
        {onEnterTV && (
          <button className="header-btn tv-mode-toggle" onClick={onEnterTV} title="Pair with mobile">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
              <line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
            <span>Pair Device</span>
          </button>
        )}
        <button
          className={`header-btn volume-icon${muted ? ' muted' : ''}`}
          title="Toggle sound"
          onClick={onVolumeClick}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        </button>
      </div>
    </header>
  );
}
