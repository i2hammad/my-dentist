#!/usr/bin/env node
/**
 * Post-export SEO + splash injector for the Expo web build.
 *
 * `expo export` regenerates dist/index.html with an empty <div id="root"> and a
 * bare <head>. This script rewrites that file to add:
 *   1. SEO <head> tags (title, description, keywords, canonical, OG, Twitter,
 *      JSON-LD structured data, theme-color) — so the apex is crawlable/shareable.
 *   2. A <link rel="preload"> for the JS bundle so download starts sooner.
 *
 * It also writes robots.txt + sitemap.xml into dist/.
 *
 * Run automatically after export via the "build:web" npm script.
 */
const fs = require('fs');
const path = require('path');
const { pixelHead, pixelNoscript } = require('./meta-pixel');
const { SAME_AS } = require('./content-pages');

const DIST = path.join(__dirname, '..', 'dist');
const INDEX = path.join(DIST, 'index.html');
const SITE_URL = 'https://mydentistpk.com';
// Google Search Console verification token (Settings → Ownership verification →
// HTML tag → the content="..." value). Env var overrides if set.
const GSC_TOKEN = process.env.GSC_TOKEN || 'dKYKs-ojyJBRnzxK8rLJgt5AfH1QERUJ5ifWQoMSVtU';

if (!fs.existsSync(INDEX)) {
  console.error('[inject-seo] dist/index.html not found — run `expo export --platform web` first.');
  process.exit(1);
}

let html = fs.readFileSync(INDEX, 'utf8');

// ── 1. Find the JS bundle path (hashed each build) for preload ──────────────
const bundleMatch = html.match(/src="(\/_expo\/static\/js\/web\/index-[^"]+\.js)"/);
const bundleHref = bundleMatch ? bundleMatch[1] : null;

// Find the hashed Ionicons font in dist so we can preload it. Icons are used all
// over the UI (search bar, filter chips, nav); preloading the font means it's
// ready before first paint, so glyphs don't pop in later and shift layout (CLS).
let ioniconsHref = null;
try {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
  const hit = walk(DIST).find((p) => /Ionicons[^/]*\.ttf$/i.test(p));
  if (hit) ioniconsHref = '/' + path.relative(DIST, hit).split(path.sep).join('/');
} catch { /* ignore */ }

// Homepage title + description, shared by the <title> tag and the OG/Twitter
// cards below so they can't drift apart.
const HOME_TITLE = 'Best Dentists in Pakistan — Find & Book Online | My Dentist';
const HOME_DESC = 'Find and book verified PMDC dentists in Lahore, Karachi, Islamabad & Rawalpindi. Compare clinics, fees and reviews, then book your appointment online in seconds.';

