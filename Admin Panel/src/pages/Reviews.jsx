import { useState } from 'react';
import { Star, SealCheck, TrendUp, ChatCircle, Trash, Eye, EyeSlash, ChatText } from '@phosphor-icons/react';
import useList from '../lib/useList';
import api from '../lib/api';
import { PageHeader, StatCards, UserCell, Stars, Pagination, fmtDate } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import ExportButton from '../components/ExportButton.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';
import Modal from '../components/Modal';

const REVIEW_CSV_COLS = [
  { header: 'Patient', value: (r) => r.patientId?.fullName },
  { header: 'Dentist', value: (r) => r.doctorId?.fullName },
  { header: 'Rating', value: (r) => r.rating },
  { header: 'Comment', value: (r) => r.comment },
  { header: 'Date', value: (r) => fmtDate(r.createdAt) },
];

export default function Reviews() {
  const [rating, setRating] = useState('all');
  const [view, setView] = useState(null);
  const L = useList('/api/admin/reviews', { rating });
  const c = L.counts;
  const toast = useToast();
  const confirm = useConfirm();

  const del = async (r) => {
    if (!(await confirm({ title: 'Delete Review', message: 'Delete this review permanently?', confirmText: 'Delete', destructive: true }))) return;
    try { await L.remove(r._id); toast('Review deleted'); } catch { toast('Failed to delete', 'error'); }
  };

  // Hide/unhide a review from the public feed + rating math (moderation).
  const toggleHide = async (r) => {
    try {
      await api.patch(`/api/admin/reviews/${r._id}`, { hidden: !r.hidden });
      toast(r.hidden ? 'Review is now visible' : 'Review hidden from patients');
      L.reload();
      setView((v) => (v && v._id === r._id ? { ...v, hidden: !r.hidden } : v));
    } catch { toast('Failed to update', 'error'); }
  };

  // Reply to a review on behalf of the dentist (or clear the reply).
  const reply = async (r) => {
    const text = window.prompt('Reply to this review (leave blank to clear):', r.doctorReply?.text || '');
    if (text === null) return;
    try {
      await api.patch(`/api/admin/reviews/${r._id}/reply`, { text });
      toast(text.trim() ? 'Reply posted' : 'Reply cleared');
      L.reload();
      setView((v) => (v && v._id === r._id ? { ...v, doctorReply: { text } } : v));
    } catch { toast('Failed to post reply', 'error'); }
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
          <div className="table-scroll">
          <table>
            <thead><tr><th>Patient</th><th>Dentist</th><th>Rating</th><th>Comment</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {L.data.map((r) => (
                <tr key={r._id}>
                  <td><UserCell name={r.patientId?.fullName} img={r.patientId?.profileImage} /></td>
                  <td><UserCell name={r.doctorId?.fullName} img={r.doctorId?.photo} /></td>
                  <td><Stars value={r.rating} /></td>
                  <td style={{ maxWidth: 280 }} className="muted" title={r.comment || undefined}>
                    {r.hidden && <span className="badge red" style={{ marginRight: 6 }}>Hidden</span>}
                    {r.comment || '—'}
                  </td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td className="row-actions">
                    <button className="icon-btn" title="View" onClick={() => setView(r)}><Eye size={16} /></button>
                    <button className="icon-btn" title="Reply on behalf" onClick={() => reply(r)}><ChatText size={16} /></button>
                    <button className="icon-btn" title={r.hidden ? 'Unhide' : 'Hide from patients'} onClick={() => toggleHide(r)}>{r.hidden ? <Eye size={16} /> : <EyeSlash size={16} />}</button>
                    <button className="icon-btn del" title="Delete" onClick={() => del(r)}><Trash size={16} /></button>
                  </td>
                </tr>
              ))}
              {!L.data.length && <tr><td colSpan={6} className="empty">No reviews found</td></tr>}
            </tbody>
          </table>
          </div>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}

      {view && (
        <Modal
          title="Review Details"
          onClose={() => setView(null)}
          footer={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" onClick={() => reply(view)}>Reply on behalf</button>
              <button className="btn" onClick={() => toggleHide(view)}>{view.hidden ? 'Unhide' : 'Hide from patients'}</button>
            </div>
          }
        >
          <div className="detail-grid">
            <div className="muted">Status</div>
            <div>{view.hidden ? <span className="badge red">Hidden from patients</span> : <span className="badge green">Visible</span>}</div>
            <div className="muted">Patient</div>
            <div><UserCell name={view.patientId?.fullName} img={view.patientId?.profileImage} /></div>
            <div className="muted">Dentist</div>
            <div><UserCell name={view.doctorId?.fullName} img={view.doctorId?.photo} /></div>
            <div className="muted">Rating</div>
            <div><Stars value={view.rating} /> {view.rating}</div>
            <div className="muted">Date</div>
            <div>{fmtDate(view.createdAt)}</div>
            <div className="muted">Comment</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{view.comment || '—'}</div>
            {(view.doctorReply?.text || view.reply?.text || (typeof view.reply === 'string' && view.reply)) && (
              <>
                <div className="muted">Doctor's reply</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{view.doctorReply?.text || view.reply?.text || view.reply}</div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
