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
    if (isActive !== undefined) updateData.isActive = true

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
         data:cachedProduct,
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
       data:product
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
      maxPrice = '', // Default to Infinity if not provided
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
         data:cachedResult,
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
       data:resultData
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
  console.log('getting user products')
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
        data: cachedProducts,
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

    console.log('fetched products from DB:', products)

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
    console.log('my products:',resultData)

    res.status(200).json({
      success: true,
       data:resultData
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
  console.log("Fetching all products with filters...");
  try {
    const {
      page = 1,
      limit = 10,
      search = '', // Search term for name or description
      category = '', // Filter by category
      minPrice = 0, // Filter by minimum price
      maxPrice = '', // Filter by maximum price
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
         data:cachedResult,
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
      data: resultData
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

// Get top selling products
export const getTopSellingProducts = async (req, res) => {
  try {
    const {
      limit = 10,
      category = '',
      storeUrl = '' // Optional: filter by specific store
    } = req.query;

    const limitNum = parseInt(limit) || 10;

    // Build where clause
    const whereClause = {
      isActive: true,
    };

    if (category) {
      whereClause.category = { contains: category, mode: 'insensitive' };
    }

    // If filtering by store
    if (storeUrl) {
      const store = await prisma.store.findFirst({
        where: { url: storeUrl },
        select: { id: true }
      });

      if (store) {
        whereClause.storeId = store.id;
      }
    }

    // Construct cache key
    const cacheKey = `products:top-selling:limit:${limitNum}:category:${category}:store:${storeUrl}`;

    // Try to get from cache
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json({
        success: true,
        data: cachedResult,
        cached: true
      });
    }

    // Fetch top selling products ordered by quantityBought
    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: [
        { quantityBought: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limitNum,
      include: {
        store: {
          select: {
            id: true,
            name: true,
            url: true,
            logo: true,
            region: true,
            location: true
          }
        }
      }
    });

    const resultData = {
      products,
      count: products.length
    };

    // Cache for 30 minutes
    await cache.set(cacheKey, resultData, 1800);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching top selling products:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get recommended products based on a specific product
export const getRecommendedProducts = async (req, res) => {
  try {
    const { productUrl } = req.params;
    const { limit = 8 } = req.query;

    const limitNum = parseInt(limit) || 8;

    // Construct cache key
    const cacheKey = `products:recommended:${productUrl}:limit:${limitNum}`;

    // Try to get from cache
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json({
        success: true,
        data: cachedResult,
        cached: true
      });
    }

    // Get the current product to base recommendations on
    const currentProduct = await prisma.product.findFirst({
      where: {
        url: productUrl,
        isActive: true
      },
      select: {
        id: true,
        category: true,
        tags: true,
        price: true,
        storeId: true
      }
    });

    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    // Build where clause for recommendations
    const whereClause = {
      isActive: true,
      NOT: {
        id: currentProduct.id // Exclude the current product
      }
    };

    // Create an array of OR conditions for better matches
    const orConditions = [];

    // Match by category
    if (currentProduct.category) {
      orConditions.push({
        category: { contains: currentProduct.category, mode: 'insensitive' }
      });
    }

    // Match by tags
    if (currentProduct.tags && currentProduct.tags.length > 0) {
      orConditions.push({
        tags: { hasSome: currentProduct.tags }
      });
    }

    // Match by similar price range (±30%)
    const priceLower = currentProduct.price * 0.7;
    const priceUpper = currentProduct.price * 1.3;
    orConditions.push({
      price: {
        gte: priceLower,
        lte: priceUpper
      }
    });

    // Match by same store
    orConditions.push({
      storeId: currentProduct.storeId
    });

    if (orConditions.length > 0) {
      whereClause.OR = orConditions;
    }

    // Fetch recommended products
    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: [
        { quantityBought: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limitNum,
      include: {
        store: {
          select: {
            id: true,
            name: true,
            url: true,
            logo: true,
            region: true,
            location: true
          }
        }
      }
    });

    // If we don't have enough products, fill with random popular products
    if (products.length < limitNum) {
      const additionalProducts = await prisma.product.findMany({
        where: {
          isActive: true,
          NOT: {
            id: {
              in: [currentProduct.id, ...products.map(p => p.id)]
            }
          }
        },
        orderBy: [
          { quantityBought: 'desc' },
        ],
        take: limitNum - products.length,
        include: {
          store: {
            select: {
              id: true,
              name: true,
              url: true,
              logo: true,
              region: true,
              location: true
            }
          }
        }
      });

      products.push(...additionalProducts);
    }

    const resultData = {
      products,
      count: products.length,
      basedOn: {
        category: currentProduct.category,
        tags: currentProduct.tags
      }
    };

    // Cache for 1 hour
    await cache.set(cacheKey, resultData, 3600);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching recommended products:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get products you may like (random selection with some intelligence)
export const getProductsYouMayLike = async (req, res) => {
  try {
    const {
      limit = 12,
      category = '',
      excludeProductId = '' // Optional: exclude a specific product
    } = req.query;

    const limitNum = parseInt(limit) || 12;

    // Construct cache key
    const cacheKey = `products:you-may-like:limit:${limitNum}:category:${category}:exclude:${excludeProductId}`;

    // Try to get from cache
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json({
        success: true,
        data: cachedResult,
        cached: true
      });
    }

    // Build where clause
    const whereClause = {
      isActive: true,
    };

    if (category) {
      whereClause.category = { contains: category, mode: 'insensitive' };
    }

    if (excludeProductId) {
      whereClause.NOT = {
        id: excludeProductId
      };
    }

    // Get total count for random offset calculation
    const totalCount = await prisma.product.count({
      where: whereClause
    });

    if (totalCount === 0) {
      return res.status(200).json({
        success: true,
        data: {
          products: [],
          count: 0
        }
      });
    }

    // Strategy: Get a mix of popular and random products
    const popularLimit = Math.ceil(limitNum * 0.6); // 60% popular products
    const randomLimit = limitNum - popularLimit; // 40% random products

    // Get popular products (by quantityBought and viewCount)
    const popularProducts = await prisma.product.findMany({
      where: whereClause,
      orderBy: [
        { quantityBought: 'desc' },
        { createdAt: 'desc' }
      ],
      take: popularLimit,
      include: {
        store: {
          select: {
            id: true,
            name: true,
            url: true,
            logo: true,
            region: true,
            location: true
          }
        }
      }
    });

    const popularIds = popularProducts.map(p => p.id);

    // Get random products (exclude already selected popular ones)
    let randomProducts = [];
    if (randomLimit > 0 && totalCount > popularLimit) {
      // Generate random offset
      const maxOffset = Math.max(0, totalCount - randomLimit - popularLimit);
      const randomOffset = Math.floor(Math.random() * (maxOffset + 1));

      randomProducts = await prisma.product.findMany({
        where: {
          ...whereClause,
          NOT: {
            id: { in: popularIds }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: randomOffset,
        take: randomLimit,
        include: {
          store: {
            select: {
              id: true,
              name: true,
              url: true,
              logo: true,
              region: true,
              location: true
            }
          }
        }
      });
    }

    // Combine and shuffle
    const allProducts = [...popularProducts, ...randomProducts];
    
    // Fisher-Yates shuffle algorithm
    for (let i = allProducts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allProducts[i], allProducts[j]] = [allProducts[j], allProducts[i]];
    }

    const resultData = {
      products: allProducts,
      count: allProducts.length,
      mix: {
        popular: popularProducts.length,
        random: randomProducts.length
      }
    };

    // Cache for 15 minutes (shorter cache for randomness)
    await cache.set(cacheKey, resultData, 900);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching products you may like:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get trending products (based on recent views and purchases)
export const getTrendingProducts = async (req, res) => {
  try {
    const {
      limit = 10,
      category = '',
      days = 7 // Consider products from last N days
    } = req.query;

    const limitNum = parseInt(limit) || 10;
    const daysNum = parseInt(days) || 7;

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysNum);

    // Construct cache key
    const cacheKey = `products:trending:limit:${limitNum}:category:${category}:days:${daysNum}`;

    // Try to get from cache
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json({
        success: true,
        data: cachedResult,
        cached: true
      });
    }

    // Build where clause
    const whereClause = {
      isActive: true,
      createdAt: {
        gte: dateThreshold
      }
    };

    if (category) {
      whereClause.category = { contains: category, mode: 'insensitive' };
    }

    // Fetch trending products
    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: [
        { quantityBought: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limitNum,
      include: {
        store: {
          select: {
            id: true,
            name: true,
            url: true,
            logo: true,
            region: true,
            location: true
          }
        }
      }
    });

    const resultData = {
      products,
      count: products.length,
      period: `Last ${daysNum} days`
    };

    // Cache for 1 hour
    await cache.set(cacheKey, resultData, 3600);

    res.status(200).json({
      success: true,
      data: resultData
    });

  } catch (error) {
    console.error('Error fetching trending products:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};