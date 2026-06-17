import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import storage from '../config/storage';
import { useNotifications } from '../context/NotificationContext';
import { AnimatedHeader, PressableScale } from '../components/Animated';
import { SkeletonRowList } from '../components/Skeleton';

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const { fetchUnreadCount } = useNotifications();

  useEffect(() => {
    fetchNotifications();
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) return;
      const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setUserRole(res.data.data.user?.role || res.data.data.role);
      }
    } catch (e) {
      console.log('Error fetching user role in NotificationsScreen:', e);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = await storage.getItem('userToken');
      if (!token) return;
      const res = await axios.get(`${API_BASE_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setNotifications(res.data.data || []);
    } catch (e) {
      console.log('Error fetching notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const getSenderId = (item) => {
    if (item.data?.senderId) return String(item.data.senderId);
    if (item.relatedId) {
      return typeof item.relatedId === 'object'
        ? String(item.relatedId._id || item.relatedId)
        : String(item.relatedId);
    }
    return null;
  };

  const getSenderName = (item) => {
    if (item.data?.senderName) return item.data.senderName;
    if (item.title?.includes('New Message from '))
      return item.title.replace('New Message from ', '').trim();
    return item.title || 'User';
  };

  // Mark read in background — never blocks navigation
  const markRead = (id) => {
    setNotifications(prev =>
      prev.map(n => (n._id === id ? { ...n, isRead: true } : n))
    );
    storage.getItem('userToken').then(token => {
      if (!token) return;
      axios
        .put(`${API_BASE_URL}/api/notifications/${id}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then(() => fetchUnreadCount())
        .catch(() => {});
    });
  };

  const openChat = (item) => {
    if (!item.isRead) markRead(item._id);
    const senderId = getSenderId(item);
    const senderName = getSenderName(item);
    if (senderId) {
      navigation.navigate('Chat', { userId: senderId, userName: senderName });
    }
  };

  const handlePress = (item) => {
    if (!item.isRead) markRead(item._id);

    const isDoctor = userRole === 'doctor';

    if (item.type === 'chat') {
      openChat(item);
    } else if (item.type === 'appointment') {
      if (isDoctor) {
        navigation.navigate('DoctorTabs', { screen: 'Appointments' });
      } else {
        navigation.navigate('Appointments');
      }
    } else if (item.type === 'bill' || item.type === 'payment') {
      if (isDoctor) {
        navigation.navigate('DoctorTabs', { screen: 'DoctorHome', params: { initialTab: 'bills' } });
      } else {
        const doctorId = item.data?.doctorId || item.data?.doctorUserId || null;
        if (doctorId) {
          navigation.navigate('DoctorProfile', { doctorId, initialTab: 'Bills & Bill History' });
        }
      }
    } else if (item.type === 'review') {
      if (isDoctor) {
        navigation.navigate('DoctorTabs', { screen: 'DoctorHome', params: { initialTab: 'reviews' } });
      } else {
        const doctorId = item.data?.doctorId || item.data?.doctorUserId || null;
        if (doctorId) {
          navigation.navigate('DoctorProfile', { doctorId, initialTab: 'Reviews' });
        }
      }
    } else if (item.type === 'reward') {
      if (isDoctor) {
        navigation.navigate('DoctorTabs', { screen: 'DoctorHome', params: { initialTab: 'rewards' } });
      }
    }
  };

  // Returns initials from a name string
  const getInitials = (name = '') =>
    name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0] || '')
      .join('')
      .toUpperCase() || '?';

  const getIconInfo = (type) => {
    switch (type) {
      case 'appointment': return { name: 'calendar',      color: '#0052FF', bg: '#EFF6FF' };
      case 'bill':
      case 'payment':     return { name: 'wallet',        color: '#16A34A', bg: '#F0FDF4' };
      case 'review':      return { name: 'star',          color: '#D97706', bg: '#FFFBEB' };
      default:            return { name: 'notifications', color: '#0052FF', bg: '#EFF6FF' };
    }
  };

  const renderNotification = ({ item }) => {
    const isChat = item.type === 'chat';
    const senderId = getSenderId(item);
    const senderName = getSenderName(item);
    const senderPhoto = item.data?.senderPhoto || null;

    const timeStr = new Date(item.createdAt).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <TouchableOpacity
        style={[styles.card, !item.isRead && styles.cardUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.8}
      >
        {/* Avatar / Icon */}
        <View style={styles.avatarWrap}>
          {isChat ? (
            senderPhoto ? (
              <Image source={{ uri: senderPhoto }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarInitials}>
                <Text style={styles.avatarInitialsText}>{getInitials(senderName)}</Text>
              </View>
            )
          ) : (
            <View style={[styles.avatarIcon, { backgroundColor: getIconInfo(item.type).bg }]}>
              <Ionicons
                name={getIconInfo(item.type).name}
                size={22}
                color={getIconInfo(item.type).color}
              />
            </View>
          )}
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* Top row: name + time */}
          <View style={styles.topRow}>
            <Text style={[styles.senderName, !item.isRead && styles.senderNameUnread]} numberOfLines={1}>
              {isChat ? senderName : item.title}
            </Text>
            <Text style={styles.time}>{timeStr}</Text>
          </View>

          {/* Sub-title for chat: show "New Message" label */}
          {isChat && (
            <Text style={styles.chatLabel}>New Message</Text>
          )}

          {/* Message preview */}
          <Text style={[styles.preview, !item.isRead && styles.previewUnread]} numberOfLines={2}>
            {item.message}
          </Text>

          {/* Open Chat button — chat notifications */}
          {isChat && senderId && (
            <TouchableOpacity
              style={styles.openChatBtn}
              onPress={() => openChat(item)}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble" size={13} color="#FFF" style={{ marginRight: 5 }} />
              <Text style={styles.openChatBtnText}>Open Chat</Text>
            </TouchableOpacity>
          )}
          {/* View Bill button — bill/payment notifications */}
          {(item.type === 'bill' || item.type === 'payment') && (
            <TouchableOpacity
              style={[styles.openChatBtn, { backgroundColor: '#16A34A' }]}
              onPress={() => handlePress(item)}
              activeOpacity={0.85}
            >
              <Ionicons name="document-text" size={13} color="#FFF" style={{ marginRight: 5 }} />
              <Text style={styles.openChatBtnText}>View Bill</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {/* Header */}
      <AnimatedHeader style={styles.header}>
        <PressableScale
          style={styles.backBtn}
          hitSlop={10}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : null)}
        >
          <Ionicons name="arrow-back" size={24} color="#0A1551" />
        </PressableScale>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 32 }} />
      </AnimatedHeader>

      {loading ? (
        <SkeletonRowList count={8} />
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item._id}
          renderItem={renderNotification}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 50;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0A1551' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 16, color: '#64748B', marginTop: 16 },

  list: { padding: 16, paddingBottom: 40 },

  card: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardUnread: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },

  /* Avatar column */
  avatarWrap: { marginRight: 12, position: 'relative' },
  avatarImg: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2, borderColor: '#BFDBFE',
  },
  avatarInitials: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#0052FF', justifyContent: 'center', alignItems: 'center',
  },
  avatarInitialsText: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
  avatarIcon: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center', alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#0052FF', borderWidth: 2, borderColor: '#EFF6FF',
  },

  /* Body column */
  body: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  senderName: { fontSize: 14, fontWeight: '600', color: '#0A1551', flex: 1, marginRight: 8 },
  senderNameUnread: { fontWeight: 'bold', color: '#0052FF' },
  time: { fontSize: 11, color: '#94A3B8', flexShrink: 0 },

  chatLabel: { fontSize: 11, color: '#0052FF', fontWeight: '600', marginBottom: 3 },

  preview: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 8 },
  previewUnread: { color: '#334155' },

  /* Open Chat button */
  openChatBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: '#0052FF',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20,
    marginTop: 2,
  },
  openChatBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});
