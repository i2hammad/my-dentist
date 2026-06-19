const Campaign = require('../models/Campaign');
const DoctorProfile = require('../models/DoctorProfile');
const PatientProfile = require('../models/PatientProfile');

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, code, message) => res.status(code).json({ success: false, message });

const ALLOWED = [
  'title', 'bannerText', 'body', 'medicineName', 'company',
  'bannerImage', 'detailImage', 'ctaLabel', 'ctaLink', 'cities',
  'startAt', 'endAt', 'isActive', 'targetAudience',
];
const pickFields = (body) => {
  const out = {};
  for (const k of ALLOWED) if (k in body) out[k] = body[k];
  return out;
};

const withAnalytics = (campaigns) => {
  const now = new Date();
  return campaigns.map((c) => ({
    ...c,
    ctr: c.views ? Math.round((c.clicks / c.views) * 1000) / 10 : 0,
    live: c.isActive && new Date(c.startAt) <= now && new Date(c.endAt) >= now,
  }));
};

const buildCounts = (data) => ({
  total: data.length,
  live: data.filter((c) => c.live).length,
  totalViews: data.reduce((s, c) => s + (c.views || 0), 0),
  totalClicks: data.reduce((s, c) => s + (c.clicks || 0), 0),
});

// ── Admin: list all campaigns with analytics ──
// GET /api/campaigns/admin
exports.listCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ targetAudience: { $ne: 'patient' } }).sort({ createdAt: -1 }).lean();
    const now = new Date();
    const data = withAnalytics(campaigns);
    ok(res, data, { counts: buildCounts(data) });
  } catch (e) { fail(res, 500, e.message); }
};

// GET /api/campaigns/admin/:id
exports.getCampaign = async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id).lean();
    if (!c) return fail(res, 404, 'Campaign not found');
    c.ctr = c.views ? Math.round((c.clicks / c.views) * 1000) / 10 : 0;
    ok(res, c);
  } catch (e) { fail(res, 500, e.message); }
};

// POST /api/campaigns/admin
exports.createCampaign = async (req, res) => {
  try {
    const fields = pickFields(req.body);
    if (!fields.title) return fail(res, 400, 'Title is required');
    if (!fields.startAt || !fields.endAt) return fail(res, 400, 'Start and end dates are required');
    const c = await Campaign.create(fields);
    ok(res, c);
  } catch (e) { fail(res, 500, e.message); }
};

// PATCH /api/campaigns/admin/:id
exports.updateCampaign = async (req, res) => {
  try {
    const c = await Campaign.findByIdAndUpdate(req.params.id, pickFields(req.body), { new: true, runValidators: true });
    if (!c) return fail(res, 404, 'Campaign not found');
    ok(res, c);
  } catch (e) { fail(res, 500, e.message); }
};

// DELETE /api/campaigns/admin/:id
exports.deleteCampaign = async (req, res) => {
  try {
    const c = await Campaign.findByIdAndDelete(req.params.id);
    if (!c) return fail(res, 404, 'Campaign not found');
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ── Doctor: get the active banner for this doctor (city-filtered, in window) ──
// GET /api/campaigns/active   (protected; doctor)
// Records a view for the served campaign.
exports.getActiveForDoctor = async (req, res) => {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user._id }).select('city').lean();
    const city = profile?.city || '';
    const now = new Date();

    // Live campaigns: active, within window, and (no cities targeted OR includes doctor's city).
    const campaign = await Campaign.findOne({
      isActive: true,
      startAt: { $lte: now },
      endAt: { $gte: now },
      $or: [{ cities: { $size: 0 } }, { cities: city }],
    }).sort({ createdAt: -1 });

    if (!campaign) return ok(res, null);

    // Count a view (best-effort, non-blocking shape).
    Campaign.updateOne({ _id: campaign._id }, { $inc: { views: 1 } }).catch(() => {});

    ok(res, campaign);
  } catch (e) { fail(res, 500, e.message); }
};

// POST /api/campaigns/:id/click  (protected; doctor) — records a click.
exports.recordClick = async (req, res) => {
  try {
    const c = await Campaign.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } }, { new: true });
    if (!c) return fail(res, 404, 'Campaign not found');
    ok(res, { clicks: c.clicks });
  } catch (e) { fail(res, 500, e.message); }
};

// ── Admin: patient campaigns ──
// GET /api/campaigns/patient-admin
exports.listPatientCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ targetAudience: 'patient' }).sort({ createdAt: -1 }).lean();
    const data = withAnalytics(campaigns);
    ok(res, data, { counts: buildCounts(data) });
  } catch (e) { fail(res, 500, e.message); }
};

// POST /api/campaigns/patient-admin
exports.createPatientCampaign = async (req, res) => {
  try {
    const fields = pickFields(req.body);
    fields.targetAudience = 'patient';
    if (!fields.title) return fail(res, 400, 'Title is required');
    if (!fields.startAt || !fields.endAt) return fail(res, 400, 'Start and end dates are required');
    const c = await Campaign.create(fields);
    ok(res, c);
  } catch (e) { fail(res, 500, e.message); }
};

// PATCH /api/campaigns/patient-admin/:id
exports.updatePatientCampaign = async (req, res) => {
  try {
    const c = await Campaign.findOneAndUpdate(
      { _id: req.params.id, targetAudience: 'patient' },
      pickFields(req.body),
      { new: true, runValidators: true }
    );
    if (!c) return fail(res, 404, 'Campaign not found');
    ok(res, c);
  } catch (e) { fail(res, 500, e.message); }
};

// DELETE /api/campaigns/patient-admin/:id
exports.deletePatientCampaign = async (req, res) => {
  try {
    const c = await Campaign.findOneAndDelete({ _id: req.params.id, targetAudience: 'patient' });
    if (!c) return fail(res, 404, 'Campaign not found');
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ── Patient-facing: active campaign ──
// GET /api/campaigns/active-patient  (protected; patient)
exports.getActiveForPatient = async (req, res) => {
  try {
    const profile = await PatientProfile.findOne({ userId: req.user._id }).select('city').lean();
    const city = profile?.city || '';
    const now = new Date();

    const campaign = await Campaign.findOne({
      targetAudience: 'patient',
      isActive: true,
      startAt: { $lte: now },
      endAt: { $gte: now },
      $or: [{ cities: { $size: 0 } }, { cities: city }],
    }).sort({ createdAt: -1 });

    if (!campaign) return ok(res, null);
    Campaign.updateOne({ _id: campaign._id }, { $inc: { views: 1 } }).catch(() => {});
    ok(res, campaign);
  } catch (e) { fail(res, 500, e.message); }
};

// POST /api/campaigns/:id/patient-click  (protected; patient)
exports.recordPatientClick = async (req, res) => {
  try {
    const c = await Campaign.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } }, { new: true });
    if (!c) return fail(res, 404, 'Campaign not found');
    ok(res, { clicks: c.clicks });
  } catch (e) { fail(res, 500, e.message); }
};
