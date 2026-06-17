import { Alert } from 'react-native';
import { showDialog } from '../components/AppDialog';

// Route every Alert.alert(...) call through our branded AppDialog so existing
// call sites need no changes. Also makes alerts work on web (RN-web's native
// Alert with buttons doesn't render).
//
// Signature kept compatible: Alert.alert(title, message?, buttons?, options?)
const _nativeAlert = Alert.alert;

Alert.alert = function (title, message, buttons, options) {
  try {
    showDialog({
      title: title || '',
      message: message || '',
      buttons: Array.isArray(buttons) ? buttons : [],
      onDismiss: options?.onDismiss,
    });
  } catch (e) {
    // Fallback to native if anything goes wrong.
    if (typeof _nativeAlert === 'function') _nativeAlert(title, message, buttons, options);
  }
};
