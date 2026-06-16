import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Sparkle, UserCheck, ClipboardText, Trash, Eye, Plus } from '@phosphor-icons/react';
import api from '../lib/api';
import useList from '../lib/useList';
import { PageHeader, StatCards, UserCell, Pagination, fmtDate } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import Modal from '../components/Modal.jsx';
import Field from '../components/Field.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

export default function Patients() {
  const [search, setSearch] = useState('');
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
        actions={<button className="btn primary" onClick={() => setShowAdd(true)}><Plus size={16} weight="bold" style={{ marginRight: 6, verticalAlign: -2 }} />Add New Patient</button>} />

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
      </div>

      {L.loading ? <SkeletonTable cols={6} /> : (
        <>
          <table>
            <thead><tr><th>Patient</th><th>Phone</th><th>Gender</th><th>City</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {L.data.map((p) => (
                <tr key={p._id}>
                  <td><UserCell name={p.fullName} sub={p.userId?.email} img={p.profileImage} /></td>
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
