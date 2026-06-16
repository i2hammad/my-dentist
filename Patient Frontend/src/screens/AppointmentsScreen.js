import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import { useIsFocused } from '@react-navigation/native';
import API_BASE_URL from '../config/api';

export default function AppointmentsScreen({ navigation }) {
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      fetchAppointments();
    }
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
      const msg = error.response?.data?.message || error.message || 'Unknown error';
      alert(`Failed to load appointments: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return { bg: '#D1FAE5', text: '#059669' };
      case 'pending': return { bg: '#FEF3C7', text: '#D97706' };
      case 'cancelled': return { bg: '#FEE2E2', text: '#DC2626' };
      case 'completed': return { bg: '#DBEAFE', text: '#2563EB' };
      default: return { bg: '#F1F5F9', text: '#64748B' };
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderItem = ({ item }) => {
    const colors = getStatusColor(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={20} color="#2563EB" />
            <Text style={styles.date}>{formatDate(item.date)}</Text>
            <Text style={styles.time}>at {item.time}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusText, { color: colors.text }]}>{item.status?.toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.doctorRow}>
            <View style={styles.avatarSmall}>
              <Ionicons name="person" size={18} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.doctorName}>{item.doctorId?.fullName || 'Doctor'}</Text>
              <Text style={styles.specialty}>{item.doctorId?.specialization || 'Specialist'}</Text>
            </View>
          </View>
          <View style={styles.treatmentRow}>
            <Ionicons name="medkit-outline" size={16} color="#64748B" />
            <Text style={styles.treatmentText}>{item.treatmentType || 'Consultation'}</Text>
          </View>
        </View>
      </View>
    );
  };

  const activeData = activeTab === 'upcoming' ? upcoming : past;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={styles.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 16, marginHorizontal: 20 }}>
        <TouchableOpacity style={{ marginRight: 12 }} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0F172A' }}>My Appointments</Text>
      </View>
      
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming ({upcoming.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            Past ({past.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={activeData}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {activeTab === 'upcoming' ? 'No upcoming appointments.' : 'No past appointments.'}
              </Text>
              <Text style={styles.emptySubtext}>Book a doctor from the Search tab!</Text>
            </View>
          }
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginLeft: 8,
  },
  time: {
    fontSize: 13,
    color: '#64748B',
    marginLeft: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardBody: {},
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  specialty: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 1,
  },
  treatmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 46,
  },
  treatmentText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    color: '#CBD5E1',
    fontSize: 14,
    marginTop: 6,
  },
});
