import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import storage from '../config/storage';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    let isCancelled = false;

    const checkLoginStatus = async () => {
      // Create a delay promise for 3 seconds
      const delay = new Promise(resolve => setTimeout(resolve, 3000));
      
      const checkStatus = async () => {
        try {
          const token = await storage.getItem('userToken');
          if (!token) return { route: 'RoleSelection' };

          // Fetch user details from the backend to verify the token and get the role/profile
          const axios = require('axios');
          const API_BASE_URL = require('../config/api').default;
          
          const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.data?.success && res.data.data?.user) {
            const user = res.data.data.user;
            const profile = res.data.data.profile || {};
            const isNewUser = profile.fullName === 'New Doctor' || profile.fullName === 'New Patient';

            if (user.role === 'doctor') {
              if (isNewUser) {
                return { route: 'DoctorRegister' };
              } else {
                return { route: 'DoctorTabs', params: { screen: 'DoctorHome' } };
              }
            } else {
              if (isNewUser) {
                return { route: 'PatientSetup' };
              } else {
                return { route: 'MainTabs', params: { screen: 'Home' } };
              }
            }
          }

          // If token verification fails (expired/invalid), clean up and redirect to RoleSelection
          await storage.removeItem('userToken');
          return { route: 'RoleSelection' };
        } catch (err) {
          console.log('Error checking status in splash:', err);
          return { route: 'RoleSelection' }; // Default fallback on connection issue/error
        }
      };

      // Run delay and status check concurrently, but wait for BOTH to finish
      const [_, navData] = await Promise.all([delay, checkStatus()]);
      
      if (!isCancelled) {
        navigation.replace('Notice', { nextRoute: navData.route, nextParams: navData.params });
      }
    };

    checkLoginStatus();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleSkip = () => {
    navigation.replace('RoleSelection');
  };

  return (
    <View style={styles.container}>
      <Image 
        source={require('../../assets/dentist_logo_new.jpg')} 
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator size="small" color="#2563EB" style={styles.loader} />
      
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: Dimensions.get('window').width * 0.7,
    height: Dimensions.get('window').width * 0.7,
  },
  loader: {
    position: 'absolute',
    bottom: 100,
  },
  skipButton: {
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
  },
  skipText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  }
});
