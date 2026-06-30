import { useState, useEffect, useCallback } from 'react';
import { Megaphone, PaperPlaneTilt, Users, Tooth, UsersThree, Clock, X } from '@phosphor-icons/react';
import api from '../lib/api';
import { PageHeader, fmtDate } from '../components/ui.jsx';
import Field from '../components/Field.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

const AUDIENCES = [
  { key: 'all', label: 'Everyone', sub: 'Patients + Dentists', Icon: UsersThree },
  { key: 'patient', label: 'Patients', sub: 'All patients', Icon: Users },
  { key: 'doctor', label: 'Dentists', sub: 'All dentists', Icon: Tooth },
];
const SB_BADGE = { scheduled: 'blue', sent: 'green', cancelled: 'red', failed: 'red' };

export default function Broadcast() {
  const toast = useToast();
  const confirm = useConfirm();
  const [audience, setAudience] = useState('all');
  const [city, setCity] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sendAt, setSendAt] = useState(''); // datetime-local; blank = send now
  const [busy, setBusy] = useState(false);
  const [scheduled, setScheduled] = useState([]);

  const loadScheduled = useCallback(async () => {
    try { const r = await api.get('/api/admin/scheduled-broadcasts'); setScheduled(r.data.data || []); }
    catch { /* ignore */ }
  }, []);
  useEffect(() => { loadScheduled(); }, [loadScheduled]);

  const send = async () => {
    if (!title.trim() || !message.trim()) return toast('Title and message are required', 'error');
    const label = AUDIENCES.find((a) => a.key === audience)?.label || audience;
    const scheduling = !!sendAt;
    const msg = scheduling
      ? `Schedule this notification to ${label} for ${new Date(sendAt).toLocaleString()}?`
      : `Send this notification to ${label} now? This cannot be undone.`;
    if (!(await confirm({ title: scheduling ? 'Schedule Broadcast' : 'Send Broadcast', message: msg, confirmText: scheduling ? 'Schedule' : 'Send' }))) return;
    setBusy(true);
    try {
      const body = { title: title.trim(), message: message.trim(), audience, city: city.trim() };
      if (sendAt) body.sendAt = new Date(sendAt).toISOString();
      const r = await api.post('/api/admin/broadcast', body);
      if (r.data.data.scheduled) { toast(`Scheduled for ${new Date(r.data.data.sendAt).toLocaleString()}`); loadScheduled(); }
      else toast(`Sent to ${r.data.data.sent} user(s)`);
      setTitle(''); setMessage(''); setSendAt('');
    } catch (e) {
      toast(e.response?.data?.message || 'Failed to send', 'error');
    } finally { setBusy(false); }
  };

  const cancelScheduled = async (sb) => {
    if (!(await confirm({ title: 'Cancel Broadcast', message: `Cancel the scheduled broadcast "${sb.title}"?`, confirmText: 'Cancel it', destructive: true }))) return;
    try { await api.delete(`/api/admin/scheduled-broadcasts/${sb._id}`); toast('Scheduled broadcast cancelled'); loadScheduled(); }
    catch (e) { toast(e.response?.data?.message || 'Failed to cancel', 'error'); }
  };

  return (
    <div className="card">
      <PageHeader title="Broadcast Notification" crumb="Broadcast" />

      <p className="muted" style={{ marginBottom: 18, fontSize: 13 }}>
        Send an in-app notification to all patients or dentists at once. It appears in their notification inbox.
      </p>

      <div className="field"><label>Audience</label></div>
      <div className="dash-grid" style={{ marginBottom: 18 }}>
        {AUDIENCES.map((a) => (
          <button key={a.key} type="button" onClick={() => setAudience(a.key)}
            className="card"
            style={{
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
              border: audience === a.key ? '2px solid #2563EB' : '1px solid #E2E8F0',
              background: audience === a.key ? '#EFF6FF' : '#fff',
            }}>
            <a.Icon size={28} color={audience === a.key ? '#2563EB' : '#64748B'} weight="duotone" />
            <div>
              <div style={{ fontWeight: 700, color: '#0F172A' }}>{a.label}</div>
              <div className="muted" style={{ fontSize: 12 }}>{a.sub}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 640 }}>
        <Field label="City (optional)" value={city} onChange={setCity} placeholder="e.g. Lahore" />
        <p className="muted" style={{ marginTop: -6, marginBottom: 14, fontSize: 12 }}>
          Leave blank to send to everyone in the selected audience.
        </p>
        <Field label="Title" value={title} onChange={setTitle} required placeholder="e.g. Scheduled Maintenance" />
        <Field label="Message" type="textarea" value={message} onChange={setMessage} required
          placeholder="Write the notification message patients/dentists will see…" />

        <div className="field">
          <label>Schedule for later (optional)</label>
          <input type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
        </div>
        <p className="muted" style={{ marginTop: -6, marginBottom: 14, fontSize: 12 }}>
          Leave blank to send immediately. Scheduled broadcasts fire automatically (via the server cron).
        </p>

        <div style={{ marginTop: 8 }}>
          <button className="btn primary" disabled={busy} onClick={send}>
            {sendAt
              ? <Clock size={16} weight="bold" style={{ marginRight: 6, verticalAlign: -2 }} />
              : <PaperPlaneTilt size={16} weight="bold" style={{ marginRight: 6, verticalAlign: -2 }} />}
            {busy ? 'Working…' : (sendAt ? 'Schedule Broadcast' : 'Send Broadcast')}
          </button>
        </div>
      </div>

      {scheduled.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="card-head"><h3>Scheduled & Recent Broadcasts</h3></div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Title</th><th>Audience</th><th>City</th><th>When</th><th>Status</th><th>Sent</th><th></th></tr></thead>
              <tbody>
                {scheduled.map((sb) => (
                  <tr key={sb._id}>
                    <td style={{ fontWeight: 600 }}>{sb.title}</td>
                    <td style={{ textTransform: 'capitalize' }}>{sb.audience}</td>
                    <td>{sb.city || '—'}</td>
                    <td>{fmtDate(sb.sendAt)} {new Date(sb.sendAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span className={`badge ${SB_BADGE[sb.status] || 'blue'}`} style={{ textTransform: 'capitalize' }}>{sb.status}</span></td>
                    <td>{sb.status === 'sent' ? sb.sentCount : '—'}</td>
                    <td className="row-actions">
                      {sb.status === 'scheduled' && (
                        <button className="icon-btn del" title="Cancel" onClick={() => cancelScheduled(sb)}><X size={16} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
