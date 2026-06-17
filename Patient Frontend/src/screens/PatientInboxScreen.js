import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Image, ActivityIndicator, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import imgUrl from '../config/imgUrl';
import { AnimatedHeader, PressableScale } from '../components/Animated';
import { SkeletonRowList } from '../components/Skeleton';
import webContent from '../config/webLayout';

export default function PatientInboxScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    pollRef.current = setInterval(fetchConversationsSilently, 5000);

    const unsubscribe = navigation.addListener('focus', () => {
      fetchConversations();
    });

    return () => {
      clearInterval(pollRef.current);
      unsubscribe();
    };
  }, [navigation]);

  useEffect(() => {
    const total = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0);
    navigation.setOptions({
      tabBarBadge: total > 0 ? (total > 99 ? '99+' : total) : undefined,
    });
  }, [conversations, navigation]);

  const fetchConversations = async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) return;
      const res = await axios.get(`${API_BASE_URL}/api/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setConversations(res.data.data || []);
    } catch (e) {
      console.log('Error fetching conversations:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversationsSilently = async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) return;
      const res = await axios.get(`${API_BASE_URL}/api/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setConversations(res.data.data || []);
    } catch (_) {}
  };

  const filtered = conversations.filter(c => {
    const name = c.otherUser?.fullName || c.otherUser?.email || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0);

  const renderItem = ({ item }) => {
    const name = item.otherUser?.fullName || item.otherUser?.email || 'Doctor';
    const photo = item.otherUser?.photo;
    const time = item.lastMessageAt
      ? new Date(item.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={styles.convRow}
        onPress={() => navigation.navigate('Chat', {
          userId: item.otherUser?._id,
          userName: name,
        })}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          {photo ? (
            <Image source={{ uri: imgUrl(photo) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {hasUnread && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.convBody}>
          <View style={styles.convTopRow}>
            <Text style={[styles.convName, hasUnread && styles.convNameBold]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.convTime, hasUnread && styles.convTimeBold]}>{time}</Text>
          </View>
          <View style={styles.convBottomRow}>
            <Text style={[styles.lastMsg, hasUnread && styles.lastMsgBold]} numberOfLines={1}>
              {item.lastMessage || 'Start a conversation'}
            </Text>
            {hasUnread ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AnimatedHeader style={[styles.header, webContent]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PressableScale style={{ marginRight: 12, padding: 4 }} hitSlop={8} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#0A1551" />
          </PressableScale>
          <View>
            <Text style={styles.headerTitle}>Messages</Text>
            {totalUnread > 0 && (
              <Text style={styles.headerSub}>{totalUnread} unread message{totalUnread !== 1 ? 's' : ''}</Text>
            )}
          </View>
        </View>
        <PressableScale style={styles.refreshBtn} onPress={fetchConversations}>
          <Ionicons name="refresh-outline" size={22} color="#0052FF" />
        </PressableScale>
      </AnimatedHeader>

      <View style={[styles.searchWrap, webContent]}>
        <Ionicons name="search-outline" size={18} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search doctors..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <SkeletonRowList count={7} />
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={56} color="#E2E8F0" />
          <Text style={styles.emptyTitle}>{search ? 'No results found' : 'No conversations yet'}</Text>
          <Text style={styles.emptySubtitle}>
            {search ? 'Try a different name' : 'Doctors you message will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => item.otherUser?._id?.toString() || item._id?.toString() || String(index)}
          renderItem={renderItem}
          contentContainerStyle={[{ paddingBottom: 20 }, webContent]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0A1551' },
  headerSub: { fontSize: 12, color: '#0052FF', marginTop: 2 },
  refreshBtn: { padding: 6 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 12, marginHorizontal: 16, marginVertical: 10,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#0A1551', marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },

  convRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarFallback: { backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 20, fontWeight: 'bold', color: '#0052FF' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  convBody: { flex: 1 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  convName: { fontSize: 14, color: '#0F172A', flex: 1, marginRight: 8 },
  convNameBold: { fontWeight: '700' },
  convTime: { fontSize: 11, color: '#94A3B8' },
  convTimeBold: { color: '#0052FF', fontWeight: '600' },
  convBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMsg: { fontSize: 12, color: '#94A3B8', flex: 1, marginRight: 8 },
  lastMsgBold: { color: '#0F172A', fontWeight: '600' },
  badge: {
    backgroundColor: '#0052FF', borderRadius: 10,
    minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  separator: { height: 1, backgroundColor: '#F1F5F9', marginLeft: 78 },
});
