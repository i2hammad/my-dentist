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
function head({ title, description, canonical, jsonld }) {
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
<style>
:root{--blue:#0052FF;--ink:#0A1551;--muted:#64748B;--line:#E2E8F0}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;background:#F8FAFC;line-height:1.6}
.wrap{max-width:900px;margin:0 auto;padding:24px 20px 64px}
header{display:flex;align-items:center;gap:10px;padding:16px 20px;background:#fff;border-bottom:1px solid var(--line)}
header .brand{font-weight:800;font-size:20px;color:var(--ink)}header .brand span{color:var(--blue)}
a.cta{display:inline-flex;align-items:center;gap:8px;background:var(--blue);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;margin-top:8px}
h1{font-size:28px;color:var(--ink);margin:18px 0 4px}h2{font-size:20px;color:var(--ink);margin:28px 0 10px}
.sub{color:var(--muted);font-size:15px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;margin-top:16px}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.chip{background:#EFF4FF;color:var(--blue);font-size:13px;font-weight:600;padding:5px 12px;border-radius:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:16px}
.doclink{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;text-decoration:none;color:inherit}
.doclink:hover{border-color:var(--blue)}
.doclink .n{font-weight:700;color:var(--ink)}.doclink .s{color:var(--muted);font-size:13px}
.stars{color:#F59E0B;font-weight:700}
nav.bc{font-size:13px;color:var(--muted);margin-bottom:8px}nav.bc a{color:var(--blue);text-decoration:none}
footer{margin-top:40px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
</style></head><body>
<header><span class="brand">My <span>Dentist</span></span></header>`;
}
const foot = `<footer>My Dentist — Pakistan's platform to find & book verified PMDC dentists. <a href="${APP}">Open the app</a></footer></body></html>`;

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

  const chips = [
    spec && `<span class="chip">${esc(spec)}</span>`,
    d.experience && `<span class="chip">${d.experience}+ yrs experience</span>`,
    d.pmdcVerified && `<span class="chip">PMDC Verified</span>`,
    d.clinicTier && `<span class="chip">${esc(d.clinicTier)} clinic</span>`,
    (d.languages || []).length && `<span class="chip">${esc((d.languages || []).join(', '))}</span>`,
  ].filter(Boolean).join(' ');

  const body = `<div class="wrap">
<nav class="bc"><a href="${SITE}/">Home</a> › <a href="${SITE}/dentists/${slug(city)}">Dentists in ${esc(city)}</a> › ${esc(name)}</nav>
<h1>${esc(name)}</h1>
<p class="sub">${esc(spec)}${clinic ? ` · ${esc(clinic)}` : ''} · ${esc(city)}</p>
${ratingBlock(d.avgRating, d.totalReviews)}
<div class="meta">${chips}</div>
<a class="cta" href="${APP}/doctor/${esc(d._id || d.id)}">View full profile & Book appointment →</a>
<div class="card">
<h2>About ${esc(name)}</h2>
<p>${esc((d.about || `${name} is a ${spec}${clinic ? ` practising at ${clinic}` : ''} in ${city}${d.experience ? ` with ${d.experience}+ years of experience` : ''}. Book a verified appointment through My Dentist.`))}</p>
${d.address ? `<h2>Clinic Location</h2><p>${esc(d.address)}, ${esc(city)}</p>` : ''}
${d.clinicTiming?.days ? `<h2>Timings</h2><p>${esc(d.clinicTiming.days)}${d.clinicTiming.startTime ? ` · ${esc(d.clinicTiming.startTime)}–${esc(d.clinicTiming.endTime || '')}` : ''}</p>` : ''}
${d.consultationFee ? `<h2>Consultation</h2><p>Consultation fee: PKR ${Number(d.consultationFee).toLocaleString()}</p>` : ''}
</div>
<a class="cta" href="${APP}/doctor/${esc(d._id || d.id)}">Book ${esc(name)} on My Dentist →</a>
</div>`;

  return { path: `dentist/${s}.html`, url: canonical, html: head({ title, description: desc, canonical, jsonld }) + body + foot };
}

function cityPage(city, docs) {
  const canonical = `${SITE}/dentists/${slug(city)}`;
  const title = `Best Dentists in ${city} — Book Verified PMDC Dentists | My Dentist`;
  const desc = `Find and book the best dentists in ${city}. ${docs.length} verified PMDC dental specialist${docs.length === 1 ? '' : 's'} — compare clinics, reviews, fees & timings. Book online on My Dentist.`;
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: title, url: canonical, description: desc,
    about: { '@type': 'Thing', name: `Dentists in ${city}` },
  }, {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: docs.map((d, i) => ({
      '@type': 'ListItem', position: i + 1, name: String(d.fullName || '').trim(),
      url: `${SITE}/dentist/${slug(String(d.fullName || 'dentist').trim())}-${String(d._id || d.id).slice(-6)}`,
    })),
  }];
  const cards = docs.map((d) => {
    const s = slug(String(d.fullName || 'dentist').trim()) + '-' + String(d._id || d.id).slice(-6);
    return `<a class="doclink" href="${SITE}/dentist/${s}"><div class="n">${esc(String(d.fullName || '').trim())}</div><div class="s">${esc(d.specialization || 'Dentist')}${d.clinicName ? ' · ' + esc(d.clinicName.trim()) : ''}</div>${d.avgRating && d.totalReviews ? `<div class="s stars">★ ${Number(d.avgRating).toFixed(1)} (${d.totalReviews})</div>` : ''}</a>`;
  }).join('');
  const body = `<div class="wrap">
<nav class="bc"><a href="${SITE}/">Home</a> › Dentists in ${esc(city)}</nav>
<h1>Best Dentists in ${esc(city)}</h1>
<p class="sub">${docs.length} verified PMDC dentist${docs.length === 1 ? '' : 's'} in ${esc(city)}. Compare and book online.</p>
<div class="grid">${cards}</div>
<a class="cta" href="${APP}">Open My Dentist to book →</a>
</div>`;
  return { path: `dentists/${slug(city)}.html`, url: canonical, html: head({ title, description: desc, canonical, jsonld }) + body + foot };
}

function specPage(spec, docs) {
  const canonical = `${SITE}/specialists/${slug(spec)}`;
  const title = `${spec}s in Pakistan — Book Verified ${spec} | My Dentist`;
  const desc = `Find and book a verified ${spec} in Pakistan. ${docs.length} PMDC-verified specialist${docs.length === 1 ? '' : 's'} — compare clinics, reviews & fees on My Dentist.`;
  const jsonld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: canonical, description: desc }];
  const cards = docs.map((d) => {
    const s = slug(String(d.fullName || 'dentist').trim()) + '-' + String(d._id || d.id).slice(-6);
    return `<a class="doclink" href="${SITE}/dentist/${s}"><div class="n">${esc(String(d.fullName || '').trim())}</div><div class="s">${esc(d.city || '')}${d.clinicName ? ' · ' + esc(d.clinicName.trim()) : ''}</div></a>`;
  }).join('');
  const body = `<div class="wrap"><nav class="bc"><a href="${SITE}/">Home</a> › ${esc(spec)}</nav>
<h1>${esc(spec)}s in Pakistan</h1><p class="sub">${docs.length} verified specialist${docs.length === 1 ? '' : 's'}. Book online.</p>
<div class="grid">${cards}</div><a class="cta" href="${APP}">Open My Dentist to book →</a></div>`;
  return { path: `specialists/${slug(spec)}.html`, url: canonical, html: head({ title, description: desc, canonical, jsonld }) + body + foot };
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

  // ── sitemap.xml (homepage + all generated pages) ──
  const all = [`${SITE}/`, ...urls];
  const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    all.map((u) => `  <url><loc>${u}</loc><changefreq>weekly</changefreq></url>`).join('\n') +
    `\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sm);

  console.log(`[gen-seo] generated ${docs.length} doctor + ${Object.keys(byCity).length} city + ${Object.keys(bySpec).length} specialist pages; sitemap has ${all.length} URLs`);
})();
