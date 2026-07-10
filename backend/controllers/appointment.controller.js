const prisma = require('../config/prisma');
const { serialize, remapRefs, remapMany } = require('../utils/serialize');
const { isDateTimeInClinicTiming, parseTimeToMinutes } = require('../utils/clinicTiming');

// Statuses that still occupy a time slot.
const ACTIVE_STATUSES = ['pending', 'confirmed', 'rescheduled'];
const MIN_GAP_MINUTES = 30;

const DOCTOR_SELECT = { id: true, fullName: true, specialization: true, clinicName: true, photo: true, userId: true, phone: true, clinicContact: true, address: true, city: true, consultationFee: true, clinicTiming: true };
const PATIENT_SELECT = { id: true, fullName: true, userId: true, mobileNumber: true, profileImage: true };

// Best-effort notification — never fails the surrounding action.
async function notify(data) {
  try { await prisma.notification.create({ data }); } catch (e) { console.error('Notification failed:', e.message); }
}

// True if the requested date/time is within MIN_GAP_MINUTES of an existing active
// appointment for this doctor. `excludeId` skips the appointment being rescheduled.
async function hasSlotConflict(doctorId, date, time, excludeId) {
  const reqMin = parseTimeToMinutes(time);
  if (!Number.isFinite(reqMin)) return false;
  const where = { doctorId, date: new Date(date), status: { in: ACTIVE_STATUSES } };
  if (excludeId) where.id = { not: excludeId };
  const sameDay = await prisma.appointment.findMany({ where, select: { time: true } });
  return sameDay.some((a) => {
    const m = parseTimeToMinutes(a.time);
    return Number.isFinite(m) && Math.abs(m - reqMin) < MIN_GAP_MINUTES;
  });
}

// @desc    Create a new appointment
// @route   POST /api/appointments
const createAppointment = async (req, res) => {
  try {
    const { doctorId, treatmentType, description, date, time, duration } = req.body;

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
    if (!patientProfile) return res.status(404).json({ success: false, message: 'Patient profile not found. Please create your profile first.' });

    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
    if (!doctorProfile || doctorProfile.isBlocked) return res.status(404).json({ success: false, message: 'Doctor not found' });

    if (!isDateTimeInClinicTiming(doctorProfile.clinicTiming, date, time)) {
      return res.status(400).json({ success: false, message: 'Selected date or time is outside the doctor clinic timings. Please choose an available slot.' });
    }
    if (await hasSlotConflict(doctorId, date, time)) {
      return res.status(409).json({ success: false, message: 'This time is too close to another booking. Please choose a slot at least 30 minutes apart.' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: patientProfile.id,
        doctorId,
        treatmentType,
        description: description || '',
        date: new Date(date),
        time,
        duration: duration || 30,
        status: 'pending',
      },
    });

    await notify({
      userId: doctorProfile.userId,
      type: 'appointment',
      title: 'New Appointment Request',
      message: `You have a new ${treatmentType} appointment request for ${new Date(date).toLocaleDateString()} at ${time}.`,
      relatedId: appointment.id,
    });

    // Best-effort emails (non-blocking): confirm to patient, notify doctor.
    const emails = require('../utils/emails');
    emails.sendAppointmentBookedEmail({
      to: req.user.email, patientName: patientProfile.fullName, doctorName: doctorProfile.fullName,
      treatment: treatmentType, date, time,
    });
    prisma.user.findUnique({ where: { id: doctorProfile.userId }, select: { email: true } })
      .then((u) => { if (u?.email) emails.sendAppointmentRequestEmail({ to: u.email, doctorName: doctorProfile.fullName, patientName: patientProfile.fullName, treatment: treatmentType, date, time }); })
      .catch(() => {});

    res.status(201).json({ success: true, message: 'Appointment created successfully', data: serialize(appointment) });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to create appointment', error: error.message });
  }
};

