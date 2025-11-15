import prisma from '../config/prisma.js';
import { PrismaClient } from '@prisma/client';
import slugify from 'slugify';
import { uploadToCloudinary, uploadMultipleToCloudinary, deleteMultipleFromCloudinary, uploadPresets } from '../config/cloudinary.js';
import { cache } from '../config/redis.js';



// Create a new product
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      stock,
      category,
      tags = [],
      sizes = [],
      color = [],
      weight,
      sellerNote,
      moq
    } = req.body;

    const userId = req.user.userId; // Get the authenticated user's ID

    // Fetch the user's store first
    const userStore = await prisma.store.findUnique({
      where: { userId }
    });

    if (!userStore) {
      return res.status(400).json({
        success: false,
        message: 'Store not found. User must have an active store to add products.'
      });
    }

    const storeId = userStore.id; // Get the store ID

    // Validate required fields
    if (!name || price === undefined || stock === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and stock are required fields.'
      });
    }

    // Generate URL slug from product name
    const slug = slugify(name, { lower: true, strict: true });
    // Check if slug already exists for this store
    const existingSlug = await prisma.product.findUnique({
      where: {
        url: slug,
        storeId
      }
    });

    // If slug exists, append a random number
    const finalUrl = existingSlug ? `${slug}-${Math.floor(1000 + Math.random() * 9000)}` : slug;

    let imageUrls = [];
    // Upload images to Cloudinary if provided
    if (req.files && req.files.length > 0) {
      try {
        const uploadResults = await uploadMultipleToCloudinary(
          req.files.map(file => file.buffer),
          { ...uploadPresets.product, folder: 'products' }
        );
        imageUrls = uploadResults.map(result => result.secure_url);
      } catch (uploadError) {
        console.error('Error uploading product images to Cloudinary:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading product images.',
          error: uploadError.message
        });
      }
    }

    const product = await prisma.product.create({
      data: {
        storeId,
        name,
        description: description || null,
        price: parseFloat(price),
        stock: parseInt(stock),
        images: imageUrls,
        category: category || null,
        tags: Array.isArray(tags) ? tags : [],
        sizes: Array.isArray(sizes) ? sizes : [],
        color: Array.isArray(color) ? color : [], // Handle color as array
        weight: weight ? parseFloat(weight) : null,
        sellerNote: sellerNote || null,
        moq: moq ? parseInt(moq) : null,
        url: finalUrl,
        isActive: true
      }
    });

    // Invalidate relevant store caches using userStore.url
    await cache.del(`store:slug:${userStore.url}`); // Invalidate the store's main cache
    await cache.del(`user:${userId}:store`); // Invalidate user's store cache
    // Add other cache invalidations if needed

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
       product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update an existing product
