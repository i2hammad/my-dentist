const prisma = require('../config/prisma');
const { serialize } = require('../utils/serialize');
const { memoryUpload, saveUpload } = require('../config/upload');
const { normalizeClinicTiming } = require('../utils/clinicTiming');

const upload = memoryUpload;

// Derive numeric lat/lng from a GeoJSON `location` ([lng,lat]) or a "lat, lng" string.
const deriveLatLng = (body) => {
  if (body.location && Array.isArray(body.location.coordinates) && body.location.coordinates.length === 2) {
    const [lng, lat] = body.location.coordinates.map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  if (typeof body.coordinates === 'string' && body.coordinates.includes(',')) {
    const [lat, lng] = body.coordinates.split(',').map((s) => Number(s.trim()));
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return {};
};

// @desc    Get current user with profile
// @route   GET /api/users/me
// @access  Protected
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user._id }, omit: { password: true, refreshToken: true } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let profile = null;
    if (user.role === 'patient') profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
    else if (user.role === 'doctor') profile = await prisma.doctorProfile.findUnique({ where: { userId: user.id } });
    else if (user.role === 'admin') profile = await prisma.adminProfile.findUnique({ where: { userId: user.id } });

    res.status(200).json({ success: true, data: { user: serialize(user), profile: serialize(profile) } });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching user profile' });
  }
};

// @desc    Update current user
// @route   PUT /api/users/me
// @access  Protected
const updateMe = async (req, res) => {
  try {
    const updates = {};
    if (req.body.email !== undefined) updates.email = req.body.email.toLowerCase();
    if (req.body.role !== undefined) updates.role = req.body.role;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    if (updates.email) {
      const existing = await prisma.user.findFirst({ where: { email: updates.email, id: { not: req.user._id } } });
      if (existing) return res.status(400).json({ success: false, message: 'Email is already in use by another account' });
    }

    const user = await prisma.user.update({ where: { id: req.user._id }, data: updates, omit: { password: true, refreshToken: true } });
    res.status(200).json({ success: true, message: 'User updated successfully', data: serialize(user) });
  } catch (error) {
    console.error('Update me error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating user' });
  }
};

// Build patient-profile column data from a request body.
const patientData = (b) => {
  const data = {};
  if (b.fullName !== undefined) data.fullName = b.fullName;
  if (b.mobileNumber !== undefined) data.mobileNumber = b.mobileNumber;
  if (b.dateOfBirth !== undefined) data.dateOfBirth = b.dateOfBirth ? new Date(b.dateOfBirth) : null;
  if (b.gender !== undefined) data.gender = b.gender;
  if (b.city !== undefined) data.city = b.city;
  if (b.age !== undefined) data.age = b.age === null || b.age === '' ? null : parseInt(b.age, 10);
  if (b.address !== undefined) data.address = b.address;
  if (b.coordinates !== undefined) data.coordinates = b.coordinates;
  if (b.familyMembers !== undefined) data.familyMembers = b.familyMembers;
  Object.assign(data, deriveLatLng(b));
  return data;
};

// @desc    Create patient profile
// @route   POST /api/users/patient-profile
// @access  Protected
const createPatientProfile = async (req, res) => {
  try {
    const existing = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
    if (existing) return res.status(400).json({ success: false, message: 'Patient profile already exists. Use PUT to update.' });

    const data = patientData(req.body);
    data.userId = req.user._id;
    data.fullName = req.body.fullName || 'New Patient';

    const profile = await prisma.patientProfile.create({ data });
    res.status(201).json({ success: true, message: 'Patient profile created successfully', data: serialize(profile) });
  } catch (error) {
    console.error('Create patient profile error:', error);
    if (error.code === 'P2002') return res.status(400).json({ success: false, message: 'Patient profile already exists for this user' });
    res.status(500).json({ success: false, message: 'Server error while creating patient profile' });
  }
};

