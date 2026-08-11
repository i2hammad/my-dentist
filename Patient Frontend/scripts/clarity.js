/**
 * Microsoft Clarity, shared by the app shell (inject-seo.js) and every
 * pre-rendered page (gen-seo-pages.js) so both carry the same project ID.
 *
 * Clarity records session replays and heatmaps. Unlike the Meta Pixel it needs
 * no per-event wiring to be useful — it captures clicks, scrolls and rage-taps
 * on its own — but this is a single-page app, so a route change is invisible to
 * it unless reported. src/utils/clarity.js does that from the app.
 *
 * CLARITY_ID overrides the project at build time (e.g. for a staging project):
 *   CLARITY_ID=other npm run build:web
 * Set it to an empty string to omit the tag entirely rather than emitting a
 * script that 404s on every page load.
 */

const CLARITY_ID = process.env.CLARITY_ID !== undefined ? process.env.CLARITY_ID : 'y08usfdl21';

const clarityHead = () => {
  if (!CLARITY_ID) return '';
  return `
    <!-- Microsoft Clarity -->
    <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${CLARITY_ID}");
    </script>`;
};

module.exports = { CLARITY_ID, clarityHead };
