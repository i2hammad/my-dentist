import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../../config/storage';
import API_BASE_URL from '../../config/api';

const { width } = Dimensions.get('window');
const isWideScreen = width >= 768;

// ── Facility Data ──────────────────────────────────────────────
const CATEGORIES = [
  {
    key: 'hygiene',
    title: 'HYGIENE & STERILIZATION',
    icon: 'shield-checkmark',
    color: '#0052FF',
    bgColor: '#EFF6FF',
    items: [
      'Basic Sterilization',
      'Autoclave Sterilization',
      'UV Sterilization',
      'Disposable Instruments',
      'Instrument Pouch Sealing',
      'Separate Sterilization Room',
      'Infection Control System',
    ],
  },
  {
    key: 'ppe',
    title: 'STAFF SAFETY PROTECTION (PPE)',
    icon: 'shield',
    color: '#16A34A',
    bgColor: '#F0FDF4',
    tooltip: 'Personal Protective Equipment used by staff during procedures.',
    items: [
      'Surgical Gloves',
      'Surgical Masks',
      'Face Shields',
      'Protective Gowns',
      'Safety Glasses',
      'Hand Sanitizer Availability',
    ],
  },
  {
    key: 'equipment',
    title: 'DENTAL EQUIPMENT',
    icon: 'build',
    color: '#7C3AED',
    bgColor: '#F5F3FF',
    items: [
      'Digital X-Ray',
      'RVG System',
      'OPG Machine',
      'Intra Oral Camera',
      'Laser Dentistry',
      'Implant Facility',
      'Orthodontic Setup',
      'Pediatric Dentistry',
    ],
  },
  {
    key: 'facilities',
    title: 'CLINIC FACILITIES',
    icon: 'business',
    color: '#EA580C',
    bgColor: '#FFF7ED',
    items: [
      'Air Conditioned',
      'Waiting Area',
      'VIP Lounge',
      'Drinking Water',
      'Free Wi-Fi',
      'Parking Available',
      'Wheelchair Accessible',
      'Kids Play Area',
      'Prayer Area',
      'Backup Generator',
    ],
  },
  {
    key: 'emergency',
    title: 'EMERGENCY & SAFETY',
    icon: 'medkit',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    items: [
      'Ambulance Service',
      'Oxygen Cylinder',
      'First Aid Kit',
      'Fire Safety Equipment',
      '24/7 Emergency Support',
    ],
  },
  {
    key: 'convenience',
    title: 'PATIENT CONVENIENCE',
    icon: 'phone-portrait',
    color: '#0D9488',
    bgColor: '#F0FDFA',
    items: [
      'Online Appointment Booking',
      'Online Consultation',
      'Card Payment Accepted',
      'EasyPaisa/JazzCash',
      'SMS/WhatsApp Reminder',
      'Digital Prescription',
    ],
  },
];

const TOTAL_FACILITIES = CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0);

// Facility grades: Standard 1–15 · Modern 16–30 · Elite 31+
function getGrade(count) {
  if (count >= 31) return { label: 'Elite Clinic', color: '#F59E0B', tier: 'elite' };
  if (count >= 16) return { label: 'Modern Clinic', color: '#0052FF', tier: 'modern' };
  if (count >= 1) return { label: 'Standard Clinic', color: '#64748B', tier: 'standard' };
  return { label: 'No Grade', color: '#CBD5E1', tier: 'none' };
}

