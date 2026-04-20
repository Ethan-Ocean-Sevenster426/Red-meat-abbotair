import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const PAGES = [
  {
    key: 'training_report', label: 'Training Report', hasEdit: false,
    children: [
      { key: 'stt_training',     label: 'STT Training Report',    hasEdit: true },
      { key: 'formal_training',  label: 'Formal Training Report', hasEdit: true },
    ],
  },
  {
    key: 'master_database', label: 'Red Meat Industry Database', hasEdit: false,
    children: [
      { key: 'registered_abattoirs', label: 'Registered Abattoirs',  hasEdit: true },
      { key: 'transformation',       label: 'Transformation',         hasEdit: true },
      { key: 'government',           label: 'Government',             hasEdit: true },
      { key: 'industry',             label: 'Industry',               hasEdit: true },
      { key: 'associated_members',   label: 'Associated Members',     hasEdit: true },
    ],
  },
  { key: 'residue_monitoring',  label: 'Residue Monitoring',                hasEdit: true },
  { key: 'arms_dashboard',      label: 'ARMS Dashboard',                    hasEdit: false },
  { key: 'feedlot_residue',     label: 'Feedlot Residue Monitoring',        hasEdit: true },
  { key: 'quotation_system',    label: 'Finances',                           hasEdit: true },
  { key: 'document_library',    label: 'Document Library',                  hasEdit: false },
];

// Flat list of all permission keys (parents + children) for initialisation
const ALL_PERM_KEYS = PAGES.flatMap(p => p.children ? [p, ...p.children] : [p]);

