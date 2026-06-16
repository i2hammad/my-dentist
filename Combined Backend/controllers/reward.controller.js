const { v4: uuidv4 } = require('uuid');
const Reward = require('../models/Reward');

// @desc    Get patient's reward points and recent history
// @route   GET /api/rewards/my
// @access  Private (Patient)
const getMyRewards = async (req, res) => {
  try {
    const PatientProfile = require('../models/PatientProfile');
    const patientProfile = await PatientProfile.findOne({ userId: req.user._id });
    if (!patientProfile) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found. Please create your profile first.',
      });
    }

    // Aggregate total unredeemed points
    const pointsAgg = await Reward.aggregate([
      {
        $match: {
          patientId: patientProfile._id,
          isRedeemed: false,
        },
      },
      {
        $group: {
          _id: null,
          totalPoints: { $sum: '$points' },
        },
      },
    ]);

    const totalPoints = pointsAgg.length > 0 ? pointsAgg[0].totalPoints : 0;

    // Get recent reward history (last 20 transactions)
    const recentHistory = await Reward.find({ patientId: patientProfile._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        totalPoints,
        equivalentPKR: totalPoints, // 1 point = 1 PKR
        recentHistory,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rewards',
      error: error.message,
    });
  }
};

// @desc    Get earn rules (static)
// @route   GET /api/rewards/earn-rules
// @access  Public
const getEarnRules = async (req, res) => {
  try {
    const earnRules = {
      visitPayment: '2% of total amount paid',
      referral: 100,
      review: 50,
    };

    res.status(200).json({
      success: true,
      data: earnRules,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earn rules',
      error: error.message,
    });
  }
};

// @desc    Redeem reward points for a discount code
// @route   POST /api/rewards/redeem
// @access  Private (Patient)
const redeemPoints = async (req, res) => {
  try {
    const { points } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid number of points to redeem',
      });
    }

    const PatientProfile = require('../models/PatientProfile');
    const patientProfile = await PatientProfile.findOne({ userId: req.user._id });
    if (!patientProfile) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found. Please create your profile first.',
      });
    }

    // Calculate total unredeemed points
    const pointsAgg = await Reward.aggregate([
      {
        $match: {
          patientId: patientProfile._id,
          isRedeemed: false,
        },
      },
      {
        $group: {
          _id: null,
          totalPoints: { $sum: '$points' },
        },
      },
    ]);

    const totalPoints = pointsAgg.length > 0 ? pointsAgg[0].totalPoints : 0;

    if (totalPoints < points) {
      return res.status(400).json({
        success: false,
        message: `Insufficient points. You have ${totalPoints} points available`,
      });
    }

    // Generate random 8-character alphanumeric code
    const referralCode = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();

    // Mark reward entries as redeemed until we've covered the requested points
    let pointsToRedeem = points;
    const unredeemedRewards = await Reward.find({
      patientId: patientProfile._id,
      isRedeemed: false,
    }).sort({ createdAt: 1 });

    for (const reward of unredeemedRewards) {
      if (pointsToRedeem <= 0) break;

      reward.isRedeemed = true;
      reward.redeemedAt = new Date();
      reward.referralCode = referralCode;
      await reward.save();

      pointsToRedeem -= reward.points;
    }

    res.status(200).json({
      success: true,
      data: {
        code: referralCode,
        pointsRedeemed: points,
        discountPKR: points, // 1 point = 1 PKR
      },
      message: `Successfully redeemed ${points} points for PKR ${points} discount`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to redeem points',
      error: error.message,
    });
  }
};

// @desc    Apply a reward code to a bill
// @route   POST /api/rewards/apply-code
// @access  Private (Doctor)
const applyCode = async (req, res) => {
  try {
    const { code, billId } = req.body;

    if (!code || !billId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both code and billId',
      });
    }

    // Find rewards with this referral code
    const rewards = await Reward.find({ referralCode: code, isRedeemed: true });

    if (!rewards || rewards.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or already used reward code',
      });
    }

    // Calculate total discount from the code
    const totalDiscount = rewards.reduce((sum, r) => sum + r.points, 0);

    // Try to find and update the bill
    const Bill = require('../models/Bill');
    const bill = await Bill.findById(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      });
    }

    // Apply discount
    bill.discount = (bill.discount || 0) + totalDiscount;
    bill.rewardCodeApplied = code;
    await bill.save();

    // Mark the reward code as fully used
    await Reward.updateMany(
      { referralCode: code },
      { $set: { codeUsed: true } }
    );

    res.status(200).json({
      success: true,
      data: bill,
      message: `Discount of PKR ${totalDiscount} applied to bill`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to apply reward code',
      error: error.message,
    });
  }
};

// @desc    Generate a referral code for sharing
// @route   POST /api/rewards/refer
// @access  Private (Patient)
const generateReferral = async (req, res) => {
  try {
    // Generate referral code using uuid (first 8 chars)
    const referralCode = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();

    res.status(200).json({
      success: true,
      data: {
        referralCode,
        message:
          'Share this code with your friend. They get 5% off on first visit. You get 100 points when they complete their first visit.',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate referral code',
      error: error.message,
    });
  }
};

module.exports = {
  getMyRewards,
  getEarnRules,
  redeemPoints,
  applyCode,
  generateReferral,
};
