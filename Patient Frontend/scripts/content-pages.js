/**
 * Static content pages: About, Contact, Terms, Privacy, and one page per
 * treatment.
 *
 * These are the pages a directory can realistically rank for. "dentist near me"
 * is owned by the Google Maps pack and a directory cannot enter it, but
 * "root canal cost islamabad" or "how long do braces take" are ordinary web
 * results that clinics rarely write for.
 *
 * Terms and Privacy are ported verbatim from Marketing Site/src/pages/Legal.jsx,
 * where they already existed but sat behind hash URLs (#/terms) that Google
 * cannot index as separate pages. Only the location changed, not the wording.
 *
 * Consumed by gen-seo-pages.js so these land in the same sitemap as the doctor
 * pages and inherit the same head/footer chrome.
 */

const SUPPORT_EMAIL = 'support@mydentistpk.com';
const SUPPORT_PHONE = '+92 336 5257815';
const SUPPORT_WHATSAPP = '923365257815'; // wa.me format (intl, no +)
const LEGAL_UPDATED = 'June 16, 2026';

// Official profiles on other sites, for schema.org `sameAs`. This is how search
// engines tie those accounts to this organisation as one entity, so only list
// profiles we actually control — a wrong URL here asserts a link that isn't ours.
// Defined once and shared by every Organization node (homepage, About, Contact)
// so the three can't drift apart.
// The Maps entry is the resolved canonical form of the maps.app.goo.gl shortlink.
// Shortlinks are a redirect Google could retire, and the long /maps/place/ URL it
// expands to carries session and map-viewport params that change per visit; the
// ?cid= form is the stable identifier for the business itself.
// TikTok is the param-free profile URL: the shared link carries `_r`/`_t` share
// tracking that is per-share and not part of the profile's identity. TikTok's own
// oEmbed reports this form as the canonical author_url.
const SAME_AS = [
  'https://www.instagram.com/mydentist840',
  'https://www.tiktok.com/@mydentist840',
  'https://www.google.com/maps?cid=11766849356386640534',
];

