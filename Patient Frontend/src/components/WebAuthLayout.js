import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useResponsive from '../hooks/useResponsive';

// Split-panel auth shell for WIDE WEB screens: a branded marketing panel on the
// left and the screen's form on the right. On phones (and narrow web) it returns
// children untouched, so the existing mobile layout is preserved exactly.
const HIGHLIGHTS = [
  ['shield-checkmark', 'PMDC-verified dentists'],
  ['calendar', 'Book appointments in seconds'],
  ['chatbubbles', 'Chat with your doctor'],
  ['gift', 'Earn reward points on every visit'],
];

export default function WebAuthLayout({ children, title, subtitle, onBack }) {
  const { isWide } = useResponsive();
  if (!isWide) return children;

  return (
    <View style={styles.root}>
      {/* Brand / marketing panel */}
      <View style={styles.brandPanel}>
        <View style={styles.blobA} />
        <View style={styles.blobB} />
        <View style={styles.brandInner}>
          <View style={styles.logoRow}>
            <Image source={require('../../assets/app-logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandText}>My Dentist PK</Text>
          </View>
          <Text style={styles.heroTitle}>{title || 'Trusted dental care,\nbooked in seconds.'}</Text>
          <Text style={styles.heroSub}>{subtitle || 'Find verified dentists, compare clinics, and manage your appointments — all in one place.'}</Text>

          <View style={styles.highlights}>
            {HIGHLIGHTS.map(([icon, label]) => (
              <View key={label} style={styles.highlightRow}>
                <View style={styles.highlightIcon}>
                  <Ionicons name={icon} size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.highlightText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.brandFooter}>© 2026 My Dentist PK</Text>
      </View>

      {/* Form panel */}
      <ScrollView style={styles.formPanel} contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          {onBack && (
            <TouchableOpacity style={styles.backLink} onPress={onBack}>
              <Ionicons name="arrow-back" size={18} color="#475569" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#EEF2F9' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18, alignSelf: 'flex-start' },
  backText: { fontSize: 14, fontWeight: '600', color: '#475569' },

  brandPanel: {
    flex: 1, backgroundColor: '#0052FF', padding: 56, justifyContent: 'center',
    overflow: 'hidden', position: 'relative', minWidth: 360,
  },
  brandInner: { maxWidth: 480, zIndex: 2 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 40 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)' },
  brandText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  heroTitle: { fontSize: 40, lineHeight: 46, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  heroSub: { fontSize: 16, lineHeight: 24, color: '#D6E4FF', marginTop: 18, maxWidth: 440 },
  highlights: { marginTop: 36, gap: 16 },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  highlightIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  highlightText: { fontSize: 15.5, fontWeight: '600', color: '#EAF1FF' },
  brandFooter: { position: 'absolute', bottom: 28, left: 56, color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  blobA: {
    position: 'absolute', width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.08)', top: -80, right: -90,
  },
  blobB: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(0,0,0,0.10)', bottom: -70, left: -60,
  },

  formPanel: { flex: 1, backgroundColor: '#EEF2F9' },
  formScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  formCard: {
    width: '100%', maxWidth: 460, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 40,
    ...(typeof document !== 'undefined' ? { boxShadow: '0 30px 70px -28px rgba(9,24,51,0.28)' } : {}),
  },
});
