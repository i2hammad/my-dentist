import React, { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Per-screen SEO for the web build. No-op on native.
 *
 * Why this exists: react-native-web renders every <Text> as a <div>, so the
 * mounted app contains ZERO <h1>–<h6> tags. The only <h1> lived in the static
 * hero overlay that inject-seo.js injects, and that overlay is REMOVED as soon
 * as React mounts. Googlebot renders JS, finds a page with no heading, and falls
 * back to the most visually prominent text on screen — which is why the homepage
 * ranked as "Nearby Doctors" instead of its real <title>.
 *
 * `useSeo` fixes the head (title + description + canonical) and `H1` supplies a
 * real heading element that survives in the rendered DOM.
 */

const SITE = 'https://mydentistpk.com';

// Keep titles under ~60 chars so Google doesn't truncate them in results.
export function useSeo({ title, description, canonical } = {}) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    if (title) document.title = title;

    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'description');
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', description);
    }

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonical.startsWith('http') ? canonical : `${SITE}${canonical}`);
    }
  }, [title, description, canonical]);
}

/**
 * Renders a real <h1> (or h2/h3 via `level`) on web, and nothing on native.
 *
 * Screen-reader users and crawlers get the heading; sighted users see whatever
 * the screen already draws. Pass `visible` to style it as actual page content
 * instead of hiding it.
 */
export function H1({ children, level = 1, visible = false, style }) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;

  const Tag = `h${level}`;
  // Visually hidden but still read by crawlers and screen readers. Not
  // `display:none` / `visibility:hidden` — those are ignored as hidden content.
  const srOnly = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap',
    border: 0,
  };

  // Use the top-level React import, not require('react') — an inline require
  // inside the component body defeated Metro's static analysis and the whole
  // element got tree-shaken out of the production bundle (the <h1> silently
  // vanished from dist/ while still being present in the source).
  return React.createElement(Tag, { style: visible ? style : srOnly }, children);
}

export default useSeo;
