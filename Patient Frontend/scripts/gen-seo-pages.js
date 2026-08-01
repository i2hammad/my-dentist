#!/usr/bin/env node
/**
 * Programmatic SEO page generator.
 *
 * Fetches the public doctor directory from the API and writes STATIC, crawlable,
 * schema-rich HTML pages into dist/ — one per doctor, per city, per specialization,
 * plus index pages. These are real HTML (content in the initial response) so:
 *   • Googlebot indexes them fast (no JS-render queue)
 *   • AI crawlers (GPTBot, PerplexityBot, ClaudeBot) — which DON'T run JS — can read
 *     and cite them (per Vercel/MERJ 500M-fetch study)
 *
 * Each page carries a human-visible summary AND a JSON-LD block (Dentist +
 * LocalBusiness + AggregateRating where present). Reviews are the PLATFORM rating
 * the doctor (third-party), so star eligibility isn't blocked by Google's
 * self-serving rule. A "View full profile / Book" CTA deep-links into the SPA.
 *
 * Runs after `expo export` + inject-seo, via the "build:web" script.
 * Network-tolerant: if the API is unreachable, it logs and skips (build still ok).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const content = require('./content-pages');
const { pixelHead, pixelNoscript, pixelViewContent } = require('./meta-pixel');

const DIST = path.join(__dirname, '..', 'dist');
const SITE = 'https://mydentistpk.com';
// The app now lives at the apex, so in-page CTAs deep-link to the apex too.
const APP = 'https://mydentistpk.com';
const API = process.env.SEO_API_URL || 'https://api.mydentistpk.com';

// ── tiny fetch (no deps) ────────────────────────────────────────────────────
function getJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 20000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
  });
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => String(s || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const imgUrl = (u) => !u ? `${SITE}/og-image.png` : (u.startsWith('http') ? u : `${API}${u}`);

// Shared <head> for every generated page.
function head({ title, description, canonical, jsonld, pixel }) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0052FF">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="My Dentist">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
${pixelHead()}${pixel ? pixelViewContent(pixel) : ''}
<style>
/* Values mirror the app's own styles so a visitor arriving from search
   recognises the brand: #0052FF primary + #0A1551 ink from WebTopNav, the
   16px-radius / soft-shadow card and 80px doctor photo from HomeScreen. */
