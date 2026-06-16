const User = require('../models/User');
const PatientProfile = require('../models/PatientProfile');
const DoctorProfile = require('../models/DoctorProfile');
const { memoryUpload, uploadToCloudinary } = require('../config/cloudinary');

// Uploads are streamed to Cloudinary (persistent on serverless hosts).
// memoryUpload keeps the file as a Buffer in req.file.buffer.
const upload = memoryUpload;

// @desc    Get current user with profile
// @route   GET /api/users/me
// @access  Protected
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Fetch associated profile based on role
    let profile = null;
    if (user.role === 'patient') {
      profile = await PatientProfile.findOne({ userId: user._id });
    } else if (user.role === 'doctor') {
      profile = await DoctorProfile.findOne({ userId: user._id });
    }

    res.status(200).json({
      success: true,
      data: {
        user,
        profile
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user profile'
    });
  }
};

// @desc    Update current user
// @route   PUT /api/users/me
// @access  Protected
const updateMe = async (req, res) => {
  try {
    // Fields that are allowed to be updated
    const allowedFields = ['email', 'role'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = field === 'email' ? req.body[field].toLowerCase() : req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // If email is being changed, check for duplicates
    if (updates.email) {
      const existingUser = await User.findOne({
        email: updates.email,
        _id: { $ne: req.user._id }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already in use by another account'
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user'
    });
  }
};

// @desc    Create patient profile
// @route   POST /api/users/patient-profile
// @access  Protected
const createPatientProfile = async (req, res) => {
  try {
    // Check if profile already exists
    const existingProfile = await PatientProfile.findOne({ userId: req.user._id });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Patient profile already exists. Use PUT to update.'
      });
    }

    const { fullName, mobileNumber, dateOfBirth, gender, city, location } = req.body;

    const profile = await PatientProfile.create({
      userId: req.user._id,
      fullName,
      mobileNumber,
      dateOfBirth,
      gender,
      city,
      location
    });

    res.status(201).json({
      success: true,
      message: 'Patient profile created successfully',
      data: profile
    });
  } catch (error) {
    console.error('Create patient profile error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Patient profile already exists for this user'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while creating patient profile'
    });
  }
};

// @desc    Update patient profile
// @route   PUT /api/users/patient-profile
// @access  Protected
const updatePatientProfile = async (req, res) => {
  try {
    const profile = await PatientProfile.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found. Create one first using POST.'
      });
    }

    const allowedFields = ['fullName', 'mobileNumber', 'dateOfBirth', 'gender', 'city', 'location'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const updatedProfile = await PatientProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Patient profile updated successfully',
      data: updatedProfile
    });
  } catch (error) {
    console.error('Update patient profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating patient profile'
    });
  }
};

// @desc    Upload avatar image
// @route   POST /api/users/upload-avatar
// @access  Protected
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file (jpg, jpeg, or png, max 5MB)'
      });
    }

    const imageUrl = await uploadToCloudinary(req.file.buffer, 'mydentist/avatars');

    // Update profile image on PatientProfile
    const profile = await PatientProfile.findOneAndUpdate(
      { userId: req.user._id },
      { profileImage: imageUrl },
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found. Create a patient profile first.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        profileImage: imageUrl,
        profile
      }
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading avatar'
    });
  }
};

// @desc    Upload any document or image
// @route   POST /api/users/upload
// @access  Protected
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file'
      });
    }

    const fileUrl = await uploadToCloudinary(req.file.buffer, 'mydentist/uploads');

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: fileUrl,
        filename: req.file.originalname
      }
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading file'
    });
  }
};

module.exports = {
  getMe,
  updateMe,
  createPatientProfile,
  updatePatientProfile,
  uploadAvatar,
  uploadFile,
  upload
};

// @desc    Update doctor profile
// @route   PUT /api/users/doctor-profile
// @access  Protected
const updateDoctorProfile = async (req, res) => {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user._id });
    if (!profile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    const allowedFields = [
      'fullName',
      'specialization',
      'qualification',
      'consultationFee',
      'experience',
      'clinicName',
      'clinicTier',
      'languages',
      'clinicTiming',
      'onlineStatus',
      'about',
      'address',
      'photo',
      'pmdcNumber',
      'gender',
      'clinicContact',
      'city',
      'phone',
      'licenseCert',
      'idFront',
      'idBack',
      'location',
      'services',
      'facilityScore'
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, message: 'No valid fields to update' });
    const updatedProfile = await DoctorProfile.findOneAndUpdate({ userId: req.user._id }, { $set: updates }, { new: true, runValidators: true });
    res.status(200).json({ success: true, message: 'Doctor profile updated', data: updatedProfile });
  } catch (error) {
    console.error('Update doctor profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
module.exports.updateDoctorProfile = updateDoctorProfile;
