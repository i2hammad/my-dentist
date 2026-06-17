import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput, ActivityIndicator, ScrollView, Image, KeyboardAvoidingView, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import { useIsFocused } from '@react-navigation/native';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import { detectCoords } from '../utils/geo';
import { openWhatsApp, openSupportEmail, SUPPORT_WHATSAPP, SUPPORT_EMAIL } from '../utils/support';

export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isFocused = useIsFocused();

  // Form states
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [detectingLoc, setDetectingLoc] = useState(false);
  const [gender, setGender] = useState('Select your gender');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [profileExists, setProfileExists] = useState(false);
  const [referral, setReferral] = useState(null);
  
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const cities = ['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Peshawar'];

  useEffect(() => {
    if (isFocused) {
      fetchUserProfile();
      fetchReferral();
    }
  }, [isFocused]);

  const fetchReferral = async () => {
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.get(`${API_BASE_URL}/api/users/referral`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) setReferral(res.data.data);
    } catch (e) { /* non-critical */ }
  };

  const shareReferral = async () => {
    let data = referral;
    if (!data) {
      try {
        const token = await storage.getItem('userToken');
        const res = await axios.get(`${API_BASE_URL}/api/users/referral`, { headers: { Authorization: `Bearer ${token}` } });
        data = res.data?.data; setReferral(data);
      } catch (e) { return Alert.alert('Error', 'Could not load your referral code. Please try again.'); }
    }
    const link = data.webLink || data.appLink;
    Share.share({
      message: `Join me on My Dentist PK! Use my referral code ${data.code} when you sign up — we both get 100 reward points after your first treatment. ${link}`,
    });
  };

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const token = await storage.getItem('userToken');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        if (res.data.data.profile) {
          setProfileExists(true);
        }
        const p = res.data.data.profile || {};
        // Initialize form fields
        setFullName(p.fullName || '');
        setMobileNumber(p.mobileNumber || '');
        setCity(p.city || '');
        setLocation(p.address || '');
        if (p.profileImage) {
          setProfileImage(p.profileImage.startsWith('http') || p.profileImage.startsWith('file:') || p.profileImage.startsWith('content:') ? p.profileImage : `${API_BASE_URL}${p.profileImage}`);
        }
        if (p.gender) {
          setGender(p.gender.charAt(0).toUpperCase() + p.gender.slice(1));
        }
        setDateOfBirth(p.dateOfBirth ? formatDateForInput(p.dateOfBirth) : '');
      }
    } catch (error) {
      console.log('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const uploadAvatar = async (localUri, token) => {
    try {
      const formData = new FormData();
      let uri = localUri;
      if (Platform.OS === 'android' && !uri.startsWith('file://')) {
        uri = `file://${uri}`;
      }
      const name = uri.split('/').pop() || 'avatar.jpg';
      const ext = uri.split('.').pop().toLowerCase();
      const type = ext === 'png' ? 'image/png' : 'image/jpeg';

      formData.append('avatar', {
        uri,
        name,
        type,
      });

      const res = await fetch(`${API_BASE_URL}/api/users/upload-avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (data?.success) {
        return data.data.profileImage;
      }
      throw new Error('Avatar upload failed');
    } catch (err) {
      console.error('Avatar upload error:', err);
      throw err;
    }
  };

  const handleSaveChanges = async () => {
    if (!fullName.trim() || !mobileNumber.trim() || !city.trim()) {
      return alert('Please fill all required fields');
    }

    try {
      setSaving(true);
      const token = await storage.getItem('userToken');
      
      let genderVal = 'male';
      if (gender.toLowerCase() === 'female') genderVal = 'female';
      else if (gender.toLowerCase() === 'other') genderVal = 'other';

      const payload = {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        city: city.trim(),
        address: location.trim(),
        gender: genderVal,
      };

      if (dateOfBirth) {
         payload.dateOfBirth = new Date(dateOfBirth).toISOString();
      }

      // Check if image is local and needs upload
      const isLocalImage = profileImage && (profileImage.startsWith('file://') || profileImage.startsWith('content://') || profileImage.startsWith('ph://'));

      const method = profileExists ? 'put' : 'post';
      const res = await axios[method](`${API_BASE_URL}/api/users/patient-profile`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        setProfileExists(true);
        
        if (isLocalImage) {
          try {
            await uploadAvatar(profileImage, token);
          } catch (uploadErr) {
            console.log('Error uploading avatar:', uploadErr);
            alert('Profile saved, but avatar upload failed. Please try another image.');
          }
        }
        
        alert('Profile saved successfully!');
        // Navigate to Search (Nearby Doctors) to match the requested sequence
        navigation.navigate('Search');
      } else {
        alert(res.data?.message || 'Failed to save profile');
      }
    } catch (error) {
      console.log('Error saving profile:', error.response?.data || error.message);
      alert(error.response?.data?.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateOfBirth(selectedDate.toISOString().split('T')[0]);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Error picking image:', error);
      alert('Failed to pick an image');
    }
  };

  const handleLogout = async () => {
    await storage.removeItem('userToken');
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Blue Header */}
      <View style={styles.blueHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profileExists ? 'Edit Profile' : 'Complete Profile'}</Text>
        <TouchableOpacity onPress={handleLogout} style={{ padding: 4 }}>
          <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.cardContainer}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Profile Avatar */}
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarContainer}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={{ width: '100%', height: '100%', borderRadius: 40 }} />
                ) : (
                  <Ionicons name="person" size={40} color="#2563EB" />
                )}
              </View>
              <TouchableOpacity style={styles.addPhotoBadge} onPress={handlePickImage}>
                <Ionicons name="add" size={16} color="#2563EB" />
              </TouchableOpacity>
            </View>

            <Text style={styles.pageTitle}>Create Patient Profile</Text>
            <Text style={styles.pageSubtitle}>Let's create your profile to get started</Text>

            <View style={styles.formCard}>
              {/* Section Header */}
              <View style={styles.sectionHeader}>
                <View style={styles.iconBg}>
                  <Ionicons name="person-outline" size={20} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Personal Information</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Ionicons name="lock-closed" size={12} color="#64748B" />
                    <Text style={styles.sectionSubtitle}> (Private & Secure)</Text>
                  </View>
                </View>
              </View>

              {/* Form Fields */}
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <Text style={styles.label}>Mobile Number</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  keyboardType="phone-pad"
                  placeholder="Enter your mobile number"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <Text style={styles.label}>Date of Birth</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="calendar-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                {Platform.OS === 'web' ? (
                  React.createElement('input', {
                    type: 'date',
                    value: dateOfBirth,
                    onChange: (e) => setDateOfBirth(e.target.value),
                    style: {
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      color: '#0F172A',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      padding: 0
                    }
                  })
                ) : (
                  <TouchableOpacity 
                    style={{ flex: 1, justifyContent: 'center' }} 
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={{ color: dateOfBirth ? '#0F172A' : '#94A3B8', fontSize: 14 }}>
                      {dateOfBirth || 'YYYY-MM-DD'}
                    </Text>
                  </TouchableOpacity>
                )}
                <Ionicons name="calendar" size={20} color="#94A3B8" />
              </View>

              {showDatePicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={dateOfBirth ? new Date(dateOfBirth) : new Date()}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}

              <Text style={styles.label}>Gender</Text>
              <TouchableOpacity 
                style={styles.inputContainer} 
                onPress={() => setShowGenderDropdown(!showGenderDropdown)}
                activeOpacity={0.8}
              >
                <Ionicons name="people-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <Text style={[styles.input, { color: gender === 'Select your gender' ? '#94A3B8' : '#0F172A', paddingTop: Platform.OS==='ios'?14:0 }]}>
                  {gender}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#94A3B8" />
              </TouchableOpacity>
              
              {showGenderDropdown && (
                <View style={styles.dropdownMenu}>
                  {['Male', 'Female', 'Other'].map((g) => (
                    <TouchableOpacity 
                      key={g} 
                      style={styles.dropdownItem}
                      onPress={() => { setGender(g); setShowGenderDropdown(false); }}
                    >
                      <Text style={styles.dropdownItemText}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>City</Text>
              <TouchableOpacity 
                style={styles.inputContainer}
                onPress={() => setShowCityDropdown(!showCityDropdown)}
              >
                <Ionicons name="location-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <Text style={[styles.input, { color: city ? '#0F172A' : '#94A3B8' }]}>
                  {city || 'Select your city'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#94A3B8" />
              </TouchableOpacity>

              {showCityDropdown && (
                <View style={styles.dropdownContainer}>
                  {cities.map((c) => (
                    <TouchableOpacity 
                      key={c} 
                      style={styles.dropdownItem} 
                      onPress={() => { setCity(c); setShowCityDropdown(false); }}
                    >
                      <Text style={styles.dropdownText}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Location / Address</Text>
              <View style={[styles.inputContainer, { paddingRight: 6 }]}>
                <Ionicons name="location-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Add your precise location"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity style={styles.preciseLocationBtn} onPress={() => detectCoords(setLocation, setDetectingLoc)} disabled={detectingLoc}>
                  {detectingLoc ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="locate" size={16} color="#FFFFFF" />}
                  <Text style={styles.preciseLocationTxt}>{detectingLoc ? 'Locating…' : 'Precise Location'}</Text>
                </TouchableOpacity>
              </View>

            </View>

            {/* Refer a Friend */}
            <View style={styles.referCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="gift" size={20} color="#FFFFFF" />
                <Text style={styles.referTitle}>Refer a Friend</Text>
              </View>
              <Text style={styles.referDesc}>You and your friend each get 100 points when they join and complete their first treatment.</Text>
              {referral ? (
                <View style={styles.referCodeBox}>
                  <Text style={styles.referCodeLabel}>Your code</Text>
                  <Text style={styles.referCode}>{referral.code}</Text>
                  <Text style={styles.referStats}>{referral.referredCount} referred · {referral.referralPointsEarned} pts earned</Text>
                </View>
              ) : null}
              <TouchableOpacity style={styles.referBtn} onPress={shareReferral}>
                <Ionicons name="share-social-outline" size={18} color="#0052FF" />
                <Text style={styles.referBtnText}>Share Invite Link</Text>
              </TouchableOpacity>
            </View>

            {/* Support & Help */}
            <View style={styles.supportCard}>
              <Text style={styles.supportTitle}>Support & Help</Text>
              <TouchableOpacity style={styles.supportRow} onPress={() => openWhatsApp('Hello, I am a patient on My Dentist PK and need support.')}>
                <View style={[styles.supportIcon, { backgroundColor: '#DCFCE7' }]}><Ionicons name="logo-whatsapp" size={22} color="#25D366" /></View>
                <View style={{ flex: 1 }}><Text style={styles.supportLabel}>WhatsApp Support</Text><Text style={styles.supportValue}>{SUPPORT_WHATSAPP}</Text></View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.supportRow} onPress={() => openSupportEmail('My Dentist PK — Patient Support')}>
                <View style={[styles.supportIcon, { backgroundColor: '#DBEAFE' }]}><Ionicons name="mail-outline" size={22} color="#2563EB" /></View>
                <View style={{ flex: 1 }}><Text style={styles.supportLabel}>Email Support</Text><Text style={styles.supportValue}>{SUPPORT_EMAIL}</Text></View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>

        {/* Bottom Fixed Save Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity 
            style={[styles.saveButton, saving && { opacity: 0.7 }]} 
            onPress={handleSaveChanges}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>{profileExists ? 'Update Profile' : 'Save Profile'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#F8FAFC' }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0066FF',
  },
  blueHeader: {
    backgroundColor: '#0066FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    backgroundColor: '#0066FF',
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // space for bottom bar
  },
  avatarWrapper: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 16,
    position: 'relative',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#DBEAFE',
  },
  addPhotoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#E0E7FF',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0A1551',
    textAlign: 'center',
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0066FF',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
    marginTop: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginTop: 4,
    padding: 4,
  },
  dropdownItem: {
    padding: 12,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#0F172A',
  },
  preciseLocationBtn: {
    backgroundColor: '#0066FF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  preciseLocationTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  supportCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginTop: 8 },
  supportTitle: { fontSize: 15, fontWeight: '700', color: '#0A1551', marginBottom: 6 },
  supportRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  supportIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  supportLabel: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  supportValue: { fontSize: 13, color: '#64748B', marginTop: 1 },
  referCard: { backgroundColor: '#0052FF', borderRadius: 16, padding: 18, marginBottom: 12 },
  referTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  referDesc: { fontSize: 13, color: '#DBEAFE', lineHeight: 19, marginBottom: 14 },
  referCodeBox: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 12, marginBottom: 14 },
  referCodeLabel: { fontSize: 11, color: '#BFDBFE', fontWeight: '600' },
  referCode: { fontSize: 22, color: '#FFFFFF', fontWeight: '900', letterSpacing: 2, marginTop: 2 },
  referStats: { fontSize: 12, color: '#DBEAFE', marginTop: 4 },
  referBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 13 },
  referBtnText: { color: '#0052FF', fontWeight: '700', fontSize: 15 },
  bottomBar: {
    backgroundColor: '#F8FAFC',
    padding: 20,
    paddingBottom: 20, // Bottom safe area is handled separately now
  },
  saveButton: {
    backgroundColor: '#0066FF',
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