:root{--blue:#0052FF;--ink:#0A1551;--muted:#64748B;--line:#E2E8F0;--bg:#F8FAFC}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;color:#0F172A;background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1720px;margin:0 auto;padding:24px 24px 64px}
/* Top bar — same white bar, logo mark and wordmark as the app's web nav. */
header.nav{background:#fff;border-bottom:1px solid #F1F5F9;position:sticky;top:0;z-index:10}
header.nav .navin{max-width:1720px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:10px}
header.nav .brand{display:flex;align-items:center;gap:10px;text-decoration:none}
header.nav .brand img{width:36px;height:36px;border-radius:8px;display:block}
header.nav .brandtxt{font-size:19px;font-weight:900;color:var(--ink);letter-spacing:-.3px}
header.nav .brandtxt span{color:var(--blue)}
header.nav .navcta{margin-left:auto;display:flex;gap:8px;align-items:center}
header.nav .navcta a{font-size:14px;font-weight:700;text-decoration:none;padding:9px 16px;border-radius:12px}
.btn-ghost{color:var(--blue);background:#EFF4FF}
.btn-solid{color:#fff;background:var(--blue)}
a.cta{display:inline-flex;align-items:center;gap:8px;background:var(--blue);color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:14px;margin-top:18px;box-shadow:0 4px 14px rgba(0,82,255,.25)}
h1{font-size:30px;line-height:1.25;color:var(--ink);margin:14px 0 6px;font-weight:800;letter-spacing:-.4px}
h2{font-size:19px;color:var(--ink);margin:30px 0 10px;font-weight:800}
.sub{color:var(--muted);font-size:15px;margin:0;max-width:90ch}
.card{background:#fff;border:1px solid #EEF2F7;border-radius:18px;padding:20px;margin:0;box-shadow:0 1px 2px rgba(2,6,23,.04)}
.card h2{margin:0 0 14px;font-size:16px}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.chip{background:#EFF4FF;color:var(--blue);font-size:13px;font-weight:600;padding:6px 13px;border-radius:20px}
/* Summary of the listing below it: value on top, label under, hairline dividers. */
.stats{display:flex;flex-wrap:wrap;gap:0;margin-top:18px;background:#fff;border:1px solid #EEF2F7;border-radius:14px;overflow:hidden}
.stat{display:flex;flex-direction:column;gap:1px;padding:12px 20px;font-size:12px;color:var(--muted);border-right:1px solid #F1F5F9;flex:1;min-width:120px}
.stat:last-child{border-right:0}
.stat b{font-size:17px;color:var(--ink);font-weight:800;letter-spacing:-.3px}
/* Specialty jump bar — 19 cards in one flat wall is hard to scan, and specialty
   is the axis a patient actually narrows on. */
.jump{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:16px}
.jumplbl{font-size:12.5px;color:#94A3B8;font-weight:650;margin-right:2px}
.jump a{font-size:13px;font-weight:650;color:#475569;background:#fff;border:1px solid #E7EDF5;padding:7px 13px;border-radius:999px;text-decoration:none}
.jump a:hover{border-color:var(--blue);color:var(--blue)}
.specsec{scroll-margin-top:80px}
.sech{display:flex;align-items:center;gap:9px;font-size:17px;margin:26px 0 0}
.sccount{font-size:12px;font-weight:750;color:#475569;background:#F1F5F9;padding:2px 9px;border-radius:999px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-top:14px}
/* auto-fit collapses unused tracks, which stops a lone card sitting beside dead
   space — but it would then stretch that card the full width. Cap the track so a
   one- or two-card row keeps card proportions instead of becoming a banner. */
/* auto-fit collapses unused tracks so a lone card isn't marooned beside dead
   space — but on its own it then stretches that card the full row (a 1-card
   group measured 1552px wide: a banner, not a card). min() keeps tracks fluid
   while capping them, so groups of 1, 2 and 13 all keep the same card shape and
   wide screens still gain a 4th column. */
.grid{grid-template-columns:repeat(auto-fit,minmax(300px,min(400px,100%)));justify-content:start;max-width:1660px}
/* Invisible anchor: merged specialties keep their own jump-bar target. */
.anch{display:block;height:0;scroll-margin-top:80px}
/* Doctor card. A 3-row grid keeps every card the same shape regardless of how
   long the clinic name or address is: identity row, location row, fee row. */
.doc{display:grid;grid-template-columns:72px 1fr;grid-template-areas:"ph bd" "loc loc" "fee fee";gap:0 14px;
  background:#fff;border:1px solid #EEF2F7;border-radius:16px;padding:16px;text-decoration:none;color:inherit;
  box-shadow:0 1px 2px rgba(2,6,23,.04);transition:border-color .15s,box-shadow .15s,transform .15s}
.doc:hover{border-color:#BFD7FF;box-shadow:0 10px 24px rgba(2,6,23,.09);transform:translateY(-2px)}
.doc:focus-visible{outline:2px solid var(--blue);outline-offset:3px}
/* The wrapper takes over the grid area so the photo keeps its slot; the pill is
   positioned against it. */
.doc-phwrap{grid-area:ph;position:relative;width:72px;height:72px;display:block}
.doc-ph{width:72px;height:72px;border-radius:14px;object-fit:cover;background:#EFF6FF;display:block}
/* Popular marker. A star reads at 72px where a URL would be an illegible smudge,
   so listings carry the star and the readable URL goes on the large profile
   photo instead. */
.popmark{position:absolute;top:-4px;right:-4px;width:20px;height:20px;border-radius:999px;
  display:flex;align-items:center;justify-content:center;font-size:11px;line-height:1;
  border:2px solid #fff;box-shadow:0 1px 3px rgba(2,6,23,.2)}
.popmark.paid{background:#1D4ED8;color:#fff}
.popmark.earned{background:#15803D;color:#fff}
.doc-bd{grid-area:bd;min-width:0;display:flex;flex-direction:column;justify-content:center}
.doc-n{font-weight:750;color:var(--ink);font-size:16px;line-height:1.3;letter-spacing:-.2px}
.doc-sp{color:var(--blue);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-top:3px}
.doc-cl{color:var(--muted);font-size:13px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Credibility signals — the reason someone picks one dentist over another. */
.doc-facts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.fact{font-size:11.5px;font-weight:700;color:#475569;background:#F1F5F9;padding:3px 8px;border-radius:6px;white-space:nowrap}
.fact.ok{color:#047857;background:#ECFDF5}
.fact.star{color:#B45309;background:#FFFBEB}
.fact i{font-style:normal;font-weight:600;opacity:.75}
.doc-loc{grid-area:loc;color:#94A3B8;font-size:12.5px;margin-top:12px;padding-top:12px;border-top:1px solid #F1F5F9;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.doc-fee{grid-area:fee;margin-top:8px;font-size:13px;font-weight:750;color:var(--ink)}
.doc-fee i{font-style:normal;font-weight:600;color:#94A3B8;font-size:12px;margin-left:6px}
.stars{color:#F59E0B;font-weight:700;font-size:13px}
@media(max-width:400px){.doc{grid-template-columns:56px 1fr}.doc-ph{width:56px;height:56px}}
${content.CONTENT_CSS}
nav.bc{font-size:13px;color:var(--muted);margin-bottom:10px}
nav.bc a{color:var(--blue);text-decoration:none;font-weight:600}
.linkrow a{color:var(--blue);text-decoration:none;font-weight:600}
/* Two columns on desktop: detail on the left, a sticky booking panel on the
   right. A single centred column left the page feeling empty and pushed the
   only call to action far below the fold. */
.cols{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start;margin-top:16px}
.col-main{display:grid;gap:16px;min-width:0}
.col-side{display:grid;gap:16px;position:sticky;top:84px}
.book{background:#fff;border:1px solid #EEF2F7;border-radius:18px;padding:18px;box-shadow:0 1px 2px rgba(2,6,23,.04)}
.bookfee{display:flex;flex-direction:column;margin-bottom:14px}
.bookfee b{font-size:26px;color:var(--ink);font-weight:800;letter-spacing:-.6px;line-height:1.1}
.bookfee b.nofee{font-size:19px}
.bookfee span{font-size:12.5px;color:var(--muted);margin-top:2px}
.cta.full{display:flex;justify-content:center;width:100%;margin-top:0}
.booknote{margin:10px 0 0;font-size:12px;color:#94A3B8;text-align:center}
.bookhrs{margin:12px 0 0;padding-top:12px;border-top:1px solid #F1F5F9;font-size:12.5px;color:#047857;font-weight:650;display:flex;align-items:center;gap:7px}
.bookhrs .dot{width:7px;height:7px;border-radius:50%;background:#10B981;flex:0 0 7px}
.sidelinks h2{margin:0 0 8px;font-size:15px}
.sidelinks .sub{font-size:14px;margin:0 0 6px}
.sidelinks .sub a{color:var(--blue);text-decoration:none;font-weight:600}
@media(max-width:900px){
  .cols{grid-template-columns:1fr}
  .col-side{position:static}
}
/* Definition list of clinic facts — scannable rows instead of a stack of
   one-line <h2> sections, which made short answers look like article headings. */
.facts{margin:0;display:grid;gap:0}
.facts>div{display:grid;grid-template-columns:26px 132px 1fr;gap:0 12px;align-items:start;padding:14px 0;border-top:1px solid #F1F5F9}
.facts>div:first-child{border-top:0;padding-top:2px}
.facts .ic{width:26px;height:26px;border-radius:8px;background:#F8FAFC;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1;margin-top:-1px}
.facts dt{color:var(--muted);font-size:13.5px;font-weight:600;padding-top:3px}
.facts dd{margin:0;color:#0F172A;font-size:14.5px;font-weight:600;line-height:1.5;padding-top:2px}
.facts dd .hrs{display:inline-block;margin-left:8px;background:#ECFDF5;color:#047857;font-size:12.5px;font-weight:700;padding:2px 9px;border-radius:6px;white-space:nowrap}
.about{color:#334155;font-size:15px;margin:0;max-width:68ch}
@media(max-width:620px){
  .facts>div{grid-template-columns:26px 1fr;gap:0 10px}
  .facts dt{grid-column:2;padding-top:0;font-size:12.5px}
  .facts dd{grid-column:2;padding-top:1px}
}
/* Doctor profile hero — photo beside the name/specialty, like the app's header. */
.prof{display:flex;gap:20px;align-items:center;background:#fff;border:1px solid #EEF2F7;border-radius:18px;padding:20px;margin-top:4px;box-shadow:0 1px 2px rgba(2,6,23,.04)}
.prof .profphwrap{position:relative;flex:0 0 104px;width:104px;height:104px;display:block}
.prof .profph{width:104px;height:104px;border-radius:16px;object-fit:cover;background:#EFF6FF;display:block}
/* Popular sits top, the site URL sits along the bottom edge. At 104px the URL is
   readable; the listing thumbnails are 72px, which is why they carry the star
   only. Both are CSS, so they cost nothing and stay sharp on any display —
   though they do not survive someone saving the image (the resize route bakes a
   watermark into the large sizes for that). */
.prof .propop{position:absolute;top:-6px;left:-6px;display:inline-flex;align-items:center;gap:3px;
  font-size:9.5px;font-weight:800;letter-spacing:.2px;color:#fff;padding:3px 7px;border-radius:999px;
  border:2px solid #fff;box-shadow:0 1px 4px rgba(2,6,23,.25);white-space:nowrap}
.prof .propop.paid{background:#1D4ED8}
.prof .propop.earned{background:#15803D}
.prof .prosite{position:absolute;left:0;right:0;bottom:0;text-align:center;font-size:8.5px;font-weight:700;
  letter-spacing:.1px;color:#fff;background:linear-gradient(transparent,rgba(2,6,23,.72));
  padding:10px 2px 3px;border-radius:0 0 16px 16px;pointer-events:none}
.prof .profbd{min-width:0;flex:1}
.prof h1{margin:0 0 4px;font-size:27px}
.prof .meta{margin:12px 0 0;gap:7px}
.prof .chip{background:#F1F5F9;color:#475569;font-size:12.5px;font-weight:650;padding:5px 11px}
/* Specialty leads the chip row — it is the one attribute a patient filters on. */
.prof .chip.key{background:#EFF4FF;color:var(--blue);font-weight:700}
.prof .chip.ver{background:#ECFDF5;color:#047857}
@media(max-width:560px){
  .prof{flex-direction:column;align-items:flex-start;gap:14px}
  .prof .profph{width:88px;height:88px;flex:0 0 88px}
  .prof h1{font-size:23px}
}
@media(max-width:560px){
  .prof{flex-direction:column;gap:14px;padding:18px}
  .prof .profph{width:96px;height:96px;flex:0 0 96px}
}
/* Header nav — hidden on narrow screens where the CTAs need the room. */
header.nav .navlinks{display:none;gap:2px;flex-grow:1;justify-content:center;margin:0 16px}
header.nav .navlinks a{font-size:14px;font-weight:650;color:#475569;text-decoration:none;padding:9px 13px;border-radius:10px}
header.nav .navlinks a:hover{background:#F1F5F9;color:var(--ink)}
@media(min-width:1024px){header.nav .navlinks{display:flex}}
/* Footer: four link columns over a baseline. Present on every generated page,
   so a crawler landing anywhere can reach the rest of the site. */
footer{background:#fff;border-top:1px solid #EEF2F7;margin-top:56px}
footer .fin{max-width:1720px;margin:0 auto;padding:36px 24px 24px;color:var(--muted);font-size:13px}
.fcols{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:28px}
.fcol{display:flex;flex-direction:column;gap:9px;min-width:0}
.fcol h3{margin:0 0 3px;font-size:13px;font-weight:750;color:var(--ink);letter-spacing:.02em}
.fcol a{color:#475569;text-decoration:none;font-weight:500;font-size:13.5px}
.fcol a:hover{color:var(--blue)}
.fbrandtxt{font-size:17px;font-weight:900;color:var(--ink);letter-spacing:-.3px}
.fbrandtxt span{color:var(--blue)}
.fabout{margin:2px 0 0;font-size:13px;line-height:1.6;max-width:34ch;color:var(--muted)}
.fbase{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;
  margin-top:28px;padding-top:18px;border-top:1px solid #F1F5F9;font-size:12.5px}
footer a{color:var(--blue);text-decoration:none;font-weight:600}
@media(max-width:760px){.fcols{grid-template-columns:1fr 1fr;gap:24px}.fbrand{grid-column:1 / -1}}
@media(max-width:420px){.fcols{grid-template-columns:1fr}}
@media(max-width:560px){
  h1{font-size:24px}
  .grid{grid-template-columns:1fr}
  header.nav .navcta a{padding:8px 12px;font-size:13px}
}
</style></head><body>
<header class="nav"><div class="navin">
  <a class="brand" href="${SITE}/"><img src="${SITE}/icons/hero-logo.webp" width="36" height="36" alt="My Dentist logo" loading="eager"/><span class="brandtxt">My <span>Dentist</span></span></a>
  <nav class="navlinks" aria-label="Main">
    <a href="${SITE}/dentists/islamabad">Islamabad</a>
    <a href="${SITE}/dentists/rawalpindi">Rawalpindi</a>
    <a href="${SITE}/treatments">Treatments</a>
    <a href="${SITE}/about">About</a>
  </nav>
  <span class="navcta"><a class="btn-ghost" rel="nofollow" href="${APP}">Log in</a><a class="btn-solid" rel="nofollow" href="${APP}">Sign up</a></span>
</div></header>
${pixelNoscript()}`;
}
// "Open the app" / CTA links point at SPA routes that render the generic app
// shell (same title + canonical as the homepage). Marking them nofollow keeps
// crawl budget on the static pages instead of homepage duplicates.
// Site footer. Every generated page carries it, so it doubles as internal
// linking: each page links to the cities, treatments and policy pages, which is
// how a crawler discovers the whole set from wherever it lands.
const foot = `<footer><div class="fin">
  <div class="fcols">
    <div class="fcol fbrand">
      <span class="fbrandtxt">My <span>Dentist</span></span>
      <p class="fabout">Find and book verified PMDC dentists across Pakistan. Compare clinics, fees and timings, then book online.</p>
    </div>
    <div class="fcol">
      <h3>Find a dentist</h3>
      <a href="${SITE}/dentists/islamabad">Dentists in Islamabad</a>
      <a href="${SITE}/dentists/rawalpindi">Dentists in Rawalpindi</a>
      <a href="${SITE}/specialists/orthodontist">Orthodontists</a>
      <a href="${SITE}/specialists/cosmetic-dentist">Cosmetic Dentists</a>
    </div>
    <div class="fcol">
      <h3>Treatments</h3>
      <a href="${SITE}/treatments/braces-orthodontics">Braces &amp; Orthodontics</a>
      <a href="${SITE}/treatments/dental-implants">Dental Implants</a>
      <a href="${SITE}/treatments/root-canal">Root Canal</a>
      <a href="${SITE}/treatments">All treatments</a>
    </div>
    <div class="fcol">
      <h3>Company</h3>
      <a href="${SITE}/about">About us</a>
      <a href="${SITE}/contact">Contact</a>
      <a href="${SITE}/terms">Terms &amp; Conditions</a>
      <a href="${SITE}/privacy">Privacy Policy</a>
    </div>
  </div>
  <div class="fbase">
    <span>© ${new Date().getFullYear()} My Dentist. All rights reserved.</span>
    <a rel="nofollow" href="${APP}">Open the app →</a>
  </div>
</div></footer></body></html>`;

// Shared doctor card for the city + specialist grids.
//
// Ordered by what actually helps someone choose a dentist: name, specialty,
// then the credibility signals (experience, PMDC, rating) the app's own card
// leads with. The clinic address is real but low-value for the decision, so it
// sits last as a single truncated line instead of the three-line block that
// previously dominated every card and left them ragged and uneven.
function doctorCard(d, locLine, opts = {}) {
  const name = String(d.fullName || '').trim();
  const photo = d.photo ? imgUrl(d.photo) : `${SITE}/icons/hero-logo.webp`;
  const spec = (d.specialization || 'Dentist').trim();
  const clinic = (d.clinicName || '').trim();

  const facts = [
    d.experience ? `<span class="fact">${Number(d.experience)}+ yrs</span>` : '',
    d.pmdcVerified ? `<span class="fact ok">PMDC verified</span>` : '',
    d.avgRating && d.totalReviews
      ? `<span class="fact star">★ ${Number(d.avgRating).toFixed(1)} <i>(${d.totalReviews})</i></span>` : '',
  ].filter(Boolean).join('');

  // Paid and earned are visually distinct: paid is the blue promoted placement,
  // earned is green and reflects reward points. Same wording, different weight.
  const popPill = d.isPopular
    ? `<span class="popmark ${d.popularType === 'paid' ? 'paid' : 'earned'}" aria-label="Popular dentist">★</span>`
    : '';

  return `<a class="doc" href="${doctorUrl(d)}">
  <span class="doc-phwrap"><img class="doc-ph" src="${esc(photo)}" width="72" height="72" alt="${esc(name)}" loading="lazy"/>${popPill}</span>
  <span class="doc-bd">
    <span class="doc-n">${esc(name)}</span>
    <span class="doc-sp">${esc(spec)}</span>
    ${clinic ? `<span class="doc-cl">${esc(clinic)}</span>` : ''}
    ${facts ? `<span class="doc-facts">${facts}</span>` : ''}
  </span>
  ${locLine ? `<span class="doc-loc">${locLine}</span>` : ''}
  ${/* Only show the fee when it actually distinguishes this doctor. When every
        listing carries the same number it is noise in the most prominent slot
        on the card, repeated once per doctor. */''}
  ${opts.showFee && d.consultationFee ? `<span class="doc-fee">PKR ${Number(d.consultationFee).toLocaleString('en-PK')}<i>consultation</i></span>` : ''}
</a>`;
}

function ratingBlock(avg, total) {
  if (!avg || !total) return '';
  const stars = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
  return `<div class="meta"><span class="stars">${stars} ${Number(avg).toFixed(1)}</span> <span class="sub">(${total} review${total === 1 ? '' : 's'})</span></div>`;
}

// ── Page builders ───────────────────────────────────────────────────────────
function doctorPage(d) {
  const name = String(d.fullName || 'Dentist').trim();
  const s = slug(name) + '-' + String(d._id || d.id).slice(-6);
  const canonical = `${SITE}/dentist/${s}`;
  const spec = d.specialization || 'Dentist';
  const city = d.city || 'Pakistan';
  const clinic = (d.clinicName || '').trim();
  const title = `${name} — ${spec} in ${city} | Book Online | My Dentist`;
  const desc = `Book an appointment with ${name}, ${spec}${clinic ? ` at ${clinic}` : ''} in ${city}. ${d.experience ? d.experience + '+ years experience. ' : ''}${d.pmdcVerified ? 'PMDC-verified. ' : ''}View profile, timings, fees & reviews on My Dentist.`;

  const jsonld = [{
    '@context': 'https://schema.org',
    '@type': ['Dentist', 'LocalBusiness'],
    name, description: (d.about || desc).slice(0, 500),
    image: imgUrl(d.photo), url: canonical,
    medicalSpecialty: spec,
    telephone: d.clinicContact || d.phone || undefined,
    address: { '@type': 'PostalAddress', addressLocality: city, addressCountry: 'PK', streetAddress: d.address || undefined },
    ...(d.lat && d.lng ? { geo: { '@type': 'GeoCoordinates', latitude: d.lat, longitude: d.lng } } : {}),
    ...(clinic ? { worksFor: { '@type': 'Dentist', name: clinic } } : {}),
    ...(d.consultationFee ? { priceRange: `PKR ${Number(d.consultationFee).toLocaleString('en-PK')}` } : {}),
    ...(openingHours(d.clinicTiming) ? { openingHours: openingHours(d.clinicTiming) } : {}),
    ...(d.avgRating && d.totalReviews ? {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(d.avgRating).toFixed(1), reviewCount: d.totalReviews, bestRating: 5 }
    } : {}),
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: `Dentists in ${city}`, item: `${SITE}/dentists/${slug(city)}` },
      { '@type': 'ListItem', position: 3, name, item: canonical },
    ],
  }];

  // Doctors sometimes paste social links into their bio. Raw URLs read as spam
  // on a profile page and leak link equity, so strip them and fall back to a
  // generated summary if that leaves nothing meaningful behind.
  const aboutText = (() => {
    const raw = String(d.about || '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (raw.length >= 40) return raw;
    return `${name} is a ${spec}${clinic ? ` practising at ${clinic}` : ''} in ${city}`
      + `${d.experience ? ` with ${d.experience}+ years of experience` : ''}. `
      + `Book a verified appointment through My Dentist.`;
  })();

  // Weighted, not uniform: specialty is what a patient filters on, PMDC is the
  // trust signal. The rest are supporting detail and stay neutral.
  const chips = [
    spec && `<span class="chip key">${esc(specSingular(spec))}</span>`,
    d.pmdcVerified && `<span class="chip ver">✓ PMDC verified</span>`,
    d.experience && `<span class="chip">${d.experience}+ yrs experience</span>`,
    d.clinicTier && `<span class="chip">${esc(d.clinicTier)} clinic</span>`,
    (d.languages || []).length && `<span class="chip">${esc((d.languages || []).join(', '))}</span>`,
  ].filter(Boolean).join(' ');

  const body = `<div class="wrap">
<nav class="bc"><a href="${SITE}/">Home</a> › <a href="${SITE}/dentists/${slug(city)}">Dentists in ${esc(city)}</a> › ${esc(name)}</nav>
<div class="prof">
  <span class="profphwrap"><img class="profph" src="${esc(d.photo ? imgUrl(d.photo) : `${SITE}/icons/hero-logo.webp`)}" width="120" height="120" alt="${esc(name)}"/>${d.isPopular ? `<span class="propop ${d.popularType === 'paid' ? 'paid' : 'earned'}">★ Popular</span>` : ''}<span class="prosite">mydentistpk.com</span></span>
  <div class="profbd">
    <h1>${esc(name)}</h1>
    <p class="sub">${esc(spec)}${clinic ? ` · ${esc(clinic)}` : ''} · ${esc(city)}</p>
    ${ratingBlock(d.avgRating, d.totalReviews)}
    <div class="meta">${chips}</div>
  </div>
</div>
<div class="cols">
  <div class="col-main">
    ${aboutText ? `<div class="card"><h2>About ${esc(name)}</h2><p class="about">${esc(aboutText)}</p></div>` : ''}
    <div class="card">
      <h2>Clinic &amp; appointment details</h2>
      <dl class="facts">
        ${clinic ? `<div><span class="ic">🏥</span><dt>Clinic</dt><dd>${esc(clinic)}</dd></div>` : ''}
        ${d.address ? `<div><span class="ic">📍</span><dt>Address</dt><dd>${esc(fullAddress(d.address, city))}</dd></div>` : ''}
        ${d.clinicTiming?.days ? `<div><span class="ic">🕒</span><dt>Open</dt><dd>${esc(d.clinicTiming.days)}${d.clinicTiming.startTime ? `<span class="hrs">${esc(d.clinicTiming.startTime)}–${esc(d.clinicTiming.endTime || '')}</span>` : ''}</dd></div>` : ''}
        ${d.experience ? `<div><span class="ic">🎓</span><dt>Experience</dt><dd>${Number(d.experience)}+ years</dd></div>` : ''}
        ${(d.languages || []).length ? `<div><span class="ic">💬</span><dt>Languages</dt><dd>${esc((d.languages || []).join(', '))}</dd></div>` : ''}
      </dl>
    </div>
  </div>
  <aside class="col-side">
    <div class="book">
      ${d.consultationFee
        ? `<div class="bookfee"><b>PKR ${Number(d.consultationFee).toLocaleString('en-PK')}</b><span>consultation fee</span></div>`
        : `<div class="bookfee"><b class="nofee">Book a visit</b><span>with ${esc(name)}</span></div>`}
      <a class="cta full" rel="nofollow" href="${APP}/doctor/${esc(d._id || d.id)}">Book appointment →</a>
      <p class="booknote">Free to book · Confirmed by the clinic</p>
      ${d.clinicTiming?.startTime ? `<p class="bookhrs"><span class="dot"></span>Open ${esc(d.clinicTiming.startTime)}–${esc(d.clinicTiming.endTime || '')}</p>` : ''}
    </div>
    <div class="card sidelinks">
      <h2>Nearby</h2>
      <p class="sub"><a href="${SITE}/dentists/${slug(city)}">All dentists in ${esc(city)}</a></p>
      <p class="sub"><a href="${SITE}/specialists/${slug(spec)}">${esc(specPlural(spec))} in Pakistan</a></p>
    </div>
  </aside>
</div>
</div>`;

  // ViewContent for a dentist profile — a real page load the SPA never sees.
  const pixel = { name, category: spec, id: String(d._id || d.id) };
  return { path: `dentist/${s}.html`, url: canonical, html: head({ title, description: desc, canonical, jsonld, pixel }) + body + foot };
}

// Specialty labels. The API stores "General", which naively pluralised to
// "Generals in Pakistan" — reads as a surname, not a profession. Map the odd
// ones out and pluralise the rest.
const SPEC_PLURAL = {
  General: 'General Dentists',
  'General Dentist': 'General Dentists',
};
const specPlural = (s) => SPEC_PLURAL[s] || `${s}s`;
const SPEC_SINGULAR = { General: 'General Dentist' };
const specSingular = (s) => SPEC_SINGULAR[s] || s;

// "<address>, <city>" without repeating the city when the address already ends
// with it — 7 of 29 do, which produced "…Sector F 8/3, Islamabad, Islamabad".
const fullAddress = (addr, city) => {
  let a = String(addr || '').trim();
  const c = String(city || '').trim();
  if (!a) return c;
  // Drop trailing country/postcode noise some clinics paste in ("…, 44000,
  // Pakistan"), then the city if it is already there anywhere in the tail.
  a = a
    .replace(/[,\s]*\bPakistan\b[.,\s]*$/i, '')
    .replace(/[,\s]*\b\d{5}\b[.,\s]*$/, '')
    .replace(/[,\s]+$/, '');
  if (!c) return a;
  const esc = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Already names the city (at the end, or before the noise we just stripped)?
  if (new RegExp(`\\b${esc}\\b[\\s,]*$`, 'i').test(a)) return a;
  if (new RegExp(`\\b${esc}\\b`, 'i').test(a)) return a;
  return `${a}, ${c}`;
};

// Canonical URL for a doctor — the slug rule lives here so the page, the list
// entries and the sitemap can't drift apart.
const doctorUrl = (d) =>
  `${SITE}/dentist/${slug(String(d.fullName || 'dentist').trim())}-${String(d._id || d.id).slice(-6)}`;

// schema.org expects two-letter day prefixes (Mo, Tu, We…); the API stores
// three-letter ones (Mon, Tue, Wed…).
const SCHEMA_DAY = { Mon: 'Mo', Tue: 'Tu', Wed: 'We', Thu: 'Th', Fri: 'Fr', Sat: 'Sa', Sun: 'Su' };

// "Mo,Tu,We 11:00-19:00" — Google's recommended openingHours shape. Returns
// undefined when the doctor has no usable timing so the field is omitted
// rather than emitted empty.
function openingHours(timing) {
  if (!timing) return undefined;
  const days = (timing.availableDays || [])
    .map((d) => SCHEMA_DAY[d])
    .filter(Boolean);
  const { startTime, endTime } = timing;
  if (!days.length || !startTime || !endTime) return undefined;
  return `${days.join(',')} ${startTime}-${endTime}`;
}

// A Dentist/LocalBusiness node for embedding in a list page's ItemList.
//
// The list pages previously carried only CollectionPage + a bare ItemList of
// names and URLs — no address, geo or phone anywhere. That left the pages most
// likely to rank for "dentists in <city>" with no location signals at all,
// while the individual doctor pages were fully marked up. Inlining the same
// business data here lets the list page itself carry local meaning.
function doctorNode(d) {
  const city = d.city || 'Pakistan';
  const clinic = (d.clinicName || '').trim();
  return {
    '@type': ['Dentist', 'LocalBusiness'],
    name: String(d.fullName || '').trim(),
    url: doctorUrl(d),
    image: imgUrl(d.photo),
    ...(d.specialization ? { medicalSpecialty: d.specialization } : {}),
    ...(d.clinicContact || d.phone ? { telephone: d.clinicContact || d.phone } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: city,
      addressCountry: 'PK',
      ...(d.address ? { streetAddress: d.address } : {}),
    },
    ...(d.lat && d.lng
      ? { geo: { '@type': 'GeoCoordinates', latitude: d.lat, longitude: d.lng } }
      : {}),
    ...(clinic ? { worksFor: { '@type': 'Dentist', name: clinic } } : {}),
    // priceRange + openingHours are recommended fields for LocalBusiness; both
    // come straight from data every doctor already has on file.
    ...(d.consultationFee
      ? { priceRange: `PKR ${Number(d.consultationFee).toLocaleString('en-PK')}` }
      : {}),
    ...(openingHours(d.clinicTiming) ? { openingHours: openingHours(d.clinicTiming) } : {}),
    ...(d.avgRating && d.totalReviews
      ? { aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: Number(d.avgRating).toFixed(1),
          reviewCount: d.totalReviews,
          bestRating: 5,
        } }
      : {}),
  };
}

function cityPage(city, docs) {
  const canonical = `${SITE}/dentists/${slug(city)}`;
  const title = `Best Dentists in ${city} — Book Verified PMDC Dentists | My Dentist`;
  const desc = `Find and book the best dentists in ${city}. ${docs.length} verified PMDC dental specialist${docs.length === 1 ? '' : 's'} — compare clinics, reviews, fees & timings. Book online on My Dentist.`;
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: title, url: canonical, description: desc,
    about: { '@type': 'Thing', name: `Dentists in ${city}` },
    // Names the place this page is about, so the page reads as being *for*
    // ${city} rather than merely mentioning it.
    areaServed: { '@type': 'City', name: city, addressCountry: 'PK' },
  }, {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: `Dentists in ${city}`,
    numberOfItems: docs.length,
    itemListElement: docs.map((d, i) => ({
      // `url` and `item` are mutually exclusive on a ListItem: a summary list
      // uses `url`, a full-detail list uses `item`. Emitting both made Google
      // reject the whole carousel with "Two or more mutually exclusive
      // properties used in a single structured data item". The nested node
      // carries its own `url`, so the outer one was redundant anyway.
      '@type': 'ListItem', position: i + 1, item: doctorNode(d),
    })),
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: `Dentists in ${city}`, item: canonical },
    ],
  }];
  // Fees only earn a slot on the card when they differ between doctors.
  const feeSet = new Set(docs.map((d) => Number(d.consultationFee)).filter((n) => n > 0));
  const showFee = feeSet.size > 1;
  const cards = docs.map((d) => doctorCard(d, esc(fullAddress(d.address, city)), { showFee })).join('');
  // Specialties represented in this city — links out to the specialist pages so
  // the two page families reinforce each other instead of standing alone.
  const specs = [...new Set(docs.map((d) => (d.specialization || '').trim()).filter(Boolean))].sort();
  const specLinks = specs.length
    ? `<h2>Dental specialists in ${esc(city)}</h2><p class="sub">${specs.map((s) => `<a href="${SITE}/specialists/${slug(s)}">${esc(specPlural(s))}</a>`).join(' · ')}</p>`
    : '';
  const verified = docs.filter((d) => d.pmdcVerified).length;
  const fees = docs.map((d) => Number(d.consultationFee)).filter((n) => n > 0);
  const feeLabel = fees.length
    ? (Math.min(...fees) === Math.max(...fees)
      ? `PKR ${Math.min(...fees).toLocaleString('en-PK')}`
      : `PKR ${Math.min(...fees).toLocaleString('en-PK')}–${Math.max(...fees).toLocaleString('en-PK')}`)
    : null;
  // Facts drawn from the listing itself — a summary of what is on the page,
  // not decoration.
  const stats = [
    `<span class="stat"><b>${docs.length}</b>dentist${docs.length === 1 ? '' : 's'}</span>`,
    verified ? `<span class="stat"><b>${verified}</b>PMDC verified</span>` : '',
    specs.length ? `<span class="stat"><b>${specs.length}</b>specialt${specs.length === 1 ? 'y' : 'ies'}</span>` : '',
    // One flat rate across the listing reads better as "from" than as a range.
    feeLabel ? `<span class="stat"><b>${feeLabel}</b>${feeSet.size > 1 ? 'consultation fees' : 'consultation fee'}</span>` : '',
  ].filter(Boolean).join('');

  const body = `<div class="wrap">
<nav class="bc"><a href="${SITE}/">Home</a> › Dentists in ${esc(city)}</nav>
<h1>Best dentists in ${esc(city)}</h1>
<p class="sub">Compare verified PMDC dentists in ${esc(city)} by specialty, experience and clinic, then book online.</p>
<div class="stats">${stats}</div>
${specs.length > 1 ? `<nav class="jump" aria-label="Jump to a specialty"><span class="jumplbl">Jump to</span>${specs.map((s) => `<a href="#${slug(s)}">${esc(specPlural(s))}</a>`).join('')}</nav>` : ''}
${specs.length > 1
  ? (() => {
      // Rawalpindi runs 1, 1, 13, 1, 2, 1 by specialty. Giving a lone dentist the
      // same section header as a group of thirteen fragments the page into mostly
      // empty bands, so only groups big enough to fill a row get their own
      // section; the rest collect under one heading. The jump bar still links to
      // every specialty, so nothing becomes unreachable.
      const groups = specs.map((sp) => ({ sp, list: docs.filter((d) => (d.specialization || '').trim() === sp) }));
      const big = groups.filter((g) => g.list.length >= 3);
      const small = groups.filter((g) => g.list.length < 3);
      const section = (id, heading, list) => `<section class="specsec" id="${id}">
<h2 class="sech">${heading}<span class="sccount">${list.length}</span></h2>
<div class="grid">${list.map((d) => doctorCard(d, esc(fullAddress(d.address, city)), { showFee })).join('')}</div>
</section>`;
      const smallList = small.flatMap((g) => g.list);
      return [
        ...big.map((g) => section(slug(g.sp), `${esc(specPlural(g.sp))} in ${esc(city)}`, g.list)),
        // Anchors for the merged specialties so the jump bar keeps working.
        smallList.length
          ? `<section class="specsec" id="${slug(small[0].sp)}">${small.slice(1).map((g) => `<span class="anch" id="${slug(g.sp)}"></span>`).join('')}
<h2 class="sech">Other specialists in ${esc(city)}<span class="sccount">${smallList.length}</span></h2>
<div class="grid">${smallList.map((d) => doctorCard(d, esc(fullAddress(d.address, city)), { showFee })).join('')}</div>
</section>`
          : '',
      ].join('');
    })()
  : `<div class="grid">${cards}</div>`}
${specLinks}
<a class="cta" rel="nofollow" href="${APP}">Open My Dentist to book →</a>
</div>`;
  const pixel = { name: city, category: 'City', id: slug(city), type: 'product_group' };
  return { path: `dentists/${slug(city)}.html`, url: canonical, html: head({ title, description: desc, canonical, jsonld, pixel }) + body + foot };
}

function specPage(spec, docs) {
  const canonical = `${SITE}/specialists/${slug(spec)}`;
  const title = `${specPlural(spec)} in Pakistan — Book a Verified ${specSingular(spec)} | My Dentist`;
  const desc = `Find and book a verified ${spec} in Pakistan. ${docs.length} PMDC-verified specialist${docs.length === 1 ? '' : 's'} — compare clinics, reviews & fees on My Dentist.`;
  // Cities this specialty is actually available in — a real signal for
  // "<specialty> in <city>" queries, which is where a directory can rank
  // (unlike "near me", which the Maps pack owns).
  const cities = [...new Set(docs.map((d) => (d.city || '').trim()).filter(Boolean))].sort();
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: title, url: canonical, description: desc,
    about: { '@type': 'MedicalSpecialty', name: spec },
    ...(cities.length
      ? { areaServed: cities.map((c) => ({ '@type': 'City', name: c, addressCountry: 'PK' })) }
      : {}),
  }, {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: `${specPlural(spec)} in Pakistan`,
    numberOfItems: docs.length,
    itemListElement: docs.map((d, i) => ({
      // `url` and `item` are mutually exclusive on a ListItem: a summary list
      // uses `url`, a full-detail list uses `item`. Emitting both made Google
      // reject the whole carousel with "Two or more mutually exclusive
      // properties used in a single structured data item". The nested node
      // carries its own `url`, so the outer one was redundant anyway.
      '@type': 'ListItem', position: i + 1, item: doctorNode(d),
    })),
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: `${specPlural(spec)} in Pakistan`, item: canonical },
    ],
  }];
  // Fees only earn a slot on the card when they differ between doctors.
  const feeSet = new Set(docs.map((d) => Number(d.consultationFee)).filter((n) => n > 0));
  const showFee = feeSet.size > 1;
  const cards = docs.map((d) => doctorCard(d, esc(fullAddress(d.address, d.city)), { showFee })).join('');
  // "<specialty> in <city>" is the query shape a directory can realistically win,
  // so surface those combinations as real links.
  const cityLinks = cities.length
    ? `<h2>${esc(specPlural(spec))} by city</h2><p class="sub">${cities.map((c) => `<a href="${SITE}/dentists/${slug(c)}">${esc(specPlural(spec))} in ${esc(c)}</a>`).join(' · ')}</p>`
    : '';
  const verified = docs.filter((d) => d.pmdcVerified).length;
  const fees = docs.map((d) => Number(d.consultationFee)).filter((n) => n > 0);
  const feeLabel = fees.length
    ? (Math.min(...fees) === Math.max(...fees)
      ? `PKR ${Math.min(...fees).toLocaleString('en-PK')}`
      : `PKR ${Math.min(...fees).toLocaleString('en-PK')}–${Math.max(...fees).toLocaleString('en-PK')}`)
    : null;
  const stats = [
    `<span class="stat"><b>${docs.length}</b>${esc((docs.length===1?specSingular(spec):specPlural(spec)).toLowerCase())}</span>`,
    verified ? `<span class="stat"><b>${verified}</b>PMDC verified</span>` : '',
    cities.length ? `<span class="stat"><b>${cities.length}</b>cit${cities.length === 1 ? 'y' : 'ies'}</span>` : '',
    // One flat rate across the listing reads better as "from" than as a range.
    feeLabel ? `<span class="stat"><b>${feeLabel}</b>${feeSet.size > 1 ? 'consultation fees' : 'consultation fee'}</span>` : '',
  ].filter(Boolean).join('');

  const body = `<div class="wrap"><nav class="bc"><a href="${SITE}/">Home</a> › ${esc(spec)}</nav>
<h1>${esc(specPlural(spec))} in Pakistan</h1>
<p class="sub">Compare verified PMDC ${esc(specPlural(spec).toLowerCase())}${cities.length ? ` in ${esc(cities.join(' and '))}` : ''} by experience and clinic, then book online.</p>
<div class="stats">${stats}</div>
<div class="grid">${cards}</div>
${cityLinks}
<a class="cta" rel="nofollow" href="${APP}">Open My Dentist to book →</a></div>`;
  const pixel = { name: spec, category: 'Specialty', id: slug(spec), type: 'product_group' };
  return { path: `specialists/${slug(spec)}.html`, url: canonical, html: head({ title, description: desc, canonical, jsonld, pixel }) + body + foot };
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  if (!fs.existsSync(DIST)) { console.error('[gen-seo] dist/ missing — export first'); process.exit(1); }
  // The API caps `limit` at 100 (larger values return an empty page), so page
  // through until a page comes back short or empty.
  let docs = [];
  try {
    const PER = 100;
    for (let page = 1; page <= 100; page++) {
      const res = await getJSON(`${API}/api/doctors?limit=${PER}&page=${page}`);
      const batch = (res && res.data) || [];
      docs = docs.concat(batch);
      if (batch.length < PER) break; // last page
    }
  } catch (e) {
    console.warn(`[gen-seo] could not reach API (${e.message}) — skipping programmatic pages. Homepage SEO still applied.`);
    return; // don't fail the build
  }
  // Only real, approved, non-blocked doctors with a name.
  docs = docs.filter((d) => d && d.fullName && d.fullName.trim() && !d.isBlocked && d.approvalStatus !== 'rejected');
  if (!docs.length) { console.warn('[gen-seo] no doctors returned — skipping.'); return; }

  const urls = [];
  const write = ({ path: rel, url, html }) => {
    const full = path.join(DIST, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, html, 'utf8');
    urls.push(url);
  };

  // Per-doctor
  docs.forEach((d) => write(doctorPage(d)));

  // Per-city
  const byCity = {};
  docs.forEach((d) => { const c = (d.city || '').trim(); if (c) (byCity[c] = byCity[c] || []).push(d); });
  Object.entries(byCity).forEach(([c, ds]) => write(cityPage(c, ds)));

  // Per-specialization
  const bySpec = {};
  docs.forEach((d) => { const s = (d.specialization || '').trim(); if (s) (bySpec[s] = bySpec[s] || []).push(d); });
  Object.entries(bySpec).forEach(([s, ds]) => write(specPage(s, ds)));

  // ── Content pages: treatments, about, contact, legal ──────────────────────
  // Ordinary web results a directory can win, unlike "near me" which the Maps
  // pack owns. Written before the sitemap so they are included in it.
  const helpers = { SITE, esc, slug, head, foot, doctorCard, fullAddress, specPlural };
  write(content.treatmentsIndex(docs, helpers));
  content.TREATMENTS.forEach((t) => write(content.treatmentPage(t, docs, helpers)));
  write(content.aboutPage(docs, helpers));
  write(content.contactPage(helpers));
  write(content.legalPage('terms', helpers));
  write(content.legalPage('privacy', helpers));

  // ── sitemap.xml (homepage + all generated pages) ──
  // <lastmod> lets Google prioritise recrawls; without it every URL looks equally
  // stale. Build date is the honest signal — the pages are rebuilt each deploy.
  const lastmod = new Date().toISOString().slice(0, 10);
  const all = [`${SITE}/`, ...urls];
  const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    all.map((u) => `  <url><loc>${u}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq></url>`).join('\n') +
    `\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sm);

  // ── Crawlable link hub on the homepage ──────────────────────────────────────
  // The Expo shell renders navigation as onPress handlers, so dist/index.html
  // contains ZERO <a href> — every generated page above was reachable only from
  // sitemap.xml. A sitemap declares URLs but passes no link equity, which is why
  // Search Console parked these as "Discovered – currently not indexed".
  // Injecting a real anchor directory gives them an entrance in the crawl graph.
  //
  // It lives inside the #pp-hero overlay that inject-seo.js already injects, so
  // it's in the initial HTML for crawlers but disappears with the hero once React
  // mounts — no visual change to the live app, no layout shift.
  try {
    const INDEX = path.join(DIST, 'index.html');
    let idx = fs.readFileSync(INDEX, 'utf8');

    const linkList = (items) => items
      .map(({ href, label }) => `<a href="${href}" style="color:#0052FF;text-decoration:none;">${esc(label)}</a>`)
      .join('<span style="color:#CBD5E1;"> · </span>');

    const cityLinks = Object.keys(byCity).sort().map((c) => ({
      href: `${SITE}/dentists/${slug(c)}`, label: `Dentists in ${c}`,
    }));
    const specLinks = Object.keys(bySpec).sort().map((s) => ({
      href: `${SITE}/specialists/${slug(s)}`, label: specPlural(s),
    }));
    // Content pages need an entrance too — the same orphan problem the doctor
    // pages had when they were reachable only from sitemap.xml.
    const treatmentLinks = [
      { href: `${SITE}/treatments`, label: 'All treatments' },
      ...content.TREATMENTS.map((t) => ({ href: `${SITE}/treatments/${t.slug}`, label: t.name })),
    ];
    const sitePageLinks = [
      { href: `${SITE}/about`, label: 'About My Dentist' },
      { href: `${SITE}/contact`, label: 'Contact' },
      { href: `${SITE}/terms`, label: 'Terms & Conditions' },
      { href: `${SITE}/privacy`, label: 'Privacy Policy' },
    ];

    // Every doctor, so no profile page is more than one hop from the homepage.
    const docLinks = docs.map((d) => {
      const name = String(d.fullName || 'Dentist').trim();
      return {
        href: `${SITE}/dentist/${slug(name)}-${String(d._id || d.id).slice(-6)}`,
        label: name,
      };
    }).sort((a, b) => a.label.localeCompare(b.label));

    const HUB = `<nav id="pp-seo-links" aria-label="Browse dentists" style="max-width:1080px;margin:0 auto;padding:28px 20px 40px;border-top:1px solid #E2E8F0;font-size:13px;line-height:2;">
  <h2 style="font-size:15px;color:#0A1551;margin:0 0 8px;font-weight:700;">Browse dentists by city</h2>
  <div>${linkList(cityLinks)}</div>
  <h2 style="font-size:15px;color:#0A1551;margin:18px 0 8px;font-weight:700;">Browse by specialty</h2>
  <div>${linkList(specLinks)}</div>
  <h2 style="font-size:15px;color:#0A1551;margin:18px 0 8px;font-weight:700;">Treatments</h2>
  <div>${linkList(treatmentLinks)}</div>
  <h2 style="font-size:15px;color:#0A1551;margin:18px 0 8px;font-weight:700;">About</h2>
  <div>${linkList(sitePageLinks)}</div>
  <h2 style="font-size:15px;color:#0A1551;margin:18px 0 8px;font-weight:700;">All verified dentists</h2>
  <div>${linkList(docLinks)}</div>
</nav>`;

    // Idempotent: drop any hub from a previous run (plus surrounding whitespace)
    // before injecting a fresh one, so re-running never stacks duplicates.
    idx = idx.replace(/\s*<nav id="pp-seo-links"[\s\S]*?<\/nav>/, '');

    // Inject at the very end of the #pp-hero overlay, immediately before the
    // hero-fade <script> that inject-seo.js appends right after it. Anchoring on
    // that script (rather than an exact whitespace-sensitive string) keeps this
    // working whether or not a previous hub was just stripped out.
    const anchor = idx.match(/<\/div>\s*<script>\(function\(\)\{\s*\n?\s*var root=document\.getElementById\('root'\)/);
    if (anchor) {
      idx = idx.replace(anchor[0], `${HUB}\n${anchor[0]}`);
      fs.writeFileSync(INDEX, idx, 'utf8');
      console.log(`[gen-seo] injected homepage link hub (${cityLinks.length} cities, ${specLinks.length} specialties, ${docLinks.length} doctors)`);
    } else {
      console.warn('[gen-seo] hero markup not found in index.html — link hub NOT injected. ' +
        'Generated pages will stay orphaned; check inject-seo.js ran first.');
    }
  } catch (e) {
    console.warn('[gen-seo] could not inject homepage link hub:', e.message);
  }

  console.log(`[gen-seo] generated ${docs.length} doctor + ${Object.keys(byCity).length} city + ${Object.keys(bySpec).length} specialist pages; sitemap has ${all.length} URLs`);
})();
