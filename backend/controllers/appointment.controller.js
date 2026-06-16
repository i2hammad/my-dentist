const Appointment = require('../models/Appointment');
const PatientProfile = require('../models/PatientProfile');
const DoctorProfile = require('../models/DoctorProfile');
const Notification = require('../models/Notification');

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

    // Verify the doctor exists
    const doctorProfile = await DoctorProfile.findById(doctorId);
    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Check for conflicting appointment (same doctor, same date and time)
    const existingAppointment = await Appointment.findOne({
      doctorId,
      date: new Date(date),
      time,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is already booked. Please choose a different time.'
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

    // Create notification for the doctor
    await Notification.create({
      userId: doctorProfile.userId,
      type: 'appointment',
      title: 'New Appointment Request',
      message: `You have a new ${treatmentType} appointment request for ${new Date(date).toLocaleDateString()} at ${time}.`,
      relatedModel: 'Appointment',
      relatedId: appointment._id
    });

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: appointment
    });
  } catch (error) {
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
        select: 'fullName specialization clinicName photo userId'
      })
      .populate({
        path: 'patientId',
        select: 'fullName userId'
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
        select: 'fullName specialization clinicName photo userId'
      })
      .populate({
        path: 'patientId',
        select: 'fullName userId'
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

// @desc    Reschedule an appointment
// @route   PUT /api/appointments/:id/reschedule
// @access  Private (Patient or Doctor)
const rescheduleAppointment = async (req, res) => {
  try {
    const { date, time } = req.body;

    const appointment = await Appointment.findById(req.params.id)
      .populate({ path: 'doctorId', select: 'userId fullName' })
      .populate({ path: 'patientId', select: 'userId fullName' });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Only pending or confirmed appointments can be rescheduled
    if (!['pending', 'confirmed'].includes(appointment.status)) {
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

    // Check for conflicting appointment at new time
    const conflict = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctorId: appointment.doctorId._id,
      date: new Date(date),
      time,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'The new time slot is already booked. Please choose a different time.'
      });
    }

    appointment.date = new Date(date);
    appointment.time = time;
    await appointment.save();

    // Notify the other party
    const recipientUserId = isPatient
      ? appointment.doctorId.userId
      : appointment.patientId.userId;
    const rescheduledBy = isPatient
      ? appointment.patientId.fullName
      : appointment.doctorId.fullName;

    await Notification.create({
      userId: recipientUserId,
      type: 'appointment',
      title: 'Appointment Rescheduled',
      message: `Your appointment has been rescheduled by ${rescheduledBy} to ${new Date(date).toLocaleDateString()} at ${time}.`,
      relatedModel: 'Appointment',
      relatedId: appointment._id
    });

    res.status(200).json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: appointment
    });
  } catch (error) {
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
      .populate({ path: 'patientId', select: 'userId fullName' });

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
      .populate({ path: 'patientId', select: 'userId fullName' });

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
      .populate({ path: 'patientId', select: 'fullName userId' });

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
      .populate({ path: 'patientId', select: 'userId fullName' });

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
    appointment.status = 'confirmed';
    await appointment.save();
    res.status(200).json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
module.exports.confirmAppointment = confirmAppointment;
