import { useRef, useEffect, useState, useCallback } from 'react';
import Board from './Board';
import PairingCode from './PairingCode';
import { SoundEngine } from '../SoundEngine';
import { MESSAGES, MESSAGE_INTERVAL, TOTAL_TRANSITION, CHARSET, SCRAMBLE_DURATION, FLIP_DURATION, STAGGER_DELAY } from '../constants';
import { createPairing, refreshPairing, reconnectPairing, subscribeToEvents, getPairingStatus } from '../api';

const VALID_CHARS = new Set(CHARSET);
const filterLine = (s) =>
  s.toUpperCase().split('').filter(c => VALID_CHARS.has(c)).join('').slice(0, 22);

const QUOTES = [
  ['', '', 'STAY HUNGRY', 'STAY FOOLISH', '- STEVE JOBS', ''],
  ['', '', 'GOD IS IN', 'THE DETAILS .', '- LUDWIG MIES', ''],
  ['', '', 'GOOD DESIGN IS', 'GOOD BUSINESS', '- THOMAS WATSON', ''],
  ['', 'LESS IS MORE', '', '- MIES VAN DER ROHE', '', ''],
  ['', '', 'MAKE IT SIMPLE', 'BUT SIGNIFICANT', '- DON DRAPER', ''],
  ['', '', 'HAVE NO FEAR OF', 'PERFECTION', '- SALVADOR DALI', ''],
  ['', '', 'THINK DIFFERENT', '', '- APPLE', ''],
  ['', '', 'DONE IS BETTER', 'THAN PERFECT', '- SHERYL SANDBERG', ''],
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return ['', '', '', 'GOOD MORNING', '', ''];
  if (h < 17) return ['', '', '', 'GOOD AFTERNOON', '', ''];
  return ['', '', '', 'GOOD EVENING', '', ''];
}

function getClockLines() {
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const timeStr = `${h12}:${m} ${ampm}`;
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return ['', '', timeStr.toUpperCase(), dateStr.toUpperCase().slice(0, 22), '', ''];
}

