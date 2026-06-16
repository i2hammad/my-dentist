const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { validate } = require('../middleware/validate');

const {
  getMyBills,
  getBillingSummary,
  getBill,
  createBill,
  updateBill,
  payBill,
  downloadBill,
  getPatientBills
} = require('../controllers/bill.controller');

// All routes are protected
router.use(protect);

// @route   GET /api/bills/my
// @desc    Get current user's bills (paginated)
router.get(
  '/my',
  [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  validate,
  getMyBills
);

// @route   GET /api/bills/summary
// @desc    Get billing summary (patient only)
router.get(
  '/summary',
  authorize('patient'),
  getBillingSummary
);

// @route   GET /api/bills/:id
// @desc    Get single bill
router.get(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid bill ID')
  ],
  validate,
  getBill
);

// @route   POST /api/bills
// @desc    Create a new bill (doctor only)
router.post(
  '/',
  authorize('doctor'),
  [
    body('appointmentId')
      .optional()
      .isMongoId().withMessage('Invalid appointment ID'),
    body('patientId')
      .notEmpty().withMessage('Patient ID is required')
      .isMongoId().withMessage('Invalid patient ID'),
    body('treatmentName')
      .notEmpty().withMessage('Treatment name is required')
      .trim()
      .isLength({ min: 2, max: 200 }).withMessage('Treatment name must be between 2 and 200 characters'),
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('dueDate')
      .notEmpty().withMessage('Due date is required')
      .isISO8601().withMessage('Due date must be a valid ISO date')
      .custom((value) => {
        const dueDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dueDate < today) {
          throw new Error('Due date cannot be in the past');
        }
        return true;
      }),
    body('discountFromRewards')
      .optional()
      .isFloat({ min: 0 }).withMessage('Discount must be a non-negative number'),
    body('paidAmount')
      .optional()
      .isFloat({ min: 0 }).withMessage('Paid amount must be a non-negative number')
  ],
  validate,
  createBill
);

// @route   PUT /api/bills/:id
// @desc    Update a bill (doctor only)
router.put(
  '/:id',
  authorize('doctor'),
  [
    param('id').isMongoId().withMessage('Invalid bill ID'),
    body('treatmentName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 200 }).withMessage('Treatment name must be between 2 and 200 characters'),
    body('amount')
      .optional()
      .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('dueDate')
      .optional()
      .isISO8601().withMessage('Due date must be a valid ISO date'),
    body('discountFromRewards')
      .optional()
      .isFloat({ min: 0 }).withMessage('Discount must be a non-negative number'),
    body('paidAmount')
      .optional()
      .isFloat({ min: 0 }).withMessage('Paid amount must be a non-negative number'),
    body('status')
      .optional()
      .isIn(['paid', 'unpaid']).withMessage('Status must be paid or unpaid')
  ],
  validate,
  updateBill
);

// @route   GET /api/bills/patient/:patientId
// @desc    Get bills for a patient
router.get(
  '/patient/:patientId',
  [
    param('patientId').isMongoId().withMessage('Invalid patient ID'),
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  validate,
  getPatientBills
);

// @route   PUT /api/bills/:id/pay
// @desc    Pay a bill (patient only)
router.put(
  '/:id/pay',
  authorize('patient'),
  [
    param('id').isMongoId().withMessage('Invalid bill ID')
  ],
  validate,
  payBill
);

// @route   GET /api/bills/:id/download
// @desc    Download bill data as JSON
router.get(
  '/:id/download',
  [
    param('id').isMongoId().withMessage('Invalid bill ID')
  ],
  validate,
  downloadBill
);

module.exports = router;
