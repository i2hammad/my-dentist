const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const admin = require('../controllers/admin.controller');

// All admin routes require an authenticated admin.
router.use(protect, authorize('admin'));

router.get('/dashboard', admin.getDashboard);
router.get('/analytics', admin.getAnalytics);

// Broadcast a notification to patients/doctors (immediate or scheduled via sendAt)
router.post('/broadcast', admin.broadcast);
router.get('/scheduled-broadcasts', admin.listScheduledBroadcasts);
router.post('/scheduled-broadcasts/process', admin.processScheduledBroadcasts);
router.delete('/scheduled-broadcasts/:id', admin.cancelScheduledBroadcast);

// Impersonation / "view as" (super admin only — gated in the controller)
router.post('/impersonate/:userId', admin.impersonateUser);

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
router.patch('/dentists/:id/reset-password', admin.resetDentistPassword);
router.delete('/dentists/:id', admin.deleteDentist);

router.get('/patients', admin.listPatients);
router.post('/patients', admin.createPatient);
router.get('/patients/:id', admin.getPatient);
router.patch('/patients/:id/block', admin.blockPatient);
router.patch('/patients/:id/unblock', admin.unblockPatient);
router.delete('/patients/:id', admin.deletePatient);

router.get('/treatments', admin.listTreatments);
router.post('/treatments', admin.createTreatment);
router.patch('/treatments/:id', admin.updateTreatment);
router.delete('/treatments/:id', admin.deleteTreatment);

router.get('/gallery', admin.listGallery);
router.delete('/gallery/:id', admin.deleteGallery);

router.get('/reviews', admin.listReviews);
router.patch('/reviews/:id', admin.moderateReview);
router.patch('/reviews/:id/reply', admin.replyReview);
router.delete('/reviews/:id', admin.deleteReview);

router.get('/appointments', admin.listAppointments);

router.get('/bills', admin.listBills);
router.patch('/bills/:id/refund', admin.refundBill);

router.get('/rewards', admin.listRewards);

router.get('/search', admin.globalSearch);

module.exports = router;
