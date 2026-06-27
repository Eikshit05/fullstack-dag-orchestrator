// KeyboardShortcuts.jsx
// Canvas-level Cmd/Ctrl+C / +V for copy & paste of the node selection. Renders
// nothing — it just owns one document-level keydown listener.
//
// Focus guard: if the user is typing in an input/textarea/select/contentEditable
// (a Text node body, a field, or the command-palette input), we bail and let the
// browser's native copy/paste run instead of hijacking it onto the canvas.

import { useEffect } from 'react';
import { useStore } from '../store';

const isEditingField = () => {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable === true
  );
};

export function KeyboardShortcuts() {
  const copySelection = useStore((s) => s.copySelection);
  const pasteClipboard = useStore((s) => s.pasteClipboard);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key !== 'c' && key !== 'v') return;
      if (isEditingField()) return; // let native text copy/paste happen
      if (key === 'c') copySelection();
      else pasteClipboard();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [copySelection, pasteClipboard]);

  return null;
}
