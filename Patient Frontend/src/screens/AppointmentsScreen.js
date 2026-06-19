import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import { SkeletonList } from '../components/Skeleton';
import { AnimatedHeader, PressableScale } from '../components/Animated';
import { useIsFocused } from '@react-navigation/native';
import API_BASE_URL from '../config/api';

const STATUS_CONFIG = {
  confirmed: { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-circle', label: 'Confirmed' },
  pending:   { bg: '#FEF3C7', text: '#D97706', icon: 'time',              label: 'Pending'   },
  cancelled: { bg: '#FEE2E2', text: '#DC2626', icon: 'close-circle',      label: 'Cancelled' },
  completed: { bg: '#EDE9FE', text: '#7C3AED', icon: 'ribbon',            label: 'Completed' },
};

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
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast]         = useState([]);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [loading, setLoading]   = useState(true);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) fetchAppointments();
  }, [isFocused]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const token = await storage.getItem('userToken');
      if (!token) return;
      const res = await axios.get(`${API_BASE_URL}/api/appointments/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data.data || {};
      setUpcoming(data.upcoming || []);
      setPast(data.past || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const treatmentList = (item.treatmentType || 'Consultation').split(',').map(t => t.trim());

    return (
      <View style={[styles.card, { marginTop: index === 0 ? 0 : 14 }]}>
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
            onPress={() => navigation.navigate('DoctorProfile', { doctorId: item.doctorId?._id || item.doctorId, doctor: item.doctorId })}
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
      </View>
    );
  };

  const activeData = activeTab === 'upcoming' ? upcoming : past;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale hitSlop={10} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </PressableScale>
        <View>
          <Text style={styles.headerTitle}>My Campaigns</Text>
          <Text style={styles.headerSub}>Your treatment campaigns</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

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
                {activeTab === 'upcoming' ? 'No Upcoming Campaigns' : 'No Past Campaigns'}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === 'upcoming'
                  ? 'Book your first dental campaign with a specialist!'
                  : 'Your completed campaigns will appear here.'}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4FF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 20,
    backgroundColor: '#0052FF',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', textAlign: 'center' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EFFF',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: '#0052FF' },
  statLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: '#E8EFFF', marginHorizontal: 8 },

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
