// My Dentist — oladoc/Marham-style landing page.
// Live dentist search + top-rated carousel come from the public backend API.
// Informational tiles (specialties / cities) stay on the page; only actions that
// need an account (book, favorite, log in, get the app) hand off to the app.
import { useEffect, useState } from 'react';
import {
  Tooth, MagnifyingGlass, CalendarCheck, ChatCircleDots, Receipt, Gift, ShieldCheck,
  Star, Check, ArrowRight, Sparkle, MapPin, Stethoscope, CaretRight, Quotes,
  AppleLogo, GooglePlayLogo, SealCheck, List, X, Crown, Diamond,
} from '@phosphor-icons/react';
import { getDoctors, searchDoctors, imgUrl, APP_URL, APP_LOGIN, APP_SIGNUP, BRAND, doctorUrl } from '../lib/api';
import appLogo from '../assets/app-logo.png';
import heroDentalBooking from '../assets/hero-dental-booking.jpg';
import eliteClinic from '../assets/elite-clinic.jpeg';
import modernClinic from '../assets/modern-clinic.jpeg';
import standardClinic from '../assets/standard-clinic.jpeg';

const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta'];
const SPECIALTIES = [
  ['Orthodontist', 'Braces & aligners'], ['Implant Specialist', 'Dental implants'], ['Cosmetic Dentist', 'Smile makeovers'],
  ['Periodontist', 'Gum care'], ['Endodontist', 'Root canal'], ['Pediatric Dentist', 'Kids dentistry'],
  ['Oral Surgeon', 'Surgical care'], ['General Dentist', 'Checkups & cleaning'],
];
const SPEC_ICONS = { Orthodontist: Tooth, 'Implant Specialist': Stethoscope, 'Cosmetic Dentist': Sparkle };

const FEATURES = [
  [MagnifyingGlass, 'Smart Search', 'Filter by specialty, clinic tier, and city. Verified, top-rated dentists rise to the top.'],
  [CalendarCheck, 'Instant Booking', 'Pick a slot, add notes, and confirm in seconds — no phone calls, no waiting.'],
  [ChatCircleDots, 'Chat with Doctors', 'Message your dentist directly with real-time read receipts before and after your visit.'],
  [Receipt, 'Bills & Payments', 'View invoices, pay online, and download receipts. No paperwork, no surprises.'],
  [Gift, 'Earn Rewards', 'Collect loyalty points on every appointment and redeem them for discounts.'],
  [ShieldCheck, 'PMDC Verified', 'Every dentist is verified and tier-rated, so you always know who you’re trusting.'],
];

