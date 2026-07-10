import { API_URL } from './api';

// Human-readable byte size.
export function formatBytes(bytes) {
  if (!bytes || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

// Compress/resize an image File via <canvas> before upload. Re-encodes to JPEG
// at `quality`, capped to `maxDim` on the longest edge. PNGs with transparency
// or tiny files are returned untouched. Returns { blob, size, name, skipped }.
export async function compressImage(file, { quality = 0.7, maxDim = 1600 } = {}) {
  try {
    // Leave non-raster or already-small files alone.
    if (!/^image\/(jpe?g|png|webp)$/i.test(file.type) || file.size < 60 * 1024) {
      return { blob: file, size: file.size, name: file.name, skipped: true };
    }
    const img = await loadImage(URL.createObjectURL(file));
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) {
      // No gain (or failed) → keep the original.
      return { blob: file, size: file.size, name: file.name, skipped: true };
    }
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return { blob, size: blob.size, name, skipped: false };
  } catch {
    return { blob: file, size: file.size, name: file.name, skipped: true };
  }
}

// Upload a Blob to /api/users/upload with real progress via XHR.
// onProgress(percent) is called 0..100. Resolves with the uploaded URL.
export function uploadWithProgress(blob, name, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', blob, name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/users/upload`);
    const token = localStorage.getItem('adminToken');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && data.success) resolve(data.data.url);
        else reject(new Error(data.message || `Upload failed (${xhr.status})`));
      } catch { reject(new Error('Unexpected server response')); }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(fd);
  });
}

// Full flow: compress → upload with progress. Returns the uploaded URL.
export async function compressAndUpload(file, { onProgress, onCompressed, ...opts } = {}) {
  const out = await compressImage(file, opts);
  if (onCompressed) onCompressed({ origSize: file.size, size: out.size, skipped: out.skipped });
  return uploadWithProgress(out.blob, out.name, onProgress);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
