import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator, Modal, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../../config/storage';
import API_BASE_URL from '../../config/api';
import imgUrl from '../../config/imgUrl';

const isWeb = Platform.OS === 'web';

const STATUS = {
  pending:     { bg: '#FEF3C7', text: '#D97706', icon: 'time',             label: 'Pending'     },
  confirmed:   { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-circle', label: 'Confirmed'   },
  rescheduled: { bg: '#EDE9FE', text: '#7C3AED', icon: 'calendar-outline', label: 'Rescheduled' },
  cancelled:   { bg: '#FEE2E2', text: '#DC2626', icon: 'close-circle',     label: 'Cancelled'   },
  completed:   { bg: '#F0FDF4', text: '#16A34A', icon: 'ribbon',           label: 'Completed'   },
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const fmtTime = (t) => {
  if (!t) return '—';
  const [hh, mm] = String(t).split(':');
  const h = parseInt(hh, 10);
  return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
};
const pad = (n) => String(n).padStart(2, '0');
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dateToIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const isoToDate = (iso) => {
  const [year, month, day] = String(iso || '').split('-').map(Number);
  return new Date(year, month - 1, day);
};
const parseTime = (input) => {
  const raw = String(input || '').trim();
  const twentyFour = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFour) return Number(twentyFour[1]) * 60 + Number(twentyFour[2]);
  const twelveHour = raw.match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*([AaPp][Mm])$/);
  if (!twelveHour) return NaN;
  let h = Number(twelveHour[1]);
  const m = Number(twelveHour[2]);
  const meridiem = twelveHour[3].toUpperCase();
  if (meridiem === 'PM' && h !== 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};
const minutesToTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

// Preset slots are 1 hour apart; any chosen time must be >= 30 min from a booked one.
const SLOT_STEP_MINUTES = 60;
const MIN_GAP_MINUTES = 30;
const isTooCloseToBooked = (time, booked) => {
  const m = parseTime(time);
  if (!Number.isFinite(m)) return false;
  return (booked || []).some((b) => {
    const bm = parseTime(b);
    return Number.isFinite(bm) && Math.abs(bm - m) < MIN_GAP_MINUTES;
  });
};
const validDays = (days, fallback) => {
  const out = Array.isArray(days) ? days.filter((d) => DAY_SHORT.includes(d)) : [];
  return out.length ? out : fallback;
};
const isDateAllowed = (iso, timing = {}) => {
  const d = isoToDate(iso);
  const day = DAY_SHORT[d.getDay()];
  const available = validDays(timing.availableDays, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const off = validDays(timing.offDays, []);
  return available.includes(day) && !off.includes(day);
};
const timingRanges = (timing = {}) => {
  const ranges = [[timing.morningStart, timing.morningEnd], [timing.eveningStart, timing.eveningEnd]]
    .map(([start, end]) => {
      const startMin = parseTime(start);
      const endMin = parseTime(end);
      return Number.isFinite(startMin) && Number.isFinite(endMin) && startMin < endMin ? { startMin, endMin } : null;
    })
    .filter(Boolean);
  if (!ranges.length) {
    const startMin = parseTime(timing.startTime || '10:00');
    const endMin = parseTime(timing.endTime || '20:00');
    if (Number.isFinite(startMin) && Number.isFinite(endMin) && startMin < endMin) ranges.push({ startMin, endMin });
  }
  return ranges;
};
const generateDateOptions = (count, timing) => {
  const dates = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const iso = dateToIso(d);
    dates.push({
      iso,
      dayName: DAY_SHORT[d.getDay()],
      dateNum: d.getDate(),
      month: MONTH_SHORT[d.getMonth()],
      isAvailable: isDateAllowed(iso, timing),
    });
  }
  return dates;
};
const generateTimeOptions = (timing, step = SLOT_STEP_MINUTES) => {
  const slots = [];
  timingRanges(timing).forEach((range) => {
    for (let minutes = range.startMin; minutes < range.endMin; minutes += step) {
      const value = minutesToTime(minutes);
      slots.push({ value, label: fmtTime(value) });
    }
  });
  return slots;
};

export default function DoctorAppointmentDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const [appt, setAppt] = useState(route?.params?.appointment || null);
  const [busy, setBusy] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [bookedSlots, setBookedSlots] = useState([]);
  const clinicTiming = appt?.doctorId?.clinicTiming || {};
  const doctorId = appt?.doctorId?._id || appt?.doctorId || null;
  const timingKey = JSON.stringify(clinicTiming);
  const dateOptions = useMemo(() => generateDateOptions(30, clinicTiming), [timingKey]);
  const timeOptions = useMemo(() => generateTimeOptions(clinicTiming), [timingKey]);
  const headers = async () => ({ Authorization: `Bearer ${await storage.getItem('userToken')}` });

  useEffect(() => {
    if (!showReschedule || !newDate || !doctorId) {
      setBookedSlots([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/appointments/doctor/${doctorId}/booked-slots`, {
          params: { date: newDate, excludeId: appt?._id },
          headers: await headers(),
        });
        const slots = res.data?.success ? (res.data.data || []) : [];
        if (alive) {
          setBookedSlots(slots);
          if (newTime && isTooCloseToBooked(newTime, slots)) setNewTime('');
        }
      } catch {
        if (alive) setBookedSlots([]);
      }
    })();
    return () => { alive = false; };
  }, [showReschedule, newDate, doctorId, appt?._id, newTime]);

  if (!appt) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Text style={styles.empty}>Appointment not found.</Text>
      </SafeAreaView>
    );
  }

  const cfg = STATUS[appt.status] || STATUS.pending;
  const canModify = ['pending', 'confirmed', 'rescheduled'].includes(appt.status);
  const canComplete = appt.status === 'confirmed' || appt.status === 'rescheduled';
  const treatments = (appt.treatmentType || 'Consultation').split(',').map((t) => t.trim());

  const act = async (verb, fn, optimistic) => {
    setBusy(true);
    try {
      const res = await fn(await headers());
      if (res.data?.success) {
        setAppt((a) => ({ ...a, ...optimistic }));
        Alert.alert('Done', `Appointment ${verb}.`);
      } else {
        Alert.alert('Error', res.data?.message || `Could not ${verb} the appointment.`);
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || `Could not ${verb} the appointment.`);
    } finally { setBusy(false); }
  };

  const confirm = () => {
    const rr = appt.rescheduleRequest;
    const optimistic = rr?.requested
      ? { status: 'confirmed', date: rr.date, time: rr.time, rescheduleRequest: { requested: false } }
      : { status: 'confirmed' };
    act(rr?.requested ? 'updated' : 'confirmed', (h) => axios.put(`${API_BASE_URL}/api/appointments/${appt._id}/confirm`, {}, { headers: h }), optimistic);
  };

  // Mark completed, then jump straight to the Bills tab with a draft bill prefilled
  // from this appointment (patient + treatments) so the doctor can price and save it.
  const completeAndBill = async () => {
    setBusy(true);
    try {
      const res = await axios.put(`${API_BASE_URL}/api/appointments/${appt._id}/complete`, {}, { headers: await headers() });
      if (res.data?.success) {
        setAppt((a) => ({ ...a, status: 'completed' }));
        const pat = appt.patientId || {};
        navigation.navigate('DoctorTabs', {
          screen: 'DoctorBills',
          params: {
            billPrefill: {
              appointmentId: appt._id,
              patientId: pat._id || pat,
              patientName: pat.fullName || 'Patient',
              patientPhone: pat.mobileNumber || '',
              treatmentType: appt.treatmentType || '',
            },
          },
        });
      } else {
        Alert.alert('Error', res.data?.message || 'Could not complete the appointment.');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Could not complete the appointment.');
    } finally { setBusy(false); }
  };

  const complete = () => Alert.alert('Mark as Completed', 'Mark this visit as completed? A draft bill will open with this appointment’s treatments.', [
    { text: 'No', style: 'cancel' },
    { text: 'Yes, Complete', onPress: completeAndBill },
  ]);

  const cancel = () => Alert.alert('Cancel Appointment', 'Cancel this appointment?', [
    { text: 'Keep', style: 'cancel' },
    { text: 'Yes, Cancel', style: 'destructive', onPress: () => act('cancelled', (h) => axios.put(`${API_BASE_URL}/api/appointments/${appt._id}/cancel`, {}, { headers: h }), { status: 'cancelled' }) },
  ]);

  const openReschedule = () => {
    const firstDate = dateOptions.find((d) => d.isAvailable)?.iso || '';
    setNewDate(firstDate);
    setNewTime('');
    setShowReschedule(true);
  };

  const submitReschedule = () => {
    if (!newDate || !newTime) return Alert.alert('Missing Info', 'Please select an available date and time.');
    if (isTooCloseToBooked(newTime, bookedSlots)) return Alert.alert('Slot Unavailable', 'This time is within 30 minutes of another booking. Please pick a time at least 30 minutes apart.');
    setShowReschedule(false);
    act('rescheduled', async (h) => (
      axios.put(`${API_BASE_URL}/api/appointments/${appt._id}/reschedule`, { date: newDate, time: newTime }, { headers: h })
    ), { date: `${newDate}T00:00:00.000Z`, time: newTime });
  };

  return (
    <SafeAreaView edges={isWeb ? ['top'] : []} style={styles.safe}>
      <View style={[styles.header, !isWeb && { paddingTop: insets.top + 8 }, isWeb && styles.webBlock]}>
        {isWeb ? <View style={{ width: 40 }} /> : (
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Appointment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, isWeb && styles.webBlock]} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusPill, { backgroundColor: cfg.bg, alignSelf: 'flex-start' }]}>
          <Ionicons name={cfg.icon} size={15} color={cfg.text} />
          <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>

        {/* Patient */}
        <View style={styles.card}>
          <View style={styles.docRow}>
            <View style={styles.docAvatar}>
              {appt.patientId?.profileImage ? (
                <Image source={{ uri: imgUrl(appt.patientId.profileImage) }} style={styles.docAvatarImg} />
              ) : (
                <Text style={styles.avatarText}>{(appt.patientId?.fullName || '?').charAt(0)}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docName}>{appt.patientId?.fullName || 'Patient'}</Text>
              {!!appt.patientId?.mobileNumber && <Text style={styles.docSpec}>{appt.patientId.mobileNumber}</Text>}
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Row icon="calendar-outline" label="Date" value={fmtDate(appt.date)} />
          <Row icon="time-outline" label="Time" value={fmtTime(appt.time)} />
          <Row icon={appt.consultationType === 'online' ? 'videocam-outline' : 'business-outline'} label="Type" value={appt.consultationType === 'online' ? 'Video Call' : 'In-Clinic'} />
          <Row icon="medkit-outline" label="Treatments" value={treatments.join(', ')} last />
        </View>

        {appt.description ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Patient Notes</Text>
            <Text style={styles.notes}>{appt.description}</Text>
          </View>
        ) : null}

        {/* Patient reschedule request */}
        {appt.rescheduleRequest?.requested && (
          <View style={styles.reqBanner}>
            <Ionicons name="swap-horizontal-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
            <Text style={styles.reqBannerText}>
              Patient requested a new time: {fmtDate(appt.rescheduleRequest.date)} · {fmtTime(appt.rescheduleRequest.time)}. Confirm to apply it.
            </Text>
          </View>
        )}

        {/* Actions */}
        {canModify ? (
          <View style={{ marginTop: 4 }}>
            {(appt.status === 'pending' || appt.rescheduleRequest?.requested) && (
              <TouchableOpacity style={styles.confirmBtn} disabled={busy} onPress={confirm}>
                {busy ? <ActivityIndicator size="small" color="#FFF" /> : (
                  <><Ionicons name="checkmark-circle-outline" size={18} color="#FFF" style={{ marginRight: 8 }} /><Text style={styles.confirmText}>{appt.rescheduleRequest?.requested ? 'Approve New Time' : 'Confirm Appointment'}</Text></>
                )}
              </TouchableOpacity>
            )}
            {canComplete && (
              <TouchableOpacity style={styles.completeBtn} disabled={busy} onPress={complete}>
                <Ionicons name="checkmark-done-circle-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.completeBtnText}>Mark Visit as Completed</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.rescheduleBtn} disabled={busy} onPress={openReschedule}>
              <Ionicons name="calendar" size={18} color="#0052FF" style={{ marginRight: 8 }} />
              <Text style={styles.rescheduleText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} disabled={busy} onPress={cancel}>
              <Ionicons name="close-circle-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={styles.cancelText}>{appt.status === 'pending' ? 'Decline' : 'Cancel'} Appointment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.closedNote}>This appointment is {cfg.label.toLowerCase()} and can no longer be modified.</Text>
        )}
      </ScrollView>

      <Modal visible={showReschedule} transparent animationType="slide" onRequestClose={() => setShowReschedule(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.rescheduleSheet, isWeb && styles.webBlock]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Reschedule Appointment</Text>
              <TouchableOpacity onPress={() => setShowReschedule(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.pickerLabel}>Available Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datePickerRow}>
              {dateOptions.map((d) => {
                const selected = newDate === d.iso;
                const disabled = !d.isAvailable;
                return (
                  <TouchableOpacity
                    key={d.iso}
                    disabled={disabled}
                    activeOpacity={0.85}
                    onPress={() => { setNewDate(d.iso); setNewTime(''); }}
                    style={[styles.dateChip, selected && styles.dateChipSelected, disabled && styles.dateChipDisabled]}
                  >
                    <Text style={[styles.dateChipDay, selected && styles.selectedText, disabled && styles.disabledText]}>{d.dayName}</Text>
                    <Text style={[styles.dateChipNum, selected && styles.selectedText, disabled && styles.disabledText]}>{d.dateNum}</Text>
                    <Text style={[styles.dateChipMonth, selected && styles.selectedSubText, disabled && styles.disabledText]}>{d.month}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.pickerLabel}>Available Time</Text>
            <View style={styles.timePickerGrid}>
              {timeOptions.length ? timeOptions.map((slot) => {
                const selected = newTime === slot.value;
                const disabled = !newDate || !isDateAllowed(newDate, clinicTiming) || isTooCloseToBooked(slot.value, bookedSlots);
                return (
                  <TouchableOpacity
                    key={slot.value}
                    disabled={disabled}
                    activeOpacity={0.85}
                    onPress={() => setNewTime(slot.value)}
                    style={[styles.timeChip, selected && styles.timeChipSelected, disabled && styles.timeChipDisabled]}
                  >
                    <Text style={[styles.timeChipText, selected && styles.selectedText, disabled && styles.disabledText]}>{slot.label}</Text>
                  </TouchableOpacity>
                );
              }) : (
                <View style={styles.noSlotsBox}>
                  <Ionicons name="alert-circle-outline" size={18} color="#D97706" />
                  <Text style={styles.noSlotsText}>No clinic time slots are configured.</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={[styles.submitSheetBtn, (!newDate || !newTime) && styles.submitSheetBtnDisabled]} disabled={!newDate || !newTime || busy} onPress={submitReschedule}>
              <Text style={styles.submitSheetText}>Save New Time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ icon, label, value, last }) {
  return (
    <View style={[styles.detailRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.detailIcon}><Ionicons name={icon} size={18} color="#0052FF" /></View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: isWeb ? '#F1F5F9' : '#0052FF' },
  // Web: center + cap content width so the header/cards aren't stretched edge-to-edge.
  webBlock: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0052FF', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  content: { padding: 16, paddingBottom: 40, backgroundColor: '#F1F5F9', flexGrow: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 14 },
  statusText: { fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#EEF2F7' },
  docRow: { flexDirection: 'row', alignItems: 'center' },
  docAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  docAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#0052FF' },
  docName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  docSpec: { fontSize: 13, color: '#64748B', marginTop: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  detailLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '700', color: '#0F172A' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 6 },
  notes: { fontSize: 14, color: '#334155', lineHeight: 21 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF', borderRadius: 14, paddingVertical: 15, marginBottom: 12 },
  confirmText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 15, marginBottom: 12 },
  completeBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  rescheduleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF4FF', borderRadius: 14, paddingVertical: 15, marginBottom: 12, borderWidth: 1, borderColor: '#DBEAFE' },
  rescheduleText: { color: '#0052FF', fontSize: 15, fontWeight: '700' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 15, borderWidth: 1, borderColor: '#FEE2E2' },
  cancelText: { color: '#DC2626', fontSize: 15, fontWeight: '700' },
  closedNote: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 12, lineHeight: 19 },
  reqBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#FDE68A' },
  reqBannerText: { flex: 1, color: '#92400E', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  rescheduleSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, maxHeight: '86%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#0A1551' },
  pickerLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.1, marginBottom: 10, marginTop: 4 },
  datePickerRow: { gap: 8, paddingBottom: 14 },
  dateChip: { width: 68, minHeight: 78, borderRadius: 16, borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', paddingVertical: 9 },
  dateChipSelected: { backgroundColor: '#0052FF', borderColor: '#0052FF' },
  dateChipDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', opacity: 0.48 },
  dateChipDay: { fontSize: 10.5, fontWeight: '800', color: '#64748B', marginBottom: 4 },
  dateChipNum: { fontSize: 22, fontWeight: '900', color: '#0A1551' },
  dateChipMonth: { fontSize: 10.5, fontWeight: '700', color: '#94A3B8', marginTop: 4 },
  selectedText: { color: '#FFFFFF' },
  selectedSubText: { color: 'rgba(255,255,255,0.78)' },
  disabledText: { color: '#94A3B8' },
  timePickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  timeChip: { minWidth: '30%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: '#EDE9FE', backgroundColor: '#F5F3FF', paddingHorizontal: 12, paddingVertical: 11 },
  timeChipSelected: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  timeChipDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', opacity: 0.48 },
  timeChipText: { fontSize: 12.5, fontWeight: '800', color: '#7C3AED' },
  noSlotsBox: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  noSlotsText: { flex: 1, color: '#9A3412', fontSize: 12.5, fontWeight: '700' },
  submitSheetBtn: { backgroundColor: '#0052FF', borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  submitSheetBtnDisabled: { backgroundColor: '#CBD5E1' },
  submitSheetText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  empty: { textAlign: 'center', marginTop: 60, color: '#64748B' },
});
