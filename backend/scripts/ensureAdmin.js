// Create the initial super-admin if none exists — driven by env vars so the
// first deploy needs no shell. Set ADMIN_EMAIL and ADMIN_PASSWORD in the cPanel
// Node.js App environment. Safe to run on every boot: it's a no-op once a
// super-admin exists. Remove/rotate the env vars after the account is created.
const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

module.exports = async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) {
    console.error('[ensureAdmin] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping');
    return;
  }

  const existing = await prisma.adminProfile.findFirst({ where: { adminRole: 'super_admin' } });
  if (existing) {
    console.error('[ensureAdmin] super-admin already exists ✓');
    return;
  }

  // Don't collide with an existing user row on the same email.
  const dupe = await prisma.user.findUnique({ where: { email } });
  if (dupe) {
    console.error(`[ensureAdmin] a user with ${email} already exists — not creating admin`);
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, password: hash, role: 'admin' } });
  await prisma.adminProfile.create({
    data: { userId: user.id, fullName: 'Super Admin', adminRole: 'super_admin' },
  });
  console.error(`[ensureAdmin] super-admin created: ${email}`);
};