// ── 2. SEO <head> block ─────────────────────────────────────────────────────
// NOTE: the WebSite JSON-LD deliberately carries NO potentialAction/SearchAction.
// It used to advertise a sitelinks-searchbox target of `/?q={search_term_string}`,
// but no code reads `q` — SplashScreen.js parses only doctor/login/screen/signup/
// impersonate, then strips the query string via history.replaceState. Google
// crawled the advertised URL, saw it collapse to "/" (which is also the canonical),
// and filed it under "Page with redirect". Only restore this block if ?q= is
// actually implemented as a search entry point.
const SEO_HEAD = `
    <meta name="description" content="${HOME_DESC}" />
    <meta name="keywords" content="best dentist in Pakistan, best dentist in Lahore, best dentist in Karachi, best dentist in Islamabad, dental clinic near me, book dentist online Pakistan, orthodontist, dental implants, cosmetic dentist, root canal, teeth whitening, braces, PMDC verified dentist, dentist appointment" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#0052FF" />${GSC_TOKEN ? `\n    <meta name="google-site-verification" content="${GSC_TOKEN}" />` : ''}
    <link rel="dns-prefetch" href="https://api.mydentistpk.com" />
    <!-- Icon fonts (@expo/vector-icons) default to font-display:block, which blocks
         text paint until the font loads (~2s per PageSpeed). Pre-declaring them with
         font-display:swap lets the browser paint immediately and swap in glyphs. -->
    <style>
      @font-face{font-family:Ionicons;font-display:swap;src:local('Ionicons')}
      @font-face{font-family:MaterialCommunityIcons;font-display:swap;src:local('MaterialCommunityIcons')}
      @font-face{font-family:MaterialIcons;font-display:swap;src:local('MaterialIcons')}
      @font-face{font-family:FontAwesome;font-display:swap;src:local('FontAwesome')}
      @font-face{font-family:Feather;font-display:swap;src:local('Feather')}
      @font-face{font-family:AntDesign;font-display:swap;src:local('AntDesign')}
      @font-face{font-family:Entypo;font-display:swap;src:local('Entypo')}
    </style>
    <link rel="canonical" href="${SITE_URL}/" />
    <link rel="icon" type="image/png" sizes="48x48" href="/icons/icon-48.png" />
    <link rel="icon" type="image/png" sizes="96x96" href="/icons/icon-96.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="apple-mobile-web-app-title" content="My Dentist" />
    <meta name="application-name" content="My Dentist" />
    <meta property="og:site_name" content="My Dentist" />
    <meta property="og:title" content="${HOME_TITLE}" />
    <meta property="og:description" content="${HOME_DESC}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${SITE_URL}/" />
    <meta property="og:locale" content="en_PK" />
    <meta property="og:image" content="${SITE_URL}/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Best Dentists in Pakistan — My Dentist" />
    <meta name="twitter:description" content="Find & book verified dentists across Pakistan. Compare clinics, read reviews, book in seconds." />
    <meta name="twitter:image" content="${SITE_URL}/og-image.png" />
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "My Dentist",
      "url": "${SITE_URL}/"
    }
    </script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "MedicalOrganization",
      "name": "My Dentist",
      "url": "${SITE_URL}/",
      "logo": {
        "@type": "ImageObject",
        "url": "${SITE_URL}/icons/icon-512.png",
        "width": 512,
        "height": 512
      },
      "image": "${SITE_URL}/og-image.png",
      "areaServed": "Pakistan",
      "description": "Online platform to find and book verified PMDC dentists across Pakistan.",
      "sameAs": ${JSON.stringify(SAME_AS)}
    }
    </script>${pixelHead()}${bundleHref ? `\n    <link rel="preload" as="script" href="${bundleHref}" />` : ''}${ioniconsHref ? `\n    <link rel="preload" as="font" type="font/ttf" href="${ioniconsHref}" crossorigin />` : ''}
`;

// Remove Expo's default favicon link so it doesn't conflict with (or override)
// our logo-based PNG icon set below. Otherwise browsers may show /favicon.ico.
html = html.replace(/<link rel="icon" href="\/favicon\.ico"\s*\/?>/g, '');

// Idempotency: if a previous run already injected the SEO head (detected by our
// google-site-verification tag or the branded title), strip the old injected
// block first so re-running doesn't stack duplicate <link>/<meta> tags.
if (html.includes('google-site-verification') || html.includes('Best Dentists in Pakistan —')) {
  // Collapse back to a bare title so the replace below re-injects a single clean set.
  html = html.replace(/<title>[\s\S]*?<link rel="preload"[^>]*>\s*/, '<title>My Dentist</title>\n');
}

// Better <title>, then inject SEO right after it. Expo emits <title>My Dentist</title>.
// Keep this under ~60 chars: Google truncates longer titles in results, and an
// over-long title makes it likelier to rewrite the title from on-page text.
// MUST stay in sync with the useSeo() title in HomeScreen.js, which re-applies
// the head after React mounts and tears down this static shell.
html = html.replace(
  /<title>[^<]*<\/title>/,
  `<title>${HOME_TITLE}</title>${SEO_HEAD}`
);

