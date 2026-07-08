// Terms, Privacy, and Support pages for My Dentist.
import { useState } from 'react';
import { ArrowLeft, EnvelopeSimple, Phone, ChatCircleDots, ArrowRight, WhatsappLogo, CaretDown } from '@phosphor-icons/react';
import appLogo from '../assets/app-logo.png';

const BRAND = 'My Dentist';
const SUPPORT_EMAIL = 'support@mydentistpk.com';
const SUPPORT_PHONE = '+92 336 5257815';
const SUPPORT_WHATSAPP = '923365257815'; // wa.me format (intl, no +)
const APP_URL = import.meta.env.VITE_APP_URL || 'https://app.mydentistpk.com';

function LegalShell({ title, updated, children }) {
  return (
    <div className="legal">
      <nav className="nav">
        <div className="wrap">
          <a className="logo" href="#/"><span className="mark"><img src={appLogo} alt="" /></span> {BRAND}</a>
          <div className="nav-cta" style={{ marginLeft: 'auto' }}>
            <a className="btn btn-ghost" href="#/"><ArrowLeft size={16} weight="bold" /> Back to home</a>
          </div>
        </div>
      </nav>
      <div className="wrap legal-body">
        <h1 className="serif">{title}</h1>
        {updated && <p className="muted-note">Last updated: {updated}</p>}
        {children}
      </div>
      <LegalFooter />
    </div>
  );
}

function LegalFooter() {
  return (
    <footer className="legal-footer">
      <div className="wrap">
        <div className="lf-inner">
          <a className="logo" href="#/"><span className="mark"><img src={appLogo} alt="" /></span> {BRAND}</a>
          <nav className="lf-links">
            <a href="#/">Home</a>
            <a href="#/terms">Terms</a>
            <a href="#/privacy">Privacy</a>
            <a href="#/support">Support</a>
          </nav>
        </div>
        <div className="lf-base">© 2026 {BRAND}. All rights reserved. · Pakistan</div>
      </div>
    </footer>
  );
}

export function Terms() {
  return (
    <LegalShell title="Terms & Conditions" updated="June 16, 2026">
      <p>Welcome to {BRAND}. By accessing or using our mobile app, website, or services (the “Platform”), you agree to these Terms & Conditions. Please read them carefully.</p>

      <h2>1. Acceptance of Terms</h2>
      <p>By creating an account or using {BRAND}, you confirm that you are at least 18 years old (or using the Platform under the supervision of a parent or guardian) and agree to be bound by these terms.</p>

      <h2>2. The Service</h2>
      <p>{BRAND} is a platform that connects patients with independent dental clinics and practitioners. We facilitate discovery, appointment booking, communication, billing, and rewards. {BRAND} is <strong>not</strong> a healthcare provider and does not provide medical or dental advice. All clinical care is provided by independent, third-party dentists.</p>

      <h2>3. Accounts</h2>
      <p>You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. Dentists must provide accurate professional credentials, including valid PMDC registration where applicable.</p>

      <h2>4. Bookings & Payments</h2>
      <p>Appointments booked through {BRAND} are agreements between you and the clinic. Payment terms, fees, cancellations, and refunds are set by the individual clinic. {BRAND} may process payments on a clinic’s behalf but is not liable for the services rendered.</p>

      <h2>5. Rewards Program</h2>
      <p>Loyalty points have no cash value, are non-transferable, and may be modified or discontinued at any time. The “Popular” status granted to dentists (earned through points or via paid promotion) does not constitute an endorsement of clinical quality by {BRAND}.</p>

      <h2>6. Acceptable Use</h2>
      <p>You agree not to misuse the Platform, post false reviews, impersonate others, or attempt to disrupt the service. We may suspend accounts that violate these terms.</p>

      <h2>7. Limitation of Liability</h2>
      <p>{BRAND} is provided “as is.” To the fullest extent permitted by law, {BRAND} is not liable for any clinical outcomes, disputes with clinics, or indirect damages arising from use of the Platform.</p>

      <h2>8. Changes</h2>
      <p>We may update these terms from time to time. Continued use of the Platform after changes constitutes acceptance of the revised terms.</p>

      <h2>9. Contact</h2>
      <p>Questions about these terms? Email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </LegalShell>
  );
}

