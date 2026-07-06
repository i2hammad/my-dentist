import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Sparkle, UserCheck, ClipboardText, Trash, Eye, EyeSlash, Plus, MapPin, Phone, EnvelopeSimple, GenderIntersex, GenderMale, GenderFemale, Key, ArrowsClockwise, Gift } from '@phosphor-icons/react';

// ♂ / ♀ gender chip used in the tables.
function GenderTag({ value }) {
  const g = (value || '').toLowerCase();
  const icon = g === 'male' ? <GenderMale size={15} color="#2563EB" weight="bold" />
    : g === 'female' ? <GenderFemale size={15} color="#DB2777" weight="bold" />
    : <GenderIntersex size={15} color="#64748B" />;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, textTransform: 'capitalize' }}>{icon}{value || '—'}</span>;
}
import api from '../lib/api';
import { imgUrl } from '../lib/api';
import useList from '../lib/useList';
import { PageHeader, StatCards, UserCell, Pagination, fmtDate, ViewToggle } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import Modal from '../components/Modal.jsx';
import Field from '../components/Field.jsx';
import ExportButton from '../components/ExportButton.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

const PATIENT_CSV_COLS = [
  { header: 'Name', value: (r) => r.fullName },
  { header: 'Email', value: (r) => r.userId?.email },
  { header: 'Phone', value: (r) => r.mobileNumber },
  { header: 'Gender', value: (r) => r.gender },
  { header: 'City', value: (r) => r.city },
  { header: 'Joined', value: (r) => fmtDate(r.userId?.createdAt || r.createdAt) },
];