function avatarColor(str) {
  const colors = ['#0078d4', '#107c10', '#8764b8', '#c7792a', '#038387', '#d13438'];
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function UserManagement() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [selectedId, setSelectedId]     = useState(null);
  const [permissionsState, setPermissionsState] = useState({});
  const [saveStatus, setSaveStatus]     = useState({});
  const [roleLoading, setRoleLoading]   = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Invite modal
  const [showInviteModal, setShowInviteModal]     = useState(false);
  const [inviteEmail, setInviteEmail]             = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviteLoading, setInviteLoading]         = useState(false);
  const [inviteResult, setInviteResult]           = useState(null);
  const [copiedLink, setCopiedLink]               = useState(false);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = data.users || [];
      setUsers(list);
      const perms = {};
      for (const u of list) {
        let parsed = {};
        if (u.permissions) { try { parsed = JSON.parse(u.permissions); } catch { parsed = {}; } }
        const pagesPerms = {};
        for (const page of ALL_PERM_KEYS) {
          pagesPerms[page.key] = { view: parsed[page.key]?.view ?? false, edit: parsed[page.key]?.edit ?? false };
        }
        perms[u.id] = pagesPerms;
      }
      setPermissionsState(perms);
    } catch (err) {
      setError('Failed to load users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const selectedUser = users.find(u => u.id === selectedId) || null;

  const handlePermissionChange = (userId, pageKey, field, value) => {
    setPermissionsState(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [pageKey]: {
          ...prev[userId]?.[pageKey],
          [field]: value,
          ...(field === 'view' && !value ? { edit: false } : {}),
        },
      },
    }));
    setSaveStatus(prev => ({ ...prev, [userId]: 'idle' }));
  };

  const handleSavePermissions = async (userId) => {
    setSaveStatus(prev => ({ ...prev, [userId]: 'saving' }));
    try {
      const res = await fetch(`/api/users/${userId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: permissionsState[userId] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveStatus(prev => ({ ...prev, [userId]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [userId]: 'idle' })), 2500);
    } catch {
      setSaveStatus(prev => ({ ...prev, [userId]: 'error' }));
    }
  };

  const handleRoleToggle = async (targetUser) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    setRoleLoading(true);
    try {
      const res = await fetch(`/api/users/${targetUser.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u));
    } catch (err) {
      alert('Failed to update role: ' + err.message);
    } finally {
      setRoleLoading(false);
    }
  };

  const handleDelete = async (targetUser) => {
    if (!window.confirm(`Delete "${targetUser.displayName || targetUser.email}"? This cannot be undone.`)) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/users/${targetUser.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUsers(prev => prev.filter(u => u.id !== targetUser.id));
      setSelectedId(null);
    } catch (err) {
      alert('Failed to delete user: ' + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteResult(null);
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          displayName: inviteDisplayName.trim(),
          invitedBy: user?.displayName || user?.username || 'Admin',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteResult({ error: data.message || 'Invite failed.' });
      } else {
        setInviteResult({ inviteUrl: data.inviteUrl, emailSent: data.emailSent });
        fetchUsers();
      }
    } catch (err) {
      setInviteResult({ error: 'Network error: ' + err.message });
    } finally {
      setInviteLoading(false);
    }
  };

  const openInviteModal = () => {
    setInviteEmail(''); setInviteDisplayName(''); setInviteResult(null); setCopiedLink(false);
    setShowInviteModal(true);
  };
  const closeInviteModal = () => { setShowInviteModal(false); setInviteResult(null); };
  const copyInviteLink = () => {
    if (inviteResult?.inviteUrl) {
      navigator.clipboard.writeText(inviteResult.inviteUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

  const isPending = (u) => !u.password || u.password === '';

  const adminCount = users.filter(u => u.role === 'admin').length;
  const userCount  = users.filter(u => u.role === 'user').length;

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <header style={s.topBar}>
        <div style={s.topBarLeft}>
          <button style={s.backBtn} onClick={() => navigate('/dashboard')}>←</button>
          <div style={s.waffle}><span style={s.waffleIcon}>⋮⋮⋮</span></div>
          <span style={s.siteLabel}>Red Meat Abattoir Association</span>
        </div>
        <div style={s.topBarCenter}>
          <span style={s.pageTitle}>User Management</span>
        </div>
        <div style={s.topBarRight}>
          <span style={s.userName}>{user?.displayName || user?.username}</span>
          <div style={s.avatar} title={user?.displayName || user?.username}>
            {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
          </div>
          <button onClick={handleLogout} style={s.signOutBtn}>Sign out</button>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div style={s.toolbar}>
        <div style={s.toolbarInner}>
          <div style={s.toolbarStats}>
            <span style={s.statChip}><span style={{ ...s.statDot, background: '#0078d4' }} />{adminCount} Super Admin{adminCount !== 1 ? 's' : ''}</span>
            <span style={s.statChip}><span style={{ ...s.statDot, background: '#8a8886' }} />{userCount} Standard User{userCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={s.body}>
        {loading && <div style={s.loadingMsg}>Loading users...</div>}
        {error   && <div style={s.errorBanner}>{error}</div>}

        {!loading && !error && (
          <div style={s.panels}>
            {/* ── Left: User List ── */}
            <div style={s.listPanel}>
              <div style={s.listHeader}>Users ({users.length})</div>
              <button style={s.inviteBtn} onClick={openInviteModal}>+ Invite User</button>
              {users.map(u => {
                const initials = (u.displayName || u.email || 'U')[0].toUpperCase();
                const isSelected = u.id === selectedId;
                return (
                  <div
                    key={u.id}
                    style={{ ...s.listRow, ...(isSelected ? s.listRowActive : {}) }}
                    onClick={() => setSelectedId(u.id)}
                  >
                    <div style={{ ...s.listAvatar, background: avatarColor(u.displayName || u.email) }}>
                      {initials}
                    </div>
                    <div style={s.listInfo}>
                      <div style={s.listName}>
                        {u.displayName || u.email}
                        {isPending(u) && <span style={s.pendingDot} title="Invite not accepted yet" />}
                      </div>
                      <div style={s.listEmail}>{u.email}</div>
                    </div>
                    <span style={u.role === 'admin' ? s.badgeAdmin : s.badgeUser}>
                      {u.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── Right: Detail Panel ── */}
            <div style={s.detailPanel}>
              {!selectedUser ? (
                <div style={s.emptyState}>
                  <div style={s.emptyIcon}>👤</div>
                  <div style={s.emptyTitle}>Select a user</div>
                  <div style={s.emptySub}>Choose a user from the list to view and manage their permissions.</div>
                </div>
              ) : (
                <div style={s.detailContent}>
                  {/* User info header */}
                  <div style={s.detailHeader}>
                    <div style={{ ...s.detailAvatar, background: avatarColor(selectedUser.displayName || selectedUser.email) }}>
                      {(selectedUser.displayName || selectedUser.email || 'U')[0].toUpperCase()}
                    </div>
                    <div style={s.detailInfo}>
                      <div style={s.detailName}>
                        {selectedUser.displayName || selectedUser.email}
                        {isPending(selectedUser) && <span style={s.pendingBadge}>Pending</span>}
                      </div>
                      <div style={s.detailEmail}>{selectedUser.email}</div>
                      <div style={s.detailMeta}>
                        <span style={selectedUser.role === 'admin' ? s.badgeAdmin : s.badgeUser}>
                          {selectedUser.role === 'admin' ? 'Super Admin' : 'Standard User'}
                        </span>
                        {isPending(selectedUser) && (
                          <span style={s.detailMetaText}>Invite not yet accepted</span>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={s.detailActions}>
                      <button
                        style={s.actionBtn}
                        onClick={() => handleRoleToggle(selectedUser)}
                        disabled={selectedUser.id === user?.id || roleLoading}
                        title={selectedUser.id === user?.id ? 'Cannot change your own role' : ''}
                      >
                        {roleLoading ? '...' : selectedUser.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                      </button>
                      <button
                        style={{ ...s.actionBtn, ...s.deleteBtnStyle }}
                        onClick={() => handleDelete(selectedUser)}
                        disabled={selectedUser.id === user?.id || deleteLoading}
                        title={selectedUser.id === user?.id ? 'Cannot delete yourself' : 'Delete user'}
                      >
                        {deleteLoading ? '...' : 'Delete'}
                      </button>
                    </div>
                  </div>

                  <div style={s.divider} />

                  {/* Permissions */}
                  {selectedUser.role === 'admin' ? (
                    <div style={s.adminNote}>
                      <div style={s.adminNoteIcon}>🔐</div>
                      <div>
                        <div style={s.adminNoteTitle}>Full Access</div>
                        <div style={s.adminNoteSub}>Super Admins have unrestricted access to all pages and features. Permissions are not applicable.</div>
                      </div>
                    </div>
                  ) : (
                    <div style={s.permSection}>
                      <div style={s.permHeader}>
                        <div>
                          <div style={s.permTitle}>Page Permissions</div>
                          <div style={s.permSub}>Control which pages this user can view or edit.</div>
                        </div>
                        <div style={s.permSaveRow}>
                          <button
                            style={{ ...s.saveBtn, ...(saveStatus[selectedUser.id] === 'saving' ? { opacity: 0.7 } : {}) }}
                            onClick={() => handleSavePermissions(selectedUser.id)}
                            disabled={saveStatus[selectedUser.id] === 'saving'}
                          >
                            {saveStatus[selectedUser.id] === 'saving' ? 'Saving…' : 'Save Changes'}
                          </button>
                          {saveStatus[selectedUser.id] === 'saved' && <span style={s.savedText}>✓ Saved</span>}
                          {saveStatus[selectedUser.id] === 'error'  && <span style={s.errorText}>Save failed</span>}
                        </div>
                      </div>

                      <div style={s.permGrid}>
                        {/* Column headers */}
                        <div style={s.permGridHeader}>
                          <div style={s.colPage}>Page</div>
                          <div style={s.colToggle}>View</div>
                          <div style={s.colToggle}>Edit</div>
                        </div>
                        {/* Rows */}
                        {PAGES.map((page, idx) => {
                          const perms = permissionsState[selectedUser.id]?.[page.key] || { view: false, edit: false };
                          const parentView = perms.view;
                          return (
                            <div key={page.key}>
                              {/* Parent row */}
                              <div style={{ ...s.permGridRow, background: idx % 2 === 0 ? '#ffffff' : '#f9f8f7' }}>
                                <div style={s.colPage}>
                                  <span style={s.pageName}>{page.label}</span>
                                  {!page.hasEdit && !page.children && <span style={s.noEditNote}>view only</span>}
                                  {page.children && <span style={s.noEditNote}>section</span>}
                                </div>
                                <div style={s.colToggle}>
                                  <label style={s.toggleWrap}>
                                    <input type="checkbox" checked={perms.view} onChange={e => handlePermissionChange(selectedUser.id, page.key, 'view', e.target.checked)} style={s.hiddenCheck} />
                                    <span style={{ ...s.toggle, ...(perms.view ? s.toggleOn : s.toggleOff) }}>
                                      <span style={{ ...s.toggleThumb, ...(perms.view ? s.toggleThumbOn : {}) }} />
                                    </span>
                                  </label>
                                </div>
                                <div style={s.colToggle}>
                                  {page.hasEdit ? (
                                    <label style={{ ...s.toggleWrap, ...(!perms.view ? { opacity: 0.4, pointerEvents: 'none' } : {}) }}>
                                      <input type="checkbox" checked={perms.edit} disabled={!perms.view} onChange={e => handlePermissionChange(selectedUser.id, page.key, 'edit', e.target.checked)} style={s.hiddenCheck} />
                                      <span style={{ ...s.toggle, ...(perms.edit ? s.toggleOn : s.toggleOff) }}>
                                        <span style={{ ...s.toggleThumb, ...(perms.edit ? s.toggleThumbOn : {}) }} />
                                      </span>
                                    </label>
                                  ) : (
                                    <span style={s.naText}>—</span>
                                  )}
                                </div>
                              </div>
                              {/* Sub-page rows */}
                              {page.children && page.children.map((child, ci) => {
                                const cp = permissionsState[selectedUser.id]?.[child.key] || { view: false, edit: false };
                                const disabled = !parentView;
                                return (
                                  <div key={child.key} style={{ ...s.permGridRow, ...s.subRow, background: ci % 2 === 0 ? '#f9f8f7' : '#f3f2f1', opacity: disabled ? 0.5 : 1 }}>
                                    <div style={s.colPage}>
                                      <span style={s.subIndent}>↳</span>
                                      <span style={s.subPageName}>{child.label}</span>
                                    </div>
                                    <div style={s.colToggle}>
                                      <label style={{ ...s.toggleWrap, ...(disabled ? { pointerEvents: 'none' } : {}) }}>
                                        <input type="checkbox" checked={cp.view} disabled={disabled} onChange={e => handlePermissionChange(selectedUser.id, child.key, 'view', e.target.checked)} style={s.hiddenCheck} />
                                        <span style={{ ...s.toggle, ...(cp.view && !disabled ? s.toggleOn : s.toggleOff) }}>
                                          <span style={{ ...s.toggleThumb, ...(cp.view && !disabled ? s.toggleThumbOn : {}) }} />
                                        </span>
                                      </label>
                                    </div>
                                    <div style={s.colToggle}>
                                      <label style={{ ...s.toggleWrap, ...(!cp.view || disabled ? { opacity: 0.4, pointerEvents: 'none' } : {}) }}>
                                        <input type="checkbox" checked={cp.edit} disabled={!cp.view || disabled} onChange={e => handlePermissionChange(selectedUser.id, child.key, 'edit', e.target.checked)} style={s.hiddenCheck} />
                                        <span style={{ ...s.toggle, ...(cp.edit && cp.view && !disabled ? s.toggleOn : s.toggleOff) }}>
                                          <span style={{ ...s.toggleThumb, ...(cp.edit && cp.view && !disabled ? s.toggleThumbOn : {}) }} />
                                        </span>
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <footer style={s.footer} />

      {/* ── Invite Modal ── */}
      {showInviteModal && (
        <div style={s.modalOverlay} onClick={e => { if (e.target === e.currentTarget) closeInviteModal(); }}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>Invite User</span>
              <button style={s.modalClose} onClick={closeInviteModal}>✕</button>
            </div>
            <div style={s.modalBody}>
              {!inviteResult ? (
                <form onSubmit={handleInviteSubmit}>
                  <div style={s.formGroup}>
                    <label style={s.label}>Email address</label>
                    <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@example.com" required style={s.input} />
                  </div>
                  <div style={s.formGroup}>
                    <label style={s.label}>Display Name</label>
                    <input type="text" value={inviteDisplayName} onChange={e => setInviteDisplayName(e.target.value)} placeholder="Full name" required style={s.input} />
                  </div>
                  <div style={s.modalActions}>
                    <button type="submit" style={s.saveBtn} disabled={inviteLoading}>{inviteLoading ? 'Sending…' : 'Send Invite'}</button>
                    <button type="button" style={s.secondaryBtn} onClick={closeInviteModal}>Cancel</button>
                  </div>
                </form>
              ) : inviteResult.error ? (
                <div>
                  <div style={s.errorBanner}>{inviteResult.error}</div>
                  <button style={s.secondaryBtn} onClick={() => setInviteResult(null)}>Try again</button>
                </div>
              ) : (
                <div>
                  <div style={s.successBanner}>User invited successfully!</div>
                  <div style={s.emailStatusRow}>
                    {inviteResult.emailSent
                      ? <span style={{ color: '#107c10', fontSize: '0.85rem' }}>✓ Invitation email sent to {inviteEmail}</span>
                      : <span style={{ color: '#605e5c', fontSize: '0.85rem' }}>SMTP not configured — share the link below manually.</span>
                    }
                  </div>
                  <div style={s.inviteLinkBox}>
                    <div style={s.inviteLinkLabel}>Invite Link (expires in 7 days)</div>
                    <div style={s.inviteLinkRow}>
                      <input type="text" readOnly value={inviteResult.inviteUrl} style={s.inviteLinkInput} onClick={e => e.target.select()} />
                      <button style={s.copyBtn} onClick={copyInviteLink}>{copiedLink ? '✓ Copied' : 'Copy'}</button>
                    </div>
                  </div>
                  <div style={s.modalActions}>
                    <button style={s.saveBtn} onClick={() => { setInviteResult(null); setInviteEmail(''); setInviteDisplayName(''); }}>Invite Another</button>
                    <button style={s.secondaryBtn} onClick={closeInviteModal}>Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page:        { minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: '#f3f2f1' },

  // Header
  topBar:      { background: '#0078d4', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', position: 'sticky', top: 0, zIndex: 200 },
  topBarLeft:  { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '260px' },
  backBtn:     { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '2px', padding: '0 10px', cursor: 'pointer', fontSize: '0.9rem', width: 'auto', height: '28px', display: 'flex', alignItems: 'center', lineHeight: 1 },
  waffle:      { width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px' },
  waffleIcon:  { color: '#fff', fontSize: '1.1rem', letterSpacing: '-1px' },
  siteLabel:   { color: '#fff', fontSize: '0.95rem', fontWeight: 600 },
  topBarCenter:{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 20px' },
  pageTitle:   { color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', fontWeight: 400 },
  topBarRight: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: '260px', justifyContent: 'flex-end' },
  userName:    { color: '#fff', fontSize: '0.85rem' },
  avatar:      { width: '32px', height: '32px', borderRadius: '50%', background: '#005a9e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', border: '2px solid rgba(255,255,255,0.4)' },
  signOutBtn:  { background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', padding: '4px 12px', borderRadius: '2px', fontSize: '0.82rem', cursor: 'pointer', width: 'auto', margin: 0 },

  // Toolbar
  toolbar:      { background: '#ffffff', borderBottom: '1px solid #edebe9', padding: '0 24px' },
  toolbarInner: { height: '52px', display: 'flex', alignItems: 'center', gap: '20px' },
  inviteBtn:    { display: 'block', width: '100%', background: '#f3f2f1', border: 'none', borderBottom: '1px solid #edebe9', color: '#0078d4', padding: '11px 16px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' },
  toolbarStats: { display: 'flex', gap: '16px' },
  statChip:     { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#605e5c' },
  statDot:      { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },

  // Body
  body:        { flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px 40px' },
  loadingMsg:  { color: '#605e5c', padding: '20px 0' },
  errorBanner: { background: '#fde7e9', border: '1px solid #d13438', borderRadius: '2px', color: '#a4262c', padding: '10px 14px', fontSize: '0.88rem', marginBottom: '12px' },
  successBanner:{ background: '#dff6dd', border: '1px solid #107c10', borderRadius: '2px', color: '#107c10', padding: '10px 14px', fontSize: '0.88rem', marginBottom: '12px' },

  // Two-panel
  panels:      { display: 'flex', gap: '20px', flex: 1, minHeight: 0 },

  // Left list panel
  listPanel:   { width: '300px', flexShrink: 0, background: '#ffffff', border: '1px solid #edebe9', borderRadius: '2px', overflow: 'auto', alignSelf: 'flex-start' },
  listHeader:  { padding: '12px 16px', fontSize: '0.78rem', fontWeight: 600, color: '#605e5c', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #edebe9', background: '#f9f8f7' },
  listRow:     { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f3f2f1', transition: 'background 0.1s' },
  listRowActive:{ background: '#eff6fc', borderLeft: '3px solid #0078d4' },
  listAvatar:  { width: '36px', height: '36px', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 },
  listInfo:    { flex: 1, minWidth: 0 },
  listName:    { fontSize: '0.88rem', fontWeight: 600, color: '#323130', display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  listEmail:   { fontSize: '0.75rem', color: '#605e5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' },
  pendingDot:  { width: '7px', height: '7px', borderRadius: '50%', background: '#f5a623', flexShrink: 0, display: 'inline-block' },

  // Right detail panel
  detailPanel:  { flex: 1, background: '#ffffff', border: '1px solid #edebe9', borderRadius: '2px', overflow: 'auto' },

  // Empty state
  emptyState:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '320px', color: '#605e5c', gap: '10px' },
  emptyIcon:   { fontSize: '3rem' },
  emptyTitle:  { fontSize: '1.05rem', fontWeight: 600, color: '#323130' },
  emptySub:    { fontSize: '0.85rem', color: '#a19f9d', textAlign: 'center', maxWidth: '280px' },

  // Detail content
  detailContent:{ padding: '24px' },
  detailHeader: { display: 'flex', alignItems: 'flex-start', gap: '16px' },
  detailAvatar: { width: '52px', height: '52px', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.3rem', flexShrink: 0 },
  detailInfo:   { flex: 1, minWidth: 0 },
  detailName:   { fontSize: '1.1rem', fontWeight: 600, color: '#323130', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  detailEmail:  { fontSize: '0.85rem', color: '#605e5c', marginTop: '2px' },
  detailMeta:   { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' },
  detailMetaText:{ fontSize: '0.78rem', color: '#a19f9d' },
  detailActions:{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 },
  actionBtn:    { background: '#fff', border: '1px solid #edebe9', color: '#323130', padding: '5px 14px', borderRadius: '2px', fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  deleteBtnStyle:{ color: '#a4262c', borderColor: '#fde7e9' },
  divider:      { borderTop: '1px solid #edebe9', margin: '20px 0' },

  // Badges
  badgeAdmin:  { background: '#0078d4', color: '#fff', borderRadius: '2px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' },
  badgeUser:   { background: '#edebe9', color: '#323130', borderRadius: '2px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' },
  pendingBadge:{ background: '#fff4ce', color: '#7d5c00', border: '1px solid #f5d04e', borderRadius: '2px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 600 },

  // Admin note
  adminNote:    { display: 'flex', alignItems: 'flex-start', gap: '14px', background: '#f3f2f1', border: '1px solid #edebe9', borderRadius: '2px', padding: '16px 20px' },
  adminNoteIcon:{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 },
  adminNoteTitle:{ fontWeight: 600, color: '#323130', fontSize: '0.9rem', marginBottom: '4px' },
  adminNoteSub: { color: '#605e5c', fontSize: '0.83rem' },

  // Permissions
  permSection:  { },
  permHeader:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' },
  permTitle:    { fontSize: '0.95rem', fontWeight: 600, color: '#323130' },
  permSub:      { fontSize: '0.82rem', color: '#605e5c', marginTop: '2px' },
  permSaveRow:  { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  savedText:    { color: '#107c10', fontSize: '0.83rem', fontWeight: 600 },
  errorText:    { color: '#a4262c', fontSize: '0.83rem', fontWeight: 600 },

  permGrid:     { border: '1px solid #edebe9', borderRadius: '2px', overflow: 'hidden' },
  permGridHeader:{ display: 'flex', alignItems: 'center', background: '#f3f2f1', borderBottom: '1px solid #edebe9', padding: '8px 16px' },
  permGridRow:   { display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #edebe9' },
  colPage:      { flex: 1, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#605e5c' },
  colToggle:    { width: '100px', display: 'flex', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 600, color: '#605e5c' },
  pageName:     { color: '#323130', fontWeight: 500 },
  noEditNote:   { fontSize: '0.72rem', color: '#a19f9d', background: '#f3f2f1', borderRadius: '2px', padding: '1px 6px' },
  naText:       { color: '#c8c6c4', fontSize: '1rem' },
  subRow:       { paddingLeft: '28px' },
  subIndent:    { color: '#a19f9d', fontSize: '0.8rem', marginRight: '4px', flexShrink: 0 },
  subPageName:  { color: '#605e5c', fontWeight: 400, fontSize: '0.85rem' },

  // Toggle switch
  toggleWrap:   { display: 'inline-flex', alignItems: 'center', cursor: 'pointer' },
  hiddenCheck:  { position: 'absolute', opacity: 0, width: 0, height: 0 },
  toggle:       { position: 'relative', display: 'inline-block', width: '36px', height: '20px', borderRadius: '10px', transition: 'background 0.2s', flexShrink: 0 },
  toggleOn:     { background: '#0078d4' },
  toggleOff:    { background: '#c8c6c4' },
  toggleThumb:  { position: 'absolute', top: '2px', left: '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#ffffff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
  toggleThumbOn:{ left: '18px' },

  // Buttons
  saveBtn:     { background: '#0078d4', border: 'none', color: '#fff', padding: '7px 18px', borderRadius: '2px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' },
  secondaryBtn:{ background: '#fff', border: '1px solid #8a8886', color: '#323130', padding: '7px 16px', borderRadius: '2px', fontSize: '0.88rem', cursor: 'pointer' },

  // Modal
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: '#fff', borderRadius: '2px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', width: '100%', maxWidth: '460px', margin: '20px' },
  modalHeader:  { background: '#0078d4', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '2px 2px 0 0' },
  modalTitle:   { color: '#fff', fontWeight: 600, fontSize: '1rem' },
  modalClose:   { background: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', padding: '0 4px', lineHeight: 1 },
  modalBody:    { padding: '24px 20px' },
  formGroup:    { marginBottom: '16px' },
  label:        { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#323130', marginBottom: '5px' },
  input:        { width: '100%', border: '1px solid #8a8886', borderRadius: '2px', padding: '7px 10px', fontSize: '0.9rem', color: '#323130', outline: 'none', boxSizing: 'border-box' },
  modalActions: { display: 'flex', gap: '10px', marginTop: '20px' },
  emailStatusRow:{ marginBottom: '12px' },
  inviteLinkBox: { background: '#f3f2f1', border: '1px solid #edebe9', borderRadius: '2px', padding: '12px 14px', marginBottom: '4px' },
  inviteLinkLabel:{ fontSize: '0.78rem', fontWeight: 600, color: '#605e5c', marginBottom: '6px' },
  inviteLinkRow: { display: 'flex', gap: '8px' },
  inviteLinkInput:{ flex: 1, border: '1px solid #edebe9', borderRadius: '2px', padding: '5px 8px', fontSize: '0.8rem', color: '#323130', background: '#fff', outline: 'none', minWidth: 0 },
  copyBtn:      { background: '#0078d4', border: 'none', color: '#fff', padding: '5px 14px', borderRadius: '2px', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },

  footer:       { background: '#0078d4', height: '40px', marginTop: 'auto' },
};
