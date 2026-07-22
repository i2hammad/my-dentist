import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Platform, Alert, Image, Modal, FlatList, Dimensions, Share
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import storage from '../../config/storage';
import { appendImageFile } from '../../utils/formImage';
import { compressImage, getByteSize, formatBytes } from '../../utils/imageTools';
import AvatarCropper from '../../components/AvatarCropper';
import { sanitizePhone } from '../../utils/phone';
import { PK_CITIES } from '../../config/cities';
import API_BASE_URL from '../../config/api';
import { openWhatsApp, openSupportEmail, SUPPORT_WHATSAPP, SUPPORT_EMAIL } from '../../utils/support';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const SPECIALISATIONS = [
  'General', 'Orthodontist', 'Implant Specialist', 'Cosmetic Dentist',
  'Pediatric Dentist', 'Oral Surgeon', 'Endodontist', 'Periodontist', 'Prosthodontist'
];
const GENDERS = ['Male', 'Female', 'Other'];
const EXPERIENCE_OPTIONS = [...Array.from({ length: 30 }, (_, i) => `${i + 1}`), '30+'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad2 = (n) => String(n).padStart(2, '0');

const parseClinicTime = (input) => {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const twentyFour = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFour) return Number(twentyFour[1]) * 60 + Number(twentyFour[2]);
  const twelveHour = raw.match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*([AaPp][Mm])$/);
  if (!twelveHour) return NaN;
  let h = Number(twelveHour[1]);
  const m = Number(twelveHour[2]);
  const meridiem = twelveHour[3].toUpperCase();
  if (meridiem === 'PM' && h !== 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

const formatClinicTime = (minutes) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

const normalizeClinicRange = (start, end, label) => {
  const hasStart = String(start || '').trim().length > 0;
  const hasEnd = String(end || '').trim().length > 0;
  if (!hasStart && !hasEnd) return null;
  if (!hasStart || !hasEnd) throw new Error(`${label} session must include both start and end time.`);
  const startMin = parseClinicTime(start);
  const endMin = parseClinicTime(end);
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) {
    throw new Error(`${label} session time must be in HH:mm format, for example 09:00 or 17:30.`);
  }
  if (startMin >= endMin) throw new Error(`${label} session start time must be before end time.`);
  return { start: formatClinicTime(startMin), end: formatClinicTime(endMin) };
};

const normalizeClinicTimingForSave = (formData) => {
  const availableDays = (formData.availableDays || []).filter((day) => DAY_SHORT.includes(day));
  if (!availableDays.length) throw new Error('Select at least one available clinic day.');
  const morning = normalizeClinicRange(formData.morningStart, formData.morningEnd, 'Morning');
  const evening = normalizeClinicRange(formData.eveningStart, formData.eveningEnd, 'Evening');
  const ranges = [morning, evening].filter(Boolean);
  if (!ranges.length) throw new Error('Set at least one complete clinic timing session.');
  const offDays = DAY_SHORT.filter((day) => !availableDays.includes(day));
  return {
    days: availableDays.join(', '),
    startTime: ranges[0].start,
    endTime: ranges[ranges.length - 1].end,
    morningStart: morning ? morning.start : '',
    morningEnd: morning ? morning.end : '',
    eveningStart: evening ? evening.start : '',
    eveningEnd: evening ? evening.end : '',
    availableDays,
    offDays,
  };
};

