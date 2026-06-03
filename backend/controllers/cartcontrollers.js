import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';
import Decimal from 'decimal.js';

// Configuration constants
const MAX_CART_ITEMS = 100; // Maximum items in cart
const MAX_QUANTITY_PER_ITEM = 10000; // Maximum quantity per product
const CACHE_TTL = 600; // 10 minutes
const CART_EXPIRY_DAYS = 30; // Auto-clear carts older than 30 days

// Helper to validate cart item ID format (UUID or CUID)
const isValidId = (id) => {
  const cuidRegex = /^c[a-z0-9]{24}$/i;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return cuidRegex.test(id) || uuidRegex.test(id);
};

// Helper to safely calculate totals using Decimal.js
const calculateCartTotals = (items) => {
  let totalItems = 0;
  let totalValue = new Decimal(0);
  
  const itemsWithDetails = items.map(item => {
    const price = new Decimal(item.product.price);
    const quantity = item.quantity;
    const itemTotal = price.times(quantity);
    
    totalItems += quantity;
    totalValue = totalValue.plus(itemTotal);
    

    return {
      id: item.id,
      productId: item.productId,
      quantity: quantity,
      color: item.color,
      size: item.size,
      product: item.product,
      total: itemTotal.toNumber()
    };
  });

  return {
    items: itemsWithDetails,
    totalItems,
    totalValue: totalValue.toNumber()
  };
};

// Helper to invalidate cart cache
const invalidateCartCache = async (userId) => {
  try {
    await cache.del(`cart:user:${userId}`);
  } catch (error) {
    console.error('Cache invalidation error:', error);
    // Don't fail the request if cache fails
  }
};

export const getUserCart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const cacheKey = `cart:user:${userId}`;

    // Try to get from cache
    let cachedCart;
    try {
      cachedCart = await cache.get(cacheKey);
      if (cachedCart) {
        return res.status(200).json({
          success: true,
          data: cachedCart,
          cached: true
        });
      }
    } catch (cacheError) {
      console.error('Cache read error:', cacheError);
      // Continue without cache
    }

    // Fetch cart with all necessary data
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          where: {
            product: {
              isActive: true // Only include active products
            }
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                images: true,
                sizes: true,
                color: true,
                moq: true,
                stock: true,
                storeId: true,
                isActive: true,
                store: {
                  select: {
                    id: true,
                    name: true,
                  }
                }
              }
            }
          }
        }
      }
    });

    // Return empty cart if not found
    if (!cart || cart.items.length === 0) {
      const emptyCart = {
        id: cart?.id || null,
        userId,
        items: [],
        totalItems: 0,
        totalValue: 0
      };

      // Cache empty cart too
      try {
        await cache.set(cacheKey, emptyCart, CACHE_TTL);
      } catch (cacheError) {
        console.error('Cache write error:', cacheError);
      }

      return res.status(200).json({
        success: true,
        data: emptyCart
      });
    }

    // Calculate totals safely
    const { items: cartItemsWithDetails, totalItems, totalValue } = calculateCartTotals(cart.items);

    // Check for stock issues and filter out invalid items
    const validItems = cartItemsWithDetails.filter(item => {
      if (!item.product.isActive) return false;
      if (item.quantity > item.product.stock) {
        console.warn(`Cart item ${item.id} exceeds stock: ${item.quantity} > ${item.product.stock}`);
        return false;
      }
      return true;
    });

    // Clean up invalid items from database (async, don't wait)
    if (validItems.length < cartItemsWithDetails.length) {
      const invalidItemIds = cartItemsWithDetails
        .filter(item => !validItems.includes(item))
        .map(item => item.id);
      
      prisma.cartItem.deleteMany({
        where: { id: { in: invalidItemIds } }
      }).catch(err => console.error('Error cleaning invalid cart items:', err));
    }

    // Recalculate with valid items only
    const validTotals = validItems.reduce((acc, item) => ({
      totalItems: acc.totalItems + item.quantity,
      totalValue: new Decimal(acc.totalValue).plus(item.total).toNumber()
    }), { totalItems: 0, totalValue: 0 });

    const cartData = {
      id: cart.id,
      userId: cart.userId,
      items: validItems,
      totalItems: validTotals.totalItems,
      totalValue: parseFloat(validTotals.totalValue.toFixed(2))
    };

    // Cache the result
    try {
      await cache.set(cacheKey, cartData, CACHE_TTL);
    } catch (cacheError) {
      console.error('Cache write error:', cacheError);
    }

    res.status(200).json({
      success: true,
      data: cartData
    });

  } catch (error) {
    console.error('Error fetching user cart:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch cart. Please try again.'
    });
  }
};