// ── Instant-paint homepage hero ─────────────────────────────────────────────
// The Expo app ships an empty <div id="root">, so on mobile the browser paints
// NOTHING until ~630KB of JS downloads+parses (LCP ~7s). We inject a real,
// styled hero straight into #root that paints immediately (0 JS) — giving a fast
// FCP/LCP. When React mounts it replaces #root's children, so this disappears
// seamlessly. It's also real crawlable content for the homepage.
// A shimmering skeleton block (gradient sweeps across via CSS animation).
const sk = (w, h, r) => `<div class="pp-sk" style="width:${w};height:${h};border-radius:${r || '6px'};"></div>`;
const HERO = `<div id="pp-hero" style="position:fixed;inset:0;z-index:2;overflow:auto;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;opacity:1;transition:opacity .3s ease;">
  <style>
    @keyframes ppShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
    .pp-sk{background:#EEF2F7;background-image:linear-gradient(90deg,#EEF2F7 0px,#F8FAFC 160px,#EEF2F7 320px);background-size:600px 100%;animation:ppShimmer 1.3s linear infinite;}
    /* single-column list on phones (matches the app); grid on wide screens */
    .pp-cards{display:flex;flex-direction:column;gap:14px;}
    @media(min-width:900px){.pp-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));}}
    /* WebTopNav shows the centre links only at >=1024px — match it so the bar
       doesn't reflow when React mounts. */
    .pp-links{display:none !important;}
    @media(min-width:1024px){.pp-links{display:flex !important;}}
  </style>
  <!-- Mirrors the real HomeScreen: same top nav, the same search placeholder,
       the same filter chips and the same "Nearby Doctors / Top dentists near
       you" heading. The hero is what a visitor sees for the first second, so
       any wording that differs from the app reads as a flash of the wrong page
       when React swaps in. -->
  <div style="background:#fff;border-bottom:1px solid #F1F5F9;">
    <div style="max-width:1080px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:10px;">
      <img src="/icons/hero-logo.webp" width="36" height="36" alt="My Dentist logo" style="border-radius:8px;display:block;"/>
      <span style="font-size:19px;font-weight:900;color:#0A1551;letter-spacing:-.3px;">My <span style="color:#0052FF;">Dentist</span></span>
      <span class="pp-links" style="flex-grow:1;display:flex;gap:2px;align-items:center;justify-content:center;">
        ${[['Home', true], ['Cosmetic', false], ['Orthodontics', false], ['Implants', false]].map(([t, active]) => `<span style="font-size:14px;font-weight:700;color:${active ? '#0052FF' : '#64748B'};background:${active ? '#EFF4FF' : 'transparent'};padding:9px 14px;border-radius:12px;">${t}</span>`).join('')}
      </span>
      <span style="display:flex;gap:8px;align-items:center;">
        <span style="font-size:14px;font-weight:700;color:#0052FF;background:#EFF4FF;padding:9px 16px;border-radius:12px;">Log in</span>
        <span style="font-size:14px;font-weight:700;color:#fff;background:#0052FF;padding:9px 16px;border-radius:12px;">Sign up</span>
      </span>
    </div>
  </div>
  <div style="max-width:1080px;margin:0 auto;padding:20px 20px 40px;">
    <h1 style="font-size:34px;line-height:42px;color:#0A1551;margin:12px 0 0;font-weight:800;letter-spacing:-.8px;max-width:19ch;">Find &amp; book the best dentists in Pakistan</h1>
    <p style="font-size:16.5px;color:#475569;margin:12px 0 0;line-height:27px;max-width:620px;">Compare verified PMDC dentists by specialty, experience and clinic — then book online in seconds.</p>
    <!-- Trust line: the reason to believe the directory before any card loads. -->
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:16px 0 20px;font-size:13.5px;font-weight:650;color:#334155;">
      <span style="display:flex;align-items:center;gap:6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="#16A34A"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.6-4.2-4.2 1.4-1.4 2.8 2.8 6-6 1.4 1.4-7.4 7.4z"/></svg>PMDC verified</span>
      <span style="width:3px;height:3px;border-radius:2px;background:#CBD5E1;"></span>
      <span style="display:flex;align-items:center;gap:6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0052FF" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>Free to book</span>
      <span style="width:3px;height:3px;border-radius:2px;background:#CBD5E1;"></span>
      <span style="display:flex;align-items:center;gap:6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z"/></svg>Real patient reviews</span>
    </div>
    <div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #E7EDF5;border-radius:14px;padding:14px 16px;box-shadow:0 1px 3px rgba(15,23,42,.04);">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
      <span style="color:#94A3B8;font-size:15px;">Search Dentist / Clinic / Treatment</span>
    </div>
    <!-- City selector. The app defaults to Islamabad (HomeScreen's initial
         selectedCity), so the hero shows the same value — otherwise the row
         appears out of nowhere when React mounts. Inert until then. -->
    <div style="display:flex;align-items:center;gap:6px;background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:10px 14px;margin-top:12px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#0052FF"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
      <span style="font-size:14px;font-weight:700;color:#0F172A;">Islamabad, Pakistan</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" style="margin-left:auto;"><path d="M6 9l6 6 6-6"/></svg>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;">
      ${['Nearby', 'Elite Clinic', 'Modern Clinic', 'Standard Clinic'].map((t, i) => `<span style="background:${i === 0 ? '#0052FF' : '#fff'};color:${i === 0 ? '#fff' : '#475569'};border:1px solid ${i === 0 ? '#0052FF' : '#E7EDF5'};font-size:13px;font-weight:650;padding:8px 16px;border-radius:999px;">${t}</span>`).join('')}
    </div>
    <div style="margin-top:28px;font-weight:800;color:#0A1551;font-size:18px;">Nearby Doctors</div>
    <div style="color:#64748B;font-size:13px;margin-top:2px;">Top dentists near you</div>
    <div class="pp-cards" style="margin-top:14px;">
      ${[0,1,2,3].map(() => `<div style="display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #EEF2F7;border-radius:16px;padding:14px;">${sk('64px','64px','14px')}<div style="flex:1;min-width:0;">${sk('55%','14px')}<div style="height:9px"></div>${sk('38%','11px')}<div style="height:9px"></div>${sk('72%','10px')}</div></div>`).join('')}
    </div>
    <p style="margin-top:24px;color:#94A3B8;font-size:13px;text-align:center;">Loading dentists near you…</p>
  </div>
</div>`;
// The hero is a FIXED OVERLAY sibling of #root (not a child), so:
//  • #root stays empty → React mounts the real app underneath, laid out correctly
//  • the hero covers it while loading (fast paint), then fades out
//  • removing a fixed overlay causes ZERO layout shift → keeps CLS low
const HERO_FADE = `<script>(function(){
  var root=document.getElementById('root'),hero=document.getElementById('pp-hero');
  if(!root||!hero)return;
  function done(){hero.style.opacity='0';setTimeout(function(){hero&&hero.remove();},350);}
  // Fade once React has rendered real content into #root.
  var obs=new MutationObserver(function(){ if(root.childElementCount>0){obs.disconnect();done();} });
  obs.observe(root,{childList:true});
  // Safety net: never let the hero linger.
  setTimeout(done,8000);
})();</script>`;
html = html.replace('<div id="root"></div>', `<div id="root"></div>${pixelNoscript()}${HERO}${HERO_FADE}`);

