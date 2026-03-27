import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import { CHARSET, SCRAMBLE_COLORS, FLIP_DURATION, SCRAMBLE_EMOJIS, isEmojiChar } from '../constants';

const Tile = forwardRef((props, ref) => {
  const elRef = useRef(null);
  const innerElRef = useRef(null);
  const frontElRef = useRef(null);
  const frontSpanRef = useRef(null);
  const currentCharRef = useRef(' ');
  const scrambleTimerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    setChar(char) {
      currentCharRef.current = char;
      if (frontSpanRef.current) {
        frontSpanRef.current.textContent = char === ' ' ? '' : char;
        frontSpanRef.current.classList.toggle('emoji-char', isEmojiChar(char));
      }
      if (frontElRef.current) {
        frontElRef.current.style.backgroundColor = '';
      }
    },

    scrambleTo(targetChar, delay) {
      if (targetChar === currentCharRef.current) return;

      if (scrambleTimerRef.current) {
        clearInterval(scrambleTimerRef.current);
        scrambleTimerRef.current = null;
      }

      const useEmojiScramble = isEmojiChar(targetChar) || isEmojiChar(currentCharRef.current);

      setTimeout(() => {
        elRef.current?.classList.add('scrambling');
        let scrambleCount = 0;
        const maxScrambles = 10 + Math.floor(Math.random() * 4);
        const scrambleInterval = 70;

        scrambleTimerRef.current = setInterval(() => {
          const randChar = useEmojiScramble
            ? SCRAMBLE_EMOJIS[Math.floor(Math.random() * SCRAMBLE_EMOJIS.length)]
            : CHARSET[Math.floor(Math.random() * CHARSET.length)];
          if (frontSpanRef.current) {
            frontSpanRef.current.textContent = randChar === ' ' ? '' : randChar;
            frontSpanRef.current.classList.toggle('emoji-char', isEmojiChar(randChar));
          }

          const color = SCRAMBLE_COLORS[scrambleCount % SCRAMBLE_COLORS.length];
          if (frontElRef.current) {
            frontElRef.current.style.backgroundColor = color;
          }

          if (frontSpanRef.current) {
            if (color === '#FFFFFF' || color === '#FFCC00') {
              frontSpanRef.current.style.color = '#111';
            } else {
              frontSpanRef.current.style.color = '';
            }
          }

          scrambleCount++;

          if (scrambleCount >= maxScrambles) {
            clearInterval(scrambleTimerRef.current);
            scrambleTimerRef.current = null;

            if (frontElRef.current) frontElRef.current.style.backgroundColor = '';
            if (frontSpanRef.current) {
              frontSpanRef.current.style.color = '';
              frontSpanRef.current.textContent = targetChar === ' ' ? '' : targetChar;
              frontSpanRef.current.classList.toggle('emoji-char', isEmojiChar(targetChar));
            }

            if (innerElRef.current) {
              innerElRef.current.style.transition = `transform ${FLIP_DURATION}ms ease-in-out`;
              innerElRef.current.style.transform = 'perspective(400px) rotateX(-8deg)';
            }

            setTimeout(() => {
              if (innerElRef.current) innerElRef.current.style.transform = '';
              setTimeout(() => {
                if (innerElRef.current) innerElRef.current.style.transition = '';
                elRef.current?.classList.remove('scrambling');
                currentCharRef.current = targetChar;
              }, FLIP_DURATION);
            }, FLIP_DURATION / 2);
          }
        }, scrambleInterval);
      }, delay);
    },
  }));

  return (
    <div className="tile" ref={elRef}>
      <div className="tile-inner" ref={innerElRef}>
        <div className="tile-front" ref={frontElRef}>
          <span ref={frontSpanRef}></span>
        </div>
        <div className="tile-back">
          <span></span>
        </div>
      </div>
    </div>
  );
});

Tile.displayName = 'Tile';
export default Tile;
