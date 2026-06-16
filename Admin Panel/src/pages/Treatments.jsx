import { useEffect, useState } from 'react';
import { Heartbeat, CheckCircle, XCircle, Sparkle, Trash, PencilSimple, Plus } from '@phosphor-icons/react';
import api from '../lib/api';
import useList from '../lib/useList';
import { PageHeader, StatCards, Pagination, fmtDate } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import Modal from '../components/Modal.jsx';
import Field from '../components/Field.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

export default function Treatments() {
  const [search, setSearch] = useState('');
  const L = useList('/api/admin/treatments', { search });
  const c = L.counts;
  const toast = useToast();
  const confirm = useConfirm();
  const [edit, setEdit] = useState(null); // null | {} (new) | treatment (edit)

  const del = async (t) => {
    if (!(await confirm({ title: 'Delete Treatment', message: `Delete "${t.name}"?`, confirmText: 'Delete', destructive: true }))) return;
    try { await L.remove(t._id); toast('Treatment deleted'); } catch { toast('Failed to delete', 'error'); }
  };

  return (
    <div className="card">
      <PageHeader title="Treatments" crumb="Treatments"
        actions={<button className="btn primary" onClick={() => setEdit({})}><Plus size={16} weight="bold" style={{ marginRight: 6, verticalAlign: -2 }} />Add New Treatment</button>} />

      {L.loading ? <SkeletonStatCards /> : (
        <StatCards items={[
          { label: 'Total Treatments', value: c.total ?? '—', icon: Heartbeat, tone: 'blue' },
          { label: 'Active', value: c.active ?? '—', icon: CheckCircle, tone: 'green' },
          { label: 'Inactive', value: c.inactive ?? '—', icon: XCircle, tone: 'amber' },
          { label: 'New This Month', value: c.newThisMonth ?? '—', icon: Sparkle, tone: 'purple' },
        ]} />
      )}

      <div className="toolbar">
        <input type="text" placeholder="Search by treatment name…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {L.loading ? <SkeletonTable cols={7} withUser={false} /> : (
        <>
          <table>
            <thead><tr><th>#</th><th>Treatment</th><th>Dentist</th><th>Price (PKR)</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {L.data.map((t, i) => (
                <tr key={t._id}>
                  <td className="muted">{(L.page - 1) * 10 + i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{t.name || '—'}</td>
                  <td>{t.doctorId?.fullName || '—'}</td>
                  <td>{t.priceMin?.toLocaleString()} – {t.priceMax?.toLocaleString()}</td>
                  <td><span className={`badge ${t.isActive ? 'green' : 'gray'}`}>{t.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>{fmtDate(t.createdAt)}</td>
                  <td className="row-actions">
                    <button className="icon-btn" title="Edit" onClick={() => setEdit(t)}><PencilSimple size={16} /></button>
                    <button className="icon-btn del" title="Delete" onClick={() => del(t)}><Trash size={16} /></button>
                  </td>
                </tr>
              ))}
              {!L.data.length && <tr><td colSpan={7} className="empty">No treatments found</td></tr>}
            </tbody>
          </table>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}

      {edit && <TreatmentForm t={edit} onClose={() => setEdit(null)}
        onSaved={() => { setEdit(null); L.reload(); toast(edit._id ? 'Treatment updated' : 'Treatment created'); }} toast={toast} />}
    </div>
  );
}

function TreatmentForm({ t, onClose, onSaved, toast }) {
  const editing = !!t._id;
  const [f, setF] = useState({ name: t.name || '', priceMin: t.priceMin || 0, priceMax: t.priceMax || 0, doctorId: t.doctorId?._id || t.doctorId || '', isActive: t.isActive !== false });
  const [dentists, setDentists] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!editing) api.get('/api/admin/dentists', { params: { limit: 100 } }).then((r) => setDentists(r.data.data)).catch(() => {});
  }, [editing]);

  const save = async () => {
    if (!f.name) return toast('Treatment name is required', 'error');
    if (!editing && !f.doctorId) return toast('Select a dentist', 'error');
    setBusy(true);
    try {
      if (editing) await api.patch(`/api/admin/treatments/${t._id}`, { name: f.name, priceMin: Number(f.priceMin), priceMax: Number(f.priceMax), isActive: f.isActive });
      else await api.post('/api/admin/treatments', { ...f, priceMin: Number(f.priceMin), priceMax: Number(f.priceMax) });
      onSaved();
    } catch (e) { toast(e.response?.data?.message || 'Failed to save', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={editing ? 'Edit Treatment' : 'Add New Treatment'} onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Create'}</button>
      </>}>
      <Field label="Treatment Name" value={f.name} onChange={set('name')} required />
      {!editing && (
        <Field label="Dentist" type="select" value={f.doctorId} onChange={set('doctorId')}
          options={[{ value: '', label: 'Select dentist' }, ...dentists.map((d) => ({ value: d._id, label: d.fullName }))]} />
      )}
      <div className="field-row">
        <Field label="Min Price (PKR)" type="number" value={f.priceMin} onChange={set('priceMin')} />
        <Field label="Max Price (PKR)" type="number" value={f.priceMax} onChange={set('priceMax')} />
      </div>
      <Field label="Status" type="select" value={f.isActive ? 'active' : 'inactive'} onChange={(v) => set('isActive')(v === 'active')}
        options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
    </Modal>
  );
}
