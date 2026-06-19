import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../../../config/api';
import storage from '../../../config/storage';
import confirmAlert from '../../../utils/confirmAlert';

const { width } = Dimensions.get('window');


export default function TreatmentsTab({ profile }) {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletedIds, setDeletedIds] = useState([]);
  const [hasRealData, setHasRealData] = useState(false);

  useEffect(() => {
    fetchTreatments();
  }, []);

  const fetchTreatments = async () => {
    try {
      const token = await storage.getItem('userToken');
      const res = await axios.get(`${API_BASE_URL}/api/treatments/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success && res.data.data.length > 0) {
        const normalized = res.data.data.map(t => ({ ...t, isActive: t.active !== undefined ? t.active : (t.isActive !== undefined ? t.isActive : true) }));
        setTreatments(normalized);
        setHasRealData(true);
      } else {
        setTreatments([]);
        setHasRealData(false);
      }
    } catch (error) {
      console.log('Error fetching treatments:', error);
      setTreatments([]);
      setHasRealData(false);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (id) => {
    setTreatments(prev => prev.map(t => t._id === id ? { ...t, isActive: !t.isActive } : t));
  };

  const handleTextChange = (id, field, value) => {
    setTreatments(prev => prev.map(t => t._id === id ? { ...t, [field]: value } : t));
  };

  const addNewTreatment = () => {
    const newId = Date.now().toString();
    setTreatments([...treatments, { _id: newId, name: '', priceMin: '', priceMax: '', isActive: true }]);
  };

  const handleSave = async () => {
    // Client-side validation before any API call
    const emptyName = treatments.find(t => !t.name || t.name.trim().length < 2);
    if (emptyName) {
      Alert.alert('Missing Name', 'Each treatment must have a name (at least 2 characters).');
      return;
    }
    const badPrice = treatments.find(t => {
      const min = parseFloat(t.priceMin) || 0;
      const max = parseFloat(t.priceMax) || 0;
      return min > max;
    });
    if (badPrice) {
      Alert.alert('Invalid Price', `"${badPrice.name}": minimum price cannot exceed maximum price.`);
      return;
    }

    try {
      setLoading(true);
      const token = await storage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Delete removed treatments
      for (const delId of deletedIds) {
        try {
          await axios.delete(`${API_BASE_URL}/api/treatments/${delId}`, { headers });
        } catch (e) {
          console.log(`Failed to delete treatment ${delId}:`, e);
        }
      }
      setDeletedIds([]);

      // 2. Create or Update remaining treatments
      for (const t of treatments) {
        const payload = {
          name: t.name,
          priceMin: parseFloat(t.priceMin) || 0,
          priceMax: parseFloat(t.priceMax) || 0,
          active: t.isActive
        };

        if (t._id && t._id.length === 24) {
          // Update
          await axios.put(`${API_BASE_URL}/api/treatments/${t._id}`, payload, { headers });
        } else {
          // Create
          await axios.post(`${API_BASE_URL}/api/treatments`, payload, { headers });
        }
      }

      Alert.alert('Success', 'Treatments saved successfully!');
      fetchTreatments();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to save treatment changes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <Text style={styles.title}>Dental Treatments</Text>
        <Text style={styles.subtitle}>Add, edit or manage the treatments you offer to patients.</Text>
        {!hasRealData && (
          <View style={{ backgroundColor: '#FEF9C3', borderRadius: 8, padding: 8, marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="information-circle-outline" size={16} color="#D97706" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 11, color: '#92400E', flex: 1 }}>Sample treatments shown. Edit and tap Save Changes to publish them to patients.</Text>
          </View>
        )}
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.columnHeader, { flex: 2, paddingLeft: 30 }]}>Treatment Name</Text>
        <Text style={[styles.columnHeader, { flex: 2, textAlign: 'center' }]}>Price Range (PKR) - Optional</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {treatments.map((t) => (
          <View key={t._id} style={styles.row}>
            {/* Drag Icon */}
            <Ionicons name="apps-outline" size={16} color="#94A3B8" style={{ marginRight: 10 }} />
            
            {/* Name Input */}
            <View style={[styles.inputBox, { flex: 1.5, marginRight: 10 }]}>
              <TextInput
                style={styles.input}
                value={t.name}
                onChangeText={(val) => handleTextChange(t._id, 'name', val)}
                placeholder="Treatment Name"
              />
            </View>

            {/* Min Price */}
            <View style={[styles.inputBox, { flex: 0.8 }]}>
              <TextInput
                style={styles.inputCenter}
                value={t.priceMin.toString()}
                onChangeText={(val) => handleTextChange(t._id, 'priceMin', val)}
                keyboardType="numeric"
              />
            </View>

            <Text style={{ marginHorizontal: 8, color: '#94A3B8' }}>-</Text>

            {/* Max Price */}
            <View style={[styles.inputBox, { flex: 0.8 }]}>
              <TextInput
                style={styles.inputCenter}
                value={t.priceMax.toString()}
                onChangeText={(val) => handleTextChange(t._id, 'priceMax', val)}
                keyboardType="numeric"
              />
            </View>

            {/* Toggle Switch (Custom) */}
            <TouchableOpacity 
              style={[styles.toggleBtn, t.isActive ? styles.toggleOn : styles.toggleOff]}
              onPress={() => handleToggle(t._id)}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleCircle, t.isActive ? styles.toggleCircleOn : styles.toggleCircleOff]} />
            </TouchableOpacity>

            {/* Delete Button */}
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => {
                if (t._id && t._id.length === 24) {
                  setDeletedIds(prev => [...prev, t._id]);
                }
                setTreatments(prev => prev.filter(item => item._id !== t._id));
              }}
            >
              <Ionicons name="trash-outline" size={16} color="#DC2626" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addNewTreatment}>
          <Ionicons name="add" size={18} color="#0052FF" />
          <Text style={styles.addBtnText}>Add New Treatment</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sticky Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Ionicons name="save-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  headerArea: { padding: 20, paddingBottom: 10 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#0A1551' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 4 },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10 },
  columnHeader: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  inputBox: { height: 40, borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 8, backgroundColor: '#FFF', justifyContent: 'center' },
  input: { fontSize: 12, color: '#0F172A', paddingHorizontal: 12, height: '100%' },
  inputCenter: { fontSize: 12, color: '#0F172A', textAlign: 'center', height: '100%' },
  
  /* Custom Toggle */
  toggleBtn: { width: 36, height: 20, borderRadius: 10, justifyContent: 'center', padding: 2, marginLeft: 16 },
  toggleOn: { backgroundColor: '#0052FF' },
  toggleOff: { backgroundColor: '#E2E8F0' },
  toggleCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  toggleCircleOn: { transform: [{ translateX: 16 }] },
  toggleCircleOff: { transform: [{ translateX: 0 }] },

  deleteBtn: { padding: 8, marginLeft: 4, borderRadius: 6, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 10, paddingBottom: 30 },
  addBtnText: { color: '#0052FF', fontSize: 13, fontWeight: 'bold', marginLeft: 4 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  saveBtn: { backgroundColor: '#0052FF', height: 40, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 12.5, fontWeight: 'bold' }
});
