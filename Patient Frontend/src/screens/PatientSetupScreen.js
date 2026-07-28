import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput, ActivityIndicator, ScrollView, Image, KeyboardAvoidingView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import { useIsFocused } from '@react-navigation/native';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';
import { detectCoords } from '../utils/geo';
import { sanitizePhone } from '../utils/phone';
import { webForm, fieldGridFor, halfFor, fullFor } from '../config/webLayout';
import CityPicker from '../components/CityPicker';

const GENDER_PLACEHOLDER = 'Select your gender';

// Only Name, Mobile and City are needed to finish signup — everything else can
// be added later from Edit Profile. Keeping this list short is the single
// biggest lever on completion rate.
const validateForm = ({ fullName, mobileNumber, city }) => {
  const errors = {};
  const name = fullName.trim();
  if (!name) errors.fullName = 'Please enter your full name';
  else if (name.length < 2) errors.fullName = 'Name must be at least 2 characters';

  const phone = mobileNumber.trim();
  if (!phone) errors.mobileNumber = 'Please enter your mobile number';
  // Pakistani mobile format, e.g. 03001234567.
  else if (!/^03\d{9}$/.test(phone)) errors.mobileNumber = 'Enter an 11-digit number starting with 03';

  if (!city.trim()) errors.city = 'Please select your city';
  return errors;
};

// The API returns { success, message, errors: [{ field, message }] }. Surface the
// per-field messages instead of the generic "Validation failed" the user saw before.
const serverErrorsToFields = (data) => {
  const out = {};
  if (Array.isArray(data?.errors)) {
    for (const e of data.errors) {
      if (e?.field && e?.message && !out[e.field]) out[e.field] = e.message;
    }
  }
  return out;
};

