const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const c = require('../controllers/campaign.controller');

// ── Doctor-facing ──
router.get('/active', protect, authorize('doctor'), c.getActiveForDoctor);
router.post('/:id/click', protect, authorize('doctor'), c.recordClick);

// ── Patient-facing ──
router.get('/active-patient', protect, authorize('patient'), c.getActiveForPatient);
router.post('/:id/patient-click', protect, authorize('patient'), c.recordPatientClick);

// ── Admin: doctor campaigns ──
router.get('/admin', protect, authorize('admin'), c.listCampaigns);
router.post('/admin', protect, authorize('admin'), c.createCampaign);
router.get('/admin/:id', protect, authorize('admin'), c.getCampaign);
router.patch('/admin/:id', protect, authorize('admin'), c.updateCampaign);
router.delete('/admin/:id', protect, authorize('admin'), c.deleteCampaign);

// ── Admin: patient campaigns ──
router.get('/patient-admin', protect, authorize('admin'), c.listPatientCampaigns);
router.post('/patient-admin', protect, authorize('admin'), c.createPatientCampaign);
router.patch('/patient-admin/:id', protect, authorize('admin'), c.updatePatientCampaign);
router.delete('/patient-admin/:id', protect, authorize('admin'), c.deletePatientCampaign);

module.exports = router;
