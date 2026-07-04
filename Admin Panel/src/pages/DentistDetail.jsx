import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, SealCheck, Check, Trash, Wallet, Receipt, WarningCircle, CheckCircle, Eye } from '@phosphor-icons/react';
import api, { imgUrl } from '../lib/api';
import { ZoomImg } from '../components/Lightbox';
import { Stars, fmtDate, money, PopularBadge, StatCards } from '../components/ui.jsx';
import { SkeletonStatCards } from '../components/Skeleton.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

const Row = ({ k, v }) => (
  <div><div className="k">{k}</div><div className="v">{v ?? '—'}</div></div>
);

const CommRow = ({ k, v, bold, green, red }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
    <span className="muted" style={{ fontSize: 13 }}>{k}</span>
    <span style={{ fontWeight: bold ? 700 : 600, color: red ? '#B91C1C' : green ? '#15803D' : '#0F172A' }}>{v}</span>
  </div>
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
    const val = window.prompt(`Set outstanding commission dues (PKR) for ${doc.fullName}.\nSetting any amount above 0 will automatically BLOCK the doctor until the dues are cleared.`, String(doc.commissionDue || 0));
    if (val == null) return;
    const num = Number(val);
    if (isNaN(num) || num < 0) return toast('Enter a valid amount', 'error');
    try {
      await api.patch(`/api/admin/dentists/${id}/commission`, { commissionDue: num });
      toast(num > 0 ? `Outstanding set to Rs. ${num.toLocaleString()} — doctor blocked` : 'Outstanding cleared');
      load();
    } catch { toast('Failed', 'error'); }
  };
  const addDues = async () => {
    const earned = d.earnings?.commissionEarned || 0;
    const val = window.prompt(`Add commission dues (PKR) for ${doc.fullName}.\nPlatform has earned PKR ${earned.toLocaleString()} (${d.earnings?.commissionRate ?? 10}% of collected).`, String(earned - (doc.commissionPaid || 0) > 0 ? earned - (doc.commissionPaid || 0) : earned));
    if (val == null) return;
    const num = Number(val);
    if (isNaN(num) || num <= 0) return toast('Enter a valid amount', 'error');
    try { await api.patch(`/api/admin/dentists/${id}/commission`, { addCommission: num }); toast(`Added PKR ${num.toLocaleString()} dues`); load(); }
    catch { toast('Failed', 'error'); }
  };
  const clearDues = async () => {
    if (!(doc.commissionDue > 0)) return toast('No outstanding dues to clear', 'error');
    if (!(await confirm({ title: 'Clear Dues', message: `Mark PKR ${doc.commissionDue.toLocaleString()} commission dues as PAID for ${doc.fullName}? This also unblocks them if they were blocked for dues.`, confirmText: 'Clear Dues' }))) return;
    try { await api.patch(`/api/admin/dentists/${id}/commission/clear`); toast('Dues cleared'); load(); }
    catch (e) { toast(e.response?.data?.message || 'Failed', 'error'); }
  };
  const syncDues = async () => {
    if (!(await confirm({ title: 'Sync Dues', message: `Auto-set ${doc.fullName}'s outstanding dues to (commission earned − already paid)? This recalculates from their collected bills.`, confirmText: 'Sync' }))) return;
    try { const r = await api.patch(`/api/admin/dentists/${id}/commission/sync`); toast(`Dues synced to Rs. ${(r.data.data.owed || 0).toLocaleString()}`); load(); }
    catch (e) { toast(e.response?.data?.message || 'Failed', 'error'); }
  };
  const viewAs = async () => {
    try {
      const r = await api.post('/api/admin/impersonate/' + (doc.userId?._id || doc.userId));
      const token = r.data.data.token;
      const appUrl = import.meta.env.VITE_APP_WEB_URL;
      if (appUrl) {
        window.open(appUrl.replace(/\/$/, '') + '/?impersonate=' + token, '_blank');
      } else {
        try { await navigator.clipboard.writeText(token); } catch {}
        toast('Set VITE_APP_WEB_URL to open the app directly. Impersonation token copied to clipboard.');
      }
    } catch (e) { toast(e.response?.data?.message || 'Failed', 'error'); }
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
          <button className="btn ghost" onClick={viewAs}><Eye size={16} style={{ verticalAlign: -2, marginRight: 6 }} />View as</button>
          {doc.approvalStatus !== 'approved' && <button className="btn primary" onClick={approve}><Check size={16} weight="bold" style={{ verticalAlign: -2, marginRight: 6 }} />Approve</button>}
          {doc.approvalStatus === 'pending' && <button className="btn ghost" onClick={reject}>Reject</button>}
          <button className="btn ghost" onClick={setCommission}>Set Outstanding</button>
          <button className="btn ghost" onClick={addDues}>+ Add Dues</button>
          {doc.commissionDue > 0 && <button className="btn primary" onClick={clearDues}>Clear Dues (Rs. {doc.commissionDue.toLocaleString()})</button>}
          <button className={`btn ${doc.isBlocked ? 'primary' : 'ghost'}`} onClick={toggleBlock}>{doc.isBlocked ? 'Unblock' : 'Block'}</button>
          <button className="btn danger" onClick={del}><Trash size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Delete</button>
        </div>
      </div>

      {/* Hero */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="detail-hero" style={{ marginBottom: 0 }}>
          {doc.photo ? <ZoomImg src={doc.photo} alt={doc.fullName} caption={doc.fullName} /> : <div className="avatar" style={{ width: 72, height: 72 }} />}
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

      {/* Earnings summary */}
      {d.earnings && (
        <StatCards items={[
          { label: 'Total Earned', value: money(d.earnings.totalEarned), icon: Wallet, tone: 'green' },
          { label: 'Total Billed', value: money(d.earnings.totalBilled), icon: Receipt, tone: 'blue' },
          { label: 'Outstanding', value: money(d.earnings.outstanding), icon: WarningCircle, tone: 'amber' },
          { label: 'Paid Bills', value: `${d.earnings.paidCount} / ${d.earnings.billCount}`, icon: CheckCircle, tone: 'purple' },
        ]} />
      )}

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
                    <ZoomImg src={src} alt={label} caption={label} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
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
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head"><h3>Recent Appointments</h3></div>
            {d.appointments.length ? d.appointments.map((a) => (
              <div key={a._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span>{a.patientId?.fullName || 'Patient'}</span><span className="muted">{fmtDate(a.date)}</span>
              </div>
            )) : <span className="muted">No appointments</span>}
          </div>

          {/* Bills & earnings */}
          <div className="card">
            <div className="card-head">
              <h3>Bills &amp; Earnings ({d.earnings?.billCount ?? (d.bills?.length || 0)})</h3>
              {d.earnings && <span className="badge green">Earned {money(d.earnings.totalEarned)}</span>}
            </div>
            {d.bills?.length ? d.bills.map((b) => (
              <div key={b._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{b.invoiceNumber || b.treatmentName || 'Bill'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{b.patientId?.fullName || 'Patient'} · {fmtDate(b.createdAt)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{money(b.finalAmount)}</div>
                  <span className={`badge ${b.status === 'paid' ? 'green' : b.status === 'draft' ? 'gray' : 'amber'}`} style={{ fontSize: 10 }}>{b.status}</span>
                  {b.commission > 0 && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Comm. {money(b.commission)}</div>}
                </div>
              </div>
            )) : <span className="muted">No bills yet</span>}
          </div>

          {/* Doctor payout account (where My Dentist sends the 90% share) */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-head"><h3>Doctor Payout Account</h3></div>
            {doc.payoutAccount?.accountNumber ? (
              <div className="detail-grid">
                <Row k="Bank Name" v={doc.payoutAccount.bankName || '—'} />
                <Row k="Account Title" v={doc.payoutAccount.accountTitle || '—'} />
                <Row k="Account Number / IBAN" v={doc.payoutAccount.accountNumber} />
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>Doctor has not added a payout account yet.</p>
            )}
          </div>

          {/* Platform commission */}
          {d.earnings && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-head"><h3>Platform Commission ({d.earnings.commissionRate}%)</h3></div>
              <CommRow k={`Commission earned (${d.earnings.commissionRate}% of ${money(d.earnings.totalEarned)})`} v={money(d.earnings.commissionEarned)} bold />
              <CommRow k="Cleared / paid to date" v={money(d.earnings.commissionPaid)} green />
              <CommRow k="Outstanding dues" v={money(d.earnings.commissionDue)} red={d.earnings.commissionDue > 0} bold />
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn ghost" style={{ flex: 1 }} onClick={setCommission}>Set Outstanding</button>
                <button className="btn ghost" style={{ flex: 1 }} onClick={syncDues}>↻ Sync from Bills</button>
                <button className="btn ghost" style={{ flex: 1 }} onClick={addDues}>+ Add Dues</button>
                <button className="btn primary" style={{ flex: 1 }} disabled={!(doc.commissionDue > 0)} onClick={clearDues}>Clear Dues</button>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>⚠ "Set Outstanding" blocks the doctor on any amount above 0. "Add Dues" auto-blocks once the total reaches PKR 50,000. Clearing dues unblocks a doctor blocked for dues.</p>

              {/* Commission payment history */}
              {d.commissionLog?.length > 0 && (
                <div style={{ marginTop: 14, borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
                  <h4 style={{ fontSize: 13, margin: '0 0 8px' }}>Payment History</h4>
                  {d.commissionLog.map((l) => (
                    <div key={l._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F8FAFC' }}>
                      <div>
                        <span className={`badge ${l.type === 'clear' ? 'green' : l.type === 'sync' ? 'blue' : 'amber'}`} style={{ fontSize: 10, textTransform: 'capitalize' }}>{l.type}</span>
                        <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>{fmtDate(l.createdAt)} · {l.actorName}</span>
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{money(l.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {d.gallery?.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-head"><h3>Gallery ({d.gallery.length})</h3></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {d.gallery.slice(0, 9).map((g) => (
                  <ZoomImg key={g._id} src={g.imageUrl || g.beforeImage} alt={g.title || ''} caption={g.title || undefined} style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 8 }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
