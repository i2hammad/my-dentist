import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash } from '@phosphor-icons/react';
import api, { imgUrl } from '../lib/api';
import { fmtDate, money } from '../components/ui.jsx';
import { SkeletonStatCards } from '../components/Skeleton.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

const Row = ({ k, v }) => (<div><div className="k">{k}</div><div className="v">{v ?? '—'}</div></div>);

export default function PatientDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [d, setD] = useState(null);

  const load = () => api.get(`/api/admin/patients/${id}`).then((r) => setD(r.data.data)).catch(() => { toast('Failed to load', 'error'); nav('/patients'); });

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

  if (!d) return (<div className="card"><SkeletonStatCards count={2} /></div>);
  const p = d.patient;

  const del = async () => {
    if (!(await confirm({ title: 'Delete Patient', message: `Delete ${p.fullName}?`, confirmText: 'Delete', destructive: true }))) return;
    try { await api.delete(`/api/admin/patients/${id}`); toast('Deleted'); nav('/patients'); }
    catch { toast('Failed', 'error'); }
  };

  const toggleBlock = async () => {
    if (p.isBlocked) {
      try { await api.patch(`/api/admin/patients/${id}/unblock`); toast('Patient reinstated'); load(); } catch { toast('Failed', 'error'); }
    } else {
      const reason = window.prompt('Reason for suspension?');
      if (reason === null) return;
      try { await api.patch(`/api/admin/patients/${id}/block`, { reason }); toast('Patient suspended'); load(); } catch { toast('Failed', 'error'); }
    }
  };

  return (
    <div>
      <div className="card-head" style={{ marginBottom: 16 }}>
        <button className="btn ghost" onClick={() => nav('/patients')}><ArrowLeft size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Back to Patients</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn ${p.isBlocked ? 'ghost' : 'danger'}`} onClick={toggleBlock}>{p.isBlocked ? 'Reinstate' : 'Suspend'}</button>
          <button className="btn danger" onClick={del}><Trash size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Delete</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="detail-hero" style={{ marginBottom: 0 }}>
          {p.profileImage ? <img src={imgUrl(p.profileImage)} alt="" /> : <div className="avatar" style={{ width: 72, height: 72 }} />}
          <div>
            <h2>{p.fullName}</h2>
            <div className="muted">{p.userId?.email}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="badge purple">{d.points} reward points</span>
              {p.isBlocked && <span className="badge red">Suspended</span>}
            </div>
            {p.isBlocked && p.blockReason && <div className="muted" style={{ marginTop: 6 }}>Reason: {p.blockReason}</div>}
          </div>
        </div>
      </div>

      <div className="dash-grid" style={{ alignItems: 'start' }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head"><h3>Personal Information</h3></div>
            <div className="detail-grid">
              <Row k="Phone" v={p.mobileNumber} />
              <Row k="Gender" v={<span style={{ textTransform: 'capitalize' }}>{p.gender}</span>} />
              <Row k="City" v={p.city} />
              <Row k="Date of Birth" v={p.dateOfBirth ? fmtDate(p.dateOfBirth) : '—'} />
              <Row k="Joined" v={fmtDate(p.createdAt)} />
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Bills ({d.bills.length})</h3></div>
            {d.bills.length ? d.bills.map((b) => (
              <div key={b._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span>{b.invoiceNumber} · {b.treatmentName}</span>
                <span>{money(b.finalAmount)} <span className={`badge ${b.status === 'paid' ? 'green' : 'amber'}`}>{b.status}</span></span>
              </div>
            )) : <span className="muted">No bills</span>}
          </div>
        </div>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head"><h3>Appointments ({d.appointments.length})</h3></div>
            {d.appointments.length ? d.appointments.map((a) => (
              <div key={a._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span>{a.doctorId?.fullName || 'Doctor'} · {a.treatmentType}</span>
                <span className={`badge ${a.status === 'completed' ? 'green' : a.status === 'cancelled' ? 'red' : 'amber'}`}>{a.status}</span>
              </div>
            )) : <span className="muted">No appointments</span>}
          </div>
          <div className="card">
            <div className="card-head"><h3>Reward History ({d.rewards.length})</h3></div>
            {d.rewards.length ? d.rewards.map((r) => (
              <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">{r.description || 'Reward'}</span>
                <strong style={{ color: r.points >= 0 ? '#15803D' : '#B91C1C' }}>{r.points >= 0 ? '+' : ''}{r.points}</strong>
              </div>
            )) : <span className="muted">No rewards</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
