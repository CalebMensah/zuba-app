import multer from 'multer';

// Configure storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        'INVALID_FILE_TYPE',
        'Invalid file type. Only JPEG, PNG, GIF, WEBP images and MP4, MOV, AVI videos are allowed.'
      ),
      false
    );
  }
};

// Multer upload configuration
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  }
});

export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Handle Multer-specific errors
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'File too large',
          error: 'File size cannot exceed 10MB',
        });

      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files',
          error: 'Maximum 5 files allowed per upload',
        });

      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected field',
          error: `Unexpected file field: ${err.field}`,
        });

      case 'INVALID_FILE_TYPE':
        return res.status(400).json({
          success: false,
          message: 'Invalid file type',
          error: err.message || 'Only images and videos are allowed',
        });

      case 'LIMIT_PART_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many parts',
          error: 'Too many parts in the multipart request',
        });

      case 'LIMIT_FIELD_KEY':
        return res.status(400).json({
          success: false,
          message: 'Field name too long',
          error: 'Field name is too long',
        });

      case 'LIMIT_FIELD_VALUE':
        return res.status(400).json({
          success: false,
          message: 'Field value too long',
          error: 'Field value is too long',
        });

      case 'LIMIT_FIELD_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many fields',
          error: 'Too many fields in the request',
        });

      default:
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: err.message || 'An error occurred during file upload',
        });
    }
  } else if (err) {
    // Handle other errors (e.g., from fileFilter)
    if (err.message.includes('Invalid file type')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type',
        error: err.message,
      });
    }

    // Generic error handler
    console.error('Upload error:', err);
    return res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: 'An unexpected error occurred during file upload',
    });
  }

  // No error, continue to next middleware
  next();
};

export const validateUploadedFiles = (files) => {
  if (!files || files.length === 0) {
    return {
      valid: false,
      error: 'No files uploaded',
    };
  }

  // Check if all files are within size limit
  const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024);
  if (oversizedFiles.length > 0) {
    return {
      valid: false,
      error: `${oversizedFiles.length} file(s) exceed the 10MB size limit`,
    };
  }

  // Check file count
  if (files.length > 5) {
    return {
      valid: false,
      error: 'Maximum 5 files allowed',
    };
  }

  return {
    valid: true,
    files,
  };
};

export const getFileExtension = (mimetype) => {
  const mimeToExt = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi'
  };

  return mimeToExt[mimetype] || '';
};

export const isImage = (mimetype) => {
  return mimetype.startsWith('image/');
};

export const isVideo = (mimetype) => {
  return mimetype.startsWith('video/');
};