export const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      name,
      description,
      price,
      stock,
      category,
      tags,
      sizes,
      color,
      weight,
      sellerNote,
      moq,
      isActive
    } = req.body;

    const userId = req.user.userId; 
    // Fetch the user's store to get its ID and URL for cache invalidation
    const userStore = await prisma.store.findFirst({
      where: { userId }
    });

    if (!userStore) {
      return res.status(400).json({
        success: false,
        message: 'Store not found. User must have an active store.'
      });
    }

    const storeId = userStore.id; // Get the store ID

    // Find the existing product to verify ownership and get current data
    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        storeId // Ensure the product belongs to the user's store
      }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or does not belong to your store.'
      });
    }

    // Prepare update data object
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
      const slug = slugify(name, { lower: true, strict: true });
      const existingSlug = await prisma.product.findFirst({
        where: {
          url: slug,
          storeId,
          NOT: { id: productId }
        }
      });
      updateData.url = existingSlug ? `${slug}-${Math.floor(1000 + Math.random() * 9000)}` : slug;
    }
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : (typeof tags === 'string' ? [tags] : []);
    if (sizes !== undefined) updateData.sizes = Array.isArray(sizes) ? sizes : (typeof sizes === 'string' ? [sizes] : []);
    if (color !== undefined) updateData.color = Array.isArray(color) ? color : (typeof color === 'string' ? [color] : []); // Handle color as array
    if (weight !== undefined) updateData.weight = parseFloat(weight);
    if (sellerNote !== undefined) updateData.sellerNote = sellerNote;
    if (moq !== undefined) updateData.moq = parseInt(moq);
    if (isActive !== undefined) updateData.isActive = isActive;

    let imageUrls = [...existingProduct.images];
    let imagesToDeleteFromCloudinary = [];

    // Handle image updates if files are provided
    if (req.files && req.files.length > 0) {
      imagesToDeleteFromCloudinary = existingProduct.images; // Mark old images for deletion

      try {
        const uploadResults = await uploadMultipleToCloudinary(
          req.files.map(file => file.buffer),
          { ...uploadPresets.product, folder: 'products' }
        );
        imageUrls = uploadResults.map(result => result.secure_url);
        updateData.images = imageUrls; // Update the images array in the data to be saved
      } catch (uploadError) {
        console.error('Error uploading updated product images to Cloudinary:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading updated product images.',
          error: uploadError.message
        });
      }
    }

    // Perform the update in the database
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData
    });

    // Delete old images from Cloudinary *after* the database update succeeds
    if (imagesToDeleteFromCloudinary.length > 0) {
      try {
        await deleteMultipleFromCloudinary(imagesToDeleteFromCloudinary);
      } catch (deleteError) {
        console.error('Error deleting old product images from Cloudinary:', deleteError);
        // Log the error, but don't fail the request if deletion fails
      }
    }

    // Invalidate relevant store caches using userStore.url
    await cache.del(`store:slug:${userStore.url}`);
    await cache.del(`user:${userId}:store`);
    await cache.del(`product:url:${existingProduct.url}`); // Invalidate old product URL cache if URL changed
    if (updateData.url && updateData.url !== existingProduct.url) {
        await cache.del(`product:url:${updateData.url}`); // Invalidate new product URL cache
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
       updatedProduct
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get product by URL slug (public view)
export const getSellerProductByIdForPublicUse = async (req, res) => {
  try {
    const { productUrl } = req.params; // Get the product's URL slug from the route parameters

    const cacheKey = `product:public:url:${productUrl}`; // Different cache key for public access

    // Try to get from cache first
    const cachedProduct = await cache.get(cacheKey);
    if (cachedProduct) {
      return res.status(200).json({
        success: true,
         cachedProduct,
        cached: true
      });
    }

    const product = await prisma.product.findFirst({
      where: {
        url: productUrl, // Use the 'url' field
        isActive: true,  // Only return active products
      },
      include: {
        store: { // Include store information for the product
          select: {
            id: true,
            name: true,
            url: true, // Store's URL slug
            logo: true,
            // ... other relevant store fields you want to expose
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or its store is inactive.'
      });
    }

    // Cache for 1 hour
    await cache.set(cacheKey, product, 3600);

    res.status(200).json({
      success: true,
       product
    });

  } catch (error) {
    console.error('Error fetching product by ID (public):', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


// Get products by store URL slug (public view) - No change needed here
export const getAllSellerProductsForPublicUse = async (req, res) => {
  try {
    const { storeUrl } = req.params; // Get the store's URL slug from the route parameters
    const {
      page = 1,
      limit = 10,
      search = '', // Search term for name or description within the store
      category = '', // Filter by category within the store
      minPrice = 0, // Default to 0 if not provided
      maxPrice = Infinity, // Default to Infinity if not provided
      tags = '', // Filter by tags within the store (comma-separated string)
      sizes = '', // Filter by sizes within the store (comma-separated string)
      color = '', // Filter by color within the store (comma-separated string)
      sortBy = 'createdAt', // Sort by field
      sortOrder = 'desc' // Sort order: asc or desc
    } = req.query;

    const pageNum = parseInt(page, 10) || 1; // Parse as base-10 integer
    const limitNum = parseInt(limit, 10) || 10; // Parse as base-10 integer
    const offset = (pageNum - 1) * limitNum;

    // Parse comma-separated filter strings into arrays
    const tagArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : []; // Filter out empty strings
    const sizeArray = sizes ? sizes.split(',').map(size => size.trim()).filter(size => size !== '') : [];
    const colorArray = color ? color.split(',').map(c => c.trim()).filter(c => c !== '') : [];

    // Find the store first using the provided slug
    const store = await prisma.store.findFirst({
      where: { url: storeUrl }, // Ensure the store exists and is active
      select: { id: true } // Only select the ID needed for the product query
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or not active.'
      });
    }

    const storeId = store.id; // Get the store ID to filter products

    // Build the Prisma 'where' clause dynamically based on query parameters
    const whereClause = {
      storeId, // Filter products by the specific store ID
      isActive: true, // Only fetch active products
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (category) {
      whereClause.category = { contains: category, mode: 'insensitive' };
    }

    // --- FIX: Properly handle price filters ---
    let priceFilter = {};
    if (minPrice !== undefined && minPrice !== '') {
      const parsedMin = parseFloat(minPrice);
      if (!isNaN(parsedMin)) {
        priceFilter.gte = parsedMin;
      }
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      const parsedMax = parseFloat(maxPrice);
      if (!isNaN(parsedMax)) {
        priceFilter.lte = parsedMax;
      }
    }
    // Only add the price filter to whereClause if at least one valid bound was set
    if (Object.keys(priceFilter).length > 0) {
      whereClause.price = priceFilter;
    }
    // --- END FIX ---

    if (tagArray.length > 0) {
      whereClause.tags = { hasSome: tagArray };
    }

    if (sizeArray.length > 0) {
      whereClause.sizes = { hasSome: sizeArray };
    }

    if (colorArray.length > 0) {
      whereClause.color = { hasSome: colorArray };
    }

    const orderByClause = {};
    const validSortFields = ['name', 'price', 'createdAt', 'quantityBought'];
    if (validSortFields.includes(sortBy)) {
      orderByClause[sortBy] = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
      orderByClause[sortBy] = 'desc'; // Default sort order
    }

    // Construct the cache key based on store URL and filters/pagination
    const cacheKey = `products:store:${storeUrl}:page:${pageNum}:limit:${limitNum}:search:${search}:category:${category}:minPrice:${minPrice}:maxPrice:${maxPrice}:tags:${tagArray.join(',')}:sizes:${sizeArray.join(',')}:color:${colorArray.join(',')}::sortBy:${sortBy}:sortOrder:${sortOrder}`;

    // Try to get results from cache first
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json({
        success: true,
         cachedResult,
        cached: true
      });
    }

    // Fetch products from the database
    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: orderByClause,
      skip: offset,
      take: limitNum,
      include: {
        store: { // Include store information (relevant for the specific store)
          select: {
            id: true,
            name: true,
            url: true,
            logo: true,
            // ... other relevant store fields you want to expose
          }
        }
      }
    });

    const total = await prisma.product.count({
      where: whereClause // Use the same filter for counting
    });

    const resultData = {
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      filters: {
        storeUrl, // Include the store URL in the response
        search,
        category,
        minPrice: minPrice !== undefined && minPrice !== '' ? parseFloat(minPrice) : undefined, // Send parsed number or undefined
        maxPrice: maxPrice !== undefined && maxPrice !== '' ? parseFloat(maxPrice) : undefined, // Send parsed number or undefined
        tags: tagArray,
        sizes: sizeArray,
        color: colorArray,
        sortBy,
        sortOrder
      }
    };

    // Cache the results for 15 minutes
    await cache.set(cacheKey, resultData, 900);

    res.status(200).json({
      success: true,
       resultData
    });

  } catch (error) {
    console.error('Error fetching seller products (public):', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user's products (seller view)
export const getUserProducts = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch the user's store to get its ID
    const userStore = await prisma.store.findFirst({
      where: { userId }
    });

    if (!userStore) {
      return res.status(400).json({
        success: false,
        message: 'Store not found. User must have an active store.'
      });
    }

    const storeId = userStore.id; // Get the store ID
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const cacheKey = `user:${userId}:products:page:${page}:limit:${limit}`;

    const cachedProducts = await cache.get(cacheKey);
    if (cachedProducts) {
      return res.status(200).json({
        success: true,
         cachedProducts,
        cached: true
      });
    }

    const products = await prisma.product.findMany({
      where: {
        storeId,
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const total = await prisma.product.count({
      where: { storeId }
    });

    const resultData = {
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    await cache.set(cacheKey, resultData, 900);

    res.status(200).json({
      success: true,
       resultData
    });
  } catch (error) {
    console.error('Error fetching user products:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete a product
export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.userId;

    // Fetch the user's store to get its ID and URL for cache invalidation
    const userStore = await prisma.store.findFirst({
      where: { userId }
    });

    if (!userStore) {
      return res.status(400).json({
        success: false,
        message: 'Store not found. User must have an active store.'
      });
    }

    const storeId = userStore.id; // Get the store ID

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        storeId // Ensure the product belongs to the user's store
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or does not belong to your store.'
      });
    }

    // Delete images from Cloudinary
    if (product.images && product.images.length > 0) {
      try {
        await deleteMultipleFromCloudinary(product.images);
      } catch (deleteError) {
        console.error('Error deleting product images from Cloudinary:', deleteError);
      }
    }

    await prisma.product.delete({
      where: { id: productId }
    });

    // Invalidate relevant store caches using userStore.url
    await cache.del(`store:slug:${userStore.url}`);
    await cache.del(`user:${userId}:store`);
    await cache.del(`product:url:${product.url}`); // Invalidate product URL cache

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '', // Search term for name or description
      category = '', // Filter by category
      minPrice = 0, // Filter by minimum price
      maxPrice = Infinity, // Filter by maximum price
      tags = '', // Filter by tags (comma-separated string)
      sizes = '', // Filter by sizes (comma-separated string)
      color = '', // Filter by color (comma-separated string)
      sortBy = 'createdAt', // Sort by field
      sortOrder = 'desc' // Sort order: asc or desc
    } = req.query;

    // Convert query parameters to appropriate types
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Parse comma-separated filter strings into arrays
    const tagArray = tags ? tags.split(',').map(tag => tag.trim()) : [];
    const sizeArray = sizes ? sizes.split(',').map(size => size.trim()) : [];
    const colorArray = color ? color.split(',').map(c => c.trim()) : [];

    // Build the Prisma 'where' clause dynamically based on query parameters
    const whereClause = {
      isActive: true, // Only fetch active products
    };

    // Add search filter (name or description)
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } }, // Case-insensitive search in name
        { description: { contains: search, mode: 'insensitive' } } // Case-insensitive search in description
      ];
    }

    // Add category filter
    if (category) {
      whereClause.category = { contains: category, mode: 'insensitive' }; // Case-insensitive
    }

    // Add price filter
    whereClause.price = {
      gte: parseFloat(minPrice), // Greater than or equal to minPrice
      lte: parseFloat(maxPrice)  // Less than or equal to maxPrice
    };

    // Add tags filter (using 'hasSome' for array fields)
    if (tagArray.length > 0) {
      whereClause.tags = { hasSome: tagArray };
    }

    // Add sizes filter (using 'hasSome' for array fields)
    if (sizeArray.length > 0) {
      whereClause.sizes = { hasSome: sizeArray };
    }

    // Add color filter (using 'hasSome' for array fields)
    if (colorArray.length > 0) {
      whereClause.color = { hasSome: colorArray };
    }

    // Define the sort order object
    const orderByClause = {};
    // Validate and set the sort field and order
    const validSortFields = ['name', 'price', 'createdAt', 'quantityBought', 'viewCount']; // Add other fields as needed
    if (validSortFields.includes(sortBy)) {
      orderByClause[sortBy] = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
      // Default sort order if invalid sortBy is provided
      orderByClause[sortBy] = 'desc';
    }

    // Construct the cache key based on all relevant filters and pagination
    // This ensures different filter combinations get different cache entries
    const cacheKey = `products:all:page:${pageNum}:limit:${limitNum}:search:${search}:category:${category}:minPrice:${minPrice}:maxPrice:${maxPrice}:tags:${tagArray.join(',')}:sizes:${sizeArray.join(',')}:color:${colorArray.join(',')}::sortBy:${sortBy}:sortOrder:${sortOrder}`;

    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json({
        success: true,
         cachedResult,
        cached: true
      });
    }

    // Fetch products from the database using Prisma
    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: orderByClause,
      skip: offset,
      take: limitNum,
      include: {
        store: { // Include store information for each product
          select: {
            id: true,
            name: true,
            url: true, // Store's URL slug
            logo: true,
            region: true,
            location: true
          }
        }
      }
    });

    // Fetch the total count of products matching the filters (for pagination info)
    const total = await prisma.product.count({
      where: whereClause
    });

    // Prepare the response data
    const resultData = {
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      filters: {
        search,
        category,
        minPrice: parseFloat(minPrice),
        maxPrice: parseFloat(maxPrice),
        tags: tagArray,
        sizes: sizeArray,
        color: colorArray,
        sortBy,
        sortOrder
      }
    };

    // Cache the results for 15 minutes (900 seconds) - adjust as needed
    await cache.set(cacheKey, resultData, 900);

    res.status(200).json({
      success: true,
       resultData
    });

  } catch (error) {
    console.error('Error fetching all products:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};