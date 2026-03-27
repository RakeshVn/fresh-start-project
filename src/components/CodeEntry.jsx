import { useRef, useState } from 'react';

export default function CodeEntry({ onSubmit, error, loading }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  function handleChange(index, value) {
    // Only accept single digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5) {
      const code = next.join('');
      if (code.length === 6) {
        onSubmit(code);
      }
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const code = digits.join('');
      if (code.length === 6) onSubmit(code);
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    if (pasted.length === 6) {
      onSubmit(pasted);
    } else {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  }

  return (
    <div className="code-entry">
      <div className="code-entry-header">
        <div className="code-entry-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <h2>Connect to TV</h2>
        <p>Enter the 6-digit code shown on your TV</p>
      </div>

      <div className="code-inputs" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => inputRefs.current[i] = el}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={d}
            autoFocus={i === 0}
            className={`code-digit ${d ? 'filled' : ''} ${error ? 'error' : ''}`}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
          />
        ))}
      </div>

      {error && <div className="code-error">{error}</div>}

      {loading && (
        <div className="code-loading">
          <div className="code-spinner" />
          <span>Connecting...</span>
        </div>
      )}
    </div>
  );
}
