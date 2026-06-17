import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useIsFocused } from '@react-navigation/native';
import storage from '../../config/storage';
import API_BASE_URL from '../../config/api';
import PromoBanner from '../../components/PromoBanner';

export default function DoctorAppointmentsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [appointments, setAppointments] = useState({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      fetchAppointments();
    }
  }, [isFocused]);

  const fetchAppointments = async () => {
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.get(`${API_BASE_URL}/api/appointments/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setAppointments(res.data.data);
      }
    } catch (error) {
      console.log('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const token = await storage.getItem('userToken');
      let endpoint = '';
      if (status === 'confirmed') {
        endpoint = `${API_BASE_URL}/api/appointments/${id}/confirm`;
      } else if (status === 'completed') {
        endpoint = `${API_BASE_URL}/api/appointments/${id}/complete`;
      } else if (status === 'cancelled') {
        endpoint = `${API_BASE_URL}/api/appointments/${id}/cancel`;
      } else {
        throw new Error('Unsupported status action');
      }

      await axios.put(endpoint, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Refresh list
      fetchAppointments();
      const msg = `Appointment ${status} successfully!`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Success', msg);
    } catch (error) {
      console.log('Update error:', error);
      const msg = 'Failed to update appointment status.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  const renderAppointmentCard = (item, isPast) => (
    <View key={item._id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.patientInfo}>
          <View style={styles.patientAvatar}>
            <Text style={styles.patientAvatarText}>
              {item.patientId?.fullName?.charAt(0) || 'P'}
            </Text>
          </View>
          <View>
            <Text style={styles.patientName}>{item.patientId?.fullName || 'Unknown Patient'}</Text>
            <Text style={styles.treatmentType}>{item.treatmentType}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, item.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending]}>
          <Text style={[styles.statusText, item.status === 'confirmed' ? styles.statusTextConfirmed : styles.statusTextPending]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={16} color="#64748B" />
          <Text style={styles.detailText}>{new Date(item.date).toLocaleDateString()}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={16} color="#64748B" />
          <Text style={styles.detailText}>{item.time}</Text>
        </View>
      </View>

      {!isPast && item.status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.btn, styles.btnCancel]} 
            onPress={() => handleUpdateStatus(item._id, 'cancelled')}
          >
            <Text style={styles.btnCancelText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.btn, styles.btnConfirm]} 
            onPress={() => handleUpdateStatus(item._id, 'confirmed')}
          >
            <Text style={styles.btnConfirmText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  const displayList = activeTab === 'upcoming' ? appointments.upcoming : appointments.past;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('DoctorHome')}>
          <Ionicons name="arrow-back" size={24} color="#0A1551" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointments</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>Past</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <PromoBanner />
        {displayList.length > 0 ? (
          displayList.map(item => renderAppointmentCard(item, activeTab === 'past'))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-clear-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>No {activeTab} appointments found.</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  headerBar: {
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
    position: 'relative'
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    top: 14,
    padding: 4,
    zIndex: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0A1551' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 10 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#0052FF' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  activeTabText: { color: '#0052FF' },
  container: { padding: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  patientInfo: { flexDirection: 'row', alignItems: 'center' },
  patientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  patientAvatarText: { color: '#0052FF', fontSize: 18, fontWeight: 'bold' },
  patientName: { color: '#0A1551', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  treatmentType: { color: '#64748B', fontSize: 13 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusConfirmed: { backgroundColor: '#DCFCE7' },
  statusPending: { backgroundColor: '#FEF9C3' },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  statusTextConfirmed: { color: '#16A34A' },
  statusTextPending: { color: '#CA8A04' },
  cardDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 16 },
  detailItem: { flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center' },
  detailText: { marginLeft: 8, fontSize: 13, color: '#0F172A', fontWeight: '500' },
  actionButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  btn: { flex: 1, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnCancel: { backgroundColor: '#FEE2E2' },
  btnCancelText: { color: '#EF4444', fontSize: 13, fontWeight: 'bold' },
  btnConfirm: { backgroundColor: '#0052FF' },
  btnConfirmText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#94A3B8' },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
  },
  bookBtn: {
    backgroundColor: '#0052FF',
    flexDirection: 'row',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0052FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
