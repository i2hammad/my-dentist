const prisma = require('../config/prisma');
const { serialize, remapMany } = require('../utils/serialize');

// @desc    Get user's favorited doctors
// @route   GET /api/favorites
// @access  Private
const getFavorites = async (req, res) => {
  try {
    // Only favorites whose doctor still exists and isn't blocked.
    const favorites = await prisma.favorite.findMany({
      where: { patientId: req.user._id, doctor: { is: { isBlocked: false } } },
      include: { doctor: true },
      orderBy: { createdAt: 'desc' },
    });

    // Reproduce the populate shape: doctor object under `doctorId`.
    const data = serialize(remapMany(favorites, { doctor: 'doctorId' }));
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch favorites', error: error.message });
  }
};

// @desc    Add doctor to favorites
// @route   POST /api/favorites/:doctorId
// @access  Private
const addFavorite = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
    if (!doctor || doctor.isBlocked) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }
    if (doctor.userId && doctor.userId === req.user._id) {
      return res.status(400).json({ success: false, message: 'You cannot add yourself to favorites' });
    }

    const existing = await prisma.favorite.findUnique({
      where: { patientId_doctorId: { patientId: req.user._id, doctorId } },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Doctor is already in your favorites' });
    }

    const favorite = await prisma.favorite.create({ data: { patientId: req.user._id, doctorId } });
    res.status(201).json({ success: true, data: serialize(favorite), message: 'Doctor added to favorites' });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Doctor is already in your favorites' });
    }
    res.status(500).json({ success: false, message: 'Failed to add favorite', error: error.message });
  }
};

// @desc    Remove doctor from favorites
// @route   DELETE /api/favorites/:doctorId
// @access  Private
const removeFavorite = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { count } = await prisma.favorite.deleteMany({ where: { patientId: req.user._id, doctorId } });
    if (count === 0) return res.status(404).json({ success: false, message: 'Favorite not found' });
    res.status(200).json({ success: true, message: 'Doctor removed from favorites' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to remove favorite', error: error.message });
  }
};

module.exports = { getFavorites, addFavorite, removeFavorite };
