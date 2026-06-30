import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';

const TYPES = [
  { id: 'visa', label: 'Visa', icon: 'card', card: true },
  { id: 'mastercard', label: 'Mastercard', icon: 'card', card: true },
  { id: 'easypaisa', label: 'EasyPaisa', icon: 'phone-portrait', card: false },
  { id: 'jazzcash', label: 'JazzCash', icon: 'phone-portrait', card: false },
];

const labelFor = (id) => (TYPES.find((t) => t.id === id)?.label || id);

// Self-contained "Payment Methods" manager for the patient Profile screen.
export default function PaymentMethods() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form
  const [type, setType] = useState('visa');
  const [holder, setHolder] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');

  const isCard = TYPES.find((t) => t.id === type)?.card;

  const load = async () => {
    try {
      const token = await storage.getItem('userToken');
      if (!token) return;
      const res = await axios.get(`${API_BASE_URL}/api/payments/methods`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) setMethods(res.data.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => { setType('visa'); setHolder(''); setNumber(''); setExpiry(''); };

  const save = async () => {
    const num = number.replace(/\s+/g, '');
    if (!holder.trim()) return Alert.alert('Required', isCard ? "Enter the cardholder's name." : 'Enter the account title.');
    if (!num) return Alert.alert('Required', isCard ? 'Enter the card number.' : 'Enter the account number.');
    if (isCard) {
      if (num.length < 12) return Alert.alert('Invalid', 'Enter a valid card number.');
      if (!/^\d{2}\/\d{2}$/.test(expiry.trim())) return Alert.alert('Invalid', 'Enter expiry as MM/YY.');
    }
    setBusy(true);
    try {
      const token = await storage.getItem('userToken');
      const payload = {
        type,
        accountNumber: num,
        cardHolderName: holder.trim(),
        ...(isCard ? {
          lastFourDigits: num.slice(-4),
          expiryDate: expiry.trim(),
        } : {}),
      };
      const res = await axios.post(`${API_BASE_URL}/api/payments/methods`, payload, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        setShowAdd(false); resetForm(); load();
      } else {
        Alert.alert('Error', res.data?.message || 'Could not add payment method.');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Could not add payment method.');
    } finally { setBusy(false); }
  };

  const remove = (m) => {
    Alert.alert('Remove', `Remove this ${labelFor(m.type)} method?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          const token = await storage.getItem('userToken');
          await axios.delete(`${API_BASE_URL}/api/payments/methods/${m._id}`, { headers: { Authorization: `Bearer ${token}` } });
          load();
        } catch (e) { Alert.alert('Error', 'Could not remove.'); }
      } },
    ]);
  };

  const formatNumber = (raw) => raw.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (raw) => {
    const d = raw.replace(/\D/g, '').slice(0, 4);
    return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.headIcon}><Ionicons name="card-outline" size={18} color="#0052FF" /></View>
          <Text style={styles.headTitle}>Payment Methods</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setShowAdd(true); }}>
          <Ionicons name="add" size={16} color="#0052FF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#0052FF" style={{ marginVertical: 12 }} />
      ) : methods.length === 0 ? (
        <Text style={styles.empty}>No payment methods saved yet.</Text>
      ) : (
        methods.map((m) => {
          const card = TYPES.find((t) => t.id === m.type)?.card;
          return (
            <View key={m._id} style={styles.methodRow}>
              <View style={styles.methodIcon}>
                <Ionicons name={card ? 'card' : 'phone-portrait'} size={18} color="#0052FF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodLabel}>
                  {labelFor(m.type)}{m.isDefault ? '  •  Default' : ''}
                </Text>
                <Text style={styles.methodSub}>
                  {card ? `•••• ${m.lastFourDigits || '----'}${m.expiryDate ? `  ·  ${m.expiryDate}` : ''}` : m.accountNumber}
                  {m.cardHolderName ? `  ·  ${m.cardHolderName}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => remove(m)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {/* Add modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Add Payment Method</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}><Ionicons name="close" size={22} color="#0A1551" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Method Type</Text>
              <View style={styles.typeRow}>
                {TYPES.map((t) => (
                  <TouchableOpacity key={t.id} style={[styles.typeBtn, type === t.id && styles.typeBtnActive]} onPress={() => setType(t.id)}>
                    <Ionicons name={`${t.icon}-outline`} size={15} color={type === t.id ? '#FFF' : '#0052FF'} />
                    <Text style={[styles.typeBtnText, type === t.id && { color: '#FFF' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{isCard ? 'Cardholder Name' : 'Account Title'}</Text>
              <TextInput
                style={styles.input}
                placeholder={isCard ? 'Name on card' : 'Account holder name'}
                placeholderTextColor="#94A3B8"
                value={holder}
                onChangeText={setHolder}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>{isCard ? 'Card Number' : 'Mobile Account Number'}</Text>
              <TextInput
                style={styles.input}
                placeholder={isCard ? '4111 2222 3333 4444' : '0300 1234567'}
                placeholderTextColor="#94A3B8"
                value={number}
                onChangeText={(v) => setNumber(isCard ? formatNumber(v) : v)}
                keyboardType="numeric"
              />

              {isCard && (
                <>
                  <Text style={styles.fieldLabel}>Expiry (MM/YY)</Text>
                  <TextInput style={styles.input} placeholder="12/29" placeholderTextColor="#94A3B8" value={expiry} onChangeText={(v) => setExpiry(formatExpiry(v))} keyboardType="numeric" />
                </>
              )}

              <TouchableOpacity style={[styles.saveBtn, busy && { opacity: 0.7 }]} disabled={busy} onPress={save}>
                {busy ? <ActivityIndicator color="#FFF" size="small" /> : (
                  <><Ionicons name="save-outline" size={18} color="#FFF" style={{ marginRight: 8 }} /><Text style={styles.saveBtnText}>Save Method</Text></>
                )}
              </TouchableOpacity>
              <Text style={styles.note}>We store only a reference (last 4 digits) — never your full card or CVV.</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#EEF2F7' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headTitle: { fontSize: 16, fontWeight: '800', color: '#0A1551' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EFF4FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  addBtnText: { color: '#0052FF', fontWeight: '700', fontSize: 13 },
  empty: { color: '#94A3B8', fontSize: 13, paddingVertical: 8 },
  methodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  methodIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  methodLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  methodSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30, maxHeight: '88%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#0A1551' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 12 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  typeBtnActive: { backgroundColor: '#0052FF', borderColor: '#0052FF' },
  typeBtnText: { color: '#0052FF', fontWeight: '700', fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A', backgroundColor: '#F8FAFC' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0052FF', borderRadius: 14, paddingVertical: 15, marginTop: 20 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  note: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 12 },
});
