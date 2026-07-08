// Transactional emails for lifecycle events (signup, booking, approval, …).
// Each function is best-effort: it try/catches internally and never throws, so
// call sites can fire-and-forget without slowing or breaking the main flow.
const { sendEmail } = require('./mailer');
const { renderEmail, emailButton, emailPanel } = require('./emailTemplate');
const prisma = require('../config/prisma');

const APP = 'https://app.mydentistpk.com';

const fmtDate = (d) => {
  try {
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return String(d); }
};

const pkr = (n) => `PKR ${Number(n || 0).toLocaleString()}`;

const safe = (label, fn) => fn().catch((e) => console.error(`[emails] ${label} failed:`, e.message));

// Resolve a user's email from their id (best-effort; null on any error).
async function userEmail(userId) {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    return u?.email || null;
  } catch { return null; }
}

// ── Welcome on signup ──────────────────────────────────────
function sendWelcomeEmail({ to, role }) {
  const doctor = role === 'doctor';
  return safe('welcome', () => sendEmail({
    to,
    subject: `Welcome to My Dentist`,
    text: doctor
      ? `Welcome to My Dentist!\n\nComplete your clinic profile and submit your PMDC details to get verified — once approved, patients can find and book you.\n\nOpen the app: ${APP}\n\n— The My Dentist Team`
      : `Welcome to My Dentist!\n\nFind and book verified dentists near you, chat with clinics, and earn rewards on every visit.\n\nOpen the app: ${APP}\n\n— The My Dentist Team`,
    html: renderEmail({
      preheader: doctor ? 'Complete your profile to start receiving patients.' : 'Find & book trusted dentists near you.',
      heading: doctor ? 'Welcome aboard, Doctor' : 'Welcome to My Dentist',
      bodyHtml: doctor
        ? `<p style="margin:0 0 14px;">We're glad to have you.</p>
           <p style="margin:0 0 18px;">Complete your clinic profile and submit your <b>PMDC</b> details to get verified. Once approved, patients searching in your city can find and book you.</p>
           ${emailButton({ href: APP, label: 'Complete your profile →' })}
           <p style="margin:16px 0 0;color:#64748b;font-size:13px;">Grow your practice, manage appointments, and build your reputation — all in one dashboard.</p>`
        : `<p style="margin:0 0 14px;">We're glad you're here.</p>
           <p style="margin:0 0 18px;">Search verified dentists near you, book appointments in seconds, chat with clinics, and <b>earn rewards</b> on every visit.</p>
           ${emailButton({ href: APP, label: 'Find a dentist →' })}
           <p style="margin:16px 0 0;color:#64748b;font-size:13px;">Every dentist on My Dentist is PMDC-verified and tier-rated.</p>`,
    }),
  }));
}

// ── Appointment requested — to the patient ─────────────────
function sendAppointmentBookedEmail({ to, patientName, doctorName, treatment, date, time }) {
  return safe('appointment-booked', () => sendEmail({
    to,
    subject: 'Your My Dentist appointment request',
    text: `Hi ${patientName || 'there'},\n\nYour ${treatment} appointment with Dr. ${doctorName} on ${fmtDate(date)} at ${time} has been requested. The clinic will confirm it shortly.\n\nView it in the app: ${APP}\n\n— My Dentist`,
    html: renderEmail({
      preheader: `${treatment} with Dr. ${doctorName} on ${fmtDate(date)}.`,
      heading: 'Appointment requested',
      bodyHtml: `<p style="margin:0 0 14px;">Hi ${patientName || 'there'},</p>
        <p style="margin:0 0 4px;">Your appointment request has been sent. The clinic will confirm it shortly.</p>
        ${emailPanel(`<b>${treatment}</b> with Dr. ${doctorName}<br>${fmtDate(date)} &nbsp;·&nbsp; ${time}`, 'info')}
        ${emailButton({ href: APP, label: 'View appointment →' })}
        <p style="margin:16px 0 0;color:#64748b;font-size:13px;">You can chat with the clinic and manage this booking from the app.</p>`,
    }),
  }));
}

