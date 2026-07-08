const prisma = require('../config/prisma');

// Default fallback if settings are unavailable. The live value is admin-managed
// (AppSettings.commissionBlockThreshold).
const COMMISSION_BLOCK_THRESHOLD = 50000;

// Rate (%) + auto-block dues threshold (PKR), both admin-managed.
async function getCommissionConfig() {
  const s = await prisma.appSettings.findUnique({ where: { key: 'global' }, select: { commissionRate: true, commissionBlockThreshold: true } });
  return {
    rate: s?.commissionRate ?? 10,
    threshold: s?.commissionBlockThreshold ?? COMMISSION_BLOCK_THRESHOLD,
  };
}

async function getCommissionRate() {
  return (await getCommissionConfig()).rate;
}

// What commission a bill SHOULD have accrued given its current state.
function targetCommission(bill, rate) {
  if (!bill || bill.status !== 'paid') return 0;
  const collected = bill.paidAmount || bill.finalAmount || bill.amount || 0;
  return Math.round(collected * (rate / 100));
}

/**
 * Reconcile ONE bill's platform commission against its doctor's outstanding dues.
 * Idempotent + reversible + atomic (optimistic compare-and-set on the bill, then
 * an atomic increment on the doctor's dues).
 */
async function reconcileBillCommission(billId, opts = {}) {
  const { autoBlock = true, actorName = 'System' } = opts;
  const { rate, threshold } = await getCommissionConfig();

  for (let attempt = 0; attempt < 4; attempt++) {
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      select: { id: true, status: true, paidAmount: true, finalAmount: true, amount: true, doctorId: true, commissionAccrued: true },
    });
    if (!bill || !bill.doctorId) return;

    const prevAccrued = bill.commissionAccrued || 0;
    const target = targetCommission(bill, rate);
    const delta = target - prevAccrued;
    if (delta === 0) return;

    // Compare-and-set: stamp the new accrual only if nobody changed it since we read.
    const cas = await prisma.bill.updateMany({
      where: { id: bill.id, commissionAccrued: prevAccrued },
      data: { commissionAccrued: target },
    });
    if (cas.count === 0) continue; // lost the race — re-read and retry

    // Move the doctor's dues by exactly this delta (atomic).
    const doc = await prisma.doctorProfile.update({
      where: { id: bill.doctorId },
      data: { commissionDue: { increment: delta } },
      select: { commissionDue: true, isBlocked: true, blockReason: true, fullName: true },
    }).catch(() => null);
    if (!doc) return;

    // Floor dues at 0 (e.g. reversing a bill whose commission was already cleared).
    if ((doc.commissionDue || 0) < 0) {
      await prisma.doctorProfile.updateMany({ where: { id: bill.doctorId, commissionDue: { lt: 0 } }, data: { commissionDue: 0 } });
      doc.commissionDue = 0;
    }

    // Auto-block once dues cross the threshold.
    if (autoBlock && delta > 0 && (doc.commissionDue || 0) >= threshold && !doc.isBlocked) {
      await prisma.doctorProfile.updateMany({
        where: { id: bill.doctorId, isBlocked: false },
        data: { isBlocked: true, blockReason: `Outstanding commission dues of PKR ${(doc.commissionDue || 0).toLocaleString()}. Clear dues and contact admin to unblock.` },
      });
    }

    try {
      await prisma.commissionLog.create({
        data: {
          doctorId: bill.doctorId,
          doctorName: doc.fullName || '',
          type: delta > 0 ? 'accrue' : 'reverse',
          amount: Math.abs(delta),
          balanceAfter: doc.commissionDue || 0,
          note: `Auto ${delta > 0 ? 'accrued' : 'reversed'} ${rate}% platform fee on bill ${bill.id}`,
          actorName,
        },
      });
    } catch (_) { /* logging must not break billing */ }

    return;
  }
}

module.exports = { reconcileBillCommission, targetCommission, getCommissionRate, getCommissionConfig, COMMISSION_BLOCK_THRESHOLD };
