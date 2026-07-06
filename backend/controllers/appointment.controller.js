const Appointment = require('../models/Appointment');
const PatientProfile = require('../models/PatientProfile');
const DoctorProfile = require('../models/DoctorProfile');
const Notification = require('../models/Notification');
const { isDateTimeInClinicTiming, parseTimeToMinutes } = require('../utils/clinicTiming');

// Statuses that still occupy a time slot (a rescheduled appointment is still a
// live, upcoming booking — it must block its slot and be reschedulable again).
// 'completed' and 'cancelled' free the slot.
const ACTIVE_STATUSES = ['pending', 'confirmed', 'rescheduled'];

// Two appointments for the same doctor must be at least this many minutes apart.
const MIN_GAP_MINUTES = 30;

// True if the requested date/time falls within MIN_GAP_MINUTES of an existing
// active appointment for this doctor (exact match OR too-close custom time).
// `excludeId` skips the appointment being rescheduled.
async function hasSlotConflict(doctorId, date, time, excludeId) {
  const reqMin = parseTimeToMinutes(time);
  if (!Number.isFinite(reqMin)) return false; // invalid time — clinic-timing check handles it
  const query = { doctorId, date: new Date(date), status: { $in: ACTIVE_STATUSES } };
  if (excludeId) query._id = { $ne: excludeId };
  const sameDay = await Appointment.find(query).select('time').lean();
  return sameDay.some((a) => {
    const m = parseTimeToMinutes(a.time);
    return Number.isFinite(m) && Math.abs(m - reqMin) < MIN_GAP_MINUTES;
  });
}

// @desc    Create a new appointment
// @route   POST /api/appointments
// @access  Private (Patient only)
const createAppointment = async (req, res) => {
  try {
    const { doctorId, treatmentType, description, date, time, duration } = req.body;

    // Find patient profile from logged-in user
    const patientProfile = await PatientProfile.findOne({ userId: req.user._id });
    if (!patientProfile) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found. Please create your profile first.'
      });
    }

    // Verify the doctor exists and isn't blocked (blocked doctors can't be booked).
    const doctorProfile = await DoctorProfile.findById(doctorId);
    if (!doctorProfile || doctorProfile.isBlocked) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    if (!isDateTimeInClinicTiming(doctorProfile.clinicTiming, date, time)) {
      return res.status(400).json({
        success: false,
        message: 'Selected date or time is outside the doctor clinic timings. Please choose an available slot.'
      });
    }

    // Reject if the time collides with, or is within 30 minutes of, an existing
    // booking for this doctor (blocks e.g. 10:10 when 10:00 is already booked).
    if (await hasSlotConflict(doctorId, date, time)) {
      return res.status(409).json({
        success: false,
        message: 'This time is too close to another booking. Please choose a slot at least 30 minutes apart.'
      });
    }

    const appointment = await Appointment.create({
      patientId: patientProfile._id,
      doctorId,
      treatmentType,
      description,
      date: new Date(date),
      time,
      duration: duration || 30,
      status: 'pending'
    });

    // Create notification for the doctor — best-effort: a notification failure
    // must NOT fail an already-created booking (that showed "Booking Failed"
    // to the patient even though the appointment was saved).
    try {
      await Notification.create({
        userId: doctorProfile.userId,
        type: 'appointment',
        title: 'New Appointment Request',
        message: `You have a new ${treatmentType} appointment request for ${new Date(date).toLocaleDateString()} at ${time}.`,
        relatedModel: 'Appointment',
        relatedId: appointment._id
      });
    } catch (notifyErr) {
      console.error('Appointment notification failed (booking still created):', notifyErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create appointment',
      error: error.message
    });
  }
};

