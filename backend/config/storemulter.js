import multer from 'multer';
import crypto from 'crypto';

// Use memory storage (no local disk storage)
const storage = multer.memoryStorage();

// Enhanced file filter with magic number verification
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  // Check mimetype
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed'),
      false
    );
  }
  
  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  
  if (!allowedExtensions.includes(fileExtension)) {
    return cb(
      new Error('Invalid file extension'),
      false
    );
  }
  
  cb(null, true);
};

// Verify file magic numbers (first few bytes) to prevent spoofing
export const verifyFileSignature = (buffer, mimetype) => {
  if (!buffer || buffer.length === 0) {
    return false;
  }

  const signatures = {
    'image/jpeg': [
      [0xFF, 0xD8, 0xFF, 0xE0],
      [0xFF, 0xD8, 0xFF, 0xE1],
      [0xFF, 0xD8, 0xFF, 0xE2],
      [0xFF, 0xD8, 0xFF, 0xE3],
      [0xFF, 0xD8, 0xFF, 0xE8]
    ],
    'image/jpg': [
      [0xFF, 0xD8, 0xFF, 0xE0],
      [0xFF, 0xD8, 0xFF, 0xE1],
      [0xFF, 0xD8, 0xFF, 0xE2],
      [0xFF, 0xD8, 0xFF, 0xE3],
      [0xFF, 0xD8, 0xFF, 0xE8]
    ],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]]
  };

  const fileSignatures = signatures[mimetype];
  if (!fileSignatures) {
    return false;
  }

  return fileSignatures.some(signature => {
    if (buffer.length < signature.length) {
      return false;
    }
    
    return signature.every((byte, index) => buffer[index] === byte);
  });
};

// Generate secure random filename
export const generateSecureFilename = (originalName) => {
  const extension = originalName.toLowerCase().slice(originalName.lastIndexOf('.'));
  const randomName = crypto.randomBytes(16).toString('hex');
  return `${randomName}${extension}`;
};

// Single file upload configuration
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 1
  },
  fileFilter: fileFilter,
});

// Multiple files upload for verification documents
export const uploadVerificationDocs = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size per file
    files: 4, // Maximum 4 files total
    fieldSize: 5 * 1024 * 1024,
    parts: 10 // Limit parts to prevent attack
  },
  fileFilter: fileFilter,
}).fields([
  { name: 'ghanaCardFront', maxCount: 1 },
  { name: 'ghanaCardBack', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'businessDoc', maxCount: 1 }
]);

// Multiple files for product images (up to 5 images)
export const uploadProductImages = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
    fieldSize: 5 * 1024 * 1024,
    parts: 10
  },
  fileFilter: fileFilter,
}).array('images', 5);

// Multiple files for review images (up to 3 images)
export const uploadReviewImages = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 3,
    fieldSize: 5 * 1024 * 1024,
    parts: 10
  },
  fileFilter: fileFilter,
}).array('images', 3);

// Enhanced error handling middleware for multer
export const handleMulterError = (err, req, res, next) => {
  // Clear any uploaded files on error
  if (req.files) {
    req.files = undefined;
  }
  if (req.file) {
    req.file = undefined;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB per file',
        code: 'FILE_TOO_LARGE'
      });
    }
    
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded',
        code: 'TOO_MANY_FILES'
      });
    }
    
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name or too many files',
        code: 'UNEXPECTED_FIELD'
      });
    }
    
    if (err.code === 'LIMIT_FIELD_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many form fields',
        code: 'TOO_MANY_FIELDS'
      });
    }
    
    if (err.code === 'LIMIT_PART_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many parts in the request',
        code: 'TOO_MANY_PARTS'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'File upload error',
      code: 'UPLOAD_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
  } else if (err) {
    // Custom file filter errors
    return res.status(400).json({
      success: false,
      message: err.message || 'Invalid file upload',
      code: 'INVALID_FILE'
    });
  }
  
  next();
};

// Middleware to verify file signatures after upload
export const verifyUploadedFiles = (req, res, next) => {
  try {
    // Handle single file
    if (req.file) {
      if (!verifyFileSignature(req.file.buffer, req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'File appears to be corrupted or has an invalid format',
          code: 'INVALID_FILE_SIGNATURE'
        });
      }
    }

    // Handle multiple files (array)
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        if (!verifyFileSignature(file.buffer, file.mimetype)) {
          return res.status(400).json({
            success: false,
            message: `File ${file.originalname} appears to be corrupted or has an invalid format`,
            code: 'INVALID_FILE_SIGNATURE'
          });
        }
      }
    }

    // Handle multiple files (fields)
    if (req.files && typeof req.files === 'object' && !Array.isArray(req.files)) {
      for (const fieldName in req.files) {
        const filesArray = req.files[fieldName];
        for (const file of filesArray) {
          if (!verifyFileSignature(file.buffer, file.mimetype)) {
            return res.status(400).json({
              success: false,
              message: `File ${file.originalname} appears to be corrupted or has an invalid format`,
              code: 'INVALID_FILE_SIGNATURE'
            });
          }
        }
      }
    }

    next();
  } catch (error) {
    console.error('File verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying uploaded files',
      code: 'VERIFICATION_ERROR'
    });
  }
};