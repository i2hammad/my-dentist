import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
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
export default function DoctorBillsScreen() {
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState({ upcoming: [], past: [] });

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      try {
        const token = await storage.getItem('userToken');
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        const [meRes, apptRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/users/me`, { headers }),
          axios.get(`${API_BASE_URL}/api/appointments/my`, { headers }).catch(() => null),
        ]);
        if (!active) return;
        if (meRes.data?.success) setProfile(meRes.data.data?.profile || null);
        if (apptRes?.data?.success) setAppointments(apptRes.data.data || { upcoming: [], past: [] });
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, []));

  const missingFields = profile ? getMissingProfileFields(profile) : [];
  const isProfileComplete = profile ? missingFields.length === 0 : true;

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <DoctorHeader title="Bills" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, isWeb && styles.webBlock]}>
        <BillsTab
          profile={profile}
          appointments={appointments}
          isProfileComplete={isProfileComplete}
          missingFields={missingFields}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingBottom: 90 },
  webBlock: { width: '100%', maxWidth: 1000, alignSelf: 'center' },
});
