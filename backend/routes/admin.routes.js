const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const admin = require('../controllers/admin.controller');

// All admin routes require an authenticated admin.
router.use(protect, authorize('admin'));

router.get('/dashboard', admin.getDashboard);
router.get('/analytics', admin.getAnalytics);

// Broadcast a notification to patients/doctors
router.post('/broadcast', admin.broadcast);

// Admin activity / audit log
router.get('/audit-logs', admin.listAuditLogs);

// Own account + app settings
router.patch('/me', admin.updateMyProfile);
router.patch('/me/password', admin.changeMyPassword);
router.get('/settings', admin.getSettings);
router.patch('/settings', admin.updateSettings);

router.get('/admins', admin.listAdmins);
router.post('/admins', admin.createAdmin);
router.patch('/admins/:id', admin.updateAdmin);
router.delete('/admins/:id', admin.deleteAdmin);

router.get('/popular-doctors', admin.listPopularDoctors);
router.get('/dentists', admin.listDentists);
router.post('/dentists', admin.createDentist);
router.get('/dentists/:id', admin.getDentist);
router.patch('/dentists/:id', admin.updateDentist);
router.patch('/dentists/:id/popular', admin.setPopular);
router.get('/commission', admin.getCommissionOverview);
router.patch('/dentists/:id/commission', admin.setCommission);
router.patch('/dentists/:id/commission/clear', admin.clearDues);
router.patch('/dentists/:id/commission/sync', admin.syncDues);
router.patch('/dentists/:id/unblock', admin.unblockDentist);
router.delete('/dentists/:id', admin.deleteDentist);

router.get('/patients', admin.listPatients);
router.post('/patients', admin.createPatient);
router.get('/patients/:id', admin.getPatient);
router.delete('/patients/:id', admin.deletePatient);

router.get('/treatments', admin.listTreatments);
router.post('/treatments', admin.createTreatment);
router.patch('/treatments/:id', admin.updateTreatment);
router.delete('/treatments/:id', admin.deleteTreatment);

router.get('/gallery', admin.listGallery);
router.delete('/gallery/:id', admin.deleteGallery);

router.get('/reviews', admin.listReviews);
router.delete('/reviews/:id', admin.deleteReview);

router.get('/appointments', admin.listAppointments);

router.get('/bills', admin.listBills);

router.get('/rewards', admin.listRewards);

module.exports = router;
