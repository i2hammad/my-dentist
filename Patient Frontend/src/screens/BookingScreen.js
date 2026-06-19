import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';

export default function BookingScreen({ route, navigation }) {
  const doctor = route.params?.doctor || {};
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedTreatments, setSelectedTreatments] = useState([]);
  const [consultationType, setConsultationType] = useState('offline');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customDateLabel, setCustomDateLabel] = useState('');
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    (async () => {
      const token = await storage.getItem('userToken');
      if (!token) return;
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.success) {
          setUserRole(res.data.data.user?.role || res.data.data.role);
        }
      } catch {}
    })();
  }, []);
  const [customTimeLabel, setCustomTimeLabel] = useState('');

  const monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const onPickDate = (event, picked) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (event?.type === 'dismissed' || !picked) return;
    const iso = picked.toISOString().split('T')[0];
    setSelectedDate(iso);
    setCustomDateLabel(`${picked.getDate()} ${monthShort[picked.getMonth()]} ${picked.getFullYear()}`);
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

  // Generate next 30 days
  const generateDates = () => {
    const dates = [];
    const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthShortArr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (let i = 1; i <= 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push({
        dayName: dayShort[d.getDay()],
        dateNum: d.getDate(),
        month: monthShortArr[d.getMonth()],
        iso: d.toISOString().split('T')[0],
      });
    }
    return dates;
  };

  const dates = generateDates();

  // Time slots in 24-hour format for the API, with display labels
  const times = [
    { label: '09:00 AM', value: '09:00' },
    { label: '10:00 AM', value: '10:00' },
    { label: '11:00 AM', value: '11:00' },
    { label: '12:00 PM', value: '12:00' },
    { label: '02:00 PM', value: '14:00' },
    { label: '03:00 PM', value: '15:00' },
    { label: '04:00 PM', value: '16:00' },
    { label: '05:00 PM', value: '17:00' },
  ];

  const treatments = ['Consultation', 'Teeth Cleaning', 'Root Canal', 'Teeth Whitening', 'Braces', 'Check-up', 'Filling', 'Extraction'];

  const handleBooking = async () => {
    if (!selectedDate || !selectedTime) return alert('Please select a date and time');
    if (selectedTreatments.length === 0) return alert('Please select at least one treatment');
    try {
      setLoading(true);
      const token = await storage.getItem('userToken');
      if (!token) return alert('Please login first!');

      await axios.post(`${API_BASE_URL}/api/appointments`, {
        doctorId: doctor._id,
        treatmentType: selectedTreatments.join(', '),
        consultationType: consultationType,
        description: description || `Appointment with ${doctor.fullName}`,
        date: selectedDate,
        time: selectedTime,
        duration: 30
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Appointment booked successfully!');
      navigation.navigate('Appointments');
    } catch (error) {
      const msg = error.response?.data?.message 
        || error.response?.data?.errors?.map(e => e.msg).join(', ')
        || 'Failed to book appointment';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Appointment</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Role guard — doctors cannot book appointments */}
      {userRole === 'doctor' ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 60 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <Ionicons name="lock-closed-outline" size={32} color="#DC2626" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0A1551', textAlign: 'center', marginBottom: 10 }}>Doctors Cannot Book</Text>
          <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 }}>
            Appointment booking is for patients only.{'\n'}Please login with a patient account to book an appointment.
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 24, backgroundColor: '#0052FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}>
            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (<>
      <View style={styles.doctorCard}>
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={32} color="#2563EB" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.doctorName}>{doctor.fullName || 'Doctor'}</Text>
          <Text style={styles.doctorSpecialty}>{doctor.specialization || 'Specialist'}</Text>
          <Text style={styles.doctorClinic}>{doctor.clinicName}</Text>
        </View>
        {doctor.avgRating > 0 && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={styles.ratingText}>{doctor.avgRating?.toFixed(1)}</Text>
          </View>
        )}
      </View>

      {/* Treatment Type — multi-select */}
      <Text style={styles.sectionTitle}>Select Treatments <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '400' }}>(select all that apply)</Text></Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, gap: 8 }}>
        {treatments.map((t, i) => {
          const sel = selectedTreatments.includes(t);
          return (
            <TouchableOpacity
              key={i}
              style={[styles.chip, sel && styles.chipSelected, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}
              onPress={() => toggleTreatment(t)}
            >
              <Ionicons name={sel ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={sel ? '#FFF' : '#94A3B8'} />
              <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Consultation Type */}
      <Text style={styles.sectionTitle}>Consultation Type</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        <TouchableOpacity
          style={[styles.chip, consultationType === 'offline' && styles.chipSelected, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
          onPress={() => setConsultationType('offline')}
        >
          <Ionicons name="location-outline" size={14} color={consultationType === 'offline' ? '#FFF' : '#64748B'} />
          <Text style={[styles.chipText, consultationType === 'offline' && styles.chipTextSelected]}>In-Clinic (Offline)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, consultationType === 'online' && styles.chipSelected, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
          onPress={() => setConsultationType('online')}
        >
          <Ionicons name="videocam-outline" size={14} color={consultationType === 'online' ? '#FFF' : '#64748B'} />
          <Text style={[styles.chipText, consultationType === 'online' && styles.chipTextSelected]}>Video Call (Online)</Text>
        </TouchableOpacity>
      </View>

      {/* Date Selection — 30-day calendar grid */}
      <Text style={styles.sectionTitle}>Select Date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        {dates.map((date, index) => {
          const sel = selectedDate === date.iso;
          return (
            <TouchableOpacity
              key={index}
              style={[styles.dateCell, sel && styles.dateCellSelected]}
              onPress={() => { setSelectedDate(date.iso); setCustomDateLabel(''); }}
            >
              <Text style={[styles.dateCellDay, sel && { color: '#FFF' }]}>{date.dayName}</Text>
              <Text style={[styles.dateCellNum, sel && { color: '#FFF' }]}>{date.dateNum}</Text>
              <Text style={[styles.dateCellMonth, sel && { color: 'rgba(255,255,255,0.8)' }]}>{date.month}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {showDatePicker && (
        <DateTimePicker value={selectedDate ? new Date(selectedDate) : new Date()} mode="date" minimumDate={new Date()} display="default" onChange={onPickDate} />
      )}

      {/* Time Selection */}
      <Text style={styles.sectionTitle}>Select Time</Text>
      <View style={styles.gridContainer}>
        {times.map((time, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.timeChip, selectedTime === time.value && styles.chipSelected]}
            onPress={() => { setSelectedTime(time.value); setCustomTimeLabel(''); }}
          >
            <Text style={[styles.chipText, selectedTime === time.value && styles.chipTextSelected]}>
              {time.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.pickBtn} onPress={() => setShowTimePicker(true)}>
        <Ionicons name="time-outline" size={18} color="#0052FF" />
        <Text style={styles.pickBtnText}>{customTimeLabel ? `Selected: ${customTimeLabel}` : 'Pick a custom time'}</Text>
      </TouchableOpacity>
      {showTimePicker && (
        <DateTimePicker value={new Date()} mode="time" is24Hour={false} display="default" onChange={onPickTime} />
      )}

      {/* Notes */}
      <Text style={styles.sectionTitle}>Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        placeholder="Describe your symptoms or reason for visit..."
        placeholderTextColor="#94A3B8"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />

      {/* Confirm Button */}
      <TouchableOpacity
        style={[styles.confirmButton, (!selectedDate || !selectedTime || selectedTreatments.length === 0) && styles.confirmButtonDisabled]}
        disabled={!selectedDate || !selectedTime || selectedTreatments.length === 0 || loading}
        onPress={handleBooking}
      >
        <Text style={styles.confirmButtonText}>
          {loading ? 'Booking...' : 'Confirm Appointment'}
        </Text>
      </TouchableOpacity>
      </>
      )}
    </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  doctorSpecialty: {
    fontSize: 14,
    color: '#2563EB',
    marginTop: 2,
    fontWeight: '500',
  },
  doctorClinic: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#D97706',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#0052FF', backgroundColor: '#EFF6FF', marginTop: 4, marginBottom: 20 },
  pickBtnText: { color: '#0052FF', fontWeight: '700', fontSize: 13.5 },
  horizontalScroll: {
    marginBottom: 24,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 10,
  },
  chipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: {
    color: '#64748B',
    fontWeight: '500',
    fontSize: 14,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  dateCell: { alignItems: 'center', justifyContent: 'center', width: 58, height: 72, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E2E8F0', marginRight: 8 },
  dateCellSelected: { backgroundColor: '#0052FF', borderColor: '#0052FF' },
  dateCellDay: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginBottom: 2 },
  dateCellNum: { fontSize: 20, fontWeight: '900', color: '#0A1551' },
  dateCellMonth: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  timeChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 10,
    marginBottom: 10,
    width: '30%',
    alignItems: 'center',
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 32,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  confirmButton: {
    backgroundColor: '#2563EB',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
