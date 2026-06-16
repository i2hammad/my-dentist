import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooth, SealCheck, Clock, Sparkle, Check, Trash, Eye, Plus } from '@phosphor-icons/react';
import api from '../lib/api';
import useList from '../lib/useList';
import { PageHeader, StatCards, UserCell, Pagination, fmtDate, PopularBadge } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import Modal from '../components/Modal.jsx';
import Field from '../components/Field.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

export default function Dentists() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const L = useList('/api/admin/dentists', { search, status });
  const c = L.counts;
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const [showAdd, setShowAdd] = useState(false);

  const approve = async (d) => {
    try { await L.patch(d._id, { pmdcVerified: true }); toast(`${d.fullName} approved`); }
    catch { toast('Failed to approve', 'error'); }
  };

  const del = async (d) => {
    if (!(await confirm({ title: 'Delete Dentist', message: `Permanently delete ${d.fullName} and their account?`, confirmText: 'Delete', destructive: true }))) return;
    try { await L.remove(d._id); toast(`${d.fullName} deleted`); }
    catch { toast('Failed to delete', 'error'); }
  };

  return (
    <div className="card">
      <PageHeader title="Dentists" crumb="Dentists"
        actions={<button className="btn primary" onClick={() => setShowAdd(true)}><Plus size={16} weight="bold" style={{ marginRight: 6, verticalAlign: -2 }} />Add New Dentist</button>} />

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
      </div>

      {L.loading ? <SkeletonTable cols={6} /> : (
        <>
          <table>
            <thead><tr><th>Dentist</th><th>Specialization</th><th>City</th><th>Verification</th><th>Popular</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {L.data.map((d) => (
                <tr key={d._id}>
                  <td><UserCell name={d.fullName} sub={d.userId?.email} img={d.photo} /></td>
                  <td>{d.specialization || '—'}</td>
                  <td>{d.city || '—'}</td>
                  <td><span className={`badge ${d.pmdcVerified ? 'green' : 'amber'}`}>{d.pmdcVerified ? 'Verified' : 'Pending'}</span></td>
                  <td>{d.popularType ? <PopularBadge type={d.popularType} /> : <span className="muted">—</span>}</td>
                  <td>{fmtDate(d.userId?.createdAt || d.createdAt)}</td>
                  <td className="row-actions">
                    <button className="icon-btn" title="View" onClick={() => nav(`/dentists/${d._id}`)}><Eye size={16} /></button>
                    {!d.pmdcVerified && <button className="icon-btn" title="Approve" onClick={() => approve(d)}><Check size={16} /></button>}
                    <button className="icon-btn del" title="Delete" onClick={() => del(d)}><Trash size={16} /></button>
                  </td>
                </tr>
              ))}
              {!L.data.length && <tr><td colSpan={7} className="empty">No dentists found</td></tr>}
            </tbody>
          </table>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}

      {showAdd && <AddDentist onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); L.reload(); toast('Dentist created'); }} toast={toast} />}
    </div>
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
