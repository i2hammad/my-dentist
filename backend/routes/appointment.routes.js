const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { validate } = require('../middleware/validate');

const {
  createAppointment,
  getMyAppointments,
  getAppointment,
  rescheduleAppointment,
  cancelAppointment,
  completeAppointment,
  getVisitSummary,
  addVisitSummary,
  confirmAppointment
} = require('../controllers/appointment.controller');

// All routes are protected
router.use(protect);

// @route   POST /api/appointments
// @desc    Create a new appointment (patient only)
router.post(
  '/',
  authorize('patient'),
  [
    body('doctorId')
      .notEmpty().withMessage('Doctor ID is required')
      .isMongoId().withMessage('Invalid doctor ID'),
    body('treatmentType')
      .notEmpty().withMessage('Treatment type is required')
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Treatment type must be between 2 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
    body('date')
      .notEmpty().withMessage('Date is required')
      .isISO8601().withMessage('Date must be a valid ISO date')
      .custom((value) => {
        const appointmentDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (appointmentDate < today) {
          throw new Error('Appointment date cannot be in the past');
        }
        return true;
      }),
    body('time')
      .notEmpty().withMessage('Time is required')
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Time must be in HH:mm format (24-hour)'),
    body('duration')
      .optional()
      .isInt({ min: 15, max: 240 }).withMessage('Duration must be between 15 and 240 minutes')
  ],
  validate,
  createAppointment
);

// @route   GET /api/appointments/my
// @desc    Get current user's appointments
router.get(
  '/my',
  [
    query('status')
      .optional()
      .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
      .withMessage('Status must be pending, confirmed, cancelled, or completed'),
    query('sort')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort must be asc or desc')
  ],
  validate,
  getMyAppointments
);

// @route   GET /api/appointments/:id
// @desc    Get single appointment
router.get(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid appointment ID')
  ],
  validate,
  getAppointment
);

// @route   PUT /api/appointments/:id/reschedule
// @desc    Reschedule an appointment
router.put(
  '/:id/reschedule',
  [
    param('id').isMongoId().withMessage('Invalid appointment ID'),
    body('date')
      .notEmpty().withMessage('Date is required')
      .isISO8601().withMessage('Date must be a valid ISO date')
      .custom((value) => {
        const appointmentDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (appointmentDate < today) {
          throw new Error('Appointment date cannot be in the past');
        }
        return true;
      }),
    body('time')
      .notEmpty().withMessage('Time is required')
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Time must be in HH:mm format (24-hour)')
  ],
  validate,
  rescheduleAppointment
);

// @route   PUT /api/appointments/:id/cancel
// @desc    Cancel an appointment
router.put(
  '/:id/cancel',
  [
    param('id').isMongoId().withMessage('Invalid appointment ID')
  ],
  validate,
  cancelAppointment
);

// @route   PUT /api/appointments/:id/complete
// @desc    Complete an appointment (doctor only)
router.put(
  '/:id/complete',
  authorize('doctor'),
  [
    param('id').isMongoId().withMessage('Invalid appointment ID'),
    body('visitSummary')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('Visit summary must not exceed 2000 characters')
  ],
  validate,
  completeAppointment
);

// @route   GET /api/appointments/:id/visit-summary
// @desc    Get visit summary for completed appointment
router.get(
  '/:id/visit-summary',
  [
    param('id').isMongoId().withMessage('Invalid appointment ID')
  ],
  validate,
  getVisitSummary
);

// @route   POST /api/appointments/:id/visit-summary
// @desc    Add/update visit summary (doctor only)
router.post(
  '/:id/visit-summary',
  authorize('doctor'),
  [
    param('id').isMongoId().withMessage('Invalid appointment ID'),
    body('visitSummary')
      .notEmpty().withMessage('Visit summary is required')
      .trim()
      .isLength({ min: 10, max: 2000 }).withMessage('Visit summary must be between 10 and 2000 characters')
  ],
  validate,
  addVisitSummary
);

// @route   PUT /api/appointments/:id/confirm
// @desc    Confirm an appointment (doctor only)
router.put(
  '/:id/confirm',
  authorize('doctor'),
  [
    param('id').isMongoId().withMessage('Invalid appointment ID')
  ],
  validate,
  confirmAppointment
);

module.exports = router;
