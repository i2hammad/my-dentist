const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_ALIASES = {
  sunday: 'Sun',
  sun: 'Sun',
  monday: 'Mon',
  mon: 'Mon',
  tuesday: 'Tue',
  tue: 'Tue',
  tues: 'Tue',
  wednesday: 'Wed',
  wed: 'Wed',
  thursday: 'Thu',
  thu: 'Thu',
  thur: 'Thu',
  thurs: 'Thu',
  friday: 'Fri',
  fri: 'Fri',
  saturday: 'Sat',
  sat: 'Sat',
};

const pad2 = (n) => String(n).padStart(2, '0');

const normalizeDay = (day) => {
  const key = String(day || '').trim().toLowerCase();
  return DAY_ALIASES[key] || null;
};

const uniqueDays = (days = []) => {
  const out = [];
  for (const day of Array.isArray(days) ? days : []) {
    const normalized = normalizeDay(day);
    if (!normalized) throw new Error(`Invalid clinic day "${day}". Use Sun, Mon, Tue, Wed, Thu, Fri, Sat.`);
    if (!out.includes(normalized)) out.push(normalized);
  }
  return out;
};

const parseTimeToMinutes = (input) => {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const twentyFour = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFour) return Number(twentyFour[1]) * 60 + Number(twentyFour[2]);

  const twelveHour = raw.match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*([AaPp][Mm])$/);
  if (twelveHour) {
    let h = Number(twelveHour[1]);
    const m = Number(twelveHour[2]);
    const meridiem = twelveHour[3].toUpperCase();
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }

  return NaN;
};

const formatMinutes = (minutes) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

const normalizeRange = (start, end, label) => {
  const hasStart = String(start || '').trim().length > 0;
  const hasEnd = String(end || '').trim().length > 0;
  if (!hasStart && !hasEnd) return null;
  if (!hasStart || !hasEnd) throw new Error(`${label} session must include both start and end time.`);

  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) {
    throw new Error(`${label} session time must use HH:mm format, for example 09:00 or 17:30.`);
  }
  if (startMin >= endMin) throw new Error(`${label} session start time must be before end time.`);

  return { start: formatMinutes(startMin), end: formatMinutes(endMin), startMin, endMin };
};

const sessionRanges = (timing = {}) => {
  const ranges = [];
  const morning = normalizeRange(timing.morningStart, timing.morningEnd, 'Morning');
  const evening = normalizeRange(timing.eveningStart, timing.eveningEnd, 'Evening');
  if (morning) ranges.push(morning);
  if (evening) ranges.push(evening);

  if (!ranges.length) {
    const legacy = normalizeRange(timing.startTime, timing.endTime, 'Clinic');
    if (legacy) ranges.push(legacy);
  }

  return ranges;
};

const normalizeClinicTiming = (timing = {}) => {
  const availableDays = uniqueDays(timing.availableDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  if (!availableDays.length) throw new Error('Select at least one clinic available day.');

  const offDays = uniqueDays(timing.offDays || DAY_SHORT.filter((day) => !availableDays.includes(day)));
  const ranges = sessionRanges(timing);
  if (!ranges.length) throw new Error('Set at least one complete clinic timing session.');

  const morning = normalizeRange(timing.morningStart, timing.morningEnd, 'Morning');
  const evening = normalizeRange(timing.eveningStart, timing.eveningEnd, 'Evening');
  const first = ranges[0];
  const last = ranges[ranges.length - 1];

  return {
    ...timing,
    days: availableDays.join(', '),
    startTime: first.start,
    endTime: last.end,
    morningStart: morning ? morning.start : '',
    morningEnd: morning ? morning.end : '',
    eveningStart: evening ? evening.start : '',
    eveningEnd: evening ? evening.end : '',
    availableDays,
    offDays: offDays.filter((day) => !availableDays.includes(day)),
  };
};

const isDateTimeInClinicTiming = (timing = {}, date, time) => {
  const rawDate = String(date || '');
  const dateMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const appointmentDate = dateMatch
    ? new Date(Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])))
    : new Date(date);
  if (Number.isNaN(appointmentDate.getTime())) return false;
  const dayName = DAY_SHORT[appointmentDate.getUTCDay()];
  const availableDays = uniqueDays(timing.availableDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const offDays = uniqueDays(timing.offDays || []);
  if (!availableDays.includes(dayName) || offDays.includes(dayName)) return false;

  const minutes = parseTimeToMinutes(time);
  if (!Number.isFinite(minutes)) return false;
  const ranges = sessionRanges(timing);
  return ranges.some((range) => minutes >= range.startMin && minutes < range.endMin);
};

module.exports = {
  DAY_SHORT,
  normalizeClinicTiming,
  isDateTimeInClinicTiming,
  parseTimeToMinutes,
  formatMinutes,
};
