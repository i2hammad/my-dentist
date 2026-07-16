import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import storage from '../../config/storage';
import API_BASE_URL from '../../config/api';
import DoctorHeader from '../../components/DoctorHeader';
import BillsTab from './tabs/BillsTab';

const isWeb = Platform.OS === 'web';

// Profile fields BillsTab cares about (mirrors DoctorHomeScreen's check).
const getMissingProfileFields = (p) => {
  if (!p) return [];
  const missing = [];
  if (!p.fullName || p.fullName === 'New Doctor') missing.push('Full Name');
  if (!p.specialization) missing.push('Specialization');
  if (!p.clinicName) missing.push('Clinic Name');
  return missing;
};

// Standalone bottom-tab screen that hosts the BillsTab (moved out of the
// doctor profile tabs). Fetches the profile + appointments BillsTab needs.
export default function DoctorBillsScreen({ route }) {
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState({ upcoming: [], past: [] });
  const editBillId = route?.params?.editBillId || null;
  const billPrefill = route?.params?.billPrefill || null;

  // Refetch profile + appointments. Called on focus AND after a bill is created
  // (so a just-completed appointment drops out of the billing patient picker).
  const loadData = useCallback(async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const [meRes, apptRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/users/me`, { headers }),
        axios.get(`${API_BASE_URL}/api/appointments/my`, { headers }).catch(() => null),
      ]);
      if (meRes.data?.success) setProfile(meRes.data.data?.profile || null);
      if (apptRes?.data?.success) setAppointments(apptRes.data.data || { upcoming: [], past: [] });
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const missingFields = profile ? getMissingProfileFields(profile) : [];
  const isProfileComplete = profile ? missingFields.length === 0 : true;

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <DoctorHeader title="Bills" />
      {/* No outer ScrollView — BillsTab manages its own scroll so its sub-tab bar
          (Previous Bills / Current Bill / Print Preview) stays pinned at the top
          while only the content below it scrolls. */}
      <View style={[styles.content, isWeb && styles.webBlock]}>
        <BillsTab
          profile={profile}
          appointments={appointments}
          onAppointmentsChanged={loadData}
          isProfileComplete={isProfileComplete}
          missingFields={missingFields}
          editBillId={editBillId}
          billPrefill={billPrefill}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  // flex:1 so BillsTab gets a bounded height → its inner content ScrollView
  // scrolls while the sub-tab bar above it stays pinned.
  content: { flex: 1 },
  webBlock: { width: '100%', maxWidth: 1000, alignSelf: 'center' },
});
