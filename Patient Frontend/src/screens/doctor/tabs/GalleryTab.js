import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, Platform, Modal, Dimensions, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../../../config/api';
import imgUrl from '../../../config/imgUrl';
import storage from '../../../config/storage';
import confirmAlert from '../../../utils/confirmAlert';


import * as ImagePicker from 'expo-image-picker';

const { width: SW, height: SH } = Dimensions.get('window');

export default function GalleryTab({ profile }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState(null); // { type: 'single'|'beforeafter', uri?, before?, after? }

  useEffect(() => {
    fetchGallery();
  }, [profile]);

  const fetchGallery = async () => {
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.get(`${API_BASE_URL}/api/gallery/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setItems(res.data.data);
      }
    } catch (err) {
      console.log('Error fetching gallery:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (category) => {
    try {
      if (category === 'before_after') {
        // Pick Before Image
        Alert.alert('Before Image', 'Please select the "BEFORE" image.');
        let beforeResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.7,
        });
        if (beforeResult.canceled || !beforeResult.assets || beforeResult.assets.length === 0) return;

        // Pick After Image
        Alert.alert('After Image', 'Please select the "AFTER" image.');
        let afterResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.7,
        });
        if (afterResult.canceled || !afterResult.assets || afterResult.assets.length === 0) return;

        // Upload both images
        await uploadBeforeAfterItems(beforeResult.assets[0], afterResult.assets[0]);
      } else {
        let result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.7,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          await uploadGalleryItem(result.assets[0], category);
        }
      }
    } catch (err) {
      console.log('Pick error:', err);
    }
  };

  const uploadGalleryItem = async (asset, category) => {
    try {
      const token = await storage.getItem('userToken');
      
      // 1. Upload image file
      const formData = new FormData();
      let uri = asset.uri;
      if (Platform.OS === 'android' && !uri.startsWith('file://')) {
        uri = `file://${uri}`;
      }
      const name = asset.fileName || uri.split('/').pop() || 'upload.jpg';
      const ext = uri.split('.').pop().toLowerCase();
      const type = ext === 'png' ? 'image/png' : 'image/jpeg';
      formData.append('file', { uri, name, type });

      const res = await fetch(`${API_BASE_URL}/api/users/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const uploadData = await res.json();
      
      if (uploadData?.success) {
        const imageUrl = uploadData.data.url;
        
        // 2. Add to Gallery
        const payload = { category, imageUrl, title: 'Upload' };
        await axios.post(`${API_BASE_URL}/api/gallery`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        Alert.alert('Success', 'Image added successfully!');
        fetchGallery();
      } else {
        throw new Error('Image upload failed');
      }
    } catch (err) {
      console.error('Gallery upload error:', err);
      const serverMessage = err.response?.data?.message || err.response?.data?.error || err.message || '';
      Alert.alert('Error', `Failed to upload image. Please try again. ${serverMessage}`.trim());
    }
  };

  const uploadBeforeAfterItems = async (beforeAsset, afterAsset) => {
    try {
      setLoading(true);
      const token = await storage.getItem('userToken');

      const uploadSingleFile = async (asset) => {
        const formData = new FormData();
        let uri = asset.uri;
        if (Platform.OS === 'android' && !uri.startsWith('file://')) {
          uri = `file://${uri}`;
        }
        const name = asset.fileName || uri.split('/').pop() || 'upload.jpg';
        const ext = uri.split('.').pop().toLowerCase();
        const type = ext === 'png' ? 'image/png' : 'image/jpeg';
        formData.append('file', { uri, name, type });

        const res = await fetch(`${API_BASE_URL}/api/users/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const uploadData = await res.json();
        if (uploadData?.success) {
          return uploadData.data.url;
        }
        throw new Error('Image upload failed');
      };

      const beforeUrl = await uploadSingleFile(beforeAsset);
      const afterUrl = await uploadSingleFile(afterAsset);

      const payload = {
        category: 'before_after',
        beforeImage: beforeUrl,
        afterImage: afterUrl,
        imageUrl: beforeUrl,
        title: 'Before & After'
      };

      await axios.post(`${API_BASE_URL}/api/gallery`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Before & After results added successfully!');
      fetchGallery();
    } catch (err) {
      console.error('Gallery upload error:', err);
      const serverMessage = err.response?.data?.message || err.response?.data?.error || err.message || '';
      Alert.alert('Error', `Failed to upload images. Please try again. ${serverMessage}`.trim());
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    confirmAlert({
      title: 'Delete',
      message: 'Are you sure you want to delete this image?',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          const token = await storage.getItem('userToken');
          await axios.delete(`${API_BASE_URL}/api/gallery/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          fetchGallery();
        } catch (err) {
          console.error(err);
          Alert.alert('Error', 'Failed to delete image');
        }
      },
    });
  };

  const clinicPhotos = items.filter(i => i.category === 'clinic_photos' || i.category === 'clinic_photo');
  const certificates = items.filter(i => i.category === 'certificates' || i.category === 'certificate');
  const beforeAfters = items.filter(i => i.category === 'before_after');

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Clinic Photos Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View style={styles.iconBg}><Ionicons name="image-outline" size={16} color="#0052FF" /></View>
              <View style={{marginLeft: 10}}>
                <Text style={styles.sectionTitle}>Clinic Photos</Text>
                <Text style={styles.sectionSub}>Showcase your clinic environment and facilities</Text>
              </View>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {clinicPhotos.map((item) => (
              <View key={item._id} style={styles.imageCard}>
                <TouchableOpacity onPress={() => setViewer({ type: 'single', uri: imgUrl(item.imageUrl) })}>
                  <Image source={{ uri: imgUrl(item.imageUrl) }} style={styles.photo} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBadge} onPress={() => handleDelete(item._id)}>
                  <Ionicons name="close" size={12} color="#0052FF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.addBtnOutline} onPress={() => handleAdd('clinic_photos')}>
            <Ionicons name="add" size={18} color="#0052FF" />
            <Text style={styles.addBtnOutlineText}>Add Photos</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Before & After Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View style={[styles.iconBg, {backgroundColor: '#F3E8FF'}]}><Ionicons name="scan-outline" size={16} color="#9333EA" /></View>
              <View style={{marginLeft: 10}}>
                <Text style={styles.sectionTitle}>Before & After Results</Text>
                <Text style={styles.sectionSub}>Highlight real transformations and build trust</Text>
              </View>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {beforeAfters.map((item) => (
              <View key={item._id} style={{marginRight: 16}}>
                <TouchableOpacity onPress={() => setViewer({ type: 'beforeafter', before: imgUrl(item.beforeImage || item.imageUrl), after: imgUrl(item.afterImage || item.imageUrl) })}>
                  <View style={styles.beforeAfterCard}>
                    {item.beforeImage && item.afterImage ? (
                      <View style={{ flexDirection: 'row', width: '100%', height: '100%' }}>
                        <Image source={{ uri: imgUrl(item.beforeImage) }} style={[styles.photoHalf, { borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }]} />
                        <View style={{ width: 2, backgroundColor: '#FFF' }} />
                        <Image source={{ uri: imgUrl(item.afterImage) }} style={[styles.photoHalf, { borderTopRightRadius: 12, borderBottomRightRadius: 12 }]} />
                      </View>
                    ) : (
                      <Image source={{ uri: imgUrl(item.imageUrl) }} style={[styles.photoHalf, { borderRadius: 12 }]} />
                    )}
                  </View>
                </TouchableOpacity>
                <Text style={styles.beforeAfterTitle}>{item.title || 'Before & After'}</Text>
                <TouchableOpacity style={styles.deleteBadgeOuter} onPress={() => handleDelete(item._id)}>
                  <Ionicons name="close" size={12} color="#9333EA" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.addBtnOutline} onPress={() => handleAdd('before_after')}>
            <Ionicons name="add" size={18} color="#9333EA" />
            <Text style={[styles.addBtnOutlineText, {color: '#9333EA'}]}>Add Results</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Certificates & Awards */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View style={[styles.iconBg, {backgroundColor: '#DCFCE7'}]}><Ionicons name="ribbon-outline" size={16} color="#16A34A" /></View>
              <View style={{marginLeft: 10}}>
                <Text style={styles.sectionTitle}>Certificates & Awards</Text>
                <Text style={styles.sectionSub}>Showcase your qualifications and achievements</Text>
              </View>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {certificates.map((item) => (
              <View key={item._id} style={styles.certCard}>
                <TouchableOpacity onPress={() => setViewer({ type: 'single', uri: imgUrl(item.imageUrl) })}>
                  <Image source={{ uri: imgUrl(item.imageUrl) }} style={styles.certPhoto} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBadge} onPress={() => handleDelete(item._id)}>
                  <Ionicons name="close" size={12} color="#16A34A" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.addBtnOutline} onPress={() => handleAdd('certificates')}>
            <Ionicons name="add" size={18} color="#16A34A" />
            <Text style={[styles.addBtnOutlineText, {color: '#16A34A'}]}>Add Certificate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sticky Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => Alert.alert('Saved', 'All gallery updates have been successfully saved.')}
        >
          <Ionicons name="save-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      </View>

      {/* Full-screen Image Viewer */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <StatusBar backgroundColor="#000" barStyle="light-content" />
        <View style={styles.viewerBg}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewer(null)}>
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
          {viewer?.type === 'single' && (
            <Image source={{ uri: viewer.uri }} style={styles.viewerImg} resizeMode="contain" />
          )}
          {viewer?.type === 'beforeafter' && (
            <View style={{ width: SW, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <View style={{ alignItems: 'center', marginRight: 4 }}>
                  <Text style={styles.viewerLabel}>BEFORE</Text>
                  <Image source={{ uri: viewer.before }} style={styles.viewerHalf} resizeMode="cover" />
                </View>
                <View style={{ alignItems: 'center', marginLeft: 4 }}>
                  <Text style={styles.viewerLabel}>AFTER</Text>
                  <Image source={{ uri: viewer.after }} style={styles.viewerHalf} resizeMode="cover" />
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  section: { padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  iconBg: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#0A1551' },
  sectionSub: { fontSize: 10, color: '#64748B', marginTop: 2, width: 180 },
  viewAllText: { fontSize: 11, color: '#0052FF', fontWeight: '500', marginRight: 12 },
  editBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  editBtnText: { fontSize: 11, color: '#0052FF', fontWeight: '500', marginLeft: 4 },
  
  horizontalScroll: { flexDirection: 'row' },
  imageCard: { position: 'relative', marginRight: 12 },
  photo: { width: 140, height: 100, borderRadius: 12, backgroundColor: '#F8FAFC' },
  deleteBadge: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  
  deleteBadgeOuter: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  beforeAfterCard: { position: 'relative', flexDirection: 'row', width: 200, height: 100, borderRadius: 12, backgroundColor: '#F8FAFC', marginBottom: 8 },
  photoHalf: { flex: 1, height: '100%', resizeMode: 'cover' },
  sliderHandle: { position: 'absolute', left: '50%', top: '50%', width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF', marginLeft: -12, marginTop: -12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  beforeAfterTitle: { fontSize: 11, fontWeight: '600', color: '#0A1551', textAlign: 'center' },

  certCard: { position: 'relative', marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 4 },
  certPhoto: { width: 130, height: 90, borderRadius: 4, backgroundColor: '#F8FAFC' },

  addBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 8, paddingVertical: 8, marginTop: 16 },
  addBtnOutlineText: { fontSize: 12, fontWeight: 'bold', color: '#0052FF', marginLeft: 4 },

  divider: { height: 8, backgroundColor: '#F8FAFC' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  saveBtn: { backgroundColor: '#0052FF', height: 40, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 12.5, fontWeight: 'bold' },

  viewerBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  viewerClose: { position: 'absolute', top: 48, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  viewerImg: { width: SW, height: SH * 0.8 },
  viewerHalf: { width: SW / 2 - 12, height: SH * 0.65, borderRadius: 10 },
  viewerLabel: { fontSize: 11, fontWeight: '800', color: '#FFF', letterSpacing: 1, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4, overflow: 'hidden' },
});
