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

    // Top dentists by review count + rating
    const topAgg = await Review.aggregate([
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
    const allowed = ['pmdcVerified', 'clinicTier', 'fullName', 'specialization'];
    const update = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];
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
    const { page, limit } = req.query;
    const result = await paginate(Review, {
      query: {}, page, limit,
      populate: [
        { path: 'patientId', select: 'fullName profileImage' },
        { path: 'doctorId', select: 'fullName photo' },
      ],
    });
    const ratingAgg = await Review.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }]);
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
    const { page, limit, status } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    const result = await paginate(Bill, {
      query, page, limit,
      populate: [
        { path: 'patientId', select: 'fullName profileImage' },
        { path: 'doctorId', select: 'fullName photo' },
      ],
    });
    const allBills = await Bill.find().select('finalAmount status').lean();
    const counts = {
      total: await Bill.countDocuments(),
      paid: await Bill.countDocuments({ status: 'paid' }),
      pending: await Bill.countDocuments({ status: { $ne: 'paid' } }),
      totalAmount: allBills.reduce((s, b) => s + (b.finalAmount || 0), 0),
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
    const [treatments, reviews, appointments, gallery] = await Promise.all([
      Treatment.find({ doctorId: doctor._id }).lean(),
      Review.find({ doctorId: doctor._id }).populate('patientId', 'fullName profileImage').sort({ createdAt: -1 }).limit(10).lean(),
      Appointment.find({ doctorId: doctor._id }).populate('patientId', 'fullName').sort({ createdAt: -1 }).limit(10).lean(),
      Gallery.find({ doctorId: doctor._id }).lean(),
    ]);
    const ratingAgg = await Review.aggregate([
      { $match: { doctorId: doctor._id } },
      { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
    ]);
    ok(res, {
      doctor,
      treatments, reviews, appointments, gallery,
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
    const allowed = ['rewardPointsPerAppointment', 'rewardPointValuePkr', 'defaultConsultationFee', 'supportEmail', 'maintenanceMode', 'payments'];
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
