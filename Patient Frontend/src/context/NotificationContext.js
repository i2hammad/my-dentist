import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import storage from '../config/storage';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) { setUnreadCount(0); return; }
      const res = await axios.get(`${API_BASE_URL}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setUnreadCount(res.data.data?.count ?? 0);
      }
    } catch (error) {
      // Ignore polling errors silently
    }
  };

  const fetchUnreadChatCount = async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) { setUnreadChatCount(0); return; }
      const res = await axios.get(`${API_BASE_URL}/api/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        const total = res.data.data.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
        setUnreadChatCount(total);
      }
    } catch (error) {
      // Ignore polling errors silently
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    fetchUnreadChatCount();
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchUnreadChatCount();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <NotificationContext.Provider value={{ unreadCount, fetchUnreadCount, unreadChatCount }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
