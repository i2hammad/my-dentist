import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const isMobile = width < 768;

export default function AboutTab({ profile, appointments, bills = [], reviewStats, navigation, setActiveTab }) {
  const upcoming = appointments?.upcoming || [];
  const past = appointments?.past || [];
  const allAppts = [...upcoming, ...past];

  // Stats
  const totalPatients = new Set(allAppts.map(a => a.patientId?._id || a.patientId).filter(Boolean)).size;
  const thisMonthAppts = allAppts.filter(a => {
    const d = new Date(a.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const totalTreatments = allAppts.filter(a => a.status === 'completed').length;
  const avgRating = reviewStats?.avgRating ? reviewStats.avgRating.toFixed(1) : '0.0';

  // Monthly Revenue calculation from real bills
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const thisMonthBills = bills.filter(b => {
    const d = new Date(b.createdAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const monthlyRevenue = thisMonthBills.reduce((sum, b) => sum + (b.paidAmount || b.amount || 0), 0);

  // Today's appointments (using timezone-robust check)
  const todaysAppts = upcoming.filter(a => {
    const d1 = new Date(a.date);
    const d2 = new Date();
    const localMatch = d1.getFullYear() === d2.getFullYear() &&
                       d1.getMonth() === d2.getMonth() &&
                       d1.getDate() === d2.getDate();
    if (localMatch) return true;
    const utcMatch = d1.getUTCFullYear() === d2.getFullYear() &&
                     d1.getUTCMonth() === d2.getMonth() &&
                     d1.getUTCDate() === d2.getDate();
    return utcMatch;
  });

  // Recent patients (from past appointments)
  const recentPatients = past.slice(0, 4);

  // Completion stats
  const completedThisMonth = allAppts.filter(a => a.status === 'completed').length;
  const cancelledThisMonth = allAppts.filter(a => a.status === 'cancelled').length;
  const satisfactionRate = allAppts.length > 0 ? Math.round((completedThisMonth / Math.max(allAppts.length, 1)) * 100) : 0;
  const cancelRate = allAppts.length > 0 ? Math.round((cancelledThisMonth / Math.max(allAppts.length, 1)) * 100) : 0;
  const returningRate = totalPatients > 0 ? Math.min(Math.round((past.length / Math.max(totalPatients, 1)) * 50), 100) : 0;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* Dashboard Overview */}
      <Text style={styles.sectionTitle}>Dashboard Overview</Text>
      <View style={styles.statsRow}>
        <StatCard icon="people-outline" iconBg="#EFF6FF" iconColor="#0052FF" value={totalPatients} label="Total Patients" sub="This Month" trend="+12%" />
        <StatCard icon="calendar-outline" iconBg="#F0FDF4" iconColor="#16A34A" value={thisMonthAppts} label="Appointments" sub="This Month" trend="+8%" />
        <StatCard icon="medkit-outline" iconBg="#FFF7ED" iconColor="#EA580C" value={totalTreatments} label="Total Treatments" sub="This Month" trend="+15%" />
        <StatCard icon="star-outline" iconBg="#F3E8FF" iconColor="#9333EA" value={avgRating} label="Patient Rating" sub="Overall" trend="+0.2" />
      </View>

      {/* About Doctor + Credentials */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>About Doctor</Text>
      <View style={styles.aboutContainer}>
        <View style={styles.aboutLeft}>
          <Text style={styles.aboutText}>
            {profile?.about || 'No about information provided.'}
          </Text>
        </View>
        <View style={styles.aboutRight}>
          <CredentialRow icon="time-outline" label="Experience" value={profile?.experience ? `${profile.experience}+ Years` : 'Not specified'} />
          <CredentialRow icon="school-outline" label="Qualification" value={profile?.qualification || 'Not specified'} />
          <CredentialRow icon="medical-outline" label="Specialization" value={profile?.specialization || 'Not specified'} />
          <CredentialRow icon="shield-checkmark-outline" label="PMDC Verified" value={profile?.pmdcVerified ? 'Yes ✅' : 'No'} />
          <CredentialRow icon="language-outline" label="Languages" value={profile?.languages?.length ? profile.languages.join(', ') : 'Not specified'} />
          <CredentialRow icon="time-outline" label="Clinic Timing" value={profile?.clinicTiming ? `${profile.clinicTiming.days || ''}\n${profile.clinicTiming.startTime || ''} - ${profile.clinicTiming.endTime || ''}` : 'Not specified'} />
        </View>
      </View>

      {/* Clinic Performance */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Clinic Performance</Text>
      <View style={styles.perfRow}>
        <PerfCard label="Monthly Revenue" value={`PKR ${monthlyRevenue.toLocaleString()}`} sub="This Month" icon="cash-outline" color="#0052FF" />
        <PerfCard label="Patient Satisfaction" value={`${satisfactionRate}%`} sub={satisfactionRate >= 80 ? 'Excellent' : 'Good'} icon="happy-outline" color="#16A34A" />
        <PerfCard label="Returning Patients" value={`${returningRate}%`} sub="This Month" icon="people-outline" color="#EA580C" />
        <PerfCard label="Cancellation Rate" value={`${cancelRate}%`} sub={cancelRate <= 10 ? 'Low' : 'High'} icon="close-circle-outline" color="#DC2626" />
      </View>

      {/* Today's Appointments + Recent Patients side by side */}
      <View style={styles.bottomRow}>
        <View style={styles.bottomCard}>
          <View style={styles.bottomCardHeader}>
            <Text style={styles.bottomCardTitle}>Today's Appointments</Text>
            <TouchableOpacity onPress={() => setActiveTab && setActiveTab('appointments')}>
              <Text style={styles.viewAllLink}>View All</Text>
            </TouchableOpacity>
          </View>
          {todaysAppts.length > 0 ? todaysAppts.slice(0, 3).map((apt, i) => (
            <View key={apt._id || i} style={styles.aptRow}>
              <View style={styles.aptAvatar}>
                <Text style={styles.aptAvatarText}>{apt.patientId?.fullName?.charAt(0) || 'P'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aptName}>{apt.patientId?.fullName || 'Patient'}</Text>
                <Text style={styles.aptTreatment}>{apt.treatmentType}</Text>
              </View>
              <View>
                <Text style={styles.aptTime}>{apt.time}</Text>
                <View style={[styles.aptStatus, { backgroundColor: apt.status === 'confirmed' ? '#DCFCE7' : '#FEF9C3' }]}>
                  <Text style={[styles.aptStatusText, { color: apt.status === 'confirmed' ? '#16A34A' : '#CA8A04' }]}>
                    {apt.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                  </Text>
                </View>
              </View>
            </View>
          )) : (
            <Text style={styles.emptyText}>No appointments today</Text>
          )}
          <TouchableOpacity style={styles.manageBtn} onPress={() => setActiveTab && setActiveTab('appointments')}>
            <Ionicons name="calendar-outline" size={16} color="#FFF" />
            <Text style={styles.manageBtnText}>Manage Appointments</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomCard}>
          <View style={styles.bottomCardHeader}>
            <Text style={styles.bottomCardTitle}>Recent Patients</Text>
            <TouchableOpacity onPress={() => navigation && navigation.navigate('DoctorTabs', { screen: 'Patients' })}>
              <Text style={styles.viewAllLink}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentPatients.length > 0 ? recentPatients.map((apt, i) => (
            <View key={apt._id || i} style={styles.aptRow}>
              <View style={styles.aptAvatar}>
                <Text style={styles.aptAvatarText}>{apt.patientId?.fullName?.charAt(0) || 'P'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aptName}>{apt.patientId?.fullName || 'Patient'}</Text>
                <Text style={styles.aptTreatment}>{apt.treatmentType}</Text>
              </View>
              <View>
                <Text style={styles.aptDate}>{new Date(apt.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </View>
            </View>
          )) : (
            <Text style={styles.emptyText}>No recent patients</Text>
          )}
          <TouchableOpacity style={[styles.manageBtn, { backgroundColor: '#0052FF' }]} onPress={() => navigation && navigation.navigate('DoctorTabs', { screen: 'Patients' })}>
            <Ionicons name="people-outline" size={16} color="#FFF" />
            <Text style={styles.manageBtnText}>View All Patients</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function StatCard({ icon, iconBg, iconColor, value, label, sub, trend }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
      {trend && <Text style={[styles.statTrend, { color: trend.startsWith('+') ? '#16A34A' : '#DC2626' }]}>↑ {trend}</Text>}
    </View>
  );
}

function CredentialRow({ icon, label, value }) {
  return (
    <View style={styles.credRow}>
      <Ionicons name={icon} size={16} color="#0052FF" />
      <Text style={styles.credLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.credValue}>{value}</Text>
    </View>
  );
}

function PerfCard({ label, value, sub, icon, color }) {
  return (
    <View style={styles.perfCard}>
      <View style={styles.perfCardHeader}>
        <Text style={styles.perfLabel}>{label}</Text>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.perfValue, { color }]}>{value}</Text>
      <Text style={styles.perfSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#FFFFFF' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0A1551', marginBottom: 12 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, minWidth: '46%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  statIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#0A1551' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 4 },
  statSub: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  statTrend: { fontSize: 10, fontWeight: '600', marginTop: 6 },
  aboutContainer: { flexDirection: isMobile ? 'column' : 'row', gap: 12 },
  aboutLeft: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  aboutText: { fontSize: 12, color: '#475569', lineHeight: 18 },
  aboutRight: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  credRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  credLabel: { fontSize: 11, fontWeight: '600', color: '#0A1551', marginLeft: 6, width: 104, marginTop: 1 },
  credValue: { fontSize: 11, color: '#475569', flex: 1, marginTop: 1 },
  perfRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  perfCard: { flex: 1, minWidth: '46%', backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  perfCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  perfLabel: { fontSize: 11, color: '#64748B' },
  perfValue: { fontSize: 18, fontWeight: 'bold' },
  perfSub: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
  bottomRow: { flexDirection: isMobile ? 'column' : 'row', gap: 12, marginTop: 24 },
  bottomCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  bottomCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bottomCardTitle: { fontSize: 13, fontWeight: 'bold', color: '#0A1551' },
  viewAllLink: { fontSize: 11, color: '#0052FF', fontWeight: '600' },
  aptRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  aptAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  aptAvatarText: { color: '#0052FF', fontWeight: 'bold', fontSize: 14 },
  aptName: { fontSize: 12, fontWeight: '600', color: '#0A1551' },
  aptTreatment: { fontSize: 10, color: '#64748B', marginTop: 2 },
  aptTime: { fontSize: 10, color: '#0052FF', fontWeight: '600', textAlign: 'right' },
  aptDate: { fontSize: 10, color: '#64748B', textAlign: 'right', marginBottom: 2 },
  aptStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  aptStatusText: { fontSize: 9, fontWeight: 'bold' },
  emptyText: { fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingVertical: 16 },
  manageBtn: { backgroundColor: '#0052FF', borderRadius: 8, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 6 },
  manageBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
});