// @desc    Get current user's appointments (upcoming & past)
// @route   GET /api/appointments/my
const getMyAppointments = async (req, res) => {
  try {
    const { status, sort } = req.query;
    const where = {};

    if (req.user.role === 'patient') {
      let patientProfile = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
      if (!patientProfile) patientProfile = await prisma.patientProfile.create({ data: { userId: req.user._id, fullName: 'Patient' } });
      where.patientId = patientProfile.id;
    } else if (req.user.role === 'doctor') {
      const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
      if (!doctorProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
      where.doctorId = doctorProfile.id;
    }
    if (status) where.status = status;

    const order = sort === 'asc' ? 'asc' : 'desc';
    const appointments = await prisma.appointment.findMany({
      where,
      include: { doctor: { select: DOCTOR_SELECT }, patient: { select: PATIENT_SELECT } },
      orderBy: [{ date: order }, { time: order }],
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const shaped = serialize(remapMany(appointments, { doctor: 'doctorId', patient: 'patientId' }));
    const upcoming = shaped.filter((a) => new Date(a.date) >= startOfToday);
    const past = shaped.filter((a) => new Date(a.date) < startOfToday);

    res.status(200).json({ success: true, count: appointments.length, data: { upcoming, past } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch appointments', error: error.message });
  }
};

// @desc    Get single appointment by ID
// @route   GET /api/appointments/:id
const getAppointment = async (req, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { doctor: { select: { fullName: true, specialization: true, clinicName: true, photo: true, userId: true, clinicTiming: true } }, patient: { select: { fullName: true, userId: true, profileImage: true } } },
    });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    const isPatient = appointment.patient?.userId === req.user._id;
    const isDoctor = appointment.doctor?.userId === req.user._id;
    if (!isPatient && !isDoctor && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this appointment' });
    }

    res.status(200).json({ success: true, data: serialize(remapRefs(appointment, { doctor: 'doctorId', patient: 'patientId' })) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch appointment', error: error.message });
  }
};

// @desc    Get booked slots for a doctor on a date
// @route   GET /api/appointments/doctor/:doctorId/booked-slots
const getBookedSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date, excludeId } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

    const where = { doctorId, date: new Date(date), status: { in: ACTIVE_STATUSES } };
    if (excludeId) where.id = { not: excludeId };

    const appointments = await prisma.appointment.findMany({ where, select: { time: true } });
    res.status(200).json({ success: true, data: appointments.map((a) => a.time).filter(Boolean) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch booked slots', error: error.message });
  }
};

// @desc    Reschedule an appointment
// @route   PUT /api/appointments/:id/reschedule
const rescheduleAppointment = async (req, res) => {
  try {
    const { date, time } = req.body;
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { doctor: { select: { userId: true, fullName: true, clinicTiming: true } }, patient: { select: { userId: true, fullName: true } } },
    });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      return res.status(400).json({ success: false, message: `Cannot reschedule an appointment with status '${appointment.status}'` });
    }

    const isPatient = appointment.patient?.userId === req.user._id;
    const isDoctor = appointment.doctor?.userId === req.user._id;
    if (!isPatient && !isDoctor) return res.status(403).json({ success: false, message: 'Not authorized to reschedule this appointment' });

    if (!isDateTimeInClinicTiming(appointment.doctor.clinicTiming, date, time)) {
      return res.status(400).json({ success: false, message: 'Selected date or time is outside the doctor clinic timings. Please choose an available slot.' });
    }
    if (await hasSlotConflict(appointment.doctorId, date, time, appointment.id)) {
      return res.status(409).json({ success: false, message: 'The new time is too close to another booking. Please choose a slot at least 30 minutes apart.' });
    }

    if (isPatient) {
      const updated = await prisma.appointment.update({
        where: { id: appointment.id },
        data: { rescheduleRequest: { requested: true, date: new Date(date), time, requestedAt: new Date() } },
      });
      await notify({
        userId: appointment.doctor.userId,
        type: 'appointment',
        title: 'Reschedule Requested',
        message: `${appointment.patient.fullName} requested to reschedule to ${new Date(date).toLocaleDateString()} at ${time}. Review and confirm.`,
        relatedId: appointment.id,
      });
      return res.status(200).json({ success: true, message: 'Reschedule request sent. Awaiting doctor confirmation.', data: serialize(updated) });
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        date: new Date(date),
        time,
        status: 'rescheduled',
        rescheduleRequest: { requested: false, date: null, time: null, requestedAt: null },
      },
    });
    await notify({
      userId: appointment.patient.userId,
      type: 'appointment',
      title: 'Appointment Rescheduled',
      message: `Your appointment has been rescheduled by ${appointment.doctor.fullName} to ${new Date(date).toLocaleDateString()} at ${time}.`,
      relatedId: appointment.id,
    });

    // Best-effort: email the patient about the new time.
    require('../utils/emails').sendAppointmentStatusEmail({ userId: appointment.patient.userId, status: 'rescheduled', treatment: appointment.treatmentType, date, time, name: appointment.doctor.fullName });

    res.status(200).json({ success: true, message: 'Appointment rescheduled successfully', data: serialize(updated) });
  } catch (error) {
    console.error('Reschedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to reschedule appointment', error: error.message });
  }
};

