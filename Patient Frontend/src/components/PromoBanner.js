import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';

/**
 * Small dismissible promotional banner shown on doctor screens.
 * Fetches the active campaign for the doctor's city (view is counted by the
 * backend when served). Tapping opens the full Promo page. Dismiss hides it
 * for the session.
 */
export default function PromoBanner() {
  const navigation = useNavigation();
  const [campaign, setCampaign] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await storage.getItem('userToken');
        if (!token) return;
        const res = await axios.get(`${API_BASE_URL}/api/campaigns/active`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.data?.success && res.data.data) setCampaign(res.data.data);
      } catch (e) {
        // silently ignore — banner is non-critical
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!campaign || dismissed) return null;

  const img = campaign.bannerImage
    ? (campaign.bannerImage.startsWith('http') ? campaign.bannerImage : `${API_BASE_URL}${campaign.bannerImage}`)
    : null;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.banner}
      onPress={() => navigation.navigate('Promo', { campaign })}
    >
      {img
        ? <Image source={{ uri: img }} style={styles.thumb} />
        : <View style={[styles.thumb, styles.thumbPlaceholder]}><Ionicons name="medkit" size={20} color="#8B5CF6" /></View>}
      <View style={styles.textWrap}>
        <View style={styles.adRow}>
          <Text style={styles.adTag}>SPONSORED</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>{campaign.title}</Text>
        {!!campaign.bannerText && <Text style={styles.sub} numberOfLines={1}>{campaign.bannerText}</Text>}
      </View>
      <TouchableOpacity
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={(e) => { e.stopPropagation(); setDismissed(true); }}
        style={styles.close}
      >
        <Ionicons name="close" size={16} color="#94A3B8" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 10,
    marginHorizontal: 16, marginVertical: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  thumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#EDE9FE' },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  textWrap: { flex: 1, marginLeft: 10 },
  adRow: { flexDirection: 'row' },
  adTag: { fontSize: 9, fontWeight: '800', color: '#8B5CF6', letterSpacing: 0.5, backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  title: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 3 },
  sub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  close: { padding: 4, marginLeft: 6 },
});
