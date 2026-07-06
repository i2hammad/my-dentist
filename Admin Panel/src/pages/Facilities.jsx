import { useEffect, useState } from 'react';
import {
  Plus, Trash, FloppyDisk,
  ShieldCheck, Shield, Wrench, Buildings, FirstAid, DeviceMobile,
  Sparkle, Drop, WifiHigh, Car, Heart, Flask, Thermometer, Money,
  Calendar, Users, Snowflake, Star, Tooth, Leaf,
} from '@phosphor-icons/react';
import api from '../lib/api';
import { PageHeader } from '../components/ui.jsx';
import { useToast } from '../components/feedback.jsx';
import { useAuth } from '../lib/auth.jsx';

// The patient app renders Ionicons by name. We offer a curated set of valid
// Ionicons names, each previewed here with its closest Phosphor equivalent.
const ICON_OPTIONS = [
  { name: 'shield-checkmark', Icon: ShieldCheck },
  { name: 'shield', Icon: Shield },
  { name: 'build', Icon: Wrench },
  { name: 'business', Icon: Buildings },
  { name: 'medkit', Icon: FirstAid },
  { name: 'phone-portrait', Icon: DeviceMobile },
  { name: 'sparkles', Icon: Sparkle },
  { name: 'water', Icon: Drop },
  { name: 'wifi', Icon: WifiHigh },
  { name: 'car', Icon: Car },
  { name: 'heart', Icon: Heart },
  { name: 'flask', Icon: Flask },
  { name: 'thermometer', Icon: Thermometer },
  { name: 'cash', Icon: Money },
  { name: 'calendar', Icon: Calendar },
  { name: 'people', Icon: Users },
  { name: 'snow', Icon: Snowflake },
  { name: 'star', Icon: Star },
  { name: 'medical', Icon: Tooth },
  { name: 'leaf', Icon: Leaf },
];
const IconFor = (name) => (ICON_OPTIONS.find((o) => o.name === name)?.Icon) || Buildings;

// Each preset sets both the accent color and its matching light background.
const COLOR_PRESETS = [
  { color: '#0052FF', bgColor: '#EFF6FF' },
  { color: '#16A34A', bgColor: '#F0FDF4' },
  { color: '#7C3AED', bgColor: '#F5F3FF' },
  { color: '#EA580C', bgColor: '#FFF7ED' },
  { color: '#DC2626', bgColor: '#FEF2F2' },
  { color: '#0D9488', bgColor: '#F0FDFA' },
  { color: '#D97706', bgColor: '#FFFBEB' },
  { color: '#DB2777', bgColor: '#FDF2F8' },
  { color: '#0891B2', bgColor: '#ECFEFF' },
  { color: '#475569', bgColor: '#F1F5F9' },
];

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

  const totalItems = (cats || []).reduce((n, c) => n + (c.items?.length || 0), 0);
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

  if (!cats) return <div className="card"><div className="loading">Loading…</div></div>;

  const SaveBtn = isSuper ? (
    <button className="btn primary" disabled={busy} onClick={save}>
      <FloppyDisk size={16} style={{ verticalAlign: -2, marginRight: 6 }} />{busy ? 'Saving…' : 'Save Facilities'}
    </button>
  ) : null;

  return (
    <div>
      <PageHeader title="Facilities" crumb="Facilities" actions={SaveBtn} />

      {!isSuper && <div className="card" style={{ marginBottom: 16 }}><p className="muted">Read-only — only super admins can edit facilities.</p></div>}

      {/* ── Clinic tier score ranges ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>Clinic Tier Score Ranges</h3></div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
          A clinic's tier is based on how many facilities it offers. Set where each tier begins.
        </p>
        <div className="field-row" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>“Modern” starts at (score)</div>
            <input type="number" min={2} value={modern} disabled={!isSuper} onChange={(e) => setModern(e.target.value)} style={inp} />
          </label>
          <label style={{ flex: 1, minWidth: 180 }}>
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
        <div className="card-head">
          <h3>Facility Categories ({cats.length}) · {totalItems} facilities</h3>
          {isSuper && <button className="btn ghost" onClick={addCat}><Plus size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Add Category</button>}
        </div>

        {!cats.length && (
          <div className="empty" style={{ padding: '28px 12px' }}>
            No facility categories yet.{isSuper ? ' Click “Add Category” to create one.' : ''}
          </div>
        )}

        {cats.map((c, ci) => {
          const Glyph = IconFor(c.icon);
          return (
            <div key={c.key || ci} style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              {/* Title row: preview tile + title + remove */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: c.bgColor || '#EFF6FF', display: 'grid', placeItems: 'center',
                }}>
                  <Glyph size={22} color={c.color || '#0052FF'} weight="fill" />
                </div>
                <input
                  value={c.title} disabled={!isSuper}
                  onChange={(e) => updateCat(ci, { title: e.target.value })}
                  placeholder="Category title"
                  style={{ ...inp, fontWeight: 700, flex: 1, minWidth: 160 }}
                />
                {isSuper && <button className="btn danger" title="Remove category" onClick={() => removeCat(ci)} style={{ flexShrink: 0 }}><Trash size={15} /></button>}
              </div>

              {/* Appearance: icon + color pickers (super admin only) */}
              {isSuper && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Icon</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {ICON_OPTIONS.map(({ name, Icon }) => {
                      const sel = c.icon === name;
                      return (
                        <button key={name} type="button" title={name} onClick={() => updateCat(ci, { icon: name })}
                          style={{
                            width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
                            display: 'grid', placeItems: 'center',
                            background: sel ? (c.bgColor || '#EFF6FF') : '#F8FAFC',
                            border: sel ? `2px solid ${c.color || '#0052FF'}` : '1px solid #E2E8F0',
                          }}>
                          <Icon size={17} color={sel ? (c.color || '#0052FF') : '#64748B'} weight={sel ? 'fill' : 'regular'} />
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Color</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {COLOR_PRESETS.map((p) => {
                      const sel = (c.color || '').toLowerCase() === p.color.toLowerCase();
                      return (
                        <button key={p.color} type="button" title={p.color} onClick={() => updateCat(ci, { color: p.color, bgColor: p.bgColor })}
                          style={{
                            width: 26, height: 26, borderRadius: 999, cursor: 'pointer', background: p.color,
                            border: '2px solid #fff',
                            boxShadow: sel ? `0 0 0 2px ${p.color}` : '0 0 0 1px #E2E8F0',
                          }} />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Facilities */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                Facilities ({(c.items || []).filter((i) => i.trim()).length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(c.items || []).map((it, ii) => (
                  <div key={ii} style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '2px 4px 2px 8px' }}>
                    <input value={it} disabled={!isSuper} onChange={(e) => updateItem(ci, ii, e.target.value)} placeholder="Facility name" style={{ width: 150, maxWidth: '60vw', border: 'none', background: 'transparent', padding: '4px 2px', fontSize: 13, outline: 'none' }} />
                    {isSuper && <button onClick={() => removeItem(ci, ii)} title="Remove" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#DC2626', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>}
                  </div>
                ))}
                {isSuper && <button className="btn ghost" onClick={() => addItem(ci)} style={{ padding: '6px 12px' }}><Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Add facility</button>}
              </div>
            </div>
          );
        })}

        {isSuper && (
          <button className="btn primary" disabled={busy} onClick={save}>
            <FloppyDisk size={16} style={{ verticalAlign: -2, marginRight: 6 }} />{busy ? 'Saving…' : 'Save Facilities'}
          </button>
        )}
      </div>
    </div>
  );
}
