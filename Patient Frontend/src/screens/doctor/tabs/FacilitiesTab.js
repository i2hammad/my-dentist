import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import API_BASE_URL from '../../../config/api';
import storage from '../../../config/storage';
import { getClinicTier } from '../../../utils/clinicTier';
import { FACILITY_CATEGORIES } from '../../../config/facilities';

const { width } = Dimensions.get('window');
const isWide = width >= 768;

export default function FacilitiesTab({ profile }) {
  const insets = useSafeAreaInsets();
  const [services, setServices] = useState([]);
  const [savingServices, setSavingServices] = useState(false);
  const [showFacilityPicker, setShowFacilityPicker] = useState(false);

  useEffect(() => {
    const list = (profile?.services && profile.services.length > 0)
      ? profile.services.map(s => (typeof s === 'string' ? s : s.name))
      : [];
    setServices(list);
  }, [profile?._id]);

  const persistServices = async (list) => {
    setSavingServices(true);
    try {
      const token = await storage.getItem('userToken');
      await axios.put(
        `${API_BASE_URL}/api/users/doctor-profile`,
        { services: list, facilityScore: list.length },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      Alert.alert('Error', 'Could not save services. Please try again.');
    } finally {
      setSavingServices(false);
    }
  };

  const toggleFacility = (name) => {
    const has = services.includes(name);
    const list = has ? services.filter(s => s !== name) : [...services, name];
    setServices(list);
    persistServices(list);
  };

  const removeService = (name) => {
    const list = services.filter(s => s !== name);
    setServices(list);
    persistServices(list);
  };

  const facilityScore = services.length;
  const grade = getClinicTier(facilityScore);
  const gradeIcon = grade.tier === 'elite' ? 'ribbon' : grade.tier === 'modern' ? 'business' : 'shield-checkmark';
  const gradeBlurb = grade.tier === 'elite'
    ? 'This clinic offers excellent facilities and premium care.'
    : grade.tier === 'modern'
    ? 'This clinic offers modern facilities and quality care.'
    : 'This clinic offers standard facilities and reliable care.';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.layout}>

          {/* Left: Facilities & Services */}
          <View style={styles.leftCol}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Facilities & Services</Text>
              <Text style={styles.cardSubtitle}>
                Add or remove facilities & services available at your clinic{savingServices ? '  • saving…' : ''}
              </Text>

              {services.length > 0 ? (
                <View style={styles.servicesGrid}>
                  {services.map((label, idx) => (
                    <View key={idx} style={styles.serviceItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#0052FF" />
                      <Text style={styles.serviceText} numberOfLines={1}>{label}</Text>
                      <TouchableOpacity onPress={() => removeService(label)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={16} color="#94A3B8" style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>
                  No services listed yet. Add your first facility / service below.
                </Text>
              )}

              <TouchableOpacity style={styles.addFacilityBtn} onPress={() => setShowFacilityPicker(true)}>
                <Ionicons name="add-circle-outline" size={18} color="#0052FF" />
                <Text style={styles.addFacilityBtnText}>Add / Manage Facilities</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Right: Grade Badge + Score + Legends */}
          <View style={styles.rightCol}>

            <View style={[styles.card, { alignItems: 'center', borderColor: grade.color, borderWidth: 2 }]}>
              <View style={styles.badgeImagePlaceholder}>
                <Ionicons name={gradeIcon} size={60} color={grade.color} />
                <View style={[styles.badgeEliteTag, { backgroundColor: grade.color }]}>
                  <Text style={styles.badgeEliteText}>{grade.label.replace(' Clinic', '').toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.eliteTitle}>{grade.label}</Text>
              <Text style={styles.eliteSubtitle}>{gradeBlurb}</Text>

              <View style={styles.verifiedHighlightsBox}>
                <Text style={styles.verifiedHighlightsTitle}>VERIFIED HIGHLIGHTS</Text>
                <View style={styles.vhRow}><Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" /><Text style={styles.vhText}>Verified Services</Text></View>
                <View style={styles.vhRow}><Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" /><Text style={styles.vhText}>High Patient Satisfaction</Text></View>
                <View style={styles.vhRow}><Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" /><Text style={styles.vhText}>Advanced Technology</Text></View>
                <View style={styles.vhRow}><Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" /><Text style={styles.vhText}>Hygiene & Safety</Text></View>
              </View>
            </View>

            <View style={[styles.card, { alignItems: 'center' }]}>
              <Text style={styles.facilityScoreTitle}>FACILITY SCORE</Text>
              <View style={[styles.scoreCircle, { borderColor: grade.color }]}>
                <Text style={styles.scoreNumber}>{facilityScore}</Text>
                <Text style={styles.scoreText}>POINTS</Text>
              </View>
            </View>

            <View style={styles.legendsList}>
              <View style={[styles.legendRow, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }, grade.tier === 'elite' && { borderWidth: 2 }]}>
                <View style={[styles.legendIcon, { backgroundColor: '#D97706' }]}><Ionicons name="ribbon" size={12} color="#FFF" /></View>
                <Text style={styles.legendName}>Elite Clinic</Text>
                <Text style={styles.legendRange}>31+ Points</Text>
              </View>
              <View style={[styles.legendRow, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }, grade.tier === 'modern' && { borderWidth: 2 }]}>
                <View style={[styles.legendIcon, { backgroundColor: '#0052FF' }]}><Ionicons name="business" size={12} color="#FFF" /></View>
                <Text style={styles.legendName}>Modern Clinic</Text>
                <Text style={styles.legendRange}>16 - 30 Points</Text>
              </View>
              <View style={[styles.legendRow, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }, grade.tier === 'standard' && { borderWidth: 2 }]}>
                <View style={[styles.legendIcon, { backgroundColor: '#64748B' }]}><Ionicons name="shield-checkmark" size={12} color="#FFF" /></View>
                <Text style={styles.legendName}>Standard Clinic</Text>
                <Text style={styles.legendRange}>1 - 15 Points</Text>
              </View>
            </View>

          </View>
        </View>
      </ScrollView>

      {/* Facility selection modal */}
      <Modal visible={showFacilityPicker} transparent animationType="slide" onRequestClose={() => setShowFacilityPicker(false)}>
        <View style={styles.fpOverlay}>
          <View style={[styles.fpModal, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.fpHead}>
              <Text style={styles.fpTitle}>Select Facilities & Services</Text>
              <TouchableOpacity onPress={() => setShowFacilityPicker(false)}><Ionicons name="close" size={22} color="#64748B" /></TouchableOpacity>
            </View>
            <Text style={styles.fpSub}>Tap to add or remove. {services.length} selected.</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {FACILITY_CATEGORIES.map(cat => (
                <View key={cat.key} style={{ marginBottom: 16 }}>
                  <View style={styles.fpCatHead}>
                    <View style={[styles.fpCatIcon, { backgroundColor: cat.bgColor }]}><Ionicons name={cat.icon} size={14} color={cat.color} /></View>
                    <Text style={styles.fpCatTitle}>{cat.title}</Text>
                  </View>
                  <View style={styles.fpChips}>
                    {cat.items.map(item => {
                      const on = services.includes(item);
                      return (
                        <TouchableOpacity key={item} onPress={() => toggleFacility(item)} style={[styles.fpChip, on && styles.fpChipOn]}>
                          <Ionicons name={on ? 'checkmark-circle' : 'add-circle-outline'} size={14} color={on ? '#FFFFFF' : '#64748B'} />
                          <Text style={[styles.fpChipText, on && styles.fpChipTextOn]}>{item}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
              <View style={{ height: 10 }} />
            </ScrollView>
            <TouchableOpacity style={styles.fpDone} onPress={() => setShowFacilityPicker(false)}>
              <Text style={styles.fpDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  layout: { flexDirection: isWide ? 'row' : 'column', gap: 20 },
  leftCol: { flex: isWide ? 2.5 : undefined },
  rightCol: { flex: isWide ? 1 : undefined, width: isWide ? undefined : '100%' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#0A1551' },
  cardSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16 },
  emptyText: { fontSize: 13, color: '#94A3B8', marginTop: 8, fontStyle: 'italic' },

  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  serviceItem: { flexDirection: 'row', alignItems: 'center', width: isWide ? '31%' : '47%', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 12, backgroundColor: '#FFF' },
  serviceText: { fontSize: 11, color: '#0A1551', fontWeight: '500', marginLeft: 8, flex: 1 },

  addFacilityBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#0052FF', borderStyle: 'dashed', backgroundColor: '#EFF6FF' },
  addFacilityBtnText: { color: '#0052FF', fontWeight: '700', fontSize: 14 },

  badgeImagePlaceholder: { width: 100, height: 100, borderRadius: 16, backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: '#D97706', position: 'relative' },
  badgeEliteTag: { position: 'absolute', bottom: -10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, borderWidth: 2, borderColor: '#FFF' },
  badgeEliteText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  eliteTitle: { fontSize: 20, fontWeight: 'bold', color: '#0A1551' },
  eliteSubtitle: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4, marginHorizontal: 10 },
  verifiedHighlightsBox: { width: '100%', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 16, marginTop: 20 },
  verifiedHighlightsTitle: { fontSize: 11, fontWeight: 'bold', color: '#0A1551', marginBottom: 12, letterSpacing: 0.5 },
  vhRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  vhText: { fontSize: 12, color: '#16A34A', fontWeight: '600' },

  facilityScoreTitle: { fontSize: 12, fontWeight: 'bold', color: '#0A1551', marginBottom: 16 },
  scoreCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 6, justifyContent: 'center', alignItems: 'center' },
  scoreNumber: { fontSize: 32, fontWeight: '900', color: '#0A1551' },
  scoreText: { fontSize: 10, fontWeight: 'bold', color: '#0A1551' },

  legendsList: { gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12 },
  legendIcon: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  legendName: { fontSize: 13, fontWeight: 'bold', color: '#0A1551', flex: 1 },
  legendRange: { fontSize: 11, color: '#64748B' },

  fpOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  fpModal: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20, maxHeight: '85%' },
  fpHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fpTitle: { fontSize: 17, fontWeight: '800', color: '#0A1551' },
  fpSub: { fontSize: 12.5, color: '#64748B', marginTop: 2, marginBottom: 12 },
  fpCatHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  fpCatIcon: { width: 26, height: 26, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  fpCatTitle: { fontSize: 11.5, fontWeight: '800', color: '#475569', letterSpacing: 0.4 },
  fpChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fpChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  fpChipOn: { backgroundColor: '#0052FF', borderColor: '#0052FF' },
  fpChipText: { fontSize: 12.5, color: '#334155', fontWeight: '600' },
  fpChipTextOn: { color: '#FFFFFF' },
  fpDone: { backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  fpDoneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
