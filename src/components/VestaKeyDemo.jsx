import React, { useEffect, useRef, useState } from 'react';

// ── Solari Split-Flap styles ─────────────────────────────────────────
const css = `
.solari-display-base {
  -webkit-perspective: 400px;
  perspective: 400px;
  -webkit-perspective-origin: 50% 50%;
  perspective-origin: 50% 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.solari-display-base * {
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
}
.solari-display {
  display: flex;
  align-items: center;
  justify-content: center;
}
.solari-segments {
  list-style-type: none;
  display: flex;
  gap: 4px;
  padding: 10px;
  margin: 0;
  background: #1a1a1a;
  border: 12px solid #8b1a1a;
  border-radius: 8px;
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
  box-shadow:
    0 0 0 2px #6b0f0f,
    0 20px 60px rgba(0, 0, 0, 0.7),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.solari-segments * {
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
}
.solari-segment {
  color: #aaa;
  text-align: center;
  position: relative;
  display: block;
  font-family: 'Oswald', 'DM Sans', sans-serif;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.solari-front,
.solari-flip-front,
.solari-flip-back,
.solari-back {
  position: absolute;
  overflow: hidden;
  background-color: #222;
  text-transform: uppercase;
  left: 0;
  right: 0;
  width: 100%;
  height: 50%;
  text-shadow:
    1px 1px 0 rgba(255, 255, 255, 0.08),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.2);
  box-shadow: inset 0 0 50px rgba(90, 90, 90, 0.2);
}
.solari-front {
  top: 0;
  border-radius: 4px 4px 0 0;
  border-bottom: 2px solid #000;
}
.solari-back {
  top: 50%;
  border-radius: 0 0 4px 4px;
  line-height: 0px;
  overflow: hidden;
  background-color: #222;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 5px,
    rgba(0, 0, 0, 0.45) 5px,
    rgba(0, 0, 0, 0.45) 6px
  );
}
.solari-flip-back {
  top: 0;
  background-color: #111;
  border-radius: 4px 4px 0 0;
  border-bottom: 2px solid #000;
}
.solari-flip-front {
  top: 0;
  line-height: 0px;
  overflow: hidden;
  border-radius: 0 0 4px 4px;
}
.solari-segment::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -5px;
  transform: translateY(-50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #1a1a1a;
  z-index: 20;
  pointer-events: none;
}
.solari-segment::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -5px;
  transform: translateY(-50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #1a1a1a;
  z-index: 20;
  pointer-events: none;
}
`;

// ── Character set ────────────────────────────────────────────────────
const LETTERS = [
  ' ', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I',
  'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
  'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '!', '-', '+', '&', '=', ';', ':', '"', '.', ',', '/', '?',
];

