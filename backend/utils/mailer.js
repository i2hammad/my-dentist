const nodemailer = require('nodemailer');

// Email config (set these in .env when ready):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
// For Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=mydentist840@gmail.com,
//   SMTP_PASS=<gmail app password>.
const isConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
function getTransporter() {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: Number(process.env.SMTP_PORT) !== 587, // 465=SSL, 587=STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Send an email. Returns { sent: boolean }.
 * If SMTP isn't configured yet, logs the message and returns { sent: false }
 * so the calling flow still succeeds (keys can be added later).
 */
async function sendEmail({ to, subject, text, html }) {
  const tx = getTransporter();
  if (!tx) {
    console.log(`[mailer] SMTP not configured — would email ${to}: ${subject}`);
    return { sent: false };
  }
  await tx.sendMail({
    from: process.env.MAIL_FROM || `My Dentist PK <${process.env.SMTP_USER}>`,
    to, subject, text, html,
  });
  return { sent: true };
}

module.exports = { sendEmail, isConfigured };