export default function PatientSetupScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isFocused = useIsFocused();
  // Drives the one/two-column switch so the form re-flows on resize + rotate.
  const { width } = useWindowDimensions();
  const gridStyle = fieldGridFor(width);
  const halfStyle = halfFor(width);
  const fullStyle = fullFor(width);

  // Form states
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [detectingLoc, setDetectingLoc] = useState(false);
  const [gender, setGender] = useState(GENDER_PLACEHOLDER);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileExists, setProfileExists] = useState(false);

  // Per-field messages. `touched` keeps errors from flashing on a field the user
  // hasn't reached yet — they appear on blur, or on a failed save attempt.
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const markTouched = (field) => setTouched((t) => ({ ...t, [field]: true }));
  // Clear a field's error as soon as the user edits it — re-validating on every
  // keystroke would scold them mid-type.
  const clearError = (field) => setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  const showError = (field) => (touched[field] ? errors[field] : undefined);

  useEffect(() => {
    if (isFocused) {
      fetchUserProfile();
    }
  }, [isFocused]);

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
      const name = (uri.split('/').pop() || 'avatar.jpg').split('?')[0];

      if (Platform.OS === 'web') {
        // Browsers need a real Blob/File — the RN { uri, name, type } shape is
        // sent as "[object Object]" on web, so the server sees no file (400).
        const blob = await (await fetch(uri)).blob();
        formData.append('avatar', blob, name.includes('.') ? name : 'avatar.jpg');
      } else {
        if (Platform.OS === 'android' && !uri.startsWith('file://') && !uri.startsWith('content://')) uri = `file://${uri}`;
        const ext = (name.split('.').pop() || 'jpg').toLowerCase();
        const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        formData.append('avatar', { uri, name, type });
      }

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
    const found = validateForm({ fullName, mobileNumber, city });
    if (Object.keys(found).length) {
      // Reveal every message at once so the user sees the whole list, not one at a time.
      setErrors(found);
      setTouched({ fullName: true, mobileNumber: true, city: true });
      return;
    }
    setErrors({});

    try {
      setSaving(true);
      const token = await storage.getItem('userToken');

      const payload = {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        city: city.trim(),
        address: location.trim(),
      };

      // Only send gender/DOB when actually chosen. Previously an untouched gender
      // dropdown silently posted 'male', writing wrong data for everyone who
      // skipped it; both fields are optional server-side now.
      if (gender !== GENDER_PLACEHOLDER) payload.gender = gender.toLowerCase();
      if (dateOfBirth) payload.dateOfBirth = new Date(dateOfBirth).toISOString();

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
            // Non-blocking: the profile saved, so let onboarding finish rather
            // than stranding the user on this screen over an optional photo.
            alert('Profile saved. Your photo didn’t upload — you can add it later from Edit Profile.');
          }
        }

        // Navigate straight to Home. The old success alert added a mandatory tap
        // to the end of onboarding for no information gain.
        navigation.replace('MainTabs', { screen: 'Home' });
      } else {
        alert(res.data?.message || 'Failed to save profile');
      }
    } catch (error) {
      const data = error.response?.data;
      console.log('Error saving profile:', data || error.message);

      // Map server-side field errors onto the inputs so the user can see exactly
      // what to fix, instead of a bare "Validation failed".
      const fieldErrors = serverErrorsToFields(data);
      if (Object.keys(fieldErrors).length) {
        setErrors(fieldErrors);
        setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(fieldErrors).map((k) => [k, true])) }));
        return;
      }

      if (!error.response) {
        alert('Could not reach the server. Check your internet connection and try again.');
      } else {
        alert(data?.message || 'Failed to save profile. Please try again.');
      }
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
    navigation.replace('Login');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {/* Top Blue Header */}
      <View style={styles.blueHeader}>
        <View style={[styles.blueHeaderInner, webForm]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login')}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{profileExists ? 'Edit Profile' : 'Complete Profile'}</Text>
          <TouchableOpacity onPress={handleLogout} style={{ padding: 4 }}>
            <Ionicons name="log-out-outline" size={24} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.cardContainer}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, webForm]}>
            
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

            <Text style={styles.pageTitle}>
              {profileExists && fullName.trim() ? fullName.trim() : 'Create Patient Profile'}
            </Text>
            <Text style={styles.pageSubtitle}>
              {profileExists
                ? 'Review and update your profile details'
                : 'Just three quick details and you’re in — you can add the rest later.'}
            </Text>

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

              {/* Form Fields — two columns only on wide screens; phones (incl.
                  mobile browsers) stay single-column so inputs are usable. */}
              <View style={[styles.fieldGrid, gridStyle]}>
              <View style={[styles.fieldItem, halfStyle]}>
              <Text style={styles.label}>Full Name <Text style={styles.req}>*</Text></Text>
              <View style={[styles.inputContainer, showError('fullName') && styles.inputContainerError]}>
                <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={(t) => { setFullName(t); clearError('fullName'); }}
                  onBlur={() => { markTouched('fullName'); setErrors((e) => ({ ...e, ...validateForm({ fullName, mobileNumber, city }) })); }}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                  textContentType="name"
                  autoComplete="name"
                  returnKeyType="next"
                />
              </View>
              {!!showError('fullName') && <Text style={styles.errorText}>{showError('fullName')}</Text>}
              </View>

              <View style={[styles.fieldItem, halfStyle]}>
              <Text style={styles.label}>Mobile Number <Text style={styles.req}>*</Text></Text>
              <View style={[styles.inputContainer, showError('mobileNumber') && styles.inputContainerError]}>
                <Ionicons name="call-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={mobileNumber}
                  onChangeText={(t) => { setMobileNumber(sanitizePhone(t)); clearError('mobileNumber'); }}
                  onBlur={() => { markTouched('mobileNumber'); setErrors((e) => ({ ...e, ...validateForm({ fullName, mobileNumber, city }) })); }}
                  keyboardType="phone-pad"
                  maxLength={11}
                  placeholder="03XXXXXXXXX"
                  placeholderTextColor="#94A3B8"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                />
              </View>
              {!!showError('mobileNumber') && <Text style={styles.errorText}>{showError('mobileNumber')}</Text>}
              </View>

              <View style={[styles.fieldItem, halfStyle]}>
              <Text style={styles.label}>Date of Birth <Text style={styles.optional}>(optional)</Text></Text>
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
              </View>

              <View style={[styles.fieldItem, halfStyle, showGenderDropdown && styles.fieldItemOpen]}>
              <Text style={styles.label}>Gender <Text style={styles.optional}>(optional)</Text></Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => { setShowGenderDropdown(!showGenderDropdown); }}
                activeOpacity={0.8}
              >
                <Ionicons name="people-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <Text style={[styles.input, { color: gender === GENDER_PLACEHOLDER ? '#94A3B8' : '#0F172A', paddingTop: Platform.OS==='ios'?14:0 }]}>
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

              <View style={[styles.fieldItem, halfStyle]}>
              <Text style={styles.label}>City <Text style={styles.req}>*</Text></Text>
              <CityPicker
                value={city}
                onSelect={(c) => { setCity(c); markTouched('city'); clearError('city'); }}
                placeholder="Select your city"
              />
              {!!showError('city') && <Text style={styles.errorText}>{showError('city')}</Text>}
              </View>

              <View style={[styles.fieldItem, fullStyle]}>
              <Text style={styles.label}>Location / Address <Text style={styles.optional}>(optional)</Text></Text>
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

              </View>{/* /fieldGrid */}

            </View>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>

        {/* Bottom Fixed Save Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.saveButton, webForm, saving && { opacity: 0.7 }]}
            onPress={handleSaveChanges}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>Save Profile</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 14,
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
  fieldGrid: {},
  fieldItem: { position: 'relative', zIndex: 1 },
  fieldItemOpen: { zIndex: 1000 },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
    marginTop: 16,
  },
  req: {
    color: '#DC2626',
    fontWeight: 'bold',
  },
  optional: {
    color: '#94A3B8',
    fontWeight: 'normal',
    fontSize: 12,
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
  inputContainerError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 6,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
  },
  dropdownToggle: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  bottomBar: {
    backgroundColor: '#F8FAFC',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
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
