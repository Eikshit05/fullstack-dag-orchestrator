import { useEffect, useMemo } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { useStore } from '../store';
import { FIELD_COMPONENTS } from './fields';

const POSITION_MAP = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

const ACCENT = {
  io: 'border-accent-io',
  ai: 'border-accent-ai',
  logic: 'border-accent-logic',
  text: 'border-accent-text',
};

const resolve = (value, data) =>
  typeof value === 'function' ? value(data) : value || [];

export function BaseNode({ id, data, config }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const updateNodeField = useStore((s) => s.updateNodeField);

  const fields = useMemo(() => resolve(config.fields, data), [config, data]);
  const handles = useMemo(() => resolve(config.handles, data), [config, data]);

  // Primitive key — never an array reference (prevents infinite re-render loop).
  const handleKey = handles
    .map((h) => `${h.type}:${h.position}:${h.id}`)
    .join('|');

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, handleKey, updateNodeInternals]);

  // Group handles per side so multiples distribute evenly.
  const grouped = handles.reduce((acc, h) => {
    (acc[h.position] = acc[h.position] || []).push(h);
    return acc;
  }, {});

  const accent = ACCENT[config.category] || 'border-accent-neutral';

  return (
    <div className={`vs-node ${accent}`}>
      <div className="vs-node__header">{config.title}</div>
      <div className="vs-node__body">
        {config.render
          ? config.render({ id, data, updateNodeField })
          : fields.map((f) => {
              const Field = FIELD_COMPONENTS[f.kind];
              if (!Field) return null;
              // `default` may be a function of the node id (e.g. derive "input_1").
              const fallback = typeof f.default === 'function' ? f.default(id) : f.default;
              return (
                <Field
                  key={f.name}
                  field={f}
                  value={data[f.name] ?? fallback ?? ''}
                  onChange={(v) => updateNodeField(id, f.name, v)}
                />
              );
            })}
      </div>
      {Object.entries(grouped).map(([side, list]) =>
        list.map((h, i) => (
          <Handle
            key={h.id}
            type={h.type}
            position={POSITION_MAP[side]}
            id={`${id}-${h.id}`}
            style={{ top: `${((i + 1) * 100) / (list.length + 1)}%` }}
          />
        ))
      )}
    </div>
  );
}
