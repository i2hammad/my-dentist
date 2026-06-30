import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Percent, Wallet, CheckCircle, WarningCircle, Eye } from '@phosphor-icons/react';
import api from '../lib/api';
import { PageHeader, StatCards, UserCell, fmtDate, money } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import ExportButton from '../components/ExportButton.jsx';

const COMM_CSV_COLS = [
  { header: 'Doctor', value: (r) => r.fullName },
  { header: 'City', value: (r) => r.city },
  { header: 'Collected', value: (r) => r.collected },
  { header: 'Commission Earned', value: (r) => r.commissionEarned },
  { header: 'Paid', value: (r) => r.commissionPaid },
  { header: 'Outstanding', value: (r) => r.commissionDue },
];

export default function Commission() {
  const [d, setD] = useState(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    api.get('/api/admin/commission').then((r) => setD(r.data.data)).catch(() => setD(false));
  }, []);

  if (d === false) return <div className="card"><div className="empty">Failed to load commission data</div></div>;
  if (!d) return (<div className="card"><PageHeader title="Commission" crumb="Commission" /><SkeletonStatCards /><SkeletonTable cols={6} /></div>);

  const rows = overdueOnly ? d.doctors.filter((r) => r.commissionDue > 0) : d.doctors;

  return (
    <div className="card">
      <PageHeader title="Platform Commission" crumb="Commission"
        actions={<ExportButton path="/api/admin/commission" columns={COMM_CSV_COLS} filename="commission.csv" pick="doctors" />} />

      <StatCards items={[
        { label: `Commission Earned (${d.rate}%)`, value: money(d.totals.earned), icon: Percent, tone: 'blue' },
        { label: 'Collected (Platform)', value: money(d.totals.paid), icon: CheckCircle, tone: 'green' },
        { label: 'Outstanding Dues', value: money(d.totals.due), icon: WarningCircle, tone: 'amber' },
        { label: 'Doctors Overdue', value: d.overdueCount, icon: Wallet, tone: 'purple' },
      ]} />

      <div className="toolbar">
        <label className="date-filter" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} style={{ width: 'auto' }} />
          Show only doctors with outstanding dues
        </label>
      </div>

      <div className="table-scroll">
      <table>
        <thead><tr><th>Doctor</th><th>City</th><th>Collected</th><th>Commission ({d.rate}%)</th><th>Paid</th><th>Outstanding</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id}>
              <td><UserCell name={r.fullName} img={r.photo} /></td>
              <td>{r.city || '—'}</td>
              <td>{money(r.collected)}</td>
              <td style={{ fontWeight: 600 }}>{money(r.commissionEarned)}</td>
              <td style={{ color: '#15803D' }}>{money(r.commissionPaid)}</td>
              <td>
                {r.commissionDue > 0
                  ? <span className="badge amber">{money(r.commissionDue)}</span>
                  : <span className="muted">—</span>}
                {r.isBlocked && <span className="badge red" style={{ marginLeft: 4 }}>Blocked</span>}
              </td>
              <td className="row-actions">
                <button className="icon-btn" title="Manage" onClick={() => nav(`/dentists/${r._id}`)}><Eye size={16} /></button>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={7} className="empty">No doctors found</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  );
}
