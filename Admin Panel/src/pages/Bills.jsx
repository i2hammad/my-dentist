import { useState } from 'react';
import { Receipt, CurrencyDollar, Clock, Wallet, CheckCircle, WarningCircle, Eye } from '@phosphor-icons/react';
import useList from '../lib/useList';
import { PageHeader, StatCards, UserCell, Pagination, fmtDate, money } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import ExportButton from '../components/ExportButton.jsx';
import Modal from '../components/Modal.jsx';

const BILL_CSV_COLS = [
  { header: 'Invoice', value: (r) => r.invoiceNumber },
  { header: 'Patient', value: (r) => r.patientId?.fullName },
  { header: 'Dentist', value: (r) => r.doctorId?.fullName },
  { header: 'Treatment', value: (r) => r.treatmentName },
  { header: 'Amount', value: (r) => r.amount },
  { header: 'Discount', value: (r) => r.discountFromRewards },
  { header: 'Final', value: (r) => r.finalAmount },
  { header: 'Paid', value: (r) => r.paidAmount },
  { header: 'Status', value: (r) => r.status },
  { header: 'Date', value: (r) => fmtDate(r.createdAt) },
];

export default function Bills() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState(null); // selected bill for detail modal
  const L = useList('/api/admin/bills', { status, search, from, to });
  const c = L.counts;

  const clearFilters = () => { setStatus('all'); setSearch(''); setFrom(''); setTo(''); };
  const hasFilter = status !== 'all' || search || from || to;

  return (
    <div className="card">
      <PageHeader title="Bills & Bill History" crumb="Bills & Bill History"
        actions={<ExportButton path="/api/admin/bills" params={{ status, search, from, to }} columns={BILL_CSV_COLS} filename="bills.csv" />} />
      {L.loading ? <SkeletonStatCards /> : (
      <StatCards items={[
        { label: 'Total Bills', value: c.total ?? '—', icon: Receipt, tone: 'blue' },
        { label: 'Collected', value: money(c.collected), icon: CheckCircle, tone: 'green' },
        { label: 'Outstanding', value: money(c.outstanding), icon: WarningCircle, tone: 'amber' },
        { label: 'Total Billed', value: money(c.totalAmount), icon: Wallet, tone: 'purple' },
      ]} />
      )}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <input type="text" placeholder="Search invoice / treatment…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="draft">Draft</option>
        </select>
        <label className="date-filter">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="date-filter">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {hasFilter && <button className="btn ghost" onClick={clearFilters}>Clear</button>}
      </div>

      {L.loading ? <SkeletonTable cols={8} /> : (
        <>
          <table>
            <thead><tr><th>Invoice</th><th>Patient</th><th>Dentist</th><th>Treatment</th><th>Final</th><th>Paid</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {L.data.map((b) => (
                <tr key={b._id}>
                  <td style={{ fontWeight: 600 }}>{b.invoiceNumber || '—'}</td>
                  <td><UserCell name={b.patientId?.fullName} img={b.patientId?.profileImage} /></td>
                  <td><UserCell name={b.doctorId?.fullName} img={b.doctorId?.photo} /></td>
                  <td>{b.treatmentName || '—'}</td>
                  <td>{money(b.finalAmount)}</td>
                  <td>{money(b.paidAmount)}</td>
                  <td><span className={`badge ${b.status === 'paid' ? 'green' : b.status === 'draft' ? 'gray' : 'amber'}`}>{b.status}</span></td>
                  <td>{fmtDate(b.createdAt)}</td>
                  <td className="row-actions">
                    <button className="icon-btn" title="View invoice" onClick={() => setView(b)}><Eye size={16} /></button>
                  </td>
                </tr>
              ))}
              {!L.data.length && <tr><td colSpan={9} className="empty">No bills found</td></tr>}
            </tbody>
          </table>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}

      {view && <BillDetail bill={view} onClose={() => setView(null)} />}
    </div>
  );
}

function BillDetail({ bill, onClose }) {
  const due = Math.max(0, (bill.finalAmount || 0) - (bill.paidAmount || 0));
  return (
    <Modal title={`Invoice ${bill.invoiceNumber || ''}`} onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>Close</button>}>
      <div className="detail-grid">
        <div><div className="k">Patient</div><div className="v">{bill.patientId?.fullName || '—'}</div></div>
        <div><div className="k">Dentist</div><div className="v">{bill.doctorId?.fullName || '—'}</div></div>
        <div><div className="k">Treatment</div><div className="v">{bill.treatmentName || '—'}</div></div>
        <div><div className="k">Date</div><div className="v">{fmtDate(bill.createdAt)}</div></div>
        <div><div className="k">Status</div><div className="v" style={{ textTransform: 'capitalize' }}>{bill.status}</div></div>
        <div><div className="k">Invoice #</div><div className="v">{bill.invoiceNumber || '—'}</div></div>
      </div>
      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14, marginTop: 4 }}>
        <Row k="Amount" v={money(bill.amount)} />
        {(bill.discountFromRewards || 0) > 0 && <Row k="Rewards Discount" v={'- ' + money(bill.discountFromRewards)} green />}
        <Row k="Final Amount" v={money(bill.finalAmount)} bold />
        <Row k="Paid" v={money(bill.paidAmount)} green />
        <Row k="Balance Due" v={money(due)} bold red={due > 0} />
      </div>
    </Modal>
  );
}

function Row({ k, v, bold, green, red }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
      <span className="muted" style={{ fontSize: 13 }}>{k}</span>
      <span style={{ fontWeight: bold ? 700 : 600, color: red ? '#B91C1C' : green ? '#15803D' : '#0F172A' }}>{v}</span>
    </div>
  );
}