fs.writeFileSync(INDEX, html, 'utf8');
console.log('[inject-seo] SEO head + instant hero injected into dist/index.html' + (bundleHref ? ` (preload ${bundleHref})` : ''));

// ── 3. robots.txt (explicitly welcomes AI-search crawlers) ──────────────────
// AI crawlers don't run JS, so they rely on the static pre-rendered pages
// (generated by gen-seo-pages.js). Allowing them lets ChatGPT/Perplexity/Claude
// cite the doctor/city pages. sitemap.xml itself is written by gen-seo-pages.js.
fs.writeFileSync(path.join(DIST, 'robots.txt'),
`User-agent: *
Allow: /

# Search + AI-answer crawlers (welcome — they read our static pages)
User-agent: Googlebot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: Bingbot
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`);
console.log('[inject-seo] wrote robots.txt (AI crawlers allowed)');

// ── 3b. llms.txt — a plain-text map of the site for LLM crawlers ────────────
fs.writeFileSync(path.join(DIST, 'llms.txt'),
`# My Dentist

> Pakistan's platform to find and book verified PMDC-registered dentists. Search
> dental specialists by city and specialty, compare clinics, read reviews, and
> book appointments online.

## Key pages
- [Home](${SITE_URL}/): search dentists by city, specialty, and treatment
- [Dentists by city](${SITE_URL}/sitemap.xml): per-city and per-doctor listing pages
- [Open the app](${SITE_URL}/): book appointments, chat with dentists

## About
My Dentist connects patients across Pakistan (Lahore, Karachi, Islamabad,
Rawalpindi and more) with verified dentists. All listed dentists are PMDC-checked.
Services covered include general dentistry, orthodontics (braces), dental implants,
cosmetic dentistry, root canal (RCT), crowns, scaling, and teeth whitening.
`);
console.log('[inject-seo] wrote llms.txt');

