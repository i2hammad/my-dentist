import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { ChartLine, Users, Tooth, CurrencyDollar } from '@phosphor-icons/react';
import api from '../lib/api';
import { PageHeader, StatCards, UserCell, money } from '../components/ui.jsx';
import { SkeletonStatCards } from '../components/Skeleton.jsx';

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16'];
const mLabel = (id) => (id ? id.slice(5) : '');

export default function Analytics() {
  const [months, setMonths] = useState(6);
  const [d, setD] = useState(null);

  useEffect(() => {
    setD(null);
    api.get('/api/admin/analytics', { params: { months } }).then((r) => setD(r.data.data)).catch(() => setD(false));
  }, [months]);

  return (
    <div className="card">
      <PageHeader title="Analytics" crumb="Analytics"
        actions={
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
        } />

      {!d ? <SkeletonStatCards /> : d === false ? (
        <div className="empty">Failed to load analytics</div>
      ) : (
        <>
          {(() => {
            const sum = (arr, k) => (arr || []).reduce((s, x) => s + (x[k] || 0), 0);
            return (
              <StatCards items={[
                { label: 'Appointments', value: sum(d.appointmentSeries, 'count'), icon: ChartLine, tone: 'blue' },
                { label: 'New Patients', value: sum(d.patientSeries, 'count'), icon: Users, tone: 'green' },
                { label: 'New Dentists', value: sum(d.dentistSeries, 'count'), icon: Tooth, tone: 'amber' },
                { label: 'Revenue (PKR)', value: sum(d.revenueSeries, 'total').toLocaleString(), icon: CurrencyDollar, tone: 'purple' },
              ]} />
            );
          })()}

          {/* Growth lines */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-head"><h3>Growth Over Time</h3></div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mergeSeries(d)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="appointments" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="patients" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="dentists" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="dash-grid">
            {/* Revenue bars */}
            <div className="card">
              <div className="card-head"><h3>Revenue (PKR)</h3></div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={(d.revenueSeries || []).map((s) => ({ month: mLabel(s._id), total: s.total }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => `PKR ${Number(v).toLocaleString()}`} />
                  <Bar dataKey="total" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Appointment status donut */}
            <div className="card">
              <div className="card-head"><h3>Appointment Status</h3></div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={(d.statusBreakdown || []).map((s) => ({ name: s._id || 'unknown', value: s.count }))}
                    dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {(d.statusBreakdown || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="dash-grid">
            {/* Patients by city */}
            <div className="card">
              <div className="card-head"><h3>Patients by City</h3></div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart layout="vertical" data={(d.patientsByCity || []).map((s) => ({ city: s._id, count: s.count }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                  <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="city" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10B981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top treatments */}
            <div className="card">
              <div className="card-head"><h3>Top Treatments</h3></div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart layout="vertical" data={(d.topTreatments || []).map((s) => ({ name: s._id, count: s.count }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                  <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563EB" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Retention + Commission */}
          <div className="dash-grid">
            {/* Retention */}
            <div className="card">
              <div className="card-head"><h3>Patient Retention</h3></div>
              <StatCards items={[
                { label: 'Repeat Rate', value: `${d.retention?.rate ?? 0}%`, icon: Users, tone: 'green' },
              ]} />
              <div className="sub" style={{ marginTop: 8 }}>
                {(d.retention?.repeat ?? 0)} of {(d.retention?.withVisit ?? 0)} returned
              </div>
            </div>

            {/* Commission */}
            <div className="card">
              <div className="card-head"><h3>Commission</h3></div>
              <StatCards items={[
                { label: 'Earned', value: money(d.commissionTotals?.earned), icon: CurrencyDollar, tone: 'blue' },
                { label: 'Collected', value: money(d.commissionTotals?.collected), icon: CurrencyDollar, tone: 'green' },
                { label: 'Outstanding', value: money(d.commissionTotals?.outstanding), icon: CurrencyDollar, tone: 'amber' },
              ]} />
            </div>
          </div>

          {/* Top Earning Dentists */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-head"><h3>Top Earning Dentists</h3></div>
            {(d.topEarningDentists || []).length === 0 ? (
              <div className="empty">No earning dentists yet</div>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <tbody>
                    {(d.topEarningDentists || []).map((dent) => (
                      <tr key={dent._id}>
                        <td><UserCell name={dent.fullName} sub={dent.city} img={dent.photo} /></td>
                        <td style={{ textAlign: 'right' }}>{dent.bills} bills</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(dent.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Merge the three monthly series into one array keyed by month for the line chart.
function mergeSeries(d) {
  const map = {};
  const add = (arr, key) => (arr || []).forEach((s) => {
    const m = mLabel(s._id);
    map[m] = map[m] || { month: m, appointments: 0, patients: 0, dentists: 0 };
    map[m][key] = s.count;
  });
  add(d.appointmentSeries, 'appointments');
  add(d.patientSeries, 'patients');
  add(d.dentistSeries, 'dentists');
  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
}
