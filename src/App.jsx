import { useRef, useState, useEffect, useCallback } from 'react';
import Board from './components/Board';
import Header from './components/Header';
import Hero from './components/Hero';
import { SoundEngine } from './SoundEngine';
import { MESSAGES, MESSAGE_INTERVAL, TOTAL_TRANSITION, CHARSET } from './constants';
import './App.css';

const VALID_CHARS = new Set(CHARSET);
const filterLine = (s) =>
  s.toUpperCase().split('').filter(c => VALID_CHARS.has(c)).join('').slice(0, 22);

const msgLabel = (lines) => lines.find(l => l.trim()) || 'Message';

export default function App() {
  const boardRef = useRef(null);
  const soundEngineRef = useRef(new SoundEngine());
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState(null);
  const audioInitializedRef = useRef(false);
  const currentIndexRef = useRef(-1);
  const rotatorTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [messages, setMessages] = useState(() =>
    MESSAGES.map((lines, i) => ({ id: i, lines }))
  );
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const nextIdRef = useRef(MESSAGES.length);
  const [activeMsgId, setActiveMsgId] = useState(null);

  const [showPanel, setShowPanel] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [draftLines, setDraftLines] = useState(['', '', '', '', '', '']);
  const showPanelRef = useRef(false);
  useEffect(() => { showPanelRef.current = showPanel; }, [showPanel]);

  // Scroll-driven board reveal
  const boardSectionRef = useRef(null);
  const [boardProgress, setBoardProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const section = boardSectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // progress: 0 when section top is at bottom of viewport, 1 when section top reaches top
      const raw = 1 - rect.top / vh;
      setBoardProgress(Math.max(0, Math.min(1, raw)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const initAudio = useCallback(async () => {
    if (audioInitializedRef.current) return;
    audioInitializedRef.current = true;
    await soundEngineRef.current.init();
    soundEngineRef.current.resume();
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1200);
  }, []);

  const advance = useCallback((direction = 1) => {
    if (!boardRef.current) return;
    const msgs = messagesRef.current;
    if (!msgs.length) return;
    currentIndexRef.current = (currentIndexRef.current + direction + msgs.length) % msgs.length;
    const msg = msgs[currentIndexRef.current];
    boardRef.current.displayMessage(msg.lines);
    setActiveMsgId(msg.id);
  }, []);

  const resetTimer = useCallback(() => {
    clearInterval(rotatorTimerRef.current);
    rotatorTimerRef.current = setInterval(() => {
      if (!boardRef.current?.isTransitioning) advance(1);
    }, MESSAGE_INTERVAL + TOTAL_TRANSITION);
  }, [advance]);

  const next = useCallback(() => { advance(1); resetTimer(); }, [advance, resetTimer]);
  const prev = useCallback(() => { advance(-1); resetTimer(); }, [advance, resetTimer]);

  const toggleMute = useCallback(() => {
    const isMuted = soundEngineRef.current.toggleMute();
    setMuted(isMuted);
    showToast(isMuted ? 'Sound off' : 'Sound on');
  }, [showToast]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const handleVolumeClick = useCallback(() => {
    initAudio();
    toggleMute();
  }, [initAudio, toggleMute]);

  const displayById = useCallback((id) => {
    const msgs = messagesRef.current;
    const idx = msgs.findIndex(m => m.id === id);
    if (idx === -1 || !boardRef.current) return;
    currentIndexRef.current = idx;
    boardRef.current.displayMessage(msgs[idx].lines);
    setActiveMsgId(id);
    clearInterval(rotatorTimerRef.current);
  }, []);

  const openPanel = useCallback(() => {
    setShowPanel(true);
    setAddingNew(false);
  }, []);

  const closePanel = useCallback(() => {
    setShowPanel(false);
    setAddingNew(false);
    setDraftLines(['', '', '', '', '', '']);
  }, []);

  const addMessage = useCallback(() => {
    const trimmed = draftLines.map(l => l.trim());
    if (!trimmed.some(l => l)) return;
    const id = nextIdRef.current++;
    setMessages(prev => [...prev, { id, lines: trimmed }]);
    setDraftLines(['', '', '', '', '', '']);
    setAddingNew(false);
    boardRef.current?.displayMessage(trimmed);
    setActiveMsgId(id);
    clearInterval(rotatorTimerRef.current);
  }, [draftLines]);

  const deleteMessage = useCallback((id, e) => {
    e.stopPropagation();
    setMessages(prev => {
      const next = prev.filter(m => m.id !== id);
      messagesRef.current = next;
      return next;
    });
    if (activeMsgId === id) setTimeout(() => advance(1), 0);
  }, [activeMsgId, advance]);

  useEffect(() => {
    advance(1);
    rotatorTimerRef.current = setInterval(() => {
      if (!boardRef.current?.isTransitioning) advance(1);
    }, MESSAGE_INTERVAL + TOTAL_TRANSITION);
    return () => clearInterval(rotatorTimerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);
    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
  }, [initAudio]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
        case 'ArrowRight':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prev();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'Escape':
          if (showPanelRef.current) { closePanel(); }
          else if (document.fullscreenElement) document.exitFullscreen();
          break;
        default:
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [next, prev, toggleFullscreen, toggleMute, closePanel]);

  // Compute board transform from scroll progress
  const boardTranslateY = (1 - boardProgress) * 60; // percentage offset
  const boardOpacity = Math.min(1, boardProgress * 1.5);

  return (
    <div className="page-wrapper">
      <Header muted={muted} onVolumeClick={handleVolumeClick} />

      <section className="hero-section">
        <Hero />
      </section>

      <section className="board-section" id="board-container" ref={boardSectionRef}>
        <div
          className="board-reveal"
          style={{
            transform: `translateY(${boardTranslateY}%)`,
            opacity: boardOpacity,
          }}
        >
          <div className="display-frame">
            <Board ref={boardRef} soundEngine={soundEngineRef.current} />
          </div>

          <button className="messages-fab" onClick={openPanel} title="Manage messages">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Messages</span>
          </button>
        </div>
      </section>

      {/* Messages panel */}
      {showPanel && (
        <div className="panel-overlay" onClick={closePanel}>
          <div className="msg-panel" onClick={e => e.stopPropagation()}>
            <div className="panel-header">
              <h3>Messages</h3>
              <button className="panel-close" onClick={closePanel}>×</button>
            </div>

            <div className="msg-list">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`msg-item${activeMsgId === msg.id ? ' active' : ''}`}
                  onClick={() => displayById(msg.id)}
                >
                  <div className="msg-item-content">
                    <div className="msg-item-label">{msgLabel(msg.lines)}</div>
                    <div className="msg-item-preview">
                      {msg.lines.filter(l => l.trim()).join(' · ')}
                    </div>
                  </div>
                  <button
                    className="msg-item-delete"
                    onClick={(e) => deleteMessage(msg.id, e)}
                    title="Delete"
                  >×</button>
                </div>
              ))}
            </div>

            {addingNew ? (
              <div className="add-form">
                <h4>New message</h4>
                {draftLines.map((line, i) => (
                  <input
                    key={i}
                    className="draft-input"
                    value={line}
                    placeholder={`Row ${i + 1}`}
                    autoFocus={i === 0}
                    onChange={e => {
                      const val = filterLine(e.target.value);
                      setDraftLines(prev => prev.map((v, j) => j === i ? val : v));
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (i < 5) {
                          e.currentTarget.closest('.add-form')
                            .querySelectorAll('.draft-input')[i + 1]?.focus();
                        } else {
                          addMessage();
                        }
                      }
                      if (e.key === 'Escape') {
                        setAddingNew(false);
                        setDraftLines(['', '', '', '', '', '']);
                      }
                    }}
                  />
                ))}
                <div className="add-form-actions">
                  <button className="form-cancel" onClick={() => { setAddingNew(false); setDraftLines(['', '', '', '', '', '']); }}>Cancel</button>
                  <button className="form-save" onClick={addMessage}>Add</button>
                </div>
              </div>
            ) : (
              <button className="add-new-btn" onClick={() => setAddingNew(true)}>
                + New message
              </button>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
