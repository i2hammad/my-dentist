const prisma = require('../config/prisma');
const { serialize } = require('../utils/serialize');
const { saveUpload } = require('../config/upload');

// @desc    Get logged-in doctor's gallery items
// @route   GET /api/gallery/my
// @access  Private (Doctor)
const getMyGallery = async (req, res) => {
  try {
    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!doctorProfile) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found. Please create a doctor profile first.' });
    }

    const galleryItems = await prisma.gallery.findMany({ where: { doctorId: doctorProfile.id }, orderBy: { createdAt: 'desc' } });
    res.status(200).json({ success: true, data: serialize(galleryItems), count: galleryItems.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch gallery', error: error.message });
  }
};

// @desc    Get gallery items for a doctor
// @route   GET /api/gallery/doctor/:doctorId
// @access  Public
const getDoctorGallery = async (req, res) => {
  try {
    const { doctorId } = req.params;
    // doctorId may be the profile id OR the userId.
    const doctor = await prisma.doctorProfile.findFirst({ where: { OR: [{ id: doctorId }, { userId: doctorId }] } });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const galleryItems = await prisma.gallery.findMany({ where: { doctorId: doctor.id }, orderBy: { createdAt: 'desc' } });
    res.status(200).json({ success: true, data: serialize(galleryItems), count: galleryItems.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch gallery', error: error.message });
  }
};

// @desc    Upload gallery item
// @route   POST /api/gallery
// @access  Private (Doctor)
const addGalleryItem = async (req, res) => {
  try {
    const { category, title, description } = req.body;

    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!doctorProfile) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found. Please create a doctor profile first.' });
    }

    const galleryData = { doctorId: doctorProfile.id, category, title: title || '', description: description || '' };

    if (category === 'before_after') {
      if (req.files) {
        if (req.files.beforeImage && req.files.beforeImage[0]) {
          galleryData.beforeImage = await saveUpload(req.files.beforeImage[0], 'mydentist/gallery');
        }
        if (req.files.afterImage && req.files.afterImage[0]) {
          galleryData.afterImage = await saveUpload(req.files.afterImage[0], 'mydentist/gallery');
        }
      }
      if (!galleryData.beforeImage && req.body.beforeImage) galleryData.beforeImage = req.body.beforeImage;
      if (!galleryData.afterImage && req.body.afterImage) galleryData.afterImage = req.body.afterImage;
      galleryData.imageUrl = galleryData.beforeImage || galleryData.afterImage || req.body.imageUrl || req.body.image || 'before_after_gallery';
    } else {
      if (req.files && req.files.image && req.files.image[0]) {
        galleryData.imageUrl = await saveUpload(req.files.image[0], 'mydentist/gallery');
      } else if (req.file) {
        galleryData.imageUrl = await saveUpload(req.file, 'mydentist/gallery');
      } else if (req.body.imageUrl) {
        galleryData.imageUrl = req.body.imageUrl;
      } else if (req.body.image) {
        galleryData.imageUrl = req.body.image;
      }
    }

    const galleryItem = await prisma.gallery.create({ data: galleryData });
    res.status(201).json({ success: true, data: serialize(galleryItem), message: 'Gallery item added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add gallery item', error: error.message });
  }
};

// @desc    Delete gallery item
// @route   DELETE /api/gallery/:id
// @access  Private (Doctor)
const deleteGalleryItem = async (req, res) => {
  try {
    const galleryItem = await prisma.gallery.findUnique({ where: { id: req.params.id } });
    if (!galleryItem) return res.status(404).json({ success: false, message: 'Gallery item not found' });

    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!doctorProfile || galleryItem.doctorId !== doctorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this gallery item' });
    }

    await prisma.gallery.delete({ where: { id: req.params.id } });
    res.status(200).json({ success: true, message: 'Gallery item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete gallery item', error: error.message });
  }
};

module.exports = { getMyGallery, getDoctorGallery, addGalleryItem, deleteGalleryItem };
