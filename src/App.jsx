import { useRef, useState, useEffect, useCallback } from 'react';
import Board from './components/Board';
import Header from './components/Header';
import Hero from './components/Hero';
import TVMode from './components/TVMode';
import MobileMode from './components/MobileMode';
import MessageComposer, { linesToDraftText } from './components/MessageComposer';
import { SoundEngine } from './SoundEngine';
import { MESSAGES, MESSAGE_INTERVAL, TOTAL_TRANSITION, CHARSET, splitGraphemes, isEmojiChar, getClockLines } from './constants';
import { detectDevice } from './deviceDetection';
import './App.css';

const VALID_CHARS = new Set(CHARSET);
const filterLine = (s) => {
  const graphemes = splitGraphemes(s.toUpperCase());
  return graphemes.filter(g => VALID_CHARS.has(g) || isEmojiChar(g)).slice(0, 22).join('');
};

const msgLabel = (lines) => lines.find(l => l.trim()) || 'Message';

/** Stable id for the homepage clock-only message (second slide in rotation). */
const HOME_CLOCK_MESSAGE_ID = 1;

export default function App() {
  const [mode, setMode] = useState(() => detectDevice());
  const [tvModeForced, setTvModeForced] = useState(false);
  const [mobilePairingOpen, setMobilePairingOpen] = useState(false);

  // Listen for resize to update mode detection
  useEffect(() => {
    function onResize() {
      if (!tvModeForced) {
        setMode(detectDevice());
      }
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [tvModeForced]);

  useEffect(() => {
    if (mode !== 'mobile') setMobilePairingOpen(false);
  }, [mode]);

  // Mobile pairing flow (opened from homepage header)
  if (mobilePairingOpen && mode === 'mobile') {
    return <MobileMode onClose={() => setMobilePairingOpen(false)} />;
  }

  // TV mode (auto-detected or forced)
  if (mode === 'tv' || tvModeForced) {
    return (
      <TVMode
        onExitTV={() => {
          setTvModeForced(false);
          setMode('desktop');
        }}
      />
    );
  }

  // Desktop + mobile homepage — same UI; Pair Device opens TV mode or mobile pairing
  return (
    <DesktopMode
      onPairDevice={
        mode === 'mobile'
          ? () => setMobilePairingOpen(true)
          : () => setTvModeForced(true)
      }
    />
  );
}

// ── Desktop Mode (original UI) ──────────────────────────────────────────
function DesktopMode({ onPairDevice }) {
  const boardRef = useRef(null);
  const soundEngineRef = useRef(new SoundEngine());
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState(null);
  const audioInitializedRef = useRef(false);
  const currentIndexRef = useRef(-1);
  const rotatorTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [messages, setMessages] = useState(() => [
    {
      id: 0,
      lines: [...MESSAGES[0]],
    },
    {
      id: HOME_CLOCK_MESSAGE_ID,
      lines: getClockLines(),
    },
  ]);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const nextIdRef = useRef(MESSAGES.length + 1);
  const [activeMsgId, setActiveMsgId] = useState(null);
  const activeMsgIdRef = useRef(activeMsgId);
  useEffect(() => { activeMsgIdRef.current = activeMsgId; }, [activeMsgId]);

  const [showPanel, setShowPanel] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [draftText, setDraftText] = useState('');
  const showPanelRef = useRef(false);
  const showShortcutsRef = useRef(false);
  const showModalRef = useRef(false);
  useEffect(() => { showPanelRef.current = showPanel; }, [showPanel]);
  useEffect(() => { showShortcutsRef.current = showShortcuts; }, [showShortcuts]);
  useEffect(() => { showModalRef.current = showModal; }, [showModal]);


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
    setEditingMessageId(null);
  }, []);

  const closeMessagesUi = useCallback(() => {
    setShowPanel(false);
    setShowModal(false);
    setDraftText('');
    setAddingNew(false);
    setEditingMessageId(null);
  }, []);

  const submitNewMessage = useCallback((lines) => {
    const trimmed = lines.map((l) => l.trim());
    if (!trimmed.some((l) => l)) return;
    const id = nextIdRef.current++;
    setMessages((prev) => [...prev, { id, lines: trimmed }]);
    setDraftText('');
    setAddingNew(false);
    setShowPanel(false);
    setShowModal(false);
    boardRef.current?.displayMessage(trimmed);
    setActiveMsgId(id);
    clearInterval(rotatorTimerRef.current);
  }, []);

  const finishComposer = useCallback((lines) => {
    const trimmed = lines.map((l) => l.trim());
    if (!trimmed.some((l) => l)) return;
    if (editingMessageId !== null) {
      const eid = editingMessageId;
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === eid ? { ...m, lines: trimmed } : m));
        messagesRef.current = next;
        return next;
      });
      setEditingMessageId(null);
      setDraftText('');
      if (activeMsgId === eid) {
        boardRef.current?.displayMessage(trimmed);
      }
      return;
    }
    submitNewMessage(lines);
  }, [editingMessageId, activeMsgId, submitNewMessage]);

  const cancelComposer = useCallback(() => {
    if (editingMessageId !== null) {
      setEditingMessageId(null);
      setDraftText('');
    } else {
      closeMessagesUi();
    }
  }, [editingMessageId, closeMessagesUi]);

  const startEditMessage = useCallback((msg, e) => {
    e.stopPropagation();
    setAddingNew(false);
    setEditingMessageId(msg.id);
    setDraftText(linesToDraftText(msg.lines));
  }, []);

  const deleteMessage = useCallback((id, e) => {
    e.stopPropagation();
    setEditingMessageId((eid) => (eid === id ? null : eid));
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
    let lastMinute = new Date().getMinutes();
    const tick = () => {
      const now = new Date();
      if (now.getMinutes() === lastMinute) return;
      lastMinute = now.getMinutes();
      const lines = getClockLines();
      setMessages((prev) => {
        if (!prev.some((m) => m.id === HOME_CLOCK_MESSAGE_ID)) return prev;
        const next = prev.map((m) =>
          m.id === HOME_CLOCK_MESSAGE_ID ? { ...m, lines } : m
        );
        if (activeMsgIdRef.current === HOME_CLOCK_MESSAGE_ID && boardRef.current && !boardRef.current.isTransitioning) {
          queueMicrotask(() => boardRef.current?.displayMessage(lines));
        }
        return next;
      });
    };
    const intervalId = setInterval(tick, 5000);
    return () => clearInterval(intervalId);
  }, []);

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
        case 'b':
        case 'B':
          e.preventDefault();
          initAudio();
          if (showModalRef.current || showPanelRef.current) {
            closeMessagesUi();
          } else {
            openPanel();
          }
          break;
        case 'Escape':
          if (showModalRef.current || showPanelRef.current) {
            closeMessagesUi();
          } else if (showShortcutsRef.current) {
            setShowShortcuts(false);
          } else if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          break;
        default:
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [next, prev, toggleFullscreen, toggleMute, closeMessagesUi, openPanel, initAudio]);

  return (
    <div className="page-wrapper">
      <Header muted={muted} onVolumeClick={handleVolumeClick} onPairDevice={onPairDevice} />

      <div className="single-screen">
        <div className="single-screen-stack">
          <div className="hero-area">
            <Hero />
          </div>
          <div className="board-area">
            <div className="display-frame">
              <Board ref={boardRef} soundEngine={soundEngineRef.current} />
            </div>
            <div className="board-controls">
            {/* Messages popup */}
            <div className="popup-wrap">
              <button className="ctrl-btn" onClick={openPanel} title="Messages (B)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
              {showPanel && (
                <>
                  <div className="popup-backdrop" onClick={closeMessagesUi} />
                  <div className="popup msg-popup">
                    <div className="popup-header-row">
                      <span className="popup-section-label">Messages</span>
                      <button className="popup-expand-btn" title="Expand" onClick={() => { setShowPanel(false); setShowModal(true); }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                        </svg>
                      </button>
                    </div>
                    <div className="msg-list">
                      {messages.map(msg => (
                        <div
                          key={msg.id}
                          className={`msg-item${activeMsgId === msg.id ? ' active' : ''}`}
                          onClick={() => displayById(msg.id)}
                        >
                          {msg.emoji && <span className="msg-emoji">{msg.emoji}</span>}
                          <div className="msg-item-content">
                            <div className="msg-item-label">{msgLabel(msg.lines)}</div>
                            <div className="msg-item-preview">{msg.lines.filter(l => l.trim()).join(' · ')}</div>
                          </div>
                          <div className="msg-item-actions">
                            {msg.id !== HOME_CLOCK_MESSAGE_ID && (
                              <button type="button" className="msg-item-edit" title="Edit" onClick={(e) => startEditMessage(msg, e)}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            )}
                            <button type="button" className="msg-item-delete" onClick={(e) => deleteMessage(msg.id, e)}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {(addingNew || editingMessageId !== null) ? (
                      <MessageComposer
                        className="add-form"
                        value={draftText}
                        onChange={setDraftText}
                        filterLine={filterLine}
                        title={editingMessageId !== null ? 'Edit message' : 'New message'}
                        variant="panel"
                        submitLabel={editingMessageId !== null ? 'Save' : 'Add'}
                        onCancel={cancelComposer}
                        onSubmit={finishComposer}
                        autoFocus
                      />
                    ) : (
                      <button type="button" className="add-new-btn" onClick={() => { setEditingMessageId(null); setAddingNew(true); setDraftText(''); }}>+ New message</button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Info / shortcuts popup */}
            <div className="popup-wrap">
              <button className="ctrl-btn" title="Shortcuts" onClick={() => setShowShortcuts(v => !v)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
                </svg>
              </button>
              {showShortcuts && (
                <>
                  <div className="popup-backdrop" onClick={() => setShowShortcuts(false)} />
                  <div className="popup shortcuts-popup">
                    <div className="popup-section-label">Shortcuts</div>
                    <div className="shortcut-row"><span>Messages</span><kbd>B</kbd></div>
                    <div className="shortcut-row"><span>Fullscreen</span><kbd>F</kbd></div>
                    <div className="shortcut-row"><span>Mute</span><kbd>M</kbd></div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Messages modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeMessagesUi}>
          <div className="messages-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Messages</h3>
              <button type="button" className="modal-close" onClick={closeMessagesUi}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="msg-list modal-msg-list">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`msg-item${activeMsgId === msg.id ? ' active' : ''}`}
                    onClick={() => { displayById(msg.id); setShowModal(false); }}
                  >
                    {msg.emoji && <span className="msg-emoji">{msg.emoji}</span>}
                    <div className="msg-item-content">
                      <div className="msg-item-label">{msgLabel(msg.lines)}</div>
                      <div className="msg-item-preview">{msg.lines.filter(l => l.trim()).join(' · ')}</div>
                    </div>
                    <div className="msg-item-actions">
                      {msg.id !== HOME_CLOCK_MESSAGE_ID && (
                        <button type="button" className="msg-item-edit" title="Edit" onClick={(e) => startEditMessage(msg, e)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                      <button type="button" className="msg-item-delete" onClick={(e) => deleteMessage(msg.id, e)}>×</button>
                    </div>
                  </div>
                ))}
              </div>
              {(addingNew || editingMessageId !== null) ? (
                <MessageComposer
                  className="add-form modal-add-form"
                  value={draftText}
                  onChange={setDraftText}
                  filterLine={filterLine}
                  title={editingMessageId !== null ? 'Edit message' : 'New message'}
                  variant="panel"
                  submitLabel={editingMessageId !== null ? 'Save' : 'Add'}
                  onCancel={cancelComposer}
                  onSubmit={finishComposer}
                  autoFocus
                />
              ) : (
                <button type="button" className="add-new-btn modal-add-new-btn" onClick={() => { setEditingMessageId(null); setAddingNew(true); setDraftText(''); }}>+ New message</button>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
