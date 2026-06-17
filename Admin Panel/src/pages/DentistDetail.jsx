import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, SealCheck, Check, Trash } from '@phosphor-icons/react';
import api, { imgUrl } from '../lib/api';
import { Stars, fmtDate, money, PopularBadge } from '../components/ui.jsx';
import { SkeletonStatCards } from '../components/Skeleton.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

const Row = ({ k, v }) => (
  <div><div className="k">{k}</div><div className="v">{v ?? '—'}</div></div>
);

export default function DentistDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [d, setD] = useState(null);

  const load = () => api.get(`/api/admin/dentists/${id}`).then((r) => setD(r.data.data)).catch(() => { toast('Failed to load', 'error'); nav('/dentists'); });
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (!d) return (<div className="card"><SkeletonStatCards count={2} /></div>);

  const doc = d.doctor;
  const t = doc.clinicTiming || {};

  const approve = async () => {
    try { await api.patch(`/api/admin/dentists/${id}`, { approvalStatus: 'approved' }); toast('Dentist approved & activated'); load(); }
    catch { toast('Failed', 'error'); }
  };
  const reject = async () => {
    if (!(await confirm({ title: 'Reject Dentist', message: `Reject ${doc.fullName}'s application? They will not be able to use the app.`, confirmText: 'Reject', destructive: true }))) return;
    try { await api.patch(`/api/admin/dentists/${id}`, { approvalStatus: 'rejected' }); toast('Dentist rejected'); load(); }
    catch { toast('Failed', 'error'); }
  };
  const toggleBlock = async () => {
    if (doc.isBlocked) {
      if (!(await confirm({ title: 'Unblock Dentist', message: `Unblock ${doc.fullName}? Confirm dues are cleared.`, confirmText: 'Unblock' }))) return;
      try { await api.patch(`/api/admin/dentists/${id}/unblock`); toast('Dentist unblocked'); load(); } catch { toast('Failed', 'error'); }
    } else {
      if (!(await confirm({ title: 'Block Dentist', message: `Block ${doc.fullName}? They lose access until unblocked.`, confirmText: 'Block', destructive: true }))) return;
      try { await api.patch(`/api/admin/dentists/${id}`, { isBlocked: true, blockReason: 'Blocked by admin.' }); toast('Dentist blocked'); load(); } catch { toast('Failed', 'error'); }
    }
  };
  const setCommission = async () => {
    const val = window.prompt(`Set outstanding commission dues (PKR) for ${doc.fullName}. Auto-blocks at 50,000.`, String(doc.commissionDue || 0));
    if (val == null) return;
    const num = Number(val);
    if (isNaN(num) || num < 0) return toast('Enter a valid amount', 'error');
    try { await api.patch(`/api/admin/dentists/${id}/commission`, { commissionDue: num }); toast('Commission updated'); load(); }
    catch { toast('Failed', 'error'); }
  };
  const del = async () => {
    if (!(await confirm({ title: 'Delete Dentist', message: `Delete ${doc.fullName}?`, confirmText: 'Delete', destructive: true }))) return;
    try { await api.delete(`/api/admin/dentists/${id}`); toast('Deleted'); nav('/dentists'); }
    catch { toast('Failed', 'error'); }
  };

  const docs = [
    ['License / PMDC Certificate', doc.licenseCert],
    ['ID Front', doc.idFront],
    ['ID Back', doc.idBack],
  ].filter(([, src]) => src);

  return (
    <div>
      <div className="card-head" style={{ marginBottom: 16 }}>
        <button className="btn ghost" onClick={() => nav('/dentists')}><ArrowLeft size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Back to Dentists</button>
        <div className="row-actions">
          {doc.approvalStatus !== 'approved' && <button className="btn primary" onClick={approve}><Check size={16} weight="bold" style={{ verticalAlign: -2, marginRight: 6 }} />Approve</button>}
          {doc.approvalStatus === 'pending' && <button className="btn ghost" onClick={reject}>Reject</button>}
          <button className="btn ghost" onClick={setCommission}>Commission: Rs. {(doc.commissionDue || 0).toLocaleString()}</button>
          <button className={`btn ${doc.isBlocked ? 'primary' : 'ghost'}`} onClick={toggleBlock}>{doc.isBlocked ? 'Unblock' : 'Block'}</button>
          <button className="btn danger" onClick={del}><Trash size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Delete</button>
        </div>
      </div>

      {/* Hero */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="detail-hero" style={{ marginBottom: 0 }}>
          {doc.photo ? <img src={imgUrl(doc.photo)} alt="" /> : <div className="avatar" style={{ width: 72, height: 72 }} />}
          <div>
            <h2>{doc.fullName}</h2>
            <div className="muted">{doc.specialization} · {doc.clinicName || 'No clinic'}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Stars value={d.rating} /> <span className="muted">({d.reviewCount} reviews)</span>
              <span className={`badge ${doc.approvalStatus === 'approved' ? 'green' : doc.approvalStatus === 'rejected' ? 'red' : 'amber'}`}>{doc.approvalStatus === 'approved' ? 'Approved' : doc.approvalStatus === 'rejected' ? 'Rejected' : 'Pending Approval'}</span>
              {doc.isBlocked && <span className="badge red">Blocked</span>}
              <span className={`badge ${doc.onlineStatus === 'online' ? 'green' : doc.onlineStatus === 'busy' ? 'amber' : 'gray'}`}>{doc.onlineStatus || 'offline'}</span>
              <PopularBadge type={doc.popularType} />
              <span className="badge gray">{(doc.rewardPoints || 0).toLocaleString()} pts</span>
              {doc.commissionDue > 0 && <span className="badge amber">Dues: Rs. {doc.commissionDue.toLocaleString()}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="dash-grid" style={{ alignItems: 'start' }}>
        <div>
          {/* Professional */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head"><h3>Professional Information</h3></div>
            <div className="detail-grid">
              <Row k="Email" v={doc.userId?.email} />
              <Row k="Phone" v={doc.phone} />
              <Row k="Gender" v={doc.gender} />
              <Row k="PMDC Number" v={doc.pmdcNumber} />
              <Row k="Qualification" v={doc.qualification} />
              <Row k="Experience" v={doc.experience != null ? `${doc.experience} years` : '—'} />
              <Row k="Consultation Fee" v={money(doc.consultationFee)} />
              <Row k="Specialization" v={doc.specialization} />
            </div>
            <div className="detail-section">
              <h4>About</h4>
              <p className="muted" style={{ lineHeight: 1.6 }}>{doc.about || 'No description provided.'}</p>
            </div>
            <div className="detail-section">
              <h4>Languages</h4>
              <div className="chip-list">
                {(doc.languages || []).length ? doc.languages.map((l) => <span className="badge blue" key={l}>{l}</span>) : <span className="muted">—</span>}
              </div>
            </div>
            <div className="detail-section">
              <h4>Services</h4>
              <div className="chip-list">
                {(doc.services || []).length ? doc.services.map((s, i) => <span className="badge gray" key={i}>{s}</span>) : <span className="muted">None listed</span>}
              </div>
            </div>
          </div>

          {/* Clinic */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head"><h3>Clinic Information</h3></div>
            <div className="detail-grid">
              <Row k="Clinic Name" v={doc.clinicName} />
              <Row k="Clinic Tier" v={<span style={{ textTransform: 'capitalize' }}>{doc.clinicTier}</span>} />
              <Row k="Facility Score" v={doc.facilityScore} />
              <Row k="Clinic Contact" v={doc.clinicContact} />
              <Row k="City" v={doc.city} />
              <Row k="Address" v={doc.address} />
              <Row k="Working Days" v={t.days} />
              <Row k="Hours" v={t.startTime && t.endTime ? `${t.startTime} – ${t.endTime}` : '—'} />
            </div>
          </div>

          {/* Verification documents */}
          {docs.length > 0 && (
            <div className="card">
              <div className="card-head"><h3>Verification Documents</h3></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {docs.map(([label, src]) => (
                  <div key={label}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{label}</div>
                    <a href={imgUrl(src)} target="_blank" rel="noreferrer">
                      <img src={imgUrl(src)} alt={label} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: treatments / reviews / appointments */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head"><h3>Treatments ({d.treatments.length})</h3></div>
            {d.treatments.length ? d.treatments.map((tr) => (
              <div key={tr._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span>{tr.name}</span><span className="muted">{tr.priceMin}–{tr.priceMax}</span>
              </div>
            )) : <span className="muted">None</span>}
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head"><h3>Recent Reviews</h3></div>
            {d.reviews.length ? d.reviews.map((r) => (
              <div key={r._id} style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <Stars value={r.rating} /> <strong style={{ marginLeft: 6 }}>{r.patientId?.fullName || 'Patient'}</strong>
                <div className="muted" style={{ fontSize: 13 }}>{r.comment}</div>
              </div>
            )) : <span className="muted">No reviews</span>}
          </div>
          <div className="card">
            <div className="card-head"><h3>Recent Appointments</h3></div>
            {d.appointments.length ? d.appointments.map((a) => (
              <div key={a._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span>{a.patientId?.fullName || 'Patient'}</span><span className="muted">{fmtDate(a.date)}</span>
              </div>
            )) : <span className="muted">No appointments</span>}
          </div>
          {d.gallery?.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-head"><h3>Gallery ({d.gallery.length})</h3></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {d.gallery.slice(0, 9).map((g) => (
                  <img key={g._id} src={imgUrl(g.imageUrl || g.beforeImage)} alt="" style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 8 }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
