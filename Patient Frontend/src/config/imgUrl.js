import API_BASE_URL from './api';

/**
 * Resolve an image path to a full URL.
 * - Absolute URLs (Cloudinary http/https, data:, file:, content:) pass through.
 * - Relative paths (legacy /uploads/...) are prefixed with the API base.
 * Prevents the bug where a Cloudinary URL got API_BASE_URL prepended.
 */
export default function imgUrl(src) {
  if (!src) return '';
  if (/^(https?:|data:|file:|content:)/.test(src)) return src;
  return `${API_BASE_URL}${src.startsWith('/') ? '' : '/'}${src}`;
}
