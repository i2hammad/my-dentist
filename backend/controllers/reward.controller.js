const { randomUUID } = require('crypto');
const prisma = require('../config/prisma');
const { serialize } = require('../utils/serialize');

const sumUnredeemed = async (patientId) => {
  const agg = await prisma.reward.aggregate({ where: { patientId, isRedeemed: false }, _sum: { points: true } });
  return agg._sum.points || 0;
};

// @desc    Get patient's reward points and recent history
// @route   GET /api/rewards/my
// @access  Private (Patient)
const getMyRewards = async (req, res) => {
  try {
    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
    if (!patientProfile) {
      return res.status(404).json({ success: false, message: 'Patient profile not found. Please create your profile first.' });
    }

    const totalPoints = await sumUnredeemed(patientProfile.id);
    const recentHistory = await prisma.reward.findMany({
      where: { patientId: patientProfile.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.status(200).json({
      success: true,
      data: { totalPoints, equivalentPKR: totalPoints, recentHistory: serialize(recentHistory) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch rewards', error: error.message });
  }
};

// @desc    Get earn rules (static)
// @route   GET /api/rewards/earn-rules
// @access  Public
const getEarnRules = async (req, res) => {
  res.status(200).json({
    success: true,
    data: { visitPayment: '2% of total amount paid', referral: 100, review: 50 },
  });
};

// @desc    Redeem reward points for a discount code
// @route   POST /api/rewards/redeem
// @access  Private (Patient)
const redeemPoints = async (req, res) => {
  try {
    const { points } = req.body;
    if (!points || points <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid number of points to redeem' });
    }

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
    if (!patientProfile) {
      return res.status(404).json({ success: false, message: 'Patient profile not found. Please create your profile first.' });
    }

    const totalPoints = await sumUnredeemed(patientProfile.id);
    if (totalPoints < points) {
      return res.status(400).json({ success: false, message: `Insufficient points. You have ${totalPoints} points available` });
    }

    const referralCode = randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();

    // Mark unredeemed rewards (oldest first) until the requested amount is covered.
    let pointsToRedeem = points;
    const unredeemed = await prisma.reward.findMany({
      where: { patientId: patientProfile.id, isRedeemed: false },
      orderBy: { createdAt: 'asc' },
    });
    for (const reward of unredeemed) {
      if (pointsToRedeem <= 0) break;
      await prisma.reward.update({ where: { id: reward.id }, data: { isRedeemed: true, referralCode } });
      pointsToRedeem -= reward.points;
    }

    res.status(200).json({
      success: true,
      data: { code: referralCode, pointsRedeemed: points, discountPKR: points },
      message: `Successfully redeemed ${points} points for PKR ${points} discount`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to redeem points', error: error.message });
  }
};

// @desc    Apply a reward code to a bill
// @route   POST /api/rewards/apply-code
// @access  Private (Doctor)
const applyCode = async (req, res) => {
  try {
    const { code, billId } = req.body;
    if (!code || !billId) {
      return res.status(400).json({ success: false, message: 'Please provide both code and billId' });
    }

    const rewards = await prisma.reward.findMany({ where: { referralCode: code, isRedeemed: true } });
    if (!rewards.length) {
      return res.status(404).json({ success: false, message: 'Invalid or already used reward code' });
    }

    const totalDiscount = rewards.reduce((sum, r) => sum + r.points, 0);
    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    const updated = await prisma.bill.update({
      where: { id: billId },
      data: { discountFromRewards: (bill.discountFromRewards || 0) + totalDiscount },
    });
    await prisma.reward.updateMany({ where: { referralCode: code }, data: { appliedAt: new Date() } });

    res.status(200).json({ success: true, data: serialize(updated), message: `Discount of PKR ${totalDiscount} applied to bill` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to apply reward code', error: error.message });
  }
};

// @desc    Validate a patient redeem code and return its discount value.
// @route   POST /api/rewards/validate-code
// @access  Private (Doctor)
const validateCode = async (req, res) => {
  try {
    const code = (req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ success: false, message: 'Please provide a code' });

    const rewards = await prisma.reward.findMany({ where: { referralCode: code, isRedeemed: true } });
    if (!rewards.length) return res.status(404).json({ success: false, message: 'Invalid reward code.' });
    if (rewards.some((r) => r.appliedAt)) {
      return res.status(409).json({ success: false, message: 'This code has already been used.' });
    }

    const discountPKR = rewards.reduce((sum, r) => sum + (r.points || 0), 0);
    await prisma.reward.updateMany({ where: { referralCode: code }, data: { appliedAt: new Date() } });

    res.status(200).json({ success: true, data: { code, discountPKR }, message: `Valid code — PKR ${discountPKR} discount.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to validate code', error: error.message });
  }
};

// @desc    Generate a referral code for sharing
// @route   POST /api/rewards/refer
// @access  Private (Patient)
const generateReferral = async (req, res) => {
  const referralCode = randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
  res.status(200).json({
    success: true,
    data: {
      referralCode,
      message: 'Share this code with your friend. They get 5% off on first visit. You get 100 points when they complete their first visit.',
    },
  });
};

module.exports = { getMyRewards, getEarnRules, redeemPoints, applyCode, validateCode, generateReferral };
