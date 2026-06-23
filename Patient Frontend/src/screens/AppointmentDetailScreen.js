import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import { webContent } from '../config/webLayout';

const isWeb = Platform.OS === 'web';

const STATUS_CONFIG = {
  confirmed: { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-circle', label: 'Confirmed' },
  pending:   { bg: '#FEF3C7', text: '#D97706', icon: 'time',             label: 'Pending'   },
  cancelled: { bg: '#FEE2E2', text: '#DC2626', icon: 'close-circle',     label: 'Cancelled' },
  completed: { bg: '#EDE9FE', text: '#7C3AED', icon: 'ribbon',           label: 'Completed' },
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const fmtTime = (t) => {
  if (!t) return '—';
  const [hh, mm] = t.split(':');
  const h = parseInt(hh, 10);
  return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
};
const pad = (n) => String(n).padStart(2, '0');

export default function AppointmentDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const [appt, setAppt] = useState(route?.params?.appointment || null);
  const [busy, setBusy] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [newDate, setNewDate] = useState(appt?.date ? new Date(appt.date) : new Date());
  const [newTime, setNewTime] = useState(null);

  if (!appt) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Text style={styles.empty}>Appointment not found.</Text>
      </SafeAreaView>
    );
  }

  const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
  const canModify = appt.status === 'pending' || appt.status === 'confirmed';
  const treatments = (appt.treatmentType || 'Consultation').split(',').map((t) => t.trim());
  const doctorPhone = appt.doctorId?.phone || appt.doctorId?.clinicContact || '';
  const clinicAddress = [appt.doctorId?.address, appt.doctorId?.city].filter(Boolean).join(', ');

  const authHeaders = async () => ({ Authorization: `Bearer ${await storage.getItem('userToken')}` });

  const doCancel = async () => {
    setBusy(true);
    try {
      const res = await axios.put(`${API_BASE_URL}/api/appointments/${appt._id}/cancel`, {}, { headers: await authHeaders() });
      if (res.data?.success) {
        setAppt((a) => ({ ...a, status: 'cancelled' }));
        Alert.alert('Cancelled', 'Your appointment has been cancelled.');
      } else {
        Alert.alert('Error', res.data?.message || 'Could not cancel.');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Could not cancel the appointment.');
    } finally { setBusy(false); }
  };

  const confirmCancel = () => {
    Alert.alert('Cancel Appointment', 'Are you sure you want to cancel this appointment?', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: doCancel },
    ]);
  };

  const submitReschedule = async (dateObj, timeStr) => {
    setBusy(true);
    try {
      const dateStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
      const res = await axios.put(
        `${API_BASE_URL}/api/appointments/${appt._id}/reschedule`,
        { date: dateStr, time: timeStr },
        { headers: await authHeaders() }
      );
      if (res.data?.success) {
        // Patient reschedule is a REQUEST — the doctor must approve it.
        setAppt((a) => ({ ...a, rescheduleRequest: { requested: true, date: dateObj.toISOString(), time: timeStr } }));
        Alert.alert('Request Sent', 'Your reschedule request was sent. The clinic will confirm the new time.');
      } else {
        Alert.alert('Error', res.data?.message || 'Could not reschedule.');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Could not reschedule the appointment.');
    } finally { setBusy(false); }
  };

  // Flow: pick date -> pick time -> submit.
  const onPickDate = (e, d) => {
    setShowDate(false);
    if (e?.type === 'dismissed' || !d) return;
    setNewDate(d);
    setShowTime(true);
  };
  const onPickTime = (e, t) => {
    setShowTime(false);
    if (e?.type === 'dismissed' || !t) return;
    const timeStr = `${pad(t.getHours())}:${pad(t.getMinutes())}`;
    setNewTime(timeStr);
    submitReschedule(newDate, timeStr);
  };

  return (
    <SafeAreaView edges={isWeb ? ['top'] : []} style={styles.safe}>
      {/* Header */}
      <View style={[styles.header, !isWeb && { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointment Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, webContent]} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <View style={[styles.statusPill, { backgroundColor: cfg.bg, alignSelf: 'flex-start' }]}>
          <Ionicons name={cfg.icon} size={15} color={cfg.text} />
          <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>

        {/* Doctor card */}
        <View style={styles.card}>
          <View style={styles.docRow}>
            <View style={styles.docAvatar}><Ionicons name="person" size={24} color="#0052FF" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docName}>{appt.doctorId?.fullName || 'Doctor'}</Text>
              <Text style={styles.docSpec}>{appt.doctorId?.specialization || 'Specialist'}</Text>
            </View>
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => navigation.navigate('DoctorProfile', { doctorId: appt.doctorId?._id || appt.doctorId, doctor: appt.doctorId })}
            >
              <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <DetailRow icon="calendar-outline" label="Date" value={fmtDate(appt.date)} />
          <DetailRow icon="time-outline" label="Time" value={fmtTime(appt.time)} />
          <DetailRow
            icon={appt.consultationType === 'online' ? 'videocam-outline' : 'business-outline'}
            label="Type"
            value={appt.consultationType === 'online' ? 'Video Call' : 'In-Clinic'}
          />
          {appt.doctorId?.consultationFee ? (
            <DetailRow icon="cash-outline" label="Consultation Fee" value={`Rs. ${Number(appt.doctorId.consultationFee).toLocaleString()}`} />
          ) : null}
          <DetailRow icon="medkit-outline" label="Treatments" value={treatments.join(', ')} last />
        </View>

        {/* Clinic & contact */}
        {(doctorPhone || appt.doctorId?.clinicName || clinicAddress) && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Clinic & Contact</Text>
            {!!appt.doctorId?.clinicName && (
              <DetailRow icon="business-outline" label="Clinic" value={appt.doctorId.clinicName} />
            )}
            {!!clinicAddress && (
              <DetailRow icon="location-outline" label="Address" value={clinicAddress} />
            )}
            {!!doctorPhone && (
              <TouchableOpacity style={styles.detailRow} onPress={() => Linking.openURL(`tel:${doctorPhone}`)}>
                <View style={styles.detailIcon}><Ionicons name="call-outline" size={18} color="#0052FF" /></View>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={[styles.detailValue, { color: '#0052FF' }]}>{doctorPhone}</Text>
              </TouchableOpacity>
            )}
            {!!doctorPhone && (
              <View style={styles.contactBtnRow}>
                <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${doctorPhone}`)}>
                  <Ionicons name="call" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.contactBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.contactBtn, styles.whatsappBtn]} onPress={() => Linking.openURL(`https://wa.me/${doctorPhone.replace(/[^0-9]/g, '')}`)}>
                  <Ionicons name="logo-whatsapp" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.contactBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {appt.description ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.notes}>{appt.description}</Text>
          </View>
        ) : null}

        {/* Pending reschedule request banner */}
        {appt.rescheduleRequest?.requested && (
          <View style={styles.reqBanner}>
            <Ionicons name="hourglass-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
            <Text style={styles.reqBannerText}>
              Reschedule requested to {fmtDate(appt.rescheduleRequest.date)} · {fmtTime(appt.rescheduleRequest.time)}. Awaiting clinic confirmation.
            </Text>
          </View>
        )}

        {/* Actions */}
        {canModify ? (
          <View style={{ marginTop: 8 }}>
            <TouchableOpacity style={styles.rescheduleBtn} disabled={busy} onPress={() => setShowDate(true)}>
              <Ionicons name="calendar" size={18} color="#0052FF" style={{ marginRight: 8 }} />
              <Text style={styles.rescheduleText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} disabled={busy} onPress={confirmCancel}>
              {busy ? <ActivityIndicator size="small" color="#DC2626" /> : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                  <Text style={styles.cancelText}>Cancel Appointment</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.closedNote}>This appointment is {cfg.label.toLowerCase()} and can no longer be modified.</Text>
        )}
      </ScrollView>

      {showDate && (
        <DateTimePicker value={newDate} mode="date" minimumDate={new Date()} onChange={onPickDate} />
      )}
      {showTime && (
        <DateTimePicker value={new Date()} mode="time" onChange={onPickTime} />
      )}
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value, last }) {
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0052FF', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 14,
    borderBottomLeftRadius: 22, borderBottomRightRadius: 22,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  content: { padding: 16, paddingBottom: 40, backgroundColor: '#F1F5F9', flexGrow: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 14 },
  statusText: { fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#EEF2F7' },
  docRow: { flexDirection: 'row', alignItems: 'center' },
  docAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  docName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  docSpec: { fontSize: 13, color: '#64748B', marginTop: 2 },
  viewBtn: { borderWidth: 1, borderColor: '#0052FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  viewBtnText: { color: '#0052FF', fontWeight: '700', fontSize: 13 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  detailLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '700', color: '#0F172A' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 6 },
  contactBtnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 11 },
  whatsappBtn: { backgroundColor: '#25D366' },
  contactBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  notes: { fontSize: 14, color: '#334155', lineHeight: 21 },
  rescheduleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF4FF', borderRadius: 14, paddingVertical: 15, marginBottom: 12, borderWidth: 1, borderColor: '#DBEAFE' },
  rescheduleText: { color: '#0052FF', fontSize: 15, fontWeight: '700' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 15, borderWidth: 1, borderColor: '#FEE2E2' },
  cancelText: { color: '#DC2626', fontSize: 15, fontWeight: '700' },
  closedNote: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 12, lineHeight: 19 },
  reqBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#FDE68A' },
  reqBannerText: { flex: 1, color: '#92400E', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  empty: { textAlign: 'center', marginTop: 60, color: '#64748B' },
});
