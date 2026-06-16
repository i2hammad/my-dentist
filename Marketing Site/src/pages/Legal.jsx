// Terms, Privacy, and Support pages for My Dentist PK.
import { Tooth, ArrowLeft, EnvelopeSimple, Phone, ChatCircleDots, ArrowRight } from '@phosphor-icons/react';

const BRAND = 'My Dentist PK';
const SUPPORT_EMAIL = 'support@mydentistpk.com';
const SUPPORT_PHONE = '+92 300 1234567';

function LegalShell({ title, updated, children }) {
  return (
    <div className="legal">
      <nav className="nav">
        <div className="wrap">
          <a className="logo" href="#/"><span className="mark"><Tooth size={18} weight="fill" /></span> {BRAND}</a>
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
    <footer>
      <div className="wrap">
        <div className="base" style={{ borderTop: 'none', paddingTop: 0 }}>
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

export function Support() {
  return (
    <LegalShell title="Support">
      <p>Need help? We’re here for you. Reach out through any of the channels below and our team will respond as soon as possible.</p>

      <div className="support-grid">
        <a className="support-card" href={`mailto:${SUPPORT_EMAIL}`}>
          <div className="sc-ic"><EnvelopeSimple size={24} weight="fill" /></div>
          <h3>Email Us</h3>
          <p>{SUPPORT_EMAIL}</p>
          <span className="sc-link">Send an email <ArrowRight size={14} weight="bold" /></span>
        </a>
        <a className="support-card" href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}>
          <div className="sc-ic"><Phone size={24} weight="fill" /></div>
          <h3>Call Us</h3>
          <p>{SUPPORT_PHONE}</p>
          <span className="sc-link">Mon–Sat, 9am–6pm</span>
        </a>
        <div className="support-card">
          <div className="sc-ic"><ChatCircleDots size={24} weight="fill" /></div>
          <h3>In-App Chat</h3>
          <p>Message support right from the {BRAND} app.</p>
          <span className="sc-link">Open the app</span>
        </div>
      </div>

      <h2>Frequently Asked Questions</h2>

      <h3>How do I book an appointment?</h3>
      <p>Open the {BRAND} app, search for a dentist or specialty, choose an available time slot, and confirm. You’ll get a confirmation and can chat with the clinic directly.</p>

      <h3>How do reward points work?</h3>
      <p>You earn loyalty points on appointments and payments. Points can be redeemed for discounts on future visits. Check your rewards balance in the app.</p>

      <h3>How do I cancel or reschedule?</h3>
      <p>Go to your appointments in the app and select the booking. Cancellation and rescheduling policies are set by each clinic.</p>

      <h3>I’m a dentist — how do I join?</h3>
      <p>Download the app, register as a dentist, complete your clinic profile, and submit your PMDC details for verification. Once approved, patients can find and book you.</p>

      <h3>How do I delete my account?</h3>
      <p>Go to Settings in the app, or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we’ll process your request.</p>
    </LegalShell>
  );
}
