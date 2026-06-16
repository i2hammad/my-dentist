import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Tooth, Users, CalendarBlank, Wallet } from '@phosphor-icons/react';
import api from '../lib/api';
import { StatCards, UserCell, Stars, fmtDate, money } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';

export default function Dashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get('/api/admin/dashboard').then((r) => setD(r.data.data)).catch(() => {});
  }, []);

  if (!d) return (
    <>
      <div className="page-title">Dashboard</div>
      <div className="breadcrumb">Loading…</div>
      <SkeletonStatCards />
      <div className="card"><SkeletonTable rows={5} cols={5} /></div>
    </>
  );

  const series = d.appointmentSeries.map((s) => ({ month: s._id.slice(5), count: s.count }));

  return (
    <>
      <div className="page-title">Dashboard</div>
      <div className="breadcrumb">Welcome back, Admin! Here's what's happening today.</div>

      <StatCards items={[
        { label: 'Total Dentists', value: d.stats.totalDentists, icon: Tooth, tone: 'blue' },
        { label: 'Total Patients', value: d.stats.totalPatients, icon: Users, tone: 'green' },
        { label: 'Total Appointments', value: d.stats.totalAppointments, icon: CalendarBlank, tone: 'purple' },
        { label: 'Total Earnings', value: money(d.stats.totalEarnings), icon: Wallet, tone: 'amber' },
      ]} />

      <div className="dash-grid">
        <div className="card">
          <div className="card-head"><h3>Appointments Overview</h3></div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-head"><h3>Top Dentists</h3></div>
          {d.topDentists.map((t) => (
            <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
              <UserCell name={t.fullName} sub={t.specialization} img={t.photo} />
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <Stars value={t.rating} />
                <div className="muted" style={{ fontSize: 12 }}>{t.reviewCount} reviews</div>
              </div>
            </div>
          ))}
          {!d.topDentists.length && <div className="empty">No reviews yet</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Recent Appointments</h3></div>
        <table>
          <thead><tr><th>Patient</th><th>Dentist</th><th>Treatment</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            {d.recentAppointments.map((a) => (
              <tr key={a._id}>
                <td><UserCell name={a.patientId?.fullName} img={a.patientId?.profileImage} /></td>
                <td><UserCell name={a.doctorId?.fullName} img={a.doctorId?.photo} /></td>
                <td>{a.treatmentType}</td>
                <td>{fmtDate(a.date)}</td>
                <td><StatusBadge s={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatusBadge({ s }) {
  const map = { completed: 'green', confirmed: 'blue', pending: 'amber', cancelled: 'red' };
  return <span className={`badge ${map[s] || 'gray'}`}>{s}</span>;
}
