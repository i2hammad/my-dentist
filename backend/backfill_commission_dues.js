/**
 * One-time batch: reconcile platform-commission dues for ALL doctors.
 *
 * Bills paid BEFORE automatic accrual shipped have commissionAccrued = 0, so
 * their commission was never added to the doctor's dues. This script does, for
 * every doctor, exactly what the admin "↻ Sync from Bills" does — but in bulk:
 *   1. Backfill each paid bill's `commissionAccrued` to its target (rate% of collected).
 *   2. Set commissionDue = max(0, Σ accrued − commissionPaid).
 *
 * It reuses utils/commission (same rate + target math) so it can never drift
 * from the live accrual/sync logic. It is a full reconcile → idempotent: running
 * it again changes nothing.
 *
 * Usage (from backend/):
 *   node backfill_commission_dues.js            # DRY RUN — prints what would change
 *   node backfill_commission_dues.js --apply    # persist dues + per-bill accrual
 *   node backfill_commission_dues.js --apply --block   # also auto-block doctors at/over the threshold
 *
 * By default it does NOT block anyone (mass-blocking is disruptive); pass --block
 * to apply the same >= PKR 50,000 auto-block rule the panel uses.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const DoctorProfile = require('./models/DoctorProfile');
const Bill = require('./models/Bill');
const CommissionLog = require('./models/CommissionLog');
const { targetCommission, getCommissionRate, COMMISSION_BLOCK_THRESHOLD } = require('./utils/commission');

const APPLY = process.argv.includes('--apply');
const BLOCK = process.argv.includes('--block');
const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI;
const money = (n) => 'PKR ' + Math.round(n || 0).toLocaleString();

async function main() {
  if (!MONGO) {
    console.error('❌ No Mongo connection string in env (MONGODB_URI / MONGO_URI).');
    process.exit(1);
  }
  await mongoose.connect(MONGO);
  const rate = await getCommissionRate();
  console.log(`✅ Connected. Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN'}${BLOCK ? ' +BLOCK' : ''} · commission rate ${rate}%\n`);

  const doctors = await DoctorProfile.find().select('fullName commissionDue commissionPaid isBlocked blockReason').lean();

  let totalDelta = 0, changedDoctors = 0, changedBills = 0, wouldBlock = 0;

  for (const doc of doctors) {
    const bills = await Bill.find({ doctorId: doc._id })
      .select('status paidAmount finalAmount amount commissionAccrued')
      .lean();

    let earned = 0;
    const ops = [];
    for (const b of bills) {
      const target = targetCommission(b, rate);
      earned += target;
      if ((b.commissionAccrued || 0) !== target) {
        ops.push({ updateOne: { filter: { _id: b._id }, update: { $set: { commissionAccrued: target } } } });
      }
    }

    const owed = Math.max(0, earned - (doc.commissionPaid || 0));
    const currentDue = doc.commissionDue || 0;
    const dueChanged = owed !== currentDue;
    const blockNow = BLOCK && owed >= COMMISSION_BLOCK_THRESHOLD && !doc.isBlocked;

    if (!ops.length && !dueChanged && !blockNow) continue; // already reconciled

    changedDoctors++;
    changedBills += ops.length;
    totalDelta += owed - currentDue;
    if (blockNow) wouldBlock++;

    console.log(
      `• ${doc.fullName || doc._id}: dues ${money(currentDue)} → ${money(owed)} ` +
      `(earned ${money(earned)} − paid ${money(doc.commissionPaid || 0)})` +
      `${ops.length ? ` · ${ops.length} bill(s) stamped` : ''}` +
      `${blockNow ? ' · WILL BLOCK' : ''}`
    );

    if (!APPLY) continue;

    if (ops.length) await Bill.bulkWrite(ops);

    const set = { commissionDue: owed };
    if (blockNow) {
      set.isBlocked = true;
      set.blockReason = `Your account is blocked because outstanding platform fee dues of ${money(owed)} exceeded the ${money(COMMISSION_BLOCK_THRESHOLD)} limit. Please clear the dues and share payment proof with My Dentist support to restore access.`;
    }
    await DoctorProfile.updateOne({ _id: doc._id }, { $set: set });

    try {
      await CommissionLog.create({
        doctorId: doc._id, doctorName: doc.fullName || '',
        type: 'sync', amount: owed, balanceAfter: owed,
        note: `Backfill: ${rate}% across ${bills.length} bill(s) − ${money(doc.commissionPaid || 0)} paid`,
        actorName: 'System (backfill)',
      });
    } catch (_) { /* logging must not break the backfill */ }
  }

  console.log(
    `\n${changedDoctors} doctor(s) reconciled` +
    `${changedBills ? `, ${changedBills} bill(s) stamped` : ''}` +
    `${BLOCK ? `, ${wouldBlock} would block` : ''}. ` +
    `Net dues change ${totalDelta >= 0 ? '+' : ''}${money(totalDelta)}.`
  );
  if (!APPLY) console.log('\nDRY RUN — nothing written. Re-run with --apply to persist.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => { console.error('❌ Backfill failed:', err); process.exit(1); });
