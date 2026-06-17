import { Linking, Platform } from 'react-native';

// Central support contact details for My Dentist PK.
export const SUPPORT_WHATSAPP = '03365257815';   // local format
export const SUPPORT_WHATSAPP_INTL = '923365257815'; // wa.me needs intl, no +
export const SUPPORT_EMAIL = 'mydentist840@gmail.com';

/**
 * Open a WhatsApp chat with the support number. Falls back to wa.me (works on
 * web + when the app isn't installed).
 */
export async function openWhatsApp(prefillMessage = 'Hello, I need help with My Dentist PK.') {
  const text = encodeURIComponent(prefillMessage);
  const appUrl = `whatsapp://send?phone=${SUPPORT_WHATSAPP_INTL}&text=${text}`;
  const webUrl = `https://wa.me/${SUPPORT_WHATSAPP_INTL}?text=${text}`;
  try {
    if (Platform.OS !== 'web') {
      const supported = await Linking.canOpenURL(appUrl);
      if (supported) return Linking.openURL(appUrl);
    }
    return Linking.openURL(webUrl);
  } catch {
    return Linking.openURL(webUrl);
  }
}

/** Open the device mail composer to the support email. */
export function openSupportEmail(subject = 'My Dentist PK — Support') {
  return Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`);
}
