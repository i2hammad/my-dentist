// Bluetooth thermal-printer helper (58mm ESC/POS) using
// @finan-me/react-native-thermal-printer. Native module — only works in a
// custom dev/release build, NOT in Expo Go or on web. All entry points guard
// for that so the rest of the app never crashes.
import { Platform, PermissionsAndroid } from 'react-native';

const isWeb = Platform.OS === 'web';
const PAPER_WIDTH_MM = 58;
const COLS = 32; // ~chars per line on a 58mm roll (font A)

// Lazily require the native lib so web / Expo Go never try to load it.
function lib() {
  if (isWeb) return null;
  try { return require('@finan-me/react-native-thermal-printer'); }
  catch { return null; }
}

export function isThermalSupported() {
  return !isWeb && !!lib();
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

// Returns { paired: [{name,address}], found: [...] }. Caller shows a picker.
export async function scanPrinters() {
  const L = lib();
  if (!L) throw new Error('Bluetooth printing needs the installed app (not Expo Go / web).');
  const ok = await ensureBtPermissions();
  if (!ok) throw new Error('Bluetooth permission denied. Enable it in Settings.');
  try { await L.init?.(); } catch {}
  const res = await L.scanDevices();
  return {
    paired: res?.paired || [],
    found: res?.found || [],
  };
}

const rs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

// Build the ESC/POS document (Node[]) for one receipt, mirroring the HTML one.
function buildReceiptDocument(invoice, { docName, clinic, spec }) {
  const T = (content, style) => ({ type: 'text', content, style });
  const center = (content, style) => T(content, { align: 'center', ...style });
  const line = () => ({ type: 'line', style: 'dashed', widthChars: COLS });
  const cols = (left, right) => ({
    type: 'columns',
    columns: [
      { content: String(left), align: 'left' },
      { content: String(right), align: 'right' },
    ],
  });

  const doc = [
    center(String(clinic || 'Clinic').toUpperCase(), { bold: true, size: 2 }),
    docName ? center(docName) : null,
    spec ? center(spec) : null,
    line(),
    cols('Invoice:', invoice.invoiceNumber || ''),
    cols('Date:', invoice.date || ''),
    invoice.time ? cols('Time:', invoice.time) : null,
    cols('Patient:', invoice.patientName || ''),
    invoice.patientPhone ? cols('Phone:', invoice.patientPhone) : null,
    line(),
    T('Treatments', { bold: true }),
  ];

  (invoice.treatments || []).forEach((it, i) => {
    doc.push(cols(`${i + 1}. ${it.name}`, it.price ? rs(it.price) : ''));
  });

  doc.push(
    line(),
    cols('Total:', rs(invoice.total)),
    cols('Discount:', `- ${rs(invoice.discount)}`),
    { type: 'columns', columns: [{ content: 'Paid:', align: 'left' }, { content: rs(invoice.paid), align: 'right' }], style: { bold: true } },
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

// Print one receipt to the chosen Bluetooth printer (by MAC address).
export async function printReceiptBT(address, invoice, meta) {
  const L = lib();
  if (!L) throw new Error('Bluetooth printing needs the installed app.');
  const ok = await ensureBtPermissions();
  if (!ok) throw new Error('Bluetooth permission denied.');

  const document = buildReceiptDocument(invoice, meta);
  const result = await L.printReceipt({
    printers: [{ address, options: { paperWidthMm: PAPER_WIDTH_MM } }],
    documents: [document],
    options: { continueOnError: false },
  });
  return result;
}
