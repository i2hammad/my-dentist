import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Small pill showing which role (Doctor / Patient) the user picked on the role
// selection screen, so Login/Register make the active flow obvious. Tapping
// "Switch" lets them change role without losing their place.
export default function RoleBadge({ role, onSwitch }) {
  const isDoctor = role === 'doctor';
  return (
    <View style={styles.row}>
      <View style={[styles.pill, isDoctor ? styles.docPill : styles.patPill]}>
        <Ionicons
          name={isDoctor ? 'medkit' : 'person'}
          size={14}
          color={isDoctor ? '#0052FF' : '#16A34A'}
        />
        <Text style={[styles.pillText, { color: isDoctor ? '#0052FF' : '#16A34A' }]}>
          {isDoctor ? 'Doctor account' : 'Patient account'}
        </Text>
      </View>
      {onSwitch && (
        <TouchableOpacity onPress={onSwitch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.switch}>Switch</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
  },
  docPill: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  patPill: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  pillText: { fontSize: 13, fontWeight: '700' },
  switch: { fontSize: 13, fontWeight: '700', color: '#0052FF', textDecorationLine: 'underline' },
});