export default function TVMode({ onExitTV }) {
  const boardRef = useRef(null);
  const soundEngineRef = useRef(new SoundEngine());
  const audioInitRef = useRef(false);

  // Pairing state
  const [pairingId, setPairingId] = useState(null);
  const [tvSessionId, setTvSessionId] = useState(null);
  const [code, setCode] = useState(null);
  const [paired, setPaired] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [connectedCount, setConnectedCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(300);

  // Board state
  const [flipSpeed, setFlipSpeed] = useState('medium'); // slow, medium, fast
  const [soundOn, setSoundOn] = useState(true);
  const [accentColor, setAccentColor] = useState('#C850C0');
  const [textColor, setTextColor] = useState('#FFFFFF');

  // Auto-mode state
  const [activeMode, setActiveMode] = useState(null); // quotes, clock, greeting, null
  const modeIntervalRef = useRef(null);
  const quoteIndexRef = useRef(0);

  // Messages from constants for initial display
  const currentIndexRef = useRef(-1);
  const rotatorRef = useRef(null);

  // Reconnect from localStorage
  const savedPairingRef = useRef(null);

  // Queue for commands received before board is mounted
  const pendingCommandRef = useRef(null);

  // Auto-hide connected badge
  const [showBadge, setShowBadge] = useState(false);

  const initAudio = useCallback(async () => {
    if (audioInitRef.current) return;
    audioInitRef.current = true;
    await soundEngineRef.current.init();
    soundEngineRef.current.resume();
  }, []);

  const displayOnBoard = useCallback((lines, force = false) => {
    if (!boardRef.current) {
      // Board not mounted yet — queue the command
      pendingCommandRef.current = lines;
      return;
    }
    if (!force && boardRef.current.isTransitioning) return;
    boardRef.current.displayMessage(lines);
    if (soundOn) soundEngineRef.current.playTransition();
  }, [soundOn]);

  // Initialize pairing — try reconnecting to saved session first
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Try reconnecting to existing session from localStorage
        const saved = localStorage.getItem('flapstr_tv_pairing');
        if (saved) {
          const { pairingId: savedId, tvSessionId: savedTvId } = JSON.parse(saved);
          try {
            const reconn = await reconnectPairing(savedId, savedTvId);
            if (cancelled) return;
            setPairingId(reconn.pairingId);
            setTvSessionId(reconn.tvSessionId);
            setCode(reconn.code);
            setSecondsLeft(300);
            if (reconn.paired) {
              setPaired(true);
              setConnectedCount(reconn.connectedDevices);
            }
            return; // Successfully reconnected
          } catch {
            // Session expired or not found — create new
            localStorage.removeItem('flapstr_tv_pairing');
          }
        }

        // No saved session or reconnect failed — create new
        const data = await createPairing();
        if (cancelled) return;
        setPairingId(data.pairingId);
        setTvSessionId(data.tvSessionId);
        setCode(data.code);
        setSecondsLeft(300);

        localStorage.setItem('flapstr_tv_pairing', JSON.stringify({
          pairingId: data.pairingId,
          tvSessionId: data.tvSessionId,
        }));
      } catch (err) {
        console.error('Failed to create pairing:', err);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Subscribe to SSE events
  useEffect(() => {
    if (!pairingId) return;

    const es = subscribeToEvents(pairingId, (data) => {
      switch (data.type) {
        case 'device_connected':
          setConnectedCount(data.payload.count);
          setShowBadge(true);
          setTimeout(() => setShowBadge(false), 2000);
          if (!paired) {
            setShowConfetti(true);
            setTimeout(() => {
              setPaired(true);
              setTimeout(() => setShowConfetti(false), 3000);
            }, 800);
          }
          break;
        case 'device_disconnected':
          setConnectedCount(data.payload.count);
          if (data.payload.count === 0) setPaired(false);
          break;
        case 'message':
          if (data.payload?.lines) {
            clearAutoMode();
            displayOnBoard(data.payload.lines);
          }
          break;
        case 'quotes_mode':
          startQuotesMode();
          break;
        case 'clock_mode':
          startClockMode();
          break;
        case 'greeting_mode':
          clearAutoMode();
          setActiveMode('greeting');
          displayOnBoard(getGreeting());
          break;
        case 'weather_mode':
          clearAutoMode();
          setActiveMode('weather');
          if (data.payload?.lines) displayOnBoard(data.payload.lines);
          break;
        case 'stop_mode':
          clearAutoMode();
          break;
        case 'settings':
          if (data.payload) {
            if (data.payload.flipSpeed) setFlipSpeed(data.payload.flipSpeed);
            if (data.payload.soundOn !== undefined) setSoundOn(data.payload.soundOn);
            if (data.payload.accentColor) setAccentColor(data.payload.accentColor);
            if (data.payload.textColor) setTextColor(data.payload.textColor);
          }
          break;
        default:
          break;
      }
    });

    return () => es.close();
  }, [pairingId, displayOnBoard]);

  // Polling fallback — in case SSE misses the device_connected event
  useEffect(() => {
    if (paired || !pairingId) return;
    const poll = setInterval(async () => {
      try {
        const status = await getPairingStatus(pairingId);
        if (status.connectedDevices > 0) {
          setConnectedCount(status.connectedDevices);
          setShowBadge(true);
          setTimeout(() => setShowBadge(false), 2000);
          setShowConfetti(true);
          setTimeout(() => {
            setPaired(true);
            setTimeout(() => setShowConfetti(false), 3000);
          }, 800);
        }
      } catch { /* ignore */ }
    }, 4000);
    return () => clearInterval(poll);
  }, [paired, pairingId]);

  // Countdown timer for code refresh
  useEffect(() => {
    if (paired || !pairingId) return;

    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          // Refresh code
          refreshPairing(pairingId, tvSessionId).then(data => {
            if (data.paired) {
              setPaired(true);
            } else {
              setCode(data.code);
            }
          }).catch(() => {});
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [paired, pairingId, tvSessionId]);

  // Flush pending command when board mounts after pairing
  useEffect(() => {
    if (paired && boardRef.current && pendingCommandRef.current) {
      const lines = pendingCommandRef.current;
      pendingCommandRef.current = null;
      setTimeout(() => displayOnBoard(lines), 500);
    }
  }, [paired, displayOnBoard]);

  // Auto-rotate default messages when not paired
  useEffect(() => {
    if (paired) {
      clearInterval(rotatorRef.current);
      return;
    }
    const msgs = MESSAGES.map(m => (Array.isArray(m) ? m : m.lines));
    const advance = () => {
      currentIndexRef.current = (currentIndexRef.current + 1) % msgs.length;
      displayOnBoard(msgs[currentIndexRef.current]);
    };
    advance();
    rotatorRef.current = setInterval(() => {
      if (!boardRef.current?.isTransitioning) advance();
    }, MESSAGE_INTERVAL + TOTAL_TRANSITION);
    return () => clearInterval(rotatorRef.current);
  }, [paired, displayOnBoard]);

  // Enter fullscreen when paired
  useEffect(() => {
    if (paired && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, [paired]);

  // Auto-mode handlers
  function clearAutoMode() {
    clearInterval(modeIntervalRef.current);
    modeIntervalRef.current = null;
    setActiveMode(null);
  }

  function startQuotesMode() {
    clearAutoMode();
    setActiveMode('quotes');
    quoteIndexRef.current = 0;
    displayOnBoard(QUOTES[0]);
    modeIntervalRef.current = setInterval(() => {
      quoteIndexRef.current = (quoteIndexRef.current + 1) % QUOTES.length;
      displayOnBoard(QUOTES[quoteIndexRef.current]);
    }, 30000);
  }

  function startClockMode() {
    clearAutoMode();
    setActiveMode('clock');
    displayOnBoard(getClockLines(), true);

    // Check every 5 seconds; only push update when the minute actually changes
    let lastMinute = new Date().getMinutes();
    modeIntervalRef.current = setInterval(() => {
      const now = new Date();
      if (now.getMinutes() !== lastMinute) {
        lastMinute = now.getMinutes();
        displayOnBoard(getClockLines(), true);
      }
    }, 5000);
  }

  // Exit TV mode on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onExitTV) {
        onExitTV();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onExitTV]);

  // Init audio on interaction
  useEffect(() => {
    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);
    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
  }, [initAudio]);

  // Apply text color via CSS custom property
  useEffect(() => {
    document.documentElement.style.setProperty('--tv-text-color', textColor);
  }, [textColor]);

  return (
    <div className="tv-mode" style={{ '--tv-accent-color': accentColor }}>
      {/* Confetti celebration */}
      {showConfetti && (
        <div className="tv-confetti-overlay">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="tv-confetti-piece"
              style={{
                '--x': `${Math.random() * 100}vw`,
                '--delay': `${Math.random() * 0.8}s`,
                '--duration': `${1.5 + Math.random() * 2}s`,
                '--rotation': `${Math.random() * 720 - 360}deg`,
                '--color': ['#C850C0', '#4158D0', '#FBDA61', '#22C55E', '#F43F5E', '#3B82F6'][i % 6],
              }}
            />
          ))}
          <div className="tv-confetti-text">Connected!</div>
        </div>
      )}

      {/* Before pairing: centered logo + code */}
      {!paired && !showConfetti && (
        <div className="tv-pairing-screen">
          <div className="tv-logo">Flapstr.</div>
          {code && <PairingCode code={code} secondsLeft={secondsLeft} />}
        </div>
      )}

      {/* After pairing: fullscreen board */}
      {paired && (
        <div className="tv-board-wrap">
          <Board ref={boardRef} soundEngine={soundEngineRef.current} />
        </div>
      )}

      {/* Connected indicator - bottom right, auto-hides */}
      {paired && showBadge && (
        <div className="tv-connected-badge">
          <span className="tv-connected-dot" />
          Mobile device connected
        </div>
      )}

      {/* Active mode indicator */}
      {activeMode && (
        <div className="tv-mode-badge">
          {activeMode === 'quotes' && 'Quotes'}
          {activeMode === 'clock' && 'Clock'}
          {activeMode === 'greeting' && 'Greeting'}
          {activeMode === 'weather' && 'Weather'}
        </div>
      )}

      {/* Exit TV mode button */}
      {onExitTV && (
        <button className="tv-exit-btn" onClick={onExitTV} title="Exit TV Mode">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      )}
    </div>
  );
}