// Treatments to generate a page for. `specialties` maps the page to the
// specialisations in the directory, so each one can link to dentists who
// actually offer it — a page that lists nobody is worse than no page.
//
// NOTE: no prices. The directory holds a single flat consultation fee and no
// per-treatment pricing, so any range here would be invented. Invented prices
// are exactly the kind of thing a patient would hold the clinic to.
const TREATMENTS = [
  {
    slug: 'braces-orthodontics',
    icon: '🦷',
    name: 'Braces & Orthodontics',
    short: 'braces and orthodontic treatment',
    specialties: ['Orthodontist'],
    summary:
      'Braces straighten crooked teeth and correct bite problems. Treatment usually runs 18–24 months, with an adjustment visit every 4–8 weeks.',
    sections: [
      ['What orthodontic treatment involves',
        'An orthodontist examines your bite, takes X-rays and impressions, and fits either fixed braces or clear aligners. Fixed metal braces remain the most common option in Pakistan and handle the widest range of cases. Ceramic braces are less visible; clear aligners are removable but are not suitable for every case.'],
      ['How long it takes',
        'Most courses run 18 to 24 months. Mild crowding may finish sooner; significant bite correction can take longer. After the braces come off you will wear a retainer — often at night indefinitely — because teeth drift back without one.'],
      ['What to expect at the first visit',
        'The first appointment is an assessment, not a fitting. The orthodontist checks whether you need extractions, explains the options, and gives a treatment length and cost estimate for your specific case.'],
    ],
    faqs: [
      ['Do braces hurt?', 'Fitting itself does not hurt. Teeth ache for a few days after fitting and after each adjustment, which ordinary painkillers handle.'],
      ['Am I too old for braces?', 'No. Teeth move at any age. Adult treatment sometimes takes a little longer, but the result is the same.'],
      ['Braces or clear aligners?', 'Aligners suit mild to moderate crowding and are removable. Complex bite problems are usually treated more predictably with fixed braces. An orthodontist will tell you which applies to you.'],
    ],
  },
  {
    slug: 'dental-implants',
    icon: '⚙️',
    name: 'Dental Implants',
    short: 'dental implants',
    specialties: ['Implant Specialist', 'Prosthodontist'],
    summary:
      'An implant replaces a missing tooth with a titanium post placed in the jaw, topped with a crown. It is fixed in place and does not rely on the neighbouring teeth.',
    sections: [
      ['How an implant works',
        'A small titanium post is placed into the jawbone where the tooth root used to be. Over the following months the bone grows around it — a process called osseointegration — which anchors the implant. A crown is then attached on top.'],
      ['How long it takes',
        'Most cases take three to six months from placement to final crown, because the bone needs time to integrate. Some cases allow a temporary crown the same day. If there is not enough bone, a graft is done first and adds several months.'],
      ['Implant, bridge or denture',
        'An implant does not involve cutting down the healthy teeth on either side, which a conventional bridge does. It is the more expensive option up front and takes longer, but it replaces a single tooth without affecting its neighbours.'],
    ],
    faqs: [
      ['Is the procedure painful?', 'Placement is done under local anaesthetic and most patients report less discomfort than an extraction. Soreness for a few days afterwards is normal.'],
      ['How long do implants last?', 'With good cleaning and regular check-ups an implant can last decades. Gum disease and smoking are the main causes of failure.'],
      ['Can anyone have an implant?', 'You need enough healthy bone and controlled gum health. Uncontrolled diabetes and heavy smoking reduce success rates. Your dentist will assess this with an X-ray.'],
    ],
  },
  {
    slug: 'root-canal',
    icon: '🩺',
    name: 'Root Canal Treatment',
    short: 'root canal treatment (RCT)',
    specialties: ['Endodontist'],
    summary:
      'A root canal removes infected pulp from inside a tooth, cleans the canals and seals them. It saves a tooth that would otherwise need extraction.',
    sections: [
      ['When you need one',
        'A root canal is needed when decay or injury reaches the pulp inside the tooth. Common signs are prolonged sensitivity to heat, pain when biting, a persistent ache, or swelling. Sometimes there is no pain at all and the problem is found on an X-ray.'],
      ['What happens during treatment',
        'Under local anaesthetic the dentist opens the tooth, removes the infected pulp, cleans and shapes the canals, then fills and seals them. Simple cases finish in one visit; infected or multi-rooted teeth often take two.'],
      ['Afterwards',
        'A treated tooth becomes brittle and usually needs a crown to protect it from fracture, particularly a back tooth. Skipping the crown is the most common reason a root-canal-treated tooth fails later.'],
    ],
    faqs: [
      ['Is a root canal painful?', 'The procedure is done under anaesthetic and is not more painful than a filling. The pain people associate with root canals is the infection beforehand, which the treatment relieves.'],
      ['Is extraction cheaper?', 'Extraction costs less on the day, but replacing the tooth with an implant or bridge costs considerably more than the root canal would have.'],
      ['How long does the tooth last?', 'A properly treated and crowned tooth can last a lifetime.'],
    ],
  },
  {
    slug: 'teeth-whitening',
    icon: '✨',
    name: 'Teeth Whitening',
    short: 'teeth whitening',
    specialties: ['Cosmetic Dentist'],
    summary:
      'Professional whitening lightens natural teeth using a peroxide gel, either in the clinic or with custom trays you use at home.',
    sections: [
      ['In-clinic and at-home whitening',
        'In-clinic whitening uses a stronger gel under supervision and takes about an hour. At-home whitening uses custom-made trays and a milder gel over one to two weeks. Both reach a similar end result; the clinic option is faster.'],
      ['What whitening will not change',
        'Whitening works on natural tooth enamel. It does not lighten crowns, veneers or fillings, so existing dental work may need replacing afterwards to match. Grey discolouration from tetracycline or a dead nerve responds poorly.'],
      ['How long it lasts',
        'Typically one to two years, depending on tea, coffee, and smoking. Occasional top-ups with your trays extend it.'],
    ],
    faqs: [
      ['Does whitening damage enamel?', 'Professionally supervised whitening at correct concentrations does not damage enamel. Unsupervised high-strength products and home remedies can.'],
      ['Will my teeth be sensitive?', 'Temporary sensitivity to cold is common and settles within a few days. Tell your dentist if you already have sensitive teeth.'],
      ['Are whitening toothpastes enough?', 'They remove surface stains but do not change the underlying shade of the tooth.'],
    ],
  },
  {
    slug: 'cosmetic-dentistry',
    icon: '💎',
    name: 'Cosmetic Dentistry',
    short: 'cosmetic dental treatment',
    specialties: ['Cosmetic Dentist', 'Prosthodontist'],
    summary:
      'Cosmetic dentistry covers veneers, bonding, crowns and smile design — treatments that change how teeth look rather than treating disease.',
    sections: [
      ['Veneers and bonding',
        'Veneers are thin shells bonded to the front of the teeth to change shape, colour or alignment. Composite bonding builds up the tooth directly with filling material in a single visit; it costs less and is reversible, but does not last as long as porcelain.'],
      ['Smile design',
        'A smile design plans the whole visible set together rather than one tooth at a time, considering face shape, lip line and gum position. Many clinics will show a digital preview or a wax mock-up before any tooth is touched.'],
      ['What to ask before starting',
        'Ask whether the treatment removes tooth structure, whether it is reversible, and how long it should last. Porcelain veneers require permanent enamel reduction — that is a decision worth understanding fully first.'],
    ],
    faqs: [
      ['How long do veneers last?', 'Porcelain veneers commonly last 10–15 years with good care. Composite bonding typically needs replacing sooner.'],
      ['Will they look artificial?', 'Shade and shape are chosen with you beforehand. Ask to see the clinic’s own before-and-after cases rather than stock photographs.'],
      ['Do I need healthy teeth first?', 'Yes. Decay and gum disease are treated before any cosmetic work begins.'],
    ],
  },
  {
    slug: 'scaling-cleaning',
    icon: '🪥',
    name: 'Scaling & Teeth Cleaning',
    short: 'scaling and professional cleaning',
    specialties: ['General'],
    summary:
      'Scaling removes hardened plaque (tartar) that brushing cannot shift. It is the standard treatment for bleeding gums and the main way to prevent gum disease.',
    sections: [
      ['Why brushing is not enough',
        'Plaque hardens into tartar within days and bonds to the tooth. Once hardened it can only be removed with instruments. Tartar sitting at the gum line is what causes the inflammation behind bleeding gums and bad breath.'],
      ['What the appointment involves',
        'An ultrasonic scaler breaks up deposits above and below the gum line, followed by polishing. It normally takes 30 to 45 minutes. Where gum disease is established, deeper cleaning under local anaesthetic may be done over more than one visit.'],
      ['How often',
        'Every six months suits most people. Smokers, people with diabetes, and anyone with a history of gum disease are usually seen more often.'],
    ],
    faqs: [
      ['Does scaling loosen teeth?', 'No. Tartar can mask existing bone loss, so teeth may feel different once it is removed, but scaling does not cause looseness — untreated gum disease does.'],
      ['Does it hurt?', 'Routine scaling is uncomfortable rather than painful. Deep cleaning of inflamed gums is done under local anaesthetic.'],
      ['Will it whiten my teeth?', 'It removes surface staining from tea, coffee and smoking, which often looks brighter, but it does not change the natural shade.'],
    ],
  },
];

