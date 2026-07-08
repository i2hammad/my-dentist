const nodemailer = require('nodemailer');
const prisma = require('../config/prisma');

// SMTP config is managed from the Admin Panel (AppSettings.smtp) and falls back
// to .env. Shape of AppSettings.smtp: { host, port, user, pass, from, insecure }.
//   .env fallback: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, SMTP_TLS_INSECURE

// Load the effective SMTP config: DB value first, then .env for any blank field.
async function loadConfig() {
  let db = {};
  try {
    const s = await prisma.appSettings.findUnique({ where: { key: 'global' }, select: { smtp: true } });
    db = (s && s.smtp) || {};
  } catch (_) { /* DB unavailable — use env only */ }

  const host = db.host || process.env.SMTP_HOST || '';
  const port = Number(db.port || process.env.SMTP_PORT || 465);
  const user = db.user || process.env.SMTP_USER || '';
  const pass = db.pass || process.env.SMTP_PASS || '';
  const from = db.from || process.env.MAIL_FROM || (user ? `My Dentist <${user}>` : '');
  const insecure = db.insecure !== undefined
    ? Boolean(db.insecure)
    : String(process.env.SMTP_TLS_INSECURE).toLowerCase() === 'true';

  return { host, port, user, pass, from, insecure, configured: Boolean(host && user && pass) };
}

function buildTransporter(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465, // 465 = implicit SSL; 587/25 = STARTTLS
    auth: { user: cfg.user, pass: cfg.pass },
    ...(cfg.insecure ? { tls: { rejectUnauthorized: false } } : {}),
  });
}

// Is SMTP configured (DB or env)?
async function isConfigured() {
  return (await loadConfig()).configured;
}

// Verify the SMTP connection/credentials without sending. Returns { ok, error? }.
async function verifyConnection() {
  const cfg = await loadConfig();
  if (!cfg.configured) return { ok: false, error: 'SMTP not configured (host/user/pass missing)' };
  try { await buildTransporter(cfg).verify(); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
}

/**
 * Send an email. Returns { sent: boolean }.
 * If SMTP isn't configured, logs and returns { sent: false } so the caller still
 * succeeds (config can be added later from the admin panel).
 */
async function sendEmail({ to, subject, text, html }) {
  const cfg = await loadConfig();
  if (!cfg.configured) {
    console.log(`[mailer] SMTP not configured — would email ${to}: ${subject}`);
    return { sent: false };
  }
  await buildTransporter(cfg).sendMail({ from: cfg.from, to, subject, text, html });
  return { sent: true };
}

module.exports = { sendEmail, isConfigured, verifyConnection, loadConfig };
