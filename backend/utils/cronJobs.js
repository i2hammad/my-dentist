// Scheduled maintenance jobs, triggered by external cron via /api/cron/* .
const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const emails = require('./emails');
const { buildBackup } = require('./backup');

const ACTIVE = ['pending', 'confirmed', 'rescheduled'];

// ── Appointment reminders — email patients whose appointment is TOMORROW ─────
// Idempotent: a "reminder" Notification per appointment acts as the sent-marker,
// so re-running the cron never double-sends.
async function runAppointmentReminders() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const appts = await prisma.appointment.findMany({
    where: { date: { gte: start, lte: end }, status: { in: ACTIVE } },
    include: { patient: { select: { userId: true, fullName: true } }, doctor: { select: { fullName: true } } },
  });

  let reminded = 0;
  for (const a of appts) {
    if (!a.patient?.userId) continue;
    const already = await prisma.notification.findFirst({ where: { relatedId: a.id, type: 'reminder' } });
    if (already) continue;

    await prisma.notification.create({
      data: {
        userId: a.patient.userId,
        type: 'reminder',
        title: 'Appointment Reminder',
        message: `Reminder: your ${a.treatmentType} appointment is tomorrow at ${a.time}.`,
        relatedId: a.id,
      },
    }).catch(() => {});

    await emails.sendAppointmentReminderEmail({
      userId: a.patient.userId, treatment: a.treatmentType, doctorName: a.doctor?.fullName, date: a.date, time: a.time,
    });
    reminded += 1;
  }
  return { candidates: appts.length, reminded };
}

// ── Auto-backup — write a rotated JSON snapshot to backend/backups/ ──────────
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const KEEP = 14; // keep the most recent N snapshots

async function runAutoBackup() {
  const { payload, total } = await buildBackup();
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const file = `mydentist-backup-${stamp}.json`;
  await fs.promises.writeFile(path.join(BACKUP_DIR, file), payload);

  // Rotate — delete the oldest beyond KEEP.
  const all = (await fs.promises.readdir(BACKUP_DIR))
    .filter((f) => f.startsWith('mydentist-backup-') && f.endsWith('.json'))
    .sort();
  const excess = all.slice(0, Math.max(0, all.length - KEEP));
  for (const f of excess) await fs.promises.unlink(path.join(BACKUP_DIR, f)).catch(() => {});

  return { file, records: total, kept: Math.min(all.length, KEEP) };
}

module.exports = { runAppointmentReminders, runAutoBackup, BACKUP_DIR };
