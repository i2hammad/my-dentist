import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';
import { ctaLabel } from '../utils/promo';

const COLORS = ['#7C3AED', '#0052FF', '#0D9488', '#D97706', '#DC2626'];
const isWeb = Platform.OS === 'web';

// Reusable patient marketing banner. Drop it near the top of any patient
// screen's scroll content:  <PromoCard />
// Self-contained: fetches active patient campaigns, rotates, full-width card.
export default function PromoCard({ style }) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [campaigns, setCampaigns] = useState([]);
  const [rotationInterval, setRotationInterval] = useState(10);
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef(null);

  const cardW = Math.min(isWeb ? 1100 : width, 1100) - 32;

  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getItem('userToken');
        if (!token) return;
        const res = await axios.get(`${API_BASE_URL}/api/campaigns/active-patient`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data?.success) {
          const d = res.data.data;
          const list = Array.isArray(d) ? d : (d?.campaigns || (d ? [d] : []));
          setCampaigns(list);
          setRotationInterval(d?.rotationInterval ?? 10);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    if (campaigns.length <= 1) return;
    const timer = setInterval(() => {
      setIdx(prev => {
        const next = (prev + 1) % campaigns.length;
        try { scrollRef.current?.scrollTo({ x: next * (cardW + 16), animated: true }); } catch {}
        return next;
      });
    }, rotationInterval * 1000);
    return () => clearInterval(timer);
  }, [campaigns, rotationInterval, cardW]);

  if (!campaigns.length) return null;

  return (
    <View style={[{ marginTop: 14, marginBottom: 4 }, style]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        snapToInterval={cardW + 16}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        onMomentumScrollEnd={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / (cardW + 16)))}
      >
        {campaigns.map((c, i) => {
          const bg = COLORS[i % COLORS.length];
          // Banner/card uses bannerImage; detailImage is for the detail page only.
          const img = c.bannerImage || c.detailImage;
          const imgUri = img ? imgUrl(img) : null;
          return (
            <TouchableOpacity
              key={c._id || i}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('Promo', { campaign: c })}
              style={{
                width: cardW, height: 118, marginRight: campaigns.length > 1 ? 16 : 0,
                backgroundColor: bg, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end',
                shadowColor: bg, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
              }}
            >
              {imgUri && <Image source={{ uri: imgUri }} style={{ ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' }} resizeMode="cover" />}
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: imgUri ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.06)' }} />
              {!imgUri && <Ionicons name="megaphone" size={88} color="rgba(255,255,255,0.12)" style={{ position: 'absolute', top: -8, right: -6 }} />}
              <View style={{ padding: 14 }}>
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 17, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 4 }} numberOfLines={1}>
                  {c.title || 'Special Offer'}
                </Text>
                {!!(c.bannerText || c.body) && (
                  <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 12.5, marginTop: 3, textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 3 }} numberOfLines={1}>
                    {c.bannerText || c.body}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                  <Text style={{ color: bg, fontWeight: '800', fontSize: 12 }}>{ctaLabel(c.ctaLabel, 'View Offer')}</Text>
                  <Ionicons name="arrow-forward" size={13} color={bg} style={{ marginLeft: 4 }} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {campaigns.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 }}>
          {campaigns.map((_, i) => (
            <View key={i} style={{ width: i === idx ? 16 : 6, height: 5, borderRadius: 3, backgroundColor: i === idx ? '#0052FF' : '#CBD5E1' }} />
          ))}
        </View>
      )}
    </View>
  );
}
