// Bluetooth thermal-printer helper (58mm ESC/POS) using
// @finan-me/react-native-thermal-printer. Native module — only works in a
// custom dev/release build, NOT in Expo Go or on web. All entry points guard
// for that so the rest of the app never crashes.
import { Platform, PermissionsAndroid } from 'react-native';

const isWeb = Platform.OS === 'web';
const PAPER_WIDTH_MM = 58;
const COLS = 32; // ~chars per line on a 58mm roll (font A)

// Lazily require the native lib so web / Expo Go never try to load it.
// The printer functions live on the `ThermalPrinter` namespace export, not at
// the top level — calling them top-level was the "undefined is not a function".
function lib() {
  if (isWeb) return null;
  try {
    const mod = require('@finan-me/react-native-thermal-printer');
    return mod?.ThermalPrinter || mod;
  } catch { return null; }
}

export function isThermalSupported() {
  return !isWeb && !!(lib()?.scanDevices);
}

// Android 12+ needs BLUETOOTH_CONNECT/SCAN granted at runtime before scanning.
export async function ensureBtPermissions() {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version < 31) return true; // legacy perms are install-time
  try {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ]);
    return Object.values(res).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  } catch { return false; }
}

// The native scanDevices() resolves only { success } — the actual devices are
// delivered through events (paired bonded devices immediately, discovered ones
// as they appear), each as a JSON STRING. So we listen for those events instead
// of reading the (empty) promise result, which is why earlier scans found nothing.
const parseDeviceList = (s) => {
  if (!s) return [];
  if (Array.isArray(s)) return s;
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : (v ? [v] : []); } catch { return []; }
};

// Returns { paired: [{name,address,deviceType}], found: [...] }. Caller shows a picker.
export async function scanPrinters() {
  const L = lib();
  if (!L) throw new Error('Bluetooth printing needs the installed app (not Expo Go / web).');
  const ok = await ensureBtPermissions();
  if (!ok) throw new Error('Bluetooth permission denied. Enable it in Settings.');

  // Older shape fallback: if the event API isn't available, try the promise.
  if (typeof L.addDiscoveryEventListener !== 'function') {
    const res = await L.scanDevices();
    return { paired: parseDeviceList(res?.paired), found: parseDeviceList(res?.found) };
  }

  return new Promise((resolve, reject) => {
    let paired = [];
    const foundMap = {};
    const subs = [];
    let settled = false;
    let settleTimer = null;
    let hardTimer = null;

    const cleanup = () => {
      if (settleTimer) clearTimeout(settleTimer);
      if (hardTimer) clearTimeout(hardTimer);
      subs.forEach((s) => { try { s?.remove?.(); } catch {} });
      try { L.stopScanDevices?.(); } catch {}
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ paired, found: Object.values(foundMap) });
    };
    // Once paired devices arrive, don't make the user wait the full ~12s
    // discovery — most printers (incl. SP-X) are already paired.
    const scheduleSettle = (ms) => { if (settleTimer) clearTimeout(settleTimer); settleTimer = setTimeout(finish, ms); };
    const on = (evt, cb) => { try { if (evt) subs.push(L.addDiscoveryEventListener(evt, cb)); } catch {} };

    on(L.EVENT_DEVICE_ALREADY_PAIRED, (d) => {
      const list = parseDeviceList(d?.devices);
      if (list.length) { paired = list; scheduleSettle(2500); }
    });
    on(L.EVENT_DEVICE_FOUND, (d) => {
      parseDeviceList(d?.device).forEach((dev) => { if (dev?.address) foundMap[dev.address] = dev; });
    });
    on(L.EVENT_DEVICE_DISCOVER_DONE, (d) => {
      const p = parseDeviceList(d?.paired); if (p.length) paired = p;
      parseDeviceList(d?.found).forEach((dev) => { if (dev?.address) foundMap[dev.address] = dev; });
      finish();
    });
    on(L.EVENT_BLUETOOTH_NOT_SUPPORT, () => { cleanup(); if (!settled) { settled = true; reject(new Error('Bluetooth is not supported on this device.')); } });

    // Hard cap so the spinner never hangs even if discovery never finishes.
    hardTimer = setTimeout(finish, 9000);

    Promise.resolve(L.scanDevices()).then((res) => {
      // Discovery of NEW devices may fail to start (location off, etc.) but the
      // paired event already fired — settle soon with the paired list.
      if (res && res.success === false) scheduleSettle(700);
    }).catch(() => scheduleSettle(700));
  });
}

