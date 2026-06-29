import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput, ActivityIndicator, ScrollView, Image, KeyboardAvoidingView, Share, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import { detectCoords } from '../utils/geo';
import { openWhatsApp, openSupportEmail, SUPPORT_WHATSAPP, SUPPORT_EMAIL } from '../utils/support';
import { SkeletonProfile } from '../components/Skeleton';
import PaymentMethods from '../components/PaymentMethods';
import PromoCard from '../components/PromoCard';
import { webForm, isWeb } from '../config/webLayout';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';

export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isFocused = useIsFocused();

  // White header → dark status-bar icons. Re-assert on focus since other screens
  // set it to 'light' (status-bar style is global / last-write-wins).
  useFocusEffect(
    React.useCallback(() => { if (!isWeb) setStatusBarStyle('dark'); }, [])
  );

  // Form states
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState('');
  const [detectingLoc, setDetectingLoc] = useState(false);
  const [gender, setGender] = useState('Select your gender');
  const [age, setAge] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [referral, setReferral] = useState(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);
  const [referralApplied, setReferralApplied] = useState(false);

  const [familyMembers, setFamilyMembers] = useState([]);
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRelation, setNewMemberRelation] = useState('Spouse');
  const [newMemberAge, setNewMemberAge] = useState('');
  const [newMemberGender, setNewMemberGender] = useState('male');
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  
  const cities = ['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Peshawar'];

  useEffect(() => {
    if (isFocused) {
      fetchUserProfile();
      fetchReferral();
      checkReferralPrompt();
    }
  }, [isFocused]);

  const fetchReferral = async () => {
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.get(`${API_BASE_URL}/api/users/referral`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) setReferral(res.data.data);
    } catch (e) { /* non-critical */ }
  };

  // Referral entry is now an inline block in the Refer-a-Friend card (no popup).
  const checkReferralPrompt = async () => {};

  const handleApplyCode = async () => {
    if (!referralInput.trim()) return;
    setApplyingCode(true);
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.post(
        `${API_BASE_URL}/api/users/referral/apply`,
        { code: referralInput.trim().toUpperCase() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setReferralApplied(true);
        await storage.setItem('referralPromptDone', '1');
        setTimeout(() => setShowReferralModal(false), 2200);
      }
    } catch (e) {
      Alert.alert('Invalid Code', e.response?.data?.message || 'Code not found. Please check and try again.');
    } finally {
      setApplyingCode(false);
    }
  };

  const handleSkipReferral = async () => {
    await storage.setItem('referralPromptDone', '1');
    setShowReferralModal(false);
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
    const msg = [
      `🦷 Join me on My Dentist!`,
      ``,
      `Use my referral code: *${data.code}*`,
      `We both earn 100 reward points after your first treatment! 🎁`,
      ``,
      `📱 Download the App:`,
      `• Android: ${data.androidLink || data.webLink}`,
      `• iPhone: ${data.iosLink || data.webLink}`,
      `• Web: ${data.webLink}`,
    ].join('\n');
    Share.share({ message: msg, title: 'Join My Dentist' });
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
        setCoords(p.coordinates || '');
        if (p.profileImage) {
          setProfileImage(p.profileImage.startsWith('http') || p.profileImage.startsWith('file:') || p.profileImage.startsWith('content:') ? p.profileImage : `${API_BASE_URL}${p.profileImage}`);
        }
        if (p.gender) {
          setGender(p.gender.charAt(0).toUpperCase() + p.gender.slice(1));
        }
        setAge(p.age ? String(p.age) : '');
        if (Array.isArray(p.familyMembers)) setFamilyMembers(p.familyMembers);
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
      return String(d.getFullYear() ? Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24 * 365)) : '');
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
        coordinates: coords,
        gender: genderVal,
        age: age ? parseInt(age, 10) : undefined,
        familyMembers,
      };

      // Check if image is local and needs upload (covers native file URIs + web blob URIs)
      const isLocalImage = profileImage && (
        profileImage.startsWith('file://') ||
        profileImage.startsWith('content://') ||
        profileImage.startsWith('ph://') ||
        profileImage.startsWith('blob:') ||
        profileImage.startsWith('data:')
      );

      const method = profileExists ? 'put' : 'post';
      const res = await axios[method](`${API_BASE_URL}/api/users/patient-profile`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        setProfileExists(true);

        if (isLocalImage) {
          try {
            const uploadedUrl = await uploadAvatar(profileImage, token);
            if (uploadedUrl) setProfileImage(uploadedUrl.startsWith('http') ? uploadedUrl : `${API_BASE_URL}${uploadedUrl}`);
          } catch (uploadErr) {
            console.log('Error uploading avatar:', uploadErr);
          }
        }

        await fetchUserProfile();
        Alert.alert('Success', 'Profile saved successfully!');
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


  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const localUri = result.assets[0].uri;
      // Show the local preview immediately, then auto-upload + save.
      setProfileImage(localUri);

      const token = await storage.getItem('userToken');
      if (!token) return;

      try {
        setUploadingImage(true);
        const uploadedUrl = await uploadAvatar(localUri, token);
        if (uploadedUrl) {
          setProfileImage(uploadedUrl.startsWith('http') ? uploadedUrl : `${API_BASE_URL}${uploadedUrl}`);
        }
      } catch (uploadErr) {
        console.log('Error uploading avatar:', uploadErr?.message || uploadErr);
        alert('Failed to upload photo. Please try again.');
        // Keep the local preview so the user can retry via Save.
      } finally {
        setUploadingImage(false);
      }
    } catch (error) {
      console.log('Error picking image:', error);
      alert('Failed to pick an image: ' + (error?.message || error));
    }
  };

  const handleLogout = async () => {
    await storage.removeItem('userToken');
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <>
    {/* One-time referral code modal */}
    <Modal visible={showReferralModal} transparent animationType="fade" onRequestClose={handleSkipReferral}>
      <View style={styles.modalOverlay}>
        <View style={styles.referralModalBox}>
          {referralApplied ? (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
                <Ionicons name="checkmark-circle" size={36} color="#16A34A" />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#0A1551', marginBottom: 6 }}>Code Applied!</Text>
              <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 19 }}>
                You and your friend will each get{'\n'}100 points after your first treatment.
              </Text>
            </View>
          ) : (
            <>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#EFF4FF', justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' }}>
                <Ionicons name="gift-outline" size={28} color="#0052FF" />
              </View>
              <Text style={styles.referralModalTitle}>Have a Friend's Code?</Text>
              <Text style={styles.referralModalSub}>Enter their referral code and you both earn 100 bonus points after your first treatment!</Text>
              <TextInput
                style={styles.referralModalInput}
                placeholder="e.g. MD708392"
                placeholderTextColor="#94A3B8"
                value={referralInput}
                onChangeText={t => setReferralInput(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={12}
              />
              <TouchableOpacity
                style={[styles.referralModalApplyBtn, (!referralInput.trim() || applyingCode) && { opacity: 0.5 }]}
                onPress={handleApplyCode}
                disabled={!referralInput.trim() || applyingCode}
              >
                {applyingCode
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.referralModalApplyText}>Apply Code</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.referralModalSkipBtn} onPress={handleSkipReferral}>
                <Text style={styles.referralModalSkipText}>I don't have a code — Skip</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>

    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Dark status-bar icons for the white header */}
      {!isWeb && <StatusBar style="dark" translucent backgroundColor="transparent" />}
      {/* Top Blue Header */}
      <View style={styles.blueHeader}>
        <View style={[styles.blueHeaderInner, webForm]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{profileExists ? 'Edit Profile' : 'Complete Profile'}</Text>
          {/* Logout lives in the top navbar on web; keep it here on mobile only */}
          {isWeb ? (
            <View style={{ width: 32 }} />
          ) : (
            <TouchableOpacity onPress={handleLogout} style={{ padding: 4 }}>
              <Ionicons name="log-out-outline" size={24} color="#DC2626" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.cardContainer}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, webForm]}>
            {loading ? (
              <SkeletonProfile fields={5} />
            ) : (
             <>
            {/* Profile Avatar */}
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarContainer}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={{ width: '100%', height: '100%', borderRadius: 40 }} />
                ) : (
                  <Ionicons name="person" size={40} color="#2563EB" />
                )}
                {uploadingImage && (
                  <View style={styles.avatarUploadOverlay}>
                    <ActivityIndicator color="#FFF" size="small" />
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.addPhotoBadge} onPress={handlePickImage} disabled={uploadingImage}>
                <Ionicons name="add" size={16} color="#2563EB" />
              </TouchableOpacity>
            </View>

            <Text style={styles.pageTitle}>Create Patient Profile</Text>
            <Text style={styles.pageSubtitle}>Let's create your profile to get started</Text>

            {/* Marketing banner */}
            <PromoCard style={{ marginHorizontal: -20 }} />

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

              <Text style={styles.label}>Age (years)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={t => setAge(t.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="Enter your age"
                  placeholderTextColor="#94A3B8"
                  maxLength={3}
                />
              </View>

              <Text style={styles.label}>Gender</Text>
              <View style={[styles.dropdownAnchor, showGenderDropdown && styles.dropdownAnchorOpen]}>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() => { setShowGenderDropdown(!showGenderDropdown); setShowCityDropdown(false); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="people-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                  <Text style={[styles.input, { color: gender === 'Select your gender' ? '#94A3B8' : '#0F172A', paddingTop: Platform.OS==='ios'?14:0 }]}>
                    {gender}
                  </Text>
                  <Ionicons name={showGenderDropdown ? 'chevron-up' : 'chevron-down'} size={20} color="#94A3B8" />
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
              </View>

              <Text style={styles.label}>City</Text>
              <View style={[styles.dropdownAnchor, showCityDropdown && styles.dropdownAnchorOpen]}>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() => { setShowCityDropdown(!showCityDropdown); setShowGenderDropdown(false); }}
                >
                  <Ionicons name="location-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                  <Text style={[styles.input, { color: city ? '#0F172A' : '#94A3B8' }]}>
                    {city || 'Select your city'}
                  </Text>
                  <Ionicons name={showCityDropdown ? 'chevron-up' : 'chevron-down'} size={20} color="#94A3B8" />
                </TouchableOpacity>

                {showCityDropdown && (
                  <View style={styles.dropdownMenu}>
                    {cities.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={styles.dropdownItem}
                        onPress={() => { setCity(c); setShowCityDropdown(false); }}
                      >
                        <Text style={styles.dropdownItemText}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <Text style={styles.label}>Location / Address</Text>
              <View style={styles.locationCard}>
                <View style={styles.locationInputRow}>
                  <Ionicons name="location-outline" size={20} color="#94A3B8" style={{ marginRight: 10, marginTop: 2 }} />
                  <TextInput
                    style={styles.locationInput}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Add your full address (house, street, area, city)"
                    placeholderTextColor="#94A3B8"
                    multiline
                  />
                </View>
                {coords ? (
                  <View style={styles.coordsRow}>
                    <Ionicons name="navigate" size={13} color="#16A34A" />
                    <Text style={styles.coordsText}>{coords}</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={styles.preciseLocationBtn}
                  onPress={() => detectCoords(
                    (text, details) => { setLocation(details?.address || text); setCoords(details?.coords || ''); },
                    setDetectingLoc
                  )}
                  disabled={detectingLoc}
                >
                  {detectingLoc ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="locate" size={16} color="#FFFFFF" />}
                  <Text style={styles.preciseLocationTxt}>{detectingLoc ? 'Detecting your location…' : 'Use My Precise Location'}</Text>
                </TouchableOpacity>
              </View>

            </View>

            {/* Payment Methods */}
            {profileExists && <PaymentMethods />}

            {/* Family Profile */}
            <View style={[styles.referCard, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.referIconBadge, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                    <Ionicons name="people" size={18} color="#16A34A" />
                  </View>
                  <Text style={styles.referTitle}>Family Profile</Text>
                </View>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#BBF7D0' }}
                  onPress={() => setShowFamilyForm(v => !v)}
                >
                  <Ionicons name={showFamilyForm ? 'close' : 'add'} size={14} color="#16A34A" />
                  <Text style={{ fontSize: 12, color: '#16A34A', fontWeight: '700', marginLeft: 4 }}>{showFamilyForm ? 'Cancel' : 'Add Member'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.referDesc, { marginBottom: 12 }]}>Manage dental health for your whole family from one account.</Text>

              {/* Existing members */}
              {familyMembers.map((m, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                    <Ionicons name={m.gender === 'female' ? 'woman' : 'man'} size={18} color="#0052FF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0A1551' }}>{m.name}</Text>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>{m.relation}{m.age ? ` · ${m.age} yrs` : ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setFamilyMembers(prev => prev.filter((_, i) => i !== idx))}>
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add member form */}
              {showFamilyForm && (
                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 8 }}>NEW FAMILY MEMBER</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A', marginBottom: 10, backgroundColor: '#FFF' }}
                    placeholder="Full Name"
                    placeholderTextColor="#94A3B8"
                    value={newMemberName}
                    onChangeText={setNewMemberName}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    {['Spouse','Child','Parent','Sibling','Other'].map(r => (
                      <TouchableOpacity key={r} onPress={() => setNewMemberRelation(r)}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: newMemberRelation === r ? '#0052FF' : '#FFF', borderWidth: 1, borderColor: newMemberRelation === r ? '#0052FF' : '#E2E8F0' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: newMemberRelation === r ? '#FFF' : '#64748B' }}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    <TextInput
                      style={{ flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A', backgroundColor: '#FFF' }}
                      placeholder="Age"
                      placeholderTextColor="#94A3B8"
                      value={newMemberAge}
                      onChangeText={t => setNewMemberAge(t.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                    {['male','female'].map(g => (
                      <TouchableOpacity key={g} onPress={() => setNewMemberGender(g)}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: newMemberGender === g ? '#0052FF' : '#FFF', borderWidth: 1, borderColor: newMemberGender === g ? '#0052FF' : '#E2E8F0', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: newMemberGender === g ? '#FFF' : '#64748B' }}>{g === 'male' ? '♂ Male' : '♀ Female'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={{ backgroundColor: '#16A34A', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
                    onPress={() => {
                      if (!newMemberName.trim()) return Alert.alert('Name required', 'Please enter the member\'s name.');
                      setFamilyMembers(prev => [...prev, { name: newMemberName.trim(), relation: newMemberRelation, age: newMemberAge ? parseInt(newMemberAge) : undefined, gender: newMemberGender }]);
                      setNewMemberName(''); setNewMemberAge(''); setShowFamilyForm(false);
                    }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Add to Family</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Refer a Friend */}
            <View style={styles.referCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <View style={styles.referIconBadge}>
                  <Ionicons name="gift" size={18} color="#0052FF" />
                </View>
                <Text style={styles.referTitle}>Refer a Friend</Text>
              </View>
              <Text style={styles.referDesc}>You and your friend each get 100 points when they join and complete their first treatment.</Text>
              {referral ? (
                <View style={styles.referCodeBox}>
                  <Text style={styles.referCodeLabel}>YOUR CODE</Text>
                  <Text style={styles.referCode}>{referral.code}</Text>
                  <Text style={styles.referStats}>{referral.referredCount} referred · {referral.referralPointsEarned} pts earned</Text>
                </View>
              ) : null}
              <TouchableOpacity style={styles.referBtn} onPress={shareReferral}>
                <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
                <Text style={styles.referBtnText}>Share Invite Link</Text>
              </TouchableOpacity>
            </View>

            {/* Have a Friend's Code? — separate card (no popup) */}
            {!referral?.referredBy && (
              <View style={styles.referCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <View style={[styles.referIconBadge, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                    <Ionicons name="pricetag" size={18} color="#16A34A" />
                  </View>
                  <Text style={styles.referTitle}>Have a Friend's Code?</Text>
                </View>
                {referralApplied ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <Text style={styles.friendCodeApplied}>Code applied! You'll both earn 100 points after your first treatment.</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.referDesc}>Enter their code and you both earn 100 bonus points after your first treatment.</Text>
                    <View style={styles.friendCodeRow}>
                      <TextInput
                        style={styles.friendCodeInput}
                        placeholder="e.g. MD708392"
                        placeholderTextColor="#94A3B8"
                        value={referralInput}
                        onChangeText={t => setReferralInput(t.toUpperCase())}
                        autoCapitalize="characters"
                        maxLength={12}
                      />
                      <TouchableOpacity
                        style={[styles.friendCodeApplyBtn, (!referralInput.trim() || applyingCode) && { opacity: 0.5 }]}
                        onPress={handleApplyCode}
                        disabled={!referralInput.trim() || applyingCode}
                      >
                        {applyingCode
                          ? <ActivityIndicator color="#FFF" size="small" />
                          : <Text style={styles.friendCodeApplyText}>Apply</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Support & Help */}
            <View style={styles.supportCard}>
              <Text style={styles.supportTitle}>Support & Help</Text>
              <TouchableOpacity style={styles.supportRow} onPress={() => openWhatsApp('Hello, I am a patient on My Dentist and need support.')}>
                <View style={[styles.supportIcon, { backgroundColor: '#DCFCE7' }]}><Ionicons name="logo-whatsapp" size={22} color="#25D366" /></View>
                <View style={{ flex: 1 }}><Text style={styles.supportLabel}>WhatsApp Support</Text><Text style={styles.supportValue}>{SUPPORT_WHATSAPP}</Text></View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.supportRow} onPress={() => openSupportEmail('My Dentist — Patient Support')}>
                <View style={[styles.supportIcon, { backgroundColor: '#DBEAFE' }]}><Ionicons name="mail-outline" size={22} color="#2563EB" /></View>
                <View style={{ flex: 1 }}><Text style={styles.supportLabel}>Email Support</Text><Text style={styles.supportValue}>{SUPPORT_EMAIL}</Text></View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Save button — full-width on native; compact + right-aligned on web */}
            <View style={[webForm, isWeb && styles.saveBarWeb]}>
            <TouchableOpacity
              style={[styles.saveButton, isWeb && styles.saveButtonWeb, { marginTop: 20 }, saving && { opacity: 0.7 }]}
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
             </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  blueHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingTop: 18,
    paddingBottom: 16,
  },
  blueHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#0A1551',
    fontSize: 20,
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 28,
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
    overflow: 'hidden',
  },
  avatarUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
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
  // Anchor wraps the trigger + menu; relative so the absolute menu positions to
  // it, and a high zIndex so the open menu floats over fields below.
  dropdownAnchor: { position: 'relative', zIndex: 1 },
  dropdownAnchorOpen: { zIndex: 1000 },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginTop: 4,
    padding: 4,
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  dropdownItem: {
    padding: 12,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#0F172A',
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
  },
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 64,
    marginBottom: 12,
  },
  locationInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 20,
    paddingTop: 2,
    textAlignVertical: 'top',
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 12,
  },
  coordsText: { fontSize: 12, fontWeight: '600', color: '#15803D' },
  preciseLocationBtn: {
    backgroundColor: '#0066FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  preciseLocationTxt: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    marginLeft: 6,
  },
  supportCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginTop: 8 },
  supportTitle: { fontSize: 15, fontWeight: '700', color: '#0A1551', marginBottom: 6 },
  supportRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  supportIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  supportLabel: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  supportValue: { fontSize: 13, color: '#64748B', marginTop: 1 },
  referCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  referIconBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF4FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DBEAFE' },
  referTitle: { fontSize: 16, fontWeight: '800', color: '#0A1551' },
  referDesc: { fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: 14 },
  referCodeBox: { backgroundColor: '#F8FAFF', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#E6EEFF', borderStyle: 'dashed' },
  referCodeLabel: { fontSize: 10.5, color: '#64748B', fontWeight: '700', letterSpacing: 0.5 },
  referCode: { fontSize: 22, color: '#0052FF', fontWeight: '900', letterSpacing: 2, marginTop: 2 },
  referStats: { fontSize: 12, color: '#64748B', marginTop: 6 },
  referBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 13 },
  referBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  friendCodeBox: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  friendCodeLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  friendCodeRow: { flexDirection: 'row', gap: 8 },
  friendCodeInput: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC', letterSpacing: 1 },
  friendCodeApplyBtn: { backgroundColor: '#0052FF', borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  friendCodeApplyText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  friendCodeApplied: { flex: 1, fontSize: 13, color: '#16A34A', fontWeight: '600', lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  referralModalBox: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380 },
  referralModalTitle: { fontSize: 18, fontWeight: '800', color: '#0A1551', textAlign: 'center', marginBottom: 8 },
  referralModalSub: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  referralModalInput: { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 18, fontWeight: '800', letterSpacing: 3, color: '#0052FF', textAlign: 'center', marginBottom: 14, backgroundColor: '#F8FAFF' },
  referralModalApplyBtn: { backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  referralModalApplyText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  referralModalSkipBtn: { alignItems: 'center', paddingVertical: 10 },
  referralModalSkipText: { color: '#94A3B8', fontSize: 13, fontWeight: '500' },
  bottomBar: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingTop: 10,
    // paddingBottom set inline from safe-area inset (no double spacing)
  },
  saveButton: {
    backgroundColor: '#0066FF',
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Web: right-align the button within the form column...
  saveBarWeb: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  // ...and size it to its content instead of full-width.
  saveButtonWeb: {
    alignSelf: 'flex-end',
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 28,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
