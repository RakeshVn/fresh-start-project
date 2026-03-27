import { useState, useRef, useEffect, useCallback } from 'react';
import { sendCommand, disconnect, getPairingStatus, subscribeToEvents } from '../api';
import { CHARSET, splitGraphemes, isEmojiChar } from '../constants';
import MessageComposer, { draftTextToLines } from './MessageComposer';

const VALID_CHARS = new Set(CHARSET);
const filterLine = (s) => {
  const graphemes = splitGraphemes(s.toUpperCase());
  return graphemes.filter(g => VALID_CHARS.has(g) || isEmojiChar(g)).slice(0, 22).join('');
};

const QUICK_MESSAGES = {
  quotes: [
    ['', '', 'STAY HUNGRY', 'STAY FOOLISH', '- STEVE JOBS', ''],
    ['', '', 'THINK DIFFERENT', '', '- APPLE', ''],
    ['', '', 'MAKE IT SIMPLE', 'BUT SIGNIFICANT', '- DON DRAPER', ''],
  ],
  greetings: [
    ['', '', '', 'GOOD MORNING', '', ''],
    ['', '', '', 'GOOD AFTERNOON', '', ''],
    ['', '', '', 'GOOD EVENING', '', ''],
    ['', '', 'WELCOME HOME', '', '', ''],
    ['', '', '', 'HELLO WORLD', '', ''],
  ],
};

const ACCENT_PRESETS = [
  { name: 'Purple', value: '#C850C0' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'White', value: '#FFFFFF' },
];

const TEXT_COLORS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Yellow', value: '#FFCC00' },
  { name: 'Green', value: '#00FF88' },
  { name: 'Cyan', value: '#00FFCC' },
  { name: 'Orange', value: '#FF9500' },
];