// ── Single flap segment ──────────────────────────────────────────────
function SolariSegment({ target, width, height, fontSize, flipSpeed }) {
  const frontRef = useRef(null);
  const flipFrontRef = useRef(null);
  const flipBackRef = useRef(null);
  const backRef = useRef(null);

  const stateRef = useRef({
    angle: 180,
    currentValue: 0,
    nextValue: 0,
    startTime: Date.now(),
    speed: flipSpeed ?? (0.25 + Math.random() * 0.01),
  });

  useEffect(() => {
    if (flipSpeed != null) stateRef.current.speed = flipSpeed;
  }, [flipSpeed]);

  useEffect(() => {
    const upper = (target || ' ').toUpperCase();
    const idx = LETTERS.indexOf(upper);
    stateRef.current.nextValue = idx >= 0 ? idx : 0;
  }, [target]);

  useEffect(() => {
    let rafId;
    const tick = () => {
      const s = stateRef.current;
      const front = frontRef.current;
      const flipFront = flipFrontRef.current;
      const flipBack = flipBackRef.current;
      const back = backRef.current;

      if (front && flipFront && flipBack && back) {
        const now = Date.now();
        s.angle += s.speed * (now - s.startTime);
        s.startTime = now;

        if (s.currentValue !== s.nextValue) {
          if (s.angle >= 180) {
            back.textContent = LETTERS[s.currentValue];
            flipBack.textContent = LETTERS[s.currentValue];
            s.currentValue = (s.currentValue + 1) % LETTERS.length;
            front.textContent = LETTERS[s.currentValue];
            flipFront.textContent = LETTERS[s.currentValue];
            s.angle %= 180;
          }
        } else {
          if (s.angle >= 180) s.angle = 180;
          front.textContent = LETTERS[s.currentValue];
          flipFront.textContent = LETTERS[s.currentValue];
        }

        const a = s.angle;
        const c1 = Math.abs(32 + 16 * Math.sin(a * Math.PI / 180)) | 0;
        flipFront.style.transform = `rotateX(${180 - a}deg) translateY(${0.5 * height}px) translateZ(0.1px)`;
        flipFront.style.backgroundColor = `rgb(${c1},${c1},${c1})`;

        const c2 = (170 - (a * 170 / 180)) | 0;
        flipBack.style.transform = `rotateX(-${a}deg)`;
        flipBack.style.color = `rgb(${c2},${c2},${c2})`;

        const c3 = (a * 170 / 180) | 0;
        flipFront.style.color = `rgb(${c3},${c3},${c3})`;

        const c4 = Math.abs(32 - 16 * Math.sin(a * Math.PI / 180)) | 0;
        flipBack.style.backgroundColor = `rgb(${c4},${c4},${c4})`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [height]);

  const half = height / 2;

  return (
    <li className="solari-segment" style={{ width, height, fontSize }}>
      <div ref={frontRef} className="solari-front" style={{ lineHeight: height + 'px' }} />
      <div ref={flipBackRef} className="solari-flip-back" style={{ lineHeight: height + 'px', transformOrigin: `0 ${half}px` }} />
      <div ref={flipFrontRef} className="solari-flip-front" style={{ transformOrigin: `0 ${half}px` }} />
      <div ref={backRef} className="solari-back" />
    </li>
  );
}

// ── Board ────────────────────────────────────────────────────────────
function SolariBoard({ text = '', cols = 11, segmentWidth = 52, segmentHeight = 80, fontSize = 56, flipSpeed }) {
  const chars = (text.toUpperCase() + ' '.repeat(cols)).slice(0, cols).split('');

  return (
    <div className="solari-display-base">
      <div className="solari-display" style={{ perspectiveOrigin: `${cols * segmentWidth / 2}px ${segmentHeight}px` }}>
        <ul
          className="solari-segments"
          style={{ width: cols * segmentWidth + (cols - 1) * 4 + 40, height: segmentHeight + 40, fontSize }}
        >
          {chars.map((ch, i) => (
            <SolariSegment key={i} target={ch} width={segmentWidth} height={segmentHeight} fontSize={fontSize} flipSpeed={flipSpeed} />
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Demo ─────────────────────────────────────────────────────────────
const SPEED_OPTIONS = [
  { label: 'Slow',   flipSpeed: 0.25 },
  { label: 'Normal', flipSpeed: 1.5  },
  { label: 'Fast',   flipSpeed: 6    },
  { label: 'Rapid',  flipSpeed: 30   },
];

export default function VestaKeyDemo() {
  const [customText, setCustomText] = useState('');
  const [speedIdx, setSpeedIdx] = useState(1);

  const displayText = customText.trim() || 'HELLO WORLD';
  const flipSpeed = SPEED_OPTIONS[speedIdx].flipSpeed;

  // Inject styles once
  useEffect(() => {
    const id = 'solari-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = css;
      document.head.appendChild(style);
    }
    return () => document.getElementById(id)?.remove();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      gap: 40,
    }}>

      <SolariBoard text={displayText} cols={11} flipSpeed={flipSpeed} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%', maxWidth: 480 }}>

        <input
          type="text"
          value={customText}
          onChange={e => setCustomText(e.target.value.slice(0, 11))}
          placeholder="Type to override…"
          maxLength={11}
          style={{
            width: '100%',
            padding: '11px 16px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            color: '#fff',
            fontSize: 15,
            fontFamily: 'inherit',
            outline: 'none',
            textAlign: 'center',
            letterSpacing: '0.05em',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.3)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
        />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Flip speed
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {SPEED_OPTIONS.map((opt, i) => (
              <button
                key={opt.label}
                onClick={() => setSpeedIdx(i)}
                style={{
                  padding: '7px 16px',
                  background: speedIdx === i ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${speedIdx === i ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8,
                  color: speedIdx === i ? '#fff' : 'rgba(255,255,255,0.35)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
