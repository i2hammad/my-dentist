const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const c = require('../controllers/campaign.controller');

// ── Doctor-facing ──
router.get('/active', protect, authorize('doctor'), c.getActiveForDoctor);
router.post('/:id/click', protect, authorize('doctor'), c.recordClick);

// ── Admin management ──
router.get('/admin', protect, authorize('admin'), c.listCampaigns);
router.post('/admin', protect, authorize('admin'), c.createCampaign);
router.get('/admin/:id', protect, authorize('admin'), c.getCampaign);
router.patch('/admin/:id', protect, authorize('admin'), c.updateCampaign);
router.delete('/admin/:id', protect, authorize('admin'), c.deleteCampaign);

module.exports = router;
