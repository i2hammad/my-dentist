import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Sparkle, UserCheck, ClipboardText, Trash, Eye, Plus, MapPin, Phone, EnvelopeSimple, GenderIntersex } from '@phosphor-icons/react';
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

  const del = async (p) => {
    if (!(await confirm({ title: 'Delete Patient', message: `Permanently delete ${p.fullName}?`, confirmText: 'Delete', destructive: true }))) return;
    try { await L.remove(p._id); toast(`${p.fullName} deleted`); } catch { toast('Failed to delete', 'error'); }
  };

  return (
    <div className="card">
      <PageHeader title="Patients" crumb="Patients"
        actions={<>
          <ExportButton path="/api/admin/patients" params={{ search }} columns={PATIENT_CSV_COLS} filename="patients.csv" />
          <button className="btn primary" onClick={() => setShowAdd(true)}><Plus size={16} weight="bold" style={{ marginRight: 6, verticalAlign: -2 }} />Add New Patient</button>
        </>} />

      {L.loading ? <SkeletonStatCards /> : (
        <StatCards items={[
          { label: 'Total Patients', value: c.total ?? '—', icon: Users, tone: 'blue' },
          { label: 'New This Month', value: c.newThisMonth ?? '—', icon: Sparkle, tone: 'green' },
          { label: 'Active', value: c.total ?? '—', icon: UserCheck, tone: 'amber' },
          { label: 'Registered', value: c.total ?? '—', icon: ClipboardText, tone: 'purple' },
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
                      <div className="ec-name">{p.fullName || '—'}</div>
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
          <table>
            <thead><tr><th>Patient</th><th>Phone</th><th>Gender</th><th>City</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {L.data.map((p) => (
                <tr key={p._id}>
                  <td><UserCell name={p.fullName} sub={p.userId?.email} img={p.profileImage} onClick={() => nav(`/patients/${p._id}`)} /></td>
                  <td>{p.mobileNumber || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.gender || '—'}</td>
                  <td>{p.city || '—'}</td>
                  <td>{fmtDate(p.userId?.createdAt || p.createdAt)}</td>
                  <td className="row-actions">
                    <button className="icon-btn" title="View" onClick={() => nav(`/patients/${p._id}`)}><Eye size={16} /></button>
                    <button className="icon-btn del" title="Delete" onClick={() => del(p)}><Trash size={16} /></button>
                  </td>
                </tr>
              ))}
              {!L.data.length && <tr><td colSpan={6} className="empty">No patients found</td></tr>}
            </tbody>
          </table>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}

      {showAdd && <AddPatient onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); L.reload(); toast('Patient created'); }} toast={toast} />}
    </div>
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
