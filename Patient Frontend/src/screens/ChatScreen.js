import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';

export default function ChatScreen({ route, navigation }) {
  const { userId, userName } = route.params || {};
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  const flatListRef = useRef(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    fetchCurrentUserAndMessages();

    // Start polling every 2.5 seconds for new messages
    pollIntervalRef.current = setInterval(() => {
      fetchMessagesSilently();
    }, 2500);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [userId]);

  const fetchCurrentUserAndMessages = async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) {
        alert('Please login to chat.');
        navigation.goBack();
        return;
      }

      // Fetch current user info to distinguish sent vs received messages
      const profileRes = await axios.get(`${API_BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (profileRes.data?.success) {
        setCurrentUserId(profileRes.data.data.user?._id || profileRes.data.data._id);
      }

      // Fetch chat messages
      const res = await axios.get(`${API_BASE_URL}/api/chat/messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setMessages(res.data.data || []);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (error) {
      console.log('Error fetching chat init:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessagesSilently = async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) return;

      const res = await axios.get(`${API_BASE_URL}/api/chat/messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        const newMsgs = res.data.data || [];
        setMessages(prev => {
          const lastOld = prev[prev.length - 1]?._id;
          const lastNew = newMsgs[newMsgs.length - 1]?._id;
          if (lastOld !== lastNew || newMsgs.length !== prev.length) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            return newMsgs;
          }
          return prev;
        });
      }
    } catch (error) {
      console.log('Error polling messages:', error);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const token = await storage.getItem('userToken');
      if (!token) return;

      const res = await axios.post(`${API_BASE_URL}/api/chat/messages`, {
        receiverId: userId,
        message: textToSend
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        const sentMsg = res.data.data;
        setMessages(prev => [...prev, sentMsg]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (error) {
      console.log('Error sending message:', error);
      alert('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const renderMessageItem = ({ item }) => {
    const isSentByMe = item.senderId === currentUserId;
    const date = new Date(item.createdAt);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Determine status checkmark icon and color
    let statusIcon = 'checkmark';
    let iconColor = 'rgba(255, 255, 255, 0.5)';
    if (item.isRead) {
      statusIcon = 'checkmark-done';
      iconColor = '#60A5FA'; // Light blue for read
    } else if (item.isDelivered) {
      statusIcon = 'checkmark-done';
      iconColor = 'rgba(255, 255, 255, 0.7)'; // White/gray double check
    }

    return (
      <View style={[styles.messageRow, isSentByMe ? styles.messageRowSent : styles.messageRowReceived]}>
        <View style={[styles.messageBubble, isSentByMe ? styles.bubbleSent : styles.bubbleReceived]}>
          <Text style={[styles.messageText, isSentByMe ? styles.textSent : styles.textReceived]}>
            {item.message}
          </Text>
          <View style={styles.timeContainer}>
            <Text style={[styles.messageTime, isSentByMe ? styles.timeSent : styles.timeReceived]}>
              {timeStr}
            </Text>
            {isSentByMe && (
              <Ionicons 
                name={statusIcon} 
                size={14} 
                color={iconColor} 
                style={{ marginLeft: 4, marginTop: 1 }} 
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#0A1551" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{userName || 'Consultation'}</Text>
            <Text style={styles.headerSubtitle}>Real-time Consultation</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Messages list */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0052FF" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item, index) => item._id || index.toString()}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* Input row */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerName: { fontSize: 16, fontWeight: 'bold', color: '#0A1551' },
  headerSubtitle: { fontSize: 11, color: '#16A34A', fontWeight: '600', marginTop: 1 },
  listContent: { padding: 16, paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  messageRow: { flexDirection: 'row', marginBottom: 12, width: '100%' },
  messageRowSent: { justifyContent: 'flex-end' },
  messageRowReceived: { justifyContent: 'flex-start' },
  
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'relative',
  },
  bubbleSent: {
    backgroundColor: '#0052FF',
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  
  messageText: { fontSize: 14, lineHeight: 20 },
  textSent: { color: '#FFFFFF' },
  textReceived: { color: '#0F172A' },
  
  messageTime: { fontSize: 9 },
  timeSent: { color: 'rgba(255,255,255,0.7)' },
  timeReceived: { color: '#94A3B8' },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    color: '#0F172A',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0052FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#94A3B8',
  }
});