// @desc    Update patient profile
// @route   PUT /api/users/patient-profile
// @access  Protected
const updatePatientProfile = async (req, res) => {
  try {
    const profile = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Patient profile not found. Create one first using POST.' });

    const updates = patientData(req.body);
    if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, message: 'No valid fields to update' });

    const updated = await prisma.patientProfile.update({ where: { userId: req.user._id }, data: updates });
    res.status(200).json({ success: true, message: 'Patient profile updated successfully', data: serialize(updated) });
  } catch (error) {
    console.error('Update patient profile error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating patient profile' });
  }
};

// @desc    Upload avatar image
// @route   POST /api/users/upload-avatar
// @access  Protected
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Please upload an image file (jpg, jpeg, or png, max 5MB)' });

    const imageUrl = await saveUpload(req.file, 'mydentist/avatars');

    let profile;
    try {
      profile = await prisma.patientProfile.update({ where: { userId: req.user._id }, data: { profileImage: imageUrl } });
    } catch (e) {
      // Don't swallow the real reason — log it so we can tell "no profile" (P2025)
      // apart from a transient DB error (e.g. on a cold start).
      console.error(`Upload avatar: patientProfile.update failed for userId=${req.user?._id}:`, e.code || e.message);
      if (e.code === 'P2025') {
        return res.status(404).json({ success: false, message: 'Patient profile not found. Create a patient profile first.' });
      }
      throw e; // real error → 500 path below, which logs the full error
    }

    res.status(200).json({ success: true, message: 'Avatar uploaded successfully', data: { profileImage: imageUrl, profile: serialize(profile) } });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ success: false, message: 'Server error while uploading avatar' });
  }
};

// @desc    Upload any document or image
// @route   POST /api/users/upload
// @access  Protected
const uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a file' });
    const fileUrl = await saveUpload(req.file, 'mydentist/uploads');
    res.status(200).json({ success: true, message: 'File uploaded successfully', data: { url: fileUrl, filename: req.file.originalname } });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ success: false, message: 'Server error while uploading file' });
  }
};

