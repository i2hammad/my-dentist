/**
 * Meta Pixel snippet, shared by the app shell (inject-seo.js) and every
 * pre-rendered page (gen-seo-pages.js) so both carry the same ID and version.
 *
 * The base snippet only fires PageView. Everything else — a dentist profile
 * viewed, a booking started, a search run — happens inside the React app, which
 * never reloads, so those are tracked from the app itself via
 * src/utils/analytics.js. The static pages fire their own content-view event
 * because they are real page loads that the SPA never sees.
 */

const PIXEL_ID = process.env.META_PIXEL_ID || '1576784700653524';

// Base pixel. `fbq` is queued by the loader, so calls made before the network
// request finishes are replayed rather than lost.
const pixelHead = () => `
    <!-- Meta Pixel -->
    <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${PIXEL_ID}');
    fbq('track', 'PageView');
    </script>`;

// The <noscript> fallback must sit in <body>, not <head>.
const pixelNoscript = () => `<noscript><img height="1" width="1" style="display:none" alt=""
src="https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1"/></noscript>`;

/**
 * A ViewContent event for a pre-rendered page. These are real page loads, so
 * they are tracked here rather than in the app.
 *
 * A dentist or a treatment is a single item Meta can match to a catalogue entry,
 * so it defaults to `content_type: 'product'`. City and specialty pages are
 * browse pages listing many dentists — they pass `type: 'product_group'`, which
 * matches what trackViewCategory reports for the same intent inside the app.
 */
const pixelViewContent = ({ name, category, id, type }) => {
  // Names come from the database, so they are untrusted input being written into
  // an inline <script>. Backslash and quote keep the JS string valid; escaping
  // `<` stops a literal "</script>" in a name from closing the tag early, which
  // would break the pixel on that page and spill markup into the document.
  const esc = (v) =>
    String(v == null ? '' : v)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/</g, '\\x3C');
  return `
    <script>
    window.fbq && fbq('track', 'ViewContent', {
      content_name: '${esc(name)}',
      content_category: '${esc(category)}',
      content_ids: ['${esc(id)}'],
      content_type: '${esc(type || 'product')}'
    });
    </script>`;
};

module.exports = { PIXEL_ID, pixelHead, pixelNoscript, pixelViewContent };
