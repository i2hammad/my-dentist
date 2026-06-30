import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import storage from '../config/storage';

export default function ImpersonationBanner() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const value = await storage.getItem('impersonating');
      if (mounted) {
        setActive(!!value);
      }
    };

    check();
    const interval = setInterval(check, 2000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleExit = async () => {
    await storage.removeItem('userToken');
    await storage.removeItem('impersonating');
    if (Platform.OS === 'web') {
      window.location.replace('/');
    }
    // native: no-op
  };

  if (!active) {
    return null;
  }

  return (
    <View
      style={{
        // In normal layout flow (NOT absolute) so it pushes the app down
        // instead of overlapping the header.
        width: '100%',
        backgroundColor: '#7C3AED',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        zIndex: 9999,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '600', marginRight: 12 }}>
        Admin view-as session
      </Text>
      <TouchableOpacity
        onPress={handleExit}
        style={{
          backgroundColor: 'rgba(255,255,255,0.2)',
          paddingVertical: 4,
          paddingHorizontal: 12,
          borderRadius: 6,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Exit</Text>
      </TouchableOpacity>
    </View>
  );
}
