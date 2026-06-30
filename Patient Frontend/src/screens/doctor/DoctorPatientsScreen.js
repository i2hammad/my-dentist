import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform, TextInput, Image } from 'react-native';
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
const PAGE_SIZE = 15; // patients shown per "page" (infinite scroll grows this)

const sameMonth = (a, b) => a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
const formatVisit = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No visits yet';
const lastTreatmentOf = (p) => [...(p.appointments || [])].sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.treatmentType || 'Consultation';

export default function DoctorPatientsScreen({ navigation }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const isFocused = useIsFocused();

  // Reset the page window whenever the search changes.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchQuery]);

  useEffect(() => {
    if (isFocused) {
      fetchPatients();
    }
  }, [isFocused]);

  const fetchPatients = async () => {
    try {
      const token = await storage.getItem('userToken');
      // Fetch all appointments
      const res = await axios.get(`${API_BASE_URL}/api/appointments/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data?.success) {
        const upcoming = res.data.data?.upcoming ?? [];
        const past = res.data.data?.past ?? [];
        const allApts = [...upcoming, ...past];
        
        // Extract unique patients
        const patientMap = {};
        allApts.forEach(apt => {
          if (apt.patientId && apt.patientId._id) {
            const pid = apt.patientId._id;
            if (!patientMap[pid]) {
              patientMap[pid] = {
                id: pid,
                name: apt.patientId.fullName || 'Unknown',
                profileImage: apt.patientId.profileImage || null,
                mobileNumber: apt.patientId.mobileNumber || null,
                totalVisits: 0,
                lastVisit: null,
                appointments: [],
              };
            }
            patientMap[pid].totalVisits += 1;
            patientMap[pid].appointments.push(apt);

            const aptDate = new Date(apt.date);
            if (!patientMap[pid].lastVisit || aptDate > new Date(patientMap[pid].lastVisit)) {
              patientMap[pid].lastVisit = apt.date;
            }
          }
        });

        setPatients(Object.values(patientMap));
      }
    } catch (error) {
      console.log('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  // Roster-wide stats (full list, not the filtered subset) — stable dashboard.
  // Declared BEFORE the early return below — hooks can't run conditionally.
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: patients.length,
      thisMonth: patients.filter(p => p.lastVisit && sameMonth(new Date(p.lastVisit), now)).length,
      newOnes: patients.filter(p => p.totalVisits === 1).length,
    };
  }, [patients]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? patients.filter(p => `${p.name} ${p.mobileNumber || ''}`.toLowerCase().includes(q))
    : patients;
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visible.length < filtered.length;

  const onScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200 && hasMore) {
      setVisibleCount((c) => c + PAGE_SIZE);
    }
  };

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <DoctorHeader title="My Patients" subtitle={`${patients.length} patient${patients.length === 1 ? '' : 's'}`} />
      {isWeb && (
        <View style={[styles.headerBar, styles.webBlock]}>
          <Text style={styles.headerTitle}>My Patients</Text>
          <Text style={styles.headerCount}>{patients.length} patient{patients.length === 1 ? '' : 's'}</Text>
        </View>
      )}

      {/* Search */}
      <View style={[styles.searchWrap, isWeb && styles.webBlock]}>
        <Ionicons name="search-outline" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.container, isWeb && styles.webBlock]}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Full-bleed: cancel the container's 20px padding. */}
        <DoctorPromoCard style={{ marginHorizontal: -20 }} />

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statCell}>
            <Text style={[styles.statNum, { color: '#0052FF' }]}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statCell}>
            <Text style={[styles.statNum, { color: '#16A34A' }]}>{stats.thisMonth}</Text>
            <Text style={styles.statLabel}>This month</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statCell}>
            <Text style={[styles.statNum, { color: '#7C3AED' }]}>{stats.newOnes}</Text>
            <Text style={styles.statLabel}>New</Text>
          </View>
        </View>

        {filtered.length > 0 && (
          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeaderCount}>{filtered.length} patient{filtered.length === 1 ? '' : 's'}</Text>
            <Text style={styles.listHeaderHint}>Most recent</Text>
          </View>
        )}

        {filtered.length > 0 ? (
          visible.map(p => (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.85}
              style={styles.patientCard}
              onPress={() => navigation.navigate('DoctorPatientDetail', { patient: p })}
            >
              <View style={styles.cardAccent} />
              {p.profileImage ? (
                <Image source={{ uri: imgUrl(p.profileImage) }} style={styles.patientAvatarImg} />
              ) : (
                <View style={styles.patientAvatar}>
                  <Text style={styles.patientAvatarText}>{(p.name || '?').charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.patientInfo}>
                <Text style={styles.patientName} numberOfLines={1}>{p.name}</Text>
                <View style={styles.rowLine}>
                  <Ionicons name="call-outline" size={12} color="#94A3B8" />
                  <Text style={styles.rowLineText} numberOfLines={1}>{p.mobileNumber || 'No phone'}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Ionicons name="time-outline" size={12} color="#94A3B8" />
                  <Text style={styles.rowLineText}>Last visit {formatVisit(p.lastVisit)}</Text>
                  <View style={styles.metaDot} />
                  <Ionicons name="medkit-outline" size={12} color="#94A3B8" />
                  <Text style={[styles.rowLineText, { flexShrink: 1 }]} numberOfLines={1}>{lastTreatmentOf(p)}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={styles.visitsPill}>
                  <Ionicons name="repeat-outline" size={11} color="#0052FF" />
                  <Text style={styles.visitsPillText}>{p.totalVisits}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" style={{ marginTop: 8 }} />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>{q ? 'No patients match your search.' : "You don't have any patients yet."}</Text>
          </View>
        )}
        {hasMore && (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator color="#0052FF" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Web: center content and cap width so rows/banner aren't stretched edge-to-edge.
  webBlock: { width: '100%', maxWidth: 900, alignSelf: 'center' },
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
  headerCount: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 2 },
  container: { padding: 20 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 4, marginHorizontal: 20, marginTop: 12, shadowColor: '#0A1551', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 6 },

  // Stats strip
  statsStrip: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#EEF2F7', padding: 14, marginBottom: 14, shadowColor: '#0A1551', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  statCell: { flex: 1, alignItems: 'center' },
  statSep: { width: 1, height: 28, backgroundColor: '#EEF2F7', alignSelf: 'center' },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },

  // List header
  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 10 },
  listHeaderCount: { fontSize: 13, fontWeight: '700', color: '#0A1551' },
  listHeaderHint: { fontSize: 11.5, color: '#94A3B8' },

  // Patient card
  patientCard: {
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, paddingLeft: 18, marginBottom: 12,
    borderWidth: 1, borderColor: '#EEF2F7',
    shadowColor: '#0A1551', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#0052FF' },
  patientAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EFF4FF', justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1, borderColor: '#EEF2F7' },
  patientAvatarImg: { width: 50, height: 50, borderRadius: 25, marginRight: 14, borderWidth: 1, borderColor: '#EEF2F7', backgroundColor: '#EFF4FF' },
  patientAvatarText: { color: '#0052FF', fontSize: 19, fontWeight: '800' },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 15.5, fontWeight: '700', color: '#0A1551' },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  rowLineText: { fontSize: 12, color: '#64748B' },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#CBD5E1', marginHorizontal: 6 },
  visitsPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EFF4FF', borderWidth: 1, borderColor: '#D6E2FB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  visitsPillText: { fontSize: 12.5, fontWeight: '800', color: '#0052FF' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#94A3B8', textAlign: 'center' }
});
