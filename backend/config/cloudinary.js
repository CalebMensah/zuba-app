import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import dotenv from 'dotenv'
dotenv.config()

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload file buffer to Cloudinary
 * @param {Buffer} buffer - File buffer from multer
 * @param {Object} options - Upload options
 * @param {string} options.folder - Cloudinary folder name (e.g., 'avatars', 'products', 'reviews', 'stores')
 * @param {number} options.width - Image width (optional)
 * @param {number} options.height - Image height (optional)
 * @param {string} options.crop - Crop mode (optional, default: 'fill')
 * @param {string} options.gravity - Gravity for cropping (optional, default: 'auto')
 * @returns {Promise<Object>} - Cloudinary upload result
 */
export const uploadToCloudinary = (buffer, options = {}) => {
  const {
    folder = 'uploads',
    width,
    height,
    crop = 'fill',
    gravity = 'auto',
  } = options;

  return new Promise((resolve, reject) => {
    const transformations = [
      { quality: 'auto' },
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

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'auto',
        transformation: transformations,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

/**
 * Upload multiple files to Cloudinary
 * @param {Array<Buffer>} buffers - Array of file buffers
 * @param {Object} options - Upload options
 * @returns {Promise<Array>} - Array of Cloudinary upload results
 */
export const uploadMultipleToCloudinary = async (buffers, options = {}) => {
  try {
    const uploadPromises = buffers.map(buffer => 
      uploadToCloudinary(buffer, options)
    );
    return await Promise.all(uploadPromises);
  } catch (error) {
    throw error;
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} imageUrl - Cloudinary image URL
 * @returns {Promise<void>}
 */
export const deleteFromCloudinary = async (imageUrl) => {
  try {
    if (!imageUrl) return;

    // Extract public_id from Cloudinary URL
    const urlParts = imageUrl.split('/');
    const publicIdWithExtension = urlParts.slice(-2).join('/');
    const publicId = publicIdWithExtension.split('.')[0];

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

/**
 * Delete multiple images from Cloudinary
 * @param {Array<string>} imageUrls - Array of Cloudinary image URLs
 * @returns {Promise<void>}
 */
export const deleteMultipleFromCloudinary = async (imageUrls) => {
  try {
    const deletePromises = imageUrls
      .filter(url => url) // Filter out null/undefined URLs
      .map(url => deleteFromCloudinary(url));
    
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting multiple images from Cloudinary:', error);
    throw error;
  }
};

/**
 * Preset configurations for different upload types
 */
export const uploadPresets = {
  avatar: {
    folder: 'avatars',
    width: 500,
    height: 500,
    crop: 'fill',
    gravity: 'face',
  },
  product: {
    folder: 'products',
    width: 1000,
    height: 1000,
    crop: 'fill',
    gravity: 'center',
  },
  storeLogo: {
    folder: 'store-logos',
    width: 300,
    height: 300,
    crop: 'fill',
    gravity: 'center',
  },
  review: {
    folder: 'reviews',
    width: 800,
    height: 800,
    crop: 'limit',
    gravity: 'center',
  },
};

export default {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
  deleteMultipleFromCloudinary,
  uploadPresets,
};