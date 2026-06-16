const Gallery = require('../models/Gallery');
const DoctorProfile = require('../models/DoctorProfile');
const { uploadToCloudinary } = require('../config/cloudinary');

// @desc    Get logged-in doctor's gallery items
// @route   GET /api/gallery/my
// @access  Private (Doctor)
const getMyGallery = async (req, res) => {
  try {
    const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });

    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found. Please create a doctor profile first.',
      });
    }

    const galleryItems = await Gallery.find({ doctorId: doctorProfile._id })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: galleryItems,
      count: galleryItems.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gallery',
      error: error.message,
    });
  }
};

// @desc    Get gallery items for a doctor grouped by category
// @route   GET /api/gallery/doctor/:doctorId
// @access  Public
const getDoctorGallery = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const mongoose = require('mongoose');

    // Verify doctor exists - can be queried by profile ID or userId
    let doctor = null;
    if (mongoose.isValidObjectId(doctorId)) {
      doctor = await DoctorProfile.findOne({
        $or: [{ _id: doctorId }, { userId: doctorId }]
      });
    }

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }

    const galleryItems = await Gallery.find({ doctorId: doctor._id })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: galleryItems,
      count: galleryItems.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gallery',
      error: error.message,
    });
  }
};

// @desc    Upload gallery item
// @route   POST /api/gallery
// @access  Private (Doctor)
const addGalleryItem = async (req, res) => {
  try {
    const { category, title, description } = req.body;

    const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });
    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found. Please create a doctor profile first.',
      });
    }

    const galleryData = {
      doctorId: doctorProfile._id,
      category,
      title,
      description,
    };

    // Handle file uploads — stream buffers to Cloudinary
    if (category === 'before_after') {
      // For before/after, handle two images
      if (req.files) {
        if (req.files.beforeImage && req.files.beforeImage[0]) {
          galleryData.beforeImage = await uploadToCloudinary(
            req.files.beforeImage[0].buffer,
            'mydentist/gallery'
          );
        }
        if (req.files.afterImage && req.files.afterImage[0]) {
          galleryData.afterImage = await uploadToCloudinary(
            req.files.afterImage[0].buffer,
            'mydentist/gallery'
          );
        }
      }

      // Also accept URLs from body if no files uploaded
      if (!galleryData.beforeImage && req.body.beforeImage) {
        galleryData.beforeImage = req.body.beforeImage;
      }
      if (!galleryData.afterImage && req.body.afterImage) {
        galleryData.afterImage = req.body.afterImage;
      }
      // Populate required imageUrl for before_after
      galleryData.imageUrl = galleryData.beforeImage || galleryData.afterImage || req.body.imageUrl || req.body.image || 'before_after_gallery';
    } else {
      // Single image upload
      if (req.files && req.files.image && req.files.image[0]) {
        galleryData.imageUrl = await uploadToCloudinary(
          req.files.image[0].buffer,
          'mydentist/gallery'
        );
      } else if (req.file) {
        galleryData.imageUrl = await uploadToCloudinary(
          req.file.buffer,
          'mydentist/gallery'
        );
      } else if (req.body.imageUrl) {
        galleryData.imageUrl = req.body.imageUrl;
      } else if (req.body.image) {
        galleryData.imageUrl = req.body.image;
      }
    }

    const galleryItem = await Gallery.create(galleryData);

    res.status(201).json({
      success: true,
      data: galleryItem,
      message: 'Gallery item added successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add gallery item',
      error: error.message,
    });
  }
};

// @desc    Delete gallery item
// @route   DELETE /api/gallery/:id
// @access  Private (Doctor)
const deleteGalleryItem = async (req, res) => {
  try {
    const galleryItem = await Gallery.findById(req.params.id);

    if (!galleryItem) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found',
      });
    }

    // Verify ownership
    const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });
    if (!doctorProfile || galleryItem.doctorId.toString() !== doctorProfile._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this gallery item',
      });
    }

    await Gallery.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Gallery item deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete gallery item',
      error: error.message,
    });
  }
};

module.exports = {
  getMyGallery,
  getDoctorGallery,
  addGalleryItem,
  deleteGalleryItem,
};