// ── Page builders ───────────────────────────────────────────────────────────
// Each returns { path, url, html } so gen-seo-pages.js can write it with the
// same helper it uses for doctor pages.

function treatmentPage(t, docs, { SITE, esc, slug, head, foot, doctorCard, fullAddress, specPlural }) {
  const canonical = `${SITE}/treatments/${t.slug}`;
  const title = `${t.name} in Pakistan — What to Expect | My Dentist`;
  const desc = `${t.summary} Find verified PMDC dentists offering ${t.short} and book online.`;

  // Dentists whose specialisation covers this treatment.
  const matched = docs.filter((d) => t.specialties.includes((d.specialization || '').trim()));
  const cities = [...new Set(matched.map((d) => (d.city || '').trim()).filter(Boolean))].sort();

  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'MedicalWebPage',
      name: title,
      url: canonical,
      description: desc,
      about: { '@type': 'MedicalProcedure', name: t.name },
      ...(cities.length
        ? { audience: { '@type': 'Patient', geographicArea: cities.map((c) => ({ '@type': 'City', name: c })) } }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: t.faqs.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Treatments', item: `${SITE}/treatments` },
        { '@type': 'ListItem', position: 3, name: t.name, item: canonical },
      ],
    },
  ];

  const body = `<div class="wrap">
<nav class="bc"><a href="${SITE}/">Home</a> › <a href="${SITE}/treatments">Treatments</a> › ${esc(t.name)}</nav>

<!-- Hero: the icon anchors the page and the summary answers "what is this"
     before the reader has to commit to a section. -->
<div class="thero">
  <span class="thero-ico">${t.icon}</span>
  <div class="thero-bd">
    <h1>${esc(t.name)}</h1>
    <p class="thero-sum">${esc(t.summary)}</p>
  </div>
</div>

<div class="cols">
  <div class="col-main">
    ${t.sections.map(([h, p], i) => `<section class="tsec">
      <h2 class="tsec-h"><span class="tsec-n">${i + 1}</span>${esc(h)}</h2>
      <p class="about">${esc(p)}</p>
    </section>`).join('')}

    <section class="tsec">
      <h2 class="tsec-h"><span class="tsec-n">?</span>Common questions</h2>
      ${t.faqs.map(([q, a]) => `<details class="faq"><summary class="faq-q">${esc(q)}</summary><p class="faq-a">${esc(a)}</p></details>`).join('')}
    </section>

    <p class="disclaimer">This page is general information, not dental advice. Treatment suitability, length and cost depend on your own examination — ask the dentist at your consultation.</p>
  </div>

  <aside class="col-side">
    ${matched.length ? `<div class="card sidelinks">
      <h2>${matched.length} dentist${matched.length === 1 ? '' : 's'} offer this</h2>
      <p class="sub">${cities.length ? `In ${esc(cities.join(' and '))}.` : ''} Compare and book online.</p>
      <a class="cta full" rel="nofollow" href="${SITE}">Find a dentist →</a>
    </div>` : `<div class="card sidelinks">
      <h2>Find a dentist</h2>
      <a class="cta full" rel="nofollow" href="${SITE}">Browse dentists →</a>
    </div>`}
    <div class="card sidelinks">
      <h2>Other treatments</h2>
      ${TREATMENTS.filter((o) => o.slug !== t.slug).slice(0, 5).map((o) =>
        `<p class="sub"><a href="${SITE}/treatments/${o.slug}">${esc(o.name)}</a></p>`).join('')}
      <p class="sub"><a href="${SITE}/treatments">All treatments →</a></p>
    </div>
  </aside>
</div>

${matched.length ? `
<h2 class="sech">Dentists offering ${esc(t.short)}<span class="sccount">${matched.length}</span></h2>
<div class="grid">${matched.slice(0, 6).map((d) => doctorCard(d, esc(fullAddress(d.address, d.city)))).join('')}</div>
${t.specialties.map((s) => `<p class="sub linkrow"><a href="${SITE}/specialists/${slug(s)}">See all ${esc(specPlural(s).toLowerCase())} →</a></p>`).join('')}
` : ''}
</div>`;

  // ViewContent for a treatment guide — these pages target cost/procedure
  // queries, so a view is a genuine signal of intent.
  const pixel = { name: t.name, category: 'Treatment', id: t.slug };
  return { path: `treatments/${t.slug}.html`, url: canonical, html: head({ title, description: desc, canonical, jsonld, pixel }) + body + foot };
}