// ── New appointment request — to the doctor ────────────────
function sendAppointmentRequestEmail({ to, doctorName, patientName, treatment, date, time }) {
  return safe('appointment-request', () => sendEmail({
    to,
    subject: 'New appointment request on My Dentist',
    text: `Hi Dr. ${doctorName},\n\n${patientName} requested a ${treatment} appointment on ${fmtDate(date)} at ${time}. Review and confirm it in your dashboard.\n\nOpen the app: ${APP}\n\n— My Dentist`,
    html: renderEmail({
      preheader: `${patientName} · ${treatment} · ${fmtDate(date)} ${time}`,
      heading: 'New appointment request',
      bodyHtml: `<p style="margin:0 0 14px;">Hi Dr. ${doctorName},</p>
        <p style="margin:0 0 4px;">You have a new appointment request. Review and confirm it in your dashboard.</p>
        ${emailPanel(`<b>${treatment}</b> — ${patientName}<br>${fmtDate(date)} &nbsp;·&nbsp; ${time}`, 'info')}
        ${emailButton({ href: APP, label: 'Open dashboard →' })}`,
    }),
  }));
}

// ── Doctor approved ────────────────────────────────────────
function sendDoctorApprovedEmail({ to, name }) {
  return safe('doctor-approved', () => sendEmail({
    to,
    subject: 'Your My Dentist profile is approved',
    text: `Hi Dr. ${name},\n\nGreat news — your My Dentist profile has been verified and approved. You're now discoverable to patients searching in your city.\n\nOpen the app: ${APP}\n\n— My Dentist`,
    html: renderEmail({
      preheader: "You're verified — patients can now find and book you.",
      heading: "You're approved",
      bodyHtml: `<p style="margin:0 0 14px;">Hi Dr. ${name},</p>
        ${emailPanel('&#10003;&nbsp; Your profile is verified and live', 'success')}
        <p style="margin:0 0 18px;">Patients searching in your city can now find and book you. Keep your availability and treatments up to date to get the most bookings.</p>
        ${emailButton({ href: APP, label: 'Open dashboard →' })}`,
    }),
  }));
}

// ── Appointment status change — confirmed / rescheduled / cancelled ─────────
async function sendAppointmentStatusEmail({ userId, status, treatment, date, time, name }) {
  const to = await userEmail(userId);
  if (!to) return;
  const cfg = {
    confirmed: {
      subject: 'Your My Dentist appointment is confirmed',
      heading: 'Appointment confirmed',
      tone: 'success',
      intro: 'Good news — your appointment is confirmed. See you then!',
      panel: `<b>${treatment}</b>${name ? ` with Dr. ${name}` : ''}<br>${fmtDate(date)} &nbsp;·&nbsp; ${time}`,
    },
    rescheduled: {
      subject: 'Your My Dentist appointment was rescheduled',
      heading: 'Appointment rescheduled',
      tone: 'info',
      intro: `Your appointment has been rescheduled${name ? ` by Dr. ${name}` : ''}.`,
      panel: `<b>${treatment}</b><br>New time: ${fmtDate(date)} &nbsp;·&nbsp; ${time}`,
    },
    cancelled: {
      subject: 'Your My Dentist appointment was cancelled',
      heading: 'Appointment cancelled',
      tone: 'warn',
      intro: `This appointment has been cancelled${name ? ` by ${name}` : ''}. You can book a new one anytime.`,
      panel: `<b>${treatment}</b><br>${fmtDate(date)} &nbsp;·&nbsp; ${time}`,
    },
  }[status];
  if (!cfg) return;
  return safe(`appointment-${status}`, () => sendEmail({
    to,
    subject: cfg.subject,
    text: `${cfg.intro}\n\n${treatment} — ${fmtDate(date)} at ${time}\n\nOpen the app: ${APP}\n\n— My Dentist`,
    html: renderEmail({
      preheader: cfg.subject,
      heading: cfg.heading,
      bodyHtml: `<p style="margin:0 0 14px;">${cfg.intro}</p>
        ${emailPanel(cfg.panel, cfg.tone)}
        ${emailButton({ href: APP, label: 'View appointment →' })}`,
    }),
  }));
}

