import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';

export default function BookingScreen({ route, navigation }) {
  const doctor = route.params?.doctor || {};
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [treatmentType, setTreatmentType] = useState('Consultation');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Generate next 7 days dynamically
  const generateDates = () => {
    const dates = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push({
        label: `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`,
        iso: d.toISOString().split('T')[0] // e.g. "2026-06-05"
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
    try {
      setLoading(true);
      const token = await storage.getItem('userToken');
      if (!token) return alert('Please login first!');
      
      await axios.post(`${API_BASE_URL}/api/appointments`, {
        doctorId: doctor._id,
        treatmentType: treatmentType,
        description: description || `Appointment with ${doctor.fullName}`,
        date: selectedDate,    // ISO date like "2026-06-05"
        time: selectedTime,    // 24-hour like "09:00"
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

      {/* Doctor Info */}
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

      {/* Treatment Type */}
      <Text style={styles.sectionTitle}>Treatment Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
        {treatments.map((t, i) => (
          <TouchableOpacity 
            key={i} 
            style={[styles.chip, treatmentType === t && styles.chipSelected]}
            onPress={() => setTreatmentType(t)}
          >
            <Text style={[styles.chipText, treatmentType === t && styles.chipTextSelected]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Date Selection */}
      <Text style={styles.sectionTitle}>Select Date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
        {dates.map((date, index) => (
          <TouchableOpacity 
            key={index} 
            style={[styles.chip, selectedDate === date.iso && styles.chipSelected]}
            onPress={() => setSelectedDate(date.iso)}
          >
            <Text style={[styles.chipText, selectedDate === date.iso && styles.chipTextSelected]}>
              {date.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Time Selection */}
      <Text style={styles.sectionTitle}>Select Time</Text>
      <View style={styles.gridContainer}>
        {times.map((time, index) => (
          <TouchableOpacity 
            key={index} 
            style={[styles.timeChip, selectedTime === time.value && styles.chipSelected]}
            onPress={() => setSelectedTime(time.value)}
          >
            <Text style={[styles.chipText, selectedTime === time.value && styles.chipTextSelected]}>
              {time.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
        style={[styles.confirmButton, (!selectedDate || !selectedTime) && styles.confirmButtonDisabled]}
        disabled={!selectedDate || !selectedTime || loading}
        onPress={handleBooking}
      >
        <Text style={styles.confirmButtonText}>
          {loading ? 'Booking...' : 'Confirm Appointment'}
        </Text>
      </TouchableOpacity>
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
