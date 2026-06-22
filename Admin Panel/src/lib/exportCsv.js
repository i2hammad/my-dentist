import api from './api';

// Escape a single CSV cell per RFC 4180 (wrap in quotes, double internal quotes).
function cell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Build CSV text from an array of rows and a column spec.
// columns: [{ header, value: (row) => any }]
export function toCsv(rows, columns) {
  const head = columns.map((c) => cell(c.header)).join(',');
  const body = rows
    .map((r) => columns.map((c) => cell(c.value(r))).join(','))
    .join('\r\n');
  return `${head}\r\n${body}`;
}

// Trigger a browser download of the given CSV text.
export function downloadCsv(filename, csv) {
  // Prepend BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Fetch ALL rows from a paginated admin list endpoint (not just the current
// page), then export them as a CSV download.
// `pick` optionally extracts the rows array from the response data when it's not
// the top-level `data` array (e.g. data = { doctors: [...] } -> pick = 'doctors').
export async function exportEndpointCsv(path, params, columns, filename, pick) {
  // Pull a large page so we get the full dataset in one request.
  const { data: res } = await api.get(path, { params: { page: 1, limit: 100000, ...params } });
  const rows = (pick ? res.data?.[pick] : res.data) || [];
  downloadCsv(filename, toCsv(rows, columns));
  return rows.length;
}
