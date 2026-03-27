import { useEffect, useState } from 'react';

// Renders the 6-digit pairing code as split-flap style tiles
export default function PairingCode({ code, secondsLeft }) {
  const digits = (code || '------').split('');

  return (
    <div className="pairing-code-wrap">
      <div className="pairing-code-label">PAIR CODE</div>
      <div className="pairing-code-tiles">
        {digits.map((d, i) => (
          <div key={i} className="pairing-tile">
            <span>{d}</span>
          </div>
        ))}
      </div>
      {secondsLeft != null && (
        <div className="pairing-timer">
          <div className="pairing-timer-bar">
            <div
              className="pairing-timer-fill"
              style={{ width: `${(secondsLeft / 300) * 100}%` }}
            />
          </div>
          <span className="pairing-timer-text">
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </span>
        </div>
      )}
    </div>
  );
}
