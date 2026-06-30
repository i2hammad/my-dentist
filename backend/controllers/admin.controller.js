const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AdminProfile = require('../models/AdminProfile');
const DoctorProfile = require('../models/DoctorProfile');
const PatientProfile = require('../models/PatientProfile');
const Treatment = require('../models/Treatment');
const Gallery = require('../models/Gallery');
const Review = require('../models/Review');
const Appointment = require('../models/Appointment');
const Bill = require('../models/Bill');
const Reward = require('../models/Reward');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const CommissionLog = require('../models/CommissionLog');

// Record a commission dues change for a doctor (best-effort).
async function logCommission(req, doc, { type, amount, note = '' }) {
  try {
    await CommissionLog.create({
      doctorId: doc._id,
      doctorName: doc.fullName || '',
      type, amount,
      balanceAfter: doc.commissionDue || 0,
      note,
      actorName: req.user?.fullName || req.user?.email || 'Admin',
    });
  } catch (_) { /* logging must not break the action */ }
}

// Record an admin action for the activity log. Best-effort (never throws into
// the request flow). `req` carries the acting admin on req.user.
async function logAudit(req, { action, entity = '', entityId = '', description = '' }) {
  try {
    await AuditLog.create({
      actorId: req.user?._id,
      actorName: req.user?.fullName || req.user?.email || 'Admin',
      action, entity, entityId: String(entityId || ''), description,
    });
  } catch (_) { /* logging must not break the action */ }
}

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, code, message) => res.status(code).json({ success: false, message });

