import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import storage from '../../config/storage';
import API_BASE_URL from '../../config/api';

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

export default function DoctorAppointmentDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const [appt, setAppt] = useState(route?.params?.appointment || null);
  const [busy, setBusy] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [newDate, setNewDate] = useState(appt?.date ? new Date(appt.date) : new Date());

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
  const headers = async () => ({ Authorization: `Bearer ${await storage.getItem('userToken')}` });

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

  const submitReschedule = (dateObj, timeStr) => act('rescheduled', async (h) => {
    const dateStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
    return axios.put(`${API_BASE_URL}/api/appointments/${appt._id}/reschedule`, { date: dateStr, time: timeStr }, { headers: h });
  }, { date: dateObj.toISOString(), time: timeStr });

  const onPickDate = (e, d) => { setShowDate(false); if (e?.type === 'dismissed' || !d) return; setNewDate(d); setShowTime(true); };
  const onPickTime = (e, t) => { setShowTime(false); if (e?.type === 'dismissed' || !t) return; submitReschedule(newDate, `${pad(t.getHours())}:${pad(t.getMinutes())}`); };

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
            <View style={styles.docAvatar}><Text style={styles.avatarText}>{(appt.patientId?.fullName || '?').charAt(0)}</Text></View>
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
            <TouchableOpacity style={styles.rescheduleBtn} disabled={busy} onPress={() => setShowDate(true)}>
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

      {showDate && <DateTimePicker value={newDate} mode="date" minimumDate={new Date()} onChange={onPickDate} />}
      {showTime && <DateTimePicker value={new Date()} mode="time" onChange={onPickTime} />}
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
  docAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
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
  empty: { textAlign: 'center', marginTop: 60, color: '#64748B' },
});
