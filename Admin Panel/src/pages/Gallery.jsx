import { useState } from 'react';
import { Image, Camera, TreeStructure, Sparkle, Trash } from '@phosphor-icons/react';
import useList from '../lib/useList';
import { PageHeader, StatCards, Pagination, fmtDate } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';
import { imgUrl } from '../lib/api';

export default function Gallery() {
  const [category, setCategory] = useState('all');
  const L = useList('/api/admin/gallery', { category });
  const c = L.counts;
  const toast = useToast();
  const confirm = useConfirm();

  const del = async (g) => {
    if (!(await confirm({ title: 'Delete Image', message: 'Remove this image from the gallery?', confirmText: 'Delete', destructive: true }))) return;
    try { await L.remove(g._id); toast('Image deleted'); } catch { toast('Failed to delete', 'error'); }
  };

  return (
    <div className="card">
      <PageHeader title="Gallery" crumb="Gallery" />
      {L.loading ? <SkeletonStatCards /> : (
      <StatCards items={[
        { label: 'Total Images', value: c.total ?? '—', icon: Image, tone: 'blue' },
        { label: 'In Gallery', value: c.total ?? '—', icon: Camera, tone: 'green' },
        { label: 'Categories', value: '3', icon: TreeStructure, tone: 'amber' },
        { label: 'New This Month', value: c.newThisMonth ?? '—', icon: Sparkle, tone: 'purple' },
      ]} />
      )}
      <div className="toolbar">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All Categories</option>
          <option value="clinic_photos">Clinic Photos</option>
          <option value="before_after">Before & After</option>
          <option value="certificates">Certificates</option>
        </select>
      </div>

      {L.loading ? <SkeletonTable cols={6} withUser={false} /> : (
        <>
          <table>
            <thead><tr><th>Thumbnail</th><th>Title</th><th>Dentist</th><th>Category</th><th>Added</th><th>Actions</th></tr></thead>
            <tbody>
              {L.data.map((g) => (
                <tr key={g._id}>
                  <td>
                    <img src={imgUrl(g.imageUrl || g.beforeImage)} alt="" style={{ width: 56, height: 40, borderRadius: 8, objectFit: 'cover', background: '#E2E8F0' }}
                      onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{g.title || '—'}</td>
                  <td>{g.doctorId?.fullName || '—'}</td>
                  <td><span className="badge blue">{(g.category || '').replace(/_/g, ' ')}</span></td>
                  <td>{fmtDate(g.createdAt)}</td>
                  <td className="row-actions">
                    <button className="icon-btn del" title="Delete" onClick={() => del(g)}><Trash size={16} /></button>
                  </td>
                </tr>
              ))}
              {!L.data.length && <tr><td colSpan={6} className="empty">No images found</td></tr>}
            </tbody>
          </table>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}
    </div>
  );
}