// @desc    Get current user's appointments (split into upcoming & past)
// @route   GET /api/appointments/my
// @access  Private
const getMyAppointments = async (req, res) => {
  try {
    const { status, sort } = req.query;
    const now = new Date();

    // Build filter based on user role
    let filter = {};

    if (req.user.role === 'patient') {
      let patientProfile = await PatientProfile.findOne({ userId: req.user._id });
      if (!patientProfile) {
        // Fallback: auto-create a profile if it doesn't exist for this user
        patientProfile = await PatientProfile.create({
          userId: req.user._id,
          fullName: 'Patient'
        });
      }
      filter.patientId = patientProfile._id;
    } else if (req.user.role === 'doctor') {
      const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });
      if (!doctorProfile) {
        return res.status(404).json({
          success: false,
          message: 'Doctor profile not found'
        });
      }
      filter.doctorId = doctorProfile._id;
    }

    // Apply status filter if provided
    if (status) {
      filter.status = status;
    }

    // Determine sort order
    const sortOrder = sort === 'asc' ? 1 : -1;

    // Fetch all matching appointments
    const appointments = await Appointment.find(filter)
      .populate({
        path: 'doctorId',
        select: 'fullName specialization clinicName photo userId phone clinicContact address city consultationFee clinicTiming'
      })
      .populate({
        path: 'patientId',
        select: 'fullName userId mobileNumber profileImage'
      })
      .sort({ date: sortOrder, time: sortOrder });

    // Split into upcoming and past using start of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const upcoming = appointments.filter(apt => new Date(apt.date) >= startOfToday);
    const past = appointments.filter(apt => new Date(apt.date) < startOfToday);

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: {
        upcoming,
        past
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    });
  }
};

// @desc    Get single appointment by ID
// @route   GET /api/appointments/:id
// @access  Private
const getAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate({
        path: 'doctorId',
        select: 'fullName specialization clinicName photo userId clinicTiming'
      })
      .populate({
        path: 'patientId',
        select: 'fullName userId profileImage'
      });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Authorization: only the involved patient or doctor can view
    const isPatient = appointment.patientId &&
      appointment.patientId.userId &&
      appointment.patientId.userId.toString() === req.user._id.toString();
    const isDoctor = appointment.doctorId &&
      appointment.doctorId.userId &&
      appointment.doctorId.userId.toString() === req.user._id.toString();

    if (!isPatient && !isDoctor && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this appointment'
      });
    }

    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment',
      error: error.message
    });
  }
};

// @desc    Get booked slots for a doctor on a date
// @route   GET /api/appointments/doctor/:doctorId/booked-slots?date=YYYY-MM-DD&excludeId=<appointmentId>
// @access  Private
const getBookedSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date, excludeId } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const query = {
      doctorId,
      date: new Date(date),
      status: { $in: ACTIVE_STATUSES },
    };
    if (excludeId) query._id = { $ne: excludeId };

    const appointments = await Appointment.find(query).select('time status').lean();
    res.status(200).json({
      success: true,
      data: appointments.map((appointment) => appointment.time).filter(Boolean),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booked slots',
      error: error.message,
    });
  }
};

