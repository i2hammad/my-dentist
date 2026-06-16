import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirmation dialog.
 *
 * react-native-web does NOT render Alert.alert dialogs that have action
 * buttons — the dialog never appears, so the confirm callback never fires and
 * the action silently does nothing. This helper uses the browser's
 * window.confirm on web and the native Alert on iOS/Android.
 *
 *   confirmAlert({
 *     title: 'Delete', message: 'Are you sure?',
 *     confirmText: 'Delete', destructive: true,
 *     onConfirm: () => doDelete(),
 *   });
 */
export default function confirmAlert({
  title = 'Confirm',
  message = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  if (Platform.OS === 'web') {
    const ok = window.confirm(message ? `${title}\n\n${message}` : title);
    if (ok) onConfirm && onConfirm();
    else onCancel && onCancel();
    return;
  }

  Alert.alert(
    title,
    message,
    [
      { text: cancelText, style: 'cancel', onPress: () => onCancel && onCancel() },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: () => onConfirm && onConfirm(),
      },
    ],
    { cancelable: true }
  );
}

/**
 * Cross-platform action menu (a list of choices).
 *
 * Native: a single Alert.alert with one button per option.
 * Web: Alert.alert button lists don't render, so we present the options
 *      sequentially with window.confirm ("Do X?" → OK runs it, Cancel moves to
 *      the next). 'cancel'-styled options are treated as the bail-out.
 *
 *   actionMenu({ title, message, options: [{ text, style?, onPress }] })
 */
export function actionMenu({ title = '', message = '', options = [] }) {
  if (Platform.OS === 'web') {
    const heading = message ? `${title}\n\n${message}` : title;
    for (const opt of options) {
      if (opt.style === 'cancel') continue; // skip the explicit Close/Cancel entry
      if (window.confirm(`${heading}\n\n${opt.text}?`)) {
        opt.onPress && opt.onPress();
        return;
      }
    }
    return; // user dismissed every option
  }

  Alert.alert(
    title,
    message,
    options.map((o) => ({
      text: o.text,
      style: o.style || 'default',
      onPress: o.onPress,
    })),
    { cancelable: true }
  );
}
