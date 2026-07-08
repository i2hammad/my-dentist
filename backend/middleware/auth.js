const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

// Protect routes - verify JWT token and attach req.user (password stripped).
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized - no token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      omit: { password: true, refreshToken: true },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - user not found'
      });
    }

    // Enforce account suspension: a blocked patient is denied access everywhere
    // (even with an existing token). Doctors are intentionally NOT hard-blocked
    // here — they need access to view/clear commission dues.
    if (user.role === 'patient') {
      const p = await prisma.patientProfile.findUnique({ where: { userId: user.id }, select: { isBlocked: true, blockReason: true } });
      if (p?.isBlocked) {
        return res.status(403).json({
          success: false,
          blocked: true,
          message: p.blockReason || 'Your account has been suspended. Please contact support.',
        });
      }
    }

    // Expose `_id` too so existing controllers (req.user._id) keep working.
    req.user = { ...user, _id: user.id };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized - invalid token'
    });
  }
};

module.exports = { protect };
