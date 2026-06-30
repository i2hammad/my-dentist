import { useState } from 'react';
import { CalendarBlank, CheckCircle, Clock, XCircle, Eye } from '@phosphor-icons/react';
import useList from '../lib/useList';
import { PageHeader, StatCards, UserCell, Pagination, fmtDate } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import ExportButton from '../components/ExportButton.jsx';
import Modal from '../components/Modal.jsx';

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
  const [view, setView] = useState(null);
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
          <div className="table-scroll">
          <table>
            <thead><tr><th>Patient</th><th>Dentist</th><th>Date</th><th>Time</th><th>Treatment</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {L.data.map((a) => (
                <tr key={a._id}>
                  <td><UserCell name={a.patientId?.fullName} img={a.patientId?.profileImage} /></td>
                  <td><UserCell name={a.doctorId?.fullName} img={a.doctorId?.photo} /></td>
                  <td>{fmtDate(a.date)}</td>
                  <td>{a.time || '—'}</td>
                  <td>{a.treatmentType || '—'}</td>
                  <td><span className={`badge ${map[a.status] || 'gray'}`}>{a.status}</span></td>
                  <td><button className="icon-btn" title="View" onClick={() => setView(a)}><Eye size={16} /></button></td>
                </tr>
              ))}
              {!L.data.length && <tr><td colSpan={7} className="empty">No appointments found</td></tr>}
            </tbody>
          </table>
          </div>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}

      {view && (
        <Modal title="Appointment Details" onClose={() => setView(null)}>
          <div className="detail-grid">
            <div className="muted">Patient</div>
            <div><UserCell name={view.patientId?.fullName} img={view.patientId?.profileImage} /></div>
            <div className="muted">Dentist</div>
            <div><UserCell name={view.doctorId?.fullName} img={view.doctorId?.photo} /></div>
            <div className="muted">Treatment</div>
            <div>{view.treatmentType || '—'}</div>
            <div className="muted">Date &amp; Time</div>
            <div>{fmtDate(view.date)}{view.time ? ` · ${view.time}` : ''}</div>
            <div className="muted">Duration</div>
            <div>{view.duration ? `${view.duration} min` : '—'}</div>
            <div className="muted">Status</div>
            <div><span className={`badge ${map[view.status] || 'gray'}`}>{view.status}</span></div>
            <div className="muted">Consultation</div>
            <div>{view.consultationType || '—'}</div>
            <div className="muted">Description</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{view.description || '—'}</div>
            <div className="muted">Visit summary</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{view.visitSummary || '—'}</div>
            {view.rescheduleRequest?.requested && (
              <>
                <div className="muted">Reschedule requested</div>
                <div>
                  {fmtDate(view.rescheduleRequest.date)}
                  {view.rescheduleRequest.time ? ` · ${view.rescheduleRequest.time}` : ''}
                </div>
              </>
            )}
            <div className="muted">Billing</div>
            <div>
              {view.bill ? (() => {
                const b = view.bill;
                const money = (n) => 'Rs. ' + (Number(n) || 0).toLocaleString();
                const total = b.finalAmount || b.amount || 0;
                const paid = b.paidAmount || 0;
                const outstanding = Math.max(total - paid, 0);
                const billMap = { paid: 'green', unpaid: 'red', payment_pending: 'amber', refunded: 'gray', draft: 'amber' };
                const billLabel = b.status === 'payment_pending' ? 'Pending' : b.status;
                return (
                  <div className="detail-grid" style={{ rowGap: 6 }}>
                    <div className="muted">Invoice #</div>
                    <div>{b.invoiceNumber || '—'}</div>
                    <div className="muted">Bill status</div>
                    <div><span className={`badge ${billMap[b.status] || 'gray'}`}>{billLabel}</span></div>
                    <div className="muted">Total</div>
                    <div>{money(total)}</div>
                    <div className="muted">Paid</div>
                    <div>{money(paid)}</div>
                    <div className="muted">Outstanding</div>
                    <div>{money(outstanding)}</div>
                  </div>
                );
              })() : 'No bill generated for this appointment.'}
            </div>
            <div className="muted">Created</div>
            <div>{fmtDate(view.createdAt)}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
