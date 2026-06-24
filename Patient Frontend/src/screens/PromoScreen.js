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
  // Shorter hero when there's no image (avoids a big empty purple block).
  const heroH = (imgUri ? 230 : 130) + (isWeb ? 0 : insets.top);

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
            {imgUri ? (
              <>
                <Image source={{ uri: imgUri }} style={[styles.hero, { height: heroH }]} resizeMode="cover" />
                {/* Dark scrim over the image so the overlaid title stays readable */}
                <View style={styles.heroScrim} />
              </>
            ) : (
              <View style={[styles.hero, styles.heroPlaceholder, { height: heroH }]}>
                {/* Faint corner watermark — won't clash with the bottom title */}
                <Ionicons name="megaphone" size={120} color="rgba(255,255,255,0.13)" style={{ position: 'absolute', top: -10, right: -12 }} />
                <Ionicons name="sparkles" size={48} color="rgba(255,255,255,0.10)" style={{ position: 'absolute', bottom: 60, left: 16 }} />
              </View>
            )}
            <View style={[styles.heroTagWrap, !isWeb && { top: insets.top + 14 }]}>
              <Text style={styles.adTag}>SPONSORED</Text>
            </View>
            <TouchableOpacity style={[styles.closeBtn, !isWeb && { top: insets.top + 12 }]} onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={20} color="#0F172A" />
            </TouchableOpacity>
            {/* Title overlaid on the hero */}
            <View style={[styles.heroTitleWrap, { minHeight: heroH, paddingTop: (isWeb ? 40 : 40 + insets.top) }]}>
              <Text style={styles.heroTitle} numberOfLines={2}>{campaign.title}</Text>
              {(campaign.medicineName || campaign.company) && (
                <Text style={styles.heroMeta} numberOfLines={1}>
                  {campaign.medicineName}{campaign.medicineName && campaign.company ? '  •  ' : ''}{campaign.company}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.body}>
            {/* Quick info chips */}
            <View style={styles.chipRow}>
              {!!campaign.company && (
                <View style={styles.chip}><Ionicons name="business-outline" size={13} color="#7C3AED" /><Text style={styles.chipText}>{campaign.company}</Text></View>
              )}
              {!!campaign.endAt && (
                <View style={styles.chip}><Ionicons name="time-outline" size={13} color="#7C3AED" /><Text style={styles.chipText}>Until {new Date(campaign.endAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text></View>
              )}
              <View style={styles.chip}><Ionicons name="pricetag-outline" size={13} color="#7C3AED" /><Text style={styles.chipText}>Limited Offer</Text></View>
            </View>

            {!!campaign.body && (
              <View style={styles.bodyCard}>
                <Text style={styles.bodyText}>{campaign.body}</Text>
              </View>
            )}

            {campaign.ctaLink ? (
              <TouchableOpacity style={styles.cta} onPress={() => Linking.openURL(campaign.ctaLink)}>
                <Text style={styles.ctaText}>{campaign.ctaLabel || 'Learn More'}</Text>
                <Ionicons name="open-outline" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.closeWide} onPress={() => navigation.goBack()}>
                <Text style={styles.closeWideText}>Close</Text>
              </TouchableOpacity>
            )}

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
  heroWrap: { position: 'relative', justifyContent: 'flex-end' },
  hero: { ...StyleSheet.absoluteFillObject, width: '100%', height: 230, backgroundColor: '#7C3AED' },
  heroPlaceholder: { backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },
  // Dark gradient-like scrim over the lower half of the hero for title legibility.
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  heroTagWrap: { position: 'absolute', top: 14, left: 14, zIndex: 2 },
  adTag: { fontSize: 10, fontWeight: '800', color: '#7C3AED', letterSpacing: 0.5, backgroundColor: '#FFFFFF', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 2, width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', ...(typeof document !== 'undefined' ? { boxShadow: '0 2px 8px rgba(15,23,42,0.15)' } : { shadowColor: '#0F172A', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 }) },
  // Title block sits at the BOTTOM of the hero (clear of the top SPONSORED tag).
  heroTitleWrap: { minHeight: 230, justifyContent: 'flex-end', padding: 18, paddingTop: 60 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },
  heroMeta: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 4 },
  body: { padding: 24 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F5F3FF', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: '#EDE9FE' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  meta: { fontSize: 14, color: '#8B5CF6', fontWeight: '600', marginBottom: 16 },
  bodyCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 16, marginBottom: 22, borderWidth: 1, borderColor: '#EEF2F7' },
  bodyText: { fontSize: 15, lineHeight: 24, color: '#334155' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF', borderRadius: 14, paddingVertical: 15, marginBottom: 12 },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  closeWide: { borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  closeWideText: { color: '#0F172A', fontSize: 16, fontWeight: '600' },
  disclaimer: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 18 },
  empty: { textAlign: 'center', marginTop: 60, color: '#64748B' },
});
