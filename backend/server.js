require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Connect to MongoDB
connectDB();

const app = express();

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── API Routes ────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/doctors', require('./routes/doctor.routes'));
app.use('/api/treatments', require('./routes/treatment.routes'));
app.use('/api/appointments', require('./routes/appointment.routes'));
app.use('/api/bills', require('./routes/bill.routes'));
app.use('/api/reviews', require('./routes/review.routes'));
app.use('/api/rewards', require('./routes/reward.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/gallery', require('./routes/gallery.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/chat', require('./routes/chat.routes'));
app.use('/api/favorites', require('./routes/favorite.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/campaigns', require('./routes/campaign.routes'));

// ─── Cron: process due scheduled broadcasts ────────────────
// Called by a scheduler (e.g. Vercel Cron). Guarded by CRON_SECRET when set so
// it isn't publicly triggerable. Add a Vercel Cron entry hitting this path.
app.all('/api/cron/process-broadcasts', async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const bearer = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
      const provided = req.headers['x-cron-secret'] || req.query.secret || bearer;
      if (provided !== secret) return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { runDueScheduledBroadcasts } = require('./controllers/admin.controller');
    const result = await runDueScheduledBroadcasts();
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── Health Check ──────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🦷 MyDentist API is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      doctors: '/api/doctors',
      treatments: '/api/treatments',
      appointments: '/api/appointments',
      bills: '/api/bills',
      reviews: '/api/reviews',
      rewards: '/api/rewards',
      payments: '/api/payments',
      gallery: '/api/gallery',
      notifications: '/api/notifications',
      chat: '/api/chat',
      favorites: '/api/favorites'
    }
  });
});

// ─── 404 Handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// ─── Global Error Handler ──────────────────────────────────
app.use(errorHandler);

// ─── Start Server ──────────────────────────────────────────
// On Vercel the app runs as a serverless function (no long-lived listener);
// the platform sets process.env.VERCEL. Locally we start a normal HTTP server.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🦷 ═══════════════════════════════════════════`);
    console.log(`   MyDentist API Server`);
    console.log(`   Running on: http://0.0.0.0:${PORT}`);
    console.log(`   Accepting connections from ANY device`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🦷 ═══════════════════════════════════════════\n`);
  });
}

module.exports = app;
