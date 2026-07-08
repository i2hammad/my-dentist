const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { generateTokens } = require('../utils/generateToken');

const hashPassword = async (plain) => bcrypt.hash(plain, await bcrypt.genSalt(10));

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const lowerEmail = email.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const userRole = role || 'patient';
    const user = await prisma.user.create({
      data: {
        email: lowerEmail,
        password: await hashPassword(password),
        role: userRole,
      },
    });

    // Create corresponding profile with the onboarding placeholder name.
    if (userRole === 'patient') {
      await prisma.patientProfile.create({
        data: {
          userId: user.id,
          fullName: req.body.name || 'New Patient',
          mobileNumber: req.body.phone || '',
        },
      });
    } else if (userRole === 'doctor') {
      await prisma.doctorProfile.create({
        data: {
          userId: user.id,
          fullName: req.body.name || 'New Doctor',
          specialization: 'General',
        },
      });
    }

    const tokens = generateTokens(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: { _id: user.id, email: user.email, role: user.role, isAgreed: user.isAgreed },
        ...tokens,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'This account uses social login. Please use the social login option.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const tokens = generateTokens(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: { _id: user.id, email: user.email, role: user.role, isAgreed: user.isAgreed },
        ...tokens,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

// @desc    Social login (Google, Facebook, etc.)
// @route   POST /api/auth/social-login
// @access  Public
const socialLogin = async (req, res) => {
  try {
    const { provider, socialId, email, role } = req.body;

    // Find by social identity first, then by email.
    let user = await prisma.user.findFirst({ where: { socialId, socialProvider: provider } });

    if (!user && email) {
      user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { socialId, socialProvider: provider },
        });
      }
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: email ? email.toLowerCase() : `${provider}_${socialId}@social.local`,
          password: await hashPassword(require('crypto').randomBytes(16).toString('hex')),
          socialId,
          socialProvider: provider,
          role: role || 'patient',
        },
      });
    }

    const tokens = generateTokens(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });

    res.status(200).json({
      success: true,
      message: 'Social login successful',
      data: {
        user: { _id: user.id, email: user.email, role: user.role, provider: user.socialProvider, isAgreed: user.isAgreed },
        ...tokens,
      },
    });
  } catch (error) {
    console.error('Social login error:', error);
    res.status(500).json({ success: false, message: 'Server error during social login' });
  }
};

// @desc    Forgot password - email a new temporary password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a new password has been emailed to it.'
      });
    }

    const crypto = require('crypto');
    const newPassword = 'Dent' + crypto.randomBytes(4).toString('hex');
    await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(newPassword) } });

    const { sendEmail } = require('../utils/mailer');
    await sendEmail({
      to: user.email,
      subject: 'My Dentist — Your New Password',
      text: `Your password has been reset.\n\nNew password: ${newPassword}\n\nPlease log in and change it from your profile for security.`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#2563EB">My Dentist</h2>
        <p>Your password has been reset as requested.</p>
        <p style="font-size:16px">New password: <b style="background:#EFF6FF;padding:4px 10px;border-radius:6px">${newPassword}</b></p>
        <p style="color:#64748B;font-size:13px">For your security, please log in and change this password from your profile.</p>
      </div>`,
    });

    res.status(200).json({
      success: true,
      message: 'A new password has been emailed to your registered email address.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error during password reset request' });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(newPassword), refreshToken: null },
    });

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. Please login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error during password reset' });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (user.refreshToken !== token) {
      return res.status(401).json({ success: false, message: 'Refresh token has been revoked' });
    }

    const tokens = generateTokens(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });

    res.status(200).json({ success: true, message: 'Token refreshed successfully', data: tokens });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ success: false, message: 'Server error during token refresh' });
  }
};

// @desc    Agree to privacy policy
// @route   PUT /api/auth/agree-privacy
// @access  Protected
const agreePrivacy = async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user._id },
      data: { isAgreed: true },
    });

    res.status(200).json({
      success: true,
      message: 'Privacy policy accepted',
      data: { _id: user.id, email: user.email, isAgreed: user.isAgreed },
    });
  } catch (error) {
    console.error('Agree privacy error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating privacy agreement' });
  }
};

module.exports = {
  register,
  login,
  socialLogin,
  forgotPassword,
  resetPassword,
  refreshToken,
  agreePrivacy,
};
