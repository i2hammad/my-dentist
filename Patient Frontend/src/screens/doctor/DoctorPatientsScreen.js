import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useIsFocused } from '@react-navigation/native';
import storage from '../../config/storage';
import API_BASE_URL from '../../config/api';

export default function DoctorPatientsScreen({ navigation }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const isFocused = useIsFocused();

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
                totalVisits: 0,
                lastVisit: null
              };
            }
            patientMap[pid].totalVisits += 1;
            
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('DoctorHome')}>
          <Ionicons name="arrow-back" size={24} color="#0A1551" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Patients</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        {patients.length > 0 ? (
          patients.map(p => (
            <View key={p.id} style={styles.patientCard}>
              <View style={styles.patientAvatar}>
                <Text style={styles.patientAvatarText}>{p.name.charAt(0)}</Text>
              </View>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{p.name}</Text>
                <Text style={styles.patientSubtext}>
                  Last Visit: {p.lastVisit ? new Date(p.lastVisit).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
              <View style={styles.visitBadge}>
                <Text style={styles.visitBadgeText}>{p.totalVisits} Visits</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>You don't have any patients yet.</Text>
          </View>
        )}
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
  container: { padding: 20 },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  patientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  patientAvatarText: {
    color: '#0052FF',
    fontSize: 20,
    fontWeight: 'bold'
  },
  patientInfo: {
    flex: 1
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0A1551',
    marginBottom: 4
  },
  patientSubtext: {
    fontSize: 13,
    color: '#64748B'
  },
  visitBadge: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  visitBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#94A3B8' }
});
