const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const { serialize, remapRefs, remapMany } = require('../utils/serialize');
const { recomputePopular } = require('../utils/popular');
const { targetCommission } = require('../utils/commission');
const { DEFAULT_FACILITY_CATEGORIES, DEFAULT_TIER_THRESHOLDS, DEFAULT_PAYMENTS } = require('../utils/appDefaults');

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, code, message) => res.status(code).json({ success: false, message });
const hashPassword = async (plain) => bcrypt.hash(plain, await bcrypt.genSalt(10));
const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
const ci = (v) => ({ contains: v, mode: 'insensitive' });

async function logCommission(req, doc, { type, amount, note = '' }) {
  try {
    await prisma.commissionLog.create({
      data: { doctorId: doc.id, doctorName: doc.fullName || '', type, amount, balanceAfter: doc.commissionDue || 0, note, actorName: req.user?.fullName || req.user?.email || 'Admin' },
    });
  } catch (_) {}
}
async function logAudit(req, { action, entity = '', entityId = '', description = '' }) {
  try {
    await prisma.auditLog.create({
      data: { actorId: req.user?._id || '', actorName: req.user?.fullName || req.user?.email || 'Admin', action, entity, entityId: String(entityId || ''), description },
    });
  } catch (_) {}
}

// Generic paginate → { data (serialized+remapped), total, page, pages }.
async function paginate(model, { where = {}, page = 1, limit = 10, include, orderBy = { createdAt: 'desc' }, refmap } = {}) {
  page = Math.max(1, parseInt(page) || 1);
  limit = Math.max(1, parseInt(limit) || 10);
  const [rows, total] = await Promise.all([
    prisma[model].findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, ...(include ? { include } : {}) }),
    prisma[model].count({ where }),
  ]);
  const data = serialize(refmap ? remapMany(rows, refmap) : rows);
  return { data, total, page, pages: Math.ceil(total / limit) };
}

const USER_SEL = { user: { select: { email: true, role: true, createdAt: true } } };

// ─── Dashboard ──────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const [totalDentists, totalPatients, totalAppointments, paidBills] = await Promise.all([
      prisma.doctorProfile.count(),
      prisma.patientProfile.count(),
      prisma.appointment.count(),
      prisma.bill.findMany({ where: { status: 'paid' }, select: { finalAmount: true, paidAmount: true } }),
    ]);
    const totalEarnings = paidBills.reduce((s, b) => s + (b.paidAmount || b.finalAmount || 0), 0);

    const recent = await prisma.appointment.findMany({
      orderBy: { createdAt: 'desc' }, take: 6,
      include: { patient: { select: { fullName: true, profileImage: true } }, doctor: { select: { fullName: true, photo: true } } },
    });

    const topAgg = await prisma.review.groupBy({
      by: ['doctorId'], where: { hidden: false }, _count: { _all: true }, _avg: { rating: true },
      orderBy: { _count: { doctorId: 'desc' } }, take: 5,
    });
    const topDentists = (await Promise.all(topAgg.map(async (t) => {
      const d = await prisma.doctorProfile.findUnique({ where: { id: t.doctorId }, select: { id: true, fullName: true, photo: true, specialization: true } });
      return d ? { ...d, reviewCount: t._count._all, rating: Math.round((t._avg.rating || 0) * 10) / 10 } : null;
    }))).filter(Boolean);

    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    const apptSeries = await prisma.$queryRaw`SELECT to_char("createdAt", 'YYYY-MM') AS _id, count(*)::int AS count FROM "Appointment" WHERE "createdAt" >= ${sixMonthsAgo} GROUP BY 1 ORDER BY 1`;

    ok(res, {
      stats: { totalDentists, totalPatients, totalAppointments, totalEarnings },
      recentAppointments: serialize(remapMany(recent, { patient: 'patientId', doctor: 'doctorId' })),
      topDentists: serialize(topDentists),
      appointmentSeries: apptSeries,
    });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Admins ─────────────────────────────────────────────────
