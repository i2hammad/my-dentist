import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useIsFocused } from '@react-navigation/native';
import storage from '../../config/storage';
import API_BASE_URL from '../../config/api';
import DoctorPromoCard from '../../components/DoctorPromoCard';
import DoctorHeader from '../../components/DoctorHeader';

const isWeb = Platform.OS === 'web';

export default function DoctorAppointmentsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [appointments, setAppointments] = useState({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      fetchAppointments();
      fetchMyStatus();
    }
  }, [isFocused]);

  const fetchMyStatus = async () => {
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.get(`${API_BASE_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      const status = res.data?.data?.profile?.onlineStatus;
      setOnline(status === 'online');
    } catch (e) { /* non-critical */ }
  };

  const toggleOnline = async () => {
    const next = online ? 'offline' : 'online';
    setOnline(!online);
    try {
      const token = await storage.getItem('userToken');
      await axios.put(`${API_BASE_URL}/api/users/doctor-profile`, { onlineStatus: next }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) { setOnline(online); /* revert on failure */ }
  };

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
    <TouchableOpacity key={item._id} activeOpacity={0.85} style={styles.card} onPress={() => navigation.navigate('DoctorAppointmentDetail', { appointment: item })}>
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
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {(() => {
            const ST = {
              pending:     { bg: '#FEF3C7', color: '#D97706', label: 'PENDING'     },
              confirmed:   { bg: '#DCFCE7', color: '#16A34A', label: 'CONFIRMED'   },
              rescheduled: { bg: '#EDE9FE', color: '#7C3AED', label: 'RESCHEDULED' },
              cancelled:   { bg: '#FEE2E2', color: '#DC2626', label: 'CANCELLED'   },
              completed:   { bg: '#F0FDF4', color: '#059669', label: 'COMPLETED'   },
            };
            // Compute "COMING" for confirmed appointments within 2 hours
            let key = item.status || 'pending';
            if (key === 'confirmed') {
              try {
                const d = new Date(item.date);
                const [hh, mm] = (item.time || '00:00').split(':');
                d.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
                const diff = d - Date.now();
                if (diff >= 0 && diff <= 2 * 60 * 60 * 1000) key = 'coming';
              } catch {}
            }
            const s = ST[key] || { bg: '#FEF3C7', color: '#D97706', label: key.toUpperCase() };
            const iscoming = key === 'coming';
            return (
              <View style={[styles.statusBadge, { backgroundColor: iscoming ? '#DBEAFE' : s.bg }]}>
                <Text style={[styles.statusText, { color: iscoming ? '#1D4ED8' : s.color }]}>
                  {iscoming ? 'COMING' : s.label}
                </Text>
              </View>
            );
          })()}
          {item.status === 'confirmed' && (
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: online ? '#16A34A' : '#94A3B8' }]} />
              <Text style={[styles.liveRowText, { color: online ? '#16A34A' : '#94A3B8' }]}>{online ? 'You are Live' : 'Offline'}</Text>
            </View>
          )}
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
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  const STATUS_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const baseList = activeTab === 'upcoming' ? appointments.upcoming : appointments.past;
  const q = search.trim().toLowerCase();
  const displayList = baseList.filter((a) => {
    if (statusFilter !== 'all' && (a.status || 'pending') !== statusFilter) return false;
    if (!q) return true;
    const hay = `${a.patientId?.fullName || ''} ${a.treatmentType || ''}`.toLowerCase();
    return hay.includes(q);
  });

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      {/* Native: shared branded doctor header. Web: simple title bar (WebTopNav handles nav). */}
      <DoctorHeader
        title="Appointments"
        right={
          <TouchableOpacity style={[styles.liveToggle, { backgroundColor: online ? '#DCFCE7' : '#F1F5F9' }]} onPress={toggleOnline}>
            <View style={[styles.liveDot, { backgroundColor: online ? '#16A34A' : '#94A3B8' }]} />
            <Text style={[styles.liveToggleText, { color: online ? '#15803D' : '#64748B' }]}>{online ? 'Live' : 'Offline'}</Text>
          </TouchableOpacity>
        }
      />
      {isWeb && (
        <View style={[styles.headerBar, styles.webBlock]}>
          <Text style={styles.headerTitle}>Appointments</Text>
          <TouchableOpacity style={[styles.liveToggle, { backgroundColor: online ? '#DCFCE7' : '#F1F5F9' }]} onPress={toggleOnline}>
            <View style={[styles.liveDot, { backgroundColor: online ? '#16A34A' : '#94A3B8' }]} />
            <Text style={[styles.liveToggleText, { color: online ? '#15803D' : '#64748B' }]}>{online ? 'Live' : 'Offline'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.tabContainer, isWeb && styles.webBlock]}>
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

      {/* Search + status filter */}
      <View style={[styles.searchWrap, isWeb && styles.webBlock]}>
        <Ionicons name="search-outline" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search patient or treatment..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterScroll, isWeb && styles.webBlock]}
        contentContainerStyle={styles.filterContent}
      >
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <TouchableOpacity key={f.key} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setStatusFilter(f.key)}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.container, isWeb && styles.webBlock]}>
        {/* Full-bleed: cancel the container's 20px padding so the card (width-32,
            self-padded 16) doesn't overflow on the right. */}
        <DoctorPromoCard style={{ marginHorizontal: -20 }} />
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
  // Web: center content and cap width so rows/banner aren't stretched edge-to-edge.
  webBlock: { width: '100%', maxWidth: 900, alignSelf: 'center' },
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
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 4, marginHorizontal: 20, marginTop: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 6 },
  filterScroll: { marginTop: 10, marginBottom: 2, flexGrow: 0 },
  filterContent: { paddingHorizontal: 20, paddingVertical: 3, gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#0052FF', borderColor: '#0052FF' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filterChipTextActive: { color: '#FFFFFF' },
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
  },
  liveToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  liveToggleText: { fontSize: 13, fontWeight: '700' },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveRowText: { fontSize: 11, fontWeight: '600' },
});
