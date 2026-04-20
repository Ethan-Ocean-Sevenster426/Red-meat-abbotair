import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Searchable dropdown filter for table column headers.
 * Renders its panel via a portal to avoid table overflow clipping.
 *
 * Props:
 *   col   — { key, label, opts? }  (opts = predefined option list)
 *   value — current filter value ('' = none, '__blank__' = blank filter)
 *   onChange(val) — called when user selects a value
 */
export default function ColFilterDropdown({ col, value, onChange }) {
  const [open, setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const [panelRect, setPanelRect] = useState(null);
  const btnRef = useRef(null);

  const isBlank = value === '__blank__';
  const displayLabel = isBlank ? '(Blank)' : (value || '');

  const openPanel = (e) => {
    e.stopPropagation();
    if (btnRef.current) {
      setPanelRect(btnRef.current.getBoundingClientRect());
    }
    setSearch('');
    setOpen(true);
  };

  const close = useCallback(() => {
    setOpen(false);
    setSearch('');
  }, []);

  const apply = (val) => {
    onChange(val);
    close();
  };

  // Build option list
  const opts = col.opts ? col.opts.filter(Boolean) : [];
  const filtered = search
    ? opts.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : opts;

  const itemStyle = (active) => ({
    padding: '5px 10px',
    fontSize: '0.73rem',
    cursor: 'pointer',
    color: active ? '#0078d4' : '#323130',
    background: active ? '#e8f4fd' : 'transparent',
    fontWeight: active ? 600 : 400,
  });

  const panel = open && panelRect ? createPortal(
    <>
      {/* Click-outside backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 8999 }}
        onClick={close}
      />
      {/* Dropdown panel */}
      <div
        style={{
          position: 'fixed',
          top: panelRect.bottom + 3,
          left: panelRect.left,
          minWidth: Math.max(panelRect.width, 170),
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
        {/* Search input */}
        <div style={{ padding: '5px 6px', borderBottom: '1px solid #edebe9' }}>
          <input
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid #c8c6c4', borderRadius: 3,
              padding: '3px 7px', fontSize: '0.72rem', outline: 'none',
              color: '#323130',
            }}
            placeholder={col.opts ? 'Search options…' : 'Type to filter…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') apply(col.opts ? search : (search || ''));
              if (e.key === 'Escape') close();
            }}
          />
        </div>

        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {/* (All) — clear filter */}
          <div
            style={itemStyle(!value)}
            onMouseEnter={e => { if (value) e.currentTarget.style.background = '#f3f2f1'; }}
            onMouseLeave={e => { if (value) e.currentTarget.style.background = 'transparent'; }}
            onClick={() => apply('')}
          >(All)</div>

          {/* (Blank) */}
          <div
            style={{ ...itemStyle(isBlank), fontStyle: 'italic' }}
            onMouseEnter={e => { if (!isBlank) e.currentTarget.style.background = '#f3f2f1'; }}
            onMouseLeave={e => { if (!isBlank) e.currentTarget.style.background = 'transparent'; }}
            onClick={() => apply(isBlank ? '' : '__blank__')}
          >(Blank)</div>

          {/* For text columns: "Search for X" row */}
          {!col.opts && search && (
            <div
              style={{
                padding: '5px 10px', fontSize: '0.73rem', cursor: 'pointer',
                background: '#f8f9fa', borderTop: '1px solid #edebe9', color: '#323130',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f3f2f1'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f8f9fa'; }}
              onClick={() => apply(search)}
            >
              Search: <strong>"{search}"</strong>
            </div>
          )}

          {/* If text column and there's a current non-blank value, show a "Clear 'X'" option */}
          {!col.opts && value && !isBlank && !search && (
            <div
              style={{
                padding: '5px 10px', fontSize: '0.73rem', cursor: 'pointer',
                background: '#e8f4fd', color: '#0078d4', borderTop: '1px solid #edebe9',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#d0e8f8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#e8f4fd'; }}
              onClick={() => apply('')}
            >
              Clear: <strong>"{value}"</strong>
            </div>
          )}

          {/* Predefined options */}
          {filtered.map(o => (
            <div
              key={o}
              style={itemStyle(value === o)}
              onMouseEnter={e => { if (value !== o) e.currentTarget.style.background = '#f3f2f1'; }}
              onMouseLeave={e => { if (value !== o) e.currentTarget.style.background = 'transparent'; }}
              onClick={() => apply(o)}
            >{o}</div>
          ))}

          {col.opts && filtered.length === 0 && search && (
            <div style={{ padding: '5px 10px', fontSize: '0.72rem', color: '#888', fontStyle: 'italic' }}>
              No matches
            </div>
          )}
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
        title={displayLabel ? `Filtered: ${displayLabel}` : 'Filter this column'}
        style={{
          width: '100%',
          background: value ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.14)',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: 3,
          cursor: 'pointer',
          padding: '2px 5px',
          color: value ? '#0050a0' : 'rgba(255,255,255,0.82)',
          fontSize: '0.63rem',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
          boxSizing: 'border-box',
          fontWeight: value ? 600 : 400,
          minWidth: 0,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {displayLabel || 'All'}
        </span>
        <span style={{ fontSize: '0.5rem', opacity: 0.65, flexShrink: 0 }}>▼</span>
      </button>
      {panel}
    </>
  );
}