export default function DoctorProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownConfig, setDropdownConfig] = useState({ field: '', options: [], label: '' });
  // Admin "view-as" (impersonation) sessions may edit any locked field.
  const [impersonating, setImpersonating] = useState(false);
  // Whether this doctor has been verified/approved by admin (pmdcVerified).
  const [pmdcVerified, setPmdcVerified] = useState(false);
  // Fields that had a saved value at load time — captured so typing doesn't unlock.
  const [lockedFields, setLockedFields] = useState({});
  // Verification documents: editable until admin verifies, then locked. Lets a
  // doctor re-upload a bad scan before approval; frozen once verified.
  const VERIFY_DOCS = ['licenseCert', 'idFront', 'idBack'];
  // Identity fields lock as soon as they're set. Verification docs lock only once
  // set AND admin-verified. Impersonation (admin view-as) overrides all locks.
  const isLocked = (field) => {
    if (impersonating) return false;
    if (!lockedFields[field]) return false;
    if (VERIFY_DOCS.includes(field)) return pmdcVerified; // docs: also need verification
    return true; // identity fields: locked once set
  };

  const [formData, setFormData] = useState({
    mobileNumber: '',
    emailAddress: '',
    pmdcNumber: '',
    fullName: '',
    gender: '',
    specialization: '',
    experience: '',
    clinicContact: '',
    clinicName: '',
    address: '',
    city: '',
    coordinates: '',
    about: '',
    avatar: '',
    licenseCert: '',
    idFront: '',
    idBack: '',
    morningStart: '', morningEnd: '',
    eveningStart: '', eveningEnd: '',
    availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    offDays: ['Sun'],
  });

  // ── Referral program (one code, two independently-tracked sections) ──
  const [referral, setReferral] = useState(null); // { code, pointsPerReferral, patient:{...}, doctor:{...}, webLink }
  const [refCodeInput, setRefCodeInput] = useState('');
  const [applyingRef, setApplyingRef] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchDoctorReferral();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = await storage.getItem('userToken');
      // Admin view-as session? Then the identity fields stay editable.
      const imp = (await storage.getItem('impersonating')) === '1';
      setImpersonating(imp);
      const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success && res.data.data.profile) {
        const p = res.data.data.profile;
        const u = res.data.data.user;
        // Admin-verified? Verification docs freeze once this is true.
        setPmdcVerified(!!p.pmdcVerified);
        // Lock each identity/verification field that already has a saved value.
        setLockedFields({
          fullName: !!(p.fullName && p.fullName.trim()),
          gender: !!(p.gender && p.gender.trim()),
          mobileNumber: !!((p.phone || p.mobileNumber || '').trim()),
          pmdcNumber: !!(p.pmdcNumber && p.pmdcNumber.trim()),
          emailAddress: !!(u?.email && u.email.trim()),
          avatar: !!(p.photo && p.photo.trim()),
          licenseCert: !!(p.licenseCert && p.licenseCert.trim()),
          idFront: !!(p.idFront && p.idFront.trim()),
          idBack: !!(p.idBack && p.idBack.trim()),
        });
        setFormData({
          fullName: p.fullName || '',
          gender: p.gender || '',
          specialization: p.specialization || '',
          experience: p.experience ? p.experience.toString() : '',
          clinicName: p.clinicName || '',
          clinicContact: p.clinicContact || '',
          address: p.address || '',
          city: p.city || '',
          coordinates: p.coordinates || '',
          about: p.about || '',
          avatar: p.photo || '',
          mobileNumber: p.phone || p.mobileNumber || '',
          pmdcNumber: p.pmdcNumber || '',
          emailAddress: u?.email || '',
          licenseCert: p.licenseCert || '',
          idFront: p.idFront || '',
          idBack: p.idBack || '',
          morningStart: p.clinicTiming?.morningStart || '',
          morningEnd: p.clinicTiming?.morningEnd || '',
          eveningStart: p.clinicTiming?.eveningStart || '',
          eveningEnd: p.clinicTiming?.eveningEnd || '',
          availableDays: p.clinicTiming?.availableDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          offDays: p.clinicTiming?.offDays || ['Sun'],
        });
      }
    } catch (error) {
      console.log('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorReferral = async () => {
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.get(`${API_BASE_URL}/api/users/doctor-referral`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setReferral(res.data.data);
    } catch (e) {
      console.log('Error fetching doctor referral:', e?.response?.data?.message || e.message);
    }
  };

  // Share the code with either patients or other doctors (same code, different framing).
  const shareReferral = async (audience) => {
    if (!referral?.code) {
      Alert.alert('Please wait', 'Your referral code is still loading. Check your connection and try again in a moment.');
      return;
    }
    const link = referral.webLink || '';
    const message = audience === 'doctor'
      ? `Join me on My Dentist! Sign up as a dentist with my referral code ${referral.code} — we both earn 100 points after your first completed patient treatment. ${link}`
      : `Book your dental care on My Dentist and use my referral code ${referral.code} — we both earn 100 points after your first completed treatment. ${link}`;
    try {
      // On web, react-native Share is unreliable — use the Web Share API, else copy to clipboard.
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title: 'My Dentist Referral', text: message });
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(message);
          Alert.alert('Copied', 'Referral message copied to your clipboard — paste it anywhere to share.');
        } else {
          Alert.alert('Your Referral Code', `${referral.code}\n\n${message}`);
        }
      } else {
        await Share.share({ message, title: 'My Dentist Referral' });
      }
    } catch (e) { /* user dismissed the share sheet */ }
  };

  // This doctor enters ANOTHER doctor's code (doctor→doctor referral).
  const applyDoctorReferralCode = async () => {
    const code = refCodeInput.trim().toUpperCase();
    if (!code) return Alert.alert('Referral Code', 'Please enter a referral code.');
    setApplyingRef(true);
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.post(
        `${API_BASE_URL}/api/users/doctor-referral/apply`,
        { code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        Alert.alert('Referral Applied', res.data.message || 'Referral code applied successfully.');
        setRefCodeInput('');
        fetchDoctorReferral();
      }
    } catch (e) {
      Alert.alert('Could Not Apply', e?.response?.data?.message || 'Invalid referral code. Please try again.');
    } finally {
      setApplyingRef(false);
    }
  };

  const openDropdown = (field, options, label) => {
    setDropdownConfig({ field, options, label });
    setDropdownVisible(true);
  };

  const selectDropdownValue = (value) => {
    setFormData(prev => ({ ...prev, [dropdownConfig.field]: value }));
    setDropdownVisible(false);
  };

  const setField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const DAYS = DAY_SHORT;
  const toggleDay = (day) => setFormData(prev => {
    const isAvail = (prev.availableDays || []).includes(day);
    if (isAvail) {
      return { ...prev, availableDays: prev.availableDays.filter(d => d !== day), offDays: [...new Set([...(prev.offDays || []), day])] };
    }
    return { ...prev, offDays: (prev.offDays || []).filter(d => d !== day), availableDays: [...new Set([...(prev.availableDays || []), day])] };
  });

  // ── Upload flow with an auto-compress + progress window ──────────────────
  // up: { field, label, stage, uri, origSize, size, percent, error }
  //   stage: 'compressing' | 'uploading' | 'done' | 'error'
  const [up, setUp] = useState(null);
  const [cropper, setCropper] = useState(null); // web avatar crop step: { uri, fileName, origSize, label }

  // Web avatar cropper confirmed → upload the cropped blob (already 512², JPEG).
  const onCropped = async (out) => {
    const c = cropper;
    setCropper(null);
    if (!out) return;
    setUp({ field: 'avatar', label: c?.label || 'Profile Picture', stage: 'uploading', uri: out.uri, origSize: c?.origSize || 0, size: out.size, percent: 0, error: '', square: true });
    try {
      const token = await storage.getItem('userToken');
      const fd = new FormData();
      await appendImageFile(fd, 'file', out.uri, c?.fileName || 'avatar.jpg');
      const url = await uploadWithProgress(fd, token, (percent) => setUp((s) => (s ? { ...s, percent } : s)));
      setFormData((prev) => ({ ...prev, avatar: url }));
      await axios.put(`${API_BASE_URL}/api/users/doctor-profile`, { photo: url }, { headers: { Authorization: `Bearer ${token}` } });
      setUp((s) => s && { ...s, stage: 'done', percent: 100 });
      fetchProfile();
    } catch (err) {
      setUp((s) => s && { ...s, stage: 'error', error: err.message || 'Upload failed' });
    }
  };

  const pickDocument = async (field, label) => {
    try {
      const isAvatar = field === 'avatar';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // Native: use the OS crop UI (drag/resize). Web: allowsEditing is a no-op,
        // so we show our own draggable AvatarCropper instead.
        allowsEditing: isAvatar && !isWeb,
        aspect: isAvatar ? [1, 1] : undefined,
        quality: 1,                    // pick full-quality; we compress ourselves
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      // Web avatar → open the reposition/zoom cropper first.
      if (isAvatar && isWeb) {
        setCropper({ uri: asset.uri, fileName: asset.fileName || 'avatar.jpg', origSize: asset.fileSize || 0, label });
        return;
      }
      runUpload(field, label, asset, isAvatar);
    } catch (err) {
      console.log('Pick error:', err);
    }
  };

  const runUpload = async (field, label, asset, square = false) => {
    const origSize = asset.fileSize || (await getByteSize(asset.uri));
    setUp({ field, label, stage: 'compressing', uri: asset.uri, origSize, size: 0, percent: 0, error: '', square });
    try {
      // 1) Compress / resize. Profile photo → fixed 512×512 square; docs → cap 1600.
      const out = square
        ? await compressImage(asset.uri, { quality: 0.75, square: 512 })
        : await compressImage(asset.uri, { quality: 0.6, maxDim: 1600 });
      setUp((s) => s && { ...s, uri: out.uri, size: out.size, stage: 'uploading', percent: 0 });

      // 2) Upload with progress.
      const token = await storage.getItem('userToken');
      const fd = new FormData();
      await appendImageFile(fd, 'file', out.uri, asset.fileName || 'upload.jpg');
      const url = await uploadWithProgress(fd, token, (percent) =>
        setUp((s) => (s ? { ...s, percent } : s))
      );

      // 3) Persist the URL on the doctor profile.
      setFormData((prev) => ({ ...prev, [field]: url }));
      const patch = field === 'avatar' ? { photo: url } : { [field]: url };
      await axios.put(`${API_BASE_URL}/api/users/doctor-profile`, patch, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUp((s) => s && { ...s, stage: 'done', percent: 100 });
      fetchProfile();
    } catch (err) {
      setUp((s) => s && { ...s, stage: 'error', error: err.message || 'Upload failed' });
    }
  };

  // Upload via XHR so we get real upload-progress events (fetch can't report them).
  const uploadWithProgress = (fd, token, onProgress) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/api/users/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300 && data.success) resolve(data.data.url);
          else reject(new Error(data.message || `Upload failed (${xhr.status})`));
        } catch (e) { reject(new Error('Unexpected server response')); }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(fd);
    });

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await storage.getItem('userToken');

      const payload = {};
      if (formData.fullName) payload.fullName = formData.fullName;
      if (formData.specialization) payload.specialization = formData.specialization;
      if (formData.experience) payload.experience = formData.experience === '30+' ? 30 : Number(formData.experience) || 0;
      if (formData.gender) payload.gender = formData.gender;
      if (formData.clinicContact) payload.clinicContact = formData.clinicContact;
      if (formData.clinicName) payload.clinicName = formData.clinicName;
      if (formData.address) payload.address = formData.address;
      if (formData.city) payload.city = formData.city;
      if (formData.coordinates) payload.coordinates = formData.coordinates;
      if (formData.mobileNumber) { payload.phone = formData.mobileNumber; payload.mobileNumber = formData.mobileNumber; }
      if (formData.pmdcNumber) payload.pmdcNumber = formData.pmdcNumber;
      if (formData.about) payload.about = formData.about;
      if (formData.avatar) payload.photo = formData.avatar;
      if (formData.licenseCert) payload.licenseCert = formData.licenseCert;
      if (formData.idFront) payload.idFront = formData.idFront;
      if (formData.idBack) payload.idBack = formData.idBack;
      const clinicTiming = normalizeClinicTimingForSave(formData);
      payload.clinicTiming = clinicTiming;

      await axios.put(`${API_BASE_URL}/api/users/doctor-profile`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFormData(prev => ({
        ...prev,
        morningStart: clinicTiming.morningStart,
        morningEnd: clinicTiming.morningEnd,
        eveningStart: clinicTiming.eveningStart,
        eveningEnd: clinicTiming.eveningEnd,
        availableDays: clinicTiming.availableDays,
        offDays: clinicTiming.offDays,
      }));

      await fetchProfile();
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={isWeb ? [] : ['top']} style={styles.safeArea}>
      <View style={[styles.headerBar, isWeb && styles.webBlock]}>
        {!isWeb && (
          <TouchableOpacity onPress={() => navigation.canGoBack() && navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#0052FF" />
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Text style={styles.headerSub}>Edit and update your professional information.</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.container, isWeb && styles.webBlock]}>

        {/* Personal Information */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBg}>
              <Ionicons name="lock-closed" size={20} color="#0052FF" />
            </View>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <View style={styles.badgeGrey}><Text style={styles.badgeGreyText}>Private</Text></View>
          </View>

          <FieldRow icon="call-outline" label="Mobile" placeholder="03XXXXXXXXX" value={formData.mobileNumber} onChangeText={t => setField('mobileNumber', sanitizePhone(t))} keyboardType="phone-pad" maxLength={11} editable={!isLocked('mobileNumber')} locked={isLocked('mobileNumber')} />
          <FieldRow icon="mail-outline" label="Email" placeholder="Email address" value={formData.emailAddress} editable={false} locked={isLocked('emailAddress')} />
          <FieldRow icon="id-card-outline" label="PMDC No." placeholder="PMDC Number" value={formData.pmdcNumber} onChangeText={t => setField('pmdcNumber', t)} editable={!isLocked('pmdcNumber')} locked={isLocked('pmdcNumber')} />

          <UploadRow icon="person-circle-outline" label="Profile Picture" subLabel={isLocked('avatar') ? 'Locked — contact admin to change' : 'Clear face photo · square, 512×512px'} onPress={() => { if (!isLocked('avatar')) pickDocument('avatar', 'Profile Picture'); }} imageUrl={formData.avatar} locked={isLocked('avatar')} />
          <UploadRow icon="document-text-outline" label="License / Registration" subLabel={isLocked('licenseCert') ? 'Locked — contact admin to change' : 'Clear scan · portrait, ~1200×1600px'} onPress={() => { if (!isLocked('licenseCert')) pickDocument('licenseCert', 'License / Registration'); }} imageUrl={formData.licenseCert} locked={isLocked('licenseCert')} />
          <UploadRow icon="id-card-outline" label="ID Card Front" subLabel={isLocked('idFront') ? 'Locked — contact admin to change' : 'Clear photo · ~1000×640px'} onPress={() => { if (!isLocked('idFront')) pickDocument('idFront', 'ID Card Front'); }} imageUrl={formData.idFront} locked={isLocked('idFront')} />
          <UploadRow icon="id-card-outline" label="ID Card Back" subLabel={isLocked('idBack') ? 'Locked — contact admin to change' : 'Clear photo · ~1000×640px'} onPress={() => { if (!isLocked('idBack')) pickDocument('idBack', 'ID Card Back'); }} imageUrl={formData.idBack} locked={isLocked('idBack')} />
        </View>

        {/* Professional Information */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBg, { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="person" size={20} color="#0052FF" />
            </View>
            <Text style={styles.sectionTitle}>Professional Information</Text>
            <View style={styles.badgeGreen}><Text style={styles.badgeGreenText}>Public</Text></View>
          </View>

          <FieldRow icon="person-outline" label="Full Name" placeholder="Dr. Full Name" value={formData.fullName} onChangeText={t => setField('fullName', t)} editable={!isLocked('fullName')} locked={isLocked('fullName')} />

          <DropdownRow
            icon="male-female-outline" label="Gender"
            value={formData.gender} placeholder="Select Gender"
            onPress={() => { if (!isLocked('gender')) openDropdown('gender', GENDERS, 'Select Gender'); }}
            locked={isLocked('gender')}
          />
          <DropdownRow
            icon="people-outline" label="Specialisation"
            value={formData.specialization} placeholder="Select Specialisation"
            onPress={() => openDropdown('specialization', SPECIALISATIONS, 'Select Specialisation')}
          />
          <DropdownRow
            icon="git-network-outline" label="Experience"
            value={formData.experience ? `${formData.experience} yr${formData.experience === '1' ? '' : 's'}` : ''}
            placeholder="Select Experience"
            onPress={() => openDropdown('experience', EXPERIENCE_OPTIONS, 'Years of Experience')}
          />

          <FieldRow icon="call-outline" label="Clinic Contact" placeholder="03XXXXXXXXX" value={formData.clinicContact} onChangeText={t => setField('clinicContact', sanitizePhone(t))} keyboardType="phone-pad" maxLength={11} />
          <FieldRow icon="business-outline" label="Clinic Name" placeholder="Clinic / Hospital name" value={formData.clinicName} onChangeText={t => setField('clinicName', t)} />
          <FieldRow icon="location-outline" label="Address" placeholder="Clinic address" value={formData.address} onChangeText={t => setField('address', t)} />
          <DropdownRow
            icon="navigate-outline" label="City"
            value={formData.city} placeholder="Select City"
            onPress={() => openDropdown('city', PK_CITIES, 'Select City')}
          />

          {/* GPS Location */}
          <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: formData.coordinates ? '#ECFDF5' : '#EFF6FF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: formData.coordinates ? '#16A34A' : '#0052FF' }}
              onPress={async () => {
                try {
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status !== 'granted') { Alert.alert('Permission denied', 'Location permission is required.'); return; }
                  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                  const coords = `${loc.coords.latitude.toFixed(6)},${loc.coords.longitude.toFixed(6)}`;
                  setField('coordinates', coords);
                  Alert.alert('Location Set', `Coordinates saved: ${coords}`);
                } catch (e) { Alert.alert('Error', 'Could not get location. Try again.'); }
              }}
            >
              <Ionicons name={formData.coordinates ? 'checkmark-circle' : 'locate-outline'} size={20} color={formData.coordinates ? '#16A34A' : '#0052FF'} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: formData.coordinates ? '#16A34A' : '#0052FF' }}>
                  {formData.coordinates ? 'Location Set ✓' : 'Set Clinic Location (GPS)'}
                </Text>
                {formData.coordinates ? (
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{formData.coordinates}</Text>
                ) : (
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Tap to use your current GPS location</Text>
                )}
              </View>
              {formData.coordinates && (
                <TouchableOpacity onPress={() => setField('coordinates', '')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.labelCol}>
              <Ionicons name="information-circle-outline" size={18} color="#0052FF" style={{ marginTop: 2 }} />
              <Text style={styles.fieldLabel}>About</Text>
            </View>
            <View style={[styles.inputCol, { height: 80, alignItems: 'flex-start', paddingTop: 10 }]}>
              <TextInput
                style={[styles.fieldInput, { height: '100%', textAlignVertical: 'top' }]}
                value={formData.about}
                onChangeText={t => setField('about', t)}
                placeholder="Professional background & expertise..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
              />
            </View>
          </View>
        </View>

        {/* Clinic Timings */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBg, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="time-outline" size={18} color="#D97706" />
            </View>
            <Text style={styles.sectionTitle}>Clinic Timings</Text>
          </View>

          <Text style={styles.timingLabel}>Morning Session</Text>
          <View style={styles.timeRow}>
            <TextInput style={styles.timeInput} value={formData.morningStart} onChangeText={t => setField('morningStart', t)} placeholder="From e.g. 09:00" placeholderTextColor="#94A3B8" />
            <Text style={styles.timeDash}>—</Text>
            <TextInput style={styles.timeInput} value={formData.morningEnd} onChangeText={t => setField('morningEnd', t)} placeholder="To e.g. 13:00" placeholderTextColor="#94A3B8" />
          </View>

          <Text style={styles.timingLabel}>Evening Session</Text>
          <View style={styles.timeRow}>
            <TextInput style={styles.timeInput} value={formData.eveningStart} onChangeText={t => setField('eveningStart', t)} placeholder="From e.g. 17:00" placeholderTextColor="#94A3B8" />
            <Text style={styles.timeDash}>—</Text>
            <TextInput style={styles.timeInput} value={formData.eveningEnd} onChangeText={t => setField('eveningEnd', t)} placeholder="To e.g. 21:00" placeholderTextColor="#94A3B8" />
          </View>

          <Text style={styles.timingLabel}>Available Days <Text style={{ color: '#94A3B8', fontWeight: '400' }}>(tap to toggle — greyed = clinic off)</Text></Text>
          <View style={styles.daysWrap}>
            {DAYS.map(day => {
              const avail = (formData.availableDays || []).includes(day);
              return (
                <TouchableOpacity key={day} onPress={() => toggleDay(day)} style={[styles.dayChip, avail ? styles.dayChipOn : styles.dayChipOff]}>
                  <Text style={[styles.dayChipText, avail ? styles.dayChipTextOn : styles.dayChipTextOff]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {(formData.offDays || []).length > 0 && (
            <Text style={styles.offDayNote}>Clinic off: {formData.offDays.join(', ')}</Text>
          )}
        </View>

        {/* ── Refer a Patient (doctor → patient referral) ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBg, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="person-add-outline" size={18} color="#0052FF" />
            </View>
            <Text style={styles.sectionTitle}>Refer a Patient</Text>
          </View>
          <Text style={styles.refDesc}>
            Share your code with patients. When a patient you refer completes their first treatment with any dentist, you both earn {referral?.pointsPerReferral || 100} points.
          </Text>

          <View style={styles.refCodeBox}>
            <Text style={styles.refCodeLabel}>YOUR REFERRAL CODE</Text>
            <Text style={styles.refCodeValue}>{referral?.code || '••••••'}</Text>
          </View>

          <View style={styles.refStatsRow}>
            <View style={styles.refStat}>
              <Text style={styles.refStatNum}>{referral?.patient?.referredCount ?? 0}</Text>
              <Text style={styles.refStatLabel}>Patients referred</Text>
            </View>
            <View style={styles.refStatDivider} />
            <View style={styles.refStat}>
              <Text style={[styles.refStatNum, { color: '#16A34A' }]}>{referral?.patient?.pointsEarned ?? 0}</Text>
              <Text style={styles.refStatLabel}>Points earned</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.refShareBtn} onPress={() => shareReferral('patient')} activeOpacity={0.85}>
            <Ionicons name="share-social-outline" size={16} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.refShareBtnText}>Share with Patients</Text>
          </TouchableOpacity>
        </View>

        {/* ── Refer a Doctor (doctor → doctor referral) ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBg, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="people-outline" size={18} color="#7C3AED" />
            </View>
            <Text style={[styles.sectionTitle, { color: '#7C3AED' }]}>Refer a Doctor</Text>
          </View>
          <Text style={styles.refDesc}>
            Invite another dentist. When the doctor you refer completes their first patient treatment, you both earn {referral?.pointsPerReferral || 100} points.
          </Text>

          <View style={[styles.refCodeBox, { borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' }]}>
            <Text style={[styles.refCodeLabel, { color: '#7C3AED' }]}>YOUR REFERRAL CODE</Text>
            <Text style={[styles.refCodeValue, { color: '#5B21B6' }]}>{referral?.code || '••••••'}</Text>
          </View>

          <View style={styles.refStatsRow}>
            <View style={styles.refStat}>
              <Text style={styles.refStatNum}>{referral?.doctor?.referredCount ?? 0}</Text>
              <Text style={styles.refStatLabel}>Doctors referred</Text>
            </View>
            <View style={styles.refStatDivider} />
            <View style={styles.refStat}>
              <Text style={[styles.refStatNum, { color: '#16A34A' }]}>{referral?.doctor?.pointsEarned ?? 0}</Text>
              <Text style={styles.refStatLabel}>Points earned</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.refShareBtn, { backgroundColor: '#7C3AED' }]} onPress={() => shareReferral('doctor')} activeOpacity={0.85}>
            <Ionicons name="share-social-outline" size={16} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.refShareBtnText}>Share with Doctors</Text>
          </TouchableOpacity>

          {referral?.doctor?.referredByApplied ? (
            <View style={styles.refAppliedRow}>
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" style={{ marginRight: 6 }} />
              <Text style={styles.refAppliedText}>You joined using a dentist's referral code.</Text>
            </View>
          ) : (
            <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 14 }}>
              <Text style={styles.refApplyLabel}>Were you referred by a dentist? Enter their code:</Text>
              <View style={styles.refApplyRow}>
                <TextInput
                  style={styles.refApplyInput}
                  value={refCodeInput}
                  onChangeText={(t) => setRefCodeInput(t.toUpperCase())}
                  placeholder="e.g. DR7F3A2B"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  maxLength={12}
                />
                <TouchableOpacity style={styles.refApplyBtn} onPress={applyDoctorReferralCode} disabled={applyingRef}>
                  {applyingRef ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.refApplyBtnText}>Apply</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Support & Help (inside the scroll so all profile details stay reachable) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBg, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="help-buoy-outline" size={18} color="#16A34A" />
            </View>
            <Text style={styles.sectionTitle}>Support & Help</Text>
          </View>
          <Text style={styles.supportHint}>In case of any query, problem or support — reach us directly.</Text>

          <TouchableOpacity style={styles.supportRow} onPress={() => openWhatsApp('Hello, I am a doctor on My Dentist and need support.')}>
            <View style={[styles.supportIcon, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportLabel}>WhatsApp Support</Text>
              <Text style={styles.supportValue}>{SUPPORT_WHATSAPP}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.supportRow} onPress={() => openSupportEmail('My Dentist — Doctor Support')}>
            <View style={[styles.supportIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="mail-outline" size={22} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportLabel}>Email Support</Text>
              <Text style={styles.supportValue}>{SUPPORT_EMAIL}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Save footer */}
      <View style={[styles.footer, isWeb && styles.webFooter]}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFF" /> : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
        <View style={styles.secureRow}>
          <Ionicons name="lock-closed-outline" size={12} color="#64748B" />
          <Text style={styles.secureText}>Your information is secure and protected.</Text>
        </View>
      </View>

      {/* Dropdown modal */}
      <Modal visible={dropdownVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{dropdownConfig.label}</Text>
              <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                <Ionicons name="close" size={24} color="#0A1551" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={dropdownConfig.options}
              keyExtractor={item => item}
              renderItem={({ item }) => {
                const current = formData[dropdownConfig.field];
                const isSelected = current === item;
                return (
                  <TouchableOpacity
                    style={[styles.modalOption, isSelected && styles.modalOptionActive]}
                    onPress={() => selectDropdownValue(item)}
                  >
                    <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]}>{item}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color="#0052FF" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Web avatar cropper — drag to reposition + zoom before upload */}
      <Modal visible={!!cropper} transparent animationType="fade" onRequestClose={() => setCropper(null)}>
        <View style={styles.upOverlay}>
          <View style={styles.upCard}>
            {!!cropper && (
              <AvatarCropper
                uri={cropper.uri}
                out={512}
                onCancel={() => setCropper(null)}
                onDone={onCropped}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Upload progress window — compress → upload with a live progress bar */}
      <Modal visible={!!up} transparent animationType="fade" onRequestClose={() => up?.stage !== 'uploading' && setUp(null)}>
        <View style={styles.upOverlay}>
          <View style={styles.upCard}>
            {/* Header */}
            <View style={styles.upHeaderRow}>
              <View style={styles.upIconWrap}>
                <Ionicons
                  name={up?.stage === 'done' ? 'checkmark-circle' : up?.stage === 'error' ? 'alert-circle' : 'cloud-upload'}
                  size={22}
                  color={up?.stage === 'done' ? '#16A34A' : up?.stage === 'error' ? '#DC2626' : '#0052FF'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.upTitle} numberOfLines={1}>{up?.label || 'Upload'}</Text>
                <Text style={styles.upStageText}>
                  {up?.stage === 'compressing' && 'Optimizing image…'}
                  {up?.stage === 'uploading' && `Uploading… ${up?.percent || 0}%`}
                  {up?.stage === 'done' && 'Uploaded successfully'}
                  {up?.stage === 'error' && (up?.error || 'Upload failed')}
                </Text>
              </View>
            </View>

            {/* Preview */}
            {!!up?.uri && (
              up?.square ? (
                <View style={styles.upAvatarWrap}>
                  <Image source={{ uri: up.uri }} style={styles.upAvatarPreview} resizeMode="cover" />
                </View>
              ) : (
                <Image source={{ uri: up.uri }} style={styles.upPreview} resizeMode="cover" />
              )
            )}

            {/* Size row */}
            <View style={styles.upSizeRow}>
              <View style={styles.upSizePill}>
                <Text style={styles.upSizeLabel}>Original</Text>
                <Text style={styles.upSizeVal}>{formatBytes(up?.origSize)}</Text>
              </View>
              <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
              <View style={[styles.upSizePill, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                <Text style={[styles.upSizeLabel, { color: '#15803D' }]}>Compressed</Text>
                <Text style={[styles.upSizeVal, { color: '#15803D' }]}>{up?.size ? formatBytes(up.size) : '…'}</Text>
              </View>
              {up?.origSize > 0 && up?.size > 0 && (
                <View style={styles.upSavePill}>
                  <Text style={styles.upSaveText}>-{Math.max(0, Math.round((1 - up.size / up.origSize) * 100))}%</Text>
                </View>
              )}
            </View>

            {/* Progress bar */}
            {(up?.stage === 'compressing' || up?.stage === 'uploading') && (
              <View style={styles.upTrack}>
                <View style={[styles.upFill, { width: `${up?.stage === 'uploading' ? (up?.percent || 0) : 8}%` }]} />
              </View>
            )}

            {/* Actions */}
            {up?.stage === 'done' && (
              <TouchableOpacity style={styles.upDoneBtn} onPress={() => setUp(null)}>
                <Text style={styles.upDoneText}>Done</Text>
              </TouchableOpacity>
            )}
            {up?.stage === 'error' && (
              <TouchableOpacity style={styles.upCloseBtn} onPress={() => setUp(null)}>
                <Text style={styles.upCloseText}>Close</Text>
              </TouchableOpacity>
            )}
            {(up?.stage === 'compressing' || up?.stage === 'uploading') && (
              <View style={styles.upBusyRow}>
                <ActivityIndicator size="small" color="#0052FF" />
                <Text style={styles.upBusyText}>Please wait…</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FieldRow({ icon, label, placeholder, value, onChangeText, keyboardType = 'default', editable = true, maxLength, locked = false }) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.labelCol}>
        <Ionicons name={icon} size={18} color="#0052FF" />
        <Text style={styles.fieldLabel}>{label}</Text>
        {locked && <Ionicons name="lock-closed" size={12} color="#94A3B8" style={{ marginLeft: 4 }} />}
      </View>
      <View style={[styles.inputCol, !editable && { backgroundColor: '#F8FAFC' }]}>
        <TextInput
          style={styles.fieldInput}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          editable={editable}
          maxLength={maxLength}
        />
      </View>
    </View>
  );
}

function DropdownRow({ icon, label, value, placeholder, onPress, locked = false }) {
  return (
    <TouchableOpacity style={styles.fieldRow} onPress={onPress} activeOpacity={locked ? 1 : 0.7}>
      <View style={styles.labelCol}>
        <Ionicons name={icon} size={18} color="#0052FF" />
        <Text style={styles.fieldLabel}>{label}</Text>
        {locked && <Ionicons name="lock-closed" size={12} color="#94A3B8" style={{ marginLeft: 4 }} />}
      </View>
      <View style={[styles.inputCol, { paddingRight: 8 }, locked && { backgroundColor: '#F8FAFC' }]}>
        <Text style={[styles.fieldInput, !value && { color: '#94A3B8' }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        {!locked && <Ionicons name="chevron-down" size={16} color="#64748B" />}
      </View>
    </TouchableOpacity>
  );
}

function UploadRow({ icon, label, subLabel, onPress, imageUrl, locked = false }) {
  return (
    <View style={[styles.uploadRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.labelColUpload}>
          <Ionicons name={icon} size={18} color="#0052FF" style={{ marginTop: 2 }} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.fieldLabelUpload}>{label}</Text>
              {locked && <Ionicons name="lock-closed" size={12} color="#94A3B8" style={{ marginLeft: 4 }} />}
            </View>
            <Text style={styles.fieldSubLabel}>{subLabel}</Text>
          </View>
        </View>
        {!locked && (
          <TouchableOpacity
            style={[styles.uploadBtn, imageUrl && { borderColor: '#16A34A', backgroundColor: '#F0FDF4' }]}
            onPress={onPress}
          >
            <Ionicons name={imageUrl ? 'checkmark-circle' : 'cloud-upload-outline'} size={16} color={imageUrl ? '#16A34A' : '#0052FF'} style={{ marginRight: 6 }} />
            <Text style={[styles.uploadBtnText, imageUrl && { color: '#16A34A' }]}>{imageUrl ? 'Replace' : 'Upload'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {!!imageUrl && (
        <View style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
          <Image
            source={{ uri: imageUrl.startsWith('http') || imageUrl.startsWith('file:') || imageUrl.startsWith('content:') ? imageUrl : `${API_BASE_URL}${imageUrl}` }}
            style={{ width: '100%', height: 160, resizeMode: 'cover' }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, backgroundColor: '#FAFAFA', position: 'relative' },
  backBtn: {
    position: 'absolute', left: 20, top: 16,
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  headerTitleContainer: { alignItems: 'center', marginTop: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0A1551' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 4, textAlign: 'center' },
  container: { padding: 16, paddingBottom: 40 },
  sectionCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 12, elevation: 1
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sectionIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0052FF', flex: 1 },
  badgeGrey: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeGreyText: { fontSize: 10, fontWeight: '600', color: '#475569' },
  badgeGreen: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeGreenText: { fontSize: 10, fontWeight: '600', color: '#16A34A' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  labelCol: { flexDirection: 'row', alignItems: 'center', width: 130 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#0A1551', marginLeft: 8 },
  inputCol: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 10, height: 44, paddingHorizontal: 12 },
  fieldInput: { flex: 1, fontSize: 13, color: '#0F172A' },
  uploadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 16 },
  labelColUpload: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, paddingRight: 10 },
  fieldLabelUpload: { fontSize: 13, fontWeight: '600', color: '#0A1551' },
  fieldSubLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  uploadBtnText: { fontSize: 12, fontWeight: '600', color: '#0052FF' },
  footer: { backgroundColor: '#FFF', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  // Web: center + cap content width so fields/images aren't stretched edge-to-edge.
  webBlock: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  webFooter: { alignItems: 'center' },
  saveBtn: { backgroundColor: '#0052FF', height: 42, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', ...(isWeb ? { width: '100%', maxWidth: 720, alignSelf: 'center' } : {}) },
  saveBtnText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  secureRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  secureText: { fontSize: 11, color: '#64748B', marginLeft: 4 },
  // ── Upload progress window ──
  upOverlay: { flex: 1, backgroundColor: 'rgba(10,21,81,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  upCard: { width: Math.min(width - 40, 400), backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 30, elevation: 12 },
  upHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  upIconWrap: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#EFF4FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  upTitle: { fontSize: 15.5, fontWeight: '800', color: '#0A1551' },
  upStageText: { fontSize: 12.5, color: '#64748B', marginTop: 2, fontWeight: '600' },
  upPreview: { width: '100%', height: 150, borderRadius: 12, backgroundColor: '#F1F5F9', marginBottom: 14 },
  upAvatarWrap: { alignItems: 'center', marginBottom: 14 },
  upAvatarPreview: { width: 132, height: 132, borderRadius: 66, backgroundColor: '#F1F5F9', borderWidth: 3, borderColor: '#E0EAFF' },
  upSizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  upSizePill: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  upSizeLabel: { fontSize: 10.5, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 },
  upSizeVal: { fontSize: 14, fontWeight: '800', color: '#0A1551', marginTop: 1 },
  upSavePill: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  upSaveText: { fontSize: 12, fontWeight: '800', color: '#15803D' },
  upTrack: { height: 8, borderRadius: 4, backgroundColor: '#E8EFFF', overflow: 'hidden', marginBottom: 14 },
  upFill: { height: 8, borderRadius: 4, backgroundColor: '#0052FF' },
  upBusyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  upBusyText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  upDoneBtn: { backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  upDoneText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '800' },
  upCloseBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  upCloseText: { color: '#DC2626', fontSize: 14.5, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: Math.min(width - 48, 420), maxHeight: '70%', backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0A1551' },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  modalOptionActive: { backgroundColor: '#EFF6FF' },
  modalOptionText: { fontSize: 15, color: '#334155' },
  modalOptionTextActive: { color: '#0052FF', fontWeight: '600' },
  supportHint: { fontSize: 13, color: '#64748B', marginBottom: 12, marginTop: 2 },
  supportRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  supportIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  supportLabel: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  supportValue: { fontSize: 13, color: '#64748B', marginTop: 1 },
  // ── Referral cards ──
  refDesc: { fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: 16, marginTop: -4 },
  refCodeBox: { borderWidth: 1, borderColor: '#BFDBFE', borderStyle: 'dashed', backgroundColor: '#EFF6FF', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 14 },
  refCodeLabel: { fontSize: 10, fontWeight: '800', color: '#0052FF', letterSpacing: 1, marginBottom: 4 },
  refCodeValue: { fontSize: 22, fontWeight: '900', color: '#0A1551', letterSpacing: 3 },
  refStatsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, paddingVertical: 12, marginBottom: 14 },
  refStat: { flex: 1, alignItems: 'center' },
  refStatNum: { fontSize: 20, fontWeight: '900', color: '#0A1551' },
  refStatLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 },
  refStatDivider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },
  refShareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF', borderRadius: 12, paddingVertical: 12 },
  refShareBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  refAppliedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  refAppliedText: { fontSize: 12.5, color: '#16A34A', fontWeight: '600', flex: 1 },
  refApplyLabel: { fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 8 },
  refApplyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refApplyInput: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 14, fontWeight: '700', color: '#0F172A', letterSpacing: 1, backgroundColor: '#FFF' },
  refApplyBtn: { backgroundColor: '#7C3AED', borderRadius: 10, height: 44, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  refApplyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  timingLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 14, marginBottom: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A', backgroundColor: '#FFFFFF' },
  timeDash: { color: '#94A3B8', fontWeight: '700' },
  daysWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  dayChipOn: { backgroundColor: '#0052FF', borderColor: '#0052FF' },
  dayChipOff: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  dayChipText: { fontSize: 13, fontWeight: '600' },
  dayChipTextOn: { color: '#FFFFFF' },
  dayChipTextOff: { color: '#94A3B8' },
  offDayNote: { marginTop: 10, fontSize: 12, color: '#DC2626', fontWeight: '600' },
});
