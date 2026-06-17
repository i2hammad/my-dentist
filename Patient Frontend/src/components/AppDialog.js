import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Global themed dialog that replaces the default Android/iOS Alert.
// A tiny event bus lets the imperative showDialog() (and the Alert.alert
// override) push dialogs without prop drilling.
let _listener = null;
let _idCounter = 0;

export function showDialog(config) {
  if (_listener) _listener({ id: ++_idCounter, ...config });
}

// Pick an icon + accent from the title/intent of the dialog.
function inferIntent(title = '', buttons = []) {
  const t = title.toLowerCase();
  const hasDestructive = buttons.some((b) => b.style === 'destructive');
  if (hasDestructive || /delete|remove|block|cancel|logout|reject/.test(t)) {
    return { icon: 'alert-circle', color: '#EF4444', bg: '#FEE2E2' };
  }
  if (/success|saved|done|added|updated|created|posted|approved|sent|complete/.test(t)) {
    return { icon: 'checkmark-circle', color: '#16A34A', bg: '#DCFCE7' };
  }
  if (/error|failed|invalid|missing|unable|required|denied/.test(t)) {
    return { icon: 'close-circle', color: '#EF4444', bg: '#FEE2E2' };
  }
  return { icon: 'information-circle', color: '#0052FF', bg: '#EFF6FF' };
}

export default function AppDialog() {
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    _listener = (cfg) => setDialog(cfg);
    return () => { _listener = null; };
  }, []);

  if (!dialog) return null;

  const { title, message, buttons = [], onDismiss } = dialog;
  const intent = inferIntent(title, buttons);
  // Default to a single "OK" button when none provided.
  const btns = buttons.length ? buttons : [{ text: 'OK' }];

  const close = (cb) => {
    setDialog(null);
    if (typeof cb === 'function') setTimeout(cb, 0);
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => close(onDismiss)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: intent.bg }]}>
            <Ionicons name={intent.icon} size={30} color={intent.color} />
          </View>
          {!!title && <Text style={styles.title}>{title}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={[styles.btnRow, btns.length > 2 && styles.btnCol]}>
            {btns.map((b, i) => {
              const isCancel = b.style === 'cancel';
              const isDestructive = b.style === 'destructive';
              const primary = !isCancel; // non-cancel buttons are filled
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.btn,
                    btns.length > 2 && styles.btnFull,
                    primary
                      ? { backgroundColor: isDestructive ? '#EF4444' : '#0052FF' }
                      : styles.btnGhost,
                  ]}
                  onPress={() => close(b.onPress)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.btnText, primary ? styles.btnTextPrimary : styles.btnTextGhost]}>
                    {b.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,21,81,0.45)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, alignItems: 'center',
    shadowColor: '#0A1551', shadowOpacity: 0.2, shadowRadius: 30, shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
  iconWrap: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: '#0A1551', textAlign: 'center', marginBottom: 6 },
  message: { fontSize: 14.5, color: '#64748B', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  btnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  btnCol: { flexDirection: 'column' },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  btnFull: { flex: undefined, width: '100%' },
  btnGhost: { backgroundColor: '#F1F5F9' },
  btnText: { fontSize: 15, fontWeight: '700' },
  btnTextPrimary: { color: '#FFFFFF' },
  btnTextGhost: { color: '#475569' },
});
