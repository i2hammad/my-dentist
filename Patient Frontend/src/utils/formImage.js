import { Platform } from 'react-native';

// Append a picked image URI to a FormData correctly on BOTH web and native.
//
// expo-image-picker returns a blob:/data: URI on web and a file://content://
// URI on native. On web, FormData needs a real Blob/File — the React Native
// `{ uri, name, type }` object shape is serialized as "[object Object]" there,
// so the server receives no file and 400s. This normalizes both.
export async function appendImageFile(formData, field, localUri, fallbackName = 'image.jpg') {
  let uri = localUri;
  const name = (uri.split('/').pop() || fallbackName).split('?')[0];
  const safeName = name.includes('.') ? name : fallbackName;

  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    formData.append(field, blob, safeName);
    return;
  }

  if (Platform.OS === 'android' && !uri.startsWith('file://') && !uri.startsWith('content://')) {
    uri = `file://${uri}`;
  }
  const ext = (safeName.split('.').pop() || 'jpg').toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
  formData.append(field, { uri, name: safeName, type });
}
