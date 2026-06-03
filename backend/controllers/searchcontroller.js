// controllers/searchController.js
import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';

export const unifiedSearch = async (req, res) => {
  try {
    const { q = '', page = 1, limit = 10, type = 'all' } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 10, 50); // Cap at 50
    const offset = (pageNum - 1) * limitNum;

    if (!q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search term "q" is required.'
      });
    }

    const searchTerm = q.trim().toLowerCase();
    const cacheKey = `search:q:${searchTerm}:page:${pageNum}:limit:${limitNum}:type:${type}`;

    // Try cache first
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json({
        success: true,
        ...cachedResult,
        cached: true
      });
    }

    let products = [];
    let stores = [];
    let totalProducts = 0;
    let totalStores = 0;

    // --- Search Products ---
    if (type === 'all' || type === 'product') {
      const productWhere = {
        isActive: true,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { url: { contains: searchTerm, mode: 'insensitive' } },
          { category: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          // For case-insensitive tag search, we need a workaround
          // This will work if tags are stored in lowercase
          { tags: { has: searchTerm } },
        ]
      };

      [products, totalProducts] = await Promise.all([
        prisma.product.findMany({
          where: productWhere,
          skip: offset,
          take: limitNum,
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            images: true,
            category: true,
            tags: true,
            url: true,
            store: {
              select: { id: true, name: true, url: true, logo: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.product.count({ where: productWhere })
      ]);
    }

    // --- Search Stores ---
    if (type === 'all' || type === 'store') {
      const storeWhere = {
        isActive: true,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { url: { contains: searchTerm, mode: 'insensitive' } },
          { category: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
        ]
      };

      [stores, totalStores] = await Promise.all([
        prisma.store.findMany({
          where: storeWhere,
          skip: offset,
          take: limitNum,
          select: {
            id: true,
            name: true,
            description: true,
            logo: true,
            location: true,
            category: true,
            url: true,
            rating: true,
            totalReviews: true,
            viewCount: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.store.count({ where: storeWhere })
      ]);
    }

    // --- Combine & Format Results ---
    let results = [];
    let total = 0;
    let pages = 0;

    if (type === 'all') {
      // For 'all', combine results and apply pagination to the combined set
      const allResults = [
        ...products.map(p => ({ type: 'product', ...p })),
        ...stores.map(s => ({ type: 'store', ...s }))
      ];
      
      total = totalProducts + totalStores;
      pages = Math.ceil(total / limitNum);
      
      // Slice for current page from combined results
      const startIndex = offset;
      const endIndex = startIndex + limitNum;
      results = allResults.slice(startIndex, endIndex);
      
    } else if (type === 'product') {
      results = products.map(p => ({ type: 'product', ...p }));
      total = totalProducts;
      pages = Math.ceil(total / limitNum);
      
    } else if (type === 'store') {
      results = stores.map(s => ({ type: 'store', ...s }));
      total = totalStores;
      pages = Math.ceil(total / limitNum);
    }

    const resultData = {
      results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages
      },
      filters: { q: searchTerm, type }
    };

    // Cache for 10 minutes
    await cache.set(cacheKey, resultData, 600);

    res.status(200).json({
      success: true,
      ...resultData
    });

  } catch (error) {
    console.error('Unified search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
};