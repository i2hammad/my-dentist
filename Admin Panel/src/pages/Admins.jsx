import { useState } from 'react';
import { ShieldCheck, UserCheck, Prohibit, Crown, Power, Trash, Plus } from '@phosphor-icons/react';
import api from '../lib/api';
import useList from '../lib/useList';
import { PageHeader, StatCards, UserCell, Pagination, fmtDate } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import Modal from '../components/Modal.jsx';
import Field from '../components/Field.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

export default function Admins() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const L = useList('/api/admin/admins', { search, status });
  const c = L.counts;
  const toast = useToast();
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);

  const toggle = async (a) => {
    try { await L.patch(a._id, { status: a.status === 'active' ? 'inactive' : 'active' }); toast('Status updated'); }
    catch { toast('Failed to update', 'error'); }
  };
  const del = async (a) => {
    if (!(await confirm({ title: 'Delete Admin', message: `Delete ${a.fullName}?`, confirmText: 'Delete', destructive: true }))) return;
    try { await L.remove(a._id); toast(`${a.fullName} deleted`); } catch { toast('Failed to delete', 'error'); }
  };

  return (
    <div className="card">
      <PageHeader title="Admins" crumb="Admins"
        actions={<button className="btn primary" onClick={() => setShowAdd(true)}><Plus size={16} weight="bold" style={{ marginRight: 6, verticalAlign: -2 }} />Add New Admin</button>} />

      {L.loading ? <SkeletonStatCards /> : (
        <StatCards items={[
          { label: 'Total Admins', value: c.total ?? '—', icon: ShieldCheck, tone: 'blue' },
          { label: 'Active', value: c.active ?? '—', icon: UserCheck, tone: 'green' },
          { label: 'Inactive', value: c.inactive ?? '—', icon: Prohibit, tone: 'amber' },
          { label: 'Super Admins', value: c.super ?? '—', icon: Crown, tone: 'purple' },
        ]} />
      )}

      <div className="toolbar">
        <input type="text" placeholder="Search admins…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
      </div>

      {L.loading ? <SkeletonTable cols={6} /> : (
        <>
          <table>
            <thead><tr><th>Admin</th><th>Role</th><th>Status</th><th>Last Login</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {L.data.map((a) => (
                <tr key={a._id}>
                  <td><UserCell name={a.fullName} sub={a.userId?.email} img={a.profileImage} /></td>
                  <td><span className={`badge ${a.adminRole === 'super_admin' ? 'purple' : 'blue'}`}>{a.adminRole === 'super_admin' ? 'Super Admin' : 'Admin'}</span></td>
                  <td><span className={`badge ${a.status === 'active' ? 'green' : 'gray'}`}>{a.status}</span></td>
                  <td>{a.lastLogin ? fmtDate(a.lastLogin) : '—'}</td>
                  <td>{fmtDate(a.createdAt)}</td>
                  <td className="row-actions">
                    <button className="icon-btn" title="Toggle status" onClick={() => toggle(a)}><Power size={16} /></button>
                    {a.adminRole !== 'super_admin' && <button className="icon-btn del" title="Delete" onClick={() => del(a)}><Trash size={16} /></button>}
                  </td>
                </tr>
              ))}
              {!L.data.length && <tr><td colSpan={6} className="empty">No admins found</td></tr>}
            </tbody>
          </table>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}

      {showAdd && <AddAdmin onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); L.reload(); toast('Admin created'); }} toast={toast} />}
    </div>
  );
}

function AddAdmin({ onClose, onSaved, toast }) {
  const [f, setF] = useState({ fullName: '', email: '', password: '', adminRole: 'admin' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    if (!f.fullName || !f.email || !f.password) return toast('All fields are required', 'error');
    setBusy(true);
    try { await api.post('/api/admin/admins', f); onSaved(); }
    catch (e) { toast(e.response?.data?.message || 'Failed to create', 'error'); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Add New Admin" onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Create Admin'}</button>
      </>}>
      <Field label="Full Name" value={f.fullName} onChange={set('fullName')} required />
      <div className="field-row">
        <Field label="Email" type="email" value={f.email} onChange={set('email')} required />
        <Field label="Password" type="password" value={f.password} onChange={set('password')} required />
      </div>
      <Field label="Role" type="select" value={f.adminRole} onChange={set('adminRole')}
        options={[{ value: 'admin', label: 'Admin' }, { value: 'super_admin', label: 'Super Admin' }]} />
    </Modal>
  );
}
