import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, TextInput, RefreshControl, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useIsFocused } from '@react-navigation/native';
import storage from '../../config/storage';
import API_BASE_URL from '../../config/api';
import imgUrl from '../../config/imgUrl';
import DoctorPromoCard from '../../components/DoctorPromoCard';
import DoctorHeader from '../../components/DoctorHeader';

const isWeb = Platform.OS === 'web';

export default function DoctorAppointmentsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [appointments, setAppointments] = useState({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // all | today | 7d | 30d | month
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
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

  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([fetchAppointments(), fetchMyStatus()]); }
    finally { setRefreshing(false); }
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

  const renderAppointmentCard = (item, isPast) => {
    const ST = {
      pending:     { bg: '#FEF3C7', color: '#D97706', accent: '#F59E0B', label: 'Pending'     },
      confirmed:   { bg: '#DCFCE7', color: '#16A34A', accent: '#16A34A', label: 'Confirmed'   },
      rescheduled: { bg: '#EDE9FE', color: '#7C3AED', accent: '#7C3AED', label: 'Rescheduled' },
      cancelled:   { bg: '#FEE2E2', color: '#DC2626', accent: '#DC2626', label: 'Cancelled'   },
      completed:   { bg: '#F0FDF4', color: '#059669', accent: '#22C55E', label: 'Completed'   },
      coming:      { bg: '#DBEAFE', color: '#1D4ED8', accent: '#2563EB', label: 'Coming Soon' },
    };
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
    const s = ST[key] || ST.pending;
    // Friendly relative date: Today / Tomorrow / Wed, 12 Jul.
    const apptDate = new Date(item.date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dOnly = new Date(apptDate); dOnly.setHours(0, 0, 0, 0);
    const dayDiff = Math.round((dOnly - today) / 86400000);
    const dateStr = dayDiff === 0 ? 'Today'
      : dayDiff === 1 ? 'Tomorrow'
      : dayDiff === -1 ? 'Yesterday'
      : apptDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    const isToday = dayDiff === 0;

    return (
      <TouchableOpacity key={item._id} activeOpacity={0.85} style={styles.card} onPress={() => navigation.navigate('DoctorAppointmentDetail', { appointment: item })}>
        {/* status accent bar */}
        <View style={[styles.accent, { backgroundColor: s.accent }]} />

        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={styles.patientInfo}>
              <View style={[styles.avatarRing, { borderColor: s.accent + '55' }]}>
                <View style={styles.patientAvatar}>
                  {item.patientId?.profileImage ? (
                    <Image source={{ uri: imgUrl(item.patientId.profileImage) }} style={styles.patientAvatarImg} />
                  ) : (
                    <Text style={styles.patientAvatarText}>{item.patientId?.fullName?.charAt(0) || 'P'}</Text>
                  )}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.patientName} numberOfLines={1}>{item.patientId?.fullName || 'Unknown Patient'}</Text>
                <View style={styles.treatChip}>
                  <Ionicons name="medical-outline" size={11} color="#0052FF" />
                  <Text style={styles.treatmentType} numberOfLines={1}>{item.treatmentType || 'Consultation'}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: s.color }]} />
              <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
            </View>
          </View>

          {/* date / time pills */}
          <View style={styles.metaRow}>
            <View style={[styles.metaPill, isToday && { backgroundColor: '#0052FF' }]}>
              <Ionicons name="calendar-outline" size={14} color={isToday ? '#FFFFFF' : '#0052FF'} />
              <Text style={[styles.metaText, isToday && { color: '#FFFFFF' }]}>{dateStr}</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="time-outline" size={14} color="#0052FF" />
              <Text style={styles.metaText}>{item.time || '—'}</Text>
            </View>
            {item.status === 'confirmed' && (
              <View style={[styles.metaPill, { backgroundColor: online ? '#F0FDF4' : '#F1F5F9' }]}>
                <View style={[styles.liveDot, { backgroundColor: online ? '#16A34A' : '#94A3B8' }]} />
                <Text style={[styles.metaText, { color: online ? '#15803D' : '#94A3B8' }]}>{online ? 'Live' : 'Offline'}</Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </View>

          {/* pending → confirm/decline */}
          {!isPast && item.status === 'pending' && (
            <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => handleUpdateStatus(item._id, 'cancelled')}>
                <Ionicons name="close" size={16} color="#DC2626" style={{ marginRight: 4 }} />
                <Text style={styles.btnCancelText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={() => handleUpdateStatus(item._id, 'confirmed')}>
                <Ionicons name="checkmark" size={16} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.btnConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* completed → hint to create bill */}
          {item.status === 'completed' && (
            <View style={styles.billHintRow}>
              <Ionicons name="receipt-outline" size={14} color="#0052FF" />
              <Text style={styles.billHintText}>Tap to view or create a bill</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

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

  const DATE_FILTERS = [
    { key: 'all', label: 'Any date' },
    { key: 'today', label: 'Today' },
    { key: '7d', label: 'Next 7d' },
    { key: '30d', label: 'Next 30d' },
    { key: 'month', label: 'This month' },
  ];

  // Is the appointment date within the selected window? On the Past tab the
  // "7d/30d" windows look backwards instead of forwards.
  const inDateRange = (dateVal) => {
    if (dateFilter === 'all') return true;
    const d = new Date(dateVal); if (isNaN(d)) return false;
    d.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dayMs = 86400000;
    if (dateFilter === 'today') return d.getTime() === today.getTime();
    if (dateFilter === 'month') return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    const span = dateFilter === '7d' ? 7 : 30;
    if (activeTab === 'past') return d <= today && d >= new Date(today.getTime() - span * dayMs);
    return d >= today && d <= new Date(today.getTime() + span * dayMs);
  };

  const baseList = activeTab === 'upcoming' ? appointments.upcoming : appointments.past;
  const q = search.trim().toLowerCase();
  const displayList = baseList.filter((a) => {
    if (statusFilter !== 'all' && (a.status || 'pending') !== statusFilter) return false;
    if (!inDateRange(a.date)) return false;
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
      {/* Web: slim title + Live toggle row (native shows these in DoctorHeader). */}
      {isWeb && (
        <View style={[styles.webHeaderRow, styles.webBlock]}>
          <Text style={styles.headerTitle}>Appointments</Text>
          <TouchableOpacity style={[styles.liveToggle, { backgroundColor: online ? '#DCFCE7' : '#F1F5F9' }]} onPress={toggleOnline}>
            <View style={[styles.liveDot, { backgroundColor: online ? '#16A34A' : '#94A3B8' }]} />
            <Text style={[styles.liveToggleText, { color: online ? '#15803D' : '#64748B' }]}>{online ? 'Live' : 'Offline'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stats bar — patient-style summary */}
      <View style={[styles.statsBar, isWeb && styles.webBlock]}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{appointments.upcoming.length}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#7C3AED' }]}>{appointments.past.filter(p => p.status === 'completed').length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#EF4444' }]}>{appointments.past.filter(p => p.status === 'cancelled').length}</Text>
          <Text style={styles.statLabel}>Cancelled</Text>
        </View>
      </View>

      {/* Segmented pill tabs */}
      <View style={[styles.tabContainer, isWeb && styles.webBlock]}>
        {['upcoming', 'past'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Ionicons name={tab === 'upcoming' ? 'calendar' : 'time'} size={15} color={activeTab === tab ? '#0052FF' : '#94A3B8'} style={{ marginRight: 5 }} />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'upcoming' ? `Upcoming (${appointments.upcoming.length})` : `Past (${appointments.past.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search + date selector (one row) */}
      <View style={[styles.searchRow, isWeb && styles.webBlock]}>
        <View style={styles.searchWrap}>
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
        <TouchableOpacity style={[styles.dateSelect, dateFilter !== 'all' && styles.dateSelectActive]} onPress={() => setDateMenuOpen(true)}>
          <Ionicons name="calendar-outline" size={16} color={dateFilter !== 'all' ? '#FFFFFF' : '#0052FF'} />
          <Text style={[styles.dateSelectText, dateFilter !== 'all' && { color: '#FFFFFF' }]} numberOfLines={1}>
            {(DATE_FILTERS.find(f => f.key === dateFilter) || DATE_FILTERS[0]).label}
          </Text>
          <Ionicons name="chevron-down" size={14} color={dateFilter !== 'all' ? '#FFFFFF' : '#64748B'} />
        </TouchableOpacity>
      </View>

      {/* Status filter chips */}
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

      {/* Date selector dropdown */}
      <Modal visible={dateMenuOpen} transparent animationType="fade" onRequestClose={() => setDateMenuOpen(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setDateMenuOpen(false)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Filter by date</Text>
            {DATE_FILTERS.map((f) => {
              const active = dateFilter === f.key;
              return (
                <TouchableOpacity key={f.key} style={styles.menuItem} onPress={() => { setDateFilter(f.key); setDateMenuOpen(false); }}>
                  <Ionicons name="calendar-outline" size={16} color={active ? '#0052FF' : '#94A3B8'} />
                  <Text style={[styles.menuItemText, active && { color: '#0052FF', fontWeight: '800' }]}>{f.label}</Text>
                  {active && <Ionicons name="checkmark" size={16} color="#0052FF" style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.container, isWeb && styles.webBlock]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0052FF" colors={['#0052FF']} />
        }
      >
        {/* Promo banner — full-bleed, on top. */}
        <DoctorPromoCard style={{ marginHorizontal: -20 }} />

        {/* Count header for the current tab/filter */}
        {displayList.length > 0 && (
          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeaderTitle}>
              {activeTab === 'past' ? 'Past' : 'Upcoming'} appointments
            </Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{displayList.length}</Text>
            </View>
          </View>
        )}

        {displayList.length > 0 ? (
          displayList.map(item => renderAppointmentCard(item, activeTab === 'past'))
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-clear-outline" size={40} color="#0052FF" />
            </View>
            <Text style={styles.emptyText}>No {activeTab} appointments</Text>
            <Text style={styles.emptySub}>New bookings will appear here.</Text>
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0A1551' },
  // Compact left-aligned web header (WebTopNav already shows the section name).
  webHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'transparent', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2 },

  // Patient-style stats bar
  statsBar: {
    flexDirection: 'row', backgroundColor: '#FFF', paddingVertical: 16, paddingHorizontal: 16,
    marginHorizontal: 20, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: '#EEF2F7',
    shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: '#0052FF' },
  statLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: '#EEF2F7', marginHorizontal: 8 },

  // Patient-style segmented pill tabs
  tabContainer: { flexDirection: 'row', marginHorizontal: 20, marginTop: 14, marginBottom: 6, backgroundColor: '#E8EFFF', borderRadius: 14, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
  tabActive: { backgroundColor: '#FFF', shadowColor: '#0052FF', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  tabTextActive: { color: '#0052FF', fontWeight: '800' },
  activeTabText: { color: '#0052FF' },
  container: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 12 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 8 : 2 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 6 },
  dateSelect: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF4FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 12, paddingHorizontal: 12, height: 42, maxWidth: 150 },
  dateSelectActive: { backgroundColor: '#0052FF', borderColor: '#0052FF' },
  dateSelectText: { fontSize: 13, fontWeight: '700', color: '#0052FF', flexShrink: 1 },
  // Date dropdown menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(10,21,81,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  menuCard: { width: '100%', maxWidth: 300, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 8, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 28, elevation: 12 },
  menuTitle: { fontSize: 12, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10 },
  menuItemText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  filterScroll: { marginTop: 8, marginBottom: 0, flexGrow: 0, minHeight: 40 },
  filterContent: { paddingHorizontal: 20, paddingVertical: 4, gap: 8, alignItems: 'center' },
  filterChip: { minHeight: 34, minWidth: 78, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  filterChipActive: { backgroundColor: '#0052FF', borderColor: '#0052FF' },
  filterChipText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#64748B', textAlign: 'center', includeFontPadding: false, flexShrink: 0 },
  filterChipTextActive: { color: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 14, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: '#EEF2F7', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2 },
  accent: { width: 5 },
  cardBody: { flex: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  patientInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  avatarRing: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  patientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  patientAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  patientAvatarText: { color: '#0052FF', fontSize: 18, fontWeight: 'bold' },
  patientName: { color: '#0A1551', fontSize: 15.5, fontWeight: '800' },
  treatChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  treatmentType: { color: '#64748B', fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F5F8FF', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  metaText: { fontSize: 12.5, color: '#0A1551', fontWeight: '700' },
  actionButtons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, flexDirection: 'row', height: 40, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  btnCancel: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2' },
  btnCancelText: { color: '#DC2626', fontSize: 13.5, fontWeight: '800' },
  btnConfirm: { backgroundColor: '#0052FF' },
  btnConfirmText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' },
  billHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  billHintText: { fontSize: 12.5, color: '#0052FF', fontWeight: '700' },
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 12 },
  listHeaderTitle: { fontSize: 15, fontWeight: '800', color: '#0A1551' },
  countPill: { backgroundColor: '#EFF4FF', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  countPillText: { fontSize: 12.5, fontWeight: '800', color: '#0052FF' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50, paddingHorizontal: 20 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EFF4FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyText: { fontSize: 16.5, fontWeight: '800', color: '#0A1551' },
  emptySub: { marginTop: 5, fontSize: 13.5, color: '#94A3B8', fontWeight: '600' },
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
