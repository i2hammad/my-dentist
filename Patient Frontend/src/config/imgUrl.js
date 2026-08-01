import API_BASE_URL from './api';

/**
 * Resolve an image path to a full URL.
 * - Absolute URLs (Cloudinary http/https, data:, file:, content:) pass through.
 * - Relative paths (legacy /uploads/...) are prefixed with the API base.
 * Prevents the bug where a Cloudinary URL got API_BASE_URL prepended.
 *
 * Pass `{ w: 160 }` to request a resized WebP thumbnail — the backend resizes
 * on the fly (?w=), massively cutting download size for small avatars/thumbs.
 * Only applied to our own /uploads paths (not data:/file:/external URLs).
 */
export default function imgUrl(src, opts) {
  if (!src) return '';
  if (/^(data:|file:|content:)/.test(src)) return src;
  const w = opts && opts.w;
  // External absolute URLs pass through unchanged (can't resize those).
  if (/^https?:/.test(src)) return src;
  const rel = `${src.startsWith('/') ? '' : '/'}${src}`;
  // Resized thumbnail: go through /api/img (always routed to Node — the raw
  // /uploads path is served statically by LiteSpeed and can't resize). Only for
  // our own /uploads images with a resizable extension.
  if (w && /^\/?uploads\/.+\.(png|jpe?g|webp)$/i.test(rel)) {
    // `popular` draws the promoted pill into the pixels. The backend resizes a
    // file path and has no doctor record, so the caller has to say so.
    const pop = opts && opts.popular ? '&popular=1' : '';
    return `${API_BASE_URL}/api/img?src=${encodeURIComponent(rel)}&w=${w}${pop}`;
  }
  return `${API_BASE_URL}${rel}`;
}
