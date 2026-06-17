import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import storage from '../config/storage';
import useResponsive from '../hooks/useResponsive';
import WebAuthLayout from '../components/WebAuthLayout';
import RoleBadge from '../components/RoleBadge';

export default function RegisterScreen({ route, navigation }) {
  const { isWide } = useResponsive();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(route.params?.role || 'patient'); // 'patient' or 'doctor'

  React.useEffect(() => {
    if (route.params?.role) {
      setRole(route.params.role);
    }
  }, [route.params?.role]);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isLengthValid = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]/.test(password);
  const isPasswordValid = isLengthValid && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;

  const handleRegister = async () => {
    if (!email.trim() || !password || !confirmPassword) {
      return alert('Please fill in all fields.');
    }
    
    if (!isEmailValid) {
      return alert('Please enter a valid email address.');
    }

    if (!isPasswordValid) {
      const missing = [];
      if (!isLengthValid) missing.push('• Minimum 8 characters');
      if (!hasUppercase) missing.push('• At least one uppercase letter (A-Z)');
      if (!hasLowercase) missing.push('• At least one lowercase letter (a-z)');
      if (!hasNumber) missing.push('• At least one number (0-9)');
      if (!hasSpecialChar) missing.push('• At least one special character (e.g. !@#$%^&*)');

      return alert('Password does not meet the security requirements:\n\n' + missing.join('\n'));
    }

    if (password !== confirmPassword) {
      return alert('Passwords do not match.');
    }

    if (!agreed) {
      return alert('Please agree to the Terms & Conditions and Privacy Policy.');
    }

    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE_URL}/api/auth/register`, { 
        email: email.trim().toLowerCase(), 
        password, 
        role 
      });
      
      alert('Registration Successful!');
      
      if (res.data?.success && res.data.data?.accessToken) {
        const token = res.data.data.accessToken;
        await storage.setItem('userToken', token);
        
        if (role === 'doctor') {
          navigation.replace('DoctorRegister');
        } else {
          navigation.replace('PatientSetup');
        }
      } else {
        navigation.navigate('Login');
      }
    } catch (error) {
      const errData = error.response?.data;
      const fieldErrors = errData?.errors?.map(e => `${e.field}: ${e.message}`).join('\n') || '';
      const msg = fieldErrors || errData?.message || 'Registration failed';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const formBody = (
    <View style={styles.form}>

          {/* Which role is being registered */}
          <RoleBadge role={role} onSwitch={() => navigation.navigate('RoleSelection')} />
          
          {/* Email Address */}
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Enter your email address" 
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Create a password" 
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color="#94A3B8" 
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Confirm your password" 
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons 
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color="#94A3B8" 
              />
            </TouchableOpacity>
          </View>

          {/* Terms Checkbox */}
          <TouchableOpacity 
            style={styles.checkboxRow} 
            onPress={() => setAgreed(!agreed)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
            <Text style={styles.checkboxLabel}>
              I agree to the <Text style={styles.linkSpan}>Terms & Conditions</Text> and <Text style={styles.linkSpan}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {/* Sign Up Button */}
          <TouchableOpacity 
            style={[styles.button, loading && { opacity: 0.7 }]} 
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          {/* OR Separator */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          {/* Footer Link */}
          <TouchableOpacity onPress={() => navigation.navigate('Login', { role })}>
            <Text style={styles.footerLinkText}>
              Already have an account? <Text style={styles.footerLinkTextSpan}>Login</Text>
            </Text>
          </TouchableOpacity>

        </View>
  );

  // ── Wide web: split-panel layout with a brand hero ──
  if (isWide) {
    return (
      <WebAuthLayout
        title={'Create your account.\nStart in seconds.'}
        subtitle="Sign up to book verified dentists, chat with your doctor, and manage your dental care."
        onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login', { role })}
      >
        <Text style={styles.webHeading}>Create Your Account</Text>
        <Text style={styles.webSubheading}>Sign up to get started</Text>
        {formBody}
      </WebAuthLayout>
    );
  }

  // ── Mobile: original layout ──
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        {/* Header Text */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Your Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0A1551', // Dark navy blue from walkthrough
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#0052FF', // Royal blue
    borderColor: '#0052FF',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
    lineHeight: 18,
  },
  linkSpan: {
    color: '#0052FF',
    fontWeight: '600',
  },
  button: {
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
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
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
  footerLinkText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  footerLinkTextSpan: {
    color: '#0052FF',
    fontWeight: 'bold',
  }
});
