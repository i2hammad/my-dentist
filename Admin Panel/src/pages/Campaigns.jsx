import { useEffect, useState } from 'react';
import { Megaphone, Eye, CursorClick, TrendUp, Plus, PencilSimple, Trash, Pill } from '@phosphor-icons/react';
import api, { imgUrl, API_URL } from '../lib/api';
import { compressAndUpload, formatBytes } from '../lib/imageUpload';
import { PageHeader, StatCards, Pagination, fmtDate } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import Modal from '../components/Modal.jsx';
import { ZoomImg } from '../components/Lightbox.jsx';
import Field from '../components/Field.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

export default function Campaigns() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [counts, setCounts] = useState({});
  const [edit, setEdit] = useState(null); // null | {} (new) | campaign (edit)
  const [view, setView] = useState(null); // null | campaign (read-only preview)
  const [rotationInterval, setRotationInterval] = useState(10);
  const [savingInterval, setSavingInterval] = useState(false);

  const load = () => api.get('/api/campaigns/admin')
    .then((r) => { setData(r.data.data); setCounts(r.data.counts || {}); })
    .catch(() => setData([]));
  useEffect(() => {
    load();
    api.get('/api/admin/settings').then((r) => {
      if (r.data?.data?.doctorCampaignRotationInterval) setRotationInterval(r.data.data.doctorCampaignRotationInterval);
    }).catch(() => {});
  }, []);

  const saveInterval = async () => {
    setSavingInterval(true);
    try {
      await api.patch('/api/admin/settings', { doctorCampaignRotationInterval: Number(rotationInterval) });
      toast('Rotation interval saved');
    } catch { toast('Failed to save', 'error'); }
    finally { setSavingInterval(false); }
  };

  const toggle = async (c) => {
    try { await api.patch(`/api/campaigns/admin/${c._id}`, { isActive: !c.isActive }); toast(c.isActive ? 'Paused' : 'Activated'); load(); }
    catch { toast('Failed', 'error'); }
  };
  const del = async (c) => {
    if (!(await confirm({ title: 'Delete Campaign', message: `Delete “${c.title}”? Analytics will be lost.`, confirmText: 'Delete', destructive: true }))) return;
    try { await api.delete(`/api/campaigns/admin/${c._id}`); toast('Campaign deleted'); load(); }
    catch { toast('Failed', 'error'); }
  };

  return (
    <div className="card">
      <PageHeader title="Promotions" crumb="Promotions"
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
        <div className="table-scroll">
        <table>
          <thead><tr><th>Campaign</th><th>Targeting</th><th>Schedule</th><th>Views</th><th>Clicks</th><th>CTR</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {data.map((c) => (
              <tr key={c._id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {c.bannerImage ? <ZoomImg src={c.bannerImage} alt={c.title} caption={c.title} style={{ width: 52, height: 36, borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 52, height: 36, borderRadius: 8, background: '#EDE9FE', display: 'grid', placeItems: 'center' }}><Pill size={18} color="#8B5CF6" /></div>}
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.title}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{c.medicineName || c.company || '—'}</div>
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
                  <button className="icon-btn" title="Preview" onClick={() => setView(c)}><Eye size={16} /></button>
                  <button className="icon-btn" title={c.isActive ? 'Pause' : 'Activate'} onClick={() => toggle(c)}>{c.isActive ? '❚❚' : '▶'}</button>
                  <button className="icon-btn" title="Edit" onClick={() => setEdit(c)}><PencilSimple size={16} /></button>
                  <button className="icon-btn del" title="Delete" onClick={() => del(c)}><Trash size={16} /></button>
                </td>
              </tr>
            ))}
            {!data.length && <tr><td colSpan={8} className="empty">No campaigns yet. Create one to promote to doctors.</td></tr>}
          </tbody>
        </table>
        </div>
      )}

      {/* Rotation Interval Setting (doctor promotions) */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '12px 0', borderTop: '1px solid #E2E8F0', marginTop: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>⏱ Campaign Rotation Interval:</span>
        <input
          type="number" min={3} max={60} value={rotationInterval}
          onChange={(e) => setRotationInterval(e.target.value)}
          style={{ width: 70, padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14 }}
        />
        <span style={{ fontSize: 13, color: '#6B7280' }}>seconds (default: 10)</span>
        <button className="btn primary" onClick={saveInterval} disabled={savingInterval} style={{ padding: '6px 16px' }}>
          {savingInterval ? 'Saving…' : 'Save'}
        </button>
      </div>

      {edit && <CampaignForm c={edit} onClose={() => setEdit(null)}
        onSaved={() => { setEdit(null); load(); toast(edit._id ? 'Campaign updated' : 'Campaign created'); }} toast={toast} />}

      {view && <CampaignPreview c={view} onClose={() => setView(null)} />}
    </div>
  );
}

