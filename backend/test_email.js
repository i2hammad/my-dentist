// Verify SMTP config and (optionally) send a test email.
//   node test_email.js                 → just verify connection/credentials
//   node test_email.js you@example.com → verify, then send a test email there
require('dotenv').config();
const { verifyConnection, sendEmail, isConfigured } = require('./utils/mailer');

(async () => {
  console.log('SMTP configured:', isConfigured(),
    `(host=${process.env.SMTP_HOST || '-'} port=${process.env.SMTP_PORT || '-'} user=${process.env.SMTP_USER || '-'})`);

  const v = await verifyConnection();
  console.log('Connection:', v.ok ? '✅ OK' : `❌ ${v.error}`);
  if (!v.ok) process.exit(1);

  const to = process.argv[2];
  if (to) {
    try {
      const r = await sendEmail({
        to,
        subject: 'My Dentist — SMTP test',
        text: 'This is a test email from the My Dentist backend. If you received it, forgot-password emails will work.',
        html: '<p>This is a <b>test email</b> from the My Dentist backend. If you received it, forgot-password emails will work.</p>',
      });
      console.log('Send:', r.sent ? `✅ sent to ${to}` : '❌ not sent');
    } catch (e) {
      console.log('Send: ❌', e.message);
      process.exit(1);
    }
  }
  process.exit(0);
})();
