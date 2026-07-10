import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Image, ActivityIndicator, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../../config/storage';
import API_BASE_URL from '../../config/api';
import imgUrl from '../../config/imgUrl';
import DoctorHeader from '../../components/DoctorHeader';

const isWeb = Platform.OS === 'web';

export default function DoctorInboxScreen({ navigation }) {
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
    const name = item.otherUser?.fullName || item.otherUser?.email || 'Patient';
    const photo = item.otherUser?.photo;
    const time = item.lastMessageAt
      ? new Date(item.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={[styles.convRow, hasUnread && styles.convRowUnread]}
        onPress={() => navigation.navigate('Chat', {
          userId: item.otherUser?._id,
          userName: name,
        })}
        activeOpacity={0.75}
      >
        <View style={[styles.avatarRing, hasUnread && { borderColor: '#0052FF' }]}>
          {photo ? (
            <Image source={{ uri: imgUrl(photo) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {hasUnread && <View style={styles.unreadDot} />}
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
            ) : (
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Native: shared branded doctor header. Web: simple title bar. */}
      <DoctorHeader
        title="Messages"
        subtitle={totalUnread > 0 ? `${totalUnread} unread message${totalUnread !== 1 ? 's' : ''}` : undefined}
        right={
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchConversations}>
            <Ionicons name="refresh-outline" size={22} color="#0052FF" />
          </TouchableOpacity>
        }
      />
      {isWeb && (
        <View style={[styles.header, styles.webBlock]}>
          <View>
            <Text style={styles.headerTitle}>Messages</Text>
            {totalUnread > 0 && (
              <Text style={styles.headerSub}>{totalUnread} unread message{totalUnread !== 1 ? 's' : ''}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchConversations}>
            <Ionicons name="refresh-outline" size={22} color="#0052FF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Search */}
      <View style={[styles.searchWrap, isWeb && styles.webBlock]}>
        <Ionicons name="search-outline" size={18} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search patients..."
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0052FF" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="chatbubbles-outline" size={40} color="#0052FF" />
          </View>
          <Text style={styles.emptyTitle}>{search ? 'No results found' : 'No conversations yet'}</Text>
          <Text style={styles.emptySubtitle}>
            {search ? 'Try a different name' : 'Patients who message you will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => item.otherUser?._id?.toString() || item._id?.toString() || String(index)}
          renderItem={renderItem}
          contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }, isWeb && styles.webBlock]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  // Web: center + cap content so the search bar / conversation rows aren't stretched edge-to-edge.
  webBlock: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0A1551' },
  headerSub: { fontSize: 12, color: '#0052FF', marginTop: 2 },
  refreshBtn: { padding: 6 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12, marginHorizontal: 16, marginTop: 12, marginBottom: 6,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60, paddingHorizontal: 30 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#EFF4FF', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#0A1551' },
  emptySubtitle: { fontSize: 13.5, color: '#94A3B8', marginTop: 6, textAlign: 'center', fontWeight: '500', lineHeight: 20 },

  // Conversation card
  convRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#EEF2F7',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 1,
  },
  convRowUnread: { backgroundColor: '#F5F8FF', borderColor: '#DBEAFE' },
  avatarRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#EEF2F7', justifyContent: 'center', alignItems: 'center', marginRight: 12, position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 19, fontWeight: '800', color: '#0052FF' },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#0052FF', borderWidth: 2.5, borderColor: '#FFFFFF' },
  convBody: { flex: 1 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  convName: { fontSize: 15, color: '#0F172A', fontWeight: '700', flex: 1, marginRight: 8 },
  convNameBold: { fontWeight: '800', color: '#0A1551' },
  convTime: { fontSize: 11.5, color: '#94A3B8', fontWeight: '600' },
  convTimeBold: { color: '#0052FF', fontWeight: '800' },
  convBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMsg: { fontSize: 13, color: '#94A3B8', flex: 1, marginRight: 8 },
  lastMsgBold: { color: '#334155', fontWeight: '600' },
  badge: {
    backgroundColor: '#0052FF', borderRadius: 11,
    minWidth: 22, height: 22, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
});
