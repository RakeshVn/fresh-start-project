import { useRef, useState, useEffect, useCallback } from 'react';
import Board from './components/Board';
import Header from './components/Header';
import Hero from './components/Hero';
import TVMode from './components/TVMode';
import MobileMode from './components/MobileMode';
import { SoundEngine } from './SoundEngine';
import { MESSAGES, MESSAGE_INTERVAL, TOTAL_TRANSITION, CHARSET, splitGraphemes, isEmojiChar, EMOJI_CATEGORIES } from './constants';
import { detectDevice } from './deviceDetection';
import './App.css';

const VALID_CHARS = new Set(CHARSET);
const filterLine = (s) => {
  const graphemes = splitGraphemes(s.toUpperCase());
  return graphemes.filter(g => VALID_CHARS.has(g) || isEmojiChar(g)).slice(0, 22).join('');
};

const msgLabel = (lines) => lines.find(l => l.trim()) || 'Message';

export default function App() {
  const [mode, setMode] = useState(() => detectDevice());
  const [tvModeForced, setTvModeForced] = useState(false);

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

  // Mobile mode
  if (mode === 'mobile') {
    return <MobileMode />;
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

  // Desktop mode — original UI with TV Mode toggle
  return <DesktopMode onEnterTV={() => setTvModeForced(true)} />;
}

// ── Desktop Mode (original UI) ──────────────────────────────────────────
function DesktopMode({ onEnterTV }) {
  const boardRef = useRef(null);
  const soundEngineRef = useRef(new SoundEngine());
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState(null);
  const audioInitializedRef = useRef(false);
  const currentIndexRef = useRef(-1);
  const rotatorTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [messages, setMessages] = useState(() =>
    MESSAGES.map((entry, i) => ({
      id: i,
      lines: Array.isArray(entry) ? entry : entry.lines,
      emoji: Array.isArray(entry) ? undefined : entry.emoji,
    }))
  );
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const nextIdRef = useRef(MESSAGES.length);
  const [activeMsgId, setActiveMsgId] = useState(null);

  const [showPanel, setShowPanel] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [draftLines, setDraftLines] = useState(['', '', '', '', '', '']);
  const [draftEmoji, setDraftEmoji] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [emojiPickerMode, setEmojiPickerMode] = useState('label'); // 'label' | 'insert'
  const rowInputRefs = useRef([null, null, null, null, null, null]);
  const focusedRowRef = useRef(-1);
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
  }, []);

  const handleEmojiSelect = useCallback((emoji) => {
    if (emojiPickerMode === 'insert') {
      const row = focusedRowRef.current >= 0 ? focusedRowRef.current : 0;
      const inputEl = rowInputRefs.current[row];
      const cursorPos = inputEl?.selectionStart ?? (draftLines[row]?.length ?? 0);
      const before = (draftLines[row] ?? '').slice(0, cursorPos);
      const after = (draftLines[row] ?? '').slice(cursorPos);
      const newVal = filterLine(before + emoji + after);
      const newCursor = before.length + emoji.length;
      setDraftLines(prev => prev.map((v, j) => j === row ? newVal : v));
      setTimeout(() => {
        const el = rowInputRefs.current[row];
        if (el) { el.focus(); el.setSelectionRange(newCursor, newCursor); }
      }, 0);
      // Keep picker open for multi-insert
    } else {
      setDraftEmoji(emoji);
      setShowEmojiPicker(false);
    }
  }, [emojiPickerMode, draftLines]);

  const resetDraft = useCallback(() => {
    setDraftLines(['', '', '', '', '', '']);
    setDraftEmoji('');
    setShowEmojiPicker(false);
    setAddingNew(false);
    focusedRowRef.current = -1;
  }, []);

  const closePanel = useCallback(() => {
    setShowPanel(false);
    setDraftLines(['', '', '', '', '', '']);
    setDraftEmoji('');
    setShowEmojiPicker(false);
    setAddingNew(false);
  }, []);

  const addMessage = useCallback(() => {
    const trimmed = draftLines.map(l => l.trim());
    if (!trimmed.some(l => l)) return;
    const id = nextIdRef.current++;
    setMessages(prev => [...prev, { id, lines: trimmed, emoji: draftEmoji }]);
    setDraftLines(['', '', '', '', '', '']);
    setDraftEmoji('');
    setShowEmojiPicker(false);
    setAddingNew(false);
    boardRef.current?.displayMessage(trimmed);
    setActiveMsgId(id);
    clearInterval(rotatorTimerRef.current);
  }, [draftLines, draftEmoji]);

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
          if (showModalRef.current) { setShowModal(false); }
          else if (showPanelRef.current) { closePanel(); }
          else if (showShortcutsRef.current) { setShowShortcuts(false); }
          else if (document.fullscreenElement) document.exitFullscreen();
          break;
        default:
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [next, prev, toggleFullscreen, toggleMute, closePanel]);

  return (
    <div className="page-wrapper">
      <Header muted={muted} onVolumeClick={handleVolumeClick} />

      {/* TV Mode toggle button */}
      <button className="tv-mode-toggle" onClick={onEnterTV} title="Enter TV Mode">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <span>TV Mode</span>
      </button>

      <div className="single-screen">
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
              <button className="ctrl-btn" onClick={openPanel} title="Messages">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
              {showPanel && (
                <>
                  <div className="popup-backdrop" onClick={closePanel} />
                  <div className="popup msg-popup">
                    <div className="popup-header-row">
                      <span className="popup-section-label">Messages</span>
                      <button className="popup-expand-btn" title="Expand" onClick={() => { closePanel(); setShowModal(true); }}>
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
                          <button className="msg-item-delete" onClick={(e) => deleteMessage(msg.id, e)}>×</button>
                        </div>
                      ))}
                    </div>
                    {addingNew ? (
                      <div className="add-form">
                        <div className="add-form-header">
                          <div className="form-title-group">
                            <button
                              className="emoji-trigger label-emoji-btn"
                              onClick={() => { setEmojiPickerMode('label'); setShowEmojiPicker(v => !v); }}
                              title="Set message label emoji"
                            >
                              {draftEmoji || <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>}
                            </button>
                            <span className="popup-section-label" style={{padding: 0}}>New message</span>
                          </div>
                          <button
                            className="emoji-trigger"
                            onClick={() => { setEmojiPickerMode('insert'); setShowEmojiPicker(v => !v); }}
                            title="Insert emoji into text"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/><line x1="12" y1="5" x2="12" y2="8"/><line x1="10.5" y1="6.5" x2="13.5" y2="6.5"/></svg>
                          </button>
                        </div>
                        {draftEmoji && <button className="emoji-clear" onClick={() => setDraftEmoji('')}>×</button>}
                        {showEmojiPicker && (
                          <div className="emoji-picker">
                            <div className="emoji-tabs">
                              {EMOJI_CATEGORIES.map((cat, i) => (
                                <button
                                  key={cat.label}
                                  className={`emoji-tab${emojiCategory === i ? ' active' : ''}`}
                                  onMouseDown={e => { e.preventDefault(); setEmojiCategory(i); }}
                                  title={cat.label}
                                >
                                  {cat.icon}
                                </button>
                              ))}
                            </div>
                            <div className="emoji-grid">
                              {EMOJI_CATEGORIES[emojiCategory].emojis.map(e => (
                                <button
                                  key={e}
                                  className="emoji-opt"
                                  onMouseDown={e2 => { e2.preventDefault(); handleEmojiSelect(e); }}
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {draftLines.map((line, i) => (
                          <input
                            key={i}
                            ref={el => { rowInputRefs.current[i] = el; }}
                            onFocus={() => { focusedRowRef.current = i; }}
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
                                  e.currentTarget.closest('.add-form').querySelectorAll('.draft-input')[i + 1]?.focus();
                                } else { addMessage(); }
                              }
                              if (e.key === 'Escape') resetDraft();
                            }}
                          />
                        ))}
                        <div className="add-form-actions">
                          <button className="form-cancel" onClick={resetDraft}>Cancel</button>
                          <button className="form-save" onClick={addMessage}>Add</button>
                        </div>
                      </div>
                    ) : (
                      <button className="add-new-btn" onClick={() => setAddingNew(true)}>+ New message</button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Info / shortcuts popup */}
            <div className="popup-wrap">
              <button className="ctrl-btn" title="Keyboard shortcuts" onClick={() => setShowShortcuts(v => !v)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="12" rx="2"/>
                  <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>
                </svg>
              </button>
              {showShortcuts && (
                <>
                  <div className="popup-backdrop" onClick={() => setShowShortcuts(false)} />
                  <div className="popup shortcuts-popup">
                    <div className="popup-section-label">Shortcuts</div>
                    <div className="shortcut-row"><span>Custom message</span><kbd>Enter</kbd></div>
                    <div className="shortcut-row"><span>Next</span><kbd>Space / →</kbd></div>
                    <div className="shortcut-row"><span>Previous</span><kbd>←</kbd></div>
                    <div className="shortcut-row"><span>Fullscreen</span><kbd>F</kbd></div>
                    <div className="shortcut-row"><span>Mute</span><kbd>M</kbd></div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="messages-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Messages</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
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
                    <button className="msg-item-delete" onClick={(e) => deleteMessage(msg.id, e)}>×</button>
                  </div>
                ))}
              </div>
              {addingNew ? (
                <div className="add-form modal-add-form">
                  <div className="add-form-header">
                    <div className="form-title-group">
                      <button
                        className="emoji-trigger label-emoji-btn"
                        onClick={() => { setEmojiPickerMode('label'); setShowEmojiPicker(v => !v); }}
                        title="Set message label emoji"
                      >
                        {draftEmoji || <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>}
                      </button>
                      <span className="popup-section-label" style={{padding: 0}}>New message</span>
                    </div>
                    <button
                      className="emoji-trigger"
                      onClick={() => { setEmojiPickerMode('insert'); setShowEmojiPicker(v => !v); }}
                      title="Insert emoji into text"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/><line x1="12" y1="5" x2="12" y2="8"/><line x1="10.5" y1="6.5" x2="13.5" y2="6.5"/></svg>
                    </button>
                  </div>
                  {draftEmoji && <button className="emoji-clear" onClick={() => setDraftEmoji('')}>×</button>}
                  {showEmojiPicker && (
                    <div className="emoji-picker">
                      <div className="emoji-tabs">
                        {EMOJI_CATEGORIES.map((cat, i) => (
                          <button
                            key={cat.label}
                            className={`emoji-tab${emojiCategory === i ? ' active' : ''}`}
                            onMouseDown={e => { e.preventDefault(); setEmojiCategory(i); }}
                            title={cat.label}
                          >
                            {cat.icon}
                          </button>
                        ))}
                      </div>
                      <div className="emoji-grid">
                        {EMOJI_CATEGORIES[emojiCategory].emojis.map(e => (
                          <button
                            key={e}
                            className="emoji-opt"
                            onMouseDown={e2 => { e2.preventDefault(); handleEmojiSelect(e); }}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {draftLines.map((line, i) => (
                    <input
                      key={i}
                      ref={el => { rowInputRefs.current[i] = el; }}
                      onFocus={() => { focusedRowRef.current = i; }}
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
                            e.currentTarget.closest('.add-form').querySelectorAll('.draft-input')[i + 1]?.focus();
                          } else { addMessage(); }
                        }
                        if (e.key === 'Escape') resetDraft();
                      }}
                    />
                  ))}
                  <div className="add-form-actions">
                    <button className="form-cancel" onClick={resetDraft}>Cancel</button>
                    <button className="form-save" onClick={addMessage}>Add</button>
                  </div>
                </div>
              ) : (
                <button className="add-new-btn modal-add-new-btn" onClick={() => setAddingNew(true)}>+ New message</button>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