// ── Payment receipt — to the patient ───────────────────────
async function sendBillReceiptEmail({ userId, patientName, invoiceNumber, treatmentName, amount, rewardPoints = 0 }) {
  const to = await userEmail(userId);
  if (!to) return;
  const amt = pkr(amount);
  return safe('bill-receipt', () => sendEmail({
    to,
    subject: `Payment received — invoice ${invoiceNumber}`,
    text: `Hi ${patientName || 'there'},\n\nWe received your payment of ${amt} for ${treatmentName} (invoice ${invoiceNumber}).${rewardPoints ? `\nYou earned ${rewardPoints} reward points.` : ''}\n\nView your bills: ${APP}\n\n— My Dentist`,
    html: renderEmail({
      preheader: `Payment of ${amt} received — invoice ${invoiceNumber}.`,
      heading: 'Payment received',
      bodyHtml: `<p style="margin:0 0 14px;">Hi ${patientName || 'there'},</p>
        ${emailPanel(`&#10003;&nbsp; Paid <b>${amt}</b>`, 'success')}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 18px;font-size:14px;color:#334155;">
          <tr><td style="padding:6px 0;color:#64748b;">Invoice</td><td style="padding:6px 0;text-align:right;font-weight:700;">${invoiceNumber}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;border-top:1px solid #eef3fb;">Treatment</td><td style="padding:6px 0;text-align:right;font-weight:700;border-top:1px solid #eef3fb;">${treatmentName}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;border-top:1px solid #eef3fb;">Amount paid</td><td style="padding:6px 0;text-align:right;font-weight:800;border-top:1px solid #eef3fb;">${amt}</td></tr>
          ${rewardPoints ? `<tr><td style="padding:6px 0;color:#64748b;border-top:1px solid #eef3fb;">Reward points</td><td style="padding:6px 0;text-align:right;font-weight:800;color:#16a34a;border-top:1px solid #eef3fb;">+${rewardPoints}</td></tr>` : ''}
        </table>
        ${emailButton({ href: APP, label: 'View in app →' })}`,
    }),
  }));
}

// ── Appointment reminder (day before) — to the patient ─────
async function sendAppointmentReminderEmail({ userId, treatment, doctorName, date, time }) {
  const to = await userEmail(userId);
  if (!to) return;
  return safe('appointment-reminder', () => sendEmail({
    to,
    subject: 'Reminder: your My Dentist appointment is tomorrow',
    text: `This is a friendly reminder of your upcoming appointment.\n\n${treatment}${doctorName ? ` with Dr. ${doctorName}` : ''}\n${fmtDate(date)} at ${time}\n\nOpen the app: ${APP}\n\n— My Dentist`,
    html: renderEmail({
      preheader: `${treatment}${doctorName ? ` with Dr. ${doctorName}` : ''} — ${fmtDate(date)} at ${time}.`,
      heading: 'Your appointment is tomorrow',
      bodyHtml: `<p style="margin:0 0 14px;">This is a friendly reminder of your upcoming appointment.</p>
        ${emailPanel(`<b>${treatment}</b>${doctorName ? ` with Dr. ${doctorName}` : ''}<br>${fmtDate(date)} &nbsp;·&nbsp; ${time}`, 'info')}
        ${emailButton({ href: APP, label: 'View appointment →' })}
        <p style="margin:16px 0 0;color:#64748b;font-size:13px;">Need to reschedule or cancel? You can do it from the app.</p>`,
    }),
  }));
}

// ── Password changed — security notification ───────────────
function sendPasswordChangedEmail({ to }) {
  return safe('password-changed', () => sendEmail({
    to,
    subject: 'Your My Dentist password was changed',
    text: `Hello,\n\nThis is a confirmation that your My Dentist password was just changed.\n\nIf this wasn't you, reset your password immediately and contact support@mydentistpk.com.\n\n— My Dentist`,
    html: renderEmail({
      preheader: 'Your My Dentist password was just changed.',
      heading: 'Password changed',
      bodyHtml: `<p style="margin:0 0 14px;">Hello,</p>
        <p style="margin:0 0 4px;">This is a confirmation that your <b>My Dentist</b> password was just changed.</p>
        ${emailPanel("If this wasn't you, reset your password immediately and contact support.", 'warn')}
        <p style="margin:0;color:#64748b;font-size:13px;">Questions? Email <a href="mailto:support@mydentistpk.com" style="color:#0052ff;">support@mydentistpk.com</a>.</p>`,
    }),
  }));
}

module.exports = {
  sendWelcomeEmail,
  sendAppointmentBookedEmail,
  sendAppointmentRequestEmail,
  sendDoctorApprovedEmail,
  sendAppointmentStatusEmail,
  sendAppointmentReminderEmail,
  sendBillReceiptEmail,
  sendPasswordChangedEmail,
};