// The native print API needs a typed address prefix (bt:/ble:/lan:). Bonded
// thermal printers like the SP-X are Classic Bluetooth → 'bt:'.
function normalizeAddress(device) {
  const raw = (typeof device === 'string' ? device : device?.address || '').trim();
  if (/^(bt|ble|lan):/i.test(raw)) return raw;
  const type = typeof device === 'object' ? device?.deviceType : null;
  return `${type === 'ble' ? 'ble:' : 'bt:'}${raw}`;
}

const rs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

// Build the ESC/POS document (Node[]) for one receipt, mirroring the HTML one.
// Node shapes follow the library's documented content types (text/line/columns/
// feed/cut) — `size:'double'` (not numeric), plain `{type:'line'}`, and columns
// with explicit widths.
function buildReceiptDocument(invoice, { docName, clinic, spec }) {
  const T = (content, style) => ({ type: 'text', content: String(content), style });
  const center = (content, style) => T(content, { align: 'center', ...style });
  const line = () => ({ type: 'line' });
  const cols = (left, right, style) => ({
    type: 'columns',
    columns: [
      { content: String(left), width: 60, align: 'left' },
      { content: String(right), width: 40, align: 'right' },
    ],
    ...(style ? { style } : {}),
  });

  const doc = [
    center(String(clinic || 'Clinic').toUpperCase(), { bold: true, size: 'double' }),
    docName ? center(docName) : null,
    spec ? center(spec) : null,
    line(),
    cols('Invoice:', invoice.invoiceNumber || ''),
    cols('Date:', invoice.date || ''),
    invoice.time ? cols('Time:', invoice.time) : null,
    cols('Patient:', invoice.patientName || ''),
    invoice.patientPhone && invoice.patientPhone !== 'Provided' ? cols('Phone:', invoice.patientPhone) : null,
    line(),
    T('Treatments', { bold: true }),
  ];

  (invoice.treatments || []).forEach((it, i) => {
    doc.push(cols(`${i + 1}. ${it.name}`, it.price ? rs(it.price) : ''));
  });

  doc.push(
    line(),
    cols('Total:', rs(invoice.total)),
    (invoice.discount ? cols('Discount:', `- ${rs(invoice.discount)}`) : null),
    cols('Paid:', rs(invoice.paid), { bold: true }),
    cols('Outstanding:', rs(invoice.outstanding)),
    cols('Status:', String(invoice.status || '').toUpperCase()),
    line(),
    center('Thank you for visiting!'),
    center('Powered by My Dentist'),
    { type: 'feed', lines: 3 },
    { type: 'cut', partial: false },
  );

  return doc.filter(Boolean);
}

// Print one receipt to the chosen Bluetooth printer. `device` may be a device
// object (from scanPrinters) or a raw/typed address string.
export async function printReceiptBT(device, invoice, meta) {
  const L = lib();
  if (!L) throw new Error('Bluetooth printing needs the installed app.');
  const ok = await ensureBtPermissions();
  if (!ok) throw new Error('Bluetooth permission denied.');

  const address = normalizeAddress(device);
  const document = buildReceiptDocument(invoice, meta);
  const result = await L.printReceipt({
    printers: [{ address, options: { paperWidthMm: PAPER_WIDTH_MM, encoding: 'UTF8' } }],
    documents: [document],
    options: { continueOnError: false },
  });
  // printReceipt resolves even when a printer fails — surface that as an error
  // so the picker shows "Print failed" instead of a false success.
  const r = Array.isArray(result?.results) ? result.results[0] : result;
  if (r && (r.success === false || r.error)) {
    throw new Error(r.error || r.message || 'Printer connection failed.');
  }
  return result;
}
