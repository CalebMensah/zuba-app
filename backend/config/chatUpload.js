// middleware/chatUpload.js
import multer from 'multer';
import path from 'path';

// File filter for chat media (images and videos)
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedVideoTypes = /mp4|mov|avi|wmv|flv|webm/;
  const allowedDocTypes = /pdf|doc|docx|txt/;
  
  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  // Check if it's an image
  const isImage = allowedImageTypes.test(extname.substring(1)) && 
                  mimetype.startsWith('image/');
  
  // Check if it's a video
  const isVideo = allowedVideoTypes.test(extname.substring(1)) && 
                  mimetype.startsWith('video/');
  
  // Check if it's a document
  const isDocument = allowedDocTypes.test(extname.substring(1)) && 
                     (mimetype.startsWith('application/') || mimetype.startsWith('text/'));

  if (isImage || isVideo || isDocument) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: images (jpeg, jpg, png, gif, webp), videos (mp4, mov, avi, wmv, flv, webm), documents (pdf, doc, docx, txt)`), false);
  }
};

// File size limits
const limits = {
  fileSize: 50 * 1024 * 1024, // 50MB max file size
  files: 5 // Maximum 5 files per upload
};

// Configure multer for memory storage (for Cloudinary upload)
const storage = multer.memoryStorage();

// Main chat upload middleware
export const chatUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits
});

// Specific middleware for different types
export const uploadChatMedia = chatUpload.array('media', 5); // Up to 5 files
export const uploadSingleImage = chatUpload.single('image'); // Single image
export const uploadSingleVideo = chatUpload.single('video'); // Single video

// Error handling middleware
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 50MB per file.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 5 files per upload.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name. Use "media" for chat files.'
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  next();
};

export default {
  chatUpload,
  uploadChatMedia,
  uploadSingleImage,
  uploadSingleVideo,
  handleMulterError
};