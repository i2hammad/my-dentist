import React, { useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';

// Full-page promotional content for a campaign. Records a click on open.
export default function PromoScreen({ route, navigation }) {
  const campaign = route?.params?.campaign;
  const insets = useSafeAreaInsets();

  const isPatientPromo = campaign?.targetAudience === 'patient';

  useEffect(() => {
    if (!campaign?._id) return;
    (async () => {
      try {
        const token = await storage.getItem('userToken');
        // Patient and doctor campaigns have separate click endpoints.
        const path = isPatientPromo ? 'patient-click' : 'click';
        await axios.post(`${API_BASE_URL}/api/campaigns/${campaign._id}/${path}`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) { /* non-critical */ }
    })();
  }, [campaign?._id]);

  if (!campaign) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.empty}>Promotion not found.</Text>
      </SafeAreaView>
    );
  }

  const img = campaign.detailImage || campaign.bannerImage;
  const imgUri = img ? (img.startsWith('http') ? img : `${API_BASE_URL}${img}`) : null;

  return (
    <SafeAreaView edges={isWeb ? ['top'] : []} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, !isWeb && styles.scrollPhone]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, !isWeb && styles.cardPhone]}>
          {/* Hero — image or gradient-style placeholder with the close button overlaid.
              On phone it extends behind the status bar (edge-to-edge). */}
          <View style={styles.heroWrap}>
            {imgUri
              ? <Image source={{ uri: imgUri }} style={[styles.hero, !isWeb && { height: 200 + insets.top, paddingTop: insets.top }]} resizeMode="cover" />
              : <View style={[styles.hero, styles.heroPlaceholder, !isWeb && { height: 200 + insets.top, paddingTop: insets.top }]}>
                  <Ionicons name="megaphone" size={56} color="rgba(255,255,255,0.9)" />
                </View>}
            <View style={[styles.heroTagWrap, !isWeb && { top: insets.top + 14 }]}>
              <Text style={styles.adTag}>SPONSORED</Text>
            </View>
            <TouchableOpacity style={[styles.closeBtn, !isWeb && { top: insets.top + 12 }]} onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={styles.title}>{campaign.title}</Text>
            {(campaign.medicineName || campaign.company) && (
              <Text style={styles.meta}>
                {campaign.medicineName}{campaign.medicineName && campaign.company ? '  •  ' : ''}{campaign.company}
              </Text>
            )}

            {!!campaign.body && <Text style={styles.bodyText}>{campaign.body}</Text>}

            {!!campaign.ctaLink && (
              <TouchableOpacity style={styles.cta} onPress={() => Linking.openURL(campaign.ctaLink)}>
                <Text style={styles.ctaText}>{campaign.ctaLabel || 'Learn More'}</Text>
                <Ionicons name="open-outline" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.closeWide} onPress={() => navigation.goBack()}>
              <Text style={styles.closeWideText}>Close</Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>{isPatientPromo ? 'This is a sponsored promotion from My Dentist PK.' : 'This is a sponsored promotion shared with healthcare professionals.'}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: isWeb ? '#F1F5F9' : '#FFFFFF' },
  scroll: { padding: 16, paddingBottom: 40, alignItems: 'center' },
  // Phone: full-bleed, no outer padding/gap, fill height so white extends to the bottom.
  scrollPhone: { padding: 0, paddingBottom: 0, alignItems: 'stretch', flexGrow: 1 },
  card: {
    width: '100%', maxWidth: 560, backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
    ...(typeof document !== 'undefined' ? { boxShadow: '0 12px 40px rgba(15,23,42,0.10)' } : {
      shadowColor: '#0F172A', shadowOpacity: 0.10, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6,
    }),
  },
  cardPhone: { maxWidth: undefined, borderRadius: 0, elevation: 0, shadowOpacity: 0 },
  heroWrap: { position: 'relative' },
  hero: { width: '100%', height: 200, backgroundColor: '#EDE9FE' },
  heroPlaceholder: { backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },
  heroTagWrap: { position: 'absolute', top: 14, left: 14 },
  adTag: { fontSize: 10, fontWeight: '800', color: '#7C3AED', letterSpacing: 0.5, backgroundColor: '#FFFFFF', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  closeBtn: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', ...(typeof document !== 'undefined' ? { boxShadow: '0 2px 8px rgba(15,23,42,0.15)' } : { shadowColor: '#0F172A', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 }) },
  body: { padding: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  meta: { fontSize: 14, color: '#8B5CF6', fontWeight: '600', marginBottom: 16 },
  bodyText: { fontSize: 15.5, lineHeight: 24, color: '#334155', marginBottom: 24 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF', borderRadius: 14, paddingVertical: 15, marginBottom: 12 },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  closeWide: { borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  closeWideText: { color: '#0F172A', fontSize: 16, fontWeight: '600' },
  disclaimer: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 18 },
  empty: { textAlign: 'center', marginTop: 60, color: '#64748B' },
});
