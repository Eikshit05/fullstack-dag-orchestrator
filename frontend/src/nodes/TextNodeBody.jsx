import { useEffect, useRef, useState } from 'react';
import { useUpdateNodeInternals } from 'reactflow';
import { useStore } from '../store';
import { parseVariables } from '../lib/parseVariables';

const MIN_W = 200, MAX_W = 420, MIN_H = 48, MAX_H = 260;
const DEBOUNCE_MS = 300;

export function TextNodeBody({ id, data }) {
  const updateNodeField = useStore((s) => s.updateNodeField);
  const syncNodeHandles = useStore((s) => s.syncNodeHandles);
  const updateNodeInternals = useUpdateNodeInternals();

  const [text, setText] = useState(data.text ?? '{{input}}');
  const [size, setSize] = useState({ w: MIN_W, h: MIN_H });

  const mirrorRef = useRef(null);
  const rafRef = useRef(null);
  const debounceRef = useRef(null);

  // Re-sync the editor when data.text changes from OUTSIDE (import/load). The
  // component is reused across imports (same node id), so useState's initializer
  // won't re-run; without this the textarea would show stale text. Our own typing
  // commits the same value to the store, so this is a no-op during editing.
  useEffect(() => {
    setText((current) => ((data.text ?? '') === current ? current : (data.text ?? '')));
  }, [data.text]);

  // Hidden-mirror measurement, coalesced to one update per animation frame.
  useEffect(() => {
    const el = mirrorRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.min(MAX_W, Math.max(MIN_W, Math.ceil(el.scrollWidth) + 24));
      const h = Math.min(MAX_H, Math.max(MIN_H, Math.ceil(el.scrollHeight) + 16));
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    const ro = new ResizeObserver(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    });
    ro.observe(el);
    measure();
    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text]);

  // Re-measure ReactFlow internals when the node size changes.
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, size.w, size.h, updateNodeInternals]);

  // Cancel a pending debounce if the node unmounts mid-typing.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // Debounced commit of text -> store, then prune orphaned variable edges.
  const onChange = (value) => {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNodeField(id, 'text', value);
      const vars = parseVariables(value);
      const valid = [`${id}-output`, ...vars.map((v) => `${id}-var-${v}`)];
      syncNodeHandles(id, valid);
    }, DEBOUNCE_MS);
  };

  return (
    <div style={{ width: size.w }}>
      <label className="vs-field">
        <span className="vs-field__label">Text</span>
        <textarea
          className="vs-field__control resize-none"
          style={{ height: size.h }}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <div
        ref={mirrorRef}
        aria-hidden
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          padding: '4px 8px',
          font: 'inherit',
          maxWidth: MAX_W,
          pointerEvents: 'none',
        }}
      >
        {text || ' '}
      </div>
    </div>
  );
}
