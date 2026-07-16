import { useEffect, useState, useRef } from 'react';
import { UserCircle, Lock, ShieldCheck, Gear, Database } from '@phosphor-icons/react';
import api, { imgUrl, API_URL } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../components/feedback.jsx';
import Field from '../components/Field.jsx';

const ALL_PERMS = ['dashboard', 'admins', 'dentists', 'patients', 'treatments', 'gallery', 'reviews', 'appointments', 'bills', 'rewards'];

export default function Settings() {
  const { admin, refresh } = useAuth();
  const isSuper = admin?.profile?.adminRole === 'super_admin';
  const [tab, setTab] = useState('profile');

  const TABS = [
    { id: 'profile', label: 'My Profile', Icon: UserCircle },
    { id: 'password', label: 'Change Password', Icon: Lock },
    { id: 'permissions', label: 'Permissions & Roles', Icon: ShieldCheck },
    { id: 'app', label: 'App Settings', Icon: Gear },
    ...(isSuper ? [{ id: 'backup', label: 'Backup', Icon: Database }] : []),
  ];

  return (
    <div>
      <div className="page-title">Settings</div>
      <div className="breadcrumb">Dashboard › Settings</div>

      <div className="settings-layout">
        <div className="card settings-nav">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="nav-item" style={{ width: '100%', color: tab === t.id ? '#fff' : 'var(--text)', background: tab === t.id ? 'var(--blue)' : 'transparent', margin: '2px 0' }}>
              <t.Icon size={18} /> {t.label}
            </button>
          ))}
        </div>
        <div className="settings-body">
          {tab === 'profile' && <ProfileTab admin={admin} refresh={refresh} />}
          {tab === 'password' && <PasswordTab />}
          {tab === 'permissions' && <PermissionsTab isSuper={isSuper} />}
          {tab === 'app' && <AppTab isSuper={isSuper} />}
          {tab === 'backup' && <BackupTab isSuper={isSuper} />}
        </div>
      </div>
    </div>
  );
}