export const addItemToCart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId, quantity = 1, color, size } = req.body;

    // Validate inputs
    if (!productId || !isValidId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required.'
      });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer.'
      });
    }

    if (quantity > MAX_QUANTITY_PER_ITEM) {
      return res.status(400).json({
        success: false,
        message: `Quantity cannot exceed ${MAX_QUANTITY_PER_ITEM} per item.`
      });
    }

    // Normalize color and size to null if undefined or empty string
    const normalizedColor = color || null;
    const normalizedSize = size || null;

    // Use transaction for atomicity and row-level locking
    const result = await prisma.$transaction(async (tx) => {
      // Lock product row to prevent race conditions
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
          moq: true,
          isActive: true
        }
      });

      if (!product || !product.isActive) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      // Check MOQ requirement
      if (product.moq && quantity < product.moq) {
        throw new Error(`MINIMUM_ORDER_${product.moq}`);
      }

      // Find or create cart
      let cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            select: { id: true }
          }
        }
      });

      if (!cart) {
        cart = await tx.cart.create({
          data: { userId },
          include: {
            items: {
              select: { id: true }
            }
          }
        });
      }

      // Check cart size limit
      if (cart.items.length >= MAX_CART_ITEMS) {
        throw new Error('CART_FULL');
      }

      // Find existing cart item - use findFirst for nullable fields
      const existingCartItem = await tx.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId,
          color: normalizedColor,
          size: normalizedSize,
        },
      });

      const newQuantity = existingCartItem 
        ? existingCartItem.quantity + quantity 
        : quantity;

      // Check stock availability
      if (product.stock < newQuantity) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      // Update or create cart item
      let cartItem;
      if (existingCartItem) {
        cartItem = await tx.cartItem.update({
          where: { id: existingCartItem.id },
          data: { 
            quantity: newQuantity,
            updatedAt: new Date()
          }
        });
      } else {
        cartItem = await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            quantity,
            color: normalizedColor,
            size: normalizedSize
          }
        });
      }

      return { cartItem, product };
    }, {
      isolationLevel: 'Serializable',
      timeout: 10000
    });

    // Invalidate cache after successful operation
    await invalidateCartCache(userId);

    res.status(200).json({
      success: true,
      message: 'Item added to cart successfully.',
      data: {
        id: result.cartItem.id,
        productId: result.cartItem.productId,
        quantity: result.cartItem.quantity,
        color: result.cartItem.color,
        size: result.cartItem.size
      }
    });

  } catch (error) {
    console.error('Error adding item to cart:', error);

    // Handle specific errors
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Product not found or is no longer available.'
      });
    }

    if (error.message.startsWith('MINIMUM_ORDER_')) {
      const moq = error.message.split('_')[2];
      return res.status(400).json({
        success: false,
        message: `Minimum order quantity is ${moq} for this product.`
      });
    }

    if (error.message === 'INSUFFICIENT_STOCK') {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available.'
      });
    }

    if (error.message === 'CART_FULL') {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_CART_ITEMS} items allowed in cart.`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Unable to add item to cart. Please try again.'
    });
  }
};

export const updateCartItemQuantity = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    // Validate inputs
    if (!isValidId(cartItemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cart item ID.'
      });
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a non-negative integer.'
      });
    }

    if (quantity > MAX_QUANTITY_PER_ITEM) {
      return res.status(400).json({
        success: false,
        message: `Quantity cannot exceed ${MAX_QUANTITY_PER_ITEM}.`
      });
    }

    // Use transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Verify ownership and get cart item with lock
      const cartItem = await tx.cartItem.findFirst({
        where: {
          id: cartItemId,
          cart: { userId }
        },
        include: {
          product: {
            select: { 
              id: true,
              stock: true, 
              moq: true,
              isActive: true 
            }
          }
        }
      });

      if (!cartItem) {
        throw new Error('CART_ITEM_NOT_FOUND');
      }

      if (!cartItem.product.isActive) {
        throw new Error('PRODUCT_INACTIVE');
      }

      // Handle deletion if quantity is 0
      if (quantity === 0) {
        await tx.cartItem.delete({
          where: { id: cartItem.id }
        });
        return { deleted: true };
      }

      // Check MOQ
      if (cartItem.product.moq && quantity < cartItem.product.moq) {
        throw new Error(`MINIMUM_ORDER_${cartItem.product.moq}`);
      }

      // Check stock
      if (quantity > cartItem.product.stock) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      // Update quantity
      const updatedCartItem = await tx.cartItem.update({
        where: { id: cartItem.id },
        data: { 
          quantity,
          updatedAt: new Date()
        }
      });

      return { deleted: false, cartItem: updatedCartItem };
    });

    // Invalidate cache
    await invalidateCartCache(userId);

    const message = result.deleted 
      ? 'Cart item removed successfully.' 
      : 'Cart item quantity updated successfully.';

    res.status(200).json({
      success: true,
      message,
      data: result.deleted ? null : {
        id: result.cartItem.id,
        quantity: result.cartItem.quantity
      }
    });

  } catch (error) {
    console.error('Error updating cart item:', error);

    if (error.message === 'CART_ITEM_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found.'
      });
    }

    if (error.message === 'PRODUCT_INACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'This product is no longer available.'
      });
    }

    if (error.message.startsWith('MINIMUM_ORDER_')) {
      const moq = error.message.split('_')[2];
      return res.status(400).json({
        success: false,
        message: `Minimum order quantity is ${moq}.`
      });
    }

    if (error.message === 'INSUFFICIENT_STOCK') {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Unable to update cart item. Please try again.'
    });
  }
};

export const removeItemFromCart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { cartItemId } = req.params;

    // Validate input
    if (!isValidId(cartItemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cart item ID.'
      });
    }

    // Verify ownership and delete in transaction
    const deleted = await prisma.$transaction(async (tx) => {
      const cartItem = await tx.cartItem.findFirst({
        where: {
          id: cartItemId,
          cart: { userId }
        }
      });

      if (!cartItem) {
        return false;
      }

      await tx.cartItem.delete({
        where: { id: cartItem.id }
      });

      return true;
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found.'
      });
    }

    // Invalidate cache
    await invalidateCartCache(userId);

    res.status(200).json({
      success: true,
      message: 'Cart item removed successfully.'
    });

  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to remove item from cart. Please try again.'
    });
  }
};

export const clearCart = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId }
      });

      if (cart) {
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id }
        });
      }
    });

    // Invalidate cache
    await invalidateCartCache(userId);

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully.'
    });

  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to clear cart. Please try again.'
    });
  }
};

// Admin utility: Clean up old abandoned carts
export const cleanupAbandonedCarts = async (req, res) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CART_EXPIRY_DAYS);

    const result = await prisma.$transaction(async (tx) => {
      // Find old carts
      const oldCarts = await tx.cart.findMany({
        where: {
          updatedAt: {
            lt: cutoffDate
          }
        },
        select: { id: true, userId: true }
      });

      if (oldCarts.length === 0) {
        return { deletedCarts: 0, deletedItems: 0 };
      }

      const cartIds = oldCarts.map(c => c.id);

      // Delete cart items
      const deletedItems = await tx.cartItem.deleteMany({
        where: { cartId: { in: cartIds } }
      });

      // Invalidate caches
      for (const cart of oldCarts) {
        await invalidateCartCache(cart.userId);
      }

      return {
        deletedCarts: oldCarts.length,
        deletedItems: deletedItems.count
      };
    });

    res.status(200).json({
      success: true,
      message: `Cleaned up ${result.deletedCarts} abandoned carts and ${result.deletedItems} items.`,
      data: result
    });

  } catch (error) {
    console.error('Error cleaning up abandoned carts:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to clean up carts.'
    });
  }
};