// Read-only preview of a campaign the way doctors see it. Renders the row we already have — no extra fetch.
function CampaignPreview({ c, onClose }) {
  const img = c.detailImage || c.bannerImage;
  return (
    <Modal title="Campaign Preview" size="lg" onClose={onClose}
      footer={<button className="btn ghost" onClick={onClose}>Close</button>}>
      {img
        ? <ZoomImg src={img} alt={c.title} caption={c.title} style={{ width: '100%', maxHeight: 220, borderRadius: 12, objectFit: 'cover', marginBottom: 16 }} />
        : <div style={{ width: '100%', height: 160, borderRadius: 12, background: '#EDE9FE', display: 'grid', placeItems: 'center', marginBottom: 16 }}><Pill size={40} color="#8B5CF6" /></div>}

      <h3 style={{ margin: '0 0 4px' }}>{c.title}</h3>
      {c.bannerText && <div className="muted" style={{ marginBottom: 12 }}>{c.bannerText}</div>}
      {c.body && <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: '0 0 16px' }}>{c.body}</p>}

      {c.ctaLabel && <div style={{ marginBottom: 16 }}>
        <span className="btn primary" style={{ pointerEvents: 'none' }}>{c.ctaLabel}</span>
        {c.ctaLink && <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>→ {c.ctaLink}</span>}
      </div>}

      <div className="detail-grid">
        {(c.medicineName || c.company) && <div><div className="k">Product</div><div className="v">{[c.medicineName, c.company].filter(Boolean).join(' · ')}</div></div>}
        <div><div className="k">Target Cities</div><div className="v">{c.cities?.length ? c.cities.join(', ') : 'All cities'}</div></div>
        <div><div className="k">Schedule</div><div className="v">{fmtDate(c.startAt)} → {fmtDate(c.endAt)}</div></div>
        <div><div className="k">Status</div><div className="v"><span className={`badge ${c.live ? 'green' : c.isActive ? 'amber' : 'gray'}`}>{c.live ? 'Live' : c.isActive ? 'Scheduled' : 'Paused'}</span></div></div>
        <div><div className="k">Views</div><div className="v">{(c.views || 0).toLocaleString()}</div></div>
        <div><div className="k">Clicks</div><div className="v">{(c.clicks || 0).toLocaleString()}</div></div>
        <div><div className="k">CTR</div><div className="v">{c.ctr}%</div></div>
      </div>
    </Modal>
  );
}

