import { useEffect, useRef, useState } from 'react';

const MS_PER_CHAR = 22; // ~45 characters/second - rapid, JRPG-style

/**
 * Reveals `text` one character at a time. Resets and retypes whenever `text`
 * changes, so a caller can just swap the line and this follows along.
 */
export const useTypewriter = (text) => {
  const [length, setLength] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    setLength(0);
    if (text.length === 0) return undefined;

    intervalRef.current = setInterval(() => {
      setLength((current) => {
        const next = Math.min(current + 1, text.length);
        if (next >= text.length) clearInterval(intervalRef.current);
        return next;
      });
    }, MS_PER_CHAR);

    return () => clearInterval(intervalRef.current);
  }, [text]);

  const finish = () => {
    clearInterval(intervalRef.current);
    setLength(text.length);
  };

  return { shown: text.slice(0, length), done: length >= text.length, finish };
};
