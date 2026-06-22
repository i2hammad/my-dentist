import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const isWeb = Platform.OS === 'web';

const STATUS = {
  confirmed: { bg: '#D1FAE5', text: '#059669', label: 'Confirmed' },
  pending:   { bg: '#FEF3C7', text: '#D97706', label: 'Pending'   },
  cancelled: { bg: '#FEE2E2', text: '#DC2626', label: 'Cancelled' },
  completed: { bg: '#EDE9FE', text: '#7C3AED', label: 'Completed' },
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
const fmtTime = (t) => {
  if (!t) return '';
  const [hh, mm] = String(t).split(':');
  const h = parseInt(hh, 10);
  return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
};

export default function DoctorPatientDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const patient = route?.params?.patient;

  if (!patient) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Text style={styles.empty}>Patient not found.</Text>
      </SafeAreaView>
    );
  }

  // Newest appointments first.
  const appts = [...(patient.appointments || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <SafeAreaView edges={isWeb ? ['top'] : []} style={styles.safe}>
      <View style={[styles.header, !isWeb && { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#0A1551" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Patient summary */}
        <View style={styles.summaryCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(patient.name || '?').charAt(0)}</Text></View>
          <Text style={styles.name}>{patient.name}</Text>
          {!!patient.mobileNumber && (
            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={14} color="#64748B" />
              <Text style={styles.metaText}>{patient.mobileNumber}</Text>
            </View>
          )}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{patient.totalVisits || appts.length}</Text>
              <Text style={styles.statLabel}>Visits</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{fmtDate(patient.lastVisit)}</Text>
              <Text style={styles.statLabel}>Last Visit</Text>
            </View>
          </View>
        </View>

        {/* Appointment history */}
        <Text style={styles.sectionTitle}>Appointment History</Text>
        {appts.length ? appts.map((a) => {
          const s = STATUS[a.status] || STATUS.pending;
          return (
            <View key={a._id} style={styles.apptCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.apptTreatment}>{a.treatmentType || 'Consultation'}</Text>
                <Text style={styles.apptWhen}>{fmtDate(a.date)} · {fmtTime(a.time)}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
              </View>
            </View>
          );
        }) : (
          <Text style={styles.emptyHistory}>No appointment history.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 14, paddingTop: 16,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0A1551' },
  content: { padding: 16, paddingBottom: 40 },
  summaryCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#EEF2F7', marginBottom: 18 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#0052FF' },
  name: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  metaText: { fontSize: 13, color: '#64748B' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, alignSelf: 'stretch' },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 15, fontWeight: '800', color: '#0052FF' },
  statLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: '#EEF2F7', marginHorizontal: 8, alignSelf: 'stretch' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  apptCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EEF2F7' },
  apptTreatment: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  apptWhen: { fontSize: 12, color: '#64748B', marginTop: 3 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  emptyHistory: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 20 },
  empty: { textAlign: 'center', marginTop: 60, color: '#64748B' },
});
