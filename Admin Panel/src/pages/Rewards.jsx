import { useEffect, useState } from 'react';
import { Gift, CreditCard, ArrowsClockwise, Trophy, Star, Plus } from '@phosphor-icons/react';
import api from '../lib/api';
import useList from '../lib/useList';
import { PageHeader, StatCards, UserCell, Pagination, fmtDate, PopularBadge } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import ExportButton from '../components/ExportButton.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

const REWARD_CSV_COLS = [
  { header: 'Patient', value: (r) => r.patientId?.fullName },
  { header: 'Description', value: (r) => r.description },
  { header: 'Points', value: (r) => r.points },
  { header: 'Status', value: (r) => (r.isRedeemed ? 'Redeemed' : 'Active') },
  { header: 'Date', value: (r) => fmtDate(r.createdAt) },
];

export default function Rewards() {
  const [tab, setTab] = useState('patients');
  return (
    <div className="card">
      <PageHeader title="Rewards & Payments" crumb="Rewards & Payments" />
      <div className="toolbar" style={{ marginBottom: 18 }}>
        <button className={`btn ${tab === 'patients' ? 'primary' : 'ghost'}`} onClick={() => setTab('patients')}>Patient Rewards</button>
        <button className={`btn ${tab === 'doctors' ? 'primary' : 'ghost'}`} onClick={() => setTab('doctors')}>Doctor Popularity</button>
      </div>
      {tab === 'patients' ? <PatientRewards /> : <DoctorPopularity />}
    </div>
  );
}

function PatientRewards() {
  const L = useList('/api/admin/rewards');
  const c = L.counts;
  return (
    <>
      {L.loading ? <SkeletonStatCards /> : (
        <StatCards items={[
          { label: 'Total Members', value: c.members ?? '—', icon: Gift, tone: 'blue' },
          { label: 'Total Points', value: (c.totalPoints ?? 0).toLocaleString(), icon: CreditCard, tone: 'green' },
          { label: 'Transactions', value: c.transactions ?? '—', icon: ArrowsClockwise, tone: 'amber' },
          { label: 'Redeemed', value: c.redeemed ?? '—', icon: Trophy, tone: 'purple' },
        ]} />
      )}
      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <ExportButton path="/api/admin/rewards" columns={REWARD_CSV_COLS} filename="patient-rewards.csv" />
      </div>
      {L.loading ? <SkeletonTable cols={5} /> : (
        <>
          <table>
            <thead><tr><th>Patient</th><th>Description</th><th>Points</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {L.data.map((r) => (
                <tr key={r._id}>
                  <td><UserCell name={r.patientId?.fullName} img={r.patientId?.profileImage} /></td>
                  <td className="muted">{r.description || '—'}</td>
                  <td style={{ fontWeight: 700, color: r.points >= 0 ? '#15803D' : '#B91C1C' }}>{r.points >= 0 ? '+' : ''}{r.points}</td>
                  <td><span className={`badge ${r.isRedeemed ? 'gray' : 'green'}`}>{r.isRedeemed ? 'Redeemed' : 'Active'}</span></td>
                  <td>{fmtDate(r.createdAt)}</td>
                </tr>
              ))}
              {!L.data.length && <tr><td colSpan={5} className="empty">No reward transactions found</td></tr>}
            </tbody>
          </table>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}
    </>
  );
}

function DoctorPopularity() {
  const toast = useToast();
  const confirm = useConfirm();
  const [docs, setDocs] = useState(null);

  const load = () => api.get('/api/admin/popular-doctors').then((r) => setDocs(r.data.data)).catch(() => setDocs([]));
  useEffect(() => { load(); }, []);

  const grantPaid = async (d) => {
    if (!(await confirm({ title: 'Grant Paid Popular', message: `Mark ${d.fullName} as paid-popular (blue badge)? Use this after they pay the popularity fee.`, confirmText: 'Grant' }))) return;
    try { await api.patch(`/api/admin/dentists/${d._id}/popular`, { action: 'grantPaid' }); toast('Paid popular granted'); load(); }
    catch { toast('Failed', 'error'); }
  };
  const revoke = async (d) => {
    if (!(await confirm({ title: 'Revoke Popular', message: `Remove popular status from ${d.fullName}? (Green status re-applies automatically if they still have enough points.)`, confirmText: 'Revoke', destructive: true }))) return;
    try { await api.patch(`/api/admin/dentists/${d._id}/popular`, { action: 'revoke' }); toast('Popular revoked'); load(); }
    catch { toast('Failed', 'error'); }
  };

  if (!docs) return <SkeletonTable cols={5} />;

  const popularCount = docs.filter((d) => d.isPopular).length;
  const paidCount = docs.filter((d) => d.popularType === 'paid').length;
  const earnedCount = docs.filter((d) => d.popularType === 'earned').length;

  return (
    <>
      <StatCards items={[
        { label: 'Popular Doctors', value: popularCount, icon: Star, tone: 'blue' },
        { label: 'Earned (Green)', value: earnedCount, icon: Trophy, tone: 'green' },
        { label: 'Paid (Blue)', value: paidCount, icon: CreditCard, tone: 'amber' },
        { label: 'Total Doctors', value: docs.length, icon: Gift, tone: 'purple' },
      ]} />
      <p className="muted" style={{ marginBottom: 14, fontSize: 13 }}>
        Doctors auto-earn the green badge at 20,000 points. Grant the blue badge manually after a doctor pays the popularity fee (PKR 100,000). Popular doctors rank to the top of patient search.
      </p>
      <table>
        <thead><tr><th>Doctor</th><th>City</th><th>Points</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d._id}>
              <td><UserCell name={d.fullName} sub={d.specialization} img={d.photo} /></td>
              <td>{d.city || '—'}</td>
              <td style={{ fontWeight: 600 }}>{(d.rewardPoints || 0).toLocaleString()}</td>
              <td>{d.popularType ? <PopularBadge type={d.popularType} /> : <span className="muted">—</span>}</td>
              <td className="row-actions">
                {d.popularType !== 'paid' && <button className="btn sm primary" onClick={() => grantPaid(d)}>Grant Paid</button>}
                {d.isPopular && <button className="btn sm ghost" onClick={() => revoke(d)}>Revoke</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
