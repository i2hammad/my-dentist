import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, Platform, Modal, Dimensions, StatusBar, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../../../config/api';
import imgUrl from '../../../config/imgUrl';
import storage from '../../../config/storage';
import { appendImageFile } from '../../../utils/formImage';
import { compressImage, getByteSize, formatBytes } from '../../../utils/imageTools';
import confirmAlert from '../../../utils/confirmAlert';


import * as ImagePicker from 'expo-image-picker';

const { width: SW, height: SH } = Dimensions.get('window');

export default function GalleryTab({ profile }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState(null); // { type: 'single'|'beforeafter', uri?, before?, after? }
  const [baModal, setBaModal] = useState(null); // Before/After picker: { before, after } (assets)
  // Upload progress window: { label, stage, uri, origSize, size, percent, error, index, total }
  const [up, setUp] = useState(null);

  // Upload with real progress via XHR (fetch can't report upload %).
  const uploadWithProgress = (fd, token, onProgress) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/api/users/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
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
      // Before & After needs TWO images — open a dedicated picker modal that
      // selects both up front, previews them, then uploads on confirm. (The old
      // Alert-then-picker chain silently failed on web: the second picker never
      // opened because it wasn't a direct user-gesture handler.)
      if (category === 'before_after') {
        setBaModal({ before: null, after: null });
        return;
      }
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadGalleryItem(result.assets[0], category);
      }
    } catch (err) {
      console.log('Pick error:', err);
    }
  };

  // Pick a single image into the Before/After modal slot ('before' | 'after').
  const pickBaSlot = async (slot) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.7 });
      if (result.canceled || !result.assets?.length) return;
      setBaModal((m) => (m ? { ...m, [slot]: result.assets[0] } : m));
    } catch (err) { console.log('Pick error:', err); }
  };

  const submitBeforeAfter = async () => {
    if (!baModal?.before || !baModal?.after) return;
    const before = baModal.before, after = baModal.after;
    setBaModal(null);
    await uploadBeforeAfterItems(before, after);
  };

  const uploadGalleryItem = async (asset, category) => {
    const label = category === 'certificates' || category === 'certificate' ? 'Certificate' : 'Clinic Photo';
    const origSize = asset.fileSize || (await getByteSize(asset.uri));
    setUp({ label, stage: 'compressing', uri: asset.uri, origSize, size: 0, percent: 0, error: '' });
    try {
      const token = await storage.getItem('userToken');

      // 1. Compress.
      const out = await compressImage(asset.uri, { quality: 0.6, maxDim: 1600 });
      setUp((s) => s && { ...s, uri: out.uri, size: out.size, stage: 'uploading', percent: 0 });

      // 2. Upload with progress.
      const formData = new FormData();
      await appendImageFile(formData, 'file', out.uri, asset.fileName || 'upload.jpg');
      const imageUrl = await uploadWithProgress(formData, token, (percent) => setUp((s) => (s ? { ...s, percent } : s)));

      // 3. Add to Gallery.
      const payload = { category, imageUrl, title: 'Upload' };
      await axios.post(`${API_BASE_URL}/api/gallery`, payload, { headers: { Authorization: `Bearer ${token}` } });

      setUp((s) => s && { ...s, stage: 'done', percent: 100 });
      fetchGallery();
    } catch (err) {
      console.error('Gallery upload error:', err);
      const serverMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Upload failed';
      setUp((s) => s && { ...s, stage: 'error', error: serverMessage });
    }
  };

  const uploadBeforeAfterItems = async (beforeAsset, afterAsset) => {
    const origSize = (beforeAsset.fileSize || 0) + (afterAsset.fileSize || 0);
    setUp({ label: 'Before & After', stage: 'compressing', uri: beforeAsset.uri, origSize, size: 0, percent: 0, error: '', index: 1, total: 2 });
    try {
      const token = await storage.getItem('userToken');

      const uploadSingleFile = async (asset, index) => {
        setUp((s) => s && { ...s, stage: 'compressing', uri: asset.uri, index, percent: 0 });
        const out = await compressImage(asset.uri, { quality: 0.6, maxDim: 1600 });
        setUp((s) => s && { ...s, uri: out.uri, size: out.size, stage: 'uploading', index, percent: 0 });
        const formData = new FormData();
        await appendImageFile(formData, 'file', out.uri, asset.fileName || 'upload.jpg');
        return uploadWithProgress(formData, token, (percent) => setUp((s) => (s ? { ...s, percent } : s)));
      };

      const beforeUrl = await uploadSingleFile(beforeAsset, 1);
      const afterUrl = await uploadSingleFile(afterAsset, 2);

      const payload = {
        category: 'before_after',
        beforeImage: beforeUrl,
        afterImage: afterUrl,
        imageUrl: beforeUrl,
        title: 'Before & After'
      };

      await axios.post(`${API_BASE_URL}/api/gallery`, payload, { headers: { Authorization: `Bearer ${token}` } });

      setUp((s) => s && { ...s, stage: 'done', percent: 100 });
      fetchGallery();
    } catch (err) {
      console.error('Gallery upload error:', err);
      const serverMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Upload failed';
      setUp((s) => s && { ...s, stage: 'error', error: serverMessage });
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
                <Text style={styles.sectionSub}>Showcase your clinic · landscape ~1200×900px (4:3)</Text>
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
                <Text style={styles.sectionSub}>Real transformations · square ~1000×1000px each</Text>
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
                <Text style={styles.sectionSub}>Qualifications · portrait ~1200×1600px</Text>
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

      {/* Before & After picker — select BOTH images, then upload */}
      <Modal visible={!!baModal} transparent animationType="fade" onRequestClose={() => setBaModal(null)}>
        <View style={styles.upOverlay}>
          <View style={styles.baCard}>
            <View style={styles.baHeader}>
              <Text style={styles.baTitle}>Before &amp; After</Text>
              <TouchableOpacity onPress={() => setBaModal(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.baSub}>Select both images to add a transformation.</Text>

            <View style={styles.baSlotsRow}>
              {['before', 'after'].map((slot) => {
                const asset = baModal?.[slot];
                return (
                  <TouchableOpacity key={slot} style={styles.baSlot} activeOpacity={0.8} onPress={() => pickBaSlot(slot)}>
                    {asset ? (
                      <>
                        <Image source={{ uri: asset.uri }} style={styles.baSlotImg} resizeMode="cover" />
                        <View style={styles.baSlotEdit}>
                          <Ionicons name="pencil" size={12} color="#FFFFFF" />
                        </View>
                      </>
                    ) : (
                      <View style={styles.baSlotEmpty}>
                        <Ionicons name="add-circle-outline" size={26} color="#0052FF" />
                        <Text style={styles.baSlotHint}>Tap to select</Text>
                      </View>
                    )}
                    <View style={[styles.baSlotLabel, { backgroundColor: slot === 'before' ? '#FEF3C7' : '#DCFCE7' }]}>
                      <Text style={[styles.baSlotLabelText, { color: slot === 'before' ? '#B45309' : '#15803D' }]}>{slot === 'before' ? 'BEFORE' : 'AFTER'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.baUploadBtn, !(baModal?.before && baModal?.after) && styles.baUploadBtnDisabled]}
              disabled={!(baModal?.before && baModal?.after)}
              onPress={submitBeforeAfter}
            >
              <Ionicons name="cloud-upload" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.baUploadText}>Upload Before &amp; After</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Upload progress window */}
      <Modal visible={!!up} transparent animationType="fade" onRequestClose={() => up?.stage !== 'uploading' && setUp(null)}>
        <View style={styles.upOverlay}>
          <View style={styles.upCard}>
            <View style={styles.upHeaderRow}>
              <View style={styles.upIconWrap}>
                <Ionicons
                  name={up?.stage === 'done' ? 'checkmark-circle' : up?.stage === 'error' ? 'alert-circle' : 'cloud-upload'}
                  size={22}
                  color={up?.stage === 'done' ? '#16A34A' : up?.stage === 'error' ? '#DC2626' : '#0052FF'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.upTitle} numberOfLines={1}>
                  {up?.label || 'Upload'}{up?.total ? ` · ${up?.index || 1} of ${up.total}` : ''}
                </Text>
                <Text style={styles.upStageText}>
                  {up?.stage === 'compressing' && 'Optimizing image…'}
                  {up?.stage === 'uploading' && `Uploading… ${up?.percent || 0}%`}
                  {up?.stage === 'done' && 'Uploaded successfully'}
                  {up?.stage === 'error' && (up?.error || 'Upload failed')}
                </Text>
              </View>
            </View>

            {!!up?.uri && <Image source={{ uri: up.uri }} style={styles.upPreview} resizeMode="cover" />}

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

            {(up?.stage === 'compressing' || up?.stage === 'uploading') && (
              <View style={styles.upTrack}>
                <View style={[styles.upFill, { width: `${up?.stage === 'uploading' ? (up?.percent || 0) : 8}%` }]} />
              </View>
            )}

            {up?.stage === 'done' && (
              <TouchableOpacity style={styles.upDoneBtn} onPress={() => setUp(null)}><Text style={styles.upDoneText}>Done</Text></TouchableOpacity>
            )}
            {up?.stage === 'error' && (
              <TouchableOpacity style={styles.upCloseBtn} onPress={() => setUp(null)}><Text style={styles.upCloseText}>Close</Text></TouchableOpacity>
            )}
            {(up?.stage === 'compressing' || up?.stage === 'uploading') && (
              <View style={styles.upBusyRow}><ActivityIndicator size="small" color="#0052FF" /><Text style={styles.upBusyText}>Please wait…</Text></View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  // ── Before & After picker modal ──
  baCard: { width: Math.min(SW - 40, 420), backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 30, elevation: 12 },
  baHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baTitle: { fontSize: 17, fontWeight: '800', color: '#0A1551' },
  baSub: { fontSize: 12.5, color: '#64748B', marginTop: 4, marginBottom: 16, fontWeight: '500' },
  baSlotsRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  baSlot: { flex: 1, aspectRatio: 1, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', overflow: 'hidden', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  baSlotImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  baSlotEmpty: { alignItems: 'center', gap: 6 },
  baSlotHint: { fontSize: 11.5, color: '#64748B', fontWeight: '600' },
  baSlotEdit: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(10,21,81,0.6)', justifyContent: 'center', alignItems: 'center' },
  baSlotLabel: { position: 'absolute', bottom: 6, left: 6, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  baSlotLabelText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  baUploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF', borderRadius: 14, paddingVertical: 14 },
  baUploadBtnDisabled: { backgroundColor: '#93B4FF' },
  baUploadText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

  // ── Upload progress window ──
  upOverlay: { flex: 1, backgroundColor: 'rgba(10,21,81,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  upCard: { width: Math.min(SW - 40, 400), backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 30, elevation: 12 },
  upHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  upIconWrap: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#EFF4FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  upTitle: { fontSize: 15.5, fontWeight: '800', color: '#0A1551' },
  upStageText: { fontSize: 12.5, color: '#64748B', marginTop: 2, fontWeight: '600' },
  upPreview: { width: '100%', height: 150, borderRadius: 12, backgroundColor: '#F1F5F9', marginBottom: 14 },
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
  section: { padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  iconBg: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#0A1551' },
  sectionSub: { fontSize: 10, color: '#64748B', marginTop: 2, maxWidth: 260 },
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
