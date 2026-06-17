const Review = require('../models/Review');
const Appointment = require('../models/Appointment');
const PatientProfile = require('../models/PatientProfile');
const DoctorProfile = require('../models/DoctorProfile');
const Reward = require('../models/Reward');
const Notification = require('../models/Notification');

// @desc    Get reviews for a doctor (paginated)
// @route   GET /api/reviews/doctor/:doctorId
// @access  Public
const getDoctorReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const { doctorId } = req.params;

    // Verify doctor exists
    const doctor = await DoctorProfile.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const [reviews, total] = await Promise.all([
      Review.find({ doctorId })
        .populate({
          path: 'patientId',
          select: 'fullName profileImage'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments({ doctorId })
    ]);

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: reviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message
    });
  }
};

// @desc    Get review statistics for a doctor
// @route   GET /api/reviews/doctor/:doctorId/stats
// @access  Public
const getDoctorReviewStats = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const mongoose = require('mongoose');

    // Verify doctor exists
    const doctor = await DoctorProfile.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const doctorObjectId = new mongoose.Types.ObjectId(doctorId);

    const stats = await Review.aggregate([
      { $match: { doctorId: doctorObjectId } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          recommendCount: {
            $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] }
          }
        }
      }
    ]);

    // Get rating distribution
    const distribution = await Review.aggregate([
      { $match: { doctorId: doctorObjectId } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ]);

    // Build rating distribution object with keys 1-5
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach(item => {
      ratingDistribution[item._id] = item.count;
    });

    const data = stats.length > 0
      ? {
          avgRating: Math.round(stats[0].avgRating * 10) / 10,
          totalReviews: stats[0].totalReviews,
          ratingDistribution,
          recommendPercentage: stats[0].totalReviews > 0
            ? Math.round((stats[0].recommendCount / stats[0].totalReviews) * 100)
            : 0
        }
      : {
          avgRating: 0,
          totalReviews: 0,
          ratingDistribution,
          recommendPercentage: 0
        };

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch review statistics',
      error: error.message
    });
  }
};

// @desc    Create a review
// @route   POST /api/reviews
// @access  Private (Patient only)
const createReview = async (req, res) => {
  try {
    const { doctorId, rating, comment } = req.body;

    // Find patient profile
    const patientProfile = await PatientProfile.findOne({ userId: req.user._id });
    if (!patientProfile) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found. Please create your profile first.'
      });
    }

    // Verify the doctor exists
    const doctorProfile = await DoctorProfile.findById(doctorId);
    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Check one review per patient per doctor
    const existingReview = await Review.findOne({
      patientId: patientProfile._id,
      doctorId
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this doctor. You can only leave one review per doctor.'
      });
    }

    // Check if patient has a completed appointment with this doctor
    const completedAppointment = await Appointment.findOne({
      patientId: patientProfile._id,
      doctorId,
      status: 'completed'
    });

    const isVerifiedPatient = !!completedAppointment;

    const review = await Review.create({
      patientId: patientProfile._id,
      doctorId,
      rating,
      comment,
      isVerifiedPatient,
      helpfulCount: 0,
      helpfulBy: []
    });

    // Create reward for submitting a review
    const reward = await Reward.create({
      patientId: patientProfile._id,
      type: 'review',
      points: 50,
      description: 'Points earned for submitting a review'
    });

    // Create notification for the doctor
    await Notification.create({
      userId: doctorProfile.userId,
      type: 'review',
      title: 'New Review Received',
      message: `You received a ${rating}-star review from ${patientProfile.fullName}.`,
      relatedId: review._id
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: {
        review,
        rewardPointsEarned: 50
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create review',
      error: error.message
    });
  }
};

// @desc    Toggle helpful on a review
// @route   PUT /api/reviews/:id/helpful
// @access  Private
const toggleHelpful = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Prevent self-helpful: check if current user is the review author
    const patientProfile = await PatientProfile.findOne({ userId: req.user._id });
    if (patientProfile && review.patientId.toString() === patientProfile._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot mark your own review as helpful'
      });
    }

    const userId = req.user._id.toString();
    const alreadyMarked = review.helpfulBy.some(
      id => id.toString() === userId
    );

    if (alreadyMarked) {
      // Remove user and decrement count
      review.helpfulBy = review.helpfulBy.filter(
        id => id.toString() !== userId
      );
      review.helpfulCount = Math.max((review.helpfulCount || 0) - 1, 0);
    } else {
      // Add user and increment count
      review.helpfulBy.push(req.user._id);
      review.helpfulCount = (review.helpfulCount || 0) + 1;
    }

    await review.save();

    res.status(200).json({
      success: true,
      message: alreadyMarked ? 'Removed helpful mark' : 'Marked as helpful',
      data: {
        helpfulCount: review.helpfulCount,
        isHelpful: !alreadyMarked
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle helpful',
      error: error.message
    });
  }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private (Review author only)
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate({ path: 'patientId', select: 'userId' });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Only the review author can delete
    if (!review.patientId ||
        !review.patientId.userId ||
        review.patientId.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }

    // Remove associated reward
    await Reward.findOneAndDelete({
      relatedModel: 'Review',
      relatedId: review._id
    });

    await Review.findByIdAndDelete(review._id);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete review',
      error: error.message
    });
  }
};

// @desc    Doctor replies to a review on their profile
// @route   PUT /api/reviews/:id/reply
// @access  Protected (doctor)
const replyToReview = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Reply text is required' });
    }
    const Review = require('../models/Review');
    const DoctorProfile = require('../models/DoctorProfile');

    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    // Ensure the logged-in doctor owns this review's profile.
    const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });
    if (!doctorProfile || String(review.doctorId) !== String(doctorProfile._id)) {
      return res.status(403).json({ success: false, message: 'You can only reply to reviews on your own profile' });
    }

    review.doctorReply = { text: text.trim(), repliedAt: new Date() };
    await review.save();
    res.json({ success: true, message: 'Reply posted', data: review });
  } catch (error) {
    console.error('Reply to review error:', error);
    res.status(500).json({ success: false, message: 'Server error while replying' });
  }
};

module.exports = {
  getDoctorReviews,
  getDoctorReviewStats,
  createReview,
  toggleHelpful,
  deleteReview,
  replyToReview
};
