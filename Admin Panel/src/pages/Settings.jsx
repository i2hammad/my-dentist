import { useEffect, useState } from 'react';
import { UserCircle, Lock, ShieldCheck, Gear } from '@phosphor-icons/react';
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
  ];

  return (
    <div>
      <div className="page-title">Settings</div>
      <div className="breadcrumb">Dashboard › Settings</div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div className="card" style={{ width: 240, flexShrink: 0, padding: 10 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="nav-item" style={{ width: '100%', color: tab === t.id ? '#fff' : 'var(--text)', background: tab === t.id ? 'var(--blue)' : 'transparent', margin: '2px 0' }}>
              <t.Icon size={18} /> {t.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          {tab === 'profile' && <ProfileTab admin={admin} refresh={refresh} />}
          {tab === 'password' && <PasswordTab />}
          {tab === 'permissions' && <PermissionsTab isSuper={isSuper} />}
          {tab === 'app' && <AppTab isSuper={isSuper} />}
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
    <div className="card">
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

  useEffect(() => { api.get('/api/admin/settings').then((r) => setS(r.data.data)).catch(() => {}); }, []);
  if (!s) return <div className="card"><div className="loading">Loading…</div></div>;

  const set = (k) => (v) => setS((x) => ({ ...x, [k]: v }));
  const setPay = (k) => (v) => setS((x) => ({ ...x, payments: { ...x.payments, [k]: v } }));

  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/api/admin/settings', {
        rewardPointsPerAppointment: Number(s.rewardPointsPerAppointment),
        rewardPointValuePkr: Number(s.rewardPointValuePkr),
        defaultConsultationFee: Number(s.defaultConsultationFee),
        commissionRate: Number(s.commissionRate),
        supportEmail: s.supportEmail, payments: s.payments,
        maintenanceMode: !!s.maintenanceMode,
      });
      toast('Settings saved');
    } catch (e) { toast(e.response?.data?.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card">
      <div className="card-head"><h3>App Settings</h3></div>
      {!isSuper && <p className="muted" style={{ marginBottom: 16 }}>Read-only — only super admins can change these.</p>}
      <fieldset disabled={!isSuper} style={{ border: 0, padding: 0 }}>
        <h4 style={{ margin: '8px 0 12px', fontSize: 14 }}>Rewards</h4>
        <div className="field-row">
          <Field label="Points per Appointment" type="number" value={s.rewardPointsPerAppointment} onChange={set('rewardPointsPerAppointment')} />
          <Field label="Point Value (PKR)" type="number" value={s.rewardPointValuePkr} onChange={set('rewardPointValuePkr')} />
        </div>
        <h4 style={{ margin: '8px 0 12px', fontSize: 14 }}>Commission</h4>
        <div className="field-row">
          <Field label="Platform Commission Rate (%)" type="number" value={s.commissionRate ?? 10} onChange={set('commissionRate')} />
          <div />
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