function treatmentsIndex(docs, { SITE, esc, head, foot }) {
  const canonical = `${SITE}/treatments`;
  const title = 'Dental Treatments in Pakistan — Costs & What to Expect | My Dentist';
  const desc = 'Guides to common dental treatments in Pakistan: braces, implants, root canal, whitening, cosmetic dentistry and scaling. What each involves, how long it takes, and where to find a verified dentist.';
  const jsonld = [{
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title, url: canonical, description: desc,
  }, {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Treatments', item: canonical },
    ],
  }];

  // Card content is ordered by what helps someone choose: what it is, then how
  // many dentists here actually do it. A row of identical text blocks gave the
  // eye nothing to land on.
  const count = (t) => docs.filter((d) => t.specialties.includes((d.specialization || '').trim())).length;

  const body = `<div class="wrap">
<nav class="bc"><a href="${SITE}/">Home</a> › Treatments</nav>
<h1>Dental treatments</h1>
<p class="sub">What each treatment involves, how long it takes, and what to ask before you start.</p>
<div class="tgrid">
${TREATMENTS.map((t) => {
  const n = count(t);
  return `<a class="tcard" href="${SITE}/treatments/${t.slug}">
  <span class="tico">${t.icon}</span>
  <span class="tbody">
    <span class="tname">${esc(t.name)}</span>
    <span class="tsum">${esc(t.summary)}</span>
  </span>
  <span class="tfoot">
    ${n ? `<span class="tcount">${n} dentist${n === 1 ? '' : 's'}</span>` : ''}
    <span class="tgo">Read guide →</span>
  </span>