// ── Checkbox Component ─────────────────────────────────────────
function Checkbox({ label, checked, onToggle }) {
  return (
    <TouchableOpacity
      style={styles.checkboxRow}
      activeOpacity={0.6}
      onPress={onToggle}
    >
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
        {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
      </View>
      <Text style={[styles.checkboxLabel, checked && styles.checkboxLabelChecked]} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Tooltip Component ──────────────────────────────────────────
function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <View>
      <TouchableOpacity onPress={() => setShow(!show)} style={styles.infoBtn}>
        <Ionicons name="information-circle" size={18} color="#94A3B8" />
      </TouchableOpacity>
      {show && (
        <View style={styles.tooltipBubble}>
          <Text style={styles.tooltipText}>{text}</Text>
        </View>
      )}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────
export default function ClinicSetupScreen({ navigation }) {
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);

  const toggleItem = (item) => {
    setSelected((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const grade = useMemo(() => getGrade(selectedCount), [selectedCount]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await storage.getItem('userToken');

      const selectedFacilities = Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => k);

      const payload = {
        services: selectedFacilities,
        facilityScore: selectedCount,
        clinicTier: grade.tier,
      };

      await axios.put(`${API_BASE_URL}/api/users/doctor-profile`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Platform.OS === 'web') {
        window.alert('Clinic setup saved successfully!');
      } else {
        Alert.alert('Success', 'Clinic setup saved successfully!');
      }

      navigation.replace('DoctorTabs');
    } catch (error) {
      console.error('Save error:', error);
      const msg = error.response?.data?.message || 'Failed to save clinic setup.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Grade Panel ──────────────────────────────────────────────
  const renderGradePanel = () => (
    <View style={styles.gradePanel}>
      {/* Trophy */}
      <View style={[styles.trophyWrap, { borderColor: grade.color }]}>
        <Ionicons
          name={selectedCount >= 26 ? 'trophy' : 'shield-checkmark'}
          size={36}
          color={grade.color}
        />
      </View>

      <Text style={[styles.gradeLabel, { color: grade.color }]}>{grade.label}</Text>
      <Text style={styles.gradeDesc}>
        {selectedCount >= 26
          ? 'Your clinic offers excellent facilities and premium care.'
          : selectedCount >= 11
          ? 'Your clinic has good modern facilities for patients.'
          : selectedCount >= 1
          ? 'Your clinic meets standard care requirements.'
          : 'Select facilities to see your clinic grade.'}
      </Text>

      {/* Score Circle */}
      <View style={styles.scoreCircleOuter}>
        <View style={[styles.scoreCircle, { borderColor: grade.color }]}>
          <Text style={[styles.scoreNumber, { color: grade.color }]}>{selectedCount}</Text>
          <Text style={styles.scorePointsText}>POINTS</Text>
        </View>
      </View>

      <Text style={styles.facilityCountText}>
        Selected Facilities: <Text style={{ fontWeight: '700', color: '#0A1551' }}>{selectedCount} / {TOTAL_FACILITIES}</Text>
      </Text>

      <Text style={styles.gradeHint}>Keep adding more facilities to improve your grade.</Text>

      {/* Legend */}
      <View style={styles.legendWrap}>
        <Text style={styles.legendTitle}>Grade Legend</Text>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendText}>Elite (31+)</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#0052FF' }]} />
          <Text style={styles.legendText}>Modern (16–30)</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#64748B' }]} />
          <Text style={styles.legendText}>Standard (1–15)</Text>
        </View>
      </View>
    </View>
  );

  // ── Category Section ─────────────────────────────────────────
  const renderCategory = (cat) => {
    const catSelectedCount = cat.items.filter((i) => selected[i]).length;
    return (
      <View key={cat.key} style={styles.categoryCard}>
        {/* Category Header */}
        <View style={[styles.categoryHeader, { borderLeftColor: cat.color }]}>
          <View style={[styles.categoryIconWrap, { backgroundColor: cat.bgColor }]}>
            <Ionicons name={cat.icon} size={20} color={cat.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.categoryTitle}>{cat.title}</Text>
            <Text style={styles.categoryCount}>{catSelectedCount}/{cat.items.length} selected</Text>
          </View>
          {cat.tooltip && <InfoTooltip text={cat.tooltip} />}
        </View>

        {/* Checkbox Grid — 2 per row */}
        <View style={styles.checkboxGrid}>
          {cat.items.map((item) => (
            <View key={item} style={styles.checkboxGridItem}>
              <Checkbox
                label={item}
                checked={!!selected[item]}
                onToggle={() => toggleItem(item)}
              />
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0A1551" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Clinic Setup</Text>
          <Text style={styles.headerSubtitle}>Select the facilities available in your clinic</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Main Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.mainLayout}>
          {!isWideScreen && (
            <View style={styles.gradePanelCol}>
              {renderGradePanel()}
            </View>
          )}

          <View style={styles.categoriesCol}>
            {CATEGORIES.map(renderCategory)}
          </View>

          {isWideScreen && (
            <View style={styles.gradePanelCol}>
              {renderGradePanel()}
            </View>
          )}
        </View>

        {/* Save Button */}
        <View style={styles.saveWrap}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.saveBtnInner}>
                <Text style={styles.saveButtonText}>Save & Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerCenter: {
    flex: 1,
    paddingTop: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A1551',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  scrollContent: {
    padding: 20,
  },

  // ── Layout ─────────────────────────────────────────
  mainLayout: {
    flexDirection: isWideScreen ? 'row' : 'column',
    gap: 20,
  },
  categoriesCol: {
    flex: isWideScreen ? 1 : undefined,
  },
  gradePanelCol: {
    width: isWideScreen ? 280 : '100%',
  },

  // ── Category Card ──────────────────────────────────
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    paddingLeft: 12,
    marginBottom: 14,
    gap: 10,
  },
  categoryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A1551',
    letterSpacing: 0.5,
  },
  categoryCount: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },

  // ── Checkbox Grid ──────────────────────────────────
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  checkboxGridItem: {
    width: '50%',
    paddingRight: 6,
    marginBottom: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxBoxChecked: {
    backgroundColor: '#0052FF',
    borderColor: '#0052FF',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  checkboxLabelChecked: {
    color: '#0A1551',
    fontWeight: '600',
  },

  // ── Info Tooltip ───────────────────────────────────
  infoBtn: {
    padding: 4,
  },
  tooltipBubble: {
    position: 'absolute',
    top: 28,
    right: 0,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    width: 220,
    zIndex: 999,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 18,
  },

  // ── Grade Panel ────────────────────────────────────
  gradePanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  trophyWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEFCE8',
    marginBottom: 14,
  },
  gradeLabel: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  gradeDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },

  // Score Circle
  scoreCircleOuter: {
    marginBottom: 16,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  scoreNumber: {
    fontSize: 34,
    fontWeight: '900',
  },
  scorePointsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginTop: -2,
  },

  facilityCountText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 6,
  },
  gradeHint: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 18,
    fontStyle: 'italic',
  },

  // Legend
  legendWrap: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A1551',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendText: {
    fontSize: 13,
    color: '#475569',
  },

  // ── Save Button ────────────────────────────────────
  saveWrap: {
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#0052FF',
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0052FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 'bold',
  },
});
