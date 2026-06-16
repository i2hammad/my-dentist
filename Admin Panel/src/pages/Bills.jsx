import { useState } from 'react';
import { Receipt, CurrencyDollar, Clock, Wallet } from '@phosphor-icons/react';
import useList from '../lib/useList';
import { PageHeader, StatCards, UserCell, Pagination, fmtDate, money } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';

export default function Bills() {
  const [status, setStatus] = useState('all');
  const L = useList('/api/admin/bills', { status });
  const c = L.counts;

  return (
    <div className="card">
      <PageHeader title="Bills & Bill History" crumb="Bills & Bill History" />
      {L.loading ? <SkeletonStatCards /> : (
      <StatCards items={[
        { label: 'Total Bills', value: c.total ?? '—', icon: Receipt, tone: 'blue' },
        { label: 'Paid Bills', value: c.paid ?? '—', icon: CurrencyDollar, tone: 'green' },
        { label: 'Pending Bills', value: c.pending ?? '—', icon: Clock, tone: 'amber' },
        { label: 'Total Amount', value: money(c.totalAmount), icon: Wallet, tone: 'purple' },
      ]} />
      )}
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>

      {L.loading ? <SkeletonTable cols={7} /> : (
        <>
          <table>
            <thead><tr><th>Invoice</th><th>Patient</th><th>Dentist</th><th>Treatment</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {L.data.map((b) => (
                <tr key={b._id}>
                  <td style={{ fontWeight: 600 }}>{b.invoiceNumber || '—'}</td>
                  <td><UserCell name={b.patientId?.fullName} img={b.patientId?.profileImage} /></td>
                  <td><UserCell name={b.doctorId?.fullName} img={b.doctorId?.photo} /></td>
                  <td>{b.treatmentName || '—'}</td>
                  <td>{money(b.finalAmount)}</td>
                  <td><span className={`badge ${b.status === 'paid' ? 'green' : 'amber'}`}>{b.status}</span></td>
                  <td>{fmtDate(b.createdAt)}</td>
                </tr>
              ))}
              {!L.data.length && <tr><td colSpan={7} className="empty">No bills found</td></tr>}
            </tbody>
          </table>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}
    </div>
  );
}