</a>`;
}).join('')}
</div>
<a class="cta" rel="nofollow" href="${SITE}">Find a dentist →</a>
</div>`;

  return { path: 'treatments/index.html', url: canonical, html: head({ title, description: desc, canonical, jsonld }) + body + foot };
}

function aboutPage(docs, { SITE, esc, head, foot }) {
  const canonical = `${SITE}/about`;
  const title = 'About My Dentist — Verified Dentists in Pakistan';
  const desc = 'My Dentist is a platform for finding and booking PMDC-verified dentists in Pakistan. How verification works, how booking works, and how we make money.';
  const cities = [...new Set(docs.map((d) => (d.city || '').trim()).filter(Boolean))].sort();

  const jsonld = [{
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: title, url: canonical, description: desc,
    mainEntity: {
      '@type': 'Organization',
      name: 'My Dentist',
      url: `${SITE}/`,
      email: SUPPORT_EMAIL,
      telephone: SUPPORT_PHONE,
      areaServed: 'Pakistan',
      sameAs: SAME_AS,
    },
  }];

  const verified = docs.filter((d) => d.pmdcVerified).length;
  const specialties = [...new Set(docs.map((d) => (d.specialization || '').trim()).filter(Boolean))];

  const body = `<div class="wrap">
<nav class="bc"><a href="${SITE}/">Home</a> › About</nav>
<h1>About My Dentist</h1>
<p class="sub lead">Finding a dentist in Pakistan usually means phoning clinics one by one to ask who does what, when they're open, and what they charge. My Dentist puts that in one place.</p>

<div class="stats">
  <span class="stat"><b>${docs.length}</b>dentists listed</span>
  ${verified ? `<span class="stat"><b>${verified}</b>PMDC verified</span>` : ''}
  ${specialties.length ? `<span class="stat"><b>${specialties.length}</b>specialties</span>` : ''}
  ${cities.length ? `<span class="stat"><b>${cities.length}</b>cit${cities.length === 1 ? 'y' : 'ies'}</span>` : ''}
</div>

<div class="cols">
  <div class="col-main">
    <div class="card">
      <h2>What we do</h2>
      <p class="about">We list dentists with the details that actually decide a booking — specialty, years of practice, clinic, timings and consultation fee — so you can compare them side by side and book online.</p>
    </div>

    <div class="card">
      <h2>What “PMDC verified” means</h2>
      <p class="about">Dentists submit their Pakistan Medical &amp; Dental Council registration for checking before their profile goes live. Verification confirms the dentist is registered to practise.</p>
      <p class="about">It is <strong>not</strong> an assessment of clinical skill and not an endorsement. Judging the care itself is between you and the dentist.</p>
    </div>

    <div class="card">
      <h2>How booking works</h2>
      <p class="about">You pick a dentist, choose a time, and the clinic confirms. Booking is free for patients. The appointment is an agreement between you and the clinic — fees, cancellations and refunds are set by the clinic, not by us.</p>
    </div>

    <div class="card">
      <h2>How we make money</h2>
      <p class="about">Clinics pay a commission on bills settled through the platform, and some pay for a promoted listing. Promoted placement is paid position, not a quality ranking — we label it rather than leaving you to guess.</p>
    </div>
  </div>

  <aside class="col-side">
    <div class="card sidelinks">
      <h2>Where we operate</h2>
      <p class="sub">${cities.length ? `${esc(cities.join(' and '))}, with more added as clinics join.` : 'Adding clinics city by city across Pakistan.'}</p>
      ${cities.map((c) => `<p class="sub"><a href="${SITE}/dentists/${c.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">Dentists in ${esc(c)} →</a></p>`).join('')}
    </div>
    <div class="card sidelinks">
      <h2>Get in touch</h2>
      <p class="sub"><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p class="sub"><a href="https://wa.me/${SUPPORT_WHATSAPP}">WhatsApp ${esc(SUPPORT_PHONE)}</a></p>
      <p class="sub"><a href="${SITE}/contact">Contact page →</a></p>
    </div>
  </aside>
</div>

<a class="cta" rel="nofollow" href="${SITE}">Find a dentist →</a>
</div>`;

  return { path: 'about.html', url: canonical, html: head({ title, description: desc, canonical, jsonld }) + body + foot };
}

