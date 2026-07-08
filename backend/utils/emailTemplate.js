// Reusable branded HTML email layout for My Dentist.
// Table-based + inline styles for broad email-client support (incl. Outlook),
// with a hidden preheader, solid-colour fallback under the header gradient, and
// bulletproof button / code-box / panel / divider helpers. Self-contained
// (no external images) so it renders everywhere and stays deliverability-safe.

const BRAND = 'My Dentist';
const TAGLINE = 'Trusted dental care across Pakistan';
const SITE = 'https://mydentistpk.com';
const APP = 'https://app.mydentistpk.com';
const SUPPORT = 'support@mydentistpk.com';
const YEAR = 2026;
const BLUE = '#0052ff';

function renderEmail({ preheader = '', heading = '', bodyHtml = '' }) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${BRAND}</title>
</head>
<body style="margin:0;padding:0;width:100%;background:#e9eff9;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#e9eff9;font-size:1px;line-height:1px;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9eff9;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;border-radius:20px;overflow:hidden;box-shadow:0 24px 48px -24px rgba(9,24,51,0.35);">
          <!-- Header -->
          <tr>
            <td align="center" style="background:${BLUE};background:linear-gradient(135deg,#0033b3 0%,#0052ff 55%,#4f86ff 100%);padding:32px 32px 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="width:48px;height:48px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.25);border-radius:14px;text-align:center;font-size:26px;line-height:48px;">🦷</div>
                  </td>
                  <td style="vertical-align:middle;padding-left:13px;text-align:left;">
                    <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.4px;line-height:1.15;">${BRAND}</div>
                    <div style="font-size:12px;color:#cfe0ff;font-weight:600;letter-spacing:0.2px;margin-top:2px;">${TAGLINE}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Accent divider under header -->
          <tr><td style="height:4px;background:linear-gradient(90deg,#52d6b3,#4f86ff,#7c3aed);font-size:0;line-height:0;">&nbsp;</td></tr>
          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:38px 40px 12px;color:#1f2a44;font-size:15px;line-height:1.65;">
              ${heading ? `<h1 style="margin:0 0 18px;font-size:22px;font-weight:800;color:#0b1f4d;letter-spacing:-0.3px;">${heading}</h1>` : ''}
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer note -->
          <tr>
            <td style="background:#ffffff;padding:24px 40px 30px;">
              <div style="border-top:1px solid #eef3fb;padding-top:20px;color:#64748b;font-size:13px;line-height:1.65;">
                Need a hand? Email <a href="mailto:${SUPPORT}" style="color:${BLUE};text-decoration:none;font-weight:600;">${SUPPORT}</a><br>
                <a href="${SITE}" style="color:#94a3b8;text-decoration:none;">Website</a> &nbsp;·&nbsp; <a href="${APP}" style="color:#94a3b8;text-decoration:none;">Open the app</a> &nbsp;·&nbsp; <a href="${SITE}/#/privacy" style="color:#94a3b8;text-decoration:none;">Privacy</a>
              </div>
            </td>
          </tr>
        </table>
        <!-- Legal (outside card) -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr>
            <td align="center" style="padding:18px 20px 4px;color:#9aa7bd;font-size:12px;line-height:1.6;">
              © ${YEAR} ${BRAND} · Pakistan<br>
              You received this email because you have a ${BRAND} account.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Bulletproof CTA button (bgcolor on the cell so Outlook shows the fill).
function emailButton({ href, label }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px auto;">
    <tr><td align="center" bgcolor="${BLUE}" style="border-radius:12px;box-shadow:0 10px 22px -10px rgba(0,82,255,0.7);">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${label}</a>
    </td></tr>
  </table>`;
}

// Highlighted code / value box (e.g. temporary password, OTP).
function emailCode(value) {
  return `<div style="text-align:center;margin:22px 0;">
    <span style="display:inline-block;font-size:24px;font-weight:800;letter-spacing:3px;color:${BLUE};background:#eff6ff;border:1px solid #d5e5ff;padding:15px 28px;border-radius:14px;font-family:'Courier New',Courier,monospace;">${value}</span>
  </div>`;
}

// Info / status panel. tone: 'success' | 'info' | 'warn'
function emailPanel(html, tone = 'info') {
  const t = {
    success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
    info: { bg: '#eff6ff', border: '#d5e5ff', color: '#1d4ed8' },
    warn: { bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
  }[tone] || { bg: '#eff6ff', border: '#d5e5ff', color: '#1d4ed8' };
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 18px;">
    <tr><td style="background:${t.bg};border:1px solid ${t.border};border-radius:12px;padding:14px 16px;color:${t.color};font-size:14px;font-weight:600;line-height:1.5;">${html}</td></tr>
  </table>`;
}

// Thin divider.
function emailDivider() {
  return `<div style="height:1px;background:#eef3fb;margin:22px 0;font-size:0;line-height:0;">&nbsp;</div>`;
}

module.exports = { renderEmail, emailButton, emailCode, emailPanel, emailDivider };
