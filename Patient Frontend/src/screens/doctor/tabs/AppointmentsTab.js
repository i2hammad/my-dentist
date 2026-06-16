import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Dimensions, Linking, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import API_BASE_URL from '../../../config/api';
import storage from '../../../config/storage';

const { width } = Dimensions.get('window');
const isWide = width >= 768;

// Helper to compare dates ignoring time (timezone-robust)
const isSameDay = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const localMatch = d1.getFullYear() === d2.getFullYear() &&
                     d1.getMonth() === d2.getMonth() &&
                     d1.getDate() === d2.getDate();
  if (localMatch) return true;
  
  const utcMatch = d1.getUTCFullYear() === d2.getFullYear() &&
                   d1.getUTCMonth() === d2.getMonth() &&
                   d1.getUTCDate() === d2.getDate();
  return utcMatch;
};

export default function AppointmentsTab({ appointments, onRefresh, navigation, setActiveTab, isProfileComplete = true, missingFields = [] }) {
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Normalize backend appointment representation to match the UI's expectation
  const normalizeAppointment = (apt) => {
    if (!apt) return null;
    
    const patientName = apt.patientId?.fullName || 'Patient';
    const treatment = apt.treatmentType || 'General Consultation';
    const phone = apt.patientId?.mobileNumber || 'Not provided';
    const patientUserId = apt.patientId?.userId || null;
    
    const d = new Date(apt.date);
    const month = d.toLocaleString('en-US', { month: 'short' }) || '';
    const dateNum = d.getDate() || '';
    const day = d.toLocaleString('en-US', { weekday: 'short' }) || '';
    
    let timeStr = apt.time || '10:00 AM';
    let ampm = 'AM';
    let timeText = timeStr;
    
    if (timeStr && timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const hours24 = parseInt(parts[0], 10);
      const minutes = parts[1];
      if (!isNaN(hours24)) {
        const hours12 = hours24 % 12 || 12;
        ampm = hours24 >= 12 ? 'PM' : 'AM';
        timeText = `${hours12}:${minutes}`;
        timeStr = `${hours12}:${minutes} ${ampm}`;
      }
    }
    
    return {
      _id: apt._id,
      time: timeText,
      ampm,
      timeStr,
      patientName,
      treatment,
      phone,
      patientUserId,
      status: apt.status || 'pending',
      month,
      date: dateNum.toString(),
      day,
    };
  };

  const allAppts = [...(appointments?.upcoming || []), ...(appointments?.past || [])];
  
  const rawToday = allAppts.filter(apt => isSameDay(apt.date, selectedDate));
  const rawUpcoming = (appointments?.upcoming || []).filter(apt => !isSameDay(apt.date, selectedDate));
  
  const todaysAppts = rawToday.map(normalizeAppointment).filter(Boolean);
  const upcomingAppts = rawUpcoming.map(normalizeAppointment).filter(Boolean);

  const stats = {
    today: allAppts.filter(a => isSameDay(a.date, new Date())).length,
    confirmed: allAppts.filter(a => a.status === 'confirmed').length,
    pending: allAppts.filter(a => a.status === 'pending').length,
    cancelled: allAppts.filter(a => a.status === 'cancelled').length,
    upcomingCount: upcomingAppts.length
  };

  // Weekly Stats calculation
  const isThisWeek = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0,0,0,0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23,59,59,999);
    
    return d >= startOfWeek && d <= endOfWeek;
  };

  const weeklyAppts = allAppts.filter(a => isThisWeek(a.date));
  const weeklyTotal = weeklyAppts.length;
  const weeklyCompleted = weeklyAppts.filter(a => a.status === 'completed').length;
  const weeklyPending = weeklyAppts.filter(a => a.status === 'pending' || a.status === 'confirmed').length;
  const weeklyRate = weeklyTotal > 0 ? Math.round((weeklyCompleted / weeklyTotal) * 100) : 0;

  const handleCallPatient = (phone) => {
    if (!phone || phone === 'Not provided') return;
    Linking.openURL(`tel:${phone}`);
  };

  const handleAction = async (id, action) => {
    if (!isProfileComplete) {
      Alert.alert(
        'Profile Setup Incomplete',
        'You must complete all mandatory profile details and upload verification documents before performing appointment actions.'
      );
      return;
    }
    if (!id || id.length < 5) {
      setUpdatingId(id);
      setTimeout(() => {
        setUpdatingId(null);
        Alert.alert('Mock Action', `${action} triggered for mock item.`);
      }, 500);
      return;
    }
    
    try {
      setUpdatingId(id);
      const token = await storage.getItem('userToken');
      let endpoint = '';
      if (action === 'confirm') {
        endpoint = `${API_BASE_URL}/api/appointments/${id}/confirm`;
      } else if (action === 'start') {
        endpoint = `${API_BASE_URL}/api/appointments/${id}/complete`;
      } else if (action === 'cancel') {
        endpoint = `${API_BASE_URL}/api/appointments/${id}/cancel`;
      } else {
        return;
      }
      
      await axios.put(endpoint, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      Alert.alert('Success', `Appointment updated successfully!`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to update appointment.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleShowAppointmentMenu = (apt) => {
    if (!isProfileComplete) {
      Alert.alert(
        'Profile Setup Incomplete',
        'You must complete all mandatory profile details and upload verification documents before accessing appointment options.'
      );
      return;
    }
    const options = [
      { text: 'Call Patient', onPress: () => handleCallPatient(apt.phone) }
    ];

    if (apt.patientUserId) {
      options.push({
        text: 'Chat with Patient',
        onPress: () => navigation.navigate('Chat', { userId: apt.patientUserId, userName: apt.patientName })
      });
    }

    if (apt.status === 'pending') {
      options.push({
        text: 'Confirm Appointment',
        onPress: () => handleAction(apt._id, 'confirm')
      });
    } else if (apt.status === 'confirmed') {
      options.push({
        text: 'Mark as Completed',
        onPress: () => handleAction(apt._id, 'start')
      });
    }

    if (apt.status !== 'cancelled' && apt.status !== 'completed') {
      options.push({ 
        text: 'Cancel Appointment', 
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Cancel Appointment',
            'Are you sure you want to cancel this appointment?',
            [
              { text: 'No', style: 'cancel' },
              { text: 'Yes, Cancel', style: 'destructive', onPress: () => handleAction(apt._id, 'cancel') }
            ]
          );
        }
      });
    }

    options.push({ text: 'Close', style: 'cancel' });

    Alert.alert(
      'Appointment Options',
      `Patient: ${apt.patientName}\nTreatment: ${apt.treatment}\nTime: ${apt.timeStr || apt.time}\nStatus: ${apt.status.toUpperCase()}`,
      options
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        
        {/* Header Area */}
        <View style={styles.headerArea}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Appointments</Text>
            <Text style={styles.pageSubtitle}>Manage your schedule and appointments</Text>
          </View>
          <View style={styles.calendarGraphic}>
            <Ionicons name="calendar" size={40} color="#0052FF" style={{opacity: 0.8}} />
            <View style={styles.calendarGraphicCheck}><Ionicons name="checkmark" size={14} color="#FFF" /></View>
          </View>
        </View>

        {/* Top 4 Stat Cards */}
        <View style={styles.topStatsRow}>
          <View style={styles.topStatCard}>
            <View style={[styles.topStatIconBg, {backgroundColor: '#EFF6FF'}]}><Ionicons name="calendar-outline" size={18} color="#0052FF" /></View>
            <Text style={styles.topStatNum}>{stats.today}</Text>
            <Text style={styles.topStatLabel}>Today's{'\n'}Appointments</Text>
          </View>
          <View style={styles.topStatCard}>
            <View style={[styles.topStatIconBg, {backgroundColor: '#DCFCE7'}]}><Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" /></View>
            <Text style={styles.topStatNum}>{stats.confirmed}</Text>
            <Text style={styles.topStatLabel}>Confirmed</Text>
          </View>
          <View style={styles.topStatCard}>
            <View style={[styles.topStatIconBg, {backgroundColor: '#F3E8FF'}]}><Ionicons name="time-outline" size={18} color="#9333EA" /></View>
            <Text style={styles.topStatNum}>{stats.pending}</Text>
            <Text style={styles.topStatLabel}>Pending</Text>
          </View>
          <View style={styles.topStatCard}>
            <View style={[styles.topStatIconBg, {backgroundColor: '#FEE2E2'}]}><Ionicons name="close-circle-outline" size={18} color="#DC2626" /></View>
            <Text style={styles.topStatNum}>{stats.cancelled}</Text>
            <Text style={styles.topStatLabel}>Cancelled</Text>
          </View>
        </View>

        {/* Today's Appointments Section */}
        <View style={styles.sectionHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
            <Text style={[styles.sectionTitle, { fontSize: 14, flexShrink: 1 }]} numberOfLines={2}>
              {selectedDate.toDateString() === new Date().toDateString() ? "Today's Appointments" : `Appointments on ${selectedDate.toLocaleDateString()}`}
            </Text>
            <View style={styles.badgeBlue}><Text style={styles.badgeBlueText}>{todaysAppts.length}</Text></View>
          </View>
          {Platform.OS === 'web' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <input 
                type="date" 
                value={selectedDate.toISOString().split('T')[0]} 
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 6,
                  padding: 4,
                  fontSize: 12,
                  outline: 'none',
                  color: '#0052FF',
                  fontWeight: '600'
                }}
              />
            </View>
          ) : (
            <TouchableOpacity 
              style={{flexDirection: 'row', alignItems: 'center'}}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.viewLinkText}>View Calendar</Text>
              <Ionicons name="calendar-outline" size={14} color="#0052FF" style={{marginLeft: 4}} />
            </TouchableOpacity>
          )}
        </View>

        {showDatePicker && Platform.OS !== 'web' && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (date) setSelectedDate(date);
            }}
          />
        )}

        <View style={styles.listContainer}>
          {todaysAppts.length > 0 ? (
            todaysAppts.map((apt) => (
              <View key={apt._id} style={styles.aptRow}>
                <View style={styles.aptRowTop}>
                  {/* Time Badge */}
                  <View style={styles.timeBox}>
                    <Text style={styles.timeTextNum}>{apt.time}</Text>
                    <Text style={styles.timeTextAmPm}>{apt.ampm}</Text>
                  </View>

                  {/* Avatar */}
                  <Image source={{uri: `https://ui-avatars.com/api/?name=${apt.patientName.replace(' ', '+')}&background=F1F5F9`}} style={styles.avatar} />

                  {/* Patient Info */}
                  <View style={styles.patientInfo}>
                    <Text style={styles.patientName}>{apt.patientName}</Text>
                    <Text style={styles.patientTreatment}>{apt.treatment}</Text>
                    <TouchableOpacity style={styles.phoneRow} onPress={() => handleCallPatient(apt.phone)}>
                      <Ionicons name="call-outline" size={12} color="#64748B" />
                      <Text style={styles.phoneText}>{apt.phone}</Text>
                    </TouchableOpacity>
                  </View>

                  {isWide && (
                    <TouchableOpacity style={styles.dotsBtn} onPress={() => handleShowAppointmentMenu(apt)}>
                      <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Status and Action */}
                <View style={[styles.actionArea, !isWide && styles.actionAreaMobile]}>
                  <View style={[styles.statusBadge, {backgroundColor: apt.status === 'confirmed' ? '#DCFCE7' : '#FEF9C3'}]}>
                    <Text style={[styles.statusBadgeText, {color: apt.status === 'confirmed' ? '#16A34A' : '#CA8A04'}]}>
                      {apt.status.toUpperCase()}
                    </Text>
                  </View>

                  {updatingId === apt._id ? (
                    <ActivityIndicator size="small" color="#0052FF" />
                  ) : apt.status === 'confirmed' ? (
                    <TouchableOpacity 
                      style={styles.startBtn} 
                      onPress={async () => {
                        await handleAction(apt._id, 'start');
                        if (apt.patientUserId) {
                          navigation.navigate('Chat', { userId: apt.patientUserId, userName: apt.patientName });
                        }
                      }}
                    >
                      <Text style={styles.startBtnText}>Start Consultation</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.confirmBtn} onPress={() => handleAction(apt._id, 'confirm')}>
                      <Text style={styles.confirmBtnText}>Confirm</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!isWide && (
                  <TouchableOpacity style={[styles.dotsBtn, { position: 'absolute', top: 12, right: 12 }]} onPress={() => handleShowAppointmentMenu(apt)}>
                    <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={36} color="#94A3B8" />
              <Text style={styles.emptyStateText}>No appointments scheduled for this date.</Text>
            </View>
          )}
        </View>

        <View style={[styles.sectionHeader, {marginTop: 30}]}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
            <View style={styles.badgeBlue}><Text style={styles.badgeBlueText}>{stats.upcomingCount}</Text></View>
          </View>
          <TouchableOpacity onPress={() => navigation && navigation.navigate('DoctorTabs', { screen: 'Appointments' })}>
            <Text style={styles.viewLinkText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {upcomingAppts.length > 0 ? (
            upcomingAppts.map((apt) => (
              <View key={apt._id} style={styles.aptRow}>
                <View style={styles.aptRowTop}>
                  {/* Date Box */}
                  <View style={styles.dateBox}>
                    <Text style={styles.dateMonth}>{apt.month}</Text>
                    <Text style={styles.dateNum}>{apt.date}</Text>
                    <Text style={styles.dateDay}>{apt.day}</Text>
                  </View>

                  {/* Avatar */}
                  <Image source={{uri: `https://ui-avatars.com/api/?name=${apt.patientName.replace(' ', '+')}&background=F1F5F9`}} style={styles.avatar} />

                  {/* Patient Info */}
                  <View style={styles.patientInfo}>
                    <Text style={styles.patientName}>{apt.patientName}</Text>
                    <Text style={styles.patientTreatment}>{apt.treatment}</Text>
                    <View style={styles.timeRow}>
                      <Ionicons name="time-outline" size={12} color="#64748B" />
                      <Text style={styles.phoneText}>{apt.timeStr}</Text>
                    </View>
                  </View>

                  {isWide && (
                    <TouchableOpacity style={styles.dotsBtn} onPress={() => handleShowAppointmentMenu(apt)}>
                      <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Status */}
                <View style={[styles.actionArea, !isWide && styles.actionAreaMobile, {justifyContent: isWide ? 'flex-start' : 'center', paddingTop: isWide ? 10 : 0}]}>
                  <View style={[styles.statusBadge, {backgroundColor: apt.status === 'confirmed' ? '#DCFCE7' : '#FEF9C3'}]}>
                    <Text style={[styles.statusBadgeText, {color: apt.status === 'confirmed' ? '#16A34A' : '#CA8A04'}]}>
                      {apt.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {!isWide && (
                  <TouchableOpacity style={[styles.dotsBtn, { position: 'absolute', top: 12, right: 12 }]} onPress={() => handleShowAppointmentMenu(apt)}>
                    <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-clear-outline" size={36} color="#94A3B8" />
              <Text style={styles.emptyStateText}>No other upcoming appointments.</Text>
            </View>
          )}
        </View>

        {/* Bottom Stat Cards (Weekly) */}
        <View style={styles.bottomStatsRow}>
          <View style={styles.bottomStatCard}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
              <Ionicons name="calendar-outline" size={18} color="#0052FF" />
              <Text style={styles.bottomStatNum}>{weeklyTotal}</Text>
            </View>
            <Text style={styles.bottomStatLabel}>Total Appointments{'\n'}This Week</Text>
          </View>
          
          <View style={styles.bottomStatCard}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
              <Text style={styles.bottomStatNum}>{weeklyCompleted}</Text>
            </View>
            <Text style={styles.bottomStatLabel}>Completed{'\n'}This Week</Text>
          </View>

          <View style={styles.bottomStatCard}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
              <Ionicons name="time-outline" size={18} color="#D97706" />
              <Text style={styles.bottomStatNum}>{weeklyPending}</Text>
            </View>
            <Text style={styles.bottomStatLabel}>Pending{'\n'}This Week</Text>
          </View>

          <View style={styles.bottomStatCard}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
              <Ionicons name="podium-outline" size={18} color="#9333EA" />
              <Text style={styles.bottomStatNum}>{weeklyRate}%</Text>
            </View>
            <Text style={styles.bottomStatLabel}>Completion Rate{'\n'}This Week</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  headerArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  pageTitle: { fontSize: 20, fontWeight: 'bold', color: '#0A1551' },
  pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
  calendarGraphic: { position: 'relative', width: 60, height: 60, backgroundColor: '#EFF6FF', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  calendarGraphicCheck: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#16A34A', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  
  /* Top 4 Stat Cards */
  topStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 30 },
  topStatCard: { flex: 1, minWidth: isWide ? '22%' : '45%', backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' },
  topStatIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  topStatNum: { fontSize: 20, fontWeight: 'bold', color: '#0A1551', marginBottom: 4 },
  topStatLabel: { fontSize: 10, color: '#64748B', textAlign: 'center', height: 26 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0A1551' },
  badgeBlue: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 10 },
  badgeBlueText: { fontSize: 11, color: '#0052FF', fontWeight: 'bold' },
  viewLinkText: { fontSize: 12, color: '#0052FF', fontWeight: '600' },

  /* List */
  listContainer: { gap: 12 },
  aptRow: { flexDirection: isWide ? 'row' : 'column', backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F1F5F9', position: 'relative' },
  aptRowTop: { flexDirection: 'row', flex: 1 },
  
  timeBox: { width: 50, height: 50, backgroundColor: '#EFF6FF', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  timeTextNum: { fontSize: 14, fontWeight: 'bold', color: '#0052FF' },
  timeTextAmPm: { fontSize: 10, color: '#0052FF', fontWeight: '600', marginTop: 2 },
  
  dateBox: { width: 50, height: 60, backgroundColor: '#EFF6FF', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  dateMonth: { fontSize: 10, color: '#0052FF', fontWeight: '600' },
  dateNum: { fontSize: 16, fontWeight: 'bold', color: '#0052FF', marginVertical: 2 },
  dateDay: { fontSize: 10, color: '#64748B' },

  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  patientInfo: { flex: 1, justifyContent: 'center' },
  patientName: { fontSize: 14, fontWeight: 'bold', color: '#0A1551' },
  patientTreatment: { fontSize: 12, color: '#64748B', marginTop: 2 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  phoneText: { fontSize: 11, color: '#64748B' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },

  actionArea: { width: isWide ? 120 : '100%', alignItems: isWide ? 'flex-end' : 'center', justifyContent: 'space-between' },
  actionAreaMobile: { flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16, justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold' },
  
  startBtn: { backgroundColor: '#0052FF', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, width: isWide ? '100%' : '58%', alignItems: 'center' },
  startBtnText: { color: '#FFF', fontSize: 10.5, fontWeight: 'bold' },
  
  confirmBtn: { backgroundColor: '#FFF', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#0052FF', width: isWide ? '100%' : '58%', alignItems: 'center' },
  confirmBtnText: { color: '#0052FF', fontSize: 10.5, fontWeight: 'bold' },
  
  dotsBtn: { padding: 10, justifyContent: 'center', alignItems: 'center' },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500'
  },

  /* Bottom Stats */
  bottomStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 30 },
  bottomStatCard: { flex: 1, minWidth: '45%', backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  bottomStatNum: { fontSize: 22, fontWeight: 'bold', color: '#0A1551', marginLeft: 8 },
  bottomStatLabel: { fontSize: 11, color: '#64748B' },

  /* Footer */
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingBottom: Platform.OS === 'ios' ? 36 : 28 },
  bookBtn: { backgroundColor: '#0052FF', height: 48, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  bookBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' }
});
