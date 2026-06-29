import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Linking, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import { ctaLabel, promoTitle } from '../utils/promo';

// Full-page promotional content for a campaign. Records a click on open.
export default function PromoScreen({ route, navigation }) {
  const campaign = route?.params?.campaign;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isPatientPromo = campaign?.targetAudience === 'patient';

  // Title / CTA can be empty or junk (e.g. a stray "•" or "Press") in admin data —
  // promoTitle/ctaLabel clean them with sensible fallbacks (shared with the banners).
  const displayTitle = promoTitle(campaign);
  const ctaText = ctaLabel(campaign?.ctaLabel, 'Learn More');

  // Promo artwork often contains the offer text baked in, so show the FULL image
  // (no crop, no overlay). We measure its natural ratio to render it uncropped.
  const [imgRatio, setImgRatio] = useState(null); // width / height

  const img = campaign?.detailImage || campaign?.bannerImage;
  const imgUri = img ? (img.startsWith('http') ? img : `${API_BASE_URL}${img}`) : null;

  useEffect(() => {
    if (!imgUri) return;
    let active = true;
    Image.getSize(
      imgUri,
      (w, h) => { if (active && h > 0) setImgRatio(w / h); },
      () => { if (active) setImgRatio(16 / 9); } // fallback ratio
    );
    return () => { active = false; };
  }, [imgUri]);

  useEffect(() => {
    if (!campaign?._id) return;
    (async () => {
      try {
        const token = await storage.getItem('userToken');
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

  // Image rendered at full width, uncropped (contain), using its natural ratio.
  const imgW = isWeb ? Math.min(width, 560) : width;
  const naturalH = imgRatio ? imgW / imgRatio : imgW * 0.62; // reserve a sensible box until ratio loads
  // Cap very tall/portrait artwork so the page stays usable — contain still shows it whole.
  const finalImgH = Math.min(naturalH, isWeb ? 640 : 560);

  return (
    <SafeAreaView edges={isWeb ? ['top'] : []} style={styles.container}>
      {/* Floating top controls over the (edge-to-edge) image */}
      <View style={[styles.topBar, { top: (isWeb ? 12 : insets.top + 10) }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={20} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, !isWeb && styles.scrollPhone]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, !isWeb && styles.cardPhone]}>
          {/* FULL image — uncropped (contain), nothing overlaid on it. */}
          {imgUri ? (
            <View style={[styles.imageHolder, { width: imgW, height: finalImgH }]}>
              <Image
                source={{ uri: imgUri }}
                style={{ width: imgW, height: finalImgH }}
                resizeMode="contain"
              />
            </View>
          ) : (
            <View style={[styles.noImage, { paddingTop: isWeb ? 28 : insets.top + 28 }]}>
              <Ionicons name="megaphone" size={40} color="rgba(255,255,255,0.9)" />
            </View>
          )}

          {/* All textual details live BELOW the image */}
          <View style={styles.body}>
            {/* Title with an accent bar */}
            <View style={styles.titleRow}>
              <View style={styles.accentBar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{displayTitle}</Text>
                {(() => {
                  // Build the meta line, but skip any part already used as the title.
                  const parts = [campaign.medicineName, campaign.company]
                    .filter(Boolean)
                    .filter(p => p.trim() !== displayTitle.trim());
                  return parts.length ? (
                    <Text style={styles.meta} numberOfLines={1}>{parts.join('  •  ')}</Text>
                  ) : null;
                })()}
              </View>
            </View>

            {!!campaign.body && (
              <View style={styles.bodyCard}>
                <View style={styles.bodyCardHead}>
                  <Ionicons name="information-circle" size={16} color="#7C3AED" />
                  <Text style={styles.bodyCardTitle}>Offer Details</Text>
                </View>
                <Text style={styles.bodyText}>{campaign.body}</Text>
              </View>
            )}

            {campaign.ctaLink ? (
              <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={() => Linking.openURL(campaign.ctaLink)}>
                <Text style={styles.ctaText}>{ctaText}</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.closeWide} activeOpacity={0.85} onPress={() => navigation.goBack()}>
                <Text style={styles.closeWideText}>Close</Text>
              </TouchableOpacity>
            )}

            <View style={styles.disclaimerRow}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#94A3B8" />
              <Text style={styles.disclaimer}>{isPatientPromo ? 'A promotion from My Dentist.' : 'A promotion shared with healthcare professionals.'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: isWeb ? '#F1F5F9' : '#FFFFFF' },
  scroll: { padding: 16, paddingBottom: 40, alignItems: 'center' },
  scrollPhone: { padding: 0, paddingBottom: 0, alignItems: 'stretch', flexGrow: 1 },
  card: {
    width: '100%', maxWidth: 560, backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
    ...(typeof document !== 'undefined' ? { boxShadow: '0 12px 40px rgba(15,23,42,0.10)' } : {
      shadowColor: '#0F172A', shadowOpacity: 0.10, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6,
    }),
  },
  cardPhone: { maxWidth: undefined, borderRadius: 0, elevation: 0, shadowOpacity: 0 },

  // The full image sits on a soft backdrop so letterboxing (from contain) looks intentional.
  imageHolder: { backgroundColor: '#F1F0FA', alignItems: 'center', justifyContent: 'center' },
  noImage: { backgroundColor: '#7C3AED', height: 150, alignItems: 'center', justifyContent: 'center' },

  // Floating controls
  topBar: { position: 'absolute', left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', ...(typeof document !== 'undefined' ? { boxShadow: '0 2px 8px rgba(15,23,42,0.18)' } : { shadowColor: '#0F172A', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 }) },

  body: { padding: 22, paddingTop: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  accentBar: { width: 4, borderRadius: 3, alignSelf: 'stretch', backgroundColor: '#7C3AED', marginRight: 12, minHeight: 30 },
  title: { fontSize: 23, fontWeight: '800', color: '#0F172A', lineHeight: 29 },
  meta: { fontSize: 13.5, color: '#8B5CF6', fontWeight: '600', marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, marginBottom: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F5F3FF', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: '#EDE9FE' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  chipHot: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  chipHotText: { color: '#D97706' },
  bodyCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, marginTop: 18, marginBottom: 22, borderWidth: 1, borderColor: '#EEF2F7' },
  bodyCardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  bodyCardTitle: { fontSize: 12.5, fontWeight: '800', color: '#7C3AED', letterSpacing: 0.3, textTransform: 'uppercase' },
  bodyText: { fontSize: 15, lineHeight: 24, color: '#334155' },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF',
    borderRadius: 16, paddingVertical: 16, marginBottom: 12,
    ...(typeof document !== 'undefined'
      ? { boxShadow: '0 8px 20px rgba(0,82,255,0.30)' }
      : { shadowColor: '#0052FF', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 }),
  },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  closeWide: { borderRadius: 16, paddingVertical: 15, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#FFFFFF' },
  closeWideText: { color: '#475569', fontSize: 16, fontWeight: '700' },
  disclaimerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 18 },
  disclaimer: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  empty: { textAlign: 'center', marginTop: 60, color: '#64748B' },
});
