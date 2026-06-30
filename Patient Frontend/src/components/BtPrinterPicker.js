import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { scanPrinters, printReceiptBT, isThermalSupported } from '../utils/btPrinter';

// Modal that scans for paired Bluetooth printers, lets the user pick one, and
// prints the given receipt over ESC/POS. Props:
//   visible, onClose, invoice, meta ({docName, clinic, spec})
export default function BtPrinterPicker({ visible, onClose, invoice, meta }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState(null);
  const [printingAddr, setPrintingAddr] = useState(null);

  const doScan = useCallback(async () => {
    setError(null); setLoading(true); setDevices([]);
    try {
      const { paired, found } = await scanPrinters();
      // Paired devices first (most printers are pre-paired), then newly found.
      const seen = new Set();
      const merged = [...paired, ...found].filter((d) => {
        if (!d?.address || seen.has(d.address)) return false;
        seen.add(d.address); return true;
      });
      setDevices(merged);
      if (!merged.length) setError('No Bluetooth printers found. Pair your printer in Android Bluetooth settings first.');
    } catch (e) {
      setError(e.message || 'Could not scan for printers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (visible) doScan(); }, [visible, doScan]);

  const print = async (device) => {
    setPrintingAddr(device.address);
    setError(null);
    try {
      await printReceiptBT(device.address, invoice, meta || {});
      onClose?.({ ok: true, device });
    } catch (e) {
      setError(`Print failed: ${e.message || 'try again'}`);
    } finally {
      setPrintingAddr(null);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent statusBarTranslucent animationType="slide" visible onRequestClose={() => onClose?.()}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Bluetooth Printers</Text>
            <TouchableOpacity onPress={doScan} disabled={loading} hitSlop={10}>
              <Ionicons name="refresh" size={20} color={loading ? '#CBD5E1' : '#0052FF'} />
            </TouchableOpacity>
          </View>

          {!isThermalSupported() && (
            <Text style={styles.note}>Bluetooth printing only works in the installed app build.</Text>
          )}

          {loading ? (
            <View style={styles.center}><ActivityIndicator color="#0052FF" /><Text style={styles.loadingText}>Scanning…</Text></View>
          ) : (
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {devices.map((d) => {
                const busy = printingAddr === d.address;
                return (
                  <TouchableOpacity key={d.address} style={styles.row} activeOpacity={0.85} disabled={!!printingAddr} onPress={() => print(d)}>
                    <View style={styles.rowIcon}><Ionicons name="print-outline" size={20} color="#0052FF" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{d.name || 'Printer'}</Text>
                      <Text style={styles.rowAddr}>{d.address}</Text>
                    </View>
                    {busy ? <ActivityIndicator color="#0052FF" /> : <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />}
                  </TouchableOpacity>
                );
              })}
              {!devices.length && !error && <Text style={styles.note}>No printers yet — tap refresh.</Text>}
            </ScrollView>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.cancelBtn} onPress={() => onClose?.()}>
            <Text style={styles.cancelText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,21,81,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '800', color: '#0A1551' },
  note: { fontSize: 13, color: '#94A3B8', marginVertical: 10, textAlign: 'center' },
  center: { alignItems: 'center', paddingVertical: 24 },
  loadingText: { marginTop: 8, color: '#64748B', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#EEF2F7', marginBottom: 10 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  rowName: { fontSize: 14.5, fontWeight: '800', color: '#0F172A' },
  rowAddr: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  error: { fontSize: 13, color: '#DC2626', marginTop: 6, textAlign: 'center' },
  cancelBtn: { marginTop: 12, paddingVertical: 13, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#475569' },
});