function contactPage({ SITE, esc, head, foot }) {
  const canonical = `${SITE}/contact`;
  const title = 'Contact My Dentist — Support for Patients & Clinics';
  const desc = `Get in touch with My Dentist. Email ${SUPPORT_EMAIL} or WhatsApp ${SUPPORT_PHONE} for help with bookings, accounts, or listing your clinic.`;

  const jsonld = [{
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: title, url: canonical, description: desc,
    mainEntity: {
      '@type': 'Organization',
      name: 'My Dentist',
      url: `${SITE}/`,
      contactPoint: [{
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: SUPPORT_EMAIL,
        telephone: SUPPORT_PHONE,
        areaServed: 'PK',
        availableLanguage: ['English', 'Urdu'],
      }],
      sameAs: SAME_AS,
    },
  }];

  const body = `<div class="wrap">
<nav class="bc"><a href="${SITE}/">Home</a> › Contact</nav>
<h1>Contact us</h1>
<p class="sub">Questions about a booking, your account, or listing a clinic.</p>

<div class="card">
  <h2>Patients</h2>
  <dl class="facts">
    <div><span class="ic">✉️</span><dt>Email</dt><dd><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></dd></div>
    <div><span class="ic">💬</span><dt>WhatsApp</dt><dd><a href="https://wa.me/${SUPPORT_WHATSAPP}">${esc(SUPPORT_PHONE)}</a></dd></div>
  </dl>
  <p class="about">For anything about a specific appointment, contact the clinic directly — they hold the schedule. We can help with account and platform problems.</p>
</div>

<div class="card">
  <h2>Dentists &amp; clinics</h2>
  <p class="about">To list your clinic, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> with your PMDC registration number and clinic details. Profiles go live once registration is verified.</p>
</div>

<a class="cta" rel="nofollow" href="${SITE}">Find a dentist →</a>
</div>`;

  return { path: 'contact.html', url: canonical, html: head({ title, description: desc, canonical, jsonld }) + body + foot };
}

