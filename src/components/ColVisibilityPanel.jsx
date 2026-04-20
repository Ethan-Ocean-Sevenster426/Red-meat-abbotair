import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Columns show/hide + drag-to-reorder panel.
 *
 * Props:
 *   columns      — array of { key, label }  (default order)
 *   hiddenCols   — Set of hidden column keys
 *   onToggle(key) — called when a column visibility is toggled
 *   columnOrder  — array of keys (current order) — optional
 *   onReorder(orderedKeys) — called when columns are reordered — optional
 */
export default function ColVisibilityPanel({ columns, hiddenCols, onToggle, columnOrder, onReorder }) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const [panelRect, setPanelRect] = useState(null);
  const btnRef = useRef(null);
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  const hiddenCount = hiddenCols.size;

  // Build ordered column list
  const orderedCols = (() => {
    if (!columnOrder || columnOrder.length === 0) return columns;
    const map = {};
    columns.forEach(c => { map[c.key] = c; });
    const ordered = columnOrder.map(k => map[k]).filter(Boolean);
    // Append any columns not in the order (new columns)
    columns.forEach(c => { if (!columnOrder.includes(c.key)) ordered.push(c); });
    return ordered;
  })();

  const openPanel = () => {
    if (btnRef.current) setPanelRect(btnRef.current.getBoundingClientRect());
    setSearch('');
    setOpen(true);
  };

  const close = () => { setOpen(false); setSearch(''); };

  const visible = search
    ? orderedCols.filter(c => c.label.toLowerCase().includes(search.toLowerCase()))
    : orderedCols;

  const handleDragStart = useCallback((idx) => { dragItem.current = idx; }, []);
  const handleDragEnter = useCallback((idx) => { dragOver.current = idx; }, []);
  const handleDragEnd = useCallback(() => {
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current || !onReorder) {
      dragItem.current = null;
      dragOver.current = null;
      return;
    }
    const items = [...orderedCols];
    const dragged = items.splice(dragItem.current, 1)[0];
    items.splice(dragOver.current, 0, dragged);
    dragItem.current = null;
    dragOver.current = null;
    onReorder(items.map(c => c.key));
  }, [orderedCols, onReorder]);

  const canReorder = !!onReorder && !search;

  const panel = open && panelRect ? createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 8999 }} onClick={close} />
      <div
        style={{
          position: 'fixed',
          top: panelRect.bottom + 3,
          right: window.innerWidth - panelRect.right,
          minWidth: 240,
          maxWidth: 300,
          zIndex: 9000,
          background: '#fff',
          border: '1px solid #d0d7de',
          borderRadius: 5,
          boxShadow: '0 6px 18px rgba(0,0,0,0.16)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '7px 10px 5px', borderBottom: '1px solid #edebe9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: '0.73rem', color: '#323130' }}>Columns</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {hiddenCount > 0 && (
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.68rem', color: '#0078d4', padding: 0 }}
                onClick={() => columns.forEach(c => { if (hiddenCols.has(c.key)) onToggle(c.key); })}
              >Show all</button>
            )}
            {onReorder && (
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.68rem', color: '#605e5c', padding: 0 }}
                onClick={() => onReorder(columns.map(c => c.key))}
              >Reset order</button>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '5px 8px', borderBottom: '1px solid #edebe9' }}>
          <input
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid #c8c6c4', borderRadius: 3,
              padding: '3px 7px', fontSize: '0.72rem', outline: 'none', color: '#323130',
            }}
            placeholder="Search columns…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') close(); }}
          />
        </div>

        {/* Hint */}
        {canReorder && !search && (
          <div style={{ padding: '4px 12px', fontSize: '0.62rem', color: '#8a8886', borderBottom: '1px solid #edebe9' }}>
            Drag to reorder columns
          </div>
        )}

        {/* Column list */}
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: '2px 0' }}>
          {visible.length === 0 && (
            <div style={{ padding: '6px 12px', fontSize: '0.72rem', color: '#888', fontStyle: 'italic' }}>No matches</div>
          )}
          {visible.map((col, idx) => {
            const isVisible = !hiddenCols.has(col.key);
            const globalIdx = orderedCols.indexOf(col);
            return (
              <div
                key={col.key}
                draggable={canReorder}
                onDragStart={() => handleDragStart(globalIdx)}
                onDragEnter={() => handleDragEnter(globalIdx)}
                onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 0,
                  padding: '4px 6px 4px 4px', cursor: canReorder ? 'grab' : 'pointer',
                  background: 'transparent',
                  transition: 'background 0.1s',
                  borderBottom: '1px solid transparent',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f3f2f1'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Drag handle */}
                {canReorder && (
                  <span style={{ color: '#c8c6c4', fontSize: '0.7rem', width: 16, textAlign: 'center', flexShrink: 0, cursor: 'grab' }}>⋮⋮</span>
                )}

                {/* Checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer', gap: 0 }}>
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 14, height: 14, flexShrink: 0,
                      border: `1.5px solid ${isVisible ? '#0078d4' : '#8a8886'}`,
                      borderRadius: 2,
                      background: isVisible ? '#0078d4' : '#fff',
                      marginRight: 8,
                      fontSize: '0.6rem',
                      color: '#fff',
                      transition: 'all 0.1s',
                    }}
                  >
                    {isVisible ? '✓' : ''}
                  </span>
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => onToggle(col.key)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#323130', userSelect: 'none', lineHeight: '1.4' }}>{col.label}</span>
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={openPanel}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: '#ffffff',
          border: '1px solid #8a8886',
          borderRadius: '2px',
          cursor: 'pointer',
          padding: '5px 12px',
          fontSize: '0.78rem',
          color: '#323130',
          fontWeight: 400,
          width: 'auto',
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: '0.78rem' }}>⊞</span>
        Columns
        {hiddenCount > 0 && (
          <span style={{
            background: '#0078d4', color: '#fff',
            borderRadius: 10, fontSize: '0.6rem',
            padding: '0 5px', lineHeight: '1.5',
            fontWeight: 700,
          }}>{hiddenCount}</span>
        )}
        <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>▼</span>
      </button>
      {panel}
    </>
  );
}
