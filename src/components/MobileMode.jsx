import { useState, useEffect } from 'react';
import CodeEntry from './CodeEntry';
import RemoteControl from './RemoteControl';
import { joinPairing, subscribeToEvents } from '../api';

export default function MobileMode() {
  const [screen, setScreen] = useState('connect'); // connect, entering, paired
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pairingId, setPairingId] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Check localStorage for saved pairing
  useEffect(() => {
    const saved = localStorage.getItem('flapstr_mobile_pairing');
    if (saved) {
      try {
        const { pairingId: savedId, deviceId: savedDeviceId } = JSON.parse(saved);
        setPairingId(savedId);
        setDeviceId(savedDeviceId);
        setScreen('paired');
      } catch { /* ignore */ }
    }
  }, []);

  async function handleCodeSubmit(code) {
    setError(null);
    setLoading(true);
    try {
      const data = await joinPairing(code);
      setPairingId(data.pairingId);
      setDeviceId(data.deviceId);

      // Save to localStorage for auto-reconnect
      localStorage.setItem('flapstr_mobile_pairing', JSON.stringify({
        pairingId: data.pairingId,
        deviceId: data.deviceId,
      }));

      // Show success animation
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setScreen('paired');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleDisconnect() {
    setPairingId(null);
    setDeviceId(null);
    setScreen('connect');
  }

  return (
    <div className="mobile-mode">
      {/* Success animation overlay */}
      {showSuccess && (
        <div className="success-overlay">
          <p className="success-text">Connected.</p>
        </div>
      )}

      {/* Connect screen */}
      {screen === 'connect' && !showSuccess && (
        <div className="mobile-connect">
          <div className="mobile-logo">Flapstr.</div>
          <div className="mobile-hero">
            <h1>Remote Control</h1>
            <p>Control your split-flap display from your phone</p>
          </div>
          <button className="mobile-connect-btn" onClick={() => setScreen('entering')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            Connect to TV
          </button>
          <p className="mobile-hint">Open Flapstr on your TV to get a pairing code</p>
        </div>
      )}

      {/* Code entry screen */}
      {screen === 'entering' && !showSuccess && (
        <div className="mobile-entering">
          <button className="mobile-back-btn" onClick={() => setScreen('connect')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <CodeEntry onSubmit={handleCodeSubmit} error={error} loading={loading} />
        </div>
      )}

      {/* Remote control screen */}
      {screen === 'paired' && !showSuccess && pairingId && (
        <RemoteControl
          pairingId={pairingId}
          deviceId={deviceId}
          onDisconnect={handleDisconnect}
        />
      )}
    </div>
  );
}
