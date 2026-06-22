import { useState } from 'react';
import { Star, SealCheck, TrendUp, ChatCircle, Trash } from '@phosphor-icons/react';
import useList from '../lib/useList';
import { PageHeader, StatCards, UserCell, Stars, Pagination, fmtDate } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import ExportButton from '../components/ExportButton.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

const REVIEW_CSV_COLS = [
  { header: 'Patient', value: (r) => r.patientId?.fullName },
  { header: 'Dentist', value: (r) => r.doctorId?.fullName },
  { header: 'Rating', value: (r) => r.rating },
  { header: 'Comment', value: (r) => r.comment },
  { header: 'Date', value: (r) => fmtDate(r.createdAt) },
];

export default function Reviews() {
  const [rating, setRating] = useState('all');
  const L = useList('/api/admin/reviews', { rating });
  const c = L.counts;
  const toast = useToast();
  const confirm = useConfirm();

  const del = async (r) => {
    if (!(await confirm({ title: 'Delete Review', message: 'Delete this review permanently?', confirmText: 'Delete', destructive: true }))) return;
    try { await L.remove(r._id); toast('Review deleted'); } catch { toast('Failed to delete', 'error'); }
  };

  return (
    <div className="card">
      <PageHeader title="Reviews & Ratings" crumb="Reviews & Ratings"
        actions={<ExportButton path="/api/admin/reviews" params={{ rating }} columns={REVIEW_CSV_COLS} filename="reviews.csv" />} />
      {L.loading ? <SkeletonStatCards /> : (
      <StatCards items={[
        { label: 'Total Reviews', value: c.total ?? '—', icon: Star, tone: 'blue' },
        { label: 'Verified', value: c.verified ?? '—', icon: SealCheck, tone: 'green' },
        { label: 'Avg Rating', value: c.avgRating ?? '—', icon: TrendUp, tone: 'amber' },
        { label: 'All Reviews', value: c.total ?? '—', icon: ChatCircle, tone: 'purple' },
      ]} />
      )}

      <div className="toolbar">
        <select value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="all">All Ratings</option>
          <option value="5">★★★★★ (5)</option>
          <option value="4">★★★★ (4)</option>
          <option value="3">★★★ (3)</option>
          <option value="2">★★ (2)</option>
          <option value="1">★ (1)</option>
        </select>
      </div>

      {L.loading ? <SkeletonTable cols={6} /> : (
        <>
          <table>
            <thead><tr><th>Patient</th><th>Dentist</th><th>Rating</th><th>Comment</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {L.data.map((r) => (
                <tr key={r._id}>
                  <td><UserCell name={r.patientId?.fullName} img={r.patientId?.profileImage} /></td>
                  <td><UserCell name={r.doctorId?.fullName} img={r.doctorId?.photo} /></td>
                  <td><Stars value={r.rating} /></td>
                  <td style={{ maxWidth: 280 }} className="muted">{r.comment || '—'}</td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td className="row-actions">
                    <button className="icon-btn del" title="Delete" onClick={() => del(r)}><Trash size={16} /></button>
                  </td>
                </tr>
              ))}
              {!L.data.length && <tr><td colSpan={6} className="empty">No reviews found</td></tr>}
            </tbody>
          </table>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}
    </div>
  );
}
