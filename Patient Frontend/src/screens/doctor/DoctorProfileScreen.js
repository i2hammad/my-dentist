import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Platform, Alert, Image, Modal, FlatList, Dimensions
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import storage from '../../config/storage';
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

export default function DoctorProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownConfig, setDropdownConfig] = useState({ field: '', options: [], label: '' });

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

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success && res.data.data.profile) {
        const p = res.data.data.profile;
        const u = res.data.data.user;
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

  const openDropdown = (field, options, label) => {
    setDropdownConfig({ field, options, label });
    setDropdownVisible(true);
  };

  const selectDropdownValue = (value) => {
    setFormData(prev => ({ ...prev, [dropdownConfig.field]: value }));
    setDropdownVisible(false);
  };

  const setField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const toggleDay = (day) => setFormData(prev => {
    const isAvail = (prev.availableDays || []).includes(day);
    if (isAvail) {
      return { ...prev, availableDays: prev.availableDays.filter(d => d !== day), offDays: [...new Set([...(prev.offDays || []), day])] };
    }
    return { ...prev, offDays: (prev.offDays || []).filter(d => d !== day), availableDays: [...new Set([...(prev.availableDays || []), day])] };
  });

  const pickDocument = async (field) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length > 0) {
        uploadFile(result.assets[0], field);
      }
    } catch (err) {
      console.log('Pick error:', err);
    }
  };

  const uploadFile = async (asset, field) => {
    try {
      setLoading(true);
      const token = await storage.getItem('userToken');
      const fd = new FormData();
      let uri = asset.uri;
      if (Platform.OS === 'android' && !uri.startsWith('file://')) uri = `file://${uri}`;
      const name = asset.fileName || uri.split('/').pop() || 'upload.jpg';
      const ext = uri.split('.').pop().toLowerCase();
      fd.append('file', { uri, name, type: ext === 'png' ? 'image/png' : 'image/jpeg' });

      const res = await fetch(`${API_BASE_URL}/api/users/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (data?.success) {
        const url = data.data.url;
        setFormData(prev => ({ ...prev, [field]: url }));
        const patch = {};
        if (field === 'avatar') patch.photo = url;
        else patch[field] = url;
        await axios.put(`${API_BASE_URL}/api/users/doctor-profile`, patch, {
          headers: { Authorization: `Bearer ${token}` }
        });
        Alert.alert('Success', 'Document uploaded successfully!');
        fetchProfile();
      } else {
        throw new Error(data?.message || 'Upload failed');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

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
      payload.clinicTiming = {
        days: (formData.availableDays || []).join(', '),
        morningStart: formData.morningStart, morningEnd: formData.morningEnd,
        eveningStart: formData.eveningStart, eveningEnd: formData.eveningEnd,
        availableDays: formData.availableDays || [],
        offDays: formData.offDays || [],
      };

      await axios.put(`${API_BASE_URL}/api/users/doctor-profile`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await fetchProfile();
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to update profile');
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

          <FieldRow icon="call-outline" label="Mobile" placeholder="03XXXXXXXXX" value={formData.mobileNumber} onChangeText={t => setField('mobileNumber', t)} keyboardType="phone-pad" />
          <FieldRow icon="mail-outline" label="Email" placeholder="Email address" value={formData.emailAddress} editable={false} />
          <FieldRow icon="id-card-outline" label="PMDC No." placeholder="PMDC Number" value={formData.pmdcNumber} onChangeText={t => setField('pmdcNumber', t)} />

          <UploadRow icon="person-circle-outline" label="Profile Picture" subLabel="Upload clear face photo" onPress={() => pickDocument('avatar')} imageUrl={formData.avatar} />
          <UploadRow icon="document-text-outline" label="License / Registration" subLabel="Upload clear image" onPress={() => pickDocument('licenseCert')} imageUrl={formData.licenseCert} />
          <UploadRow icon="id-card-outline" label="ID Card Front" subLabel="Upload clear image" onPress={() => pickDocument('idFront')} imageUrl={formData.idFront} />
          <UploadRow icon="id-card-outline" label="ID Card Back" subLabel="Upload clear image" onPress={() => pickDocument('idBack')} imageUrl={formData.idBack} />
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

          <FieldRow icon="person-outline" label="Full Name" placeholder="Dr. Full Name" value={formData.fullName} onChangeText={t => setField('fullName', t)} />

          <DropdownRow
            icon="male-female-outline" label="Gender"
            value={formData.gender} placeholder="Select Gender"
            onPress={() => openDropdown('gender', GENDERS, 'Select Gender')}
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

          <FieldRow icon="call-outline" label="Clinic Contact" placeholder="Clinic phone" value={formData.clinicContact} onChangeText={t => setField('clinicContact', t)} keyboardType="phone-pad" />
          <FieldRow icon="business-outline" label="Clinic Name" placeholder="Clinic / Hospital name" value={formData.clinicName} onChangeText={t => setField('clinicName', t)} />
          <FieldRow icon="location-outline" label="Address" placeholder="Clinic address" value={formData.address} onChangeText={t => setField('address', t)} />
          <FieldRow icon="navigate-outline" label="City" placeholder="City" value={formData.city} onChangeText={t => setField('city', t)} />

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
            <TextInput style={styles.timeInput} value={formData.morningStart} onChangeText={t => setField('morningStart', t)} placeholder="From e.g. 9:00 AM" placeholderTextColor="#94A3B8" />
            <Text style={styles.timeDash}>—</Text>
            <TextInput style={styles.timeInput} value={formData.morningEnd} onChangeText={t => setField('morningEnd', t)} placeholder="To e.g. 1:00 PM" placeholderTextColor="#94A3B8" />
          </View>

          <Text style={styles.timingLabel}>Evening Session</Text>
          <View style={styles.timeRow}>
            <TextInput style={styles.timeInput} value={formData.eveningStart} onChangeText={t => setField('eveningStart', t)} placeholder="From e.g. 5:00 PM" placeholderTextColor="#94A3B8" />
            <Text style={styles.timeDash}>—</Text>
            <TextInput style={styles.timeInput} value={formData.eveningEnd} onChangeText={t => setField('eveningEnd', t)} placeholder="To e.g. 9:00 PM" placeholderTextColor="#94A3B8" />
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
    </SafeAreaView>
  );
}

function FieldRow({ icon, label, placeholder, value, onChangeText, keyboardType = 'default', editable = true }) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.labelCol}>
        <Ionicons name={icon} size={18} color="#0052FF" />
        <Text style={styles.fieldLabel}>{label}</Text>
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
        />
      </View>
    </View>
  );
}

function DropdownRow({ icon, label, value, placeholder, onPress }) {
  return (
    <TouchableOpacity style={styles.fieldRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.labelCol}>
        <Ionicons name={icon} size={18} color="#0052FF" />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <View style={[styles.inputCol, { paddingRight: 8 }]}>
        <Text style={[styles.fieldInput, !value && { color: '#94A3B8' }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#64748B" />
      </View>
    </TouchableOpacity>
  );
}

function UploadRow({ icon, label, subLabel, onPress, imageUrl }) {
  return (
    <View style={[styles.uploadRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.labelColUpload}>
          <Ionicons name={icon} size={18} color="#0052FF" style={{ marginTop: 2 }} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.fieldLabelUpload}>{label}</Text>
            <Text style={styles.fieldSubLabel}>{subLabel}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.uploadBtn, imageUrl && { borderColor: '#16A34A', backgroundColor: '#F0FDF4' }]}
          onPress={onPress}
        >
          <Ionicons name={imageUrl ? 'checkmark-circle' : 'cloud-upload-outline'} size={16} color={imageUrl ? '#16A34A' : '#0052FF'} style={{ marginRight: 6 }} />
          <Text style={[styles.uploadBtnText, imageUrl && { color: '#16A34A' }]}>{imageUrl ? 'Replace' : 'Upload'}</Text>
        </TouchableOpacity>
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
