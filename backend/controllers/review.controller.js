const prisma = require('../config/prisma');
const { serialize, remapMany } = require('../utils/serialize');

// @desc    Get reviews for a doctor (paginated)
// @route   GET /api/reviews/doctor/:doctorId
// @access  Public
const getDoctorReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { doctorId } = req.params;

    const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const where = { doctorId, hidden: false };
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { patient: { select: { id: true, fullName: true, profileImage: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: serialize(remapMany(reviews, { patient: 'patientId' })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch reviews', error: error.message });
  }
};

// @desc    Get review statistics for a doctor
// @route   GET /api/reviews/doctor/:doctorId/stats
// @access  Public
const getDoctorReviewStats = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const where = { doctorId, hidden: false };
    const [agg, dist, recommendCount] = await Promise.all([
      prisma.review.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
      prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true } }),
      prisma.review.count({ where: { ...where, rating: { gte: 4 } } }),
    ]);

    const totalReviews = agg._count._all;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    dist.forEach((d) => { ratingDistribution[d.rating] = d._count._all; });

    const data = totalReviews > 0
      ? {
          avgRating: Math.round((agg._avg.rating || 0) * 10) / 10,
          totalReviews,
          ratingDistribution,
          recommendPercentage: Math.round((recommendCount / totalReviews) * 100),
        }
      : { avgRating: 0, totalReviews: 0, ratingDistribution, recommendPercentage: 0 };

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch review statistics', error: error.message });
  }
};

// @desc    Create a review
// @route   POST /api/reviews
// @access  Private (Patient only)
const createReview = async (req, res) => {
  try {
    const { doctorId, rating, comment } = req.body;

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
    if (!patientProfile) return res.status(404).json({ success: false, message: 'Patient profile not found. Please create your profile first.' });

    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
    if (!doctorProfile) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const existing = await prisma.review.findFirst({ where: { patientId: patientProfile.id, doctorId } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already reviewed this doctor. You can only leave one review per doctor.' });
    }

    const completed = await prisma.appointment.findFirst({ where: { patientId: patientProfile.id, doctorId, status: 'completed' } });
    if (!completed) {
      return res.status(403).json({ success: false, message: 'You can only review a doctor after a completed treatment with them.' });
    }

    const review = await prisma.review.create({
      data: {
        patientId: patientProfile.id,
        doctorId,
        rating: parseInt(rating, 10),
        comment: comment || '',
        isVerifiedPatient: true,
        helpfulCount: 0,
        helpfulBy: [],
      },
    });

    // Award review points once per patient+doctor (kept even if a prior review was deleted).
    const alreadyRewarded = await prisma.reward.findFirst({ where: { patientId: patientProfile.id, doctorId, type: 'review' } });
    let rewardPointsEarned = 0;
    if (!alreadyRewarded) {
      await prisma.reward.create({
        data: { patientId: patientProfile.id, doctorId, type: 'review', points: 50, description: 'Points earned for submitting a review' },
      });
      try {
        const { addDoctorPoints } = require('../utils/popular');
        await addDoctorPoints(doctorProfile.id, 50);
      } catch (e) {
        console.error('Doctor review points error (non-fatal):', e.message);
      }
      rewardPointsEarned = 50;
    }

    try {
      await prisma.notification.create({
        data: {
          userId: doctorProfile.userId,
          type: 'review',
          title: 'New Review Received',
          message: `You received a ${rating}-star review from ${patientProfile.fullName}.`,
          relatedId: review.id,
        },
      });
    } catch (_) { /* best-effort */ }

    res.status(201).json({ success: true, message: 'Review submitted successfully', data: { review: serialize(review), rewardPointsEarned } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create review', error: error.message });
  }
};

// @desc    Toggle helpful on a review
// @route   PUT /api/reviews/:id/helpful
// @access  Private
const toggleHelpful = async (req, res) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
    if (patientProfile && review.patientId === patientProfile.id) {
      return res.status(400).json({ success: false, message: 'You cannot mark your own review as helpful' });
    }

    const userId = req.user._id;
    const already = (review.helpfulBy || []).includes(userId);
    const helpfulBy = already ? review.helpfulBy.filter((id) => id !== userId) : [...(review.helpfulBy || []), userId];
    const helpfulCount = already ? Math.max((review.helpfulCount || 0) - 1, 0) : (review.helpfulCount || 0) + 1;

    await prisma.review.update({ where: { id: review.id }, data: { helpfulBy, helpfulCount } });

    res.status(200).json({
      success: true,
      message: already ? 'Removed helpful mark' : 'Marked as helpful',
      data: { helpfulCount, isHelpful: !already },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to toggle helpful', error: error.message });
  }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private (Review author only)
const deleteReview = async (req, res) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id }, include: { patient: { select: { userId: true } } } });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    if (!review.patient || review.patient.userId !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this review' });
    }

    // The review reward is intentionally KEPT (prevents delete-then-re-review point farming).
    await prisma.review.delete({ where: { id: review.id } });
    res.status(200).json({ success: true, message: 'Review deleted successfully', data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete review', error: error.message });
  }
};

// @desc    Doctor replies to a review on their profile
// @route   PUT /api/reviews/:id/reply
// @access  Protected (doctor)
const replyToReview = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Reply text is required' });

    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!doctorProfile || review.doctorId !== doctorProfile.id) {
      return res.status(403).json({ success: false, message: 'You can only reply to reviews on your own profile' });
    }

    const updated = await prisma.review.update({
      where: { id: review.id },
      data: { doctorReply: { text: text.trim(), repliedAt: new Date() } },
    });
    res.json({ success: true, message: 'Reply posted', data: serialize(updated) });
  } catch (error) {
    console.error('Reply to review error:', error);
    res.status(500).json({ success: false, message: 'Server error while replying' });
  }
};

// @desc    Get all reviews written by the logged-in patient
// @route   GET /api/reviews/my
// @access  Private (patient)
const getMyReviews = async (req, res) => {
  try {
    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
    if (!patientProfile) return res.status(404).json({ success: false, message: 'Patient profile not found' });

    const reviews = await prisma.review.findMany({
      where: { patientId: patientProfile.id },
      include: { doctor: { select: { id: true, fullName: true, photo: true, specialization: true, clinicName: true, clinicTier: true, coordinates: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, count: reviews.length, data: serialize(remapMany(reviews, { doctor: 'doctorId' })) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch your reviews', error: error.message });
  }
};

module.exports = { getDoctorReviews, getDoctorReviewStats, createReview, toggleHelpful, deleteReview, replyToReview, getMyReviews };