// ── 4. .htaccess: SPA fallback + compression + caching ──────────────────────
fs.writeFileSync(path.join(DIST, '.htaccess'), `# SPA fallback — serve index.html for any non-file/non-directory request
# -Indexes matters more than usual here: with DirectorySlash off, a directory
# request that falls through would otherwise render a browsable file listing.
Options -MultiViews -Indexes

# mod_dir 301s /treatments → /treatments/ whenever a directory of that name
# exists. /treatments is both a real directory (the six treatment pages) and a
# page of its own, so the canonical clean URL answered with a redirect and
# Search Console reported it as "Page with redirect". Off, so the .html rule
# below can serve treatments.html at /treatments directly.
DirectorySlash Off

RewriteEngine On
RewriteBase /

# Real files are served as-is. Directories are NOT matched here: with
# DirectorySlash off, letting a directory through would list it or 404 rather
# than serve the matching .html handled below.
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]

# A directory with no same-named .html (e.g. /assets) is still served as-is.
RewriteCond %{REQUEST_FILENAME} -d
RewriteCond %{REQUEST_FILENAME}.html !-f
RewriteRule ^ - [L]

# Pre-rendered SEO pages: an extensionless URL like /dentist/dr-x maps to the
# static /dentist/dr-x.html when that file exists. This MUST run before the SPA
# fallback so crawlers (and the sitemap's clean URLs) get real HTML, not the shell.
RewriteCond %{REQUEST_FILENAME}.html -f
RewriteRule ^(.+?)/?$ $1.html [L]

# Everything else → the app shell (client-side routing).
RewriteRule ^ index.html [L]

# Compression: shrink the JS bundle ~4x over the wire (Brotli, gzip fallback).
<IfModule mod_brotli.c>
  AddOutputFilterByType BROTLI_COMPRESS text/html text/css text/javascript application/javascript application/json image/svg+xml
</IfModule>
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript application/json image/svg+xml
</IfModule>

<IfModule mod_headers.c>
  <FilesMatch "\\.(js|css|woff2?|ttf|png|jpe?g|gif|svg|ico)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "(index\\.html|sitemap\\.xml|robots\\.txt)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </FilesMatch>
</IfModule>
`);
console.log('[inject-seo] wrote .htaccess (SPA + compression + caching)');

// ── 5. og-image.png for link previews (from the app logo) ───────────────────
try {
  fs.copyFileSync(path.join(__dirname, '..', 'assets', 'app-logo.png'), path.join(DIST, 'og-image.png'));
  console.log('[inject-seo] copied og-image.png');
} catch (e) {
  console.warn('[inject-seo] could not copy og-image.png:', e.message);
}

// ── 6. Web icons (favicons + PWA) + manifest ────────────────────────────────
const iconsSrc = path.join(__dirname, '..', 'assets', 'web-icons');
const iconsDst = path.join(DIST, 'icons');
try {
  fs.mkdirSync(iconsDst, { recursive: true });
  for (const f of fs.readdirSync(iconsSrc)) {
    fs.copyFileSync(path.join(iconsSrc, f), path.join(iconsDst, f));
  }
  console.log('[inject-seo] copied web icons → dist/icons/');
  // Overwrite Expo's default favicon.ico with our logo (as a 48px PNG — browsers
  // accept PNG bytes at /favicon.ico). This guarantees the tab icon is the logo
  // even for the legacy /favicon.ico fetch some browsers still make.
  const fav = path.join(iconsSrc, 'icon-48.png');
  if (fs.existsSync(fav)) { fs.copyFileSync(fav, path.join(DIST, 'favicon.ico')); console.log('[inject-seo] favicon.ico ← logo'); }
} catch (e) {
  console.warn('[inject-seo] could not copy web icons:', e.message);
}

fs.writeFileSync(path.join(DIST, 'manifest.webmanifest'), JSON.stringify({
  name: 'My Dentist',
  short_name: 'My Dentist',
  description: 'Find and book verified dentists across Pakistan.',
  start_url: '/',
  display: 'standalone',
  background_color: '#FFFFFF',
  theme_color: '#0052FF',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
}, null, 2));
console.log('[inject-seo] wrote manifest.webmanifest');
