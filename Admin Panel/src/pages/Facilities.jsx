import { useEffect, useState } from 'react';
import { Plus, Trash, FloppyDisk } from '@phosphor-icons/react';
import api from '../lib/api';
import { useToast } from '../components/feedback.jsx';
import { useAuth } from '../lib/auth.jsx';

const inp = { width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' };
const newCategory = () => ({
  key: 'custom_' + Math.random().toString(36).slice(2, 7),
  title: 'NEW CATEGORY', icon: 'business', color: '#0052FF', bgColor: '#EFF6FF', items: [''],
});

export default function Facilities() {
  const toast = useToast();
  const { admin } = useAuth();
  const isSuper = admin?.profile?.adminRole === 'super_admin';

  const [cats, setCats] = useState(null);
  const [modern, setModern] = useState(16);
  const [elite, setElite] = useState(31);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/admin/settings').then((r) => {
      const s = r.data.data || {};
      setCats(Array.isArray(s.facilityCategories) ? s.facilityCategories.map((c) => ({ ...c, items: [...(c.items || [])] })) : []);
      setModern(s.clinicTierThresholds?.modern ?? 16);
      setElite(s.clinicTierThresholds?.elite ?? 31);
    }).catch(() => setCats([]));
  }, []);

  if (!cats) return <div className="card"><div className="loading">Loading…</div></div>;

  const totalItems = cats.reduce((n, c) => n + (c.items?.length || 0), 0);
  const modernNum = Math.max(2, Number(modern) || 16);
  const eliteNum = Math.max(modernNum + 1, Number(elite) || 31);

  const updateCat = (i, patch) => setCats((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const updateItem = (ci, ii, val) => setCats((cs) => cs.map((c, idx) => (idx === ci ? { ...c, items: c.items.map((it, j) => (j === ii ? val : it)) } : c)));
  const addItem = (ci) => setCats((cs) => cs.map((c, idx) => (idx === ci ? { ...c, items: [...(c.items || []), ''] } : c)));
  const removeItem = (ci, ii) => setCats((cs) => cs.map((c, idx) => (idx === ci ? { ...c, items: c.items.filter((_, j) => j !== ii) } : c)));
  const removeCat = (ci) => setCats((cs) => cs.filter((_, idx) => idx !== ci));
  const addCat = () => setCats((cs) => [...cs, newCategory()]);

  const save = async () => {
    const cleaned = cats
      .map((c) => ({ ...c, title: (c.title || '').trim(), items: (c.items || []).map((i) => i.trim()).filter(Boolean) }))
      .filter((c) => c.title && c.items.length);
    if (!cleaned.length) return toast('Add at least one category with facilities', 'error');
    setBusy(true);
    try {
      await api.patch('/api/admin/settings', {
        facilityCategories: cleaned,
        clinicTierThresholds: { modern: modernNum, elite: eliteNum },
      });
      toast('Facilities saved');
    } catch (e) { toast(e.response?.data?.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="page-title">Facilities</div>
      <div className="breadcrumb">Dashboard › Facilities</div>

      {!isSuper && <div className="card" style={{ marginBottom: 16 }}><p className="muted">Read-only — only super admins can edit facilities.</p></div>}

      {/* ── Clinic tier score ranges ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>Clinic Tier Score Ranges</h3></div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
          A clinic's tier is based on how many facilities it offers. Set where each tier begins.
        </p>
        <div className="field-row" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>“Modern” starts at (score)</div>
            <input type="number" min={2} value={modern} disabled={!isSuper} onChange={(e) => setModern(e.target.value)} style={inp} />
          </label>
          <label style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>“Elite” starts at (score)</div>
            <input type="number" min={3} value={elite} disabled={!isSuper} onChange={(e) => setElite(e.target.value)} style={inp} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <span className="badge gray">Standard Clinic: 1 – {Math.max(1, modernNum - 1)}</span>
          <span className="badge blue">Modern Clinic: {modernNum} – {Math.max(modernNum, eliteNum - 1)}</span>
          <span className="badge amber">Elite Clinic: {eliteNum}+</span>
        </div>
      </div>

      {/* ── Facility categories ── */}
      <div className="card">
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h3>Facility Categories ({cats.length}) · {totalItems} facilities</h3>
          {isSuper && <button className="btn ghost" onClick={addCat}><Plus size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Add Category</button>}
        </div>

        {cats.map((c, ci) => (
          <div key={ci} style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <input value={c.title} disabled={!isSuper} onChange={(e) => updateCat(ci, { title: e.target.value })} placeholder="Category title" style={{ ...inp, fontWeight: 700, flex: 1 }} />
              {isSuper && <button className="btn danger" title="Remove category" onClick={() => removeCat(ci)}><Trash size={15} /></button>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(c.items || []).map((it, ii) => (
                <div key={ii} style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '2px 4px 2px 8px' }}>
                  <input value={it} disabled={!isSuper} onChange={(e) => updateItem(ci, ii, e.target.value)} placeholder="Facility name" style={{ width: 170, border: 'none', background: 'transparent', padding: '4px 2px', fontSize: 13, outline: 'none' }} />
                  {isSuper && <button onClick={() => removeItem(ci, ii)} title="Remove" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#DC2626', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>}
                </div>
              ))}
              {isSuper && <button className="btn ghost" onClick={() => addItem(ci)} style={{ padding: '6px 12px' }}><Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Add facility</button>}
            </div>
          </div>
        ))}

        {isSuper && (
          <button className="btn primary" disabled={busy} onClick={save}>
            <FloppyDisk size={16} style={{ verticalAlign: -2, marginRight: 6 }} />{busy ? 'Saving…' : 'Save Facilities'}
          </button>
        )}
      </div>
    </div>
  );
}
