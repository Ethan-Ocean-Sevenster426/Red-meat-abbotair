import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts) {
  if (!ts) return '';
  // Backend sends Unix timestamp in seconds (st_mtime), convert to milliseconds
  const d = new Date(ts * 1000);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function collectFiles(node) {
  if (node.type === 'file') return [node];
  return (node.children || []).flatMap(collectFiles);
}

function FolderTree({ nodes, selectedPath, onSelect, depth = 0 }) {
  const defaultOpen = depth < 2;
  const [open, setOpen] = useState(() => {
    const init = {};
    nodes.forEach(n => { if (n.type !== 'file') init[n.path] = defaultOpen; });
    return init;
  });

  const toggle = (p) => setOpen(prev => ({ ...prev, [p]: !prev[p] }));
  const icons  = ['📍', '🏭', '📂'];

  return (
    <div>
      {nodes.map(node => {
        if (node.type === 'file') return null;
        const isOpen   = open[node.path] ?? defaultOpen;
        const isActive = selectedPath === node.path;
        const fileCount = collectFiles(node).length;
        const icon = icons[depth] ?? '📂';

        return (
          <div key={node.path}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 12px 7px ' + (12 + depth * 18) + 'px',
                cursor: 'pointer', userSelect: 'none',
                background: isActive ? '#deecf9' : 'transparent',
                borderLeft: isActive ? '3px solid #0078d4' : '3px solid transparent',
                transition: 'background 0.1s',
              }}
              onClick={() => { onSelect(node.path); toggle(node.path); }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f3f2f1'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '0.58rem', color: '#a19f9d', width: '10px', flexShrink: 0 }}>
                {isOpen ? '▾' : '▸'}
              </span>
              <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: '0.82rem', color: isActive ? '#0078d4' : '#323130', fontWeight: isActive ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {node.name}
              </span>
              {fileCount > 0 && (
                <span style={{ background: isActive ? '#0078d4' : '#edebe9', color: isActive ? '#fff' : '#605e5c', borderRadius: '10px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: 600, flexShrink: 0 }}>
                  {fileCount}
                </span>
              )}
            </div>
            {isOpen && node.children && (
              <FolderTree nodes={node.children} selectedPath={selectedPath} onSelect={onSelect} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DocumentLibrary() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tree, setTree]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedPath, setSelectedPath] = useState(null);
  const [downloading, setDownloading]   = useState({});
  const [deleting, setDeleting]         = useState({});
  const [viewingFile, setViewingFile]   = useState(null);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const loadTree = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/documents/tree');
      const data = await res.json();
      setTree(data.tree || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadTree(); }, []);

  function findNode(nodes, targetPath) {
    for (const n of nodes) {
      if (n.path === targetPath) return n;
      if (n.children) {
        const found = findNode(n.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  }

  const selectedNode = selectedPath ? findNode(tree, selectedPath) : null;
  // Only show direct children (files + sub-folders), not recursively flattened
  const displayFiles = selectedNode ? (selectedNode.children || []).filter(c => c.type === 'file') : [];
  const displayFolders = selectedNode ? (selectedNode.children || []).filter(c => c.type === 'folder') : [];
  const totalFiles   = tree.flatMap(collectFiles).length;

  const handleDelete = async (file) => {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    setDeleting(prev => ({ ...prev, [file.path]: true }));
    try {
      const res = await fetch(`/api/documents/delete?p=${encodeURIComponent(file.path)}`, { method: 'DELETE' });
      if (res.ok) await loadTree();
    } catch {}
    setDeleting(prev => { const n = { ...prev }; delete n[file.path]; return n; });
  };

  // Build breadcrumb from selected path
  const breadcrumb = selectedPath ? selectedPath.split('/') : [];

  const handleDownload = async (file) => {
    setDownloading(prev => ({ ...prev, [file.path]: true }));
    try {
      const res  = await fetch(`/api/documents/download?p=${encodeURIComponent(file.path)}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setDownloading(prev => { const n = { ...prev }; delete n[file.path]; return n; });
  };

  return (
    <div style={s.page}>

      {/* Header */}
      <header style={s.header}>
        <div style={s.topBarLeft}>
          <button onClick={() => navigate('/dashboard')} style={s.backBtn}>←</button>
          <div style={s.waffle}><span style={s.waffleIcon}>⋮⋮⋮</span></div>
          <span style={s.siteLabel}>Red Meat Abattoir Association</span>
        </div>
        <div style={s.topBarCenter}>
          <span style={s.pageTitle}>Document Library</span>
        </div>
        <div style={s.topBarRight}>
          <span style={s.userName}>{user?.displayName || user?.username}</span>
          <div style={s.avatar} title={user?.displayName || user?.username}>
            {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
          </div>
          <button onClick={handleLogout} style={s.signOutBtn}>Sign out</button>
        </div>
      </header>

      {/* Body */}
      <div style={s.body}>

        {/* Sidebar */}
        <div style={s.sidebar}>
          <div style={s.sidebarHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem' }}>📁</span>
              <span style={s.sidebarTitle}>Folders</span>
            </div>
            <span style={s.sidebarBadge}>{totalFiles} file{totalFiles !== 1 ? 's' : ''}</span>
          </div>

          <div style={s.treeScroll}>
            {loading ? (
              <div style={s.treeEmpty}>Loading…</div>
            ) : tree.length === 0 ? (
              <div style={s.treeEmpty}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🗂️</div>
                <div>No documents yet.</div>
                <div style={{ fontSize: '0.72rem', marginTop: '4px', color: '#c8c6c4' }}>Files will appear here after committing an import.</div>
              </div>
            ) : (
              <FolderTree nodes={tree} selectedPath={selectedPath} onSelect={setSelectedPath} />
            )}
          </div>

          <div style={s.sidebarFooter}>
            <button onClick={loadTree} style={s.refreshBtn}>↺ Refresh</button>
          </div>
        </div>

        {/* Main panel */}
        <div style={s.main}>
          {!selectedPath ? (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>📂</div>
              <div style={s.emptyTitle}>Select a folder</div>
              <div style={s.emptySub}>Choose a province, abattoir, or document folder on the left to view its files.</div>
            </div>
          ) : displayFolders.length === 0 && displayFiles.length === 0 ? (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>🗂️</div>
              <div style={s.emptyTitle}>No files here</div>
              <div style={s.emptySub}>This folder is empty.</div>
            </div>
          ) : (
            <div style={s.mainInner}>
              {/* Breadcrumb */}
              <div style={s.breadcrumb}>
                {breadcrumb.map((seg, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {i > 0 && <span style={{ color: '#c8c6c4' }}>›</span>}
                    <span style={{ color: i === breadcrumb.length - 1 ? '#323130' : '#0078d4', fontWeight: i === breadcrumb.length - 1 ? 600 : 400, fontSize: '0.82rem' }}>
                      {seg}
                    </span>
                  </span>
                ))}
              </div>

              {/* File count */}
              <div style={s.fileCountRow}>
                <span style={s.fileCountLabel}>
                  {displayFolders.length > 0 && `${displayFolders.length} folder${displayFolders.length !== 1 ? 's' : ''}`}
                  {displayFolders.length > 0 && displayFiles.length > 0 && ', '}
                  {displayFiles.length > 0 && `${displayFiles.length} document${displayFiles.length !== 1 ? 's' : ''}`}
                </span>
              </div>

              {/* Sub-folders */}
              {displayFolders.length > 0 && (
                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead><tr><th style={s.th}>Folder</th><th style={{ ...s.th, width: '100px' }}>Files</th></tr></thead>
                    <tbody>
                      {displayFolders.map((folder, i) => {
                        const fileCount = collectFiles(folder).length;
                        return (
                          <tr key={folder.path} style={{ background: i % 2 === 0 ? '#ffffff' : '#faf9f8', cursor: 'pointer' }}
                            onClick={() => setSelectedPath(folder.path)}
                            onMouseEnter={e => { e.currentTarget.style.background = '#deecf9'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? '#ffffff' : '#faf9f8'; }}>
                            <td style={s.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '1.2rem' }}>📂</span>
                                <span style={{ fontSize: '0.85rem', color: '#0078d4', fontWeight: 600 }}>{folder.name}</span>
                              </div>
                            </td>
                            <td style={{ ...s.td, color: '#605e5c', fontSize: '0.78rem' }}>{fileCount} file{fileCount !== 1 ? 's' : ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Files */}
              {displayFiles.length > 0 && (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>File Name</th>
                      <th style={{ ...s.th, width: '90px' }}>Size</th>
                      <th style={{ ...s.th, width: '120px' }}>Date Saved</th>
                      <th style={{ ...s.th, width: '200px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayFiles.map((file, i) => {
                      const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
                      return (
                      <tr key={file.path} style={{ background: i % 2 === 0 ? '#ffffff' : '#faf9f8' }}>
                        <td style={s.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>{isXlsx ? '📊' : '📄'}</span>
                            <span style={{ fontSize: '0.85rem', color: '#323130', fontWeight: 500 }}>{file.name}</span>
                          </div>
                        </td>
                        <td style={{ ...s.td, color: '#605e5c', fontSize: '0.78rem' }}>{formatSize(file.size)}</td>
                        <td style={{ ...s.td, color: '#605e5c', fontSize: '0.78rem' }}>{formatDate(file.modified)}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            {!isXlsx && (
                            <button style={s.viewBtn} onClick={() => setViewingFile(file)}>
                              👁 View
                            </button>
                            )}
                            <button
                              style={{ ...s.downloadBtn, ...(downloading[file.path] ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                              onClick={() => handleDownload(file)}
                              disabled={!!downloading[file.path]}
                            >
                              {downloading[file.path] ? '⏳' : '⬇ Download'}
                            </button>
                            {user?.role === 'admin' && (
                              <button
                                style={{ ...s.deleteBtn, ...(deleting[file.path] ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                                onClick={() => handleDelete(file)}
                                disabled={!!deleting[file.path]}
                              >
                                {deleting[file.path] ? '⏳' : '🗑 Delete'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer style={s.footer} />

      {/* PDF Viewer Modal */}
      {viewingFile && (
        <div style={s.modalOverlay} onClick={() => setViewingFile(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.1rem' }}>📄</span>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>{viewingFile.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button style={s.modalDownloadBtn} onClick={() => handleDownload(viewingFile)}>⬇ Download</button>
                <button style={s.modalCloseBtn} onClick={() => setViewingFile(null)}>✕</button>
              </div>
            </div>
            <iframe
              src={`/api/documents/view?p=${encodeURIComponent(viewingFile.path)}`}
              style={s.pdfFrame}
              title={viewingFile.name}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const HEADER_H = '48px';
const FOOTER_H = '40px';

const s = {
  page:         { height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: '#f3f2f1', overflow: 'hidden' },
  header:       { background: '#0078d4', height: HEADER_H, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0, zIndex: 100 },
  topBarLeft:   { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '260px', flexShrink: 0 },
  backBtn:      { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '2px', padding: '0 10px', cursor: 'pointer', fontSize: '0.9rem', width: 'auto', height: '28px', display: 'flex', alignItems: 'center', lineHeight: 1, flexShrink: 0 },
  waffle:       { width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  waffleIcon:   { color: '#fff', fontSize: '1.1rem', letterSpacing: '-1px' },
  siteLabel:    { color: '#fff', fontSize: '0.95rem', fontWeight: 600, whiteSpace: 'nowrap' },
  topBarCenter: { flex: 1, display: 'flex', justifyContent: 'center' },
  pageTitle:    { color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', fontWeight: 400 },
  topBarRight:  { display: 'flex', alignItems: 'center', gap: '10px', minWidth: '260px', justifyContent: 'flex-end' },
  userName:     { color: '#fff', fontSize: '0.85rem' },
  avatar:       { width: '32px', height: '32px', borderRadius: '50%', background: '#005a9e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.88rem', border: '2px solid rgba(255,255,255,0.4)' },
  signOutBtn:   { background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', padding: '4px 12px', borderRadius: '2px', fontSize: '0.82rem', cursor: 'pointer', width: 'auto', margin: 0 },

  body:         { display: 'flex', flex: 1, overflow: 'hidden' },

  sidebar:      { width: '280px', background: '#fff', borderRight: '1px solid #edebe9', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  sidebarHeader:{ padding: '14px 16px', borderBottom: '1px solid #edebe9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  sidebarTitle: { fontWeight: 600, fontSize: '0.88rem', color: '#323130' },
  sidebarBadge: { background: '#f3f2f1', border: '1px solid #edebe9', color: '#605e5c', borderRadius: '10px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600 },
  treeScroll:   { flex: 1, overflowY: 'auto', padding: '4px 0' },
  treeEmpty:    { padding: '40px 16px', color: '#a19f9d', fontSize: '0.82rem', textAlign: 'center' },
  sidebarFooter:{ borderTop: '1px solid #edebe9', padding: '10px 12px', flexShrink: 0 },
  refreshBtn:   { width: '100%', background: '#fff', border: '1px solid #edebe9', color: '#605e5c', borderRadius: '2px', padding: '7px', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'center' },

  main:         { flex: 1, overflowY: 'auto', background: '#f3f2f1', display: 'flex', flexDirection: 'column' },
  mainInner:    { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' },
  breadcrumb:   { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' },
  fileCountRow: { display: 'flex', alignItems: 'center' },
  fileCountLabel:{ fontSize: '0.78rem', color: '#a19f9d' },

  tableWrap:    { background: '#fff', borderRadius: '2px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden', border: '1px solid #edebe9' },
  table:        { borderCollapse: 'collapse', width: '100%' },
  th:           { background: '#0078d4', color: '#fff', padding: '10px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' },
  td:           { padding: '11px 16px', borderBottom: '1px solid #edebe9', verticalAlign: 'middle' },
  viewBtn:      { background: '#fff', border: '1px solid #0078d4', color: '#0078d4', padding: '6px 12px', borderRadius: '2px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, width: 'auto', whiteSpace: 'nowrap' },
  downloadBtn:  { background: '#0078d4', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '2px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, width: 'auto', whiteSpace: 'nowrap' },
  deleteBtn:    { background: '#fff', border: '1px solid #d13438', color: '#d13438', padding: '6px 12px', borderRadius: '2px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, width: 'auto', whiteSpace: 'nowrap' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalBox:     { width: '90vw', height: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '2px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden' },
  modalHeader:  { background: '#0078d4', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  modalDownloadBtn: { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', padding: '5px 12px', borderRadius: '2px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, width: 'auto' },
  modalCloseBtn:{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', padding: '4px 8px', width: 'auto', lineHeight: 1 },
  pdfFrame:     { flex: 1, border: 'none', width: '100%' },

  emptyState:   { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#a19f9d', textAlign: 'center', gap: '10px', padding: '40px' },
  emptyIcon:    { fontSize: '3.5rem' },
  emptyTitle:   { fontSize: '1rem', fontWeight: 600, color: '#605e5c' },
  emptySub:     { fontSize: '0.82rem', maxWidth: '320px', lineHeight: 1.5 },

  footer:       { background: '#0078d4', height: FOOTER_H, flexShrink: 0 },
};
