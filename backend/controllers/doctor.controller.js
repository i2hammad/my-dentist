const mongoose = require('mongoose');
const DoctorProfile = require('../models/DoctorProfile');
const Treatment = require('../models/Treatment');

// Lazy-load Review model (may not exist yet)
const getReviewModel = () => {
  try {
    return mongoose.model('Review');
  } catch {
    try {
      return require('../models/Review');
    } catch {
      return null;
    }
  }
};

// @desc    List all doctors with pagination and filters
// @route   GET /api/doctors
// @access  Public
const getDoctors = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};

    if (req.query.specialization) {
      filter.specialization = req.query.specialization;
    }

    if (req.query.clinicTier) {
      filter.clinicTier = req.query.clinicTier;
    }

    if (req.query.pmdcVerified !== undefined) {
      filter.pmdcVerified = req.query.pmdcVerified === 'true';
    }

    if (req.query.city) {
      filter.city = { $regex: new RegExp(req.query.city, 'i') };
    }

    // Get total count for pagination
    const total = await DoctorProfile.countDocuments(filter);

    // Popular doctors rank to the top: paid (blue) first, then earned (green),
    // then everyone else — each tier ordered by facilityScore.
    const doctors = await DoctorProfile.aggregate([
      { $match: filter },
      {
        $addFields: {
          popularRank: {
            $switch: {
              branches: [
                { case: { $eq: ['$popularType', 'paid'] }, then: 2 },
                { case: { $eq: ['$popularType', 'earned'] }, then: 1 },
              ],
              default: 0,
            },
          },
        },
      },
      { $sort: { popularRank: -1, facilityScore: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);
    // Populate userId (aggregate doesn't auto-populate)
    await DoctorProfile.populate(doctors, { path: 'userId', select: 'email role' });

    // Enrich with treatment count and average rating
    const Review = getReviewModel();
    const enrichedDoctors = await Promise.all(
      doctors.map(async (doctor) => {
        // Count treatments
        const treatmentsCount = await Treatment.countDocuments({ doctorId: doctor._id });

        // Average rating from reviews
        let avgRating = 0;
        let totalReviews = 0;

        if (Review) {
          const ratingAgg = await Review.aggregate([
            { $match: { doctorId: doctor._id } },
            {
              $group: {
                _id: null,
                avgRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 }
              }
            }
          ]);

          if (ratingAgg.length > 0) {
            avgRating = Math.round(ratingAgg[0].avgRating * 10) / 10;
            totalReviews = ratingAgg[0].totalReviews;
          }
        }

        return {
          ...doctor,
          treatmentsCount,
          avgRating,
          totalReviews
        };
      })
    );

    res.status(200).json({
      success: true,
      count: enrichedDoctors.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: enrichedDoctors
    });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching doctors'
    });
  }
};

// @desc    Get nearby doctors (geospatial query)
// @route   GET /api/doctors/nearby
// @access  Public
const getNearbyDoctors = async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Please provide lat and lng query parameters'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = parseFloat(radius) || 10;

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'lat and lng must be valid numbers'
      });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'lat must be between -90 and 90, lng between -180 and 180'
      });
    }

    // Convert radius from km to meters for $maxDistance
    const radiusMeters = radiusKm * 1000;

    const doctors = await DoctorProfile.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          distanceField: 'distance',
          maxDistance: radiusMeters,
          spherical: true
        }
      },
      {
        $sort: { distance: 1 }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { email: 1, role: 1 } }]
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      }
    ]);

    // Convert distance from meters to km for response
    const results = doctors.map((doc) => ({
      ...doc,
      distanceKm: Math.round((doc.distance / 1000) * 100) / 100
    }));

    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('Get nearby doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching nearby doctors'
    });
  }
};

// @desc    Search doctors by name, clinic, or specialization
// @route   GET /api/doctors/search
// @access  Public
const searchDoctors = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a search query (q parameter)'
      });
    }

    // Escape special regex characters for safety
    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'i');

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {
      $or: [
        { fullName: regex },
        { clinicName: regex },
        { specialization: regex }
      ]
    };

    const total = await DoctorProfile.countDocuments(filter);

    const doctors = await DoctorProfile.find(filter)
      .sort({ facilityScore: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'email role')
      .lean();

    res.status(200).json({
      success: true,
      count: doctors.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: doctors
    });
  } catch (error) {
    console.error('Search doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching doctors'
    });
  }
};

// @desc    Get single doctor by ID
// @route   GET /api/doctors/:id
// @access  Public
const getDoctorById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor ID format'
      });
    }

    const doctor = await DoctorProfile.findById(req.params.id)
      .populate('userId', 'email role')
      .lean();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    res.status(200).json({
      success: true,
      data: doctor
    });
  } catch (error) {
    console.error('Get doctor by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching doctor'
    });
  }
};

// @desc    Get services for a specific doctor
// @route   GET /api/doctors/:id/services
// @access  Public
const getDoctorServices = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor ID format'
      });
    }

    const doctor = await DoctorProfile.findById(req.params.id).select('services fullName').lean();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    res.status(200).json({
      success: true,
      count: (doctor.services || []).length,
      data: {
        doctorId: doctor._id,
        fullName: doctor.fullName,
        services: doctor.services || []
      }
    });
  } catch (error) {
    console.error('Get doctor services error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching doctor services'
    });
  }
};

// @desc    Get doctor stats (rating aggregation)
// @route   GET /api/doctors/:id/stats
// @access  Public
const getDoctorStats = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor ID format'
      });
    }

    const doctorId = new mongoose.Types.ObjectId(req.params.id);

    // Verify doctor exists
    const doctor = await DoctorProfile.findById(doctorId).select('fullName').lean();
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const Review = getReviewModel();

    // Default stats if Review model is not available
    const defaultStats = {
      doctorId,
      fullName: doctor.fullName,
      avgRating: 0,
      totalReviews: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      recommendPercentage: 0
    };

    if (!Review) {
      return res.status(200).json({
        success: true,
        data: defaultStats
      });
    }

    // Aggregate review statistics
    const statsAgg = await Review.aggregate([
      { $match: { doctorId } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          recommendCount: {
            $sum: {
              $cond: [{ $gte: ['$rating', 4] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Rating distribution
    const distAgg = await Review.aggregate([
      { $match: { doctorId } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distAgg.forEach((item) => {
      if (item._id >= 1 && item._id <= 5) {
        ratingDistribution[item._id] = item.count;
      }
    });

    if (statsAgg.length === 0) {
      return res.status(200).json({
        success: true,
        data: defaultStats
      });
    }

    const stats = statsAgg[0];

    res.status(200).json({
      success: true,
      data: {
        doctorId,
        fullName: doctor.fullName,
        avgRating: Math.round(stats.avgRating * 10) / 10,
        totalReviews: stats.totalReviews,
        ratingDistribution,
        recommendPercentage:
          stats.totalReviews > 0
            ? Math.round((stats.recommendCount / stats.totalReviews) * 100)
            : 0
      }
    });
  } catch (error) {
    console.error('Get doctor stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching doctor stats'
    });
  }
};

module.exports = {
  getDoctors,
  getNearbyDoctors,
  searchDoctors,
  getDoctorById,
  getDoctorServices,
  getDoctorStats
};
