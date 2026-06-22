import { useState } from 'react';
import { ClockCounterClockwise, Trash, Megaphone, ListChecks } from '@phosphor-icons/react';
import useList from '../lib/useList';
import { PageHeader, StatCards, Pagination, fmtDate } from '../components/ui.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';
import ExportButton from '../components/ExportButton.jsx';

const ACTION_BADGE = { delete: 'red', update: 'amber', create: 'green', broadcast: 'blue', login: 'gray' };

const AUDIT_CSV_COLS = [
  { header: 'When', value: (r) => fmtDate(r.createdAt) },
  { header: 'Admin', value: (r) => r.actorName },
  { header: 'Action', value: (r) => r.action },
  { header: 'Entity', value: (r) => r.entity },
  { header: 'Description', value: (r) => r.description },
];

export default function AuditLog() {
  const [action, setAction] = useState('all');
  const L = useList('/api/admin/audit-logs', { action });
  const c = L.counts;

  return (
    <div className="card">
      <PageHeader title="Activity Log" crumb="Activity Log"
        actions={<ExportButton path="/api/admin/audit-logs" params={{ action }} columns={AUDIT_CSV_COLS} filename="activity-log.csv" />} />

      {L.loading ? <SkeletonStatCards /> : (
        <StatCards items={[
          { label: 'Total Events', value: c.total ?? '—', icon: ListChecks, tone: 'blue' },
          { label: 'Deletions', value: c.deletes ?? '—', icon: Trash, tone: 'red' },
          { label: 'Broadcasts', value: c.broadcasts ?? '—', icon: Megaphone, tone: 'amber' },
          { label: 'Recent', value: c.total ?? '—', icon: ClockCounterClockwise, tone: 'purple' },
        ]} />
      )}

      <div className="toolbar">
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="all">All Actions</option>
          <option value="delete">Delete</option>
          <option value="update">Update</option>
          <option value="create">Create</option>
          <option value="broadcast">Broadcast</option>
        </select>
      </div>

      {L.loading ? <SkeletonTable cols={5} withUser={false} /> : (
        <>
          <table>
            <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th><th>Description</th></tr></thead>
            <tbody>
              {L.data.map((r) => (
                <tr key={r._id}>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td style={{ fontWeight: 600 }}>{r.actorName || '—'}</td>
                  <td><span className={`badge ${ACTION_BADGE[r.action] || 'gray'}`}>{r.action}</span></td>
                  <td style={{ textTransform: 'capitalize' }}>{r.entity || '—'}</td>
                  <td className="muted">{r.description || '—'}</td>
                </tr>
              ))}
              {!L.data.length && <tr><td colSpan={5} className="empty">No activity recorded yet</td></tr>}
            </tbody>
          </table>
          <Pagination page={L.page} pages={L.pages} total={L.total} onPage={L.setPage} />
        </>
      )}
    </div>
  );
}
