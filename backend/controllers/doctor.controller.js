const prisma = require('../config/prisma');
const { serialize, remapMany } = require('../utils/serialize');

// Per-doctor treatment count + rating aggregate.
async function enrich(doctor) {
  const [treatmentsCount, ratingAgg] = await Promise.all([
    prisma.treatment.count({ where: { doctorId: doctor.id } }),
    prisma.review.aggregate({ where: { doctorId: doctor.id, hidden: false }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  return {
    ...doctor,
    treatmentsCount,
    avgRating: ratingAgg._count._all > 0 ? Math.round((ratingAgg._avg.rating || 0) * 10) / 10 : 0,
    totalReviews: ratingAgg._count._all,
  };
}

const popularRank = (d) => (d.popularType === 'paid' ? 2 : d.popularType === 'earned' ? 1 : 0);

// @desc    List all doctors with pagination and filters
// @route   GET /api/doctors
// @access  Public
const getDoctors = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const where = { isBlocked: false };
    if (req.query.specialization) where.specialization = req.query.specialization;
    if (req.query.clinicTier) where.clinicTier = req.query.clinicTier;
    if (req.query.pmdcVerified !== undefined) where.pmdcVerified = req.query.pmdcVerified === 'true';
    if (req.query.city) where.city = { contains: req.query.city, mode: 'insensitive' };

    // Popular (paid > earned > none) then facilityScore. Sorted in JS so the
    // computed popularRank ordering is exact; dataset is small enough.
    const all = await prisma.doctorProfile.findMany({ where, include: { user: { select: { email: true, role: true } } } });
    all.sort((a, b) => popularRank(b) - popularRank(a) || (b.facilityScore || 0) - (a.facilityScore || 0));

    const total = all.length;
    const pageItems = all.slice(skip, skip + limit);
    const enriched = await Promise.all(pageItems.map(enrich));

    res.status(200).json({
      success: true,
      count: enriched.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: serialize(remapMany(enriched, { user: 'userId' })),
    });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching doctors' });
  }
};

// @desc    Get nearby doctors (haversine on lat/lng)
// @route   GET /api/doctors/nearby
// @access  Public
const getNearbyDoctors = async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'Please provide lat and lng query parameters' });

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = parseFloat(radius) || 10;
    if (isNaN(latitude) || isNaN(longitude)) return res.status(400).json({ success: false, message: 'lat and lng must be valid numbers' });
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ success: false, message: 'lat must be between -90 and 90, lng between -180 and 180' });
    }

    // Haversine (km) on the doctor's lat/lng, within radius, nearest first.
    const rows = await prisma.$queryRaw`
      SELECT * FROM (
        SELECT d.*, (6371 * acos(LEAST(1.0,
          cos(radians(${latitude})) * cos(radians(d.lat)) * cos(radians(d.lng) - radians(${longitude}))
          + sin(radians(${latitude})) * sin(radians(d.lat))
        ))) AS distance
        FROM "DoctorProfile" d
        WHERE d."isBlocked" = false AND d.lat IS NOT NULL AND d.lng IS NOT NULL
      ) t
      WHERE t.distance <= ${radiusKm}
      ORDER BY t.distance ASC
    `;

    // Attach the minimal user info (email, role) like the old $lookup did.
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, role: true } });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const results = rows.map((r) => ({
      ...r,
      user: userMap.get(r.userId) ? { email: userMap.get(r.userId).email, role: userMap.get(r.userId).role } : null,
      distanceKm: Math.round((r.distance || 0) * 100) / 100,
    }));

    res.status(200).json({ success: true, count: results.length, data: serialize(results) });
  } catch (error) {
    console.error('Get nearby doctors error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching nearby doctors' });
  }
};

// @desc    Search doctors by name, clinic, or specialization
// @route   GET /api/doctors/search
// @access  Public
const searchDoctors = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) return res.status(400).json({ success: false, message: 'Please provide a search query (q parameter)' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const term = q.trim();

    const where = {
      isBlocked: false,
      OR: [
        { fullName: { contains: term, mode: 'insensitive' } },
        { clinicName: { contains: term, mode: 'insensitive' } },
        { specialization: { contains: term, mode: 'insensitive' } },
      ],
    };

    const [total, doctors] = await Promise.all([
      prisma.doctorProfile.count({ where }),
      prisma.doctorProfile.findMany({
        where,
        orderBy: { facilityScore: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { email: true, role: true } } },
      }),
    ]);

    res.status(200).json({
      success: true,
      count: doctors.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: serialize(remapMany(doctors, { user: 'userId' })),
    });
  } catch (error) {
    console.error('Search doctors error:', error);
    res.status(500).json({ success: false, message: 'Server error while searching doctors' });
  }
};

// @desc    Get single doctor by ID
// @route   GET /api/doctors/:id
// @access  Public
const getDoctorById = async (req, res) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { email: true, role: true } } },
    });
    if (!doctor || doctor.isBlocked) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const [data] = serialize(remapMany([doctor], { user: 'userId' }));
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Get doctor by ID error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching doctor' });
  }
};

// @desc    Get services for a specific doctor
// @route   GET /api/doctors/:id/services
// @access  Public
const getDoctorServices = async (req, res) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: req.params.id }, select: { id: true, services: true, fullName: true, isBlocked: true } });
    if (!doctor || doctor.isBlocked) return res.status(404).json({ success: false, message: 'Doctor not found' });

    res.status(200).json({
      success: true,
      count: (doctor.services || []).length,
      data: { doctorId: doctor.id, fullName: doctor.fullName, services: doctor.services || [] },
    });
  } catch (error) {
    console.error('Get doctor services error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching doctor services' });
  }
};

// @desc    Get doctor stats (rating aggregation)
// @route   GET /api/doctors/:id/stats
// @access  Public
const getDoctorStats = async (req, res) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: req.params.id }, select: { id: true, fullName: true, isBlocked: true } });
    if (!doctor || doctor.isBlocked) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const where = { doctorId: doctor.id, hidden: false };
    const [agg, dist, recommendCount] = await Promise.all([
      prisma.review.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
      prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true } }),
      prisma.review.count({ where: { ...where, rating: { gte: 4 } } }),
    ]);

    const totalReviews = agg._count._all;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    dist.forEach((d) => { if (d.rating >= 1 && d.rating <= 5) ratingDistribution[d.rating] = d._count._all; });

    res.status(200).json({
      success: true,
      data: {
        doctorId: doctor.id,
        fullName: doctor.fullName,
        avgRating: totalReviews > 0 ? Math.round((agg._avg.rating || 0) * 10) / 10 : 0,
        totalReviews,
        ratingDistribution,
        recommendPercentage: totalReviews > 0 ? Math.round((recommendCount / totalReviews) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('Get doctor stats error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching doctor stats' });
  }
};

module.exports = { getDoctors, getNearbyDoctors, searchDoctors, getDoctorById, getDoctorServices, getDoctorStats };
