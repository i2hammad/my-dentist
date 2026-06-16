import { Star, SealCheck, TrendUp, ChatCircle, Trash } from '@phosphor-icons/react';
import useList from '../lib/useList';
import { PageHeader, StatCards, UserCell, Stars, Pagination, fmtDate } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

export default function Reviews() {
  const L = useList('/api/admin/reviews');
  const c = L.counts;
  const toast = useToast();
  const confirm = useConfirm();

  const del = async (r) => {
    if (!(await confirm({ title: 'Delete Review', message: 'Delete this review permanently?', confirmText: 'Delete', destructive: true }))) return;
    try { await L.remove(r._id); toast('Review deleted'); } catch { toast('Failed to delete', 'error'); }
  };

  return (
    <div className="card">
      <PageHeader title="Reviews & Ratings" crumb="Reviews & Ratings" />
      {L.loading ? <SkeletonStatCards /> : (
      <StatCards items={[
        { label: 'Total Reviews', value: c.total ?? '—', icon: Star, tone: 'blue' },
        { label: 'Verified', value: c.verified ?? '—', icon: SealCheck, tone: 'green' },
        { label: 'Avg Rating', value: c.avgRating ?? '—', icon: TrendUp, tone: 'amber' },
        { label: 'All Reviews', value: c.total ?? '—', icon: ChatCircle, tone: 'purple' },
      ]} />
      )}

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
