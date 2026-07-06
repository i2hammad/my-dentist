const Bill = require('../models/Bill');
const DoctorProfile = require('../models/DoctorProfile');
const AppSettings = require('../models/AppSettings');
const CommissionLog = require('../models/CommissionLog');

// Doctors are auto-blocked once their outstanding platform-fee dues reach this.
const COMMISSION_BLOCK_THRESHOLD = 50000;

async function getCommissionRate() {
  const s = await AppSettings.findOne({ key: 'global' }).select('commissionRate').lean();
  return s?.commissionRate ?? 10;
}

// What commission a bill SHOULD have accrued given its current state.
function targetCommission(bill, rate) {
  if (!bill || bill.status !== 'paid') return 0;
  const collected = bill.paidAmount || bill.finalAmount || bill.amount || 0;
  return Math.round(collected * (rate / 100));
}

/**
 * Reconcile ONE bill's platform commission against its doctor's outstanding dues.
 *
 * Safe to call after any create / edit / pay / unpay: it applies only the DELTA
 * between what the bill should have accrued (rate% of collected) and what it has
 * already accrued (`bill.commissionAccrued`). So it is:
 *   - idempotent  — re-saving a paid bill unchanged is a no-op (delta 0)
 *   - reversible  — un-paying a bill or lowering its amount removes commission
 *   - atomic      — an optimistic compare-and-set on the bill guards the delta,
 *                   and the doctor's dues move via an atomic `$inc`
 *
 * @param {ObjectId|string} billId
 * @param {{ autoBlock?: boolean, actorName?: string }} [opts]
 */
async function reconcileBillCommission(billId, opts = {}) {
  const { autoBlock = true, actorName = 'System' } = opts;
  const rate = await getCommissionRate();

  // Retry a few times: the optimistic set below only succeeds if the bill's
  // accrued value hasn't been changed by a concurrent reconcile in between.
  for (let attempt = 0; attempt < 4; attempt++) {
    const bill = await Bill.findById(billId)
      .select('status paidAmount finalAmount amount doctorId commissionAccrued')
      .lean();
    if (!bill || !bill.doctorId) return;

    const prevAccrued = bill.commissionAccrued || 0;
    const target = targetCommission(bill, rate);
    const delta = target - prevAccrued;
    if (delta === 0) return;

    // Compare-and-set: only stamp the new accrual if nobody else changed it since
    // we read it. If they did, `modifiedCount` is 0 and we retry with fresh state.
    const cas = await Bill.updateOne(
      { _id: bill._id, commissionAccrued: prevAccrued },
      { $set: { commissionAccrued: target } }
    );
    if (cas.modifiedCount === 0) continue; // lost the race — re-read and retry

    // Move the doctor's dues by exactly this delta (atomic).
    const doc = await DoctorProfile.findByIdAndUpdate(
      bill.doctorId,
      { $inc: { commissionDue: delta } },
      { new: true }
    ).select('commissionDue isBlocked blockReason fullName');
    if (!doc) return;

    // Guard against negative dues (e.g. reversing a bill whose commission was
    // already cleared by an admin). Floor at 0 without clobbering concurrent incs.
    if ((doc.commissionDue || 0) < 0) {
      await DoctorProfile.updateOne(
        { _id: bill.doctorId, commissionDue: { $lt: 0 } },
        { $set: { commissionDue: 0 } }
      );
      doc.commissionDue = 0;
    }

    // Auto-block once dues cross the threshold (mirrors admin "Add Dues").
    if (autoBlock && delta > 0 && (doc.commissionDue || 0) >= COMMISSION_BLOCK_THRESHOLD && !doc.isBlocked) {
      await DoctorProfile.updateOne(
        { _id: bill.doctorId, isBlocked: { $ne: true } },
        { $set: { isBlocked: true, blockReason: `Outstanding commission dues of PKR ${(doc.commissionDue || 0).toLocaleString()}. Clear dues and contact admin to unblock.` } }
      );
    }

    // Best-effort ledger entry (never breaks the request flow).
    try {
      await CommissionLog.create({
        doctorId: bill.doctorId,
        doctorName: doc.fullName || '',
        type: delta > 0 ? 'accrue' : 'reverse',
        amount: Math.abs(delta),
        balanceAfter: doc.commissionDue || 0,
        note: `Auto ${delta > 0 ? 'accrued' : 'reversed'} ${rate}% platform fee on bill ${bill._id}`,
        actorName,
      });
    } catch (_) { /* logging must not break billing */ }

    return;
  }
}

module.exports = { reconcileBillCommission, targetCommission, getCommissionRate, COMMISSION_BLOCK_THRESHOLD };