export default function RemoteControl({ pairingId, deviceId, onDisconnect }) {
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(true);
  const [tvOnline, setTvOnline] = useState(true);
  const [activeMode, setActiveMode] = useState(null);
  const [savedMessages, setSavedMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('flapstr_saved_msgs') || '[]');
    } catch { return []; }
  });
  const [showSaved, setShowSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('message'); // message, quick, settings

  // Settings
  const [flipSpeed, setFlipSpeed] = useState('medium');
  const [soundOn, setSoundOn] = useState(true);
  const [accentColor, setAccentColor] = useState('#C850C0');
  const [textColor, setTextColor] = useState('#FFFFFF');

  const statusInterval = useRef(null);

  // Listen for TV disconnect via SSE
  useEffect(() => {
    const es = subscribeToEvents(pairingId, (data) => {
      if (data.type === 'tv_disconnected') {
        localStorage.removeItem('flapstr_mobile_pairing');
        onDisconnect();
      }
    });
    return () => es.close();
  }, [pairingId, onDisconnect]);

  // Periodic status check
  useEffect(() => {
    statusInterval.current = setInterval(async () => {
      try {
        const status = await getPairingStatus(pairingId);
        setTvOnline(status.active);
      } catch {
        setTvOnline(false);
      }
    }, 10000);
    return () => clearInterval(statusInterval.current);
  }, [pairingId]);

  const send = useCallback(async (type, payload) => {
    try {
      await sendCommand(pairingId, deviceId, type, payload);
    } catch (err) {
      console.error('Send failed:', err);
    }
  }, [pairingId, deviceId]);

  function sendMessage() {
    if (!message.trim()) return;
    const lines = draftTextToLines(message, filterLine);
    send('message', { lines });
    setMessage('');
    stopMode();
  }

  function sendQuickMessage(lines) {
    send('message', { lines });
    stopMode();
  }

  function startMode(mode) {
    setActiveMode(mode);
    send(`${mode}_mode`, {});
  }

  function stopMode() {
    if (activeMode) {
      send('stop_mode', {});
      setActiveMode(null);
    }
  }

  function saveCurrentMessage() {
    if (!message.trim()) return;
    const lines = draftTextToLines(message, filterLine);
    const next = [...savedMessages, { lines, label: lines.find(l => l.trim()) || 'Message' }];
    setSavedMessages(next);
    localStorage.setItem('flapstr_saved_msgs', JSON.stringify(next));
  }

  function deleteSaved(index) {
    const next = savedMessages.filter((_, i) => i !== index);
    setSavedMessages(next);
    localStorage.setItem('flapstr_saved_msgs', JSON.stringify(next));
  }

  function updateSetting(key, value) {
    const payload = { [key]: value };
    send('settings', payload);
  }

  async function handleDisconnect() {
    try {
      await disconnect(pairingId, deviceId);
    } catch { /* ignore */ }
    localStorage.removeItem('flapstr_mobile_pairing');
    onDisconnect();
  }

  async function fetchWeather() {
    startMode('weather');
    try {
      // Use wttr.in for no-API-key weather
      const res = await fetch('https://wttr.in/?format=%C+%t');
      const text = await res.text();
      const parts = text.trim().split('+');
      const condition = (parts[0] || 'WEATHER').toUpperCase().slice(0, 22);
      const temp = (parts[1] || '').toUpperCase().slice(0, 22);
      const lines = ['', '', condition, temp, '', ''];
      send('weather_mode', { lines });
    } catch {
      const lines = ['', '', 'WEATHER', 'UNAVAILABLE', '', ''];
      send('weather_mode', { lines });
    }
  }

  return (
    <div className="remote-control">
      {/* Connection status bar */}
      <div className={`rc-status-bar ${tvOnline ? 'online' : 'offline'}`}>
        <div className="rc-status-left">
          <span className={`rc-status-dot ${tvOnline ? 'online' : 'offline'}`} />
          <span>{tvOnline ? 'Connected to TV' : 'TV Offline'}</span>
        </div>
        <button className="rc-disconnect-btn" onClick={handleDisconnect}>
          Disconnect
        </button>
      </div>

      {!tvOnline && (
        <div className="rc-offline-banner">
          <p>Your TV appears to be offline.</p>
          <button className="rc-retry-btn" onClick={() => getPairingStatus(pairingId).then(s => setTvOnline(s.active)).catch(() => {})}>
            Retry Connection
          </button>
        </div>
      )}

      {/* Section tabs */}
      <div className="rc-tabs">
        <button
          className={`rc-tab ${activeSection === 'message' ? 'active' : ''}`}
          onClick={() => setActiveSection('message')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Message
        </button>
        <button
          className={`rc-tab ${activeSection === 'quick' ? 'active' : ''}`}
          onClick={() => setActiveSection('quick')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Quick
        </button>
        <button
          className={`rc-tab ${activeSection === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveSection('settings')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </button>
      </div>

      <div className="rc-content">
        {/* Custom Message Section */}
        {activeSection === 'message' && (
          <div className="rc-section">
            <div className="rc-card">
              <MessageComposer
                variant="remote"
                title="Custom Message"
                value={message}
                onChange={setMessage}
                filterLine={filterLine}
                footer={
                  <div className="rc-send-row">
                    <button type="button" className="rc-save-btn" onClick={saveCurrentMessage} title="Save message">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                    </button>
                    <button type="button" className="rc-send-btn rc-send-btn-sm" onClick={sendMessage} disabled={!message.trim()}>
                      Send
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>
                }
              />
            </div>

            {/* Saved messages */}
            {savedMessages.length > 0 && (
              <div className="rc-card">
                <div className="rc-card-header" onClick={() => setShowSaved(!showSaved)}>
                  <h3>Saved Messages</h3>
                  <span className="rc-badge">{savedMessages.length}</span>
                </div>
                {showSaved && (
                  <div className="rc-saved-list">
                    {savedMessages.map((msg, i) => (
                      <div key={i} className="rc-saved-item">
                        <button className="rc-saved-send" onClick={() => sendQuickMessage(msg.lines)}>
                          {msg.label}
                        </button>
                        <button className="rc-saved-delete" onClick={() => deleteSaved(i)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick Messages Section */}
        {activeSection === 'quick' && (
          <div className="rc-section">
            {/* Mode buttons */}
            <div className="rc-card">
              <h3 className="rc-card-title">Modes</h3>
              <div className="rc-mode-grid">
                <button
                  className={`rc-mode-btn ${activeMode === 'quotes' ? 'active' : ''}`}
                  onClick={() => activeMode === 'quotes' ? stopMode() : startMode('quotes')}
                >
                  <span className="rc-mode-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/>
                      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
                    </svg>
                  </span>
                  <span>Quotes</span>
                  <span className="rc-mode-desc">Auto-rotate every 30s</span>
                </button>

                <button
                  className={`rc-mode-btn ${activeMode === 'clock' ? 'active' : ''}`}
                  onClick={() => activeMode === 'clock' ? stopMode() : startMode('clock')}
                >
                  <span className="rc-mode-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </span>
                  <span>Clock</span>
                  <span className="rc-mode-desc">Updates every minute</span>
                </button>

                <button
                  className={`rc-mode-btn ${activeMode === 'weather' ? 'active' : ''}`}
                  onClick={() => activeMode === 'weather' ? stopMode() : fetchWeather()}
                >
                  <span className="rc-mode-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>
                    </svg>
                  </span>
                  <span>Weather</span>
                  <span className="rc-mode-desc">Current conditions</span>
                </button>

                <button
                  className={`rc-mode-btn ${activeMode === 'greeting' ? 'active' : ''}`}
                  onClick={() => activeMode === 'greeting' ? stopMode() : startMode('greeting')}
                >
                  <span className="rc-mode-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                  </span>
                  <span>Greeting</span>
                  <span className="rc-mode-desc">Time-based greeting</span>
                </button>
              </div>
            </div>

            {/* Quick message chips */}
            <div className="rc-card">
              <h3 className="rc-card-title">Quick Messages</h3>
              <div className="rc-chip-scroll">
                {QUICK_MESSAGES.greetings.map((msg, i) => (
                  <button key={`g-${i}`} className="rc-chip" onClick={() => sendQuickMessage(msg)}>
                    {msg.find(l => l.trim())}
                  </button>
                ))}
                {QUICK_MESSAGES.quotes.map((msg, i) => (
                  <button key={`q-${i}`} className="rc-chip" onClick={() => sendQuickMessage(msg)}>
                    {msg.find(l => l.trim())}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Settings Section */}
        {activeSection === 'settings' && (
          <div className="rc-section">
            <div className="rc-card">
              <h3 className="rc-card-title">Flip Speed</h3>
              <div className="rc-speed-btns">
                {['slow', 'medium', 'fast'].map(speed => (
                  <button
                    key={speed}
                    className={`rc-speed-btn ${flipSpeed === speed ? 'active' : ''}`}
                    onClick={() => { setFlipSpeed(speed); updateSetting('flipSpeed', speed); }}
                  >
                    {speed.charAt(0).toUpperCase() + speed.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="rc-card">
              <div className="rc-toggle-row">
                <h3 className="rc-card-title">Sound</h3>
                <button
                  className={`rc-toggle ${soundOn ? 'on' : 'off'}`}
                  onClick={() => { setSoundOn(!soundOn); updateSetting('soundOn', !soundOn); }}
                >
                  <span className="rc-toggle-knob" />
                </button>
              </div>
            </div>

            <div className="rc-card">
              <h3 className="rc-card-title">Accent Bar Color</h3>
              <div className="rc-color-grid">
                {ACCENT_PRESETS.map(c => (
                  <button
                    key={c.value}
                    className={`rc-color-btn ${accentColor === c.value ? 'active' : ''}`}
                    style={{ background: c.value }}
                    onClick={() => { setAccentColor(c.value); updateSetting('accentColor', c.value); }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div className="rc-card">
              <h3 className="rc-card-title">Text Color</h3>
              <div className="rc-color-grid">
                {TEXT_COLORS.map(c => (
                  <button
                    key={c.value}
                    className={`rc-text-color-btn ${textColor === c.value ? 'active' : ''}`}
                    onClick={() => { setTextColor(c.value); updateSetting('textColor', c.value); }}
                  >
                    <span style={{ color: c.value }}>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
