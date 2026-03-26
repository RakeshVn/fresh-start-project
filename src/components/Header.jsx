import React from 'react';

export default function Header({ muted, onVolumeClick }) {
  return (
    <header className="header">
      <div className="header-logo">Flapstr.</div>
      <button
        className={`volume-icon${muted ? ' muted' : ''}`}
        title="Toggle sound"
        onClick={onVolumeClick}
      >
        <svg
          width="20"
          height="20"
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
    </header>
  );
}
