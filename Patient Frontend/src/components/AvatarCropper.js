import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Web-only circular avatar cropper. Renders the picked image inside a fixed
// square viewport with a circular mask; the user drags to reposition and uses a
// zoom slider. On confirm, the visible region is drawn to an `out`×`out` canvas
// and returned as a { uri, size } (JPEG). Native never mounts this — it uses the
// OS crop UI from expo-image-picker instead.
//
// Props: { uri, out = 512, quality = 0.85, onCancel, onDone }
export default function AvatarCropper({ uri, out = 512, quality = 0.85, onCancel, onDone }) {
  const VIEW = 260; // on-screen viewport size (square)
  const [img, setImg] = useState(null);      // HTMLImageElement
  const [minScale, setMinScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // top-left offset of the image in the viewport
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);

  // Load the image and fit it to cover the viewport.
  useEffect(() => {
    let alive = true;
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      if (!alive) return;
      const cover = Math.max(VIEW / im.width, VIEW / im.height);
      setImg(im);
      setMinScale(cover);
      setScale(cover);
      // center
      setPos({ x: (VIEW - im.width * cover) / 2, y: (VIEW - im.height * cover) / 2 });
    };
    im.src = uri;
    return () => { alive = false; };
  }, [uri]);

  // Keep the image covering the viewport (no gaps) after drag/zoom.
  const clamp = (p, s) => {
    if (!img) return p;
    const w = img.width * s, h = img.height * s;
    let { x, y } = p;
    x = Math.min(0, Math.max(VIEW - w, x));
    y = Math.min(0, Math.max(VIEW - h, y));
    return { x, y };
  };

  const onZoom = (e) => {
    const s = Math.max(minScale, Math.min(minScale * 4, Number(e.target.value)));
    // zoom around the viewport center
    const cx = VIEW / 2, cy = VIEW / 2;
    const k = s / scale;
    setPos((p) => clamp({ x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k }, s));
    setScale(s);
  };

  // Pointer drag handlers (web).
  const onDown = (e) => { drag.current = { sx: e.clientX, sy: e.clientY, ...pos }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    if (!drag.current) return;
    const nx = drag.current.x + (e.clientX - drag.current.sx);
    const ny = drag.current.y + (e.clientY - drag.current.sy);
    setPos(clamp({ x: nx, y: ny }, scale));
  };
  const onUp = () => { drag.current = null; };

  const confirm = async () => {
    if (!img) return;
    setBusy(true);
    try {
      // Map the viewport → source pixels, then draw to the output canvas.
      const sx = -pos.x / scale;
      const sy = -pos.y / scale;
      const sSize = VIEW / scale;
      const canvas = document.createElement('canvas');
      canvas.width = out; canvas.height = out;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, out, out);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
      onDone({ uri: URL.createObjectURL(blob), size: blob.size, width: out, height: out });
    } catch (err) {
      onDone(null, err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Adjust your photo</Text>
      <Text style={styles.sub}>Drag to reposition · slide to zoom</Text>

      <View
        style={styles.viewport}
        // Web pointer events (these props are passed straight to the DOM node on RN-web).
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {img && (
          <img
            src={uri}
            draggable={false}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              width: img.width * scale,
              height: img.height * scale,
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        )}
        {/* Circular mask overlay */}
        <View pointerEvents="none" style={styles.maskRing} />
      </View>

      {/* Zoom slider (native range input on web) */}
      <View style={styles.zoomRow}>
        <Ionicons name="remove" size={18} color="#64748B" />
        <input
          type="range"
          min={minScale}
          max={minScale * 4}
          step={0.01}
          value={scale}
          onChange={onZoom}
          style={{ flex: 1, margin: '0 10px', accentColor: '#0052FF' }}
        />
        <Ionicons name="add" size={18} color="#64748B" />
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={busy}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneBtn} onPress={confirm} disabled={busy || !img}>
          <Ionicons name="checkmark" size={17} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={styles.doneText}>{busy ? 'Cropping…' : 'Crop & Upload'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const RING = 260;
const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  title: { fontSize: 16.5, fontWeight: '800', color: '#0A1551' },
  sub: { fontSize: 12.5, color: '#64748B', marginTop: 3, marginBottom: 14, fontWeight: '600' },
  viewport: {
    width: RING, height: RING, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#0A1551', position: 'relative',
    ...(Platform.OS === 'web' ? { cursor: 'grab', touchAction: 'none' } : {}),
  },
  // A ring that dims the corners outside the circle to signal the crop area.
  maskRing: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: RING / 2,
    borderColor: 'rgba(10,21,81,0.55)',
    borderWidth: 0,
    // Big inset shadow-like ring via a thick semi-transparent border trick:
    boxShadow: '0 0 0 999px rgba(10,21,81,0.55)',
  },
  zoomRow: { flexDirection: 'row', alignItems: 'center', width: RING, marginTop: 16 },
  btnRow: { flexDirection: 'row', gap: 10, width: RING, marginTop: 18 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  cancelText: { color: '#334155', fontWeight: '800', fontSize: 14 },
  doneBtn: { flex: 1.6, flexDirection: 'row', paddingVertical: 12, borderRadius: 12, backgroundColor: '#0052FF', alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});
