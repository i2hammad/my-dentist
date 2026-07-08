import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator, Linking, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import { webContent } from '../config/webLayout';
import imgUrl from '../config/imgUrl';
import PromoCard from '../components/PromoCard';

const isWeb = Platform.OS === 'web';

const STATUS_CONFIG = {
  pending:     { bg: '#FEF3C7', text: '#D97706', icon: 'time',             label: 'Pending'     },
  confirmed:   { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-circle', label: 'Confirmed'   },
  coming:      { bg: '#DBEAFE', text: '#1D4ED8', icon: 'alarm-outline',    label: 'Coming Soon' },
  rescheduled: { bg: '#EDE9FE', text: '#7C3AED', icon: 'calendar-outline', label: 'Rescheduled' },
  cancelled:   { bg: '#FEE2E2', text: '#DC2626', icon: 'close-circle',     label: 'Cancelled'   },
  completed:   { bg: '#F0FDF4', text: '#16A34A', icon: 'ribbon',           label: 'Completed'   },
};

function resolveStatus(appt) {
  if (appt?.status === 'confirmed') {
    try {
      const d = new Date(appt.date);
      const [hh, mm] = (appt.time || '00:00').split(':');
      d.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
      const diff = d - Date.now();
      if (diff >= 0 && diff <= 2 * 60 * 60 * 1000) return 'coming';
    } catch {}
  }
  return appt?.status || 'pending';
}

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

  const cfg = STATUS_CONFIG[resolveStatus(appt)] || STATUS_CONFIG.pending;
  const canModify = appt.status === 'pending' || appt.status === 'confirmed';
  const treatments = (appt.treatmentType || 'Consultation').split(',').map((t) => t.trim());
  const isApproved = ['confirmed', 'rescheduled', 'completed', 'coming'].includes(appt.status);
  const doctorPhone = isApproved ? (appt.doctorId?.phone || appt.doctorId?.clinicContact || '') : '';
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
      {/* Header — clean white bar */}
      <View style={[styles.header, !isWeb && { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#0052FF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Appointment Details</Text>
          <Text style={styles.headerSub}>{fmtDate(appt.date)}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, webContent]} showsVerticalScrollIndicator={false}>
        {/* Marketing banner */}
        <PromoCard style={{ marginTop: 0, marginHorizontal: -16, marginBottom: 16 }} />

        {/* Hero — doctor + status + date/time strip */}
        <View style={styles.hero}>
          <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={14} color={cfg.text} />
            <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>

          <View style={styles.docRow}>
            <View style={styles.avatarRing}>
              {(appt.doctorId?.photo || appt.doctorId?.avatar) ? (
                <Image source={{ uri: imgUrl(appt.doctorId.photo || appt.doctorId.avatar) }} style={styles.docAvatar} />
              ) : (
                <View style={styles.docAvatar}><Ionicons name="person" size={26} color="#0052FF" /></View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docName} numberOfLines={1}>{appt.doctorId?.fullName || 'Doctor'}</Text>
              <Text style={styles.docSpec} numberOfLines={1}>{appt.doctorId?.specialization || 'Specialist'}</Text>
            </View>
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => navigation.navigate('DoctorProfile', { doctorId: appt.doctorId?._id || appt.doctorId, doctor: appt.doctorId })}
            >
              <Text style={styles.viewBtnText}>View</Text>
              <Ionicons name="chevron-forward" size={14} color="#0052FF" />
            </TouchableOpacity>
          </View>

          {/* Date / time highlight — the two facts that matter most */}
          <View style={styles.whenStrip}>
            <View style={styles.whenBox}>
              <Ionicons name="calendar" size={16} color="#0052FF" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.whenLabel}>Date</Text>
                <Text style={styles.whenValue}>{new Date(appt.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
              </View>
            </View>
            <View style={styles.whenDivider} />
            <View style={styles.whenBox}>
              <Ionicons name="time" size={16} color="#0052FF" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.whenLabel}>Time</Text>
                <Text style={styles.whenValue}>{fmtTime(appt.time)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Appointment</Text>
          <DetailRow
            icon={appt.consultationType === 'online' ? 'videocam-outline' : 'business-outline'}
            tint="#6366F1"
            label="Type"
            chip={appt.consultationType === 'online' ? 'Video Call' : 'In-Clinic'}
          />
          <DetailRow icon="medkit-outline" tint="#0EA5E9" label="Treatments" value={treatments.join(', ')} last />
        </View>

        {/* Clinic & contact */}
        {(appt.doctorId?.clinicName || clinicAddress || doctorPhone || !isApproved) && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Clinic & Contact</Text>
            {!!appt.doctorId?.clinicName && (
              <DetailRow icon="business-outline" tint="#0052FF" label="Clinic" value={appt.doctorId.clinicName} />
            )}
            {!!clinicAddress && (
              <DetailRow icon="location-outline" tint="#EF4444" label="Address" value={clinicAddress} />
            )}
            {!isApproved ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginTop: 8, gap: 8 }}>
                <Ionicons name="lock-closed-outline" size={16} color="#D97706" />
                <Text style={{ fontSize: 13, color: '#92400E', flex: 1 }}>Contact details will be visible once the doctor approves your appointment.</Text>
              </View>
            ) : (
              <>
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
              </>
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

function DetailRow({ icon, label, value, chip, tint = '#0052FF', last }) {
  return (
    <View style={[styles.detailRow, last && { borderBottomWidth: 0, paddingBottom: 0 }]}>
      <View style={[styles.detailIcon, { backgroundColor: tint + '18' }]}>
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      {chip ? (
        <View style={[styles.valueChip, { backgroundColor: tint + '18' }]}>
          <Text style={[styles.valueChipText, { color: tint }]}>{chip}</Text>
        </View>
      ) : (
        <Text style={styles.detailValue}>{value}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingBottom: 14, paddingTop: 14,
    borderBottomWidth: 1, borderBottomColor: '#E8EFFF',
  },
  headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF4FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0A1551' },
  headerSub: { fontSize: 12.5, color: '#64748B', marginTop: 2, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 40, backgroundColor: '#F1F5F9', flexGrow: 1 },

  // Hero card
  hero: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#EEF2F7',
    shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2,
  },
  statusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, marginBottom: 14 },
  statusText: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.2 },
  docRow: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: '#E0EAFF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  docAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  docName: { fontSize: 16.5, fontWeight: '800', color: '#0F172A' },
  docSpec: { fontSize: 13, color: '#64748B', marginTop: 2 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#EFF4FF', borderRadius: 10, paddingLeft: 12, paddingRight: 8, paddingVertical: 7 },
  viewBtnText: { color: '#0052FF', fontWeight: '800', fontSize: 13 },

  // Date / time strip
  whenStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F8FF', borderRadius: 14, borderWidth: 1, borderColor: '#E8EFFF', padding: 12, marginTop: 14 },
  whenBox: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  whenDivider: { width: 1, height: 30, backgroundColor: '#DDE6FA', marginHorizontal: 12 },
  whenLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  whenValue: { fontSize: 14, color: '#0A1551', fontWeight: '800', marginTop: 1 },

  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#EEF2F7' },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  detailLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '700', color: '#0F172A', marginLeft: 8 },
  valueChip: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  valueChipText: { fontSize: 12.5, fontWeight: '800' },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
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
