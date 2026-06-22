import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';

const getTreatIcon = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('implant'))   return 'construct-outline';
  if (n.includes('root'))      return 'git-branch-outline';
  if (n.includes('whitening')) return 'sparkles-outline';
  if (n.includes('brace'))     return 'git-network-outline';
  if (n.includes('extract'))   return 'cut-outline';
  if (n.includes('clean'))     return 'water-outline';
  if (n.includes('veneer'))    return 'color-palette-outline';
  if (n.includes('crown'))     return 'shield-outline';
  if (n.includes('consult'))   return 'chatbubble-outline';
  if (n.includes('check'))     return 'search-outline';
  return 'medical-outline';
};

const TIME_SLOTS = [
  { label: '09:00 AM', value: '09:00' },
  { label: '10:00 AM', value: '10:00' },
  { label: '11:00 AM', value: '11:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '02:00 PM', value: '14:00' },
  { label: '03:00 PM', value: '15:00' },
  { label: '04:00 PM', value: '16:00' },
  { label: '05:00 PM', value: '17:00' },
  { label: '06:00 PM', value: '18:00' },
  { label: '07:00 PM', value: '19:00' },
];

const DAY_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function generateDates(count = 60) {
  const dates = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push({
      dayName: DAY_SHORT[d.getDay()],
      dateNum: d.getDate(),
      month:   MONTH_SHORT[d.getMonth()],
      iso:     d.toISOString().split('T')[0],
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    });
  }
  return dates;
}

