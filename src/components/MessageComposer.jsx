import { useRef, useState, useEffect } from 'react';
import { EMOJI_CATEGORIES } from '../constants';

export function draftTextToLines(text, filterLine) {
  const lines = text.split('\n').slice(0, 6).map((l) => filterLine(l));
  while (lines.length < 6) lines.push('');
  return lines;
}

export function linesToDraftText(lines) {
  const l = Array.isArray(lines) ? [...lines] : [];
  while (l.length < 6) l.push('');
  return l.slice(0, 6).join('\n');
}

export function filterMultilineDraft(text, filterLine) {
  return text
    .split('\n')
    .slice(0, 6)
    .map((l) => filterLine(l))
    .join('\n');
}

/**
 * Shared message editor: one textarea (each line = board row), single emoji-inserter, hint text.
 * variant "panel" = Messages popup/modal styling; "remote" = RC card styling.
 */
export default function MessageComposer({
  value,
  onChange,
  filterLine,
  title = 'New message',
  variant = 'panel',
  className = '',
  onCancel,
  onSubmit,
  submitLabel = 'Add',
  cancelLabel = 'Cancel',
  footer = null,
  autoFocus = false,
}) {
  const textareaRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(0);
  const isRemote = variant === 'remote';

  const handleChange = (e) => {
    onChange(filterMultilineDraft(e.target.value, filterLine));
  };

  const insertEmoji = (emoji) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(filterMultilineDraft(value + emoji, filterLine));
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    onChange(filterMultilineDraft(before + emoji + after, filterLine));
    setTimeout(() => {
      el.focus();
      const pos = start + [...emoji].length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  useEffect(() => {
    if (!showEmojiPicker) return;
    function handleDocClick(e) {
      if (emojiPickerRef.current?.contains(e.target)) return;
      if (e.target.closest('.message-composer-emoji-btn')) return;
      const ta = textareaRef.current;
      if (ta && ta.contains(e.target)) return;
      setShowEmojiPicker(false);
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [showEmojiPicker]);

  const handleSubmit = () => {
    const lines = draftTextToLines(value, filterLine);
    if (!lines.some((l) => l.trim())) return;
    onSubmit?.(lines);
  };

  const taClass = `${isRemote ? 'rc-message-input' : 'draft-textarea'} message-composer-textarea`.trim();
  const hintClass = isRemote ? 'message-composer-hint message-composer-hint--remote' : 'message-composer-hint';

  return (
    <div
      className={`message-composer${isRemote ? ' message-composer--remote' : ''}${className ? ` ${className}` : ''}`.trim()}
    >
      {isRemote ? (
        <div className="rc-card-header">
          <h3>{title}</h3>
          <button
            type="button"
            className={`rc-emoji-btn message-composer-emoji-btn${showEmojiPicker ? ' active' : ''}`}
            onClick={() => setShowEmojiPicker((v) => !v)}
            title="Insert emoji"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 13s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="add-form-header">
          <span className="popup-section-label" style={{ padding: 0 }}>
            {title}
          </span>
          <button
            type="button"
            className="emoji-trigger message-composer-emoji-btn"
            onClick={() => setShowEmojiPicker((v) => !v)}
            title="Insert emoji into text"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 13s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
              <line x1="12" y1="5" x2="12" y2="8" />
              <line x1="10.5" y1="6.5" x2="13.5" y2="6.5" />
            </svg>
          </button>
        </div>
      )}

      {showEmojiPicker && (
        <div ref={emojiPickerRef} className={isRemote ? 'rc-emoji-picker' : 'emoji-picker'}>
          <div className={isRemote ? 'rc-emoji-tabs' : 'emoji-tabs'}>
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                type="button"
                className={`${isRemote ? 'rc-emoji-tab' : 'emoji-tab'}${emojiCategory === i ? ' active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setEmojiCategory(i);
                }}
                title={cat.label}
              >
                {cat.icon}
              </button>
            ))}
          </div>
          <div className={isRemote ? 'rc-emoji-grid' : 'emoji-grid'}>
            {EMOJI_CATEGORIES[emojiCategory].emojis.map((e) => (
              <button
                key={e}
                type="button"
                className={isRemote ? 'rc-emoji-opt' : 'emoji-opt'}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  insertEmoji(e);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className={hintClass}>
        Each line becomes one row on the board (up to 6 lines, 22 characters per line).
      </p>

      <textarea
        ref={textareaRef}
        className={taClass}
        value={value}
        onChange={handleChange}
        rows={6}
        autoFocus={autoFocus}
        placeholder={isRemote ? 'Row 1 — Enter for row 2…' : 'Row 1 — press Enter for row 2'}
        spellCheck={false}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel?.();
          }
        }}
      />

      {footer ?? (
        <div className="add-form-actions">
          <button type="button" className="form-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="form-save" onClick={handleSubmit}>
            {submitLabel}
          </button>
        </div>
      )}
    </div>
  );
}
