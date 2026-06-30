import { Check, X, MapPin, Briefcase, IdentificationCard } from '@phosphor-icons/react';
import api from '../lib/api';
import useList from '../lib/useList';
import { ZoomImg } from '../components/Lightbox';
import { PageHeader, Pagination } from '../components/ui.jsx';
import { SkeletonStatCards } from '../components/Skeleton.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

export default function Verification() {
  const L = useList('/api/admin/dentists', { status: 'pending' });
  const toast = useToast();
  const confirm = useConfirm();

  const approve = async (d) => {
    try { await api.patch(`/api/admin/dentists/${d._id}`, { approvalStatus: 'approved' }); toast('Dentist approved'); L.reload(); }
    catch { toast('Failed to approve', 'error'); }
  };

  const reject = async (d) => {
    if (!(await confirm({ title: 'Reject Dentist', message: `Reject ${d.fullName}'s application? They will not be able to use the app.`, confirmText: 'Reject', destructive: true }))) return;
    try { await api.patch(`/api/admin/dentists/${d._id}`, { approvalStatus: 'rejected' }); toast('Dentist rejected'); L.reload(); }
    catch { toast('Failed to reject', 'error'); }
  };

  const docFields = (d) => [
    ['License / PMDC Certificate', d.licenseCert],
    ['ID Front', d.idFront],
    ['ID Back', d.idBack],
  ];

  return (
    <div className="card">
      <PageHeader title="Dentist Verification" crumb="Verification"
        actions={<span className="badge amber">{L.total} pending</span>} />

      {L.loading ? <SkeletonStatCards count={2} /> : !L.data.length ? (
        <div className="empty">No pending dentists 🎉</div>
      ) : (
        <div className="entity-grid">
          {L.data.map((d) => (
            <div key={d._id} className="entity-card">
              <div className="ec-top">
                {d.photo ? <ZoomImg src={d.photo} alt={d.fullName} caption={d.fullName} className="ec-avatar" /> : <div className="ec-avatar" />}
                <div style={{ minWidth: 0 }}>
                  <div className="ec-name">{d.fullName || '—'}</div>
                  <div className="ec-sub">{d.specialization || 'Dentist'}</div>
                </div>
              </div>
              <div className="ec-rows">
                <div className="ec-row"><Briefcase size={14} />{d.clinicName || 'Private Clinic'}</div>
                <div className="ec-row"><MapPin size={14} />{d.city || '—'}</div>
                <div className="ec-row"><IdentificationCard size={14} />PMDC: {d.pmdcNumber || '—'}</div>
              </div>

              <div className="detail-section">
                <h4>Verification Documents</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {docFields(d).map(([label, src]) => (
                    <div key={label}>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{label}</div>
                      {src
                        ? <ZoomImg src={src} alt={label} caption={`${d.fullName} — ${label}`} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                        : <div style={{ width: '100%', height: 90, borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="muted" style={{ fontSize: 11 }}>None</span></div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="ec-foot">
                <button className="btn primary" onClick={() => approve(d)}><Check size={16} weight="bold" style={{ verticalAlign: -2, marginRight: 6 }} />Approve</button>
                <button className="btn ghost" onClick={() => reject(d)}><X size={16} weight="bold" style={{ verticalAlign: -2, marginRight: 6 }} />Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
    </div>
  );
}
