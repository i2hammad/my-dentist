import { useEffect, useState } from 'react';
import { Megaphone, Eye, CursorClick, TrendUp, Plus, PencilSimple, Trash, Sparkle } from '@phosphor-icons/react';
import api, { imgUrl, API_URL } from '../lib/api';
import { PageHeader, StatCards, fmtDate } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import Modal from '../components/Modal.jsx';
import Field from '../components/Field.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

export default function PatientCampaigns() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [counts, setCounts] = useState({});
  const [edit, setEdit] = useState(null);
  const [rotationInterval, setRotationInterval] = useState(10);
  const [savingInterval, setSavingInterval] = useState(false);

  const load = () => api.get('/api/campaigns/patient-admin')
    .then((r) => { setData(r.data.data); setCounts(r.data.counts || {}); })
    .catch(() => setData([]));

  useEffect(() => {
    load();
    api.get('/api/admin/settings').then(r => {
      if (r.data?.data?.campaignRotationInterval) setRotationInterval(r.data.data.campaignRotationInterval);
    }).catch(() => {});
  }, []);

  const saveInterval = async () => {
    setSavingInterval(true);
    try {
      await api.put('/api/admin/settings', { campaignRotationInterval: Number(rotationInterval) });
      toast('Rotation interval saved');
    } catch { toast('Failed to save', 'error'); }
    finally { setSavingInterval(false); }
  };

  const toggle = async (c) => {
    try { await api.patch(`/api/campaigns/patient-admin/${c._id}`, { isActive: !c.isActive }); toast(c.isActive ? 'Paused' : 'Activated'); load(); }
    catch { toast('Failed', 'error'); }
  };
  const del = async (c) => {
    if (!(await confirm({ title: 'Delete Campaign', message: `Delete "${c.title}"? Analytics will be lost.`, confirmText: 'Delete', destructive: true }))) return;
    try { await api.delete(`/api/campaigns/patient-admin/${c._id}`); toast('Campaign deleted'); load(); }
    catch { toast('Failed', 'error'); }
  };

  return (
    <div className="card">
      <PageHeader title="Patient Promotions" crumb="Patient Promotions"
        actions={<button className="btn primary" onClick={() => setEdit({})}><Plus size={16} weight="bold" style={{ marginRight: 6, verticalAlign: -2 }} />New Campaign</button>} />

      {!data ? <SkeletonStatCards /> : (
        <StatCards items={[
          { label: 'Total Campaigns', value: counts.total ?? 0, icon: Megaphone, tone: 'blue' },
          { label: 'Live Now', value: counts.live ?? 0, icon: TrendUp, tone: 'green' },
          { label: 'Total Views', value: (counts.totalViews ?? 0).toLocaleString(), icon: Eye, tone: 'amber' },
          { label: 'Total Clicks', value: (counts.totalClicks ?? 0).toLocaleString(), icon: CursorClick, tone: 'purple' },
        ]} />
      )}

      {!data ? <SkeletonTable cols={7} withUser={false} /> : (
        <table>
          <thead><tr><th>Campaign</th><th>Targeting</th><th>Schedule</th><th>Views</th><th>Clicks</th><th>CTR</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {data.map((c) => (
              <tr key={c._id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {c.bannerImage ? <img src={imgUrl(c.bannerImage)} alt="" style={{ width: 52, height: 36, borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 52, height: 36, borderRadius: 8, background: '#FDF2F8', display: 'grid', placeItems: 'center' }}><Sparkle size={18} color="#DB2777" /></div>}
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.title}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{c.company || '—'}</div>
                    </div>
                  </div>
                </td>
                <td>{c.cities?.length ? c.cities.join(', ') : <span className="muted">All cities</span>}</td>
                <td style={{ fontSize: 13 }}>{fmtDate(c.startAt)} → {fmtDate(c.endAt)}</td>
                <td style={{ fontWeight: 600 }}>{(c.views || 0).toLocaleString()}</td>
                <td style={{ fontWeight: 600 }}>{(c.clicks || 0).toLocaleString()}</td>
                <td>{c.ctr}%</td>
                <td><span className={`badge ${c.live ? 'green' : c.isActive ? 'amber' : 'gray'}`}>{c.live ? 'Live' : c.isActive ? 'Scheduled' : 'Paused'}</span></td>
                <td className="row-actions">
                  <button className="icon-btn" title={c.isActive ? 'Pause' : 'Activate'} onClick={() => toggle(c)}>{c.isActive ? '❚❚' : '▶'}</button>
                  <button className="icon-btn" title="Edit" onClick={() => setEdit(c)}><PencilSimple size={16} /></button>
                  <button className="icon-btn del" title="Delete" onClick={() => del(c)}><Trash size={16} /></button>
                </td>
              </tr>
            ))}
            {!data.length && <tr><td colSpan={8} className="empty">No patient campaigns yet. Create one to promote to patients.</td></tr>}
          </tbody>
        </table>
      )}

      {/* Rotation Interval Setting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid #E2E8F0', marginTop: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>⏱ Campaign Rotation Interval:</span>
        <input
          type="number" min={3} max={60} value={rotationInterval}
          onChange={e => setRotationInterval(e.target.value)}
          style={{ width: 70, padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14 }}
        />
        <span style={{ fontSize: 13, color: '#6B7280' }}>seconds (default: 10)</span>
        <button className="btn primary" onClick={saveInterval} disabled={savingInterval} style={{ padding: '6px 16px' }}>
          {savingInterval ? 'Saving…' : 'Save'}
        </button>
      </div>

      {edit && <CampaignForm c={edit} onClose={() => setEdit(null)}
        onSaved={() => { setEdit(null); load(); toast(edit._id ? 'Campaign updated' : 'Campaign created'); }} toast={toast} />}
    </div>
  );
}

const toLocalInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function CampaignForm({ c, onClose, onSaved, toast }) {
  const editing = !!c._id;
  const [f, setF] = useState({
    title: c.title || '', bannerText: c.bannerText || '', body: c.body || '',
    company: c.company || '',
    bannerImage: c.bannerImage || '', detailImage: c.detailImage || '',
    ctaLabel: c.ctaLabel || 'Learn More', ctaLink: c.ctaLink || '',
    cities: (c.cities || []).join(', '),
    startAt: toLocalInput(c.startAt) || toLocalInput(new Date().toISOString()),
    endAt: toLocalInput(c.endAt),
    isActive: c.isActive !== false,
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const upload = (key) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/api/users/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (data.success) { set(key)(data.data.url); toast('Image uploaded'); }
      else toast(data.message || 'Upload failed', 'error');
    } catch { toast('Upload failed', 'error'); }
  };

  const save = async () => {
    if (!f.title) return toast('Title is required', 'error');
    if (!f.startAt || !f.endAt) return toast('Start and end date/time are required', 'error');
    if (new Date(f.endAt) <= new Date(f.startAt)) return toast('End must be after start', 'error');
    setBusy(true);
    const payload = {
      ...f,
      cities: f.cities.split(',').map((s) => s.trim()).filter(Boolean),
      startAt: new Date(f.startAt).toISOString(),
      endAt: new Date(f.endAt).toISOString(),
    };
    try {
      if (editing) await api.patch(`/api/campaigns/patient-admin/${c._id}`, payload);
      else await api.post('/api/campaigns/patient-admin', payload);
      onSaved();
    } catch (e) { toast(e.response?.data?.message || 'Failed to save', 'error'); }
    finally { setBusy(false); }
  };

  const ImgField = ({ label, k }) => (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {f[k] ? <img src={imgUrl(f[k])} alt="" style={{ width: 64, height: 44, borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 64, height: 44, borderRadius: 8, background: '#F1F5F9' }} />}
        <label className="btn ghost sm" style={{ cursor: 'pointer' }}>Upload<input type="file" accept="image/*" hidden onChange={upload(k)} /></label>
      </div>
    </div>
  );

  return (
    <Modal title={editing ? 'Edit Patient Campaign' : 'New Patient Campaign'} size="lg" onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Create Campaign'}</button>
      </>}>
      <Field label="Campaign Title" value={f.title} onChange={set('title')} required placeholder="e.g. Free Teeth Whitening This Month" />
      <Field label="Banner Text (short — shown on the small banner)" value={f.bannerText} onChange={set('bannerText')} placeholder="e.g. Limited offer — book now!" />
      <Field label="Sponsor / Brand (optional)" value={f.company} onChange={set('company')} placeholder="e.g. Colgate, Oral-B" />
      <Field label="Full Promotional Details (shown on the detail page)" type="textarea" value={f.body} onChange={set('body')} placeholder="Write the full offer details patients will read…" />
      <div className="field-row"><ImgField label="Banner Image" k="bannerImage" /><ImgField label="Detail Page Image" k="detailImage" /></div>
      <div className="field-row">
        <Field label="CTA Button Label" value={f.ctaLabel} onChange={set('ctaLabel')} />
        <Field label="CTA Link (optional URL)" value={f.ctaLink} onChange={set('ctaLink')} placeholder="https://…" />
      </div>
      <Field label="Target Cities (comma-separated — leave blank for ALL patients)" value={f.cities} onChange={set('cities')} placeholder="Lahore, Karachi" />
      <div className="field-row">
        <Field label="Start Date & Time" type="datetime-local" value={f.startAt} onChange={set('startAt')} required />
        <Field label="End Date & Time" type="datetime-local" value={f.endAt} onChange={set('endAt')} required />
      </div>
      <Field label="Status" type="select" value={f.isActive ? 'active' : 'paused'} onChange={(v) => set('isActive')(v === 'active')}
        options={[{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }]} />
    </Modal>
  );
}
