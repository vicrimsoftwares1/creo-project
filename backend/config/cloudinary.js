// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Image storage ─────────────────────────────────────────────────────────────
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'creo-agency/portfolio',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1200, crop: 'limit', quality: 'auto' }],
  },
});

// ── PDF storage ───────────────────────────────────────────────────────────────
const pdfStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'creo-agency/pdfs',
    allowed_formats: ['pdf'],
    resource_type: 'raw',
  },
});

// ── Profile image storage ─────────────────────────────────────────────────────
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'creo-agency/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
  },
});

const uploadImages = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },  // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const valid = allowed.test(file.mimetype);
    cb(valid ? null : new Error('Only image files are allowed'), valid);
  },
});

const uploadPdf = multer({
  storage: pdfStorage,
  limits: { fileSize: 20 * 1024 * 1024 },  // 20MB
  fileFilter: (req, file, cb) => {
    const valid = file.mimetype === 'application/pdf';
    cb(valid ? null : new Error('Only PDF files are allowed'), valid);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Delete a file from Cloudinary by URL
const deleteFile = async (url) => {
  try {
    if (!url) return;
    // Extract public_id from URL
    const parts = url.split('/');
    const folderAndFile = parts.slice(parts.indexOf('creo-agency')).join('/');
    const publicId = folderAndFile.replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
};

module.exports = { cloudinary, uploadImages, uploadPdf, uploadAvatar, deleteFile };