const fmtBytes = (n) => {
  if (!n || n < 1024) return `${n || 0} B`;
  const u = ['KB', 'MB', 'GB']; let i = -1; let v = n;
  do { v /= 1024; i++; } while (v >= 1024 && i < u.length - 1);
  return `${v.toFixed(1)} ${u[i]}`;
};
const fmtTime = (s) => {
  if (s == null || !isFinite(s)) return '';
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60); const sec = Math.round(s % 60);
  if (m < 60) return `${m}m ${sec}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

function BackupTab({ isSuper }) {
  const toast = useToast();
  // which download is running: null | 'db' | 'images'
  const [job, setJob] = useState(null);
  // { loaded, total|null } — total is null when the server doesn't send Content-Length
  const [progress, setProgress] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [imgInfo, setImgInfo] = useState(null); // { count, bytes }
  const abortRef = useRef(null);

  // Fetch how many images / total size there are so the admin knows what the
  // "Download Images" button will produce before clicking it.
  useEffect(() => {
    if (!isSuper) return;
    api.get('/api/admin/backup/images/info')
      .then(({ data }) => { if (data?.success) setImgInfo(data.data); })
      .catch(() => {});
  }, [isSuper]);

  if (!isSuper) return <div className="card"><div className="empty">Only super admins can back up or restore data.</div></div>;

  const busy = job !== null;

  const cancel = () => {
    abortRef.current?.abort();
  };

  const grab = async (endpoint, fallbackName, okMsg, which) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setJob(which);
    setProgress({ loaded: 0, total: null, rate: 0, eta: null });
    const startedAt = Date.now();
    try {
      const res = await api.get(endpoint, {
        responseType: 'blob',
        signal: controller.signal,
        onDownloadProgress: (e) => {
          const total = e.total || null;
          // axios provides e.rate (bytes/s) & e.estimated (s) when it can; fall
          // back to our own average rate so we always have a number to show.
          const elapsed = (Date.now() - startedAt) / 1000;
          const rate = e.rate || (elapsed > 0 ? e.loaded / elapsed : 0);
          const eta = total && rate > 0
            ? Math.max(0, Math.round((total - e.loaded) / rate))
            : (e.estimated != null ? Math.round(e.estimated) : null);
          setProgress({ loaded: e.loaded, total, rate, eta });
        },
      });
      const cd = res.headers['content-disposition'] || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = m ? m[1] : fallbackName;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast(okMsg);
    } finally {
      abortRef.current = null;
      setJob(null);
      setProgress(null);
    }
  };

  const isCancel = (e) =>
    e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError';

  const download = async () => {
    try { await grab('/api/admin/backup', 'mydentist-backup.json', 'Database backup downloaded', 'db'); }
    catch (e) { if (isCancel(e)) toast('Backup canceled', 'error'); else toast(e.response?.data?.message || 'Backup failed', 'error'); }
  };

  const downloadImages = async () => {
    try { await grab('/api/admin/backup/images', 'mydentist-images.tar.gz', 'Images backup downloaded', 'images'); }
    catch (e) {
      if (isCancel(e)) { toast('Images backup canceled', 'error'); return; }
      // blob error bodies aren't JSON — read the message out if present
      let msg = 'Images backup failed';
      try { const t = await e.response?.data?.text?.(); if (t) msg = JSON.parse(t).message || msg; } catch {}
      toast(msg, 'error');
    }
  };

  const restore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('Restore the database from this backup?\n\nRecords with matching IDs will be recreated or overwritten. Nothing is deleted, but this cannot be undone. Continue?')) return;
    setRestoring(true);
    try {
      const backup = JSON.parse(await file.text());
      if (!backup?.data) throw new Error('bad');
      const res = await api.post('/api/admin/restore', backup);
      const d = res.data.data;
      toast(`Restored ${d.restored} records${d.failed ? ` · ${d.failed} skipped` : ''}`);
    } catch (e) {
      toast(e.response?.data?.message || 'Restore failed — is this a valid backup file?', 'error');
    } finally { setRestoring(false); }
  };

  const restoreImages = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('Restore images from this .tar.gz?\n\nFiles are extracted into the uploads folder — matching paths are overwritten, nothing is deleted. Continue?')) return;
    setRestoring(true);
    try {
      const fd = new FormData();
      fd.append('archive', file);
      await api.post('/api/admin/restore/images', fd);
      toast('Images restored');
    } catch (e) {
      toast(e.response?.data?.message || 'Image restore failed', 'error');
    } finally { setRestoring(false); }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <div className="card">
        <div className="card-head"><h3>Data Backup</h3></div>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 16px', lineHeight: 1.6 }}>
          Download a full JSON export of the database — users, doctors, patients, appointments,
          bills, reviews, rewards, settings, and more.
        </p>
        <div style={{ background: '#fff8e1', border: '1px solid #fde68a', color: '#92400e', fontSize: 13, padding: '10px 14px', margin: '0 0 16px', borderRadius: 10 }}>
          ⚠ This file contains all account data (including password hashes). Store it securely and
          never share it.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn primary" disabled={busy} onClick={download}>
            {job === 'db' ? 'Preparing…' : 'Download Database (JSON)'}
          </button>
          <button className="btn" disabled={busy || imgInfo?.count === 0} onClick={downloadImages}>
            {job === 'images'
              ? 'Preparing…'
              : imgInfo
                ? `Download Images (${imgInfo.count} ${imgInfo.count === 1 ? 'image' : 'images'} · ${fmtBytes(imgInfo.bytes)})`
                : 'Download Images (.tar.gz)'}
          </button>
        </div>
        {imgInfo?.count === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 12.5, margin: '8px 0 0' }}>No uploaded images to back up yet.</p>
        )}

        {busy && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {job === 'db' ? 'Preparing database backup…' : 'Preparing images archive…'}
                {progress && (
                  <b style={{ color: 'var(--text, #0A1551)', marginLeft: 8 }}>
                    {fmtBytes(progress.loaded)}
                    {progress.total ? ` / ${fmtBytes(progress.total)}` : ''}
                  </b>
                )}
              </span>
              <button
                className="btn ghost"
                onClick={cancel}
                style={{ padding: '4px 12px', fontSize: 13, color: '#DC2626' }}
              >
                Cancel
              </button>
            </div>
            <div style={{ height: 8, borderRadius: 6, background: '#EEF2F7', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 6,
                  background: 'linear-gradient(90deg,#0052FF,#3B82F6)',
                  width: progress?.total
                    ? `${Math.min(100, Math.round((progress.loaded / progress.total) * 100))}%`
                    : '40%',
                  // when the total is unknown, sweep an indeterminate chunk across
                  animation: progress?.total ? 'none' : 'bkpIndeterminate 1.1s ease-in-out infinite',
                  transition: progress?.total ? 'width .15s ease' : 'none',
                }}
              />
            </div>
            {progress?.total ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
                <span>{Math.min(100, Math.round((progress.loaded / progress.total) * 100))}% • {fmtBytes(Math.max(0, progress.total - progress.loaded))} left</span>
                <span>
                  {progress.eta != null && progress.eta > 0 ? `~${fmtTime(progress.eta)} remaining` : 'finishing…'}
                  {progress.rate > 0 ? ` • ${fmtBytes(progress.rate)}/s` : ''}
                </span>
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', fontSize: 12, margin: '8px 0 0' }}>
                The server is generating the file… {progress?.loaded ? fmtBytes(progress.loaded) + ' received' : ''}
                {progress?.rate > 0 ? ` • ${fmtBytes(progress.rate)}/s` : ''}. This can take a while for large datasets — you can cancel anytime.
              </p>
            )}
          </div>
        )}

        <p style={{ color: 'var(--muted)', fontSize: 12.5, margin: '12px 0 0', lineHeight: 1.5 }}>
          A full backup is <b>both</b> files — the database (record data) and the images
          (uploaded photos the records point to).
        </p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h3>Restore</h3></div>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 16px', lineHeight: 1.6 }}>
          Upload a backup file to restore it. Records are matched by ID — missing ones are
          recreated, matching ones are overwritten. <b>Nothing is deleted.</b>
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label className="btn" style={{ cursor: 'pointer', display: 'inline-block' }}>
            {restoring ? 'Restoring…' : 'Database (.json)…'}
            <input type="file" accept="application/json,.json" hidden disabled={restoring} onChange={restore} />
          </label>
          <label className="btn" style={{ cursor: 'pointer', display: 'inline-block' }}>
            {restoring ? 'Restoring…' : 'Images (.tar.gz)…'}
            <input type="file" accept=".gz,.tgz,application/gzip,application/x-gzip" hidden disabled={restoring} onChange={restoreImages} />
          </label>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ admin, refresh }) {
  const toast = useToast();
  const [fullName, setFullName] = useState(admin?.profile?.fullName || '');
  const [image, setImage] = useState(admin?.profile?.profileImage || '');
  const [busy, setBusy] = useState(false);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/api/users/upload-avatar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (data.success) { setImage(data.data.profileImage); toast('Photo uploaded'); }
      else toast(data.message || 'Upload failed', 'error');
    } catch { toast('Upload failed', 'error'); }
  };

  const save = async () => {
    setBusy(true);
    try { await api.patch('/api/admin/me', { fullName, profileImage: image }); await refresh(); toast('Profile updated'); }
    catch (e) { toast(e.response?.data?.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ maxWidth: 460 }}>
      <div className="card-head"><h3>My Profile</h3></div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        {image ? <img src={imgUrl(image)} alt="" style={{ width: 72, height: 72, borderRadius: 16 }} /> : <div className="avatar" style={{ width: 72, height: 72 }} />}
        <label className="btn ghost" style={{ cursor: 'pointer' }}>
          Change Photo<input type="file" accept="image/*" hidden onChange={upload} />
        </label>
      </div>
      <Field label="Full Name" value={fullName} onChange={setFullName} />
      <Field label="Email" value={admin?.email || ''} onChange={() => {}} />
      <p className="muted" style={{ fontSize: 12, marginTop: -8, marginBottom: 14 }}>Email cannot be changed.</p>
      <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save Changes'}</button>
    </div>
  );
}

function PasswordTab() {
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (nw !== confirm) return toast('New passwords do not match', 'error');
    if (nw.length < 6) return toast('Password must be at least 6 characters', 'error');
    setBusy(true);
    try { await api.patch('/api/admin/me/password', { currentPassword: cur, newPassword: nw }); toast('Password changed'); setCur(''); setNw(''); setConfirm(''); }
    catch (e) { toast(e.response?.data?.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ maxWidth: 460 }}>
      <div className="card-head"><h3>Change Password</h3></div>
      <Field label="Current Password" type="password" value={cur} onChange={setCur} />
      <Field label="New Password" type="password" value={nw} onChange={setNw} />
      <Field label="Confirm New Password" type="password" value={confirm} onChange={setConfirm} />
      <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Updating…' : 'Update Password'}</button>
    </div>
  );
}

function PermissionsTab({ isSuper }) {
  const toast = useToast();
  const [admins, setAdmins] = useState(null);

  const load = () => api.get('/api/admin/admins', { params: { limit: 100 } }).then((r) => setAdmins(r.data.data)).catch(() => setAdmins([]));
  useEffect(() => { load(); }, []);

  const togglePerm = async (a, perm) => {
    const has = a.permissions?.includes(perm);
    const permissions = has ? a.permissions.filter((p) => p !== perm) : [...(a.permissions || []), perm];
    try { await api.patch(`/api/admin/admins/${a._id}`, { permissions }); load(); }
    catch { toast('Failed to update', 'error'); }
  };

  if (!isSuper) return <div className="card"><div className="empty">Only super admins can manage permissions.</div></div>;
  if (!admins) return <div className="card"><div className="loading">Loading…</div></div>;

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <div className="card-head"><h3>Permissions & Roles</h3></div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Admin</th><th>Role</th>{ALL_PERMS.map((p) => <th key={p} style={{ textTransform: 'capitalize' }}>{p}</th>)}</tr></thead>
          <tbody>
            {admins.map((a) => {
              const sup = a.adminRole === 'super_admin';
              return (
                <tr key={a._id}>
                  <td style={{ fontWeight: 600 }}>{a.fullName}</td>
                  <td><span className={`badge ${sup ? 'purple' : 'blue'}`}>{sup ? 'Super' : 'Admin'}</span></td>
                  {ALL_PERMS.map((p) => (
                    <td key={p} style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={sup || a.permissions?.includes(p)} disabled={sup}
                        onChange={() => togglePerm(a, p)} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Super admins always have full access.</p>
    </div>
  );
}

function AppTab({ isSuper }) {
  const toast = useToast();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => { api.get('/api/admin/settings').then((r) => setS(r.data.data)).catch(() => {}); }, []);
  if (!s) return <div className="card"><div className="loading">Loading…</div></div>;

  const set = (k) => (v) => setS((x) => ({ ...x, [k]: v }));
  const setPay = (k) => (v) => setS((x) => ({ ...x, payments: { ...x.payments, [k]: v } }));
  const setSmtp = (k) => (v) => setS((x) => ({ ...x, smtp: { ...(x.smtp || {}), [k]: v } }));

  const sendTest = async () => {
    if (!testTo.trim()) return toast('Enter a recipient email to test', 'error');
    setTesting(true);
    try {
      await api.patch('/api/admin/settings', { smtp: s.smtp }); // save current SMTP first
      const r = await api.post('/api/admin/settings/test-email', { to: testTo.trim() });
      toast(r.data?.data?.sent ? `Test email sent to ${testTo.trim()}` : 'SMTP not configured', r.data?.data?.sent ? 'success' : 'error');
    } catch (e) { toast(e.response?.data?.message || 'Test failed', 'error'); }
    finally { setTesting(false); }
  };

  // Which patient payment types are enabled (defaults to all when unset on old settings).
  const PM_TYPES = [['visa', 'Visa'], ['mastercard', 'Mastercard'], ['easypaisa', 'EasyPaisa'], ['jazzcash', 'JazzCash'], ['bank', 'Bank Account']];
  const ALL_PM = PM_TYPES.map(([k]) => k);
  const enabledPM = Array.isArray(s.enabledPaymentMethods) ? s.enabledPaymentMethods : ALL_PM;
  const togglePM = (key) => (checked) => setS((x) => {
    const cur = Array.isArray(x.enabledPaymentMethods) ? x.enabledPaymentMethods : ALL_PM;
    return { ...x, enabledPaymentMethods: checked ? [...new Set([...cur, key])] : cur.filter((k) => k !== key) };
  });

  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/api/admin/settings', {
        rewardPointsPerAppointment: Number(s.rewardPointsPerAppointment),
        rewardPointValuePkr: Number(s.rewardPointValuePkr),
        popularPointsThreshold: Number(s.popularPointsThreshold ?? 20000),
        defaultConsultationFee: Number(s.defaultConsultationFee),
        commissionRate: Number(s.commissionRate),
        commissionBlockThreshold: Number(s.commissionBlockThreshold ?? 50000),
        supportEmail: s.supportEmail, payments: s.payments,
        enabledPaymentMethods: enabledPM,
        maintenanceMode: !!s.maintenanceMode,
        smtp: s.smtp,
      });
      toast('Settings saved');
    } catch (e) { toast(e.response?.data?.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card">
      <div className="card-head"><h3>App Settings</h3></div>
      {!isSuper && <p className="muted" style={{ marginBottom: 16 }}>Read-only — only super admins can change these.</p>}
      <fieldset disabled={!isSuper} style={{ border: 0, padding: 0, maxWidth: 760 }}>
        <h4 style={{ margin: '8px 0 12px', fontSize: 14 }}>Rewards</h4>
        <div className="field-row">
          <Field label="Points per Appointment" type="number" value={s.rewardPointsPerAppointment} onChange={set('rewardPointsPerAppointment')} />
          <Field label="Point Value (PKR)" type="number" value={s.rewardPointValuePkr} onChange={set('rewardPointValuePkr')} />
        </div>
        <div className="field-row">
          <Field label="Popular Badge Points Threshold" type="number" value={s.popularPointsThreshold ?? 20000} onChange={set('popularPointsThreshold')}
            hint="Doctors reaching this many points unlock the green Popular badge." />
          <div />
        </div>
        <h4 style={{ margin: '8px 0 12px', fontSize: 14 }}>Platform Fee</h4>
        <div className="field-row">
          <Field label="Platform Fee Rate (%)" type="number" value={s.commissionRate ?? 10} onChange={set('commissionRate')} />
          <Field label="Auto-block Dues Threshold (PKR)" type="number" value={s.commissionBlockThreshold ?? 50000} onChange={set('commissionBlockThreshold')}
            hint="A doctor is auto-blocked once outstanding platform-fee dues reach this amount." />
        </div>
        <h4 style={{ margin: '8px 0 12px', fontSize: 14 }}>General</h4>
        <div className="field-row">
          <Field label="Default Consultation Fee" type="number" value={s.defaultConsultationFee} onChange={set('defaultConsultationFee')} />
          <Field label="Support Email" value={s.supportEmail} onChange={set('supportEmail')} />
        </div>
        <h4 style={{ margin: '8px 0 12px', fontSize: 14 }}>Payment Accounts</h4>
        <div className="field-row">
          <Field label="EasyPaisa Number" value={s.payments?.easypaisaNumber || ''} onChange={setPay('easypaisaNumber')} />
          <Field label="EasyPaisa Title of Account" value={s.payments?.easypaisaTitle || ''} onChange={setPay('easypaisaTitle')} />
        </div>
        <div className="field-row">
          <Field label="JazzCash Number" value={s.payments?.jazzcashNumber || ''} onChange={setPay('jazzcashNumber')} />
          <Field label="JazzCash Title of Account" value={s.payments?.jazzcashTitle || ''} onChange={setPay('jazzcashTitle')} />
        </div>
        <div className="field-row">
          <Field label="Bank Name (HBL, etc.)" value={s.payments?.bankName || ''} onChange={setPay('bankName')} />
          <Field label="Bank Account / IBAN" value={s.payments?.bankAccount || ''} onChange={setPay('bankAccount')} />
        </div>
        <div className="field-row">
          <Field label="Bank Title of Account" value={s.payments?.bankTitle || ''} onChange={setPay('bankTitle')} />
          <div />
        </div>
        <h4 style={{ margin: '8px 0 12px', fontSize: 14 }}>Patient Payment Methods</h4>
        <p className="muted" style={{ fontSize: 12, marginTop: -6, marginBottom: 10 }}>Turn each method on/off in the patient app (Add Payment Method &amp; bill checkout).</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', marginBottom: 16 }}>
          {PM_TYPES.map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isSuper ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={enabledPM.includes(key)} onChange={(e) => togglePM(key)(e.target.checked)} />
              <span style={{ fontWeight: 600 }}>{label}</span>
            </label>
          ))}
        </div>
        <h4 style={{ margin: '8px 0 12px', fontSize: 14 }}>Email (SMTP)</h4>
        <p className="muted" style={{ fontSize: 12, marginTop: -6, marginBottom: 10 }}>
          Used for password-reset emails. For a domain mailbox (cPanel/Namecheap): host <code>mail.yourdomain.com</code>, port 465 (SSL) or 587, user = full mailbox address.
        </p>
        <div className="field-row">
          <Field label="SMTP Host" value={s.smtp?.host || ''} onChange={setSmtp('host')} placeholder="mail.mydentistpk.com" />
          <Field label="Port" type="number" value={s.smtp?.port ?? 465} onChange={setSmtp('port')} hint="465 = SSL · 587 = STARTTLS" />
        </div>
        <div className="field-row">
          <Field label="Username (mailbox)" value={s.smtp?.user || ''} onChange={setSmtp('user')} placeholder="no-reply@mydentistpk.com" />
          <Field label="Password" type="password" value={s.smtp?.pass || ''} onChange={setSmtp('pass')}
            placeholder={s.smtp?.passSet ? '•••••••• (leave blank to keep)' : 'Mailbox password'} />
        </div>
        <div className="field-row">
          <Field label="From" value={s.smtp?.from || ''} onChange={setSmtp('from')} placeholder="My Dentist <no-reply@mydentistpk.com>" />
          <div />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: isSuper ? 'pointer' : 'default', marginBottom: 10 }}>
          <input type="checkbox" checked={!!s.smtp?.insecure} onChange={(e) => setSmtp('insecure')(e.target.checked)} />
          <span style={{ fontWeight: 600 }}>Allow self-signed / mismatched TLS certificate</span>
        </label>
        <p className="muted" style={{ fontSize: 12, marginTop: -4, marginBottom: 10 }}>Enable only if you get a certificate error (common on shared cPanel hosts).</p>
        {isSuper && (
          <div className="field-row" style={{ alignItems: 'flex-end', marginBottom: 14 }}>
            <Field label="Send test email to" value={testTo} onChange={setTestTo} placeholder="you@example.com" />
            <button className="btn ghost" disabled={testing} onClick={sendTest} style={{ height: 40 }}>{testing ? 'Sending…' : 'Send Test Email'}</button>
          </div>
        )}

        <h4 style={{ margin: '8px 0 12px', fontSize: 14 }}>Maintenance</h4>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: isSuper ? 'pointer' : 'default', marginBottom: 6 }}>
          <input type="checkbox" checked={!!s.maintenanceMode} onChange={(e) => set('maintenanceMode')(e.target.checked)} />
          <span style={{ fontWeight: 600 }}>Maintenance Mode</span>
        </label>
        <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>When ON, the patient/doctor apps show a maintenance screen.</p>
        {isSuper && <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save Settings'}</button>}
      </fieldset>
    </div>
  );
}
