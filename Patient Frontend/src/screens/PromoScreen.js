import React, { useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';

// Full-page promotional content for a campaign. Records a click on open.
export default function PromoScreen({ route, navigation }) {
  const campaign = route?.params?.campaign;

  useEffect(() => {
    if (!campaign?._id) return;
    (async () => {
      try {
        const token = await storage.getItem('userToken');
        await axios.post(`${API_BASE_URL}/api/campaigns/${campaign._id}/click`, {}, {
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
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Close button */}
      <View style={styles.topBar}>
        <Text style={styles.adTag}>SPONSORED</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, Platform.OS === 'web' && { maxWidth: 720, alignSelf: 'center', width: '100%' }]} showsVerticalScrollIndicator={false}>
        {imgUri && <Image source={{ uri: imgUri }} style={styles.hero} resizeMode="cover" />}

        <Text style={styles.title}>{campaign.title}</Text>
        {(campaign.medicineName || campaign.company) && (
          <Text style={styles.meta}>
            {campaign.medicineName}{campaign.medicineName && campaign.company ? '  •  ' : ''}{campaign.company}
          </Text>
        )}

        {!!campaign.body && <Text style={styles.body}>{campaign.body}</Text>}

        {!!campaign.ctaLink && (
          <TouchableOpacity style={styles.cta} onPress={() => Linking.openURL(campaign.ctaLink)}>
            <Text style={styles.ctaText}>{campaign.ctaLabel || 'Learn More'}</Text>
            <Ionicons name="open-outline" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.closeWide} onPress={() => navigation.goBack()}>
          <Text style={styles.closeWideText}>Close</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>This is a sponsored promotion shared with healthcare professionals.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  adTag: { fontSize: 10, fontWeight: '800', color: '#8B5CF6', letterSpacing: 0.5, backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, overflow: 'hidden' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  hero: { width: '100%', height: 200, borderRadius: 16, backgroundColor: '#EDE9FE', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  meta: { fontSize: 14, color: '#8B5CF6', fontWeight: '600', marginBottom: 16 },
  body: { fontSize: 15.5, lineHeight: 24, color: '#334155', marginBottom: 24 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF', borderRadius: 14, paddingVertical: 15, marginBottom: 14 },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  closeWide: { borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  closeWideText: { color: '#0F172A', fontSize: 16, fontWeight: '600' },
  disclaimer: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 20 },
  empty: { textAlign: 'center', marginTop: 60, color: '#64748B' },
});
