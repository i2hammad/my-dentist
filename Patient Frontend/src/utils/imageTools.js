import { Platform } from 'react-native';

// Human-readable byte size, e.g. 1536 -> "1.5 KB".
export function formatBytes(bytes) {
  if (!bytes || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

// Best-effort byte size of a local/remote image URI (works on web + native).
export async function getByteSize(uri) {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return blob.size || 0;
  } catch {
    return 0;
  }
}

// Compress/resize an image before upload.
// - `square: N` → center-crop to a square and output exactly N×N (for avatars).
// - else `maxDim` → cap the longest edge, preserving aspect ratio.
// - Web: re-encode via <canvas> to JPEG at `quality`. Native: expo-image-picker
//   already applied quality/crop at pick time, so we pass the uri through.
// Returns { uri, size, width, height, compressed }.
export async function compressImage(uri, { quality = 0.6, maxDim = 1600, square = 0 } = {}) {
  if (Platform.OS !== 'web') {
    const size = await getByteSize(uri);
    return { uri, size, width: 0, height: 0, compressed: false };
  }

  try {
    const img = await loadImage(uri);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let outW, outH;

    if (square > 0) {
      // Center-crop the source to a square, then scale to N×N.
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      outW = outH = square;
      canvas.width = outW;
      canvas.height = outH;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, outW, outH);
    } else {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      outW = Math.round(img.width * scale);
      outH = Math.round(img.height * scale);
      canvas.width = outW;
      canvas.height = outH;
      ctx.drawImage(img, 0, 0, outW, outH);
    }

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob) throw new Error('canvas encode failed');

    const outUri = URL.createObjectURL(blob);
    return { uri: outUri, size: blob.size, width: outW, height: outH, compressed: true };
  } catch {
    // Fall back to the original if anything about canvas encoding fails.
    const size = await getByteSize(uri);
    return { uri, size, width: 0, height: 0, compressed: false };
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}
