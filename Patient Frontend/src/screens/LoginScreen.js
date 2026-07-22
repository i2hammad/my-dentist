import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import useResponsive from '../hooks/useResponsive';
import WebAuthLayout from '../components/WebAuthLayout';
import { webForm } from '../config/webLayout';

export default function LoginScreen({ route, navigation }) {
  const { isWide } = useResponsive();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);
  const [role, setRole] = useState(route.params?.role || 'patient'); // 'patient' or 'doctor'

  React.useEffect(() => {
    if (route.params?.role) {
      setRole(route.params.role);
    }
  }, [route.params?.role]);

  const handleForgotPassword = async () => {
    const target = (email || '').trim().toLowerCase();
    if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      return Alert.alert('Enter your email', 'Please type your registered email above first, then tap “Forgot Password”.');
    }
    try {
      await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email: target });
      Alert.alert('Password Sent', `A new password has been emailed to ${target}. Please check your inbox and log in.`);
    } catch (e) {
      Alert.alert('Password Sent', `If an account exists for ${target}, a new password has been emailed to it.`);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) return alert('Please enter both email and password.');
    
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!isEmailValid) {
      return alert('Please enter a valid email address.');
    }

    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, { 
        email: email.trim().toLowerCase(), 
        password 
      });
      const token = res.data.data.accessToken;
      await storage.setItem('userToken', token);
      // Role is whatever the account actually is — no role selection on login.
      const userRole = res.data.data.user.role || 'patient';

      // Fetch profile to check if it's new
      const profileRes = await axios.get(`${API_BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const profileData = profileRes.data?.data?.profile || {};
      const isNewUser = profileData.fullName === 'New Doctor' || profileData.fullName === 'New Patient';

      // Navigate based on role
      if (userRole === 'doctor') {
        if (isNewUser) {
          navigation.replace('DoctorRegister');
        } else {
          navigation.replace('DoctorTabs', { screen: 'DoctorHome' });
        }
      } else {
        // Patient Flow
        if (isNewUser) {
          navigation.replace('PatientSetup');
        } else {
          navigation.replace('MainTabs', { screen: 'Home' });
        }
      }
    } catch (error) {
      const errData = error.response?.data;
      const fieldErrors = errData?.errors?.map(e => `${e.field}: ${e.message}`).join('\n') || '';
      const msg = fieldErrors || errData?.message || error.message || 'Login failed';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  // Form body shared by mobile + web. On wide web it sits inside WebAuthLayout's
  // card; on mobile it keeps the original scroll layout with logo header.
  const formBody = (
    <View style={styles.form}>

          {/* Email */}
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your email address"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 6, marginLeft: 4 }}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          </View>

          {/* Remember Me & Forgot Password Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={styles.rememberMeRow} 
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
              </View>
              <Text style={styles.rememberMeText}>Remember Me</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity 
            style={[styles.loginButton, loading && { opacity: 0.7 }]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          {/* OR Divider */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          {/* Sign Up Button (Outlined style as shown in screens) */}
          <TouchableOpacity
            style={styles.signUpButton}
            onPress={() => navigation.navigate('Register', { role })}
          >
            <Text style={styles.signUpButtonText}>Sign Up</Text>
          </TouchableOpacity>

          {/* Continue as Guest — web visitors can browse without an account */}
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={styles.guestButton}
              onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Home' } }] })}
            >
              <Ionicons name="compass-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
              <Text style={styles.guestButtonText}>Continue as Guest</Text>
            </TouchableOpacity>
          )}

          {/* "or continue with" Divider */}
          <View style={styles.continueWithRow}>
            <View style={styles.orLine} />
            <Text style={styles.continueWithText}>or continue with</Text>
            <View style={styles.orLine} />
          </View>

          {/* Social Icons Row */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialIconContainer}>
              <Ionicons name="logo-google" size={24} color="#EA4335" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialIconContainer}>
              <Ionicons name="logo-apple" size={24} color="#000000" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialIconContainer}>
              <Ionicons name="logo-facebook" size={24} color="#1877F2" />
            </TouchableOpacity>
          </View>

          {/* Security Footer */}
          <View style={styles.footer}>
            <View style={styles.footerIconBg}>
              <Ionicons name="shield-checkmark" size={16} color="#0052FF" />
            </View>
            <Text style={styles.footerText}>Your data is encrypted and securely protected.</Text>
          </View>

        </View>
  );

  // ── Wide web: split-panel layout with a brand hero ──
  if (isWide) {
    return (
      <WebAuthLayout
        title={'Welcome back.\nLet’s get you in.'}
        subtitle="Log in to manage your appointments, chat with your dentist, and track your care."
        onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Home' })}
      >
        <Text style={styles.webHeading}>Welcome Back!</Text>
        <Text style={styles.webSubheading}>Login to continue to your account</Text>
        {formBody}
      </WebAuthLayout>
    );
  }

  // ── Mobile: original layout ──
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, webForm]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >

        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Home' })}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo-mark-sm.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Welcome Back!</Text>
          <Text style={styles.subtitle}>Login to continue to your account</Text>
        </View>

        {formBody}
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  webHeading: { fontSize: 26, fontWeight: '800', color: '#0A1551', marginBottom: 4 },
  webSubheading: { fontSize: 15, color: '#64748B', marginBottom: 20 },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 40,
    // Center vertically only on web/large screens; on mobile top-align so the
    // ScrollView can scroll a focused field above the keyboard.
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-start',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 10,
    marginTop: -10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0A1551', // Dark navy blue
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
  roleSwitcherContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  roleButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  roleButtonTextActive: {
    color: '#0052FF',
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    marginTop: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 6,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 24,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#0052FF',
    borderColor: '#0052FF',
  },
  rememberMeText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  forgotPassword: {},
  forgotPasswordText: {
    fontSize: 13,
    color: '#0052FF',
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#0052FF',
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0052FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
  },
  orLine: {
    height: 1,
    backgroundColor: '#E2E8F0',
    flex: 1,
  },
  orText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 16,
  },
  signUpButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0052FF',
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpButtonText: {
    color: '#0052FF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
  },
  guestButtonText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  continueWithRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  continueWithText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
    marginHorizontal: 16,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 28,
  },
  socialIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerIconBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  }
});
