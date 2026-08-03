import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Account step at the END of booking, not the start.
 *
 * A guest used to be bounced to the login screen the moment they tapped "Book
 * appointment" — asking for a password before they had chosen anything, which
 * is the point of least investment and where most people leave. They now pick
 * the dentist, date, time and treatment first and only create an account to
 * confirm, when abandoning costs them the work they just did.
 *
 * The caller owns the booking; this sheet only collects credentials and hands
 * them back. It never closes itself on failure — losing a filled-in selection
 * behind a dismissed sheet is the one outcome that would make this worse than
 * the redirect it replaces.
 */

// Mirrors the API's own rule (auth.routes.js): 6+ characters, at least one
// digit. Stated up front rather than discovered through a server error.
const PASSWORD_HINT = 'At least 6 characters, including a number';
const isValidPassword = (p) => p.length >= 6 && /\d/.test(p);
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
// Pakistani mobile, e.g. 03001234567 — same rule as PatientSetupScreen.
const isValidPhone = (p) => /^03\d{9}$/.test(p.trim());

export default function BookingAuthSheet({
  visible,
  mode,                 // 'signup' | 'login'
  onModeChange,
  onSubmit,             // ({ fullName, email, phone, password }) => Promise<void>
  onClose,
  busy,
  error,
  summary,              // { doctor, date, time } — reminds them what they're confirming
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});

  const isLogin = mode === 'login';
  const mark = (f) => setTouched((t) => ({ ...t, [f]: true }));

  const errors = {};
  if (!isLogin && !fullName.trim()) errors.fullName = 'Please enter your name';
  if (!isValidEmail(email)) errors.email = 'Enter a valid email address';
  if (!isLogin && !isValidPhone(phone)) errors.phone = 'Enter an 11-digit number starting with 03';
  if (!isValidPassword(password)) errors.password = isLogin ? 'Enter your password' : PASSWORD_HINT;
  const showErr = (f) => (touched[f] ? errors[f] : undefined);
  const canSubmit = Object.keys(errors).length === 0 && !busy;

  const submit = () => {
    if (!canSubmit) {
      setTouched({ fullName: true, email: true, phone: true, password: true });
      return;
    }
    onSubmit({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), password });
  };

  const field = (label, value, setter, key, props = {}) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, showErr(key) && styles.inputWrapError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(t) => setter(t)}
          onBlur={() => mark(key)}
          placeholderTextColor="#94A3B8"
          editable={!busy}
          {...props}
        />
        {key === 'password' && (
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>
      {showErr(key) ? <Text style={styles.errText}>{showErr(key)}</Text> : null}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? undefined : onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.headRow}>
            <Text style={styles.title}>{isLogin ? 'Log in to confirm' : 'Almost done'}</Text>
            {/* Disabled while busy: closing mid-request would strand a
                half-created account with no appointment attached. */}
            <TouchableOpacity onPress={onClose} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={busy ? '#CBD5E1' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sub}>
            {isLogin
              ? 'Your appointment is held while you log in.'
              : 'Create your account and we’ll confirm this appointment.'}
          </Text>

          {summary ? (
            <View style={styles.summary}>
              <Ionicons name="calendar" size={15} color="#0052FF" />
              <Text style={styles.summaryTxt} numberOfLines={2}>
                {summary.doctor}
                {summary.date ? ` · ${summary.date}` : ''}
                {summary.time ? ` · ${summary.time}` : ''}
              </Text>
            </View>
          ) : null}

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 340 }}>
            {!isLogin && field('Full name', fullName, setFullName, 'fullName', { placeholder: 'e.g. Ayesha Khan', autoCapitalize: 'words' })}
            {field('Email', email, setEmail, 'email', { placeholder: 'you@example.com', keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}
            {!isLogin && field('Mobile number', phone, setPhone, 'phone', { placeholder: '03001234567', keyboardType: 'phone-pad', maxLength: 11 })}
            {field('Password', password, setPassword, 'password', {
              placeholder: isLogin ? 'Your password' : PASSWORD_HINT,
              secureTextEntry: !showPassword,
              autoCapitalize: 'none',
            })}

            {/* Server-side failures: email already registered, wrong password,
                network. Shown here so the selection above stays untouched. */}
            {error ? (
              <View style={styles.apiErr}>
                <Ionicons name="alert-circle" size={15} color="#B91C1C" />
                <Text style={styles.apiErrTxt}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <TouchableOpacity style={[styles.cta, !canSubmit && styles.ctaDisabled]} onPress={submit} disabled={busy} activeOpacity={0.85}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaTxt}>{isLogin ? 'Log in & confirm booking' : 'Create account & confirm'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => onModeChange(isLogin ? 'signup' : 'login')} disabled={busy} style={styles.switchBtn}>
            <Text style={styles.switchTxt}>
              {isLogin ? 'New here? Create an account' : 'Already have an account? Log in'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    // Centred and capped on web, where a full-width sheet looks broken.
    ...(Platform.OS === 'web' ? { maxWidth: 460, width: '100%', alignSelf: 'center', borderRadius: 22, marginBottom: 24 } : null),
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
  },
  sub: {
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 12,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF4FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  summaryTxt: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
  },
  inputWrapError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14.5,
    color: '#0F172A',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
  },
  errText: {
    fontSize: 11.5,
    color: '#DC2626',
    marginTop: 4,
    fontWeight: '600',
  },
  apiErr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 4,
  },
  apiErrTxt: {
    flex: 1,
    fontSize: 12.5,
    color: '#B91C1C',
    fontWeight: '600',
  },
  cta: {
    backgroundColor: '#0052FF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaDisabled: {
    opacity: 0.55,
  },
  ctaTxt: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  switchBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchTxt: {
    fontSize: 13,
    color: '#0052FF',
    fontWeight: '700',
  },
});
