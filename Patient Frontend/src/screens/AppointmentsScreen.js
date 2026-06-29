import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import { SkeletonList } from '../components/Skeleton';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import API_BASE_URL from '../config/api';
import useResponsive from '../hooks/useResponsive';
import PromoCard from '../components/PromoCard';
import PatientHeader from '../components/PatientHeader';

const STATUS_CONFIG = {
  pending:     { bg: '#FEF3C7', text: '#D97706', icon: 'time',              label: 'Pending'     },
  confirmed:   { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-circle',  label: 'Confirmed'   },
  coming:      { bg: '#DBEAFE', text: '#1D4ED8', icon: 'alarm-outline',     label: 'Coming'      },
  rescheduled: { bg: '#EDE9FE', text: '#7C3AED', icon: 'calendar-outline',  label: 'Rescheduled' },
  cancelled:   { bg: '#FEE2E2', text: '#DC2626', icon: 'close-circle',      label: 'Cancelled'   },
  completed:   { bg: '#F0FDF4', text: '#16A34A', icon: 'ribbon',            label: 'Completed'   },
};

// "Coming" = confirmed appointment within the next 2 hours
function resolveStatus(item) {
  if (item.status === 'confirmed') {
    try {
      const apptDate = new Date(item.date);
      const [hh, mm] = (item.time || '00:00').split(':');
      apptDate.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
      const diffMs = apptDate - Date.now();
      if (diffMs >= 0 && diffMs <= 2 * 60 * 60 * 1000) return 'coming';
    } catch {}
  }
  return item.status || 'pending';
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(t) {
  if (!t) return '';
  const [hh, mm] = t.split(':');
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

export default function AppointmentsScreen({ navigation }) {
  const { isWide, isWeb } = useResponsive();
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast]         = useState([]);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [loading, setLoading]   = useState(true);
  const [campaign, setCampaign] = useState(null);
  const isFocused = useIsFocused();
  useFocusEffect(React.useCallback(() => { if (!isWeb) setStatusBarStyle('light'); }, [isWeb]));

  useEffect(() => {
    if (isFocused) fetchAppointments();
  }, [isFocused]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const token = await storage.getItem('userToken');
      if (!token) return;
      const [apptRes, campRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/appointments/my`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/campaigns/active-patient`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (apptRes.status === 'fulfilled') {
        const data = apptRes.value.data.data || {};
        setUpcoming(data.upcoming || []);
        setPast(data.past || []);
      }
      if (campRes.status === 'fulfilled' && campRes.value.data?.success) {
        const d = campRes.value.data.data;
        const c = Array.isArray(d) ? d[0] : d;
        if (c) setCampaign(c);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }) => {
    const cfg = STATUS_CONFIG[resolveStatus(item)] || STATUS_CONFIG.pending;
    const treatmentList = (item.treatmentType || 'Consultation').split(',').map(t => t.trim());

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.card, { marginTop: index === 0 ? 0 : 14 }]}
        onPress={() => navigation.navigate('AppointmentDetail', { appointment: item })}
      >
        {/* Card top accent line */}
        <View style={[styles.cardAccent, { backgroundColor: cfg.text }]} />

        {/* Status + Date row */}
        <View style={styles.cardTopRow}>
          <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={13} color={cfg.text} />
            <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
          <View style={styles.dateTimeBox}>
            <Ionicons name="calendar-outline" size={13} color="#0052FF" />
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
          </View>
        </View>

        {/* Time badge */}
        <View style={styles.timeBadgeRow}>
          <Ionicons name="time-outline" size={14} color="#7C3AED" />
          <Text style={styles.timeText}>{formatTime(item.time)}</Text>
          <View style={styles.dot} />
          <Ionicons name={item.consultationType === 'online' ? 'videocam-outline' : 'business-outline'} size={13} color="#64748B" />
          <Text style={styles.consultTypeText}>{item.consultationType === 'online' ? 'Video Call' : 'In-Clinic'}</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Doctor info */}
        <View style={styles.doctorRow}>
          <View style={styles.doctorAvatar}>
            <Ionicons name="person" size={20} color="#0052FF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.doctorName}>{item.doctorId?.fullName || 'Doctor'}</Text>
            <Text style={styles.specialty}>{item.doctorId?.specialization || 'Specialist'}</Text>
          </View>
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => navigation.navigate('AppointmentDetail', { appointment: item })}
          >
            <Text style={styles.viewBtnText}>View</Text>
          </TouchableOpacity>
        </View>

        {/* Treatments */}
        <View style={styles.treatmentRow}>
          {treatmentList.map((t, i) => (
            <View key={i} style={styles.treatmentChip}>
              <Ionicons name="medkit-outline" size={11} color="#7C3AED" />
              <Text style={styles.treatmentChipText}>{t}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  const activeData = activeTab === 'upcoming' ? upcoming : past;

  return (
    <SafeAreaView edges={isWeb ? ['top'] : []} style={[styles.safe, !isWeb && { backgroundColor: '#0052FF' }]}>
      {!isWeb && <StatusBar style="light" translucent backgroundColor="transparent" />}
      <PatientHeader greeting="My Appointments" subtitle="Your dental appointments" />

      <View style={[styles.body, isWide && styles.centeredColumn, isWide && { width: '100%' }]}>
      {/* Marketing banner */}
      <PromoCard />

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{upcoming.length}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#7C3AED' }]}>{past.filter(p => p.status === 'completed').length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#EF4444' }]}>{past.filter(p => p.status === 'cancelled').length}</Text>
          <Text style={styles.statLabel}>Cancelled</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {['upcoming', 'past'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Ionicons
              name={tab === 'upcoming' ? 'calendar' : 'time'}
              size={15}
              color={activeTab === tab ? '#0052FF' : '#94A3B8'}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <SkeletonList count={3} />
      ) : (
        <FlatList
          data={activeData}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconRing}>
                <Ionicons name="calendar-outline" size={44} color="#0052FF" />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'upcoming' ? 'No Upcoming Appointments' : 'No Past Appointments'}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === 'upcoming'
                  ? 'Book your first dental appointment with a specialist!'
                  : 'Your completed appointments will appear here.'}
              </Text>
              {activeTab === 'upcoming' && (
                <TouchableOpacity
                  style={styles.bookNowBtn}
                  onPress={() => navigation.navigate('Search')}
                >
                  <Ionicons name="search-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.bookNowBtnText}>Find a Doctor</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={<View style={{ height: 32 }} />}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F1F5F9' },

  header: {
    paddingTop: 14,
    paddingBottom: 22,
    backgroundColor: '#0052FF',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: 'hidden',
    position: 'relative',
    ...(typeof document !== 'undefined' ? { boxShadow: '0 6px 18px rgba(0,82,255,0.25)' } : {
      shadowColor: '#0052FF', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    }),
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    width: '100%',
  },
  // Centered, max-width column for large screens.
  centeredColumn: {
    maxWidth: 900,
    alignSelf: 'center',
  },
  headerBlob: {
    position: 'absolute',
    top: -40, right: -20,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', textAlign: 'center', letterSpacing: 0.2 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 2 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },

  body: { flex: 1, backgroundColor: '#F1F5F9' },

  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    ...(typeof document !== 'undefined' ? { boxShadow: '0 4px 14px rgba(15,23,42,0.05)' } : {
      shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    }),
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: '#0052FF' },
  statLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: '#EEF2F7', marginHorizontal: 8 },

  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 14,
    backgroundColor: '#E8EFFF',
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: '#FFF',
    shadowColor: '#0052FF',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  tabTextActive: { color: '#0052FF', fontWeight: '800' },

  listContent: { paddingHorizontal: 16, paddingBottom: 16 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0052FF',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E8EFFF',
  },
  cardAccent: { height: 4 },

  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  dateTimeBox: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 12, fontWeight: '600', color: '#0A1551' },

  timeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  timeText: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#94A3B8', marginHorizontal: 2 },
  consultTypeText: { fontSize: 12, color: '#64748B', fontWeight: '500' },

  divider: { height: 1, backgroundColor: '#F0F4FF', marginHorizontal: 16 },

  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  doctorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EFF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  doctorName: { fontSize: 15, fontWeight: '800', color: '#0A1551' },
  specialty: { fontSize: 12, color: '#64748B', marginTop: 2 },
  viewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#EFF4FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: '#0052FF' },

  treatmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  treatmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  treatmentChipText: { fontSize: 11, color: '#7C3AED', fontWeight: '600' },

  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EFF4FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#0A1551', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  bookNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0052FF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#0052FF',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bookNowBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