// ─── Dashboard ──────────────────────────────────────────────
// @route GET /api/admin/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const [totalDentists, totalPatients, totalAppointments, paidBills] = await Promise.all([
      DoctorProfile.countDocuments(),
      PatientProfile.countDocuments(),
      Appointment.countDocuments(),
      Bill.find({ status: 'paid' }).select('finalAmount paidAmount').lean(),
    ]);

    const totalEarnings = paidBills.reduce(
      (sum, b) => sum + (b.paidAmount || b.finalAmount || 0), 0
    );

    // Recent appointments (joined with patient/doctor names)
    const recent = await Appointment.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .populate('patientId', 'fullName profileImage')
      .populate('doctorId', 'fullName photo')
      .lean();

    // Top dentists by review count + rating (exclude moderated/hidden reviews)
    const topAgg = await Review.aggregate([
      { $match: { hidden: { $ne: true } } },
      { $group: { _id: '$doctorId', count: { $sum: 1 }, avg: { $avg: '$rating' } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);
    const topDentists = await Promise.all(
      topAgg.map(async (t) => {
        const d = await DoctorProfile.findById(t._id).select('fullName photo specialization').lean();
        return d ? { ...d, reviewCount: t.count, rating: Math.round(t.avg * 10) / 10 } : null;
      })
    );

    // Appointments per month (last 6 months) for the chart
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    const apptSeries = await Appointment.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    ok(res, {
      stats: { totalDentists, totalPatients, totalAppointments, totalEarnings },
      recentAppointments: recent,
      topDentists: topDentists.filter(Boolean),
      appointmentSeries: apptSeries,
    });
  } catch (e) {
    fail(res, 500, e.message);
  }
};

// ─── Generic paginated list helper ──────────────────────────
async function paginate(Model, { query = {}, page = 1, limit = 10, populate = [], sort = { createdAt: -1 } }) {
  page = Math.max(1, parseInt(page));
  limit = Math.max(1, parseInt(limit));
  let q = Model.find(query).sort(sort).skip((page - 1) * limit).limit(limit);
  for (const p of populate) q = q.populate(p.path, p.select);
  const [data, total] = await Promise.all([q.lean(), Model.countDocuments(query)]);
  return { data, total, page, pages: Math.ceil(total / limit) };
}

// ─── Admins ─────────────────────────────────────────────────
// @route GET /api/admin/admins
exports.listAdmins = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (search) query.fullName = { $regex: search, $options: 'i' };
    const result = await paginate(AdminProfile, {
      query, page, limit,
      populate: [{ path: 'userId', select: 'email role createdAt' }],
    });
    const counts = {
      total: await AdminProfile.countDocuments(),
      active: await AdminProfile.countDocuments({ status: 'active' }),
      inactive: await AdminProfile.countDocuments({ status: 'inactive' }),
      super: await AdminProfile.countDocuments({ adminRole: 'super_admin' }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// @route PATCH /api/admin/admins/:id  (toggle status / update permissions)
exports.updateAdmin = async (req, res) => {
  try {
    const { status, permissions, fullName, adminRole } = req.body;
    const update = {};
    if (status) update.status = status;
    if (permissions) update.permissions = permissions;
    if (fullName) update.fullName = fullName;
    if (adminRole) update.adminRole = adminRole;
    const admin = await AdminProfile.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!admin) return fail(res, 404, 'Admin not found');
    ok(res, admin);
  } catch (e) { fail(res, 500, e.message); }
};

// @route DELETE /api/admin/admins/:id
exports.deleteAdmin = async (req, res) => {
  try {
    const admin = await AdminProfile.findById(req.params.id);
    if (!admin) return fail(res, 404, 'Admin not found');
    if (admin.adminRole === 'super_admin') return fail(res, 400, 'Cannot delete a super admin');
    await AdminProfile.findByIdAndDelete(req.params.id);
    await User.findByIdAndDelete(admin.userId);
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Dentists ───────────────────────────────────────────────
// @route GET /api/admin/dentists
exports.listDentists = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    const query = {};
    if (search) query.fullName = { $regex: search, $options: 'i' };
    if (status === 'verified') query.pmdcVerified = true;
    if (status === 'pending') query.pmdcVerified = false;
    const result = await paginate(DoctorProfile, {
      query, page, limit,
      populate: [{ path: 'userId', select: 'email role createdAt' }],
    });
    const counts = {
      total: await DoctorProfile.countDocuments(),
      verified: await DoctorProfile.countDocuments({ pmdcVerified: true }),
      pending: await DoctorProfile.countDocuments({ pmdcVerified: false }),
      newThisMonth: await DoctorProfile.countDocuments({ createdAt: { $gte: startOfMonth() } }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// @route PATCH /api/admin/dentists/:id  (approve/verify, etc.)
exports.updateDentist = async (req, res) => {
  try {
    const allowed = ['pmdcVerified', 'clinicTier', 'fullName', 'specialization', 'approvalStatus', 'isBlocked', 'blockReason'];
    const update = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];
    // Approving a doctor also marks them verified.
    if (update.approvalStatus === 'approved') update.pmdcVerified = true;
    const doc = await DoctorProfile.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!doc) return fail(res, 404, 'Dentist not found');
    ok(res, doc);
  } catch (e) { fail(res, 500, e.message); }
};

// @route DELETE /api/admin/dentists/:id
exports.deleteDentist = async (req, res) => {
  try {
    const doc = await DoctorProfile.findById(req.params.id);
    if (!doc) return fail(res, 404, 'Dentist not found');
    await DoctorProfile.findByIdAndDelete(req.params.id);
    await User.findByIdAndDelete(doc.userId);
    await logAudit(req, { action: 'delete', entity: 'dentist', entityId: doc._id, description: `Deleted dentist "${doc.fullName}"` });
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Patients ───────────────────────────────────────────────
// @route GET /api/admin/patients
exports.listPatients = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const query = {};
    if (search) query.fullName = { $regex: search, $options: 'i' };
    const result = await paginate(PatientProfile, {
      query, page, limit,
      populate: [{ path: 'userId', select: 'email role createdAt' }],
    });
    const counts = {
      total: await PatientProfile.countDocuments(),
      newThisMonth: await PatientProfile.countDocuments({ createdAt: { $gte: startOfMonth() } }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// @route DELETE /api/admin/patients/:id
exports.deletePatient = async (req, res) => {
  try {
    const p = await PatientProfile.findById(req.params.id);
    if (!p) return fail(res, 404, 'Patient not found');
    await PatientProfile.findByIdAndDelete(req.params.id);
    await User.findByIdAndDelete(p.userId);
    await logAudit(req, { action: 'delete', entity: 'patient', entityId: p._id, description: `Deleted patient "${p.fullName}"` });
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Treatments ─────────────────────────────────────────────
// @route GET /api/admin/treatments
exports.listTreatments = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const query = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    const result = await paginate(Treatment, {
      query, page, limit,
      populate: [{ path: 'doctorId', select: 'fullName' }],
    });
    const counts = {
      total: await Treatment.countDocuments(),
      active: await Treatment.countDocuments({ isActive: true }),
      inactive: await Treatment.countDocuments({ isActive: false }),
      newThisMonth: await Treatment.countDocuments({ createdAt: { $gte: startOfMonth() } }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// @route DELETE /api/admin/treatments/:id
exports.deleteTreatment = async (req, res) => {
  try {
    const t = await Treatment.findByIdAndDelete(req.params.id);
    if (!t) return fail(res, 404, 'Treatment not found');
    await logAudit(req, { action: 'delete', entity: 'treatment', entityId: t._id, description: `Deleted treatment "${t.name}"` });
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Gallery ────────────────────────────────────────────────
// @route GET /api/admin/gallery
exports.listGallery = async (req, res) => {
  try {
    const { page, limit, category } = req.query;
    const query = {};
    if (category && category !== 'all') query.category = category;
    const result = await paginate(Gallery, {
      query, page, limit,
      populate: [{ path: 'doctorId', select: 'fullName' }],
    });
    const counts = {
      total: await Gallery.countDocuments(),
      newThisMonth: await Gallery.countDocuments({ createdAt: { $gte: startOfMonth() } }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// @route DELETE /api/admin/gallery/:id
exports.deleteGallery = async (req, res) => {
  try {
    const g = await Gallery.findByIdAndDelete(req.params.id);
    if (!g) return fail(res, 404, 'Gallery item not found');
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Reviews ────────────────────────────────────────────────
// @route GET /api/admin/reviews
exports.listReviews = async (req, res) => {
  try {
    const { page, limit, rating } = req.query;
    const query = {};
    if (rating && rating !== 'all') query.rating = parseInt(rating, 10);
    const result = await paginate(Review, {
      query, page, limit,
      populate: [
        { path: 'patientId', select: 'fullName profileImage' },
        { path: 'doctorId', select: 'fullName photo' },
      ],
    });
    // Avg rating reflects the PUBLIC rating — hidden (moderated) reviews don't count.
    const ratingAgg = await Review.aggregate([
      { $match: { hidden: { $ne: true } } },
      { $group: { _id: null, avg: { $avg: '$rating' } } },
    ]);
    const counts = {
      total: await Review.countDocuments(),
      verified: await Review.countDocuments({ isVerifiedPatient: true }),
      avgRating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : 0,
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// @route DELETE /api/admin/reviews/:id
exports.deleteReview = async (req, res) => {
  try {
    const r = await Review.findByIdAndDelete(req.params.id);
    if (!r) return fail(res, 404, 'Review not found');
    await logAudit(req, { action: 'delete', entity: 'review', entityId: r._id, description: 'Deleted a review' });
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Appointments ───────────────────────────────────────────
// @route GET /api/admin/appointments
exports.listAppointments = async (req, res) => {
  try {
    const { page, limit, status } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    const result = await paginate(Appointment, {
      query, page, limit,
      populate: [
        { path: 'patientId', select: 'fullName profileImage' },
        { path: 'doctorId', select: 'fullName photo' },
      ],
    });
    // Attach each appointment's bill (if any) so the admin can see whether it
    // was billed and paid — one query for the whole page, not N.
    const apptIds = result.data.map((a) => a._id);
    if (apptIds.length) {
      const bills = await Bill.find({ appointmentId: { $in: apptIds } })
        .select('appointmentId invoiceNumber status amount finalAmount paidAmount').lean();
      const byAppt = {};
      bills.forEach((b) => { byAppt[String(b.appointmentId)] = b; });
      result.data.forEach((a) => { a.bill = byAppt[String(a._id)] || null; });
    }
    const counts = {
      total: await Appointment.countDocuments(),
      completed: await Appointment.countDocuments({ status: 'completed' }),
      upcoming: await Appointment.countDocuments({ status: { $in: ['pending', 'confirmed'] } }),
      cancelled: await Appointment.countDocuments({ status: 'cancelled' }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Bills ──────────────────────────────────────────────────
// @route GET /api/admin/bills
exports.listBills = async (req, res) => {
  try {
    const { page, limit, status, search, from, to } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { treatmentName: { $regex: search, $options: 'i' } },
      ];
    }
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); query.createdAt.$lte = end; }
    }
    const result = await paginate(Bill, {
      query, page, limit,
      populate: [
        { path: 'patientId', select: 'fullName profileImage' },
        { path: 'doctorId', select: 'fullName photo' },
      ],
    });
    // Summary reflects the CURRENT filter so totals match what's listed.
    const filtered = await Bill.find(query).select('finalAmount paidAmount status').lean();
    const collected = filtered.reduce((s, b) => s + (b.paidAmount || (b.status === 'paid' ? b.finalAmount : 0) || 0), 0);
    const billed = filtered.reduce((s, b) => s + (b.finalAmount || 0), 0);
    const counts = {
      total: result.total,
      paid: filtered.filter((b) => b.status === 'paid').length,
      pending: filtered.filter((b) => b.status !== 'paid').length,
      totalAmount: billed,
      collected,
      outstanding: Math.max(0, billed - collected),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Rewards & Payments ─────────────────────────────────────
// @route GET /api/admin/rewards
exports.listRewards = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await paginate(Reward, {
      query: {}, page, limit,
      populate: [{ path: 'patientId', select: 'fullName profileImage' }],
    });
    const all = await Reward.find().select('points').lean();
    const counts = {
      members: await PatientProfile.countDocuments(),
      totalPoints: all.reduce((s, r) => s + (r.points || 0), 0),
      transactions: await Reward.countDocuments(),
      redeemed: await Reward.countDocuments({ isRedeemed: true }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Create: Admin ──────────────────────────────────────────
// @route POST /api/admin/admins
exports.createAdmin = async (req, res) => {
  try {
    const { email, password, fullName, adminRole, permissions } = req.body;
    if (!email || !password || !fullName) return fail(res, 400, 'Email, password and full name are required');
    if (await User.findOne({ email: email.toLowerCase() })) return fail(res, 400, 'Email already in use');
    const user = await User.create({ email: email.toLowerCase(), password, role: 'admin', isAgreed: true });
    const profile = await AdminProfile.create({
      userId: user._id, fullName,
      adminRole: adminRole === 'super_admin' ? 'super_admin' : 'admin',
      ...(permissions ? { permissions } : {}),
    });
    ok(res, profile);
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Create: Dentist ────────────────────────────────────────
// @route POST /api/admin/dentists
exports.createDentist = async (req, res) => {
  try {
    const { email, password, fullName, specialization, city, phone, consultationFee } = req.body;
    if (!email || !password || !fullName) return fail(res, 400, 'Email, password and full name are required');
    if (await User.findOne({ email: email.toLowerCase() })) return fail(res, 400, 'Email already in use');
    const user = await User.create({ email: email.toLowerCase(), password, role: 'doctor', isAgreed: true });
    const profile = await DoctorProfile.create({
      userId: user._id, fullName,
      specialization: specialization || 'General',
      city: city || '', phone: phone || '',
      consultationFee: consultationFee || 1500,
    });
    ok(res, profile);
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Create: Patient ────────────────────────────────────────
// @route POST /api/admin/patients
exports.createPatient = async (req, res) => {
  try {
    const { email, password, fullName, mobileNumber, gender, city } = req.body;
    if (!email || !password || !fullName) return fail(res, 400, 'Email, password and full name are required');
    if (await User.findOne({ email: email.toLowerCase() })) return fail(res, 400, 'Email already in use');
    const user = await User.create({ email: email.toLowerCase(), password, role: 'patient', isAgreed: true });
    const profile = await PatientProfile.create({
      userId: user._id, fullName,
      mobileNumber: mobileNumber || '',
      gender: gender || null, city: city || '',
    });
    ok(res, profile);
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Create / Update: Treatment ─────────────────────────────
// @route POST /api/admin/treatments
exports.createTreatment = async (req, res) => {
  try {
    const { doctorId, name, priceMin, priceMax, isActive } = req.body;
    if (!doctorId || !name) return fail(res, 400, 'Dentist and treatment name are required');
    const t = await Treatment.create({
      doctorId, name,
      priceMin: priceMin || 0, priceMax: priceMax || 0,
      isActive: isActive !== false,
    });
    ok(res, t);
  } catch (e) { fail(res, 500, e.message); }
};

// @route PATCH /api/admin/treatments/:id
exports.updateTreatment = async (req, res) => {
  try {
    const allowed = ['name', 'priceMin', 'priceMax', 'isActive'];
    const update = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];
    const t = await Treatment.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!t) return fail(res, 404, 'Treatment not found');
    ok(res, t);
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Detail views ───────────────────────────────────────────
// @route GET /api/admin/dentists/:id
exports.getDentist = async (req, res) => {
  try {
    const doctor = await DoctorProfile.findById(req.params.id).populate('userId', 'email role createdAt').lean();
    if (!doctor) return fail(res, 404, 'Dentist not found');
    const [treatments, reviews, appointments, gallery, bills, commissionLog] = await Promise.all([
      Treatment.find({ doctorId: doctor._id }).lean(),
      Review.find({ doctorId: doctor._id }).populate('patientId', 'fullName profileImage').sort({ createdAt: -1 }).limit(10).lean(),
      Appointment.find({ doctorId: doctor._id }).populate('patientId', 'fullName').sort({ createdAt: -1 }).limit(10).lean(),
      Gallery.find({ doctorId: doctor._id }).lean(),
      Bill.find({ doctorId: doctor._id }).populate('patientId', 'fullName profileImage').sort({ createdAt: -1 }).lean(),
      CommissionLog.find({ doctorId: doctor._id }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    const ratingAgg = await Review.aggregate([
      { $match: { doctorId: doctor._id, hidden: { $ne: true } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
    ]);

    // Earnings: what this doctor has actually collected from patients (paidAmount,
    // falling back to finalAmount on paid bills) vs what's still billed/outstanding.
    const collected = bills.reduce((s, b) => s + (b.paidAmount || (b.status === 'paid' ? b.finalAmount : 0) || 0), 0);
    const billed = bills.reduce((s, b) => s + (b.finalAmount || 0), 0);

    // Commission: the platform's share of the doctor's collected billings.
    const settings = await getOrCreateSettings();
    const commissionRate = settings.commissionRate ?? 10;
    const commissionEarned = Math.round(collected * (commissionRate / 100));

    const earnings = {
      totalEarned: collected,
      totalBilled: billed,
      outstanding: Math.max(0, billed - collected),
      paidCount: bills.filter((b) => b.status === 'paid').length,
      billCount: bills.length,
      // Platform commission tracking.
      commissionRate,
      commissionEarned,                              // total platform share to date
      commissionDue: doctor.commissionDue || 0,      // currently outstanding (admin-managed)
      commissionPaid: doctor.commissionPaid || 0,    // cleared to date
    };

    // Attach per-bill platform commission (rate % of the paid/collected amount).
    const billsWithCommission = bills.slice(0, 20).map((b) => {
      const paid = b.paidAmount || (b.status === 'paid' ? b.finalAmount : 0) || 0;
      return { ...b, commission: Math.round(paid * (commissionRate / 100)) };
    });

    ok(res, {
      doctor,
      treatments, reviews, appointments, gallery,
      bills: billsWithCommission,
      earnings,
      commissionLog,
      rating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : 0,
      reviewCount: ratingAgg[0]?.n || 0,
    });
  } catch (e) { fail(res, 500, e.message); }
};

// @route GET /api/admin/patients/:id
exports.getPatient = async (req, res) => {
  try {
    const patient = await PatientProfile.findById(req.params.id).populate('userId', 'email role createdAt').lean();
    if (!patient) return fail(res, 404, 'Patient not found');
    const [appointments, bills, rewards] = await Promise.all([
      Appointment.find({ patientId: patient._id }).populate('doctorId', 'fullName photo').sort({ createdAt: -1 }).limit(10).lean(),
      Bill.find({ patientId: patient._id }).sort({ createdAt: -1 }).limit(10).lean(),
      Reward.find({ patientId: patient._id }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);
    const points = rewards.reduce((s, r) => s + (r.points || 0), 0);
    ok(res, { patient, appointments, bills, rewards, points });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── My profile / account ───────────────────────────────────
const AppSettings = require('../models/AppSettings');

// @route PATCH /api/admin/me  (update own admin profile)
exports.updateMyProfile = async (req, res) => {
  try {
    const { fullName, profileImage } = req.body;
    const update = {};
    if (fullName) update.fullName = fullName;
    if (profileImage !== undefined) update.profileImage = profileImage;
    const profile = await AdminProfile.findOneAndUpdate({ userId: req.user._id }, update, { new: true });
    if (!profile) return fail(res, 404, 'Admin profile not found');
    ok(res, profile);
  } catch (e) { fail(res, 500, e.message); }
};

// @route PATCH /api/admin/me/password
exports.changeMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return fail(res, 400, 'Current and new password are required');
    if (newPassword.length < 6) return fail(res, 400, 'New password must be at least 6 characters');
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword))) return fail(res, 400, 'Current password is incorrect');
    user.password = newPassword; // pre-save hook re-hashes
    await user.save();
    ok(res, { changed: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── App / system settings (singleton) ──────────────────────
const getOrCreateSettings = async () => {
  let s = await AppSettings.findOne({ key: 'global' });
  if (!s) s = await AppSettings.create({ key: 'global' });
  return s;
};

// @route GET /api/admin/settings
exports.getSettings = async (req, res) => {
  try { ok(res, await getOrCreateSettings()); }
  catch (e) { fail(res, 500, e.message); }
};

// @route PATCH /api/admin/settings  (super_admin only)
exports.updateSettings = async (req, res) => {
  try {
    const me = await AdminProfile.findOne({ userId: req.user._id });
    if (me?.adminRole !== 'super_admin') return fail(res, 403, 'Only super admins can change app settings');
    const s = await getOrCreateSettings();
    const allowed = ['rewardPointsPerAppointment', 'rewardPointValuePkr', 'defaultConsultationFee', 'supportEmail', 'maintenanceMode', 'payments', 'commissionRate', 'campaignRotationInterval', 'doctorCampaignRotationInterval'];
    for (const k of allowed) if (k in req.body) s[k] = req.body[k];
    await s.save();
    ok(res, s);
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Popular doctor management ──────────────────────────────
const { recomputePopular } = require('../utils/popular');

// @route PATCH /api/admin/dentists/:id/popular
// body: { action: 'grantPaid' | 'revoke' }  OR  { addPoints: <number> }
exports.setPopular = async (req, res) => {
  try {
    const doctor = await DoctorProfile.findById(req.params.id);
    if (!doctor) return fail(res, 404, 'Dentist not found');

    const { action, addPoints } = req.body;

    if (typeof addPoints === 'number') {
      doctor.rewardPoints = Math.max(0, (doctor.rewardPoints || 0) + addPoints);
      await recomputePopular(doctor); // may auto-grant/remove green
    } else if (action === 'grantPaid') {
      doctor.isPopular = true;
      doctor.popularType = 'paid';
      await doctor.save();
    } else if (action === 'revoke') {
      // Remove popular entirely; green will re-apply on next recompute if still >= threshold
      doctor.isPopular = false;
      doctor.popularType = null;
      await doctor.save();
      await recomputePopular(doctor);
    } else {
      return fail(res, 400, 'Provide action (grantPaid|revoke) or addPoints');
    }

    ok(res, doctor);
  } catch (e) { fail(res, 500, e.message); }
};

// @route GET /api/admin/popular-doctors  (for the Rewards & Payments screen)
exports.listPopularDoctors = async (req, res) => {
  try {
    const docs = await DoctorProfile.find({})
      .sort({ isPopular: -1, rewardPoints: -1 })
      .limit(200)
      .select('fullName photo specialization rewardPoints isPopular popularType city')
      .lean();
    ok(res, docs);
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Commission dues & blocking ─────────────────────────────
const COMMISSION_BLOCK_THRESHOLD = 50000;

// @route PATCH /api/admin/dentists/:id/commission
// body: { commissionDue } (set absolute) or { addCommission } (increment)
// Auto-blocks the doctor when dues reach the 50k threshold.
exports.setCommission = async (req, res) => {
  try {
    const doc = await DoctorProfile.findById(req.params.id);
    if (!doc) return fail(res, 404, 'Dentist not found');

    const before = doc.commissionDue || 0;
    let logType = 'set', delta = 0;
    if (typeof req.body.commissionDue === 'number') {
      doc.commissionDue = Math.max(0, req.body.commissionDue);
      logType = 'set'; delta = doc.commissionDue - before;
    } else if (typeof req.body.addCommission === 'number') {
      doc.commissionDue = Math.max(0, before + req.body.addCommission);
      logType = 'add'; delta = doc.commissionDue - before;
    }

    // Auto-block at threshold; clearing dues below threshold does NOT auto-unblock
    // (admin must explicitly unblock after verifying payment).
    if ((doc.commissionDue || 0) >= COMMISSION_BLOCK_THRESHOLD && !doc.isBlocked) {
      doc.isBlocked = true;
      doc.blockReason = `Outstanding commission dues of PKR ${doc.commissionDue.toLocaleString()} exceeded the limit. Clear dues and contact admin to unblock.`;
    }
    await doc.save();
    await logCommission(req, doc, { type: logType, amount: delta });
    await logAudit(req, { action: 'update', entity: 'dentist', entityId: doc._id, description: `Set commission dues for "${doc.fullName}" to PKR ${(doc.commissionDue || 0).toLocaleString()}` });
    ok(res, doc);
  } catch (e) { fail(res, 500, e.message); }
};

// @route PATCH /api/admin/dentists/:id/commission/sync
// Auto-set outstanding dues = (commission earned from collected bills) − already paid.
exports.syncDues = async (req, res) => {
  try {
    const doc = await DoctorProfile.findById(req.params.id);
    if (!doc) return fail(res, 404, 'Dentist not found');

    const bills = await Bill.find({ doctorId: doc._id }).select('finalAmount paidAmount status').lean();
    const collected = bills.reduce((s, b) => s + (b.paidAmount || (b.status === 'paid' ? b.finalAmount : 0) || 0), 0);
    const settings = await getOrCreateSettings();
    const rate = settings.commissionRate ?? 10;
    const earned = Math.round(collected * (rate / 100));
    const owed = Math.max(0, earned - (doc.commissionPaid || 0));

    doc.commissionDue = owed;
    if (owed >= COMMISSION_BLOCK_THRESHOLD && !doc.isBlocked) {
      doc.isBlocked = true;
      doc.blockReason = `Outstanding commission dues of PKR ${owed.toLocaleString()} exceeded the limit. Clear dues and contact admin to unblock.`;
    }
    await doc.save();
    await logCommission(req, doc, { type: 'sync', amount: owed, note: `${rate}% of ${collected.toLocaleString()} collected − ${(doc.commissionPaid || 0).toLocaleString()} paid` });
    await logAudit(req, { action: 'update', entity: 'dentist', entityId: doc._id, description: `Synced commission dues for "${doc.fullName}" to PKR ${owed.toLocaleString()}` });
    ok(res, { doc, owed, earned, collected, rate });
  } catch (e) { fail(res, 500, e.message); }
};

// @route PATCH /api/admin/dentists/:id/commission/clear
// Marks the doctor's outstanding commission dues as paid. Records the amount to
// commissionPaid (cumulative) and resets commissionDue to 0.
exports.clearDues = async (req, res) => {
  try {
    const doc = await DoctorProfile.findById(req.params.id);
    if (!doc) return fail(res, 404, 'Dentist not found');
    const cleared = doc.commissionDue || 0;
    if (cleared <= 0) return fail(res, 400, 'No outstanding dues to clear');
    doc.commissionPaid = (doc.commissionPaid || 0) + cleared;
    doc.commissionDue = 0;
    // Clearing dues below the block threshold auto-unblocks (dues were the reason).
    if (doc.isBlocked && /commission/i.test(doc.blockReason || '')) {
      doc.isBlocked = false;
      doc.blockReason = '';
    }
    await doc.save();
    await logCommission(req, doc, { type: 'clear', amount: cleared, note: req.body?.note || '' });
    await logAudit(req, { action: 'update', entity: 'dentist', entityId: doc._id, description: `Cleared PKR ${cleared.toLocaleString()} commission dues for "${doc.fullName}"` });
    ok(res, { doc, cleared });
  } catch (e) { fail(res, 500, e.message); }
};

// @route GET /api/admin/commission
// Platform-wide commission overview across all doctors.
exports.getCommissionOverview = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const rate = settings.commissionRate ?? 10;

    // Collected per doctor from bills.
    const collectedAgg = await Bill.aggregate([
      { $group: {
        _id: '$doctorId',
        collected: { $sum: { $ifNull: ['$paidAmount', { $cond: [{ $eq: ['$status', 'paid'] }, '$finalAmount', 0] }] } },
        billed: { $sum: '$finalAmount' },
      } },
    ]);
    const byDoctor = {};
    collectedAgg.forEach((c) => { byDoctor[String(c._id)] = c; });

    const doctors = await DoctorProfile.find().select('fullName photo city commissionDue commissionPaid isBlocked').lean();
    const rows = doctors.map((d) => {
      const agg = byDoctor[String(d._id)] || { collected: 0, billed: 0 };
      const earned = Math.round(agg.collected * (rate / 100));
      return {
        _id: d._id, fullName: d.fullName, photo: d.photo, city: d.city,
        collected: agg.collected, commissionEarned: earned,
        commissionPaid: d.commissionPaid || 0,
        commissionDue: d.commissionDue || 0,
        isBlocked: !!d.isBlocked,
      };
    }).sort((a, b) => b.commissionEarned - a.commissionEarned);

    const totals = rows.reduce((t, r) => ({
      earned: t.earned + r.commissionEarned,
      paid: t.paid + r.commissionPaid,
      due: t.due + r.commissionDue,
      collected: t.collected + r.collected,
    }), { earned: 0, paid: 0, due: 0, collected: 0 });

    ok(res, {
      rate,
      totals,
      overdueCount: rows.filter((r) => r.commissionDue > 0).length,
      doctors: rows,
    });
  } catch (e) { fail(res, 500, e.message); }
};

// @route PATCH /api/admin/dentists/:id/unblock  (admin clears the block)
exports.unblockDentist = async (req, res) => {
  try {
    const doc = await DoctorProfile.findByIdAndUpdate(
      req.params.id,
      { isBlocked: false, blockReason: '' },
      { new: true }
    );
    if (!doc) return fail(res, 404, 'Dentist not found');
    ok(res, doc);
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Analytics ──────────────────────────────────────────────
// @route GET /api/admin/analytics
// Richer time-series + breakdowns for the analytics dashboard.
exports.getAnalytics = async (req, res) => {
  try {
    // Custom date range (from/to) overrides the months preset.
    const { from, to } = req.query;
    let since, until = null, months = null;
    if (from) {
      since = new Date(from);
      until = new Date(to || Date.now());
      until.setHours(23, 59, 59, 999);
    } else {
      months = Math.min(24, Math.max(3, parseInt(req.query.months, 10) || 6));
      since = new Date();
      since.setMonth(since.getMonth() - (months - 1));
      since.setDate(1); since.setHours(0, 0, 0, 0);
    }
    const dateMatch = until ? { $gte: since, $lte: until } : { $gte: since };

    const monthGroup = (extra = {}) => ([
      { $match: { createdAt: dateMatch, ...extra } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const [apptSeries, patientSeries, dentistSeries, revenueAgg, statusAgg, cityAgg, topTreatments] = await Promise.all([
      Appointment.aggregate(monthGroup()),
      PatientProfile.aggregate(monthGroup()),
      DoctorProfile.aggregate(monthGroup()),
      // Revenue per month from paid bills.
      Bill.aggregate([
        { $match: { status: 'paid', createdAt: dateMatch } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, total: { $sum: { $ifNull: ['$paidAmount', '$finalAmount'] } } } },
        { $sort: { _id: 1 } },
      ]),
      // Appointment status breakdown (for a pie/donut).
      Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      // Patients by city (top 8).
      PatientProfile.aggregate([
        { $match: { city: { $nin: [null, ''] } } },
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 8 },
      ]),
      // Most-booked treatment types.
      Appointment.aggregate([
        { $match: { treatmentType: { $nin: [null, ''] } } },
        { $group: { _id: '$treatmentType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 8 },
      ]),
    ]);

    // ── Tier C insights ──
    const [topEarnersAgg, retentionAgg, commissionAgg] = await Promise.all([
      // Top-earning dentists by collected revenue.
      Bill.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: '$doctorId', revenue: { $sum: { $ifNull: ['$paidAmount', '$finalAmount'] } }, bills: { $sum: 1 } } },
        { $sort: { revenue: -1 } }, { $limit: 8 },
        { $lookup: { from: 'doctorprofiles', localField: '_id', foreignField: '_id', as: 'doc' } },
        { $unwind: { path: '$doc', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, revenue: 1, bills: 1, fullName: '$doc.fullName', photo: '$doc.photo', city: '$doc.city' } },
      ]),
      // Retention: patients with >=2 completed appointments vs >=1.
      Appointment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$patientId', visits: { $sum: 1 } } },
        { $group: { _id: null, withVisit: { $sum: 1 }, repeat: { $sum: { $cond: [{ $gte: ['$visits', 2] }, 1, 0] } } } },
      ]),
      // Platform commission totals (admin-managed dues/paid across dentists).
      DoctorProfile.aggregate([
        { $group: { _id: null, due: { $sum: { $ifNull: ['$commissionDue', 0] } }, paid: { $sum: { $ifNull: ['$commissionPaid', 0] } } } },
      ]),
    ]);
    const ret = retentionAgg[0] || { withVisit: 0, repeat: 0 };
    const comm = commissionAgg[0] || { due: 0, paid: 0 };

    ok(res, {
      months,
      range: { since, until: until || null },
      topEarningDentists: topEarnersAgg,
      retention: { withVisit: ret.withVisit, repeat: ret.repeat, rate: ret.withVisit ? Math.round((ret.repeat / ret.withVisit) * 100) : 0 },
      commissionTotals: { earned: comm.due + comm.paid, collected: comm.paid, outstanding: comm.due },
      appointmentSeries: apptSeries,
      patientSeries,
      dentistSeries,
      revenueSeries: revenueAgg,
      statusBreakdown: statusAgg,
      patientsByCity: cityAgg,
      topTreatments,
    });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Broadcast notifications ────────────────────────────────
// @route POST /api/admin/broadcast
// Body: { title, message, audience: 'all'|'patient'|'doctor' }
// Creates one Notification per targeted user (shows in their in-app inbox).
// Core sender — used by send-now and the scheduled processor. Returns count.
async function deliverBroadcast({ title, message, audience = 'all', city }) {
  const userQuery = audience === 'all' ? { role: { $in: ['patient', 'doctor'] } } : { role: audience };
  if (city && city.trim()) {
    const rx = { $regex: `^${city.trim()}$`, $options: 'i' };
    const [pp, dp] = await Promise.all([
      PatientProfile.find({ city: rx }).select('userId').lean(),
      DoctorProfile.find({ city: rx }).select('userId').lean(),
    ]);
    const ids = [...pp, ...dp].map((d) => d.userId).filter(Boolean);
    userQuery._id = { $in: ids };
  }
  const users = await User.find(userQuery).select('_id').lean();
  if (!users.length) return 0;
  await Notification.insertMany(users.map((u) => ({ userId: u._id, title, message, type: 'system' })));
  return users.length;
}

const ScheduledBroadcast = require('../models/ScheduledBroadcast');

exports.broadcast = async (req, res) => {
  try {
    const { title, message, audience = 'all', city, sendAt } = req.body;
    if (!title || !message) return fail(res, 400, 'Title and message are required');
    if (!['all', 'patient', 'doctor'].includes(audience)) return fail(res, 400, 'Invalid audience');

    // Schedule for later when a future sendAt is given.
    if (sendAt) {
      const when = new Date(sendAt);
      if (isNaN(when.getTime())) return fail(res, 400, 'Invalid schedule time');
      if (when.getTime() > Date.now() + 30000) {
        const sb = await ScheduledBroadcast.create({ title, message, audience, city: city || '', sendAt: when, createdBy: req.user._id });
        await logAudit(req, { action: 'broadcast', entity: 'notification', description: `Scheduled broadcast "${title}" for ${when.toLocaleString()} (${audience}${city ? `, ${city}` : ''})` });
        return ok(res, { scheduled: true, sendAt: when, id: sb._id });
      }
    }

    const sent = await deliverBroadcast({ title, message, audience, city });
    if (!sent) return fail(res, 404, 'No users found for this audience');
    await logAudit(req, { action: 'broadcast', entity: 'notification', description: `Broadcast "${title}" to ${sent} ${audience} user(s)` });
    ok(res, { sent, audience });
  } catch (e) { fail(res, 500, e.message); }
};

// @route GET /api/admin/scheduled-broadcasts  — list upcoming + recent
exports.listScheduledBroadcasts = async (req, res) => {
  try {
    const items = await ScheduledBroadcast.find().sort({ sendAt: -1 }).limit(50).lean();
    ok(res, items);
  } catch (e) { fail(res, 500, e.message); }
};

// @route DELETE /api/admin/scheduled-broadcasts/:id  — cancel a pending one
exports.cancelScheduledBroadcast = async (req, res) => {
  try {
    const sb = await ScheduledBroadcast.findById(req.params.id);
    if (!sb) return fail(res, 404, 'Scheduled broadcast not found');
    if (sb.status !== 'scheduled') return fail(res, 400, `Cannot cancel a ${sb.status} broadcast`);
    sb.status = 'cancelled';
    await sb.save();
    await logAudit(req, { action: 'update', entity: 'notification', entityId: sb._id, description: `Cancelled scheduled broadcast "${sb.title}"` });
    ok(res, sb);
  } catch (e) { fail(res, 500, e.message); }
};

// Send all due scheduled broadcasts. Shared by the admin "run now" button and
// the cron endpoint. Returns a summary.
async function runDueScheduledBroadcasts() {
  const due = await ScheduledBroadcast.find({ status: 'scheduled', sendAt: { $lte: new Date() } }).limit(50);
  let processed = 0, totalSent = 0;
  for (const sb of due) {
    try {
      const sent = await deliverBroadcast({ title: sb.title, message: sb.message, audience: sb.audience, city: sb.city });
      sb.status = 'sent'; sb.sentCount = sent; sb.sentAt = new Date();
      await sb.save();
      processed += 1; totalSent += sent;
    } catch (e) {
      sb.status = 'failed'; sb.error = e.message; await sb.save();
    }
  }
  return { processed, totalSent };
}
exports.runDueScheduledBroadcasts = runDueScheduledBroadcasts;

// @route POST /api/admin/scheduled-broadcasts/process  (admin manual trigger)
exports.processScheduledBroadcasts = async (req, res) => {
  try { ok(res, await runDueScheduledBroadcasts()); }
  catch (e) { fail(res, 500, e.message); }
};

// ─── Audit log ──────────────────────────────────────────────
// @route GET /api/admin/audit-logs
exports.listAuditLogs = async (req, res) => {
  try {
    const { page, limit, action, entity, from, to } = req.query;
    const query = {};
    if (action && action !== 'all') query.action = action;
    if (entity && entity !== 'all') query.entity = entity;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); query.createdAt.$lte = end; }
    }
    const result = await paginate(AuditLog, { query, page, limit });
    const counts = {
      total: await AuditLog.countDocuments(),
      deletes: await AuditLog.countDocuments({ action: 'delete' }),
      broadcasts: await AuditLog.countDocuments({ action: 'broadcast' }),
    };
    ok(res, result.data, { total: result.total, page: result.page, pages: result.pages, counts });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Patient suspend / ban ──────────────────────────────────
// @route PATCH /api/admin/patients/:id/block   body: { reason }
exports.blockPatient = async (req, res) => {
  try {
    const p = await PatientProfile.findByIdAndUpdate(
      req.params.id,
      { isBlocked: true, blockReason: req.body.reason || '' },
      { new: true }
    );
    if (!p) return fail(res, 404, 'Patient not found');
    await logAudit(req, { action: 'block', entity: 'patient', entityId: p._id, description: `Suspended patient "${p.fullName}"${req.body.reason ? ` — ${req.body.reason}` : ''}` });
    ok(res, p);
  } catch (e) { fail(res, 500, e.message); }
};

// @route PATCH /api/admin/patients/:id/unblock
exports.unblockPatient = async (req, res) => {
  try {
    const p = await PatientProfile.findByIdAndUpdate(
      req.params.id,
      { isBlocked: false, blockReason: '' },
      { new: true }
    );
    if (!p) return fail(res, 404, 'Patient not found');
    await logAudit(req, { action: 'unblock', entity: 'patient', entityId: p._id, description: `Reinstated patient "${p.fullName}"` });
    ok(res, p);
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Bill refund ────────────────────────────────────────────
// @route PATCH /api/admin/bills/:id/refund   body: { reason }
exports.refundBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return fail(res, 404, 'Bill not found');
    if (bill.status === 'refunded') return fail(res, 400, 'Bill is already refunded');
    bill.status = 'refunded';
    bill.refundReason = req.body.reason || '';
    bill.refundedAt = new Date();
    await bill.save();
    await logAudit(req, { action: 'refund', entity: 'bill', entityId: bill._id, description: `Refunded bill ${bill.invoiceNumber} (PKR ${(bill.finalAmount || bill.amount || 0).toLocaleString()})${req.body.reason ? ` — ${req.body.reason}` : ''}` });
    const populated = await Bill.findById(bill._id)
      .populate('patientId', 'fullName profileImage')
      .populate('doctorId', 'fullName photo');
    ok(res, populated);
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Global search (topbar) ─────────────────────────────────
// @route GET /api/admin/search?q=...
exports.globalSearch = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return ok(res, { dentists: [], patients: [], bills: [] });
    const rx = { $regex: q, $options: 'i' };
    const [dentists, patients, bills] = await Promise.all([
      DoctorProfile.find({ $or: [{ fullName: rx }, { clinicName: rx }] })
        .select('fullName clinicName city photo').limit(6).lean(),
      PatientProfile.find({ $or: [{ fullName: rx }, { mobileNumber: rx }] })
        .select('fullName mobileNumber city profileImage').limit(6).lean(),
      Bill.find({ $or: [{ invoiceNumber: rx }, { treatmentName: rx }] })
        .select('invoiceNumber treatmentName finalAmount amount status').limit(6).lean(),
    ]);
    ok(res, { dentists, patients, bills });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Review moderation ──────────────────────────────────────
// @route PATCH /api/admin/reviews/:id   body: { hidden }
exports.moderateReview = async (req, res) => {
  try {
    const r = await Review.findByIdAndUpdate(
      req.params.id,
      { hidden: !!req.body.hidden },
      { new: true }
    ).populate('patientId', 'fullName profileImage').populate('doctorId', 'fullName photo');
    if (!r) return fail(res, 404, 'Review not found');
    await logAudit(req, { action: req.body.hidden ? 'hide' : 'unhide', entity: 'review', entityId: r._id, description: `${req.body.hidden ? 'Hid' : 'Unhid'} a ${r.rating}★ review` });
    ok(res, r);
  } catch (e) { fail(res, 500, e.message); }
};

// @route PATCH /api/admin/reviews/:id/reply   body: { text }
exports.replyReview = async (req, res) => {
  try {
    const text = (req.body.text || '').trim();
    const r = await Review.findByIdAndUpdate(
      req.params.id,
      { doctorReply: { text, repliedAt: text ? new Date() : null } },
      { new: true }
    ).populate('patientId', 'fullName profileImage').populate('doctorId', 'fullName photo');
    if (!r) return fail(res, 404, 'Review not found');
    await logAudit(req, { action: 'update', entity: 'review', entityId: r._id, description: text ? `Replied to a review on behalf of ${r.doctorId?.fullName || 'doctor'}` : `Cleared reply on a review` });
    ok(res, r);
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Impersonation / "View as" ──────────────────────────────
// @route POST /api/admin/impersonate/:userId  (super admin only)
// Mints a SHORT-LIVED user token so a super admin can view the app as that
// user for support. Audit-logged; the minted token carries imp/impBy claims.
const jwt = require('jsonwebtoken');
exports.impersonateUser = async (req, res) => {
  try {
    const me = await AdminProfile.findOne({ userId: req.user._id });
    if (me?.adminRole !== 'super_admin') return fail(res, 403, 'Only super admins can impersonate users');

    const user = await User.findById(req.params.userId).select('role');
    if (!user) return fail(res, 404, 'User not found');
    if (!['patient', 'doctor'].includes(user.role)) return fail(res, 400, 'Only patient or doctor accounts can be viewed');

    const token = jwt.sign(
      { id: user._id, imp: true, impBy: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    // Friendly label for the audit log + admin UI.
    let name = '';
    if (user.role === 'doctor') name = (await DoctorProfile.findOne({ userId: user._id }).select('fullName').lean())?.fullName || '';
    else name = (await PatientProfile.findOne({ userId: user._id }).select('fullName').lean())?.fullName || '';

    await logAudit(req, { action: 'impersonate', entity: user.role, entityId: user._id, description: `Impersonated ${user.role} "${name || user._id}" (30-min session)` });
    ok(res, { token, role: user.role, name });
  } catch (e) { fail(res, 500, e.message); }
};

// ─── Reset a dentist's login password (super admin) ─────────
const crypto = require('crypto');
// @route PATCH /api/admin/dentists/:id/reset-password   body: { password? }
// Sets a new password (admin-provided or auto-generated) on the dentist's User
// account and returns it ONCE so the admin can share it. Passwords are hashed
// (pre-save hook) — the existing password cannot be read back.
exports.resetDentistPassword = async (req, res) => {
  try {
    const me = await AdminProfile.findOne({ userId: req.user._id });
    if (me?.adminRole !== 'super_admin') return fail(res, 403, 'Only super admins can reset passwords');

    const doctor = await DoctorProfile.findById(req.params.id).select('userId fullName').lean();
    if (!doctor) return fail(res, 404, 'Dentist not found');
    const user = await User.findById(doctor.userId).select('+password');
    if (!user) return fail(res, 404, 'Login account not found for this dentist');

    let newPassword = (req.body.password || '').trim();
    if (!newPassword) newPassword = 'Dent' + crypto.randomBytes(4).toString('hex'); // e.g. Dent3f9a1c20
    if (newPassword.length < 6) return fail(res, 400, 'Password must be at least 6 characters');

    user.password = newPassword; // hashed by the pre-save hook
    await user.save();

    await logAudit(req, { action: 'reset-password', entity: 'dentist', entityId: doctor._id, description: `Reset login password for dentist "${doctor.fullName}"` });
    ok(res, { password: newPassword, email: user.email });
  } catch (e) { fail(res, 500, e.message); }
};
