const prisma = require('../config/prisma');
const { serialize } = require('../utils/serialize');

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
  if (out.startAt) out.startAt = new Date(out.startAt);
  if (out.endAt) out.endAt = new Date(out.endAt);
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

// Match: no cities targeted (empty) OR the city is in the list.
const cityMatch = (city) => ({ OR: [{ cities: { isEmpty: true } }, { cities: { has: city } }] });

// ── Admin: list all doctor campaigns with analytics ──
exports.listCampaigns = async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({ where: { targetAudience: { not: 'patient' } }, orderBy: { createdAt: 'desc' } });
    const data = withAnalytics(serialize(campaigns));
    ok(res, data, { counts: buildCounts(data) });
  } catch (e) { fail(res, 500, e.message); }
};

exports.getCampaign = async (req, res) => {
  try {
    const c = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!c) return fail(res, 404, 'Campaign not found');
    const out = serialize(c);
    out.ctr = out.views ? Math.round((out.clicks / out.views) * 1000) / 10 : 0;
    ok(res, out);
  } catch (e) { fail(res, 500, e.message); }
};

exports.createCampaign = async (req, res) => {
  try {
    const fields = pickFields(req.body);
    if (!fields.title) return fail(res, 400, 'Title is required');
    if (!fields.startAt || !fields.endAt) return fail(res, 400, 'Start and end dates are required');
    const c = await prisma.campaign.create({ data: fields });
    ok(res, serialize(c));
  } catch (e) { fail(res, 500, e.message); }
};

exports.updateCampaign = async (req, res) => {
  try {
    const c = await prisma.campaign.update({ where: { id: req.params.id }, data: pickFields(req.body) }).catch(() => null);
    if (!c) return fail(res, 404, 'Campaign not found');
    ok(res, serialize(c));
  } catch (e) { fail(res, 500, e.message); }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const c = await prisma.campaign.delete({ where: { id: req.params.id } }).catch(() => null);
    if (!c) return fail(res, 404, 'Campaign not found');
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ── Doctor: single active banner ──
exports.getActiveForDoctor = async (req, res) => {
  try {
    const profile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id }, select: { city: true } });
    const city = profile?.city || '';
    const now = new Date();

    const campaign = await prisma.campaign.findFirst({
      where: { isActive: true, startAt: { lte: now }, endAt: { gte: now }, ...cityMatch(city) },
      orderBy: { createdAt: 'desc' },
    });
    if (!campaign) return ok(res, null);

    prisma.campaign.update({ where: { id: campaign.id }, data: { views: { increment: 1 } } }).catch(() => {});
    ok(res, serialize(campaign));
  } catch (e) { fail(res, 500, e.message); }
};

// ── Doctor: all active campaigns for rotation ──
exports.getActiveAllForDoctor = async (req, res) => {
  try {
    const profile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id }, select: { city: true } });
    const city = profile?.city || '';
    const now = new Date();

    const campaigns = await prisma.campaign.findMany({
      where: { isActive: true, targetAudience: { not: 'patient' }, startAt: { lte: now }, endAt: { gte: now }, ...cityMatch(city) },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const settings = await prisma.appSettings.findUnique({ where: { key: 'global' } });
    const rotationInterval = settings?.doctorCampaignRotationInterval ?? settings?.campaignRotationInterval ?? 10;
    if (!campaigns.length) return ok(res, { campaigns: [], rotationInterval });
    prisma.campaign.updateMany({ where: { id: { in: campaigns.map((c) => c.id) } }, data: { views: { increment: 1 } } }).catch(() => {});
    ok(res, { campaigns: serialize(campaigns), rotationInterval });
  } catch (e) { fail(res, 500, e.message); }
};

exports.recordClick = async (req, res) => {
  try {
    const c = await prisma.campaign.update({ where: { id: req.params.id }, data: { clicks: { increment: 1 } } }).catch(() => null);
    if (!c) return fail(res, 404, 'Campaign not found');
    ok(res, { clicks: c.clicks });
  } catch (e) { fail(res, 500, e.message); }
};

// ── Admin: patient campaigns ──
exports.listPatientCampaigns = async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({ where: { targetAudience: 'patient' }, orderBy: { createdAt: 'desc' } });
    const data = withAnalytics(serialize(campaigns));
    ok(res, data, { counts: buildCounts(data) });
  } catch (e) { fail(res, 500, e.message); }
};

exports.createPatientCampaign = async (req, res) => {
  try {
    const fields = pickFields(req.body);
    fields.targetAudience = 'patient';
    if (!fields.title) return fail(res, 400, 'Title is required');
    if (!fields.startAt || !fields.endAt) return fail(res, 400, 'Start and end dates are required');
    const c = await prisma.campaign.create({ data: fields });
    ok(res, serialize(c));
  } catch (e) { fail(res, 500, e.message); }
};

exports.updatePatientCampaign = async (req, res) => {
  try {
    const existing = await prisma.campaign.findFirst({ where: { id: req.params.id, targetAudience: 'patient' } });
    if (!existing) return fail(res, 404, 'Campaign not found');
    const c = await prisma.campaign.update({ where: { id: req.params.id }, data: pickFields(req.body) });
    ok(res, serialize(c));
  } catch (e) { fail(res, 500, e.message); }
};

exports.deletePatientCampaign = async (req, res) => {
  try {
    const existing = await prisma.campaign.findFirst({ where: { id: req.params.id, targetAudience: 'patient' } });
    if (!existing) return fail(res, 404, 'Campaign not found');
    await prisma.campaign.delete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
  } catch (e) { fail(res, 500, e.message); }
};

// ── Patient-facing: active campaigns ──
exports.getActiveForPatient = async (req, res) => {
  try {
    const profile = await prisma.patientProfile.findUnique({ where: { userId: req.user._id }, select: { city: true } });
    const city = profile?.city || '';
    const now = new Date();

    const campaigns = await prisma.campaign.findMany({
      where: { targetAudience: 'patient', isActive: true, startAt: { lte: now }, endAt: { gte: now }, ...cityMatch(city) },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const settings = await prisma.appSettings.findUnique({ where: { key: 'global' } });
    const rotationInterval = settings?.campaignRotationInterval ?? 10;
    if (!campaigns.length) return ok(res, { campaigns: [], rotationInterval });
    prisma.campaign.updateMany({ where: { id: { in: campaigns.map((c) => c.id) } }, data: { views: { increment: 1 } } }).catch(() => {});
    ok(res, { campaigns: serialize(campaigns), rotationInterval });
  } catch (e) { fail(res, 500, e.message); }
};

exports.recordPatientClick = async (req, res) => {
  try {
    const c = await prisma.campaign.update({ where: { id: req.params.id }, data: { clicks: { increment: 1 } } }).catch(() => null);
    if (!c) return fail(res, 404, 'Campaign not found');
    ok(res, { clicks: c.clicks });
  } catch (e) { fail(res, 500, e.message); }
};
