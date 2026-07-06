import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PK_CITIES } from '../config/cities';

// Tappable field that opens a searchable modal of cities. Allows a custom entry
// for anything not in the list. Reused across the patient profile + setup screens.
export default function CityPicker({ value, onSelect, placeholder = 'Select your city', cities = PK_CITIES }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? cities.filter((c) => c.toLowerCase().includes(q)) : cities),
    [q, cities]
  );
  const trimmed = query.trim();
  const showCustom = !!trimmed && !cities.some((c) => c.toLowerCase() === trimmed.toLowerCase());

  const pick = (c) => { onSelect(c); setOpen(false); setQuery(''); };

  return (
    <>
      <TouchableOpacity style={styles.field} activeOpacity={0.7} onPress={() => setOpen(true)}>
        <Ionicons name="location-outline" size={20} color="#94A3B8" style={{ marginRight: 10 }} />
        <Text style={[styles.fieldText, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#94A3B8" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>Select City</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color="#0A1551" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search city…"
                placeholderTextColor="#94A3B8"
                autoFocus
                autoCapitalize="words"
              />
              {query ? (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(c) => c}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => {
                const sel = value === item;
                return (
                  <TouchableOpacity style={[styles.row, sel && styles.rowActive]} onPress={() => pick(item)}>
                    <Text style={[styles.rowText, sel && styles.rowTextActive]}>{item}</Text>
                    {sel && <Ionicons name="checkmark-circle" size={20} color="#0052FF" />}
                  </TouchableOpacity>
                );
              }}
              ListFooterComponent={showCustom ? (
                <TouchableOpacity style={styles.row} onPress={() => pick(trimmed)}>
                  <Ionicons name="add-circle-outline" size={18} color="#0052FF" style={{ marginRight: 8 }} />
                  <Text style={[styles.rowText, { color: '#0052FF' }]} numberOfLines={1}>Use “{trimmed}”</Text>
                </TouchableOpacity>
              ) : null}
              ListEmptyComponent={!showCustom ? <Text style={styles.empty}>No cities found</Text> : null}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 14, height: 52,
  },
  fieldText: { flex: 1, fontSize: 15, color: '#0A1551' },
  placeholder: { color: '#94A3B8' },

  overlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.45)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#FFF', borderRadius: 18, overflow: 'hidden', maxHeight: '80%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  title: { fontSize: 16, fontWeight: '800', color: '#0A1551' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', margin: 14,
    backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#0A1551' },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: '#F8FAFC',
  },
  rowActive: { backgroundColor: '#EFF6FF' },
  rowText: { fontSize: 15, color: '#0A1551' },
  rowTextActive: { color: '#0052FF', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#94A3B8', paddingVertical: 24, fontSize: 14 },
});
