// My Dentist PK — oladoc/Marham-style landing page.
import { useEffect, useState } from 'react';
import {
  Tooth, MagnifyingGlass, CalendarCheck, ChatCircleDots, Receipt, Gift, ShieldCheck,
  Star, Check, ArrowRight, Sparkle, MapPin, Stethoscope, CaretRight, Quotes,
  AppleLogo, GooglePlayLogo, SealCheck,
} from '@phosphor-icons/react';
import { getDoctors, imgUrl, APP_URL, BRAND } from '../lib/api';

const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta'];
const SPECIALTIES = [
  ['Orthodontist', '🦷'], ['Implant Specialist', '⚙️'], ['Cosmetic Dentist', '✨'],
  ['Periodontist', '🩺'], ['Endodontist', '🔬'], ['Pediatric Dentist', '🧒'],
  ['Oral Surgeon', '🪥'], ['General Dentist', '😁'],
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

const Mark = () => <span className="mark"><Tooth size={18} weight="fill" /></span>;

export default function Home() {
  const [city, setCity] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [topDocs, setTopDocs] = useState([]);

  // Load real top/popular doctors for the carousel.
  useEffect(() => {
    getDoctors({ limit: 8 }).then(setTopDocs).catch(() => setTopDocs([]));
  }, []);

  const runSearch = async (e) => {
    e?.preventDefault();
    setSearching(true);
    try {
      const params = { limit: 6 };
      if (query) params.specialization = query;
      const docs = await getDoctors(params);
      const filtered = city ? docs.filter((d) => (d.city || '').toLowerCase() === city.toLowerCase()) : docs;
      setResults(filtered);
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  return (
    <>
      {/* NAV */}
      <nav className="nav">
        <div className="wrap">
          <a className="logo" href="#/"><Mark /> {BRAND}</a>
          <div className="nav-links">
            <a href="#specialties">Specialties</a>
            <a href="#cities">Cities</a>
            <a href="#top">Top Dentists</a>
            <a href="#how">How it works</a>
            <a href="#doctors">For Dentists</a>
          </div>
          <div className="nav-cta">
            <a className="btn btn-ghost" href={APP_URL}>Log in</a>
            <a className="btn btn-primary" href={APP_URL}>Get the App</a>
          </div>
        </div>
      </nav>

      {/* HERO — search first */}
      <header className="hero-search" id="home">
        <div className="wrap">
          <span className="eyebrow rise d1"><Sparkle size={14} weight="fill" /> Pakistan’s trusted dental booking platform</span>
          <h1 className="rise d2 serif">Find &amp; book the<br />best <em>dentists</em> near you.</h1>
          <p className="hero-sub rise d3">Search 300+ verified dental specialists across Pakistan. Compare clinics, read reviews, and book in seconds.</p>

          <form className="searchbar rise d4" onSubmit={runSearch}>
            <div className="sb-field">
              <MapPin size={20} weight="fill" className="sb-ic" />
              <select value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">All Cities</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sb-divider" />
            <div className="sb-field grow">
              <MagnifyingGlass size={20} weight="bold" className="sb-ic" />
              <input placeholder="Search specialty (e.g. Orthodontist) or condition" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <button className="btn btn-primary sb-btn" type="submit">{searching ? 'Searching…' : <>Search <ArrowRight size={17} weight="bold" /></>}</button>
          </form>

          <div className="quick-specs rise d5">
            <span>Popular:</span>
            {['Orthodontist', 'Implant Specialist', 'Cosmetic Dentist', 'Endodontist'].map((s) => (
              <button key={s} onClick={() => { setQuery(s); setTimeout(runSearch, 0); }}>{s}</button>
            ))}
          </div>

          {/* inline search results */}
          {results && (
            <div className="search-results rise">
              <div className="sr-head">
                <strong>{results.length}</strong> dentist{results.length !== 1 ? 's' : ''} found{city ? ` in ${city}` : ''}
                <button className="sr-clear" onClick={() => setResults(null)}>Clear</button>
              </div>
              {results.length ? (
                <div className="sr-grid">
                  {results.map((d) => <DocCard key={d._id} d={d} />)}
                </div>
              ) : <p className="muted-note">No dentists matched. Try a different city or specialty.</p>}
              <a className="btn btn-ghost" href={APP_URL} style={{ marginTop: 14 }}>See all in the app <ArrowRight size={16} weight="bold" /></a>
            </div>
          )}

          <div className="trust-strip rise d6">
            <div className="ts-item"><strong>300+</strong> Verified Dentists</div>
            <div className="ts-item"><strong>4,800+</strong> Happy Patients</div>
            <div className="ts-item"><strong>12k+</strong> Appointments</div>
            <div className="ts-item"><Star size={15} weight="fill" /> <strong>4.8</strong> Avg Rating</div>
          </div>
        </div>
      </header>

      {/* BROWSE BY SPECIALTY */}
      <section className="block" id="specialties">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow"><Tooth size={14} weight="fill" /> Browse by specialty</span>
            <h2>Find the right specialist for your needs.</h2>
          </div>
          <div className="spec-grid">
            {SPECIALTIES.map(([name]) => {
              const Icon = SPEC_ICONS[name] || Tooth;
              return (
                <a className="spec-tile" key={name} href={APP_URL}>
                  <div className="spec-ic"><Icon size={26} weight="fill" /></div>
                  <span>{name}</span>
                  <CaretRight size={16} className="spec-arrow" />
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* TOP DOCTORS (real data) */}
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

      {/* BROWSE BY CITY */}
      <section className="block" id="cities">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow"><MapPin size={14} weight="fill" /> Browse by city</span>
            <h2>Quality dental care in your city.</h2>
          </div>
          <div className="city-grid">
            {CITIES.map((c) => (
              <a className="city-tile" key={c} href={APP_URL}>
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
  return (
    <a className={`doc-result ${big ? 'big' : ''}`} href={APP_URL}>
      <div className="dr-top">
        {d.photo ? <img src={imgUrl(d.photo)} alt={d.fullName} /> : <div className="dr-ph"><Tooth size={26} weight="fill" /></div>}
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
        <div className="dr-meta">
          <MapPin size={13} weight="fill" /> {d.city || '—'}
          {d.consultationFee ? <span className="dr-fee">Rs. {d.consultationFee}</span> : null}
        </div>
      </div>
      <span className="dr-book">Book <ArrowRight size={14} weight="bold" /></span>
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
