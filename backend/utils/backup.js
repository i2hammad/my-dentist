// Build a full JSON snapshot of every table. Shared by the admin download
// endpoint and the auto-backup cron.
const prisma = require('../config/prisma');

const BACKUP_MODELS = [
  'user', 'adminProfile', 'doctorProfile', 'patientProfile', 'appointment', 'bill',
  'review', 'reward', 'treatment', 'gallery', 'campaign', 'chatMessage', 'commissionLog',
  'favorite', 'notification', 'paymentMethod', 'scheduledBroadcast', 'auditLog', 'appSettings',
];

async function buildBackup() {
  const data = {};
  for (const m of BACKUP_MODELS) data[m] = await prisma[m].findMany(); // sequential = kind to the pool
  const total = Object.values(data).reduce((n, v) => n + v.length, 0);
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
  const payload = JSON.stringify(
    { app: 'my-dentist', version: 1, exportedAt: new Date().toISOString(), counts, data },
    null,
    2,
  );
  return { payload, counts, total };
}

module.exports = { buildBackup, BACKUP_MODELS };
