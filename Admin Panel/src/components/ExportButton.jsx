import { useState } from 'react';
import { DownloadSimple, CircleNotch } from '@phosphor-icons/react';
import { exportEndpointCsv } from '../lib/exportCsv';
import { useToast } from './feedback.jsx';

// Reusable "Export CSV" button for admin list pages.
// Fetches the FULL dataset from the endpoint (respecting current filters via
// `params`), maps each row through `columns`, and downloads a CSV.
//
//   <ExportButton path="/api/admin/patients" params={{ search }}
//     filename="patients.csv"
//     columns={[{ header: 'Name', value: r => r.fullName }, ...]} />
export default function ExportButton({ path, params = {}, columns, filename, label = 'Export CSV', pick }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const n = await exportEndpointCsv(path, params, columns, filename, pick);
      toast(n ? `Exported ${n} rows` : 'No data to export');
    } catch (e) {
      toast(e.response?.data?.message || 'Export failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn ghost" disabled={busy} onClick={run}>
      {busy
        ? <CircleNotch size={16} className="spin" style={{ marginRight: 6, verticalAlign: -2 }} />
        : <DownloadSimple size={16} weight="bold" style={{ marginRight: 6, verticalAlign: -2 }} />}
      {busy ? 'Exporting…' : label}
    </button>
  );
}
