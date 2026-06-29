const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateTokens } = require('../utils/generateToken');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password: password,
      role: role || 'patient'
    });

    // Create corresponding profile
    if (user.role === 'patient') {
      const PatientProfile = require('../models/PatientProfile');
      await PatientProfile.create({
        userId: user._id,
        fullName: req.body.name || 'New Patient',
        mobileNumber: req.body.phone || ''
      });
    } else if (user.role === 'doctor') {
      const DoctorProfile = require('../models/DoctorProfile');
      await DoctorProfile.create({
        userId: user._id,
        fullName: req.body.name || 'New Doctor',
        specialization: 'General'
      });
    }

    // Generate tokens
    const tokens = generateTokens(user._id);

    // Update refresh token on user
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          role: user.role,
          isAgreed: user.isAgreed
        },
        ...tokens
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and include password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user has a password (might be social-only account)
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'This account uses social login. Please use the social login option.'
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate tokens
    const tokens = generateTokens(user._id);

    // Update refresh token on user
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          role: user.role,
          isAgreed: user.isAgreed
        },
        ...tokens
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    Social login (Google, Facebook, etc.)
// @route   POST /api/auth/social-login
// @access  Public
const socialLogin = async (req, res) => {
  try {
    const { provider, socialId, email, role } = req.body;

    // Try to find user by social ID first
    let user = await User.findOne({ socialId, provider });

    // If not found by socialId, try by email
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        // Link social account to existing user
        user.socialId = socialId;
        user.provider = provider;
        await user.save();
      }
    }

    // Create new user if not found
    if (!user) {
      user = await User.create({
        email: email ? email.toLowerCase() : undefined,
        socialId,
        provider,
        role: role || 'patient'
      });
    }

    // Generate tokens
    const tokens = generateTokens(user._id);

    // Update refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Social login successful',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          role: user.role,
          provider: user.provider,
          isAgreed: user.isAgreed
        },
        ...tokens
      }
    });
  } catch (error) {
    console.error('Social login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during social login'
    });
  }
};

// @desc    Forgot password - send reset instructions
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      // Don't reveal if email exists for security
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a new password has been emailed to it.'
      });
    }

    // Generate a new temporary password, save it (pre-save hook hashes it),
    // and email it to the registered address.
    const crypto = require('crypto');
    const newPassword = 'Dent' + crypto.randomBytes(4).toString('hex'); // e.g. Dent3f9a1c20
    user.password = newPassword;
    await user.save();

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
    res.status(500).json({
      success: false,
      message: 'Server error during password reset request'
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.password = newPassword;
    // Invalidate refresh token to force re-login
    user.refreshToken = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. Please login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify the refresh token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Find user and verify stored refresh token matches
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.refreshToken !== token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has been revoked'
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user._id);

    // Update stored refresh token (token rotation)
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: tokens
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token refresh'
    });
  }
};

// @desc    Agree to privacy policy
// @route   PUT /api/auth/agree-privacy
// @access  Protected
const agreePrivacy = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { isAgreed: true },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Privacy policy accepted',
      data: {
        _id: user._id,
        email: user.email,
        isAgreed: user.isAgreed
      }
    });
  } catch (error) {
    console.error('Agree privacy error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating privacy agreement'
    });
  }
};

module.exports = {
  register,
  login,
  socialLogin,
  forgotPassword,
  resetPassword,
  refreshToken,
  agreePrivacy
};