exports.listAdmins = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    if (search) where.fullName = ci(search);
    const result = await paginate('adminProfile', { where, page, limit, include: USER_SEL, refmap: { user: 'userId' } });
    const counts = {
      total: await prisma.adminProfile.count(),
      active: await prisma.adminProfile.count({ where: { status: 'active' } }),
      inactive: await prisma.adminProfile.count({ where: { status: 'inactive' } }),
      super: await prisma.adminProfile.count({ where: { adminRole: 'super_admin' } }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

exports.updateAdmin = async (req, res) => {
  try {
    const data = {};
    for (const k of ['status', 'permissions', 'fullName', 'adminRole']) if (req.body[k] !== undefined) data[k] = req.body[k];
    const admin = await prisma.adminProfile.update({ where: { id: req.params.id }, data }).catch(() => null);
    if (!admin) return fail(res, 404, 'Admin not found');
    ok(res, serialize(admin));
  } catch (e) { fail(res, 500, e.message); }
};

exports.deleteAdmin = async (req, res) => {
  try {
    const admin = await prisma.adminProfile.findUnique({ where: { id: req.params.id } });
    if (!admin) return fail(res, 404, 'Admin not found');
    if (admin.adminRole === 'super_admin') return fail(res, 400, 'Cannot delete a super admin');
    await prisma.user.delete({ where: { id: admin.userId } }).catch(() => {}); // cascade removes profile
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Dentists ───────────────────────────────────────────────
exports.listDentists = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    const where = {};
    if (search) where.fullName = ci(search);
    if (status === 'verified') where.pmdcVerified = true;
    if (status === 'pending') where.pmdcVerified = false;
    const result = await paginate('doctorProfile', { where, page, limit, include: USER_SEL, refmap: { user: 'userId' } });
    const counts = {
      total: await prisma.doctorProfile.count(),
      verified: await prisma.doctorProfile.count({ where: { pmdcVerified: true } }),
      pending: await prisma.doctorProfile.count({ where: { pmdcVerified: false } }),
      newThisMonth: await prisma.doctorProfile.count({ where: { createdAt: { gte: startOfMonth() } } }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

exports.updateDentist = async (req, res) => {
  try {
    const data = {};
    for (const k of ['pmdcVerified', 'clinicTier', 'fullName', 'specialization', 'approvalStatus', 'isBlocked', 'blockReason']) if (k in req.body) data[k] = req.body[k];
    if (data.approvalStatus === 'approved') data.pmdcVerified = true;

    const before = await prisma.doctorProfile.findUnique({ where: { id: req.params.id }, select: { approvalStatus: true } });
    const doc = await prisma.doctorProfile.update({ where: { id: req.params.id }, data }).catch(() => null);
    if (!doc) return fail(res, 404, 'Dentist not found');

    // Email the doctor only on the transition INTO "approved".
    if (data.approvalStatus === 'approved' && before?.approvalStatus !== 'approved') {
      prisma.user.findUnique({ where: { id: doc.userId }, select: { email: true } })
        .then((u) => { if (u?.email) require('../utils/emails').sendDoctorApprovedEmail({ to: u.email, name: doc.fullName }); })
        .catch(() => {});
    }

    ok(res, serialize(doc));
  } catch (e) { fail(res, 500, e.message); }
};

exports.deleteDentist = async (req, res) => {
  try {
    const doc = await prisma.doctorProfile.findUnique({ where: { id: req.params.id } });
    if (!doc) return fail(res, 404, 'Dentist not found');
    await prisma.user.delete({ where: { id: doc.userId } }).catch(() => {});
    await logAudit(req, { action: 'delete', entity: 'dentist', entityId: doc.id, description: `Deleted dentist "${doc.fullName}"` });
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Patients ───────────────────────────────────────────────
exports.listPatients = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const where = {};
    if (search) where.fullName = ci(search);
    const result = await paginate('patientProfile', { where, page, limit, include: USER_SEL, refmap: { user: 'userId' } });
    const counts = {
      total: await prisma.patientProfile.count(),
      active: await prisma.patientProfile.count({ where: { isBlocked: false } }),
      inactive: await prisma.patientProfile.count({ where: { isBlocked: true } }),
      newThisMonth: await prisma.patientProfile.count({ where: { createdAt: { gte: startOfMonth() } } }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

exports.deletePatient = async (req, res) => {
  try {
    const p = await prisma.patientProfile.findUnique({ where: { id: req.params.id } });
    if (!p) return fail(res, 404, 'Patient not found');
    await prisma.user.delete({ where: { id: p.userId } }).catch(() => {});
    await logAudit(req, { action: 'delete', entity: 'patient', entityId: p.id, description: `Deleted patient "${p.fullName}"` });
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Treatments ─────────────────────────────────────────────
exports.listTreatments = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const where = {};
    if (search) where.name = ci(search);
    const result = await paginate('treatment', { where, page, limit, include: { doctor: { select: { fullName: true } } }, refmap: { doctor: 'doctorId' } });
    const counts = {
      total: await prisma.treatment.count(),
      active: await prisma.treatment.count({ where: { isActive: true } }),
      inactive: await prisma.treatment.count({ where: { isActive: false } }),
      newThisMonth: await prisma.treatment.count({ where: { createdAt: { gte: startOfMonth() } } }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

exports.deleteTreatment = async (req, res) => {
  try {
    const t = await prisma.treatment.findUnique({ where: { id: req.params.id } });
    if (!t) return fail(res, 404, 'Treatment not found');
    await prisma.treatment.delete({ where: { id: t.id } });
    await logAudit(req, { action: 'delete', entity: 'treatment', entityId: t.id, description: `Deleted treatment "${t.name}"` });
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Gallery ────────────────────────────────────────────────
exports.listGallery = async (req, res) => {
  try {
    const { page, limit, category } = req.query;
    const where = {};
    if (category && category !== 'all') where.category = category;
    const result = await paginate('gallery', { where, page, limit, include: { doctor: { select: { fullName: true } } }, refmap: { doctor: 'doctorId' } });
    const counts = { total: await prisma.gallery.count(), newThisMonth: await prisma.gallery.count({ where: { createdAt: { gte: startOfMonth() } } }) };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

exports.deleteGallery = async (req, res) => {
  try {
    const g = await prisma.gallery.delete({ where: { id: req.params.id } }).catch(() => null);
    if (!g) return fail(res, 404, 'Gallery item not found');
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Reviews ────────────────────────────────────────────────
exports.listReviews = async (req, res) => {
  try {
    const { page, limit, rating } = req.query;
    const where = {};
    if (rating && rating !== 'all') where.rating = parseInt(rating, 10);
    const result = await paginate('review', {
      where, page, limit,
      include: { patient: { select: { fullName: true, profileImage: true } }, doctor: { select: { fullName: true, photo: true } } },
      refmap: { patient: 'patientId', doctor: 'doctorId' },
    });
    const avg = await prisma.review.aggregate({ where: { hidden: false }, _avg: { rating: true } });
    const counts = {
      total: await prisma.review.count(),
      verified: await prisma.review.count({ where: { isVerifiedPatient: true } }),
      avgRating: avg._avg.rating ? Math.round(avg._avg.rating * 10) / 10 : 0,
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

exports.deleteReview = async (req, res) => {
  try {
    const r = await prisma.review.delete({ where: { id: req.params.id } }).catch(() => null);
    if (!r) return fail(res, 404, 'Review not found');
    await logAudit(req, { action: 'delete', entity: 'review', entityId: r.id, description: 'Deleted a review' });
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Appointments ───────────────────────────────────────────
exports.listAppointments = async (req, res) => {
  try {
    const { page, limit, status } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    const result = await paginate('appointment', {
      where, page, limit,
      include: { patient: { select: { fullName: true, profileImage: true } }, doctor: { select: { fullName: true, photo: true } } },
      refmap: { patient: 'patientId', doctor: 'doctorId' },
    });
    const apptIds = result.data.map((a) => a._id);
    if (apptIds.length) {
      const bills = await prisma.bill.findMany({ where: { appointmentId: { in: apptIds } }, select: { appointmentId: true, invoiceNumber: true, status: true, amount: true, finalAmount: true, paidAmount: true } });
      const byAppt = {};
      bills.forEach((b) => { byAppt[b.appointmentId] = serialize(b); });
      result.data.forEach((a) => { a.bill = byAppt[a._id] || null; });
    }
    const counts = {
      total: await prisma.appointment.count(),
      completed: await prisma.appointment.count({ where: { status: 'completed' } }),
      upcoming: await prisma.appointment.count({ where: { status: { in: ['pending', 'confirmed'] } } }),
      cancelled: await prisma.appointment.count({ where: { status: 'cancelled' } }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Bills ──────────────────────────────────────────────────
exports.listBills = async (req, res) => {
  try {
    const { page, limit, status, search, from, to } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    if (search) where.OR = [{ invoiceNumber: ci(search) }, { treatmentName: ci(search) }];
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); where.createdAt.lte = end; }
    }
    const result = await paginate('bill', {
      where, page, limit,
      include: { patient: { select: { fullName: true, profileImage: true } }, doctor: { select: { fullName: true, photo: true } } },
      refmap: { patient: 'patientId', doctor: 'doctorId' },
    });
    const filtered = await prisma.bill.findMany({ where, select: { finalAmount: true, paidAmount: true, status: true } });
    const collected = filtered.reduce((s, b) => s + (b.paidAmount || (b.status === 'paid' ? b.finalAmount : 0) || 0), 0);
    const billed = filtered.reduce((s, b) => s + (b.finalAmount || 0), 0);
    const counts = {
      total: result.total,
      paid: filtered.filter((b) => b.status === 'paid').length,
      pending: filtered.filter((b) => b.status !== 'paid').length,
      totalAmount: billed, collected, outstanding: Math.max(0, billed - collected),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Rewards ────────────────────────────────────────────────
exports.listRewards = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await paginate('reward', { where: {}, page, limit, include: { patient: { select: { fullName: true, profileImage: true } } }, refmap: { patient: 'patientId' } });
    const totalAgg = await prisma.reward.aggregate({ _sum: { points: true } });
    const counts = {
      members: await prisma.patientProfile.count(),
      totalPoints: totalAgg._sum.points || 0,
      transactions: await prisma.reward.count(),
      redeemed: await prisma.reward.count({ where: { isRedeemed: true } }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Create: Admin / Dentist / Patient ──────────────────────
exports.createAdmin = async (req, res) => {
  try {
    const { email, password, fullName, adminRole, permissions } = req.body;
    if (!email || !password || !fullName) return fail(res, 400, 'Email, password and full name are required');
    if (await prisma.user.findUnique({ where: { email: email.toLowerCase() } })) return fail(res, 400, 'Email already in use');
    const user = await prisma.user.create({ data: { email: email.toLowerCase(), password: await hashPassword(password), role: 'admin', isAgreed: true } });
    const profile = await prisma.adminProfile.create({
      data: { userId: user.id, fullName, adminRole: adminRole === 'super_admin' ? 'super_admin' : 'admin', ...(permissions ? { permissions } : {}) },
    });
    ok(res, serialize(profile));
  } catch (e) { fail(res, 500, e.message); }
};

exports.createDentist = async (req, res) => {
  try {
    const { email, password, fullName, specialization, city, phone, consultationFee } = req.body;
    if (!email || !password || !fullName) return fail(res, 400, 'Email, password and full name are required');
    if (await prisma.user.findUnique({ where: { email: email.toLowerCase() } })) return fail(res, 400, 'Email already in use');
    const user = await prisma.user.create({ data: { email: email.toLowerCase(), password: await hashPassword(password), role: 'doctor', isAgreed: true } });
    const profile = await prisma.doctorProfile.create({
      data: { userId: user.id, fullName, specialization: specialization || 'General', city: city || '', phone: phone || '', consultationFee: consultationFee || 1500 },
    });
    ok(res, serialize(profile));
  } catch (e) { fail(res, 500, e.message); }
};

exports.createPatient = async (req, res) => {
  try {
    const { email, password, fullName, mobileNumber, gender, city } = req.body;
    if (!email || !password || !fullName) return fail(res, 400, 'Email, password and full name are required');
    if (await prisma.user.findUnique({ where: { email: email.toLowerCase() } })) return fail(res, 400, 'Email already in use');
    const user = await prisma.user.create({ data: { email: email.toLowerCase(), password: await hashPassword(password), role: 'patient', isAgreed: true } });
    const profile = await prisma.patientProfile.create({
      data: { userId: user.id, fullName, mobileNumber: mobileNumber || '', gender: gender || null, city: city || '' },
    });
    ok(res, serialize(profile));
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Create / Update: Treatment ─────────────────────────────
exports.createTreatment = async (req, res) => {
  try {
    const { doctorId, name, priceMin, priceMax, isActive } = req.body;
    if (!doctorId || !name) return fail(res, 400, 'Dentist and treatment name are required');
    const t = await prisma.treatment.create({ data: { doctorId, name, priceMin: priceMin || 0, priceMax: priceMax || 0, isActive: isActive !== false } });
    ok(res, serialize(t));
  } catch (e) { fail(res, 500, e.message); }
};

exports.updateTreatment = async (req, res) => {
  try {
    const data = {};
    for (const k of ['name', 'priceMin', 'priceMax', 'isActive']) if (k in req.body) data[k] = req.body[k];
    const t = await prisma.treatment.update({ where: { id: req.params.id }, data }).catch(() => null);
    if (!t) return fail(res, 404, 'Treatment not found');
    ok(res, serialize(t));
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Detail views ───────────────────────────────────────────
exports.getDentist = async (req, res) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: req.params.id }, include: { user: { select: { id: true, email: true, role: true, createdAt: true } } } });
    if (!doctor) return fail(res, 404, 'Dentist not found');
    const [treatments, reviews, appointments, gallery, bills, commissionLog, ratingAgg, settings] = await Promise.all([
      prisma.treatment.findMany({ where: { doctorId: doctor.id } }),
      prisma.review.findMany({ where: { doctorId: doctor.id }, include: { patient: { select: { fullName: true, profileImage: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.appointment.findMany({ where: { doctorId: doctor.id }, include: { patient: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.gallery.findMany({ where: { doctorId: doctor.id } }),
      prisma.bill.findMany({ where: { doctorId: doctor.id }, include: { patient: { select: { fullName: true, profileImage: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.commissionLog.findMany({ where: { doctorId: doctor.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.review.aggregate({ where: { doctorId: doctor.id, hidden: false }, _avg: { rating: true }, _count: { _all: true } }),
      getOrCreateSettings(),
    ]);

    const collected = bills.reduce((s, b) => s + (b.paidAmount || (b.status === 'paid' ? b.finalAmount : 0) || 0), 0);
    const billed = bills.reduce((s, b) => s + (b.finalAmount || 0), 0);
    const commissionRate = settings.commissionRate ?? 10;
    const earnings = {
      totalEarned: collected, totalBilled: billed, outstanding: Math.max(0, billed - collected),
      paidCount: bills.filter((b) => b.status === 'paid').length, billCount: bills.length,
      commissionRate, commissionEarned: Math.round(collected * (commissionRate / 100)),
      commissionDue: doctor.commissionDue || 0, commissionPaid: doctor.commissionPaid || 0,
    };
    const billsWithCommission = bills.slice(0, 20).map((b) => {
      const paid = b.paidAmount || (b.status === 'paid' ? b.finalAmount : 0) || 0;
      return { ...b, commission: Math.round(paid * (commissionRate / 100)) };
    });

    ok(res, {
      doctor: serialize(remapRefs(doctor, { user: 'userId' })),
      treatments: serialize(treatments),
      reviews: serialize(remapMany(reviews, { patient: 'patientId' })),
      appointments: serialize(remapMany(appointments, { patient: 'patientId' })),
      gallery: serialize(gallery),
      bills: serialize(remapMany(billsWithCommission, { patient: 'patientId' })),
      earnings,
      commissionLog: serialize(commissionLog),
      rating: ratingAgg._count._all ? Math.round((ratingAgg._avg.rating || 0) * 10) / 10 : 0,
      reviewCount: ratingAgg._count._all || 0,
    });
  } catch (e) { fail(res, 500, e.message); }
};

exports.getPatient = async (req, res) => {
  try {
    const patient = await prisma.patientProfile.findUnique({ where: { id: req.params.id }, include: { user: { select: { id: true, email: true, role: true, createdAt: true } } } });
    if (!patient) return fail(res, 404, 'Patient not found');
    const [appointments, bills, rewards] = await Promise.all([
      prisma.appointment.findMany({ where: { patientId: patient.id }, include: { doctor: { select: { fullName: true, photo: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.bill.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.reward.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    const points = rewards.reduce((s, r) => s + (r.points || 0), 0);
    ok(res, {
      patient: serialize(remapRefs(patient, { user: 'userId' })),
      appointments: serialize(remapMany(appointments, { doctor: 'doctorId' })),
      bills: serialize(bills),
      rewards: serialize(rewards),
      points,
    });
  } catch (e) { fail(res, 500, e.message); }
};

exports.givePatientPoints = async (req, res) => {
  try {
    const patient = await prisma.patientProfile.findUnique({ where: { id: req.params.id } });
    if (!patient) return fail(res, 404, 'Patient not found');

    const pts = parseInt(req.body.addPoints ?? req.body.points, 10);
    if (isNaN(pts) || pts === 0) return fail(res, 400, 'Provide a non-zero number of points');

    if (pts < 0) {
      const agg = await prisma.reward.aggregate({ where: { patientId: patient.id, isRedeemed: false }, _sum: { points: true } });
      const balance = agg._sum.points || 0;
      if (balance + pts < 0) return fail(res, 400, `Cannot deduct ${Math.abs(pts)} pts — patient only has ${balance} pts.`);
    }

    const note = (req.body.note || '').trim();
    const reward = await prisma.reward.create({
      data: { patientId: patient.id, type: 'admin', points: pts, isRedeemed: false, description: note || (pts > 0 ? 'Points granted by admin' : 'Points deducted by admin') },
    });
    await logAudit(req, { action: 'update', entity: 'patient', entityId: patient.id, description: `${pts > 0 ? 'Granted' : 'Deducted'} ${Math.abs(pts)} pts ${pts > 0 ? 'to' : 'from'} "${patient.fullName}"` });
    ok(res, serialize(reward));
  } catch (e) { fail(res, 500, e.message); }
};

// ─── My profile / account ───────────────────────────────────
exports.updateMyProfile = async (req, res) => {
  try {
    const data = {};
    if (req.body.fullName) data.fullName = req.body.fullName;
    if (req.body.profileImage !== undefined) data.profileImage = req.body.profileImage;
    const profile = await prisma.adminProfile.update({ where: { userId: req.user._id }, data }).catch(() => null);
    if (!profile) return fail(res, 404, 'Admin profile not found');
    ok(res, serialize(profile));
  } catch (e) { fail(res, 500, e.message); }
};

exports.changeMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return fail(res, 400, 'Current and new password are required');
    if (newPassword.length < 6) return fail(res, 400, 'New password must be at least 6 characters');
    const user = await prisma.user.findUnique({ where: { id: req.user._id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) return fail(res, 400, 'Current password is incorrect');
    await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(newPassword) } });
    // Best-effort security notification.
    require('../utils/emails').sendPasswordChangedEmail({ to: user.email });
    ok(res, { changed: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Data backup (full JSON export) ─────────────────────────
// Super-admin only. Streams every table as a downloadable JSON file — works on
// shared hosting without pg_dump/shell. NOTE: includes password hashes so a
// restore can preserve logins; keep the file secure.
exports.backupData = async (req, res) => {
  try {
    const me = await prisma.adminProfile.findUnique({ where: { userId: req.user._id } });
    if (me?.adminRole !== 'super_admin') return fail(res, 403, 'Only super admins can export a backup');

    const { payload, total } = await require('../utils/backup').buildBackup();
    await logAudit(req, { action: 'export', entity: 'backup', description: `Exported full data backup (${total} records)` });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="mydentist-backup-${stamp}.json"`);
    return res.send(payload);
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Image backup (uploaded files as .tar.gz) ───────────────
// Super-admin only. Streams the on-disk uploads folder as a gzipped tarball via
// the system `tar` (no npm dependency, memory-friendly for large folders).
exports.backupImages = async (req, res) => {
  try {
    const me = await prisma.adminProfile.findUnique({ where: { userId: req.user._id } });
    if (me?.adminRole !== 'super_admin') return fail(res, 403, 'Only super admins can export a backup');

    const path = require('path');
    const fs = require('fs');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir) || fs.readdirSync(uploadsDir).length === 0) {
      return fail(res, 404, 'No uploaded images to back up yet.');
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="mydentist-images-${stamp}.tar.gz"`);

    const { spawn } = require('child_process');
    const tar = spawn('tar', ['-czf', '-', '-C', uploadsDir, '.']);
    tar.stdout.pipe(res);
    tar.stderr.on('data', (d) => console.error('[backup-images] tar:', d.toString()));
    tar.on('error', (e) => {
      if (!res.headersSent) fail(res, 500, `Could not create archive (tar unavailable): ${e.message}`);
      else res.end();
    });
    logAudit(req, { action: 'export', entity: 'backup', description: 'Exported uploaded images archive' }).catch(() => {});
  } catch (e) { if (!res.headersSent) fail(res, 500, e.message); }
};

// ─── Data restore (import a backup JSON) ────────────────────
// Super-admin only. SAFE by design: it UPSERTS each record by id in FK-dependency
// order (parents first) — it recreates missing rows and updates matching ones,
// but NEVER deletes, so it can't wipe the DB. Records added after the backup are
// left untouched. Each row is attempted independently; failures are counted, not
// fatal.
exports.restoreData = async (req, res) => {
  try {
    const me = await prisma.adminProfile.findUnique({ where: { userId: req.user._id } });
    if (me?.adminRole !== 'super_admin') return fail(res, 403, 'Only super admins can restore a backup');

    if (req.body?.app && req.body.app !== 'my-dentist') return fail(res, 400, 'This file is not a My Dentist backup.');
    const data = req.body?.data;
    if (!data || typeof data !== 'object') return fail(res, 400, 'Invalid backup file — missing "data".');

    // Parents before children so foreign keys resolve during upsert.
    const ORDER = [
      'user', 'adminProfile', 'doctorProfile', 'patientProfile', 'treatment', 'gallery',
      'campaign', 'scheduledBroadcast', 'appSettings', 'paymentMethod', 'appointment', 'bill',
      'review', 'reward', 'favorite', 'commissionLog', 'chatMessage', 'notification', 'auditLog',
    ];

    const summary = {};
    let totalOk = 0, totalFail = 0;
    for (const m of ORDER) {
      const rows = Array.isArray(data[m]) ? data[m] : [];
      let restored = 0, failed = 0;
      for (const row of rows) {
        if (!row || !row.id) { failed++; continue; }
        try {
          await prisma[m].upsert({ where: { id: row.id }, create: row, update: row });
          restored++;
        } catch (_) { failed++; }
      }
      if (rows.length) summary[m] = { restored, failed };
      totalOk += restored; totalFail += failed;
    }

    await logAudit(req, { action: 'import', entity: 'backup', description: `Restored backup — ${totalOk} records (${totalFail} failed)` });
    ok(res, { restored: totalOk, failed: totalFail, summary });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Image restore (extract an images .tar.gz into uploads/) ─
// Super-admin only. Merges the archive into the uploads folder (overwrites files
// with the same path; doesn't delete others) — mirrors the DB upsert restore.
exports.restoreImages = async (req, res) => {
  try {
    const me = await prisma.adminProfile.findUnique({ where: { userId: req.user._id } });
    if (me?.adminRole !== 'super_admin') return fail(res, 403, 'Only super admins can restore a backup');
    if (!req.file) return fail(res, 400, 'Please upload the images .tar.gz file (field "archive")');

    const path = require('path');
    const fs = require('fs');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const tmp = req.file.path; // multer wrote the upload to a temp file
    await new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const tar = spawn('tar', ['-xzf', tmp, '-C', uploadsDir]);
      let err = '';
      tar.stderr.on('data', (d) => { err += d.toString(); });
      tar.on('error', reject);
      tar.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || `tar exited ${code}`))));
    });
    await fs.promises.unlink(tmp).catch(() => {});

    await logAudit(req, { action: 'import', entity: 'backup', description: 'Restored uploaded images archive' });
    ok(res, { restored: true });
  } catch (e) { fail(res, 500, `Image restore failed: ${e.message}`); }
};

// ─── App settings (singleton) ───────────────────────────────
const getOrCreateSettings = async () => {
  let s = await prisma.appSettings.findUnique({ where: { key: 'global' } });
  if (!s) s = await prisma.appSettings.create({ data: { key: 'global', facilityCategories: DEFAULT_FACILITY_CATEGORIES, clinicTierThresholds: DEFAULT_TIER_THRESHOLDS, payments: DEFAULT_PAYMENTS } });
  return s;
};
exports.getOrCreateSettings = getOrCreateSettings;

// SMTP config exposed to the admin UI — the password is never sent back, only a
// `passSet` flag so the field can show a "leave blank to keep" placeholder.
const smtpForClient = (smtp) => {
  const s = smtp || {};
  return { host: s.host || '', port: s.port || 465, user: s.user || '', from: s.from || '', insecure: !!s.insecure, pass: '', passSet: !!s.pass };
};

exports.getSettings = async (req, res) => {
  try {
    const s = await getOrCreateSettings();
    const obj = serialize(s);
    if (!obj.facilityCategories?.length) obj.facilityCategories = DEFAULT_FACILITY_CATEGORIES;
    if (!obj.clinicTierThresholds) obj.clinicTierThresholds = DEFAULT_TIER_THRESHOLDS;
    if (!obj.payments) obj.payments = DEFAULT_PAYMENTS;
    obj.smtp = smtpForClient(obj.smtp);
    ok(res, obj);
  } catch (e) { fail(res, 500, e.message); }
};

exports.updateSettings = async (req, res) => {
  try {
    const me = await prisma.adminProfile.findUnique({ where: { userId: req.user._id } });
    if (me?.adminRole !== 'super_admin') return fail(res, 403, 'Only super admins can change app settings');
    const current = await getOrCreateSettings();
    const allowed = ['rewardPointsPerAppointment', 'rewardPointValuePkr', 'popularPointsThreshold', 'defaultConsultationFee', 'supportEmail', 'maintenanceMode', 'payments', 'enabledPaymentMethods', 'commissionRate', 'commissionBlockThreshold', 'campaignRotationInterval', 'doctorCampaignRotationInterval', 'facilityCategories', 'clinicTierThresholds'];
    const data = {};
    for (const k of allowed) if (k in req.body) data[k] = req.body[k];

    // SMTP: merge with the stored value so an empty password keeps the existing one.
    if (req.body.smtp && typeof req.body.smtp === 'object') {
      const prev = current.smtp || {};
      const inc = req.body.smtp;
      data.smtp = {
        host: (inc.host ?? prev.host ?? '').trim(),
        port: Number(inc.port ?? prev.port ?? 465),
        user: (inc.user ?? prev.user ?? '').trim(),
        pass: (inc.pass && String(inc.pass).length) ? inc.pass : (prev.pass || ''),
        from: (inc.from ?? prev.from ?? '').trim(),
        insecure: inc.insecure !== undefined ? Boolean(inc.insecure) : Boolean(prev.insecure),
      };
    }

    const s = await prisma.appSettings.update({ where: { key: 'global' }, data });
    const out = serialize(s);
    out.smtp = smtpForClient(out.smtp);
    ok(res, out);
  } catch (e) { fail(res, 500, e.message); }
};

// @route POST /api/admin/settings/test-email  body: { to }
// Verifies SMTP and sends a test email (super admin only).
exports.testEmail = async (req, res) => {
  try {
    const me = await prisma.adminProfile.findUnique({ where: { userId: req.user._id } });
    if (me?.adminRole !== 'super_admin') return fail(res, 403, 'Only super admins can test email');
    const to = (req.body.to || '').trim();
    if (!to) return fail(res, 400, 'Recipient email (to) is required');

    const { verifyConnection, sendEmail } = require('../utils/mailer');
    const v = await verifyConnection();
    if (!v.ok) return fail(res, 400, `SMTP connection failed: ${v.error}`);

    const { renderEmail, emailPanel } = require('../utils/emailTemplate');
    const r = await sendEmail({
      to,
      subject: 'My Dentist email delivery confirmed',
      text: `Hello,\n\nGreat news — email for My Dentist is set up correctly. Transactional emails like password resets, appointment updates, and account notifications will be delivered reliably from this address.\n\n• SMTP connection verified\n• Delivery working\n\nNo action is needed — an administrator ran this delivery check from the admin panel.\n\n— The My Dentist Team\nmydentistpk.com`,
      html: renderEmail({
        preheader: 'Your My Dentist email is set up and working.',
        heading: 'Email delivery confirmed',
        bodyHtml: `
          <p style="margin:0 0 14px;">Hello,</p>
          <p style="margin:0 0 18px;">Great news — email for <b>My Dentist</b> is set up correctly. Transactional emails like <b>password resets</b>, <b>appointment updates</b>, and <b>account notifications</b> will be delivered reliably from this address.</p>
          ${emailPanel('&#10003;&nbsp; SMTP connection verified &nbsp;&nbsp;·&nbsp;&nbsp; &#10003;&nbsp; Delivery working', 'success')}
          <p style="margin:0;color:#64748b;font-size:13px;">No action is needed — an administrator ran this delivery check from the admin panel.</p>`,
      }),
    });
    ok(res, { sent: r.sent, to });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Popular doctor management ──────────────────────────────
exports.setPopular = async (req, res) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: req.params.id } });
    if (!doctor) return fail(res, 404, 'Dentist not found');

    const { action, addPoints } = req.body;
    let updated;

    if (typeof addPoints === 'number') {
      const newPoints = Math.max(0, (doctor.rewardPoints || 0) + addPoints);
      const data = { rewardPoints: newPoints };
      if (addPoints !== 0) {
        const adj = Array.isArray(doctor.pointsAdjustments) ? doctor.pointsAdjustments : [];
        adj.push({ points: addPoints, note: (req.body.note || '').trim() || (addPoints > 0 ? 'Points granted by admin' : 'Points deducted by admin'), kind: 'admin', createdAt: new Date() });
        data.pointsAdjustments = adj;
      }
      updated = await prisma.doctorProfile.update({ where: { id: doctor.id }, data });
      updated = await recomputePopular(updated);
    } else if (action === 'grantPaid') {
      updated = await prisma.doctorProfile.update({ where: { id: doctor.id }, data: { isPopular: true, popularType: 'paid' } });
    } else if (action === 'revoke') {
      updated = await prisma.doctorProfile.update({ where: { id: doctor.id }, data: { isPopular: false, popularType: null } });
      updated = await recomputePopular(updated);
    } else {
      return fail(res, 400, 'Provide action (grantPaid|revoke) or addPoints');
    }

    ok(res, serialize(updated));
  } catch (e) { fail(res, 500, e.message); }
};

exports.listPopularDoctors = async (req, res) => {
  try {
    const docs = await prisma.doctorProfile.findMany({
      orderBy: [{ isPopular: 'desc' }, { rewardPoints: 'desc' }], take: 200,
      select: { id: true, fullName: true, photo: true, specialization: true, rewardPoints: true, isPopular: true, popularType: true, city: true },
    });
    ok(res, serialize(docs));
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Platform fee dues & blocking ───────────────────────────
// Auto-block dues threshold is admin-managed (AppSettings.commissionBlockThreshold).
const DEFAULT_BLOCK_THRESHOLD = 50000;
const blockThresholdOf = (settings) => settings?.commissionBlockThreshold ?? DEFAULT_BLOCK_THRESHOLD;

exports.setCommission = async (req, res) => {
  try {
    const doc = await prisma.doctorProfile.findUnique({ where: { id: req.params.id } });
    if (!doc) return fail(res, 404, 'Dentist not found');

    const threshold = blockThresholdOf(await getOrCreateSettings());
    const before = doc.commissionDue || 0;
    let logType = 'set', newDue = before;
    if (typeof req.body.commissionDue === 'number') { newDue = Math.max(0, req.body.commissionDue); logType = 'set'; }
    else if (typeof req.body.addCommission === 'number') { newDue = Math.max(0, before + req.body.addCommission); logType = 'add'; }

    const data = { commissionDue: newDue };
    const shouldBlock = logType === 'set' ? newDue > 0 : newDue >= threshold;
    if (shouldBlock && !doc.isBlocked) {
      data.isBlocked = true;
      data.blockReason = `Your account is blocked because outstanding platform fee dues of PKR ${newDue.toLocaleString()} are pending. Please clear the dues and share payment proof with My Dentist support to restore access.`;
    }
    const updated = await prisma.doctorProfile.update({ where: { id: doc.id }, data });
    await logCommission(req, updated, { type: logType, amount: newDue - before });
    await logAudit(req, { action: 'update', entity: 'dentist', entityId: doc.id, description: `Set commission dues for "${doc.fullName}" to PKR ${newDue.toLocaleString()}` });
    ok(res, serialize(updated));
  } catch (e) { fail(res, 500, e.message); }
};

exports.syncDues = async (req, res) => {
  try {
    const doc = await prisma.doctorProfile.findUnique({ where: { id: req.params.id } });
    if (!doc) return fail(res, 404, 'Dentist not found');

    const settings = await getOrCreateSettings();
    const rate = settings.commissionRate ?? 10;
    const threshold = blockThresholdOf(settings);
    const bills = await prisma.bill.findMany({ where: { doctorId: doc.id }, select: { id: true, finalAmount: true, paidAmount: true, amount: true, status: true, commissionAccrued: true } });
    const collected = bills.reduce((s, b) => s + (b.paidAmount || (b.status === 'paid' ? b.finalAmount : 0) || 0), 0);

    let earned = 0;
    for (const b of bills) {
      const target = targetCommission(b, rate);
      earned += target;
      if ((b.commissionAccrued || 0) !== target) await prisma.bill.update({ where: { id: b.id }, data: { commissionAccrued: target } });
    }
    const owed = Math.max(0, earned - (doc.commissionPaid || 0));

    const data = { commissionDue: owed };
    if (owed >= threshold && !doc.isBlocked) {
      data.isBlocked = true;
      data.blockReason = `Your account is blocked because outstanding platform fee dues of PKR ${owed.toLocaleString()} exceeded the PKR ${threshold.toLocaleString()} limit. Please clear the dues and share payment proof with My Dentist support to restore access.`;
    }
    const updated = await prisma.doctorProfile.update({ where: { id: doc.id }, data });
    await logCommission(req, updated, { type: 'sync', amount: owed, note: `${rate}% of ${collected.toLocaleString()} collected − ${(doc.commissionPaid || 0).toLocaleString()} paid` });
    await logAudit(req, { action: 'update', entity: 'dentist', entityId: doc.id, description: `Synced commission dues for "${doc.fullName}" to PKR ${owed.toLocaleString()}` });
    ok(res, { doc: serialize(updated), owed, earned, collected, rate });
  } catch (e) { fail(res, 500, e.message); }
};

exports.clearDues = async (req, res) => {
  try {
    const doc = await prisma.doctorProfile.findUnique({ where: { id: req.params.id } });
    if (!doc) return fail(res, 404, 'Dentist not found');
    const outstanding = doc.commissionDue || 0;
    if (outstanding <= 0) return fail(res, 400, 'No outstanding dues to clear');

    const raw = req.body?.amount;
    let amount = (raw === undefined || raw === null || raw === '') ? outstanding : Number(raw);
    if (isNaN(amount) || amount <= 0) return fail(res, 400, 'Enter a valid amount to clear');
    const cleared = Math.min(amount, outstanding);

    const data = { commissionPaid: (doc.commissionPaid || 0) + cleared, commissionDue: outstanding - cleared };
    if (data.commissionDue <= 0 && doc.isBlocked && /(commission|platform fee|dues)/i.test(doc.blockReason || '')) {
      data.isBlocked = false; data.blockReason = '';
    }
    const updated = await prisma.doctorProfile.update({ where: { id: doc.id }, data });
    await logCommission(req, updated, { type: 'clear', amount: cleared, note: req.body?.note || '' });
    await logAudit(req, { action: 'update', entity: 'dentist', entityId: doc.id, description: `Cleared PKR ${cleared.toLocaleString()} commission dues for "${doc.fullName}"${updated.commissionDue > 0 ? ` (PKR ${updated.commissionDue.toLocaleString()} remaining)` : ''}` });
    ok(res, { doc: serialize(updated), cleared, remaining: updated.commissionDue });
  } catch (e) { fail(res, 500, e.message); }
};

exports.getCommissionOverview = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const rate = settings.commissionRate ?? 10;

    const collectedAgg = await prisma.$queryRaw`
      SELECT "doctorId",
        sum(coalesce("paidAmount", CASE WHEN status = 'paid' THEN "finalAmount" ELSE 0 END))::float AS collected,
        sum("finalAmount")::float AS billed
      FROM "Bill" GROUP BY "doctorId"`;
    const byDoctor = {};
    collectedAgg.forEach((c) => { byDoctor[c.doctorId] = c; });

    const doctors = await prisma.doctorProfile.findMany({ select: { id: true, fullName: true, photo: true, city: true, commissionDue: true, commissionPaid: true, isBlocked: true } });
    const rows = doctors.map((d) => {
      const agg = byDoctor[d.id] || { collected: 0, billed: 0 };
      return {
        _id: d.id, fullName: d.fullName, photo: d.photo, city: d.city,
        collected: agg.collected || 0, commissionEarned: Math.round((agg.collected || 0) * (rate / 100)),
        commissionPaid: d.commissionPaid || 0, commissionDue: d.commissionDue || 0, isBlocked: !!d.isBlocked,
      };
    }).sort((a, b) => b.commissionEarned - a.commissionEarned);

    const totals = rows.reduce((t, r) => ({ earned: t.earned + r.commissionEarned, paid: t.paid + r.commissionPaid, due: t.due + r.commissionDue, collected: t.collected + r.collected }), { earned: 0, paid: 0, due: 0, collected: 0 });
    ok(res, { rate, totals, overdueCount: rows.filter((r) => r.commissionDue > 0).length, doctors: rows });
  } catch (e) { fail(res, 500, e.message); }
};

exports.unblockDentist = async (req, res) => {
  try {
    const doc = await prisma.doctorProfile.update({ where: { id: req.params.id }, data: { isBlocked: false, blockReason: '' } }).catch(() => null);
    if (!doc) return fail(res, 404, 'Dentist not found');
    ok(res, serialize(doc));
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Analytics ──────────────────────────────────────────────
exports.getAnalytics = async (req, res) => {
  try {
    const { from, to } = req.query;
    let since, until = null, months = null;
    if (from) { since = new Date(from); until = new Date(to || Date.now()); until.setHours(23, 59, 59, 999); }
    else {
      months = Math.min(24, Math.max(3, parseInt(req.query.months, 10) || 6));
      since = new Date(); since.setMonth(since.getMonth() - (months - 1)); since.setDate(1); since.setHours(0, 0, 0, 0);
    }

    const series = (table) => until
      ? prisma.$queryRawUnsafe(`SELECT to_char("createdAt",'YYYY-MM') AS _id, count(*)::int AS count FROM "${table}" WHERE "createdAt" >= $1 AND "createdAt" <= $2 GROUP BY 1 ORDER BY 1`, since, until)
      : prisma.$queryRawUnsafe(`SELECT to_char("createdAt",'YYYY-MM') AS _id, count(*)::int AS count FROM "${table}" WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 1`, since);

    const revenueSeries = until
      ? prisma.$queryRawUnsafe(`SELECT to_char("createdAt",'YYYY-MM') AS _id, sum(coalesce("paidAmount","finalAmount"))::float AS total FROM "Bill" WHERE status='paid' AND "createdAt" >= $1 AND "createdAt" <= $2 GROUP BY 1 ORDER BY 1`, since, until)
      : prisma.$queryRawUnsafe(`SELECT to_char("createdAt",'YYYY-MM') AS _id, sum(coalesce("paidAmount","finalAmount"))::float AS total FROM "Bill" WHERE status='paid' AND "createdAt" >= $1 GROUP BY 1 ORDER BY 1`, since);

    const [apptSeries, patientSeries, dentistSeries, revenue, statusAgg, cityAgg, treatAgg] = await Promise.all([
      series('Appointment'), series('PatientProfile'), series('DoctorProfile'), revenueSeries,
      prisma.appointment.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.patientProfile.groupBy({ by: ['city'], where: { city: { notIn: [''] } }, _count: { _all: true }, orderBy: { _count: { city: 'desc' } }, take: 8 }),
      prisma.appointment.groupBy({ by: ['treatmentType'], where: { treatmentType: { notIn: [''] } }, _count: { _all: true }, orderBy: { _count: { treatmentType: 'desc' } }, take: 8 }),
    ]);

    // Top earners.
    const earnersAgg = await prisma.bill.groupBy({ by: ['doctorId'], where: { status: 'paid' }, _sum: { paidAmount: true, finalAmount: true }, _count: { _all: true } });
    const earners = (await Promise.all(
      earnersAgg
        .map((e) => ({ doctorId: e.doctorId, revenue: (e._sum.paidAmount || e._sum.finalAmount || 0), bills: e._count._all }))
        .sort((a, b) => b.revenue - a.revenue).slice(0, 8)
        .map(async (e) => {
          const d = await prisma.doctorProfile.findUnique({ where: { id: e.doctorId }, select: { fullName: true, photo: true, city: true } });
          return { _id: e.doctorId, revenue: e.revenue, bills: e.bills, fullName: d?.fullName, photo: d?.photo, city: d?.city };
        })
    ));

    // Retention.
    const visits = await prisma.appointment.groupBy({ by: ['patientId'], where: { status: 'completed' }, _count: { _all: true } });
    const withVisit = visits.length;
    const repeat = visits.filter((v) => v._count._all >= 2).length;

    // Commission totals.
    const commAgg = await prisma.doctorProfile.aggregate({ _sum: { commissionDue: true, commissionPaid: true } });
    const due = commAgg._sum.commissionDue || 0, paid = commAgg._sum.commissionPaid || 0;

    ok(res, {
      months, range: { since, until: until || null },
      topEarningDentists: serialize(earners),
      retention: { withVisit, repeat, rate: withVisit ? Math.round((repeat / withVisit) * 100) : 0 },
      commissionTotals: { earned: due + paid, collected: paid, outstanding: due },
      appointmentSeries: apptSeries, patientSeries, dentistSeries, revenueSeries: revenue,
      statusBreakdown: statusAgg.map((s) => ({ _id: s.status, count: s._count._all })),
      patientsByCity: cityAgg.map((c) => ({ _id: c.city, count: c._count._all })),
      topTreatments: treatAgg.map((t) => ({ _id: t.treatmentType, count: t._count._all })),
    });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Broadcast notifications ────────────────────────────────
async function deliverBroadcast({ title, message, audience = 'all', city }) {
  const where = audience === 'all' ? { role: { in: ['patient', 'doctor'] } } : { role: audience };
  if (city && city.trim()) {
    const rx = { equals: city.trim(), mode: 'insensitive' };
    const [pp, dp] = await Promise.all([
      prisma.patientProfile.findMany({ where: { city: rx }, select: { userId: true } }),
      prisma.doctorProfile.findMany({ where: { city: rx }, select: { userId: true } }),
    ]);
    where.id = { in: [...pp, ...dp].map((d) => d.userId).filter(Boolean) };
  }
  const users = await prisma.user.findMany({ where, select: { id: true } });
  if (!users.length) return 0;
  await prisma.notification.createMany({ data: users.map((u) => ({ userId: u.id, title, message, type: 'system' })) });
  return users.length;
}

exports.broadcast = async (req, res) => {
  try {
    const { title, message, audience = 'all', city, sendAt } = req.body;
    if (!title || !message) return fail(res, 400, 'Title and message are required');
    if (!['all', 'patient', 'doctor'].includes(audience)) return fail(res, 400, 'Invalid audience');

    if (sendAt) {
      const when = new Date(sendAt);
      if (isNaN(when.getTime())) return fail(res, 400, 'Invalid schedule time');
      if (when.getTime() > Date.now() + 30000) {
        const sb = await prisma.scheduledBroadcast.create({ data: { title, message, audience, city: city || '', sendAt: when, createdBy: req.user._id } });
        await logAudit(req, { action: 'broadcast', entity: 'notification', description: `Scheduled broadcast "${title}" for ${when.toLocaleString()} (${audience}${city ? `, ${city}` : ''})` });
        return ok(res, { scheduled: true, sendAt: when, id: sb.id });
      }
    }

    const sent = await deliverBroadcast({ title, message, audience, city });
    if (!sent) return fail(res, 404, 'No users found for this audience');
    await logAudit(req, { action: 'broadcast', entity: 'notification', description: `Broadcast "${title}" to ${sent} ${audience} user(s)` });
    ok(res, { sent, audience });
  } catch (e) { fail(res, 500, e.message); }
};

exports.listScheduledBroadcasts = async (req, res) => {
  try {
    const items = await prisma.scheduledBroadcast.findMany({ orderBy: { sendAt: 'desc' }, take: 50 });
    ok(res, serialize(items));
  } catch (e) { fail(res, 500, e.message); }
};

exports.cancelScheduledBroadcast = async (req, res) => {
  try {
    const sb = await prisma.scheduledBroadcast.findUnique({ where: { id: req.params.id } });
    if (!sb) return fail(res, 404, 'Scheduled broadcast not found');
    if (sb.status !== 'scheduled') return fail(res, 400, `Cannot cancel a ${sb.status} broadcast`);
    const updated = await prisma.scheduledBroadcast.update({ where: { id: sb.id }, data: { status: 'cancelled' } });
    await logAudit(req, { action: 'update', entity: 'notification', entityId: sb.id, description: `Cancelled scheduled broadcast "${sb.title}"` });
    ok(res, serialize(updated));
  } catch (e) { fail(res, 500, e.message); }
};

async function runDueScheduledBroadcasts() {
  const due = await prisma.scheduledBroadcast.findMany({ where: { status: 'scheduled', sendAt: { lte: new Date() } }, take: 50 });
  let processed = 0, totalSent = 0;
  for (const sb of due) {
    try {
      const sent = await deliverBroadcast({ title: sb.title, message: sb.message, audience: sb.audience, city: sb.city });
      await prisma.scheduledBroadcast.update({ where: { id: sb.id }, data: { status: 'sent', sentCount: sent, sentAt: new Date() } });
      processed += 1; totalSent += sent;
    } catch (e) {
      await prisma.scheduledBroadcast.update({ where: { id: sb.id }, data: { status: 'failed', error: e.message } });
    }
  }
  return { processed, totalSent };
}
exports.runDueScheduledBroadcasts = runDueScheduledBroadcasts;

exports.processScheduledBroadcasts = async (req, res) => {
  try { ok(res, await runDueScheduledBroadcasts()); } catch (e) { fail(res, 500, e.message); }
};

// ─── Audit log ──────────────────────────────────────────────
exports.listAuditLogs = async (req, res) => {
  try {
    const { page, limit, action, entity, from, to } = req.query;
    const where = {};
    if (action && action !== 'all') where.action = action;
    if (entity && entity !== 'all') where.entity = entity;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); where.createdAt.lte = end; }
    }
    const result = await paginate('auditLog', { where, page, limit });
    const counts = {
      total: await prisma.auditLog.count(),
      deletes: await prisma.auditLog.count({ where: { action: 'delete' } }),
      broadcasts: await prisma.auditLog.count({ where: { action: 'broadcast' } }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Patient suspend / ban ──────────────────────────────────
exports.blockPatient = async (req, res) => {
  try {
    const p = await prisma.patientProfile.update({ where: { id: req.params.id }, data: { isBlocked: true, blockReason: req.body.reason || '' } }).catch(() => null);
    if (!p) return fail(res, 404, 'Patient not found');
    await logAudit(req, { action: 'block', entity: 'patient', entityId: p.id, description: `Suspended patient "${p.fullName}"${req.body.reason ? ` — ${req.body.reason}` : ''}` });
    ok(res, serialize(p));
  } catch (e) { fail(res, 500, e.message); }
};

exports.unblockPatient = async (req, res) => {
  try {
    const p = await prisma.patientProfile.update({ where: { id: req.params.id }, data: { isBlocked: false, blockReason: '' } }).catch(() => null);
    if (!p) return fail(res, 404, 'Patient not found');
    await logAudit(req, { action: 'unblock', entity: 'patient', entityId: p.id, description: `Reinstated patient "${p.fullName}"` });
    ok(res, serialize(p));
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Bill refund ────────────────────────────────────────────
exports.refundBill = async (req, res) => {
  try {
    const bill = await prisma.bill.findUnique({ where: { id: req.params.id } });
    if (!bill) return fail(res, 404, 'Bill not found');
    if (bill.status === 'refunded') return fail(res, 400, 'Bill is already refunded');
    await prisma.bill.update({ where: { id: bill.id }, data: { status: 'refunded', refundReason: req.body.reason || '', refundedAt: new Date() } });
    await logAudit(req, { action: 'refund', entity: 'bill', entityId: bill.id, description: `Refunded bill ${bill.invoiceNumber} (PKR ${(bill.finalAmount || bill.amount || 0).toLocaleString()})${req.body.reason ? ` — ${req.body.reason}` : ''}` });
    const populated = await prisma.bill.findUnique({ where: { id: bill.id }, include: { patient: { select: { fullName: true, profileImage: true } }, doctor: { select: { fullName: true, photo: true } } } });
    ok(res, serialize(remapRefs(populated, { patient: 'patientId', doctor: 'doctorId' })));
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Global search ──────────────────────────────────────────
exports.globalSearch = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return ok(res, { dentists: [], patients: [], bills: [] });
    const [dentists, patients, bills] = await Promise.all([
      prisma.doctorProfile.findMany({ where: { OR: [{ fullName: ci(q) }, { clinicName: ci(q) }] }, select: { id: true, fullName: true, clinicName: true, city: true, photo: true }, take: 6 }),
      prisma.patientProfile.findMany({ where: { OR: [{ fullName: ci(q) }, { mobileNumber: ci(q) }] }, select: { id: true, fullName: true, mobileNumber: true, city: true, profileImage: true }, take: 6 }),
      prisma.bill.findMany({ where: { OR: [{ invoiceNumber: ci(q) }, { treatmentName: ci(q) }] }, select: { id: true, invoiceNumber: true, treatmentName: true, finalAmount: true, amount: true, status: true }, take: 6 }),
    ]);
    ok(res, { dentists: serialize(dentists), patients: serialize(patients), bills: serialize(bills) });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Review moderation ──────────────────────────────────────
exports.moderateReview = async (req, res) => {
  try {
    const r = await prisma.review.update({
      where: { id: req.params.id }, data: { hidden: !!req.body.hidden },
      include: { patient: { select: { fullName: true, profileImage: true } }, doctor: { select: { fullName: true, photo: true } } },
    }).catch(() => null);
    if (!r) return fail(res, 404, 'Review not found');
    await logAudit(req, { action: req.body.hidden ? 'hide' : 'unhide', entity: 'review', entityId: r.id, description: `${req.body.hidden ? 'Hid' : 'Unhid'} a ${r.rating}★ review` });
    ok(res, serialize(remapRefs(r, { patient: 'patientId', doctor: 'doctorId' })));
  } catch (e) { fail(res, 500, e.message); }
};

exports.replyReview = async (req, res) => {
  try {
    const text = (req.body.text || '').trim();
    const r = await prisma.review.update({
      where: { id: req.params.id }, data: { doctorReply: { text, repliedAt: text ? new Date() : null } },
      include: { patient: { select: { fullName: true, profileImage: true } }, doctor: { select: { fullName: true, photo: true } } },
    }).catch(() => null);
    if (!r) return fail(res, 404, 'Review not found');
    await logAudit(req, { action: 'update', entity: 'review', entityId: r.id, description: text ? `Replied to a review on behalf of ${r.doctor?.fullName || 'doctor'}` : 'Cleared reply on a review' });
    ok(res, serialize(remapRefs(r, { patient: 'patientId', doctor: 'doctorId' })));
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Impersonation ──────────────────────────────────────────
exports.impersonateUser = async (req, res) => {
  try {
    const me = await prisma.adminProfile.findUnique({ where: { userId: req.user._id } });
    if (me?.adminRole !== 'super_admin') return fail(res, 403, 'Only super admins can impersonate users');

    const user = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { id: true, role: true } });
    if (!user) return fail(res, 404, 'User not found');
    if (!['patient', 'doctor'].includes(user.role)) return fail(res, 400, 'Only patient or doctor accounts can be viewed');

    const token = jwt.sign({ id: user.id, imp: true, impBy: req.user._id }, process.env.JWT_SECRET, { expiresIn: '30m' });
    let name = '';
    if (user.role === 'doctor') name = (await prisma.doctorProfile.findUnique({ where: { userId: user.id }, select: { fullName: true } }))?.fullName || '';
    else name = (await prisma.patientProfile.findUnique({ where: { userId: user.id }, select: { fullName: true } }))?.fullName || '';

    await logAudit(req, { action: 'impersonate', entity: user.role, entityId: user.id, description: `Impersonated ${user.role} "${name || user.id}" (30-min session)` });
    ok(res, { token, role: user.role, name });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Reset passwords (super admin) ──────────────────────────
async function resetLoginPassword(res, profile, prefix, req, entity) {
  const user = await prisma.user.findUnique({ where: { id: profile.userId } });
  if (!user) return fail(res, 404, 'Login account not found');
  let newPassword = (req.body.password || '').trim();
  if (!newPassword) newPassword = prefix + crypto.randomBytes(4).toString('hex');
  if (newPassword.length < 6) return fail(res, 400, 'Password must be at least 6 characters');
  await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(newPassword) } });
  await logAudit(req, { action: 'reset-password', entity, entityId: profile.id, description: `Reset login password for ${entity} "${profile.fullName}"` });
  ok(res, { password: newPassword, email: user.email });
}

exports.resetDentistPassword = async (req, res) => {
  try {
    const me = await prisma.adminProfile.findUnique({ where: { userId: req.user._id } });
    if (me?.adminRole !== 'super_admin') return fail(res, 403, 'Only super admins can reset passwords');
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true, fullName: true } });
    if (!doctor) return fail(res, 404, 'Dentist not found');
    await resetLoginPassword(res, doctor, 'Dent', req, 'dentist');
  } catch (e) { fail(res, 500, e.message); }
};

exports.resetPatientPassword = async (req, res) => {
  try {
    const me = await prisma.adminProfile.findUnique({ where: { userId: req.user._id } });
    if (me?.adminRole !== 'super_admin') return fail(res, 403, 'Only super admins can reset passwords');
    const patient = await prisma.patientProfile.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true, fullName: true } });
    if (!patient) return fail(res, 404, 'Patient not found');
    await resetLoginPassword(res, patient, 'Pat', req, 'patient');
  } catch (e) { fail(res, 500, e.message); }
};