export function Privacy() {
  return (
    <LegalShell title="Privacy Policy" updated="June 16, 2026">
      <p>{BRAND} (“we”, “us”) respects your privacy. This policy explains what information we collect, how we use it, and your choices.</p>

      <h2>1. Information We Collect</h2>
      <p>We collect information you provide directly — name, email, phone number, date of birth, location, and profile photo. For dentists, this includes professional details and verification documents. We also collect usage data such as appointments, messages, bills, and reward activity.</p>

      <h2>2. How We Use Your Information</h2>
      <p>We use your data to operate the Platform: to enable bookings, facilitate communication between patients and clinics, process payments, run the rewards program, verify dentists, and improve our services.</p>

      <h2>3. Sharing</h2>
      <p>When you book or message a clinic, relevant information (such as your name and appointment details) is shared with that clinic. We do not sell your personal data. We may share data with service providers (e.g. cloud hosting, image storage, payment processors) strictly to operate the Platform.</p>

      <h2>4. Image & Document Storage</h2>
      <p>Profile photos and clinic gallery images are stored with a third-party media provider. Verification documents submitted by dentists are used only for verification purposes.</p>

      <h2>5. Data Security</h2>
      <p>We use industry-standard measures including encrypted connections and hashed passwords. No system is perfectly secure, so we cannot guarantee absolute security.</p>

      <h2>6. Your Rights</h2>
      <p>You may access, update, or delete your account information at any time from within the app, or by contacting us. Deleting your account removes your profile and associated personal data, subject to legal retention requirements.</p>

      <h2>7. Children</h2>
      <p>The Platform is not directed at children under 13. We do not knowingly collect data from children without parental consent.</p>

      <h2>8. Contact</h2>
      <p>For privacy questions or data requests, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </LegalShell>
  );
}

function FaqItem({ q, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item${open ? ' open' : ''}`}>
      <button className="faq-q" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{q}</span>
        <CaretDown className="faq-chevron" size={18} weight="bold" />
      </button>
      <div className="faq-a"><div className="faq-a-inner">{children}</div></div>
    </div>
  );
}

const CHANNELS = [
  {
    key: 'email', tint: 'email', icon: EnvelopeSimple, title: 'Email Us',
    line: SUPPORT_EMAIL, cta: 'Send an email', href: `mailto:${SUPPORT_EMAIL}`,
  },
  {
    key: 'whatsapp', tint: 'whatsapp', icon: WhatsappLogo, title: 'WhatsApp',
    line: 'Chat with us instantly', cta: 'Open WhatsApp',
    href: `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Hello, I need help with My Dentist.')}`,
    external: true,
  },
  {
    key: 'call', tint: 'call', icon: Phone, title: 'Call Us',
    line: SUPPORT_PHONE, cta: 'Mon–Sat, 9am–6pm', href: `tel:${SUPPORT_PHONE.replace(/\s/g, '')}`,
  },
  {
    key: 'chat', tint: 'chat', icon: ChatCircleDots, title: 'In-App Chat',
    line: `Message support inside the ${BRAND} app`, cta: 'Open the app', href: APP_URL, external: true,
  },
];

export function Support() {
  return (
    <LegalShell title="How can we help?">
      <p className="support-lede">We’re here for you. Pick the channel that suits you best — our team typically replies within a few hours.</p>

      <div className="support-grid">
        {CHANNELS.map(({ key, tint, icon: Icon, title, line, cta, href, external }) => (
          <a
            key={key}
            className="support-card"
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            <div className={`sc-ic ${tint}`}><Icon size={24} weight="fill" /></div>
            <h3>{title}</h3>
            <p>{line}</p>
            <span className="sc-link">{cta} <ArrowRight size={14} weight="bold" /></span>
          </a>
        ))}
      </div>

      <h2 className="faq-heading">Frequently asked questions</h2>
      <div className="faq">
        <FaqItem q="How do I book an appointment?">
          Open the {BRAND} app, search for a dentist or specialty, choose an available time slot, and confirm. You’ll get a confirmation and can chat with the clinic directly.
        </FaqItem>
        <FaqItem q="How do reward points work?">
          You earn loyalty points on appointments and payments. Points can be redeemed for discounts on future visits. Check your rewards balance in the app.
        </FaqItem>
        <FaqItem q="How do I cancel or reschedule?">
          Go to your appointments in the app and select the booking. Cancellation and rescheduling policies are set by each clinic.
        </FaqItem>
        <FaqItem q="I’m a dentist — how do I join?">
          Download the app, register as a dentist, complete your clinic profile, and submit your PMDC details for verification. Once approved, patients can find and book you.
        </FaqItem>
        <FaqItem q="How do I delete my account?">
          Go to Settings in the app, or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we’ll process your request.
        </FaqItem>
      </div>

      <div className="support-cta">
        <div>
          <h3>Still need a hand?</h3>
          <p>Message us on WhatsApp and we’ll get you sorted.</p>
        </div>
        <a
          className="btn btn-whatsapp"
          href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Hello, I need help with My Dentist.')}`}
          target="_blank" rel="noopener noreferrer"
        >
          <WhatsappLogo size={18} weight="fill" /> Chat on WhatsApp
        </a>
      </div>
    </LegalShell>
  );
}
