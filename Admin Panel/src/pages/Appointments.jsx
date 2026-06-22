import { useState } from 'react';
import { CalendarBlank, CheckCircle, Clock, XCircle } from '@phosphor-icons/react';
import useList from '../lib/useList';
import { PageHeader, StatCards, UserCell, Pagination, fmtDate } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import ExportButton from '../components/ExportButton.jsx';

const map = { completed: 'green', confirmed: 'blue', pending: 'amber', cancelled: 'red' };

const APPT_CSV_COLS = [
  { header: 'Patient', value: (r) => r.patientId?.fullName },
  { header: 'Dentist', value: (r) => r.doctorId?.fullName },
  { header: 'Date', value: (r) => fmtDate(r.date) },
  { header: 'Time', value: (r) => r.time },
  { header: 'Treatment', value: (r) => r.treatmentType },
  { header: 'Status', value: (r) => r.status },
];

export default function Appointments() {
  const [status, setStatus] = useState('all');
  const L = useList('/api/admin/appointments', { status });
  const c = L.counts;

  return (
    <div className="card">
      <PageHeader title="Appointments" crumb="Appointments"
        actions={<ExportButton path="/api/admin/appointments" params={{ status }} columns={APPT_CSV_COLS} filename="appointments.csv" />} />
      {L.loading ? <SkeletonStatCards /> : (
      <StatCards items={[
        { label: 'Total Appointments', value: c.total ?? '—', icon: CalendarBlank, tone: 'blue' },
        { label: 'Completed', value: c.completed ?? '—', icon: CheckCircle, tone: 'green' },
        { label: 'Upcoming', value: c.upcoming ?? '—', icon: Clock, tone: 'amber' },
        { label: 'Cancelled', value: c.cancelled ?? '—', icon: XCircle, tone: 'purple' },
      ]} />
      )}
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {L.loading ? <SkeletonTable cols={6} /> : (
        <>
          <table>
            <thead><tr><th>Patient</th><th>Dentist</th><th>Date</th><th>Time</th><th>Treatment</th><th>Status</th></tr></thead>
            <tbody>
              {L.data.map((a) => (
                <tr key={a._id}>
                  <td><UserCell name={a.patientId?.fullName} img={a.patientId?.profileImage} /></td>
                  <td><UserCell name={a.doctorId?.fullName} img={a.doctorId?.photo} /></td>
                  <td>{fmtDate(a.date)}</td>
                  <td>{a.time || '—'}</td>
                  <td>{a.treatmentType || '—'}</td>
                  <td><span className={`badge ${map[a.status] || 'gray'}`}>{a.status}</span></td>
                </tr>
              ))}
              {!L.data.length && <tr><td colSpan={6} className="empty">No appointments found</td></tr>}
            </tbody>
          </table>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}
    </div>
  );
}
