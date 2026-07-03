import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import storage from '../config/storage';
import API_BASE_URL from '../config/api';

const rs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;
const TYPE_META = {
  visa:       { icon: 'card', color: '#1E3A8A', kind: 'card' },
  mastercard: { icon: 'card', color: '#374151', kind: 'card' },
  easypaisa:  { icon: 'phone-portrait', color: '#16A34A', kind: 'wallet' },
  jazzcash:   { icon: 'phone-portrait', color: '#DC2626', kind: 'wallet' },
  bank:       { icon: 'business', color: '#0052FF', kind: 'wallet' },
};
const labelOf = (m) => m.type === 'bank'
  ? (m.bankName || 'Bank Account')
  : `${String(m.type).toUpperCase()}${m.lastFourDigits ? ` ••••${m.lastFourDigits}` : ''}`;

// Bottom-sheet for choosing how to pay a bill: a saved card/wallet, or cash.
// onConfirm receives { paymentMethodId|null, paymentType, paymentMethodLabel }.
export default function PaymentSheet({ visible, bill, onClose, onConfirm }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // method _id, or 'cash'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await storage.getItem('userToken');
      const [mRes, sRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/payments/methods`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/users/platform-settings`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);
      let list = mRes.data?.success ? (mRes.data.data || []) : [];
      // Only offer saved methods whose type the admin still has enabled.
      const en = sRes?.data?.data?.enabledPaymentMethods;
      if (Array.isArray(en) && en.length) list = list.filter((m) => en.includes(m.type));
      setMethods(list);
      // Default selection: the default card, else cash.
      const def = list.find((m) => m.isDefault) || list[0];
      setSelected(def ? def._id : 'cash');
    } catch {
      setMethods([]);
      setSelected('cash');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  if (!visible) return null;

  const final = bill ? (bill.finalAmount || bill.amount) : 0;
  const isCash = selected === 'cash';
  const chosenMethod = methods.find((m) => m._id === selected);

  const confirm = () => {
    if (isCash) {
      onConfirm({ paymentMethodId: null, paymentType: 'cash', paymentMethodLabel: 'Cash' });
    } else if (chosenMethod) {
      const kind = TYPE_META[chosenMethod.type]?.kind || 'card';
      onConfirm({ paymentMethodId: chosenMethod._id, paymentType: kind, paymentMethodLabel: labelOf(chosenMethod) });
    }
  };

  const addCard = () => {
    onClose?.();
    navigation.navigate('MainTabs', { screen: 'Profile' });
  };

  return (
    <Modal transparent statusBarTranslucent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Choose Payment Method</Text>
          {!!bill && (
            <Text style={styles.sub}>{bill.treatmentName || 'Treatment'} · {rs(final)}</Text>
          )}

          {loading ? (
            <ActivityIndicator color="#0052FF" style={{ marginVertical: 30 }} />
          ) : (
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {methods.map((m) => {
                const meta = TYPE_META[m.type] || { icon: 'card', color: '#0052FF' };
                const on = selected === m._id;
                return (
                  <TouchableOpacity key={m._id} style={[styles.row, on && styles.rowOn]} activeOpacity={0.85} onPress={() => setSelected(m._id)}>
                    <View style={[styles.rowIcon, { backgroundColor: meta.color + '1A' }]}>
                      <Ionicons name={meta.icon} size={20} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>{labelOf(m)}</Text>
                      {!!m.cardHolderName && <Text style={styles.rowSub}>{m.cardHolderName}{m.expiryDate ? ` · ${m.expiryDate}` : ''}</Text>}
                    </View>
                    <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? '#0052FF' : '#CBD5E1'} />
                  </TouchableOpacity>
                );
              })}

              {/* Cash */}
              <TouchableOpacity style={[styles.row, isCash && styles.rowOn]} activeOpacity={0.85} onPress={() => setSelected('cash')}>
                <View style={[styles.rowIcon, { backgroundColor: '#16A34A1A' }]}>
                  <Ionicons name="cash-outline" size={20} color="#16A34A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Cash at clinic</Text>
                  <Text style={styles.rowSub}>Pay at the counter — needs doctor confirmation</Text>
                </View>
                <Ionicons name={isCash ? 'radio-button-on' : 'radio-button-off'} size={20} color={isCash ? '#0052FF' : '#CBD5E1'} />
              </TouchableOpacity>

              {/* Add card */}
              <TouchableOpacity style={styles.addRow} activeOpacity={0.85} onPress={addCard}>
                <Ionicons name="add-circle-outline" size={20} color="#0052FF" />
                <Text style={styles.addText}>Add a card</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, (loading || !selected) && { opacity: 0.5 }]} disabled={loading || !selected} onPress={confirm}>
              <Text style={styles.confirmText}>{isCash ? 'Mark as Cash Payment' : `Pay ${rs(final)}`}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,21,81,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: '#0A1551' },
  sub: { fontSize: 13, color: '#64748B', marginTop: 3, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#EEF2F7', marginBottom: 10 },
  rowOn: { borderColor: '#0052FF', backgroundColor: '#F5F8FF' },
  rowIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 14.5, fontWeight: '800', color: '#0F172A' },
  rowSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 4 },
  addText: { fontSize: 14, fontWeight: '700', color: '#0052FF' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 22, borderRadius: 14, backgroundColor: '#F1F5F9' },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#475569' },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#0052FF', alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
