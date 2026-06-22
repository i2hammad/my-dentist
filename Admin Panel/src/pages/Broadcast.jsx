import { useState } from 'react';
import { Megaphone, PaperPlaneTilt, Users, Tooth, UsersThree } from '@phosphor-icons/react';
import api from '../lib/api';
import { PageHeader } from '../components/ui.jsx';
import Field from '../components/Field.jsx';
import { useToast, useConfirm } from '../components/feedback.jsx';

const AUDIENCES = [
  { key: 'all', label: 'Everyone', sub: 'Patients + Dentists', Icon: UsersThree },
  { key: 'patient', label: 'Patients', sub: 'All patients', Icon: Users },
  { key: 'doctor', label: 'Dentists', sub: 'All dentists', Icon: Tooth },
];

export default function Broadcast() {
  const toast = useToast();
  const confirm = useConfirm();
  const [audience, setAudience] = useState('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!title.trim() || !message.trim()) return toast('Title and message are required', 'error');
    const label = AUDIENCES.find((a) => a.key === audience)?.label || audience;
    if (!(await confirm({ title: 'Send Broadcast', message: `Send this notification to ${label}? This cannot be undone.`, confirmText: 'Send' }))) return;
    setBusy(true);
    try {
      const r = await api.post('/api/admin/broadcast', { title: title.trim(), message: message.trim(), audience });
      toast(`Sent to ${r.data.data.sent} user(s)`);
      setTitle(''); setMessage('');
    } catch (e) {
      toast(e.response?.data?.message || 'Failed to send', 'error');
    } finally { setBusy(false); }
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
        <Field label="Title" value={title} onChange={setTitle} required placeholder="e.g. Scheduled Maintenance" />
        <Field label="Message" type="textarea" value={message} onChange={setMessage} required
          placeholder="Write the notification message patients/dentists will see…" />
        <div style={{ marginTop: 8 }}>
          <button className="btn primary" disabled={busy} onClick={send}>
            <PaperPlaneTilt size={16} weight="bold" style={{ marginRight: 6, verticalAlign: -2 }} />
            {busy ? 'Sending…' : 'Send Broadcast'}
          </button>
        </div>
      </div>
    </div>
  );
}
