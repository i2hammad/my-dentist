import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';

export default function PromoBanner() {
  const navigation = useNavigation();
  const [campaigns, setCampaigns] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rotationInterval, setRotationInterval] = useState(10);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await storage.getItem('userToken');
        if (!token) return;
        const res = await axios.get(`${API_BASE_URL}/api/campaigns/active-all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.data?.success && res.data.data) {
          const { campaigns: list, rotationInterval: interval } = res.data.data;
          if (list?.length) {
            setCampaigns(list);
            setRotationInterval(interval ?? 10);
          }
        }
      } catch (e) {
        // silently ignore — banner is non-critical
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (campaigns.length <= 1) return;
    const timer = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setCurrentIndex(prev => (prev + 1) % campaigns.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, rotationInterval * 1000);
    return () => clearInterval(timer);
  }, [campaigns, rotationInterval]);

  if (!campaigns.length) return null;

  const campaign = campaigns[currentIndex];
  const img = campaign.bannerImage
    ? (campaign.bannerImage.startsWith('http') ? campaign.bannerImage : `${API_BASE_URL}${campaign.bannerImage}`)
    : null;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.banner}
        onPress={() => navigation.navigate('Promo', { campaign })}
      >
        <View style={styles.contentRow}>
          {img
            ? <Image source={{ uri: img }} style={styles.thumb} />
            : <View style={[styles.thumb, styles.thumbPlaceholder]}><Ionicons name="medkit" size={20} color="#8B5CF6" /></View>}
          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>{campaign.title}</Text>
            {!!campaign.bannerText && <Text style={styles.sub} numberOfLines={1}>{campaign.bannerText}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" style={{ marginLeft: 6 }} />
        </View>
        {campaigns.length > 1 && (
          <View style={styles.dotsRow}>
            {campaigns.map((_, i) => (
              <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
            ))}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 10,
    marginHorizontal: 16, marginVertical: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  adRow: { flexDirection: 'row', marginBottom: 4 },
  adTag: { fontSize: 9, fontWeight: '800', color: '#8B5CF6', letterSpacing: 0.5, backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  contentRow: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#EDE9FE' },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  textWrap: { flex: 1, marginLeft: 10 },
  title: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1' },
  dotActive: { backgroundColor: '#8B5CF6', width: 16 },
});