// Terms and Privacy — wording ported verbatim from the Marketing Site.
const LEGAL = {
  terms: {
    title: 'Terms & Conditions',
    metaTitle: 'Terms & Conditions | My Dentist',
    desc: 'The terms governing use of the My Dentist platform: accounts, bookings, payments, rewards, acceptable use and liability.',
    intro: 'Welcome to My Dentist. By accessing or using our mobile app, website, or services (the "Platform"), you agree to these Terms &amp; Conditions. Please read them carefully.',
    sections: [
      ['1. Acceptance of Terms', 'By creating an account or using My Dentist, you confirm that you are at least 18 years old (or using the Platform under the supervision of a parent or guardian) and agree to be bound by these terms.'],
      ['2. The Service', 'My Dentist is a platform that connects patients with independent dental clinics and practitioners. We facilitate discovery, appointment booking, communication, billing, and rewards. My Dentist is <strong>not</strong> a healthcare provider and does not provide medical or dental advice. All clinical care is provided by independent, third-party dentists.'],
      ['3. Accounts', 'You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. Dentists must provide accurate professional credentials, including valid PMDC registration where applicable.'],
      ['4. Bookings &amp; Payments', 'Appointments booked through My Dentist are agreements between you and the clinic. Payment terms, fees, cancellations, and refunds are set by the individual clinic. My Dentist may process payments on a clinic’s behalf but is not liable for the services rendered.'],
      ['5. Rewards Program', 'Loyalty points have no cash value, are non-transferable, and may be modified or discontinued at any time. The "Popular" status granted to dentists (earned through points or via paid promotion) does not constitute an endorsement of clinical quality by My Dentist.'],
      ['6. Acceptable Use', 'You agree not to misuse the Platform, post false reviews, impersonate others, or attempt to disrupt the service. We may suspend accounts that violate these terms.'],
      ['7. Limitation of Liability', 'My Dentist is provided "as is." To the fullest extent permitted by law, My Dentist is not liable for any clinical outcomes, disputes with clinics, or indirect damages arising from use of the Platform.'],
      ['8. Changes', 'We may update these terms from time to time. Continued use of the Platform after changes constitutes acceptance of the revised terms.'],
      ['9. Contact', `Questions about these terms? Email us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.`],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    metaTitle: 'Privacy Policy | My Dentist',
    desc: 'What information My Dentist collects, how it is used and shared, how it is secured, and your rights over your data.',
    intro: 'My Dentist ("we", "us") respects your privacy. This policy explains what information we collect, how we use it, and your choices.',
    sections: [
      ['1. Information We Collect', 'We collect information you provide directly — name, email, phone number, date of birth, location, and profile photo. For dentists, this includes professional details and verification documents. We also collect usage data such as appointments, messages, bills, and reward activity.'],
      ['2. How We Use Your Information', 'We use your data to operate the Platform: to enable bookings, facilitate communication between patients and clinics, process payments, run the rewards program, verify dentists, and improve our services.'],
      ['3. Sharing', 'When you book or message a clinic, relevant information (such as your name and appointment details) is shared with that clinic. We do not sell your personal data. We may share data with service providers (e.g. cloud hosting, image storage, payment processors) strictly to operate the Platform.'],
      ['4. Image &amp; Document Storage', 'Profile photos and clinic gallery images are stored with a third-party media provider. Verification documents submitted by dentists are used only for verification purposes.'],
      ['5. Data Security', 'We use industry-standard measures including encrypted connections and hashed passwords. No system is perfectly secure, so we cannot guarantee absolute security.'],
      ['6. Your Rights', 'You may access, update, or delete your account information at any time from within the app, or by contacting us. Deleting your account removes your profile and associated personal data, subject to legal retention requirements.'],
      ['7. Children', 'The Platform is not directed at children under 13. We do not knowingly collect data from children without parental consent.'],
      ['8. Contact', `For privacy questions or data requests, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.`],
    ],
  },
};

function legalPage(key, { SITE, esc, head, foot }) {
  const L = LEGAL[key];
  const canonical = `${SITE}/${key}`;
  const jsonld = [{
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: L.metaTitle, url: canonical, description: L.desc,
    dateModified: '2026-06-16',
  }];

  const body = `<div class="wrap">
<nav class="bc"><a href="${SITE}/">Home</a> › ${esc(L.title)}</nav>
<h1>${esc(L.title)}</h1>
<p class="sub">Last updated ${esc(LEGAL_UPDATED)}</p>
<div class="card legal">
  <p class="about">${L.intro}</p>
  ${L.sections.map(([h, p]) => `<h2>${h}</h2><p class="about">${p}</p>`).join('')}
</div>
</div>`;

  return { path: `${key}.html`, url: canonical, html: head({ title: L.metaTitle, description: L.desc, canonical, jsonld }) + body + foot };
}

// Extra CSS for the content pages, appended to the shared stylesheet.
const CONTENT_CSS = `
/* Treatment hero — icon plus the one-line answer to "what is this". */
.thero{display:flex;gap:18px;align-items:flex-start;margin-top:6px}
.thero-ico{flex:0 0 58px;width:58px;height:58px;border-radius:16px;background:#EFF4FF;display:flex;align-items:center;justify-content:center;font-size:27px;line-height:1;margin-top:6px}
.thero-bd{min-width:0;flex:1}
.thero h1{margin:0}
.thero-sum{margin:8px 0 0;color:#475569;font-size:16.5px;line-height:1.6;max-width:62ch}
/* Numbered sections read as a sequence — the reader is being walked through a
   treatment in order, which a stack of identical cards did not convey. */
.tsec{background:#fff;border:1px solid #EEF2F7;border-radius:18px;padding:22px;box-shadow:0 1px 2px rgba(2,6,23,.04)}
.tsec-h{display:flex;align-items:center;gap:11px;margin:0 0 12px;font-size:17px;font-weight:800;color:var(--ink);letter-spacing:-.2px}
.tsec-n{flex:0 0 26px;width:26px;height:26px;border-radius:8px;background:#EFF4FF;color:var(--blue);font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center}
/* FAQ as <details> — the answers are secondary, and collapsing them keeps the
   question list scannable. Open by default would just be the old wall of text. */
.faq{border-top:1px solid #F1F5F9;padding:2px 0}
.faq:first-of-type{border-top:0}
.faq-q{list-style:none;cursor:pointer;padding:13px 28px 13px 0;position:relative;font-weight:700;color:var(--ink);font-size:15px}
.faq-q::-webkit-details-marker{display:none}
.faq-q::after{content:'+';position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:19px;font-weight:600;color:#94A3B8;line-height:1}
.faq[open] .faq-q::after{content:'−'}
.faq[open] .faq-q{color:var(--blue)}
.faq-a{margin:0 0 14px;color:#475569;font-size:14.5px;max-width:68ch}
/* Equal-height treatment cards: icon, body that absorbs the slack, then a
   footer pinned to the bottom so every card lines up regardless of summary
   length. */
.tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;margin-top:22px}
.tcard{display:flex;flex-direction:column;background:#fff;border:1px solid #EEF2F7;border-radius:18px;padding:20px;text-decoration:none;box-shadow:0 1px 2px rgba(2,6,23,.04);transition:border-color .15s,box-shadow .15s,transform .15s}
.tcard:hover{border-color:#BFD7FF;box-shadow:0 10px 24px rgba(2,6,23,.09);transform:translateY(-2px)}
.tcard:focus-visible{outline:2px solid var(--blue);outline-offset:3px}
.tico{width:44px;height:44px;border-radius:12px;background:#EFF4FF;display:flex;align-items:center;justify-content:center;font-size:21px;line-height:1;margin-bottom:14px}
.tbody{display:block;flex:1}
.tname{display:block;font-weight:750;color:var(--ink);font-size:17px;letter-spacing:-.2px}
.tsum{display:block;color:var(--muted);font-size:13.5px;line-height:1.6;margin-top:6px}
.tfoot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid #F1F5F9}
.tcount{font-size:12px;font-weight:700;color:#475569;background:#F1F5F9;padding:4px 10px;border-radius:999px}
.tgo{font-size:13px;font-weight:700;color:var(--blue);margin-left:auto}
.legal h2{font-size:15.5px;margin:22px 0 6px}
.legal h2:first-of-type{margin-top:18px}
.legal .about{margin:0}
.disclaimer{margin-top:22px;color:#94A3B8;font-size:13px;max-width:70ch}
.lead{font-size:16.5px;line-height:1.65;max-width:62ch}
/* Consecutive paragraphs in a card need separating — they ran together. */
.about + .about{margin-top:10px}
.about strong{color:var(--ink)}
`;

module.exports = { TREATMENTS, treatmentPage, treatmentsIndex, aboutPage, contactPage, legalPage, CONTENT_CSS, SAME_AS };