const Mark = () => <span className="mark"><img src={appLogo} alt="" /></span>;

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [city, setCity] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [topDocs, setTopDocs] = useState([]);

  // Live top/popular dentists for the carousel.
  useEffect(() => {
    getDoctors({ limit: 8 }).then(setTopDocs).catch(() => setTopDocs([]));
  }, []);

  const scrollToResults = () => {
    const el = document.getElementById('results');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Live search against the backend — shows results ON this page (no app redirect).
  // Free-text (name/clinic/specialization) uses /api/doctors/search?q=; the
  // specialty pills pass an exact specialization filter via /api/doctors.
  const runSearch = async (e, opts = {}) => {
    e?.preventDefault();
    const term = (opts.specialization ?? query ?? '').trim();
    const cty = opts.city ?? city;
    setSearching(true);
    try {
      let docs;
      if (opts.specialization) {
        // Specialty pill → exact specialization filter.
        docs = await getDoctors({ limit: 12, specialization: opts.specialization });
      } else if (term) {
        // Typed query → fuzzy search across name, clinic, specialization.
        docs = await searchDoctors(term, { limit: 12 });
      } else {
        docs = await getDoctors({ limit: 12 });
      }
      const filtered = cty ? docs.filter((d) => (d.city || '').toLowerCase().includes(cty.toLowerCase())) : docs;
      setResults(filtered);
      setTimeout(scrollToResults, 0);
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  return (
    <>
      {/* NAV */}
      <nav className="nav">
        <div className="wrap">
          <a className="logo" href="#/" onClick={() => setMenuOpen(false)}><Mark /> {BRAND}</a>
          <div className="nav-links">
            <a href="#specialties">Specialties</a>
            <a href="#cities">Cities</a>
            <a href="#top">Top Dentists</a>
            <a href="#how">How it works</a>
            <a href="#doctors">For Dentists</a>
          </div>
          <div className="nav-cta">
            <a className="btn btn-ghost" href={APP_LOGIN}>Log in</a>
            <a className="btn btn-ghost" href={APP_SIGNUP}>Sign up</a>
            <a className="btn btn-primary" href={APP_URL}>Get the App</a>
          </div>
          <button className="nav-toggle" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X size={24} weight="bold" /> : <List size={24} weight="bold" />}
          </button>
        </div>
        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="nav-mobile">
            <a href="#specialties" onClick={() => setMenuOpen(false)}>Specialties</a>
            <a href="#cities" onClick={() => setMenuOpen(false)}>Cities</a>
            <a href="#top" onClick={() => setMenuOpen(false)}>Top Dentists</a>
            <a href="#how" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#doctors" onClick={() => setMenuOpen(false)}>For Dentists</a>
            <div className="nav-mobile-cta">
              <a className="btn btn-ghost" href={APP_LOGIN}>Log in</a>
              <a className="btn btn-ghost" href={APP_SIGNUP}>Sign up</a>
              <a className="btn btn-primary" href={APP_URL}>Get the App</a>
            </div>
          </div>
        )}
      </nav>

      {/* HERO — maroon + gold */}
      <header className="hero-search hero-maroon" id="home">
        <div className="wrap hero-wrap">
          <div className="hero-copy">
            <h1 className="rise d2">Find the Best<br /><span className="hl-gold">Dentists</span> Near You</h1>
            <p className="hero-tagline rise d2">Book, Visit &amp; Smile!</p>
            <p className="hero-sub rise d3">Find verified dentists, top clinics and quality dental care&nbsp;&ndash; all in one place.</p>

            <form className="searchbar rise d4" onSubmit={runSearch}>
              <div className="sb-field sb-loc">
                <MapPin size={20} weight="fill" className="sb-ic" />
                <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Select city">
                  <option value="">Your Location</option>
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="sb-field grow">
                <input placeholder="Search Dentist, Clinic or Treatment" value={query} onChange={(e) => setQuery(e.target.value)} />
                <MagnifyingGlass size={20} weight="bold" className="sb-ic sb-ic-end" />
              </div>
              <button className="sb-btn" type="submit">{searching ? 'Searching...' : 'Search'}</button>
            </form>

            <div className="quick-specs rise d5">
              <span>Popular Searches:</span>
              {['Dental Implants', 'Teeth Whitening', 'Crown', 'Root Canal'].map((s) => (
                <button className="spec-pill" key={s} onClick={() => { setQuery(s); runSearch(null, { specialization: s }); }}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        {/* curved gold-arc image — anchored to the FULL-WIDTH section, right edge */}
        <div className="hero-visual rise d3">
          <div className="hero-arc-gold" aria-hidden="true" />
          <div className="hero-arc">
            <img src={heroDentalBooking} alt="Verified dentist" />
          </div>
        </div>

        {/* Sign Up CTA — floats in the maroon space beside the image */}
        <a className="hero-signup rise d5" href={APP_SIGNUP}>
          <span className="hs-icon"><SealCheck size={22} weight="fill" /></span>
          <span className="hs-text"><strong>Sign Up</strong><small>Free — get started</small></span>
          <ArrowRight size={20} weight="bold" className="hs-arrow" />
        </a>
      </header>

      {/* SEARCH RESULTS — shown below the hero when a search runs */}
      {results && (
        <section className="results-section" id="results">
          <div className="wrap">
            <div className="search-results">
              <div className="sr-head">
                <strong>{results.length}</strong> dentist{results.length !== 1 ? 's' : ''} found{city ? ` in ${city}` : ''}
                <button className="sr-clear" onClick={() => setResults(null)}>Clear</button>
              </div>
              {results.length ? (
                <>
                  <div className="sr-grid">
                    {results.map((d) => <DocCard key={d._id} d={d} />)}
                  </div>
                  <div className="sr-foot">
                    <a className="btn btn-primary" href={APP_URL}>See all dentists in the app <ArrowRight size={16} weight="bold" /></a>
                  </div>
                </>
              ) : (
                <div className="sr-empty">
                  <MagnifyingGlass size={30} weight="bold" />
                  <p>No dentists matched. Try a different city or specialty.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* BROWSE CLINICS BY CATEGORY (clinic tiers) */}
      <section className="block clinics-cat" id="clinics">
        <div className="wrap">
          <div className="cat-head">
            <h2>Browse Clinics by Category</h2>
            <a className="cat-viewall" href={APP_URL}>View All <ArrowRight size={18} weight="bold" /></a>
          </div>
          <div className="cat-grid">
            {[
              { key: 'elite',    Icon: Crown,       title: 'Elite Clinics',    sub: 'Premium Care',        cls: 'cat-elite',    photo: eliteClinic },
              { key: 'modern',   Icon: Diamond,     title: 'Modern Clinics',   sub: 'Advanced Technology', cls: 'cat-modern',   photo: modernClinic },
              { key: 'standard', Icon: ShieldCheck, title: 'Standard Clinics', sub: 'Quality & Affordable', cls: 'cat-standard', photo: standardClinic },
            ].map(({ key, Icon, title, sub, cls, photo }) => (
              <a className={`cat-card ${cls}`} key={key} href={APP_URL}>
                <div className="cat-photo" style={{ backgroundImage: `url(${photo})` }} />
                <div className="cat-band">
                  <div className="cat-badge"><Icon size={26} weight="fill" /></div>
                  <div className="cat-text"><strong>{title}</strong><span>{sub}</span></div>
                  <div className="cat-go"><ArrowRight size={18} weight="bold" /></div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* BROWSE BY SPECIALTY — informational; clicking runs an on-page search */}
      <section className="block" id="specialties">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow"><Tooth size={14} weight="fill" /> Browse by specialty</span>
            <h2>Find the right specialist for your needs.</h2>
          </div>
          <div className="spec-grid">
            {SPECIALTIES.map(([name, desc], index) => {
              const Icon = SPEC_ICONS[name] || Tooth;
              return (
                <a
                  className={`spec-tile pastel-${(index % 6) + 1}`}
                  key={name}
                  href="#results"
                  onClick={(e) => { e.preventDefault(); setQuery(name); runSearch(null, { specialization: name }); }}
                  style={{ '--tile-image': `url(${heroDentalBooking})` }}
                >
                  <div className="spec-ic"><Icon size={26} weight="fill" /></div>
                  <span><strong>{name}</strong><small>{desc}</small></span>
                  <CaretRight size={16} className="spec-arrow" />
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* TOP DOCTORS (live data) */}
      <section className="block how" id="top">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow"><Star size={14} weight="fill" /> Top-rated dentists</span>
            <h2>Meet some of our most popular dentists.</h2>
          </div>
          {topDocs.length ? (
            <div className="doc-carousel">
              {topDocs.map((d) => <DocCard key={d._id} d={d} big />)}
            </div>
          ) : <p className="muted-note">Loading top dentists…</p>}
        </div>
      </section>

      {/* BROWSE BY CITY — informational; clicking runs an on-page search */}
      <section className="block" id="cities">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow"><MapPin size={14} weight="fill" /> Browse by city</span>
            <h2>Quality dental care in your city.</h2>
          </div>
          <div className="city-grid">
            {CITIES.map((c) => (
              <a className="city-tile" key={c} href="#results" onClick={(e) => { e.preventDefault(); setCity(c); runSearch(null, { city: c }); }}>
                <MapPin size={18} weight="fill" />
                <span>Dentists in {c}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="block how" id="features">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow"><Sparkle size={14} weight="fill" /> Why {BRAND}</span>
            <h2>Everything you need for confident dental care.</h2>
          </div>
          <div className="features">
            {FEATURES.map(([Icon, t, d]) => (
              <div className="feature" key={t}>
                <div className="ic"><Icon size={26} weight="fill" /></div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="block" id="how">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow"><Sparkle size={14} weight="fill" /> Three simple steps</span>
            <h2>Book your next visit before your coffee gets cold.</h2>
          </div>
          <div className="steps">
            {[
              ['01', 'Search', 'Find verified dentists by city and specialty, and compare clinics by ratings and facilities.'],
              ['02', 'Book', 'Choose a treatment, pick a time slot, and confirm — instantly, right from your phone.'],
              ['03', 'Care & Earn', 'Visit, chat, pay online, and collect reward points toward your next appointment.'],
            ].map(([n, t, d]) => (
              <div className="step" key={n}>
                <div className="num serif">{n}</div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOR DOCTORS */}
      <section className="block how" id="doctors">
        <div className="wrap">
          <div className="docs-panel">
            <div>
              <span className="eyebrow" style={{ background: 'rgba(255,255,255,.16)', color: '#dbeafe' }}><Stethoscope size={14} weight="fill" /> For Dentists &amp; Clinics</span>
              <h2 style={{ marginTop: 16 }}>Grow your practice. Fill your calendar.</h2>
              <p>Join {BRAND} and reach thousands of patients actively searching for care. Manage appointments, showcase your work, and build your reputation.</p>
              <a className="btn btn-mint" href={APP_URL}>Join as a Dentist <ArrowRight size={17} weight="bold" /></a>
            </div>
            <ul className="docs-list">
              {[
                'Get discovered by new patients every day',
                'Showcase before-&-after galleries and reviews',
                'Earn the green Popular badge at 20k points',
                'Manage appointments, bills & payments in one dashboard',
                'Build trust with PMDC verification',
              ].map((t) => (
                <li key={t}><span className="chk"><Check size={13} weight="bold" /></span> {t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="block" id="reviews">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow"><Quotes size={14} weight="fill" /> Real patients, real smiles</span>
            <h2>Trusted by thousands across Pakistan.</h2>
          </div>
          <div className="quotes">
            {[
              ['Booked a root canal in under a minute. The dentist even messaged me to confirm. Brilliant.', 'Ayesha K.', 'Patient · Lahore'],
              ['I switched my whole clinic to ' + BRAND + '. My appointment slots fill up far faster now.', 'Dr. Usman T.', 'Dentist · Karachi'],
              ['Love the reward points — got a discount on my whitening just for being a regular!', 'Hassan J.', 'Patient · Islamabad'],
            ].map(([q, nm, ro]) => (
              <div className="quote" key={nm}>
                <Quotes size={28} weight="fill" className="q-mark" />
                <div className="stars">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={15} weight="fill" />)}</div>
                <p>{q}</p>
                <div className="who"><div><div className="nm">{nm}</div><div className="ro">{ro}</div></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APP DOWNLOAD CTA */}
      <section className="cta">
        <div className="wrap">
          <h2 className="serif">Your healthiest smile<br />starts with one tap.</h2>
          <p>Download the {BRAND} app and book better dental care today.</p>
          <div className="store-badges">
            <a className="store-badge" href={APP_URL}><AppleLogo size={26} weight="fill" /><div><small>Download on the</small><strong>App Store</strong></div></a>
            <a className="store-badge" href={APP_URL}><GooglePlayLogo size={24} weight="fill" /><div><small>Get it on</small><strong>Google Play</strong></div></a>
          </div>
          <a className="cta-web" href={APP_URL}>or use the web app <ArrowRight size={15} weight="bold" /></a>
        </div>
      </section>

      <Footer />
    </>
  );
}

function DocCard({ d, big }) {
  // Whole card → opens THIS dentist's profile in the app (works for guests).
  const tier = (d.clinicTier || '').toLowerCase();
  return (
    <a className={`doc-result ${big ? 'big' : ''}`} href={doctorUrl(d._id)}>
      <div className="dr-top">
        {d.photo ? <img src={imgUrl(d.photo)} alt={d.fullName} /> : <div className="dr-ph"><Tooth size={28} weight="fill" /></div>}
        {d.isPopular && (
          <span className={`dr-pop ${d.popularType === 'paid' ? 'blue' : 'green'}`}><Star size={10} weight="fill" /> Popular</span>
        )}
      </div>
      <div className="dr-body">
        <div className="dr-name">
          {d.fullName}
          {d.pmdcVerified && <SealCheck size={15} weight="fill" className="dr-verified" />}
        </div>
        <div className="dr-spec">{d.specialization || 'Dentist'}</div>
        {d.clinicName ? (
          <div className="dr-clinic">
            <span>{d.clinicName}</span>
            {tier ? <span className={`dr-tier ${tier}`}>{tier}</span> : null}
          </div>
        ) : null}
        <div className="dr-meta">
          <span><MapPin size={13} weight="fill" /> {d.city || '—'}</span>
          {d.experience ? <span>{d.experience}+ yrs exp</span> : null}
        </div>
      </div>
      <div className="dr-side">
        <span className="dr-book">Book <ArrowRight size={14} weight="bold" /></span>
      </div>
    </a>
  );
}

function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="cols">
          <div>
            <div className="logo"><Mark /> {BRAND}</div>
            <p className="tag">Connecting patients with trusted dental clinics across Pakistan — discover, book, and care, all in one app.</p>
          </div>
          <div>
            <h4>Patients</h4>
            <ul><li><a href="#specialties">Find a dentist</a></li><li><a href="#cities">Browse cities</a></li><li><a href="#top">Top dentists</a></li><li><a href={APP_URL}>Get the app</a></li></ul>
          </div>
          <div>
            <h4>Dentists</h4>
            <ul><li><a href="#doctors">Join us</a></li><li><a href={APP_URL}>Dashboard</a></li><li><a href="#reviews">Success stories</a></li></ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><a href="#/support">Support</a></li>
              <li><a href="#/terms">Terms &amp; Conditions</a></li>
              <li><a href="#/privacy">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        <div className="base">
          <span>© 2026 {BRAND}. All rights reserved.</span>
          <span>
            <a href="#/terms" style={{ marginRight: 16 }}>Terms</a>
            <a href="#/privacy" style={{ marginRight: 16 }}>Privacy</a>
            <a href="#/support">Support</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