// Convert a Date/ISO to the value a datetime-local input expects.
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
    medicineName: c.medicineName || '', company: c.company || '',
    bannerImage: c.bannerImage || '', detailImage: c.detailImage || '',
    ctaLabel: c.ctaLabel || 'Learn More', ctaLink: c.ctaLink || '',
    cities: (c.cities || []).join(', '),
    startAt: toLocalInput(c.startAt) || toLocalInput(new Date().toISOString()),
    endAt: toLocalInput(c.endAt),
    isActive: c.isActive !== false,
  });
  const [busy, setBusy] = useState(false);
  // Per-field upload state: { stage:'compressing'|'uploading'|'done'|'error', percent, origSize, size, error }
  const [up, setUp] = useState({});
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const upload = (key) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // allow re-selecting the same file
    setUp((s) => ({ ...s, [key]: { stage: 'compressing', percent: 0, origSize: file.size } }));
    try {
      const url = await compressAndUpload(file, {
        onCompressed: ({ origSize, size }) => setUp((s) => ({ ...s, [key]: { ...s[key], stage: 'uploading', origSize, size, percent: 0 } })),
        onProgress: (percent) => setUp((s) => ({ ...s, [key]: { ...s[key], percent } })),
      });
      set(key)(url);
      setUp((s) => ({ ...s, [key]: { ...s[key], stage: 'done', percent: 100 } }));
      toast('Image uploaded');
    } catch (err) {
      setUp((s) => ({ ...s, [key]: { stage: 'error', error: err.message || 'Upload failed' } }));
      toast(err.message || 'Upload failed', 'error');
    }
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
      if (editing) await api.patch(`/api/campaigns/admin/${c._id}`, payload);
      else await api.post('/api/campaigns/admin', payload);
      onSaved();
    } catch (e) { toast(e.response?.data?.message || 'Failed to save', 'error'); }
    finally { setBusy(false); }
  };

  const ImgField = ({ label, k, hint }) => {
    const u = up[k];
    const busyUp = u && (u.stage === 'compressing' || u.stage === 'uploading');
    return (
      <div className="field">
        <label>{label}</label>
        {hint && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: -2, marginBottom: 6 }}>{hint}</div>}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {f[k] ? <img src={imgUrl(f[k])} alt="" style={{ width: 64, height: 44, borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 64, height: 44, borderRadius: 8, background: '#F1F5F9' }} />}
          <label className="btn ghost sm" style={{ cursor: busyUp ? 'default' : 'pointer', opacity: busyUp ? 0.6 : 1 }}>
            {busyUp ? 'Uploading…' : (f[k] ? 'Replace' : 'Upload')}
            <input type="file" accept="image/*" hidden disabled={busyUp} onChange={upload(k)} />
          </label>
        </div>
        {u && (
          <div style={{ marginTop: 8 }}>
            {busyUp && (
              <>
                <div style={{ height: 6, borderRadius: 3, background: '#E8EFFF', overflow: 'hidden' }}>
                  <div style={{ height: 6, borderRadius: 3, background: '#0052FF', width: `${u.stage === 'uploading' ? (u.percent || 0) : 10}%`, transition: 'width .15s' }} />
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                  {u.stage === 'compressing' ? 'Optimizing image…' : `Uploading ${u.percent || 0}%`}
                  {u.origSize && u.size ? ` · ${formatBytes(u.origSize)} → ${formatBytes(u.size)} (−${Math.max(0, Math.round((1 - u.size / u.origSize) * 100))}%)` : ''}
                </div>
              </>
            )}
            {u.stage === 'done' && (
              <div style={{ fontSize: 11, color: '#16A34A', marginTop: 4 }}>
                ✓ Uploaded{u.origSize && u.size ? ` · ${formatBytes(u.origSize)} → ${formatBytes(u.size)}` : ''}
              </div>
            )}
            {u.stage === 'error' && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{u.error}</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal title={editing ? 'Edit Campaign' : 'New Campaign'} size="lg" onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Create Campaign'}</button>
      </>}>
      <Field label="Campaign Title" value={f.title} onChange={set('title')} required placeholder="e.g. DentoFresh Toothpaste Promo" />
      <Field label="Banner Text (short — shown on the small banner)" value={f.bannerText} onChange={set('bannerText')} placeholder="New! 20% off for clinics" />
      <div className="field-row">
        <Field label="Medicine / Product" value={f.medicineName} onChange={set('medicineName')} />
        <Field label="Company" value={f.company} onChange={set('company')} />
      </div>
      <Field label="Full Marketing Details (shown on the detail page)" type="textarea" value={f.body} onChange={set('body')} placeholder="Write the full promotional content doctors will read…" />
      <div className="field-row">
        <ImgField label="Banner Image" k="bannerImage" hint="Wide banner · recommended 1200×300px (4:1). Cropped to fill." />
        <ImgField label="Detail Page Image" k="detailImage" hint="Recommended 1080×1080px (square). Shown uncropped, max 560px wide." />
      </div>
      <div className="field-row">
        <Field label="CTA Button Label" value={f.ctaLabel} onChange={set('ctaLabel')} />
        <Field label="CTA Link (optional URL)" value={f.ctaLink} onChange={set('ctaLink')} placeholder="https://…" />
      </div>
      <Field label="Target Cities (comma-separated — leave blank for ALL doctors)" value={f.cities} onChange={set('cities')} placeholder="Lahore, Karachi" />
      <div className="field-row">
        <Field label="Start Date & Time" type="datetime-local" value={f.startAt} onChange={set('startAt')} required />
        <Field label="End Date & Time" type="datetime-local" value={f.endAt} onChange={set('endAt')} required />
      </div>
      <Field label="Status" type="select" value={f.isActive ? 'active' : 'paused'} onChange={(v) => set('isActive')(v === 'active')}
        options={[{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }]} />
    </Modal>
  );
}