export default function BookingScreen({ route, navigation }) {
  const doctor = route.params?.doctor || {};

  const [selectedDate, setSelectedDate]             = useState(null);
  const [selectedTime, setSelectedTime]             = useState(null);
  const [selectedTreatments, setSelectedTreatments] = useState([]);
  const [description, setDescription]               = useState('');
  const [loading, setLoading]                       = useState(false);
  const [userRole, setUserRole]                     = useState(null);
  const [doctorTreatments, setDoctorTreatments]     = useState([]);
  const [campaign, setCampaign]                     = useState(null);

  const [showDatePicker, setShowDatePicker]         = useState(false);
  const [showTimePicker, setShowTimePicker]         = useState(false);
  const [customDateLabel, setCustomDateLabel]       = useState('');
  const [customTimeLabel, setCustomTimeLabel]       = useState('');

  const dates = generateDates(60);

  useEffect(() => {
    (async () => {
      const token = await storage.getItem('userToken');
      if (!token) return;
      try {
        const [meRes, treatRes, campRes] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/treatments/doctor/${doctor._id}`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/campaigns/active-patient`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (meRes.status === 'fulfilled' && meRes.value.data?.success) {
          setUserRole(meRes.value.data.data.user?.role || meRes.value.data.data.role);
        }
        if (treatRes.status === 'fulfilled' && treatRes.value.data?.success) {
          setDoctorTreatments(treatRes.value.data.data || []);
        }
        if (campRes.status === 'fulfilled' && campRes.value.data?.success) {
          const d = campRes.value.data.data;
          const c = Array.isArray(d) ? d[0] : d;
          if (c) setCampaign(c);
        }
      } catch {}
    })();
  }, []);

  const onPickDate = (event, picked) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (event?.type === 'dismissed' || !picked) return;
    const iso = picked.toISOString().split('T')[0];
    setSelectedDate(iso);
    setCustomDateLabel(`${picked.getDate()} ${MONTH_SHORT[picked.getMonth()]} ${picked.getFullYear()}`);
  };

  const onPickTime = (event, picked) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (event?.type === 'dismissed' || !picked) return;
    const hh = String(picked.getHours()).padStart(2, '0');
    const mm = String(picked.getMinutes()).padStart(2, '0');
    setSelectedTime(`${hh}:${mm}`);
    const h12 = picked.getHours() % 12 || 12;
    const ampm = picked.getHours() < 12 ? 'AM' : 'PM';
    setCustomTimeLabel(`${h12}:${mm} ${ampm}`);
  };

  const toggleTreatment = (t) => {
    setSelectedTreatments(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const handleBooking = async () => {
    if (!selectedDate || !selectedTime) {
      return Alert.alert('Missing Info', 'Please select a date and time for your appointment.');
    }
    if (selectedTreatments.length === 0) {
      return Alert.alert('Missing Info', 'Please select at least one treatment.');
    }
    try {
      setLoading(true);
      const token = await storage.getItem('userToken');
      if (!token) return Alert.alert('Error', 'Please login first!');

      await axios.post(`${API_BASE_URL}/api/appointments`, {
        doctorId: doctor._id,
        treatmentType: selectedTreatments.join(', '),
        consultationType: 'offline',
        description: description || `Appointment with ${doctor.fullName || 'Doctor'}`,
        date: selectedDate,
        time: selectedTime,
        duration: 30,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Appointment Booked!', 'Your appointment has been booked successfully. The doctor will confirm shortly.', [
        { text: 'View Appointments', onPress: () => navigation.navigate('Campaigns') },
        { text: 'OK' },
      ]);
    } catch (error) {
      const msg = error.response?.data?.message
        || error.response?.data?.errors?.map(e => e.msg).join(', ')
        || 'Failed to book appointment. Please try again.';
      Alert.alert('Booking Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const isReady = selectedDate && selectedTime && selectedTreatments.length > 0;

  // ── Doctor guard ────────────────────────────────────────────────────────────
  if (userRole === 'doctor') {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#F0F4FF' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <Ionicons name="lock-closed-outline" size={36} color="#DC2626" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#0A1551', textAlign: 'center', marginBottom: 10 }}>Doctors Cannot Book</Text>
          <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 }}>
            Campaign booking is for patients only. Please login with a patient account.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginTop: 28, backgroundColor: '#0052FF', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}
          >
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Book Appointment</Text>
            <Text style={styles.headerSub}>Schedule your dental appointment</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Campaign Banner from Admin */}
          {campaign && (
            <View style={{ backgroundColor: '#7C3AED', borderRadius: 16, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="megaphone-outline" size={22} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>{campaign.title || 'Special Offer'}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>{campaign.body || campaign.description || ''}</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 11 }}>PROMO</Text>
              </View>
            </View>
          )}

          {/* Doctor Card */}
          <View style={styles.doctorCard}>
            <View style={styles.doctorAvatarBox}>
              <Ionicons name="person" size={30} color="#0052FF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.doctorName}>{doctor.fullName || 'Doctor'}</Text>
              <Text style={styles.doctorSpec}>{doctor.specialization || 'Specialist'}</Text>
              <Text style={styles.doctorClinic}>{doctor.clinicName || ''}</Text>
            </View>
            {(doctor.avgRating > 0) && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={styles.ratingText}>{Number(doctor.avgRating).toFixed(1)}</Text>
              </View>
            )}
          </View>

          {/* ── TREATMENTS (from doctor's list) ─────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medkit" size={18} color="#7C3AED" />
              <Text style={styles.sectionTitle}>Select Treatments</Text>
              <Text style={styles.sectionHint}>(choose one or more)</Text>
            </View>
            {doctorTreatments.length === 0 ? (
              <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>No treatments listed by this doctor yet.</Text>
            ) : (
              <View style={styles.treatmentGrid}>
                {doctorTreatments.map((t) => {
                  const sel = selectedTreatments.includes(t.name);
                  const icon = getTreatIcon(t.name);
                  return (
                    <TouchableOpacity
                      key={t._id || t.name}
                      style={[styles.treatmentChip, sel && styles.treatmentChipSelected]}
                      onPress={() => toggleTreatment(t.name)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={icon} size={15} color={sel ? '#FFF' : '#7C3AED'} />
                      <Text style={[styles.treatmentChipText, sel && styles.treatmentChipTextSel]}>{t.name}</Text>
                      {sel && <Ionicons name="checkmark-circle" size={14} color="rgba(255,255,255,0.8)" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {selectedTreatments.length > 0 && (
              <View style={styles.selectedSummary}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text style={styles.selectedSummaryText}>
                  {selectedTreatments.length} selected: {selectedTreatments.join(', ')}
                </Text>
              </View>
            )}
          </View>

          {/* ── DATE SELECTION ──────────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar" size={18} color="#0052FF" />
              <Text style={styles.sectionTitle}>Select Date</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {dates.map((date) => {
                  const sel = selectedDate === date.iso;
                  return (
                    <TouchableOpacity
                      key={date.iso}
                      style={[
                        styles.dateCell,
                        sel && styles.dateCellSelected,
                        date.isWeekend && !sel && styles.dateCellWeekend,
                      ]}
                      onPress={() => { setSelectedDate(date.iso); setCustomDateLabel(''); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dateCellDay, sel && { color: '#FFF' }, date.isWeekend && !sel && { color: '#EF4444' }]}>
                        {date.dayName}
                      </Text>
                      <Text style={[styles.dateCellNum, sel && { color: '#FFF' }]}>{date.dateNum}</Text>
                      <Text style={[styles.dateCellMonth, sel && { color: 'rgba(255,255,255,0.75)' }]}>{date.month}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Pick any date button */}
            <TouchableOpacity style={styles.pickAnyBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={18} color="#0052FF" />
              <Text style={styles.pickAnyText}>
                {customDateLabel ? `Custom date: ${customDateLabel}` : 'Pick any future date'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#0052FF" />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate ? new Date(selectedDate) : new Date()}
                mode="date"
                minimumDate={new Date()}
                display="default"
                onChange={onPickDate}
              />
            )}
            {selectedDate && (
              <View style={styles.selectionBadge}>
                <Ionicons name="calendar-outline" size={14} color="#0052FF" />
                <Text style={styles.selectionBadgeText}>
                  {customDateLabel || selectedDate}
                </Text>
              </View>
            )}
          </View>

          {/* ── TIME SELECTION ──────────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time" size={18} color="#7C3AED" />
              <Text style={styles.sectionTitle}>Select Time</Text>
            </View>
            <View style={styles.timeGrid}>
              {TIME_SLOTS.map((slot) => {
                const sel = selectedTime === slot.value;
                return (
                  <TouchableOpacity
                    key={slot.value}
                    style={[styles.timeChip, sel && styles.timeChipSelected]}
                    onPress={() => { setSelectedTime(slot.value); setCustomTimeLabel(''); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="time-outline" size={12} color={sel ? '#FFF' : '#7C3AED'} />
                    <Text style={[styles.timeChipText, sel && styles.timeChipTextSel]}>{slot.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Pick custom time */}
            <TouchableOpacity style={styles.pickAnyBtn} onPress={() => setShowTimePicker(true)}>
              <Ionicons name="time-outline" size={18} color="#7C3AED" />
              <Text style={[styles.pickAnyText, { color: '#7C3AED' }]}>
                {customTimeLabel ? `Custom time: ${customTimeLabel}` : 'Pick a custom time'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#7C3AED" />
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={new Date()}
                mode="time"
                is24Hour={false}
                display="default"
                onChange={onPickTime}
              />
            )}
            {selectedTime && (
              <View style={[styles.selectionBadge, { backgroundColor: '#F5F3FF', borderColor: '#EDE9FE' }]}>
                <Ionicons name="time-outline" size={14} color="#7C3AED" />
                <Text style={[styles.selectionBadgeText, { color: '#7C3AED' }]}>
                  {customTimeLabel || selectedTime}
                </Text>
              </View>
            )}
          </View>

          {/* ── NOTES ───────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={18} color="#10B981" />
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.sectionHint}>(optional)</Text>
            </View>
            <TextInput
              style={styles.notesInput}
              placeholder="Describe your symptoms or reason for this appointment…"
              placeholderTextColor="#94A3B8"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* ── SUMMARY ─────────────────────────────────────────────────── */}
          {isReady && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Campaign Summary</Text>
              <View style={styles.summaryRow}>
                <Ionicons name="person-circle-outline" size={16} color="#0052FF" />
                <Text style={styles.summaryLabel}>Doctor</Text>
                <Text style={styles.summaryValue}>{doctor.fullName || 'Doctor'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="calendar-outline" size={16} color="#0052FF" />
                <Text style={styles.summaryLabel}>Date</Text>
                <Text style={styles.summaryValue}>{customDateLabel || selectedDate}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="time-outline" size={16} color="#7C3AED" />
                <Text style={styles.summaryLabel}>Time</Text>
                <Text style={styles.summaryValue}>{customTimeLabel || selectedTime}</Text>
              </View>
              <View style={[styles.summaryRow, { flexWrap: 'wrap' }]}>
                <Ionicons name="medkit-outline" size={16} color="#7C3AED" />
                <Text style={styles.summaryLabel}>Treatments</Text>
                <Text style={styles.summaryValue}>{selectedTreatments.join(', ')}</Text>
              </View>
            </View>
          )}

          {/* ── CONFIRM BUTTON ───────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.confirmBtn, !isReady && styles.confirmBtnDisabled]}
            disabled={!isReady || loading}
            onPress={handleBooking}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="hourglass-outline" size={20} color="#FFF" />
                <Text style={styles.confirmBtnText}>Booking Campaign…</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.confirmBtnText}>Confirm Appointment</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4FF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0052FF',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 20 },

  // Doctor card
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8EFFF',
    shadowColor: '#0052FF',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  doctorAvatarBox: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#EFF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  doctorName: { fontSize: 17, fontWeight: '800', color: '#0A1551' },
  doctorSpec: { fontSize: 13, color: '#0052FF', fontWeight: '600', marginTop: 2 },
  doctorClinic: { fontSize: 11, color: '#64748B', marginTop: 2 },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  ratingText: { fontSize: 12, fontWeight: '800', color: '#D97706' },

  // Section
  section: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8EFFF',
    shadowColor: '#0052FF',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0A1551' },
  sectionHint: { fontSize: 12, color: '#94A3B8', marginLeft: 2 },

  // Treatments
  treatmentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  treatmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  treatmentChipSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  treatmentChipText: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
  treatmentChipTextSel: { color: '#FFF' },
  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  selectedSummaryText: { fontSize: 12, color: '#059669', flex: 1, fontWeight: '500', lineHeight: 18 },

  // Consult type
  consultChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  consultChipSel: { backgroundColor: '#0052FF', borderColor: '#0052FF' },
  consultChipText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  consultChipTextSel: { color: '#FFF', fontWeight: '700' },

  // Date cells
  dateCell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 76,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  dateCellSelected: { backgroundColor: '#0052FF', borderColor: '#0052FF' },
  dateCellWeekend: { borderColor: '#FECACA', backgroundColor: '#FFF5F5' },
  dateCellDay: { fontSize: 10, fontWeight: '700', color: '#94A3B8', marginBottom: 4 },
  dateCellNum: { fontSize: 22, fontWeight: '900', color: '#0A1551' },
  dateCellMonth: { fontSize: 10, color: '#94A3B8', marginTop: 4 },

  // Time grid
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#EDE9FE',
    minWidth: '30%',
    justifyContent: 'center',
  },
  timeChipSelected: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  timeChipText: { fontSize: 12, color: '#7C3AED', fontWeight: '600' },
  timeChipTextSel: { color: '#FFF' },

  // Pick any / custom button
  pickAnyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#EFF4FF',
  },
  pickAnyText: { flex: 1, fontSize: 13, color: '#0052FF', fontWeight: '600' },

  selectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#EFF4FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignSelf: 'flex-start',
  },
  selectionBadgeText: { fontSize: 13, color: '#0052FF', fontWeight: '700' },

  // Notes
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 88,
    textAlignVertical: 'top',
    lineHeight: 20,
  },

  // Summary card
  summaryCard: {
    backgroundColor: '#EFF4FF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: '#0A1551', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  summaryLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', width: 75 },
  summaryValue: { fontSize: 13, color: '#0A1551', fontWeight: '700', flex: 1 },

  // Confirm button
  confirmBtn: {
    backgroundColor: '#0052FF',
    height: 58,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0052FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  confirmBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0 },
  confirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