// @desc    Update doctor profile
// @route   PUT /api/users/doctor-profile
// @access  Protected
const updateDoctorProfile = async (req, res) => {
  try {
    const profile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const scalar = [
      'fullName', 'specialization', 'qualification', 'clinicName', 'clinicTier',
      'onlineStatus', 'about', 'address', 'photo', 'pmdcNumber', 'gender',
      'clinicContact', 'city', 'phone', 'licenseCert', 'idFront', 'idBack',
    ];
    const updates = {};
    for (const f of scalar) if (req.body[f] !== undefined) updates[f] = req.body[f];
    if (req.body.consultationFee !== undefined) updates.consultationFee = Number(req.body.consultationFee);
    if (req.body.experience !== undefined) updates.experience = Number(req.body.experience);
    if (req.body.facilityScore !== undefined) updates.facilityScore = Number(req.body.facilityScore);
    if (req.body.languages !== undefined) updates.languages = req.body.languages;
    if (req.body.services !== undefined) updates.services = req.body.services;
    if (req.body.payoutAccount !== undefined) updates.payoutAccount = req.body.payoutAccount;
    if (req.body.coordinates !== undefined) updates.coordinates = req.body.coordinates;
    Object.assign(updates, deriveLatLng(req.body));

    if (req.body.clinicTiming !== undefined) {
      try {
        updates.clinicTiming = normalizeClinicTiming(req.body.clinicTiming);
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, message: 'No valid fields to update' });

    const updated = await prisma.doctorProfile.update({ where: { userId: req.user._id }, data: updates });
    res.status(200).json({ success: true, message: 'Doctor profile updated', data: serialize(updated) });
  } catch (error) {
    console.error('Update doctor profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Referral program ──────────────────────────────────────
// @route GET /api/users/referral
const getReferral = async (req, res) => {
  try {
    const { ensureReferralCode, REFERRAL_POINTS } = require('../utils/referral');
    const profile = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Patient profile not found' });

    const code = await ensureReferralCode(profile);
    const referredCount = await prisma.patientProfile.count({ where: { referredBy: profile.id } });
    const earned = await prisma.reward.aggregate({ where: { patientId: profile.id, type: 'referral' }, _sum: { points: true } });

    res.json({
      success: true,
      data: {
        code,
        referredBy: profile.referredBy || null,
        pointsPerReferral: REFERRAL_POINTS,
        referredCount,
        referralPointsEarned: earned._sum.points || 0,
        webLink: `https://mydentistpk.com/?ref=${code}`,
        androidLink: `https://play.google.com/store/apps/details?id=com.mydentistpk&ref=${code}`,
        iosLink: `https://apps.apple.com/app/my-dentist-pk/id0000000000?ref=${code}`,
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// @route POST /api/users/referral/apply
const applyReferral = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Referral code is required' });
    const me = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
    if (!me) return res.status(404).json({ success: false, message: 'Patient profile not found' });
    if (me.referredBy) return res.status(400).json({ success: false, message: 'A referral code was already applied to your account.' });

    const clean = code.trim().toUpperCase();
    const patientReferrer = await prisma.patientProfile.findFirst({ where: { referralCode: clean } });
    const doctorReferrer = patientReferrer ? null : await prisma.doctorProfile.findFirst({ where: { referralCode: clean } });
    if (!patientReferrer && !doctorReferrer) return res.status(404).json({ success: false, message: 'Invalid referral code.' });
    if (patientReferrer && patientReferrer.id === me.id) {
      return res.status(400).json({ success: false, message: "You can't use your own referral code." });
    }

    await prisma.patientProfile.update({
      where: { id: me.id },
      data: {
        referredBy: (patientReferrer || doctorReferrer).id,
        referredByModel: patientReferrer ? 'PatientProfile' : 'DoctorProfile',
      },
    });
    res.json({ success: true, message: 'Referral applied! You and your referrer get 100 points after your first completed treatment.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// @route GET /api/users/doctor-referral
const getDoctorReferral = async (req, res) => {
  try {
    const { ensureDoctorReferralCode, REFERRAL_POINTS } = require('../utils/referral');
    const me = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!me) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    const code = await ensureDoctorReferralCode(me);

    const [patientReferredCount, patientRewarded, doctorReferredCount, doctorRewarded] = await Promise.all([
      prisma.patientProfile.count({ where: { referredBy: me.id, referredByModel: 'DoctorProfile' } }),
      prisma.patientProfile.count({ where: { referredBy: me.id, referredByModel: 'DoctorProfile', referralRewarded: true } }),
      prisma.doctorProfile.count({ where: { referredBy: me.id } }),
      prisma.doctorProfile.count({ where: { referredBy: me.id, referralRewarded: true } }),
    ]);

    res.json({
      success: true,
      data: {
        code,
        pointsPerReferral: REFERRAL_POINTS,
        patient: { referredCount: patientReferredCount, pointsEarned: patientRewarded * REFERRAL_POINTS },
        doctor: {
          referredCount: doctorReferredCount,
          pointsEarned: doctorRewarded * REFERRAL_POINTS,
          referredByApplied: !!me.referredBy,
        },
        webLink: `https://mydentistpk.com/?ref=${code}`,
        androidLink: `https://play.google.com/store/apps/details?id=com.mydentistpk&ref=${code}`,
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// @route POST /api/users/doctor-referral/apply
const applyDoctorReferral = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Referral code is required' });
    const me = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!me) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    if (me.referredBy) return res.status(400).json({ success: false, message: 'A referral code was already applied to your account.' });

    const referrer = await prisma.doctorProfile.findFirst({ where: { referralCode: code.trim().toUpperCase() } });
    if (!referrer) return res.status(404).json({ success: false, message: 'Invalid doctor referral code.' });
    if (referrer.id === me.id) return res.status(400).json({ success: false, message: "You can't use your own referral code." });

    await prisma.doctorProfile.update({ where: { id: me.id }, data: { referredBy: referrer.id } });
    res.json({ success: true, message: 'Referral applied! Both doctors get 100 points after your first completed patient treatment.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

module.exports = {
  getMe,
  updateMe,
  createPatientProfile,
  updatePatientProfile,
  uploadAvatar,
  uploadFile,
  upload,
  updateDoctorProfile,
  getReferral,
  applyReferral,
  getDoctorReferral,
  applyDoctorReferral,
};
