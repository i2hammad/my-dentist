import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooth, SealCheck, Clock, Sparkle, Check, Trash, Eye, EyeSlash, Plus, MapPin, Briefcase, EnvelopeSimple, Key, ArrowsClockwise } from '@phosphor-icons/react';
import api from '../lib/api';
import { imgUrl } from '../lib/api';
import useList from '../lib/useList';
import { PageHeader, StatCards, UserCell, Pagination, fmtDate, PopularBadge, ViewToggle } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import Modal from '../components/Modal.jsx';
import Field from '../components/Field.jsx';
import ExportButton from '../components/ExportButton.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

const DENTIST_CSV_COLS = [
  { header: 'Name', value: (r) => r.fullName },
  { header: 'Email', value: (r) => r.userId?.email },
  { header: 'Specialization', value: (r) => r.specialization },
  { header: 'City', value: (r) => r.city },
  { header: 'Verification', value: (r) => (r.pmdcVerified ? 'Verified' : 'Pending') },
  { header: 'Popular', value: (r) => r.popularType || '' },
  { header: 'Joined', value: (r) => fmtDate(r.userId?.createdAt || r.createdAt) },
];

export default function Dentists() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState('table');
  const L = useList('/api/admin/dentists', { search, status });
  const c = L.counts;
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [resetFor, setResetFor] = useState(null);   // dentist whose password we're resetting
  const [pwMap, setPwMap] = useState({});            // dentistId -> { value, show } (only the just-reset password)

  const approve = async (d) => {
    try { await L.patch(d._id, { pmdcVerified: true }); toast(`${d.fullName} approved`); }
    catch { toast('Failed to approve', 'error'); }
  };

  // Passwords are hashed — we can only reveal one we just set via Reset.
  const toggleShow = (d) => {
    const entry = pwMap[d._id];
    if (!entry?.value) { toast('Password is encrypted — use Reset to set a new one', 'error'); return; }
    setPwMap((m) => ({ ...m, [d._id]: { ...entry, show: !entry.show } }));
  };
  const onReset = (d, password) => setPwMap((m) => ({ ...m, [d._id]: { value: password, show: true } }));

  const del = async (d) => {
    if (!(await confirm({ title: 'Delete Dentist', message: `Permanently delete ${d.fullName} and their account?`, confirmText: 'Delete', destructive: true }))) return;
    try { await L.remove(d._id); toast(`${d.fullName} deleted`); }
    catch { toast('Failed to delete', 'error'); }
  };

  return (
    <div className="card">
      <PageHeader title="Dentists" crumb="Dentists"
        actions={<>
          <button className="btn ghost" onClick={() => nav('/verification')}><SealCheck size={16} style={{ marginRight: 6, verticalAlign: -2 }} />Approve New Dentists</button>
          <ExportButton path="/api/admin/dentists" params={{ search, status }} columns={DENTIST_CSV_COLS} filename="dentists.csv" />
          <button className="btn primary" onClick={() => setShowAdd(true)}><Plus size={16} weight="bold" style={{ marginRight: 6, verticalAlign: -2 }} />Add New Dentist</button>
        </>} />

      {L.loading ? <SkeletonStatCards /> : (
        <StatCards items={[
          { label: 'Total Dentists', value: c.total ?? '—', icon: Tooth, tone: 'blue' },
          { label: 'Verified', value: c.verified ?? '—', icon: SealCheck, tone: 'green' },
          { label: 'Pending', value: c.pending ?? '—', icon: Clock, tone: 'amber' },
          { label: 'New This Month', value: c.newThisMonth ?? '—', icon: Sparkle, tone: 'purple' },
        ]} />
      )}

      <div className="toolbar">
        <input type="text" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
        </select>
        <div style={{ marginLeft: 'auto' }}><ViewToggle view={view} onChange={setView} /></div>
      </div>

      {L.loading ? <SkeletonTable cols={6} /> : view === 'cards' ? (
        <>
          {!L.data.length ? <div className="empty">No dentists found</div> : (
            <div className="entity-grid">
              {L.data.map((d) => (
                <div key={d._id} className="entity-card">
                  <div className="ec-top clickable" onClick={() => nav(`/dentists/${d._id}`)}>
                    {d.photo ? <img className="ec-avatar" src={imgUrl(d.photo)} alt="" /> : <div className="ec-avatar" />}
                    <div style={{ minWidth: 0 }}>
                      <div className="ec-name">
                        {d.fullName || '—'}
                        {d.pmdcVerified && <SealCheck size={15} weight="fill" color="#2563EB" />}
                      </div>
                      <div className="ec-sub">{d.specialization || 'Dentist'}</div>
                    </div>
                  </div>
                  <div className="ec-rows">
                    <div className="ec-row"><EnvelopeSimple size={14} />{d.userId?.email || '—'}</div>
                    <div className="ec-row"><MapPin size={14} />{d.city || '—'}</div>
                    <div className="ec-row"><Briefcase size={14} />{d.clinicName || 'Private Clinic'}</div>
                  </div>
                  <div className="ec-foot">
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className={`badge ${d.pmdcVerified ? 'green' : 'amber'}`}>{d.pmdcVerified ? 'Verified' : 'Pending'}</span>
                      {d.popularType && <PopularBadge type={d.popularType} />}
                    </div>
                    <div className="ec-actions">
                      <button className="icon-btn" title="View" onClick={() => nav(`/dentists/${d._id}`)}><Eye size={16} /></button>
                      {!d.pmdcVerified && <button className="icon-btn" title="Approve" onClick={() => approve(d)}><Check size={16} /></button>}
                      <button className="icon-btn del" title="Delete" onClick={() => del(d)}><Trash size={16} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      ) : (
        <>
          <div className="table-scroll">
          <table>
            <thead><tr>
              <th>#</th><th>Dentist</th><th>Gender</th><th>Phone</th><th>Login Email</th>
              <th>Password</th><th>Location</th><th>Status</th><th>Joined On</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {L.data.map((d, i) => {
                const pw = pwMap[d._id];
                const blocked = d.isBlocked;
                return (
                <tr key={d._id}>
                  <td className="muted">{(L.page - 1) * 10 + i + 1}</td>
                  <td><UserCell name={d.fullName} sub={d.qualification || d.specialization || '—'} img={d.photo} onClick={() => nav(`/dentists/${d._id}`)} /></td>
                  <td style={{ textTransform: 'capitalize' }}>{d.gender || '—'}</td>
                  <td>{d.phone || d.clinicContact || '—'}</td>
                  <td>{d.userId?.email || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <code style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: pw?.show && pw?.value ? 0 : 2 }}>
                        {pw?.show && pw?.value ? pw.value : '••••••••'}
                      </code>
                      <button className="icon-btn" title={pw?.value ? (pw.show ? 'Hide' : 'Show') : 'Encrypted — use Reset'} onClick={() => toggleShow(d)}>
                        {pw?.show ? <EyeSlash size={15} /> : <Eye size={15} />}
                      </button>
                      <button className="icon-btn" title="Reset password" onClick={() => setResetFor(d)}><Key size={15} /></button>
                    </div>
                  </td>
                  <td>{d.city || '—'}</td>
                  <td>
                    <span className={`badge ${blocked ? 'red' : d.pmdcVerified ? 'green' : 'amber'}`}>
                      {blocked ? 'Blocked' : d.pmdcVerified ? 'Active' : 'Pending'}
                    </span>
                  </td>
                  <td>{fmtDate(d.userId?.createdAt || d.createdAt)}</td>
                  <td className="row-actions">
                    <button className="btn ghost" style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={() => nav(`/dentists/${d._id}`)}>
                      <Eye size={14} style={{ marginRight: 4, verticalAlign: -2 }} />View User Details
                    </button>
                    {!d.pmdcVerified && <button className="icon-btn" title="Approve" onClick={() => approve(d)}><Check size={16} /></button>}
                    <button className="icon-btn del" title="Delete" onClick={() => del(d)}><Trash size={16} /></button>
                  </td>
                </tr>
                );
              })}
              {!L.data.length && <tr><td colSpan={10} className="empty">No dentists found</td></tr>}
            </tbody>
          </table>
          </div>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}

      {showAdd && <AddDentist onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); L.reload(); toast('Dentist created'); }} toast={toast} />}
      {resetFor && <ResetPasswordModal d={resetFor} onClose={() => setResetFor(null)} onReset={(pw) => onReset(resetFor, pw)} toast={toast} />}
    </div>
  );
}

function ResetPasswordModal({ d, onClose, onReset, toast }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // the new password, shown once after reset

  const generate = () => setPassword('Dent' + Math.random().toString(36).slice(2, 10));
  const submit = async () => {
    setBusy(true);
    try {
      const body = password.trim() ? { password: password.trim() } : {};
      const r = await api.patch(`/api/admin/dentists/${d._id}/reset-password`, body);
      const np = r.data.data.password;
      setResult(np);
      onReset(np);
      toast('Password reset');
    } catch (e) { toast(e.response?.data?.message || 'Failed to reset', 'error'); }
    finally { setBusy(false); }
  };
  const copy = () => { navigator.clipboard?.writeText(result); toast('Copied'); };

  return (
    <Modal
      title={`Reset Password — ${d.fullName}`}
      onClose={onClose}
      footer={result
        ? <button className="btn primary" onClick={onClose}>Done</button>
        : <>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Resetting…' : 'Reset Password'}</button>
          </>}
    >
      {result ? (
        <div>
          <p className="muted" style={{ marginBottom: 10 }}>New password set. Share it with the dentist — it can't be shown again (passwords are encrypted).</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ fontFamily: 'monospace', fontSize: 16, background: '#EFF6FF', padding: '8px 12px', borderRadius: 8 }}>{result}</code>
            <button className="btn ghost" onClick={copy}>Copy</button>
          </div>
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 12 }}>Set a new login password for <b>{d.userId?.email || 'this dentist'}</b>. Leave blank to auto-generate. Existing passwords are encrypted and can't be displayed.</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><Field label="New Password (optional)" value={password} onChange={setPassword} placeholder="Auto-generate if blank" /></div>
            <button className="btn ghost" onClick={generate} style={{ marginBottom: 2, whiteSpace: 'nowrap' }}><ArrowsClockwise size={15} style={{ marginRight: 4, verticalAlign: -2 }} />Generate</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function AddDentist({ onClose, onSaved, toast }) {
  const [f, setF] = useState({ fullName: '', email: '', password: '', specialization: '', city: '', phone: '', consultationFee: 1500 });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!f.fullName || !f.email || !f.password) return toast('Name, email and password are required', 'error');
    setBusy(true);
    try { await api.post('/api/admin/dentists', f); onSaved(); }
    catch (e) { toast(e.response?.data?.message || 'Failed to create', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Add New Dentist" onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Create Dentist'}</button>
      </>}>
      <Field label="Full Name" value={f.fullName} onChange={set('fullName')} required />
      <div className="field-row">
        <Field label="Email" type="email" value={f.email} onChange={set('email')} required />
        <Field label="Password" type="password" value={f.password} onChange={set('password')} required />
      </div>
      <div className="field-row">
        <Field label="Specialization" value={f.specialization} onChange={set('specialization')} placeholder="e.g. Orthodontist" />
        <Field label="City" value={f.city} onChange={set('city')} />
      </div>
      <div className="field-row">
        <Field label="Phone" value={f.phone} onChange={set('phone')} />
        <Field label="Consultation Fee" type="number" value={f.consultationFee} onChange={set('consultationFee')} />
      </div>
    </Modal>
  );
}
