import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Faint tooth decoration component
function ToothDecoration({ style }) {
  return (
    <View style={[styles.toothDeco, style]} pointerEvents="none">
      <Ionicons name="ellipse-outline" size={80} color="#BFDBFE" />
    </View>
  );
}

export default function RoleSelectionScreen({ navigation }) {
  const handleDoctor = () => {
    navigation.navigate('Login', { role: 'doctor' });
  };

  const handlePatient = () => {
    navigation.navigate('Login', { role: 'patient' });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Corner decorations */}
      <ToothDecoration style={styles.decoTopLeft} />
      <ToothDecoration style={styles.decoTopRight} />
      <ToothDecoration style={styles.decoBottomLeft} />
      <ToothDecoration style={styles.decoBottomRight} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo + App Name */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/dentist_logo_new.jpg')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>MyDentist</Text>
          <Text style={styles.subtitle}>
            Welcome! Please select how you would like to continue
          </Text>
        </View>

        {/* Role Cards */}
        <View style={styles.cardsContainer}>

          {/* Doctor Card */}
          <TouchableOpacity
            style={styles.card}
            onPress={handleDoctor}
            activeOpacity={0.85}
          >
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="person-circle-outline" size={36} color="#2563EB" />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>I'm a Doctor</Text>
              <Text style={styles.cardSubtitle}>
                Manage your practice, appointments and patients
              </Text>
            </View>
            <View style={[styles.chevronCircle, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="chevron-forward" size={20} color="#2563EB" />
            </View>
          </TouchableOpacity>

          {/* Patient Card */}
          <TouchableOpacity
            style={styles.card}
            onPress={handlePatient}
            activeOpacity={0.85}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="person-outline" size={36} color="#16A34A" />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>I'm a Patient</Text>
              <Text style={styles.cardSubtitle}>
                Book appointments, manage your dental health
              </Text>
            </View>
            <View style={[styles.chevronCircle, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="chevron-forward" size={20} color="#16A34A" />
            </View>
          </TouchableOpacity>

          {/* Vendor Card (disabled, Coming Soon) */}
          <View style={[styles.card, styles.cardDisabled]}>
            <View style={[styles.iconBox, { backgroundColor: '#FAF5FF' }]}>
              <Ionicons name="bag-handle-outline" size={36} color="#A78BFA" />
            </View>
            <View style={styles.cardTextContainer}>
              <View style={styles.vendorTitleRow}>
                <Text style={[styles.cardTitle, styles.disabledText]}>I'm a Vendor</Text>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>Coming Soon</Text>
                </View>
              </View>
              <Text style={[styles.cardSubtitle, styles.disabledText]}>
                Provide dental products and services
              </Text>
            </View>
            <View style={[styles.chevronCircle, { backgroundColor: '#F3F4F6' }]}>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EFF6FF',
  },
  // Corner tooth decorations
  toothDeco: {
    position: 'absolute',
    opacity: 0.5,
    zIndex: 0,
  },
  decoTopLeft: {
    top: -20,
    left: -20,
  },
  decoTopRight: {
    top: -20,
    right: -20,
  },
  decoBottomLeft: {
    bottom: -20,
    left: -20,
  },
  decoBottomRight: {
    bottom: -20,
    right: -20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    zIndex: 1,
  },
  // Logo section
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: width * 0.3,
    height: width * 0.3,
    borderRadius: (width * 0.3) / 2,
    marginBottom: 12,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E3A8A',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  // Cards
  cardsContainer: {
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  disabledText: {
    color: '#9CA3AF',
  },
  chevronCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  vendorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  comingSoonBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  comingSoonText: {
    fontSize: 10,
    color: '#7C3AED',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