// @desc    Cancel an appointment
// @route   PUT /api/appointments/:id/cancel
const cancelAppointment = async (req, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { doctor: { select: { userId: true, fullName: true } }, patient: { select: { userId: true, fullName: true } } },
    });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (appointment.status === 'completed') return res.status(400).json({ success: false, message: 'Cannot cancel a completed appointment' });
    if (appointment.status === 'cancelled') return res.status(400).json({ success: false, message: 'Appointment is already cancelled' });

    const isPatient = appointment.patient?.userId === req.user._id;
    const isDoctor = appointment.doctor?.userId === req.user._id;
    if (!isPatient && !isDoctor) return res.status(403).json({ success: false, message: 'Not authorized to cancel this appointment' });

    const updated = await prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'cancelled' } });

    const recipientUserId = isPatient ? appointment.doctor.userId : appointment.patient.userId;
    const cancelledBy = isPatient ? appointment.patient.fullName : appointment.doctor.fullName;
    await notify({
      userId: recipientUserId,
      type: 'appointment',
      title: 'Appointment Cancelled',
      message: `Your appointment on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.time} has been cancelled by ${cancelledBy}.`,
      relatedId: appointment.id,
    });

    // Best-effort: email the other party that it was cancelled.
    require('../utils/emails').sendAppointmentStatusEmail({ userId: recipientUserId, status: 'cancelled', treatment: appointment.treatmentType, date: appointment.date, time: appointment.time, name: cancelledBy });

    res.status(200).json({ success: true, message: 'Appointment cancelled successfully', data: serialize(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to cancel appointment', error: error.message });
  }
};

// @desc    Complete an appointment
// @route   PUT /api/appointments/:id/complete
const completeAppointment = async (req, res) => {
  try {
    const { visitSummary } = req.body;
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { doctor: { select: { userId: true, fullName: true } }, patient: { select: { userId: true, fullName: true } } },
    });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    if (appointment.doctor?.userId !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Only the assigned doctor can complete this appointment' });
    }
    if (appointment.status === 'completed') return res.status(400).json({ success: false, message: 'Appointment is already completed' });
    if (appointment.status === 'cancelled') return res.status(400).json({ success: false, message: 'Cannot complete a cancelled appointment' });

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'completed', ...(visitSummary ? { visitSummary } : {}) },
    });

    // Award points on visit completion.
    try {
      const settings = await prisma.appSettings.findUnique({ where: { key: 'global' } });
      const doctorPts = settings?.rewardPointsPerAppointment ?? 50;

      const { addDoctorPoints } = require('../utils/popular');
      await addDoctorPoints(appointment.doctorId, doctorPts);

      const { rewardReferralOnFirstTreatment, rewardDoctorReferralOnFirstTreatment } = require('../utils/referral');
      const fullPatient = await prisma.patientProfile.findUnique({ where: { id: appointment.patientId } });
      await rewardReferralOnFirstTreatment(fullPatient);
      const fullDoctor = await prisma.doctorProfile.findUnique({ where: { id: appointment.doctorId } });
      await rewardDoctorReferralOnFirstTreatment(fullDoctor);
    } catch (e) {
      console.error('Award points error (non-fatal):', e.message);
    }

    await notify({
      userId: appointment.patient.userId,
      type: 'appointment',
      title: 'Appointment Completed',
      message: `Your appointment with Dr. ${appointment.doctor.fullName} has been marked as completed.`,
      relatedId: appointment.id,
    });

    res.status(200).json({ success: true, message: 'Appointment marked as completed', data: serialize(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to complete appointment', error: error.message });
  }
};

// @desc    Get visit summary for a completed appointment
// @route   GET /api/appointments/:id/visit-summary
const getVisitSummary = async (req, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { doctor: { select: { fullName: true, specialization: true, userId: true } }, patient: { select: { fullName: true, userId: true, profileImage: true } } },
    });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    const isPatient = appointment.patient?.userId === req.user._id;
    const isDoctor = appointment.doctor?.userId === req.user._id;
    if (!isPatient && !isDoctor && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this visit summary' });
    }
    if (appointment.status !== 'completed') return res.status(400).json({ success: false, message: 'Visit summary is only available for completed appointments' });
    if (!appointment.visitSummary) return res.status(404).json({ success: false, message: 'No visit summary has been added for this appointment' });

    res.status(200).json({
      success: true,
      data: serialize({
        appointmentId: appointment.id,
        date: appointment.date,
        time: appointment.time,
        treatmentType: appointment.treatmentType,
        doctor: appointment.doctor,
        patient: appointment.patient,
        visitSummary: appointment.visitSummary,
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch visit summary', error: error.message });
  }
};

// @desc    Add or update visit summary
// @route   POST /api/appointments/:id/visit-summary
const addVisitSummary = async (req, res) => {
  try {
    const { visitSummary } = req.body;
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { doctor: { select: { userId: true, fullName: true } }, patient: { select: { userId: true } } },
    });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (appointment.doctor?.userId !== req.user._id) return res.status(403).json({ success: false, message: 'Only the assigned doctor can add a visit summary' });
    if (appointment.status !== 'completed') return res.status(400).json({ success: false, message: 'Visit summary can only be added to completed appointments' });

    const updated = await prisma.appointment.update({ where: { id: appointment.id }, data: { visitSummary } });
    await notify({
      userId: appointment.patient.userId,
      type: 'appointment',
      title: 'Visit Summary Available',
      message: `Dr. ${appointment.doctor.fullName} has added a visit summary for your appointment on ${new Date(appointment.date).toLocaleDateString()}.`,
      relatedId: appointment.id,
    });

    res.status(200).json({ success: true, message: 'Visit summary added successfully', data: serialize(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add visit summary', error: error.message });
  }
};

// @desc    Confirm an appointment
// @route   PUT /api/appointments/:id/confirm
const confirmAppointment = async (req, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!doctorProfile || appointment.doctorId !== doctorProfile.id) return res.status(403).json({ success: false, message: 'Not authorized' });

    const data = { status: 'confirmed' };
    const rr = appointment.rescheduleRequest;
    if (rr && rr.requested) {
      data.date = new Date(rr.date);
      data.time = rr.time;
      data.rescheduleRequest = { requested: false, date: null, time: null, requestedAt: null };
    }
    const updated = await prisma.appointment.update({ where: { id: appointment.id }, data });

    // Best-effort: email the patient that the appointment is confirmed.
    prisma.patientProfile.findUnique({ where: { id: updated.patientId }, select: { userId: true } })
      .then((p) => { if (p?.userId) require('../utils/emails').sendAppointmentStatusEmail({ userId: p.userId, status: 'confirmed', treatment: updated.treatmentType, date: updated.date, time: updated.time, name: doctorProfile.fullName }); })
      .catch(() => {});

    res.status(200).json({ success: true, data: serialize(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
  addVisitSummary,
  confirmAppointment,
};
