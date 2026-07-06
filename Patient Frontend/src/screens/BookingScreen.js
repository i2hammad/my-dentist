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
import { webContent, isWeb } from '../config/webLayout';
import PromoCard from '../components/PromoCard';

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

const pad2 = (n) => String(n).padStart(2, '0');

const dateToIso = (date) => (
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
);

const isoToDate = (iso) => {
  if (!iso) return new Date();
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const tomorrow = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
};

const tomorrowIso = () => dateToIso(tomorrow());

const dateLabel = (iso) => {
  const d = isoToDate(iso);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

const timeLabel = (value) => {
  const [hours = '0', minutes = '00'] = String(value || '').split(':');
  const h = Number(hours);
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${h12}:${minutes} ${ampm}`;
};

function generateDates(count = 60) {
  const dates = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push({
      dayName: DAY_SHORT[d.getDay()],
      dateNum: d.getDate(),
      month:   MONTH_SHORT[d.getMonth()],
      iso:     dateToIso(d),
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
        const [meRes, treatRes] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/treatments/doctor/${doctor._id}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (meRes.status === 'fulfilled' && meRes.value.data?.success) {
          setUserRole(meRes.value.data.data.user?.role || meRes.value.data.data.role);
        }
        if (treatRes.status === 'fulfilled' && treatRes.value.data?.success) {
          setDoctorTreatments(treatRes.value.data.data || []);
        }
      } catch {}
    })();
  }, []);

  const onPickDate = (event, picked) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (event?.type === 'dismissed' || !picked) return;
    const minIso = tomorrowIso();
    const iso = dateToIso(picked) < minIso ? minIso : dateToIso(picked);
    setSelectedDate(iso);
    setCustomDateLabel(dateLabel(iso));
  };

  const onPickTime = (event, picked) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (event?.type === 'dismissed' || !picked) return;
    const value = `${pad2(picked.getHours())}:${pad2(picked.getMinutes())}`;
    setSelectedTime(value);
    setCustomTimeLabel(timeLabel(value));
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

      const goToAppointments = () => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs', params: { screen: 'Campaigns' } }],
        });
      };

      if (isWeb) {
        window.alert('Your appointment has been booked successfully. The doctor will confirm shortly.');
        goToAppointments();
      } else {
        Alert.alert(
          'Appointment Booked!',
          'Your appointment has been booked successfully. The doctor will confirm shortly.',
          [{ text: 'OK', onPress: goToAppointments }],
          { cancelable: false }
        );
      }
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
          <View style={[styles.headerInner, webContent]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Book Appointment</Text>
              <Text style={styles.headerSub}>Schedule your dental appointment</Text>
            </View>
            <View style={{ width: 38 }} />
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, webContent]} showsVerticalScrollIndicator={false}>

          {/* Marketing banner — reusable PromoCard (full-bleed, so offset the content padding) */}
          <PromoCard style={{ marginTop: 0, marginHorizontal: -16, marginBottom: 4 }} />

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
            {isWeb ? (
              <View style={styles.pickAnyBtn}>
                <Ionicons name="calendar-outline" size={18} color="#0052FF" />
                {React.createElement('input', {
                  type: 'date',
                  value: selectedDate || '',
                  min: tomorrowIso(),
                  onChange: (e) => {
                    const iso = e.target.value;
                    if (!iso) return;
                    setSelectedDate(iso);
                    setCustomDateLabel(dateLabel(iso));
                  },
                  style: {
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    color: '#0052FF',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  },
                  'aria-label': 'Pick any future date',
                })}
              </View>
            ) : (
              <TouchableOpacity style={styles.pickAnyBtn} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={18} color="#0052FF" />
                <Text style={styles.pickAnyText}>
                  {customDateLabel ? `Custom date: ${customDateLabel}` : 'Pick any future date'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#0052FF" />
              </TouchableOpacity>
            )}
            {showDatePicker && !isWeb && (
              <DateTimePicker
                value={selectedDate ? isoToDate(selectedDate) : tomorrow()}
                mode="date"
                minimumDate={tomorrow()}
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
            {isWeb ? (
              <View style={styles.pickAnyBtn}>
                <Ionicons name="time-outline" size={18} color="#7C3AED" />
                {React.createElement('input', {
                  type: 'time',
                  value: selectedTime || '',
                  onChange: (e) => {
                    const value = e.target.value;
                    if (!value) return;
                    setSelectedTime(value);
                    setCustomTimeLabel(timeLabel(value));
                  },
                  style: {
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    color: '#7C3AED',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  },
                  'aria-label': 'Pick a custom time',
                })}
              </View>
            ) : (
              <TouchableOpacity style={styles.pickAnyBtn} onPress={() => setShowTimePicker(true)}>
                <Ionicons name="time-outline" size={18} color="#7C3AED" />
                <Text style={[styles.pickAnyText, { color: '#7C3AED' }]}>
                  {customTimeLabel ? `Custom time: ${customTimeLabel}` : 'Pick a custom time'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#7C3AED" />
              </TouchableOpacity>
            )}
            {showTimePicker && !isWeb && (
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
    backgroundColor: '#0052FF',
    paddingVertical: 16,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    width: '100%',
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