// @desc    Reschedule an appointment
// @route   PUT /api/appointments/:id/reschedule
// @access  Private (Patient or Doctor)
const rescheduleAppointment = async (req, res) => {
  try {
    const { date, time } = req.body;

    const appointment = await Appointment.findById(req.params.id)
      .populate({ path: 'doctorId', select: 'userId fullName clinicTiming' })
      .populate({ path: 'patientId', select: 'userId fullName profileImage' });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Only live appointments can be rescheduled (a rescheduled one may be moved
    // again). Completed/cancelled cannot.
    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reschedule an appointment with status '${appointment.status}'`
      });
    }

    // Authorization check
    const isPatient = appointment.patientId &&
      appointment.patientId.userId &&
      appointment.patientId.userId.toString() === req.user._id.toString();
    const isDoctor = appointment.doctorId &&
      appointment.doctorId.userId &&
      appointment.doctorId.userId.toString() === req.user._id.toString();

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reschedule this appointment'
      });
    }

    if (!isDateTimeInClinicTiming(appointment.doctorId.clinicTiming, date, time)) {
      return res.status(400).json({
        success: false,
        message: 'Selected date or time is outside the doctor clinic timings. Please choose an available slot.'
      });
    }

    // Reject if the new time collides with, or is within 30 minutes of, another
    // active booking for this doctor.
    if (await hasSlotConflict(appointment.doctorId._id, date, time, appointment._id)) {
      return res.status(409).json({
        success: false,
        message: 'The new time is too close to another booking. Please choose a slot at least 30 minutes apart.'
      });
    }

    if (isPatient) {
      // Patient reschedule is a REQUEST — store the proposed slot; the doctor
      // must approve it (via confirm) before the actual date/time change.
      appointment.rescheduleRequest = {
        requested: true,
        date: new Date(date),
        time,
        requestedAt: new Date(),
      };
      await appointment.save();

      try {
        await Notification.create({
          userId: appointment.doctorId.userId,
          type: 'appointment',
          title: 'Reschedule Requested',
          message: `${appointment.patientId.fullName} requested to reschedule to ${new Date(date).toLocaleDateString()} at ${time}. Review and confirm.`,
          relatedModel: 'Appointment',
          relatedId: appointment._id
        });
      } catch (notifyErr) {
        console.error('Reschedule-request notification failed (request still saved):', notifyErr.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Reschedule request sent. Awaiting doctor confirmation.',
        data: appointment
      });
    }

    // Doctor reschedule applies immediately, clears any pending request, marks rescheduled.
    appointment.date = new Date(date);
    appointment.time = time;
    appointment.status = 'rescheduled';
    appointment.rescheduleRequest = { requested: false, date: null, time: null, requestedAt: null };
    await appointment.save();

    try {
      await Notification.create({
        userId: appointment.patientId.userId,
        type: 'appointment',
        title: 'Appointment Rescheduled',
        message: `Your appointment has been rescheduled by ${appointment.doctorId.fullName} to ${new Date(date).toLocaleDateString()} at ${time}.`,
        relatedModel: 'Appointment',
        relatedId: appointment._id
      });
    } catch (notifyErr) {
      console.error('Reschedule notification failed (reschedule still applied):', notifyErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Reschedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reschedule appointment',
      error: error.message
    });
  }
};

// @desc    Cancel an appointment
// @route   PUT /api/appointments/:id/cancel
// @access  Private (Patient or Doctor)
const cancelAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate({ path: 'doctorId', select: 'userId fullName' })
      .populate({ path: 'patientId', select: 'userId fullName profileImage' });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed appointment'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already cancelled'
      });
    }

    // Authorization check
    const isPatient = appointment.patientId &&
      appointment.patientId.userId &&
      appointment.patientId.userId.toString() === req.user._id.toString();
    const isDoctor = appointment.doctorId &&
      appointment.doctorId.userId &&
      appointment.doctorId.userId.toString() === req.user._id.toString();

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this appointment'
      });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    // Notify the other party
    const recipientUserId = isPatient
      ? appointment.doctorId.userId
      : appointment.patientId.userId;
    const cancelledBy = isPatient
      ? appointment.patientId.fullName
      : appointment.doctorId.fullName;

    await Notification.create({
      userId: recipientUserId,
      type: 'appointment',
      title: 'Appointment Cancelled',
      message: `Your appointment on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.time} has been cancelled by ${cancelledBy}.`,
      relatedModel: 'Appointment',
      relatedId: appointment._id
    });

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel appointment',
      error: error.message
    });
  }
};

// @desc    Complete an appointment
// @route   PUT /api/appointments/:id/complete
// @access  Private (Doctor only)
const completeAppointment = async (req, res) => {
  try {
    const { visitSummary } = req.body;

    const appointment = await Appointment.findById(req.params.id)
      .populate({ path: 'doctorId', select: 'userId fullName' })
      .populate({ path: 'patientId', select: 'userId fullName profileImage' });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Only the assigned doctor can complete
    const isDoctor = appointment.doctorId &&
      appointment.doctorId.userId &&
      appointment.doctorId.userId.toString() === req.user._id.toString();

    if (!isDoctor) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned doctor can complete this appointment'
      });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already completed'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot complete a cancelled appointment'
      });
    }

    appointment.status = 'completed';
    if (visitSummary) {
      appointment.visitSummary = visitSummary;
    }
    await appointment.save();

    // ── Award reward points on visit completion ──
    try {
      const AppSettings = require('../models/AppSettings');
      const settings = await AppSettings.findOne({ key: 'global' });
      const doctorPts = settings?.rewardPointsPerAppointment ?? 50;

      // Doctor earns points — drives the green "popular" badge at 20k.
      // Patient reward is awarded separately when the bill is paid (2% of treatment amount).
      const { addDoctorPoints } = require('../utils/popular');
      await addDoctorPoints(appointment.doctorId._id, doctorPts);

      // Referral bonus: 100/100 to the patient + their referrer (patient OR doctor)
      // after this patient's FIRST completed treatment.
      const PatientProfile = require('../models/PatientProfile');
      const fullPatient = await PatientProfile.findById(appointment.patientId._id);
      const { rewardReferralOnFirstTreatment, rewardDoctorReferralOnFirstTreatment } = require('../utils/referral');
      await rewardReferralOnFirstTreatment(fullPatient);

      // Doctor→doctor referral: if the doctor who completed this treatment was
      // referred by another doctor, pay both 100 pts on this first completion.
      const DoctorProfile = require('../models/DoctorProfile');
      const fullDoctor = await DoctorProfile.findById(appointment.doctorId._id);
      await rewardDoctorReferralOnFirstTreatment(fullDoctor);
    } catch (e) {
      console.error('Award points error (non-fatal):', e.message);
    }

    // Notify patient
    await Notification.create({
      userId: appointment.patientId.userId,
      type: 'appointment',
      title: 'Appointment Completed',
      message: `Your appointment with Dr. ${appointment.doctorId.fullName} has been marked as completed.`,
      relatedModel: 'Appointment',
      relatedId: appointment._id
    });

    res.status(200).json({
      success: true,
      message: 'Appointment marked as completed',
      data: appointment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to complete appointment',
      error: error.message
    });
  }
};

// @desc    Get visit summary for a completed appointment
// @route   GET /api/appointments/:id/visit-summary
// @access  Private
const getVisitSummary = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate({ path: 'doctorId', select: 'fullName specialization userId' })
      .populate({ path: 'patientId', select: 'fullName userId profileImage' });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Authorization check
    const isPatient = appointment.patientId &&
      appointment.patientId.userId &&
      appointment.patientId.userId.toString() === req.user._id.toString();
    const isDoctor = appointment.doctorId &&
      appointment.doctorId.userId &&
      appointment.doctorId.userId.toString() === req.user._id.toString();

    if (!isPatient && !isDoctor && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this visit summary'
      });
    }

    if (appointment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Visit summary is only available for completed appointments'
      });
    }

    if (!appointment.visitSummary) {
      return res.status(404).json({
        success: false,
        message: 'No visit summary has been added for this appointment'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        appointmentId: appointment._id,
        date: appointment.date,
        time: appointment.time,
        treatmentType: appointment.treatmentType,
        doctor: appointment.doctorId,
        patient: appointment.patientId,
        visitSummary: appointment.visitSummary
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch visit summary',
      error: error.message
    });
  }
};

// @desc    Add or update visit summary
// @route   POST /api/appointments/:id/visit-summary
// @access  Private (Doctor only)
const addVisitSummary = async (req, res) => {
  try {
    const { visitSummary } = req.body;

    const appointment = await Appointment.findById(req.params.id)
      .populate({ path: 'doctorId', select: 'userId fullName' })
      .populate({ path: 'patientId', select: 'userId fullName profileImage' });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Only the assigned doctor can add a visit summary
    const isDoctor = appointment.doctorId &&
      appointment.doctorId.userId &&
      appointment.doctorId.userId.toString() === req.user._id.toString();

    if (!isDoctor) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned doctor can add a visit summary'
      });
    }

    if (appointment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Visit summary can only be added to completed appointments'
      });
    }

    appointment.visitSummary = visitSummary;
    await appointment.save();

    // Notify patient about the visit summary
    await Notification.create({
      userId: appointment.patientId.userId,
      type: 'appointment',
      title: 'Visit Summary Available',
      message: `Dr. ${appointment.doctorId.fullName} has added a visit summary for your appointment on ${new Date(appointment.date).toLocaleDateString()}.`,
      relatedModel: 'Appointment',
      relatedId: appointment._id
    });

    res.status(200).json({
      success: true,
      message: 'Visit summary added successfully',
      data: appointment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add visit summary',
      error: error.message
    });
  }
};

module.exports = {
  createAppointment,
  getMyAppointments,
  getAppointment,
  getBookedSlots,
  rescheduleAppointment,
  cancelAppointment,
  completeAppointment,
  getVisitSummary,
  addVisitSummary
};

// @desc    Confirm an appointment
// @route   PUT /api/appointments/:id/confirm
// @access  Private (Doctor)
const confirmAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });
    if (!doctorProfile || appointment.doctorId.toString() !== doctorProfile._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
    // If the patient requested a reschedule, approving applies the new slot.
    if (appointment.rescheduleRequest?.requested) {
      appointment.date = appointment.rescheduleRequest.date;
      appointment.time = appointment.rescheduleRequest.time;
      appointment.rescheduleRequest = { requested: false, date: null, time: null, requestedAt: null };
    }
    appointment.status = 'confirmed';
    await appointment.save();
    res.status(200).json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
module.exports.confirmAppointment = confirmAppointment;
