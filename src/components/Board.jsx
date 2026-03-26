import React, {
  forwardRef,
  useRef,
  useImperativeHandle,
  useCallback,
  useState,
  useMemo,
} from 'react';
import Tile from './Tile';
import {
  GRID_COLS,
  GRID_ROWS,
  STAGGER_DELAY,
  TOTAL_TRANSITION,
  ACCENT_COLORS,
} from '../constants';

const Board = forwardRef(({ soundEngine }, ref) => {
  const cols = GRID_COLS;
  const rows = GRID_ROWS;

  // 2D array of refs, one per tile
  const tileRefs = useMemo(() => {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => React.createRef())
    );
  }, [rows, cols]);

  const currentGridRef = useRef(
    Array.from({ length: rows }, () => Array(cols).fill(' '))
  );
  const isTransitioningRef = useRef(false);
  const accentIndexRef = useRef(0);
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS[0]);
  const [showOverlay, setShowOverlay] = useState(false);

  const formatToGrid = useCallback(
    (lines) => {
      return Array.from({ length: rows }, (_, r) => {
        const line = (lines[r] || '').toUpperCase();
        const padTotal = cols - line.length;
        const padLeft = Math.max(0, Math.floor(padTotal / 2));
        const padded =
          ' '.repeat(padLeft) +
          line +
          ' '.repeat(Math.max(0, cols - padLeft - line.length));
        return padded.split('');
      });
    },
    [rows, cols]
  );

  const displayMessage = useCallback(
    (lines) => {
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;

      const newGrid = formatToGrid(lines);
      let hasChanges = false;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const newChar = newGrid[r][c];
          const oldChar = currentGridRef.current[r][c];
          if (newChar !== oldChar) {
            const delay = (r * cols + c) * STAGGER_DELAY;
            tileRefs[r][c].current?.scrambleTo(newChar, delay);
            hasChanges = true;
          }
        }
      }

      if (hasChanges && soundEngine) {
        soundEngine.playTransition();
      }

      accentIndexRef.current++;
      setAccentColor(ACCENT_COLORS[accentIndexRef.current % ACCENT_COLORS.length]);

      currentGridRef.current = newGrid;

      setTimeout(() => {
        isTransitioningRef.current = false;
      }, TOTAL_TRANSITION + 200);
    },
    [formatToGrid, soundEngine, rows, cols, tileRefs]
  );

  useImperativeHandle(ref, () => ({
    displayMessage,
    get isTransitioning() {
      return isTransitioningRef.current;
    },
  }));

  return (
    <div
      className="board"
      style={{ '--grid-cols': cols, '--grid-rows': rows }}
    >
      {/* Tile grid */}
      <div className="tile-grid">
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => (
            <Tile key={`${r}-${c}`} ref={tileRefs[r][c]} />
          ))
        )}
      </div>

      {/* Keyboard hint */}
      <div
        className="keyboard-hint"
        title="Keyboard shortcuts"
        onClick={(e) => {
          e.stopPropagation();
          setShowOverlay((v) => !v);
        }}
      >
        N
      </div>

      {/* Shortcuts overlay */}
      <div className={`shortcuts-overlay${showOverlay ? ' visible' : ''}`}>
        <div><span>Custom message</span><kbd>Enter</kbd></div>
        <div><span>Next message</span><kbd>Space / →</kbd></div>
        <div><span>Previous</span><kbd>←</kbd></div>
        <div><span>Fullscreen</span><kbd>F</kbd></div>
        <div><span>Mute</span><kbd>M</kbd></div>
      </div>
    </div>
  );
});

Board.displayName = 'Board';
export default Board;
