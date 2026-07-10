import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Platform, Alert, Modal, FlatList, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import storage from '../../config/storage';
import { appendImageFile } from '../../utils/formImage';
import { compressImage, getByteSize, formatBytes } from '../../utils/imageTools';
import { sanitizePhone } from '../../utils/phone';
import CityPicker from '../../components/CityPicker';
import AvatarCropper from '../../components/AvatarCropper';
import API_BASE_URL from '../../config/api';

const { width } = Dimensions.get('window');

const SPECIALISATIONS = [
  'General',
  'Orthodontist',
  'Implant Specialist',
  'Cosmetic Dentist',
  'Pediatric Dentist',
  'Oral Surgeon',
  'Endodontist',
  'Periodontist',
  'Prosthodontist'
];

const GENDERS = ['Male', 'Female', 'Other'];

const EXPERIENCE_OPTIONS = [
  ...Array.from({ length: 30 }, (_, i) => `${i + 1}`),
  '30+'
];

// Reusable dropdown component
function DropdownPicker({ label, icon, placeholder, options, value, onSelect }) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.inputContainer}
        activeOpacity={0.7}
        onPress={() => setVisible(true)}
      >
        <Ionicons name={icon} size={20} color="#94A3B8" style={styles.inputIcon} />
        <Text style={[styles.dropdownText, !value && { color: '#94A3B8' }]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#94A3B8" />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color="#0A1551" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    value === item && styles.modalOptionActive
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      value === item && styles.modalOptionTextActive
                    ]}
                  >
                    {item}
                  </Text>
                  {value === item && (
                    <Ionicons name="checkmark-circle" size={22} color="#0052FF" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export default function DoctorRegisterScreen({ navigation }) {
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef(null);

  // Personal Info State
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [pmdcNumber, setPmdcNumber] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [licenseCert, setLicenseCert] = useState(null);
  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);
  // Submit-time upload progress window: { label, index, total, percent }
  const [upProgress, setUpProgress] = useState(null);
  // Web avatar crop step: { uri, fileName, origSize, setter }
  const [cropper, setCropper] = useState(null);

  // Professional Info State
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('');
  const [specialisation, setSpecialisation] = useState('');
  const [experience, setExperience] = useState('');
  const [clinicContact, setClinicContact] = useState('');
  const [locationCoords, setLocationCoords] = useState('');
  const [detectingLoc, setDetectingLoc] = useState(false);

  // Detect precise GPS coordinates. Native uses expo-location (with permission
  // prompt); web uses the browser geolocation API.
  const detectLocation = async () => {
    setDetectingLoc(true);
    try {
      if (Platform.OS !== 'web') {
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setDetectingLoc(false);
          Alert.alert('Permission needed', 'Location permission was denied. You can enter coordinates manually instead.');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocationCoords(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        setDetectingLoc(false);
        return;
      }
      // Web
      const geo = (typeof navigator !== 'undefined' && navigator.geolocation) ? navigator.geolocation : null;
      if (!geo) {
        setDetectingLoc(false);
        window.alert('Location services are not available. Please enter coordinates manually.');
        return;
      }
      geo.getCurrentPosition(
        (pos) => { setLocationCoords(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`); setDetectingLoc(false); },
        (err) => {
          setDetectingLoc(false);
          window.alert(err?.code === 1 ? 'Location permission denied. Enter coordinates manually.' : 'Could not get your location. Enter coordinates manually.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } catch (e) {
      setDetectingLoc(false);
      Alert.alert('Location', 'Could not get your location. Please enter coordinates manually.');
    }
  };
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [city, setCity] = useState('');
  const [about, setAbout] = useState('');

  const pickDocument = async (setter, isAvatar = false) => {
    try {
      const isWeb = Platform.OS === 'web';
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // Native avatar → OS crop UI. Web avatar → our draggable cropper (below).
        allowsEditing: isAvatar && !isWeb,
        aspect: isAvatar ? [1, 1] : undefined,
        quality: 1,                       // pick full quality; we compress ourselves
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      // Web avatar → open the reposition/zoom cropper first.
      if (isAvatar && isWeb) {
        setCropper({ uri: asset.uri, fileName: asset.fileName || 'avatar.jpg', origSize: asset.fileSize || 0, setter });
        return;
      }

      const origSize = asset.fileSize || (await getByteSize(asset.uri));
      // Auto-compress: avatar → fixed 512² square; docs → cap 1600px longest edge.
      const out = isAvatar
        ? await compressImage(asset.uri, { quality: 0.75, square: 512 })
        : await compressImage(asset.uri, { quality: 0.6, maxDim: 1600 });
      setter({ ...asset, uri: out.uri, fileName: asset.fileName || 'upload.jpg', origSize, size: out.size || origSize });
    } catch (err) {
      console.log('Pick error:', err);
    }
  };

  // Web avatar cropper confirmed → stash the cropped 512² blob for submit upload.
  const onCropped = (out) => {
    const c = cropper;
    setCropper(null);
    if (!out || !c) return;
    c.setter({ uri: out.uri, fileName: c.fileName || 'avatar.jpg', origSize: c.origSize || out.size, size: out.size });
  };

  const getFileName = (asset) => {
    if (!asset) return null;
    if (typeof asset === 'string') {
      const parts = asset.split('/');
      return parts[parts.length - 1];
    }
    if (asset.fileName) return asset.fileName;
    const parts = asset.uri.split('/');
    return parts[parts.length - 1];
  };

  const uploadFile = async (asset, token, meta = {}) => {
    if (!asset) return null;
    if (typeof asset === 'string') return asset; // Return already uploaded path
    const { label = 'document', index = 1, total = 1 } = meta;
    setUpProgress({ label, index, total, percent: 0 });
    try {
      const formData = new FormData();
      await appendImageFile(formData, 'file', asset.uri, asset.fileName || 'upload.jpg');

      // XHR so we can report real upload progress (fetch can't).
      const url = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/api/users/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUpProgress((p) => (p ? { ...p, percent: Math.round((e.loaded / e.total) * 100) } : p));
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText || '{}');
            if (xhr.status >= 200 && xhr.status < 300 && data.success) resolve(data.data.url);
            else reject(new Error(data.message || `Upload failed (${xhr.status})`));
          } catch (e) { reject(new Error('Unexpected server response')); }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });
      return url;
    } catch (err) {
      console.error('File upload error:', err);
      throw err;
    }
  };

  const handleSaveProfile = async (skip = false) => {
    // When skipping, only a name is required so the profile isn't a placeholder;
    // the rest (and verification docs) can be completed later from Profile.
    if (skip) {
      if (!fullName) {
        const msg = 'Please at least enter your full name to continue.';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Name required', msg);
        return;
      }
    } else {
      // Basic validation
      if (!mobile || !email || !fullName || !specialisation || !about || !clinicName || !clinicAddress || !city || !gender || !experience || !clinicContact) {
        const msg = 'Please fill in all text fields before continuing — or tap “Skip for now” to finish later.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Missing Fields', msg);
        }
        return;
      }

      if (!avatar || !licenseCert || !idFront || !idBack) {
        const msg = 'Please upload all required images and certificates (Profile Pic, License, ID Front, ID Back) — or tap “Skip for now” to finish later.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Missing Documents', msg);
        }
        return;
      }
    }

    try {
      setSubmitting(true);
      const token = await storage.getItem('userToken');
      if (!token) {
        throw new Error('User token not found. Please log in again.');
      }

      // 1. Upload files if present
      let licenseCertUrl = '';
      let idFrontUrl = '';
      let idBackUrl = '';
      let avatarUrl = '';

      // Count only the images that still need uploading (skip already-uploaded string paths).
      const pending = [
        ['Profile Picture', avatar],
        ['License / Registration', licenseCert],
        ['ID Card Front', idFront],
        ['ID Card Back', idBack],
      ].filter(([, a]) => a && typeof a !== 'string');
      const total = pending.length;
      let idx = 0;
      const doUpload = async (asset, label) => {
        if (!asset) return '';
        if (typeof asset === 'string') return asset;
        idx += 1;
        return uploadFile(asset, token, { label, index: idx, total });
      };

      avatarUrl = await doUpload(avatar, 'Profile Picture');
      licenseCertUrl = await doUpload(licenseCert, 'License / Registration');
      idFrontUrl = await doUpload(idFront, 'ID Card Front');
      idBackUrl = await doUpload(idBack, 'ID Card Back');
      setUpProgress(null);

      // 2. Build GeoJSON location point if coordinates are provided
      let location = undefined;
      if (locationCoords) {
        const parts = locationCoords.split(',').map(p => Number(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          location = {
            type: 'Point',
            coordinates: [parts[1], parts[0]] // Longitude, Latitude ordering
          };
        }
      }

      // 3. Update Doctor profile. specialization must be non-empty (required by
      // the model) — default it when skipping so the save doesn't fail.
      const payload = {
        fullName,
        specialization: specialisation || 'General',
        experience: experience === '30+' ? 30 : Number(experience) || 0,
        clinicName,
        address: clinicAddress,
        pmdcNumber,
        gender,
        clinicContact,
        city,
        phone: mobile,
        location,
        about,
        photo: avatarUrl || undefined,
      };

      if (licenseCertUrl) payload.licenseCert = licenseCertUrl;
      if (idFrontUrl) payload.idFront = idFrontUrl;
      if (idBackUrl) payload.idBack = idBackUrl;

      await axios.put(`${API_BASE_URL}/api/users/doctor-profile`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (Platform.OS === 'web') {
        window.alert('Profile saved successfully!');
      } else {
        Alert.alert('Success', 'Profile saved successfully!');
      }

      navigation.replace('ClinicSetup');
    } catch (error) {
      console.error('Save profile error:', error);
      const msg = error.response?.data?.message || error.message || 'Saving profile failed. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSubmitting(false);
      setUpProgress(null);
    }
  };

  const renderUploadButton = (label, subtitle, asset, setter, isAvatar = false) => (
    <TouchableOpacity
      style={styles.uploadButton}
      activeOpacity={0.7}
      onPress={() => pickDocument(setter, isAvatar)}
    >
      <View style={styles.uploadIconWrap}>
        <Ionicons name="cloud-upload-outline" size={24} color="#0052FF" />
      </View>
      <View style={styles.uploadTextWrap}>
        <Text style={styles.uploadLabel}>{label}</Text>
        {asset ? (
          <Text style={styles.uploadFileSelected} numberOfLines={1}>
            ✓ {getFileName(asset)}{asset?.size ? ` · ${formatBytes(asset.size)}` : ''}
          </Text>
        ) : (
          <Text style={styles.uploadSubtitle}>{subtitle}</Text>
        )}
      </View>
      {asset?.uri ? (
        <Image source={{ uri: asset.uri }} style={[styles.uploadThumb, isAvatar && { borderRadius: 20 }]} />
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Welcome')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0052FF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* ====== SECTION 1: Personal Information ====== */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="lock-closed" size={18} color="#0A1551" />
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
          <View style={styles.badgeDark}>
            <Ionicons name="eye-off" size={12} color="#FFFFFF" />
            <Text style={styles.badgeDarkText}>Not shown to anyone</Text>
          </View>
        </View>

        <View style={styles.card}>
          {/* Mobile Number */}
          <Text style={styles.label}>Mobile Number <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={mobile}
              onChangeText={(t) => setMobile(sanitizePhone(t))}
              placeholder="03XXXXXXXXX"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              maxLength={11}
            />
          </View>

          {/* Email */}
          <Text style={styles.label}>Email Address <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="example@example.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* PMDC Number */}
          <Text style={styles.label}>PMDC Number</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="clipboard-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={pmdcNumber}
              onChangeText={setPmdcNumber}
              placeholder="Enter PMDC Number"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Upload Buttons */}
          {renderUploadButton(
            'Profile Picture (Avatar)',
            'Clear face photo · square, 512×512px',
            avatar,
            setAvatar,
            true // avatar → square crop
          )}
          {renderUploadButton(
            'License / Registration Certificate',
            'Clear scan · portrait, ~1200×1600px',
            licenseCert,
            setLicenseCert
          )}
          {renderUploadButton(
            'ID Card Front',
            'Clear photo · ~1000×640px',
            idFront,
            setIdFront
          )}
          {renderUploadButton(
            'ID Card Back',
            'Clear photo · ~1000×640px',
            idBack,
            setIdBack
          )}
        </View>

        {/* ====== SECTION 2: Professional Information ====== */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="person" size={18} color="#0A1551" />
            <Text style={styles.sectionTitle}>Professional Information</Text>
          </View>
          <View style={styles.badgeGreen}>
            <Ionicons name="eye" size={12} color="#FFFFFF" />
            <Text style={styles.badgeGreenText}>Shown to everyone</Text>
          </View>
        </View>

        <View style={styles.card}>
          {/* Full Name */}
          <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Dr. Ahmed Khan"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Gender Dropdown */}
          <DropdownPicker
            label="Gender"
            icon="male-female-outline"
            placeholder="Select Gender"
            options={GENDERS}
            value={gender}
            onSelect={setGender}
          />

          {/* Specialisation Dropdown */}
          <DropdownPicker
            label="Specialisation *"
            icon="medkit-outline"
            placeholder="Select Specialisation"
            options={SPECIALISATIONS}
            value={specialisation}
            onSelect={setSpecialisation}
          />

          {/* Experience Dropdown */}
          <DropdownPicker
            label="Years of Experience"
            icon="time-outline"
            placeholder="Select Experience"
            options={EXPERIENCE_OPTIONS}
            value={experience}
            onSelect={setExperience}
          />

          {/* Clinic Contact Number */}
          <Text style={styles.label}>Clinic Contact Number</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={clinicContact}
              onChangeText={(t) => setClinicContact(sanitizePhone(t))}
              placeholder="03XXXXXXXXX"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              maxLength={11}
            />
          </View>

          {/* Clinic / Hospital Name */}
          <Text style={styles.label}>Clinic / Hospital Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="business-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={clinicName}
              onChangeText={setClinicName}
              placeholder="e.g. City Dental Care"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Clinic Address */}
          <Text style={styles.label}>Clinic Address</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="map-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={clinicAddress}
              onChangeText={setClinicAddress}
              placeholder="Full clinic address"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Precise Location — pinpoint coordinates */}
          <View style={styles.locCard}>
            <View style={styles.locCardHead}>
              <View style={styles.locIconWrap}>
                <Ionicons name="navigate" size={18} color="#0052FF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.locTitle}>Precise Location</Text>
                <Text style={styles.locDesc}>Tap the button to pinpoint your exact clinic location on the map.</Text>
              </View>
            </View>

            {locationCoords ? (
              <View style={styles.locPinRow}>
                <Ionicons name="location" size={16} color="#16A34A" />
                <Text style={styles.locPinText} numberOfLines={1}>{locationCoords}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.locActionBtn}
              onPress={detectLocation}
              disabled={detectingLoc}
              activeOpacity={0.85}
            >
              {detectingLoc ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="locate" size={18} color="#FFFFFF" />
              )}
              <Text style={styles.locActionTxt}>
                {detectingLoc ? 'Locating…' : (locationCoords ? 'Update Precise Location' : 'Get Precise Location')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* City */}
          <Text style={styles.label}>City <Text style={styles.required}>*</Text></Text>
          <CityPicker value={city} onSelect={setCity} placeholder="Select your city" />

          {/* About / Biography */}
          <Text style={styles.label}>About You (Biography) <Text style={styles.required}>*</Text></Text>
          <View style={[styles.inputContainer, { height: 100, alignItems: 'flex-start', paddingTop: 12 }]}>
            <Ionicons name="information-circle-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { height: '100%', textAlignVertical: 'top' }]}
              value={about}
              onChangeText={setAbout}
              placeholder="Write a few lines about your professional background, expertise, and what makes your practice unique..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* ====== Register Button ====== */}
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => handleSaveProfile(false)}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.registerBtnInner}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={styles.registerButtonText}>Save Profile & Continue</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Skip — finish details/documents later */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => handleSaveProfile(true)}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <Text style={styles.skipButtonText}>Skip for now — complete later</Text>
        </TouchableOpacity>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={18} color="#64748B" />
          <Text style={styles.securityText}>Your information is secure and protected.</Text>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Web avatar cropper — drag to reposition + zoom before saving */}
      <Modal visible={!!cropper} transparent animationType="fade" onRequestClose={() => setCropper(null)}>
        <View style={styles.upOverlay}>
          <View style={styles.upCard}>
            {!!cropper && (
              <AvatarCropper uri={cropper.uri} out={512} onCancel={() => setCropper(null)} onDone={onCropped} />
            )}
          </View>
        </View>
      </Modal>

      {/* Upload progress window (during submit) */}
      <Modal visible={!!upProgress} transparent animationType="fade">
        <View style={styles.upOverlay}>
          <View style={styles.upCard}>
            <View style={styles.upIconWrap}>
              <Ionicons name="cloud-upload" size={26} color="#0052FF" />
            </View>
            <Text style={styles.upTitle}>Uploading documents</Text>
            <Text style={styles.upSub}>
              {upProgress ? `${upProgress.label} · ${upProgress.index} of ${upProgress.total}` : ''}
            </Text>
            <View style={styles.upTrack}>
              <View style={[styles.upFill, { width: `${upProgress?.percent || 0}%` }]} />
            </View>
            <Text style={styles.upPct}>{upProgress?.percent || 0}%</Text>
            <View style={styles.upBusyRow}>
              <ActivityIndicator size="small" color="#0052FF" />
              <Text style={styles.upBusyText}>Please keep this screen open…</Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A1551',
  },
  container: {
    padding: 20,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A1551',
  },
  badgeDark: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  badgeDarkText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  badgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  badgeGreenText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },

  // Labels & Inputs
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A1551',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    height: '100%',
  },
  locateBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Precise location card (between Address and City)
  locCard: {
    backgroundColor: '#F8FAFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    padding: 14,
    marginBottom: 6,
  },
  locCardHead: { flexDirection: 'row', alignItems: 'center' },
  locIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1, borderColor: '#BFDBFE',
    justifyContent: 'center', alignItems: 'center',
  },
  locTitle: { fontSize: 14, fontWeight: '700', color: '#0A1551' },
  locDesc: { fontSize: 11.5, color: '#64748B', marginTop: 2, lineHeight: 16 },
  locPinRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1, borderColor: '#BBF7D0',
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
    marginTop: 12,
  },
  locPinText: { flex: 1, marginLeft: 8, fontSize: 12.5, fontWeight: '600', color: '#15803D' },
  locActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0052FF',
    borderRadius: 12, paddingVertical: 12,
    marginTop: 12,
    shadowColor: '#0052FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
  },
  locActionTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginLeft: 8 },

  // Dropdown
  dropdownText: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },

  // Upload Buttons
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 14,
  },
  uploadThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  // Upload progress window
  upOverlay: { flex: 1, backgroundColor: 'rgba(10,21,81,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  upCard: { width: Math.min(Dimensions.get('window').width - 40, 360), backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 30, elevation: 12 },
  upIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#EFF4FF', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  upTitle: { fontSize: 16.5, fontWeight: '800', color: '#0A1551' },
  upSub: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '600', textAlign: 'center' },
  upTrack: { width: '100%', height: 8, borderRadius: 4, backgroundColor: '#E8EFFF', overflow: 'hidden', marginTop: 16 },
  upFill: { height: 8, borderRadius: 4, backgroundColor: '#0052FF' },
  upPct: { fontSize: 13, fontWeight: '800', color: '#0052FF', marginTop: 8 },
  upBusyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  upBusyText: { fontSize: 12.5, color: '#64748B', fontWeight: '600' },
  uploadIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  uploadTextWrap: {
    flex: 1,
  },
  uploadLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A1551',
    marginBottom: 2,
  },
  uploadSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  uploadFileSelected: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
  },

  // Register Button
  registerButton: {
    backgroundColor: '#0052FF',
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0052FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  registerBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 'bold',
  },
  skipButton: {
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  skipButtonText: {
    color: '#475569',
    fontSize: 14.5,
    fontWeight: '600',
  },

  // Security Note
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  securityText: {
    color: '#64748B',
    fontSize: 13,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: Math.min(width - 48, 420),
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A1551',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  modalOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#334155',
  },
  modalOptionTextActive: {
    color: '#0052FF',
    fontWeight: '600',
  },
});