export default function Patients() {
  const [search, setSearch] = useState('');
  const [view, setView] = useState('table');
  const L = useList('/api/admin/patients', { search });
  const c = L.counts;
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const [pwMap, setPwMap] = useState({}); // patientId -> { value, show } (only the just-reset password)
  const [givePointsFor, setGivePointsFor] = useState(null); // null = closed, 'pick' = open with search, or a specific patient object

  const toggleShow = (p) => {
    const entry = pwMap[p._id];
    if (!entry?.value) { toast('Password is encrypted — use Reset to set a new one', 'error'); return; }
    setPwMap((m) => ({ ...m, [p._id]: { ...entry, show: !entry.show } }));
  };
  const onReset = (p, password) => setPwMap((m) => ({ ...m, [p._id]: { value: password, show: true } }));

  const del = async (p) => {
    if (!(await confirm({ title: 'Delete Patient', message: `Permanently delete ${p.fullName}?`, confirmText: 'Delete', destructive: true }))) return;
    try { await L.remove(p._id); toast(`${p.fullName} deleted`); } catch { toast('Failed to delete', 'error'); }
  };

  return (
    <div className="card">
      <PageHeader title="Patients" crumb="Patients"
        actions={<>
          <button className="btn ghost" onClick={() => setGivePointsFor('pick')}><Gift size={16} style={{ marginRight: 6, verticalAlign: -2 }} />Give Points</button>
          <ExportButton path="/api/admin/patients" params={{ search }} columns={PATIENT_CSV_COLS} filename="patients.csv" />
          <button className="btn primary" onClick={() => setShowAdd(true)}><Plus size={16} weight="bold" style={{ marginRight: 6, verticalAlign: -2 }} />Add New Patient</button>
        </>} />

      {L.loading ? <SkeletonStatCards /> : (
        <StatCards items={[
          { label: 'Total Patients', value: c.total ?? '—', icon: Users, tone: 'blue' },
          { label: 'Active Patients', value: c.active ?? '—', icon: UserCheck, tone: 'green' },
          { label: 'Suspended', value: c.inactive ?? '—', icon: ClipboardText, tone: 'amber' },
          { label: 'New This Month', value: c.newThisMonth ?? '—', icon: Sparkle, tone: 'purple' },
        ]} />
      )}

      <div className="toolbar">
        <input type="text" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div style={{ marginLeft: 'auto' }}><ViewToggle view={view} onChange={setView} /></div>
      </div>

      {L.loading ? <SkeletonTable cols={6} /> : view === 'cards' ? (
        <>
          {!L.data.length ? <div className="empty">No patients found</div> : (
            <div className="entity-grid">
              {L.data.map((p) => (
                <div key={p._id} className="entity-card">
                  <div className="ec-top clickable" onClick={() => nav(`/patients/${p._id}`)}>
                    {p.profileImage ? <img className="ec-avatar" src={imgUrl(p.profileImage)} alt="" /> : <div className="ec-avatar" />}
                    <div style={{ minWidth: 0 }}>
                      <div className="ec-name">{p.fullName || '—'}{p.isBlocked && <span className="badge red" style={{ marginLeft: 6 }}>Suspended</span>}</div>
                      <div className="ec-sub">Joined {fmtDate(p.userId?.createdAt || p.createdAt)}</div>
                    </div>
                  </div>
                  <div className="ec-rows">
                    <div className="ec-row"><EnvelopeSimple size={14} />{p.userId?.email || '—'}</div>
                    <div className="ec-row"><Phone size={14} />{p.mobileNumber || '—'}</div>
                    <div className="ec-row"><MapPin size={14} />{p.city || '—'}</div>
                    <div className="ec-row"><GenderIntersex size={14} /><span style={{ textTransform: 'capitalize' }}>{p.gender || '—'}</span></div>
                  </div>
                  <div className="ec-foot">
                    <span className="badge green">Active</span>
                    <div className="ec-actions">
                      <button className="icon-btn" title="View" onClick={() => nav(`/patients/${p._id}`)}><Eye size={16} /></button>
                      <button className="icon-btn" title="Give Points" onClick={() => setGivePointsFor(p)}><Gift size={16} /></button>
                      <button className="icon-btn del" title="Delete" onClick={() => del(p)}><Trash size={16} /></button>
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
              <th>#</th><th>Patient</th><th>Gender</th><th>Phone</th><th>Login Email</th>
              <th>Password</th><th>Location</th><th>Status</th><th>Registered On</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {L.data.map((p, i) => {
                const pw = pwMap[p._id];
                return (
                <tr key={p._id}>
                  <td className="muted">{(L.page - 1) * 10 + i + 1}</td>
                  <td><UserCell name={p.fullName} sub={p.userId?.email} img={p.profileImage} onClick={() => nav(`/patients/${p._id}`)} /></td>
                  <td><GenderTag value={p.gender} /></td>
                  <td>{p.mobileNumber || '—'}</td>
                  <td>{p.userId?.email || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <code style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: pw?.show && pw?.value ? 0 : 2 }}>
                        {pw?.show && pw?.value ? pw.value : '••••••••'}
                      </code>
                      <button className="icon-btn" title={pw?.value ? (pw.show ? 'Hide' : 'Show') : 'Encrypted — use Reset'} onClick={() => toggleShow(p)}>
                        {pw?.show ? <EyeSlash size={15} /> : <Eye size={15} />}
                      </button>
                      <button className="icon-btn" title="Reset password" onClick={() => setResetFor(p)}><Key size={15} /></button>
                    </div>
                  </td>
                  <td>{p.city || '—'}</td>
                  <td><span className={`badge ${p.isBlocked ? 'red' : 'green'}`}>{p.isBlocked ? 'Suspended' : 'Active'}</span></td>
                  <td>{fmtDate(p.userId?.createdAt || p.createdAt)}</td>
                  <td className="row-actions">
                    <button className="btn ghost" style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={() => nav(`/patients/${p._id}`)}>
                      <Eye size={14} style={{ marginRight: 4, verticalAlign: -2 }} />View User Details
                    </button>
                    <button className="icon-btn" title="Give Points" onClick={() => setGivePointsFor(p)}><Gift size={16} /></button>
                    <button className="icon-btn del" title="Delete" onClick={() => del(p)}><Trash size={16} /></button>
                  </td>
                </tr>
                );
              })}
              {!L.data.length && <tr><td colSpan={10} className="empty">No patients found</td></tr>}
            </tbody>
          </table>
          </div>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}

      {showAdd && <AddPatient onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); L.reload(); toast('Patient created'); }} toast={toast} />}
      {resetFor && <ResetPasswordModal p={resetFor} onClose={() => setResetFor(null)} onReset={(pw) => onReset(resetFor, pw)} toast={toast} />}
      {givePointsFor && <GivePointsModal preSelected={givePointsFor === 'pick' ? null : givePointsFor} onClose={() => setGivePointsFor(null)} onSaved={() => { setGivePointsFor(null); L.reload(); }} toast={toast} />}
    </div>
  );
}

function GivePointsModal({ preSelected, onClose, onSaved, toast }) {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(preSelected || null);
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Load patients once for the picker (only when not pre-selected from a row).
  useEffect(() => {
    if (!preSelected) {
      api.get('/api/admin/patients', { params: { limit: 200 } })
        .then((r) => setPatients(r.data.data || []))
        .catch(() => {});
    }
  }, [preSelected]);

  const filtered = patients.filter((p) =>
    !search || p.fullName?.toLowerCase().includes(search.toLowerCase()) || p.userId?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const submit = async () => {
    if (!selected) return toast('Select a patient first', 'error');
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts === 0) return toast('Enter a non-zero number of points', 'error');
    setBusy(true);
    try {
      await api.patch(`/api/admin/patients/${selected._id}/points`, { addPoints: pts, note });
      toast(`${pts > 0 ? '+' : ''}${pts} pts ${pts > 0 ? 'given to' : 'deducted from'} ${selected.fullName}`);
      onSaved();
    } catch (e) {
      toast(e.response?.data?.message || 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Give Points to Patient"
      onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || !selected || !points} onClick={submit}>
          {busy ? 'Saving…' : 'Give Points'}
        </button>
      </>}
    >
      {/* Patient picker — hidden when pre-selected from a row action */}
      {!preSelected && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Select Patient</label>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', marginBottom: 8 }}
          />
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {filtered.length === 0 && <div className="muted" style={{ padding: '10px 14px', fontSize: 13 }}>No patients found</div>}
            {filtered.map((p) => (
              <div
                key={p._id}
                onClick={() => setSelected(p)}
                style={{
                  padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                  background: selected?._id === p._id ? 'var(--blue)' : 'transparent',
                  color: selected?._id === p._id ? '#fff' : 'inherit',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <strong>{p.fullName}</strong>
                <span style={{ marginLeft: 8, opacity: 0.7 }}>{p.userId?.email || p.city || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected patient summary */}
      {selected && (
        <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          <strong>{selected.fullName}</strong>
          <span style={{ marginLeft: 8, color: '#64748B' }}>{selected.userId?.email || selected.city || ''}</span>
        </div>
      )}

      <Field
        label="Points to Add (use negative to deduct)"
        type="number"
        value={points}
        onChange={setPoints}
        placeholder="e.g. 500"
      />
      <Field
        label="Note (optional)"
        value={note}
        onChange={setNote}
        placeholder="Reason for this adjustment…"
      />
    </Modal>
  );
}

function ResetPasswordModal({ p, onClose, onReset, toast }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const generate = () => setPassword('Pat' + Math.random().toString(36).slice(2, 10));
  const submit = async () => {
    setBusy(true);
    try {
      const body = password.trim() ? { password: password.trim() } : {};
      const r = await api.patch(`/api/admin/patients/${p._id}/reset-password`, body);
      const np = r.data.data.password;
      setResult(np); onReset(np); toast('Password reset');
    } catch (e) { toast(e.response?.data?.message || 'Failed to reset', 'error'); }
    finally { setBusy(false); }
  };
  const copy = () => { navigator.clipboard?.writeText(result); toast('Copied'); };

  return (
    <Modal
      title={`Reset Password — ${p.fullName}`}
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
          <p className="muted" style={{ marginBottom: 10 }}>New password set. Share it with the patient — it can't be shown again (passwords are encrypted).</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ fontFamily: 'monospace', fontSize: 16, background: '#EFF6FF', padding: '8px 12px', borderRadius: 8 }}>{result}</code>
            <button className="btn ghost" onClick={copy}>Copy</button>
          </div>
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 12 }}>Set a new login password for <b>{p.userId?.email || 'this patient'}</b>. Leave blank to auto-generate. Existing passwords are encrypted and can't be displayed.</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><Field label="New Password (optional)" value={password} onChange={setPassword} placeholder="Auto-generate if blank" /></div>
            <button className="btn ghost" onClick={generate} style={{ marginBottom: 2, whiteSpace: 'nowrap' }}><ArrowsClockwise size={15} style={{ marginRight: 4, verticalAlign: -2 }} />Generate</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function AddPatient({ onClose, onSaved, toast }) {
  const [f, setF] = useState({ fullName: '', email: '', password: '', mobileNumber: '', gender: '', city: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    if (!f.fullName || !f.email || !f.password) return toast('Name, email and password are required', 'error');
    setBusy(true);
    try { await api.post('/api/admin/patients', f); onSaved(); }
    catch (e) { toast(e.response?.data?.message || 'Failed to create', 'error'); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Add New Patient" onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Create Patient'}</button>
      </>}>
      <Field label="Full Name" value={f.fullName} onChange={set('fullName')} required />
      <div className="field-row">
        <Field label="Email" type="email" value={f.email} onChange={set('email')} required />
        <Field label="Password" type="password" value={f.password} onChange={set('password')} required />
      </div>
      <div className="field-row">
        <Field label="Phone" value={f.mobileNumber} onChange={set('mobileNumber')} />
        <Field label="Gender" type="select" value={f.gender} onChange={set('gender')}
          options={[{ value: '', label: 'Select' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
      </div>
      <Field label="City" value={f.city} onChange={set('city')} />
    </Modal>
  );
}
