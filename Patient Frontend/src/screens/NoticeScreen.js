import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import storage from '../config/storage';

export default function NoticeScreen({ navigation, route }) {
  const [agreed, setAgreed] = useState(false);

  const handleContinue = async () => {
    if (!agreed) {
      alert('Please agree to the notice to continue.');
      return;
    }
    try {
      await storage.setItem('hasAgreedNotice', 'true');
      
      const nextRoute = route.params?.nextRoute || 'RoleSelection';
      const nextParams = route.params?.nextParams;
      
      if (nextParams) {
        navigation.replace(nextRoute, nextParams);
      } else {
        navigation.replace(nextRoute);
      }
    } catch (err) {
      console.log('Error saving notice agreement:', err);
      navigation.replace('RoleSelection');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#E0F2FE' }}>
      <View style={styles.backgroundGraphic} pointerEvents="none">
        <Ionicons name="shield-checkmark-outline" size={140} color="rgba(255, 255, 255, 0.3)" style={styles.shieldIcon} />
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.card}>
        {/* Urdu Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLine} />
          <Text style={styles.urduTitle}>اہم اطلاع</Text>
          <View style={styles.headerLine} />
        </View>

        {/* English Header */}
        <Text style={styles.englishTitle}>Important Notice</Text>
        
        {/* Blue Dots Divider */}
        <View style={styles.dotsContainer}>
          <View style={styles.dotSmall} />
          <View style={styles.dotLarge} />
          <View style={styles.dotSmall} />
        </View>

        {/* Urdu Body */}
        <Text style={styles.urduText}>
          اس ایپ کو استعمال کرتے ہوئے، اپنی معلومات درستگی اور صداقت کے ساتھ درج کریں۔
        </Text>
        <Text style={styles.urduText}>
          مریضوں کے لیے، درست ڈیٹا مناسب علاج کو یقینی بنائے گا۔
        </Text>
        <Text style={styles.urduText}>
          ڈاکٹروں اور وینڈرز کے لیے، درست پروفائلز آپ کو صحیح مریضوں اور کاروباری مواقع تک پہنچنے میں مدد دیں گے۔
        </Text>
        <Text style={styles.urduText}>
          آپ کی رازداری ہمارے لیے اہم ہے۔
        </Text>

        <View style={styles.divider} />

        {/* English Body */}
        <Text style={styles.englishText}>
          By using this app, please enter your information accurately and authentically.
        </Text>
        <Text style={styles.englishText}>
          For patients, accurate data will ensure proper treatment.
        </Text>
        <Text style={styles.englishText}>
          For doctors and vendors, accurate profiles will help you reach the right patients and business opportunities.
        </Text>
        <Text style={styles.englishText}>
          Your privacy is important to us.
        </Text>

        {/* Checkbox Section */}
        <TouchableOpacity 
          style={[styles.checkboxRow, agreed && styles.checkboxRowActive]} 
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
          </View>
          <Text style={[styles.checkboxLabel, agreed && styles.checkboxLabelActive]}>I Agree</Text>
        </TouchableOpacity>

        {/* Continue Button */}
        <TouchableOpacity 
          style={[styles.button, !agreed && styles.buttonDisabled]} 
          onPress={handleContinue}
          disabled={!agreed}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backgroundGraphic: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    overflow: 'hidden',
  },
  shieldIcon: {
    position: 'absolute',
    top: 40,
    right: -20,
    transform: [{ rotate: '15deg' }],
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerLine: {
    height: 1.5,
    backgroundColor: '#2563EB',
    width: 30,
    marginHorizontal: 12,
  },
  urduTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0052FF',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Jameel Noori Nastaleeq' : 'sans-serif',
  },
  englishTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0052FF',
    textAlign: 'center',
    marginTop: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  dotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
    marginHorizontal: 4,
  },
  dotLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
    marginHorizontal: 4,
  },
  urduText: {
    fontSize: 18,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 12,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 20,
  },
  englishText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
    fontWeight: '500',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 24,
    marginBottom: 16,
  },
  checkboxRowActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  checkboxLabelActive: {
    color: '#2563EB',
  },
  button: {
    backgroundColor: '#2563EB',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
