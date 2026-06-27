import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import dotenv from 'dotenv';

dotenv.config();

// Validate environment variables
if (!process.env.CLOUDINARY_CLOUD_NAME || 
    !process.env.CLOUDINARY_API_KEY || 
    !process.env.CLOUDINARY_API_SECRET) {
  throw new Error('Missing required Cloudinary environment variables');
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // Always use HTTPS
});

// Security limits
const LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGE_DIMENSION: 4096, // 4096px
  MAX_VIDEO_DURATION: 60, // 60 seconds
  UPLOAD_TIMEOUT: 30000 // 30 seconds
};

// Allowed formats by resource type
const ALLOWED_FORMATS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
  video: ['mp4', 'mov', 'avi', 'webm'],
  raw: ['pdf', 'doc', 'docx']
};


const validateUploadOptions = (options) => {
  const validFolders = ['avatars', 'products', 'store-logos', 'reviews', 'chat-media', 'uploads', 'delivery_proofs'];
  
  if (options.folder && !validFolders.includes(options.folder)) {
    throw new Error(`Invalid folder: ${options.folder}`);
  }

  if (options.width && (options.width < 1 || options.width > LIMITS.MAX_IMAGE_DIMENSION)) {
    throw new Error(`Width must be between 1 and ${LIMITS.MAX_IMAGE_DIMENSION}`);
  }

  if (options.height && (options.height < 1 || options.height > LIMITS.MAX_IMAGE_DIMENSION)) {
    throw new Error(`Height must be between 1 and ${LIMITS.MAX_IMAGE_DIMENSION}`);
  }

  return true;
};

/**
 * Validate buffer size
 */
const validateBufferSize = (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid buffer provided');
  }

  if (buffer.length > LIMITS.MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  return true;
};

export const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      // Validate inputs
      validateBufferSize(buffer);
      validateUploadOptions(options);

      const {
        folder = 'uploads',
        width,
        height,
        crop = 'fill',
        gravity = 'auto',
        resource_type = 'auto'
      } = options;

      const transformations = [
        { quality: 'auto:good' }, // Optimize quality
        { fetch_format: 'auto' },
      ];

      // Add resize transformation if width and height are provided
      if (width && height) {
        transformations.unshift({
          width,
          height,
          crop,
          gravity,
        });
      }

      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(new Error('Upload timeout exceeded'));
      }, LIMITS.UPLOAD_TIMEOUT);

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: resource_type,
          transformation: transformations,
          allowed_formats: ALLOWED_FORMATS.image.concat(ALLOWED_FORMATS.video),
          // Security options
          overwrite: false,
          invalidate: true,
          use_filename: false,
          unique_filename: true,
          // Moderation
          moderation: 'manual', // Enable manual moderation if needed
          // Access control
          access_mode: 'public',
          type: 'upload'
        },
        (error, result) => {
          clearTimeout(timeoutId);
          
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(new Error('Failed to upload file to cloud storage'));
          } else {
            // Return only necessary information
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
              resource_type: result.resource_type,
              format: result.format,
              width: result.width,
              height: result.height,
              bytes: result.bytes,
              created_at: result.created_at
            });
          }
        }
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    } catch (error) {
      reject(error);
    }
  });
};


export const uploadMultipleToCloudinary = async (buffers, options = {}) => {
  try {
    if (!Array.isArray(buffers)) {
      throw new Error('Buffers must be an array');
    }

    if (buffers.length === 0) {
      throw new Error('No files to upload');
    }

    if (buffers.length > 10) {
      throw new Error('Cannot upload more than 10 files at once');
    }

    // Validate all buffers first
    buffers.forEach(buffer => validateBufferSize(buffer));

    // Upload all files
    const uploadPromises = buffers.map(buffer => 
      uploadToCloudinary(buffer, options)
    );

    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    console.error('Error uploading multiple files:', error);
    throw error;
  }
};


const extractPublicId = (imageUrl) => {
  try {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return null;
    }

    // Validate URL format
    const url = new URL(imageUrl);
    if (!url.hostname.includes('cloudinary.com')) {
      throw new Error('Invalid Cloudinary URL');
    }

    const urlParts = url.pathname.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    
    if (uploadIndex === -1 || uploadIndex >= urlParts.length - 1) {
      throw new Error('Invalid Cloudinary URL structure');
    }

    // Skip version and transformations
    let startIndex = uploadIndex + 1;
    while (startIndex < urlParts.length && urlParts[startIndex].startsWith('v')) {
      startIndex++;
    }

    const pathAfterUpload = urlParts.slice(startIndex).join('/');
    const publicId = pathAfterUpload.split('.')[0];
    
    if (!publicId) {
      throw new Error('Could not extract public_id');
    }

    return publicId;
  } catch (error) {
    console.error('Error extracting public_id:', error.message);
    return null;
  }
};

export const deleteFromCloudinary = async (imageUrl) => {
  try {
    if (!imageUrl) {
      console.warn('No image URL provided for deletion');
      return { result: 'skipped', reason: 'no_url' };
    }

    const publicId = extractPublicId(imageUrl);
    
    if (!publicId) {
      console.warn('Could not extract public_id from URL:', imageUrl);
      return { result: 'failed', reason: 'invalid_url' };
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true
    });

    if (result.result === 'ok') {
      return { result: 'deleted', public_id: publicId };
    } else if (result.result === 'not found') {
      console.warn('File not found in Cloudinary:', publicId);
      return { result: 'not_found', public_id: publicId };
    } else {
      console.error('Unexpected deletion result:', result);
      return { result: 'failed', public_id: publicId };
    }
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};


export const deleteMultipleFromCloudinary = async (imageUrls) => {
  try {
    if (!Array.isArray(imageUrls)) {
      throw new Error('imageUrls must be an array');
    }

    const validUrls = imageUrls.filter(url => url && typeof url === 'string');
    
    if (validUrls.length === 0) {
      return { deleted: 0, failed: 0, skipped: imageUrls.length };
    }

    const deletePromises = validUrls.map(url => 
      deleteFromCloudinary(url).catch(error => {
        console.error(`Failed to delete ${url}:`, error);
        return { result: 'failed', url };
      })
    );

    const results = await Promise.all(deletePromises);
    
    const summary = {
      deleted: results.filter(r => r.result === 'deleted').length,
      failed: results.filter(r => r.result === 'failed').length,
      not_found: results.filter(r => r.result === 'not_found').length,
      skipped: results.filter(r => r.result === 'skipped').length
    };

    return summary;
  } catch (error) {
    console.error('Error deleting multiple images from Cloudinary:', error);
    throw error;
  }
};

/**
 * Predefined upload presets with security in mind
 */
export const uploadPresets = {
  avatar: {
    folder: 'avatars',
    width: 500,
    height: 500,
    crop: 'fill',
    gravity: 'face',
    resource_type: 'image'
  },
  product: {
    folder: 'products',
    width: 1000,
    height: 1000,
    crop: 'fill',
    gravity: 'center',
    resource_type: 'image'
  },
  storeLogo: {
    folder: 'store-logos',
    width: 300,
    height: 300,
    crop: 'fill',
    gravity: 'center',
    resource_type: 'image'
  },
  review: {
    folder: 'reviews',
    width: 800,
    height: 800,
    crop: 'limit',
    gravity: 'center',
    resource_type: 'auto'
  },
  chatMedia: {
    folder: 'chat-media',
    width: 1200,
    height: 1200,
    crop: 'limit',
    gravity: 'center',
    resource_type: 'auto'
  }
};

export default {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
  deleteMultipleFromCloudinary,
  uploadPresets,
};