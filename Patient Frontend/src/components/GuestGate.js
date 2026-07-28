import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Shown inside an account tab (Appointments / Rewards / Reviews / Bills) when the
 * visitor is a guest (no token). Instead of hiding the tab or bouncing to Login,
 * the tab renders this friendly gate with a clear Log in / Sign up call-to-action.
 *
 * Usage in a screen:
 *   const [isGuest, setIsGuest] = useState(false);
 *   useFocusEffect(useCallback(() => {
 *     (async () => setIsGuest(!(await storage.getItem('userToken'))))();
 *   }, []));
 *   if (isGuest) return <GuestGate icon="calendar-outline" title="Your Appointments"
 *      message="Log in to view and manage your dental appointments." navigation={navigation} />;
 */
export default function GuestGate({ icon = 'lock-closed-outline', title, message, navigation }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={40} color="#0052FF" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity
        style={styles.primaryBtn}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Login', { role: 'patient' })}
      >
        <Text style={styles.primaryBtnText}>Log in</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryBtn}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Register', { role: 'patient' })}
      >
        <Ionicons name="person-add-outline" size={17} color="#0052FF" style={{ marginRight: 8 }} />
        <Text style={styles.secondaryBtnText}>Create an account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F8FAFC' },
  iconCircle: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: '#EFF4FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0A1551', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 15, color: '#64748B', lineHeight: 22, textAlign: 'center', marginBottom: 28, maxWidth: 340 },
  primaryBtn: {
    backgroundColor: '#0052FF', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14,
    width: '100%', maxWidth: 320, alignItems: 'center',
    shadowColor: '#0052FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, paddingHorizontal: 24, borderRadius: 14, marginTop: 12,
    borderWidth: 1.5, borderColor: '#0052FF', backgroundColor: '#FFFFFF',
    width: '100%', maxWidth: 320,
  },
  secondaryBtnText: { color: '#0052FF', fontSize: 15, fontWeight: '700' },
});
