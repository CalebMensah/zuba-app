import prisma from '../config/prisma.js';
import { cache } from '../config/redis.js';


export const getUserCart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const cacheKey = `cart:user:${userId}`;

    const cachedCart = await cache.get(cacheKey);
    if (cachedCart) {
      return res.status(200).json({
        success: true,
        data: cachedCart,
        cached: true
      });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
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
                storeId: true,
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

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          id: null,
          userId,
          items: [],
          totalItems: 0,
          totalValue: 0.0
        }
      });
    }

    let totalItems = 0;
    let totalValue = 0.0;
    const cartItemsWithDetails = cart.items.map(item => {
      const itemTotal = item.product.price * item.quantity;
      totalItems += item.quantity;
      totalValue += itemTotal;
      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        product: item.product, // This now includes store and storeId
        total: itemTotal
      };
    });

    const cartData = {
      id: cart.id,
      userId: cart.userId,
      items: cartItemsWithDetails,
      totalItems,
      totalValue: parseFloat(totalValue.toFixed(2))
    };

    await cache.set(cacheKey, cartData, 600);

    res.status(200).json({
      success: true,
      data: cartData
    });

  } catch (error) {
    console.error('Error fetching user cart:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const addItemToCart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId, quantity = 1 } = req.body;

    if (!productId || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'productId and a positive quantity are required.'
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not active.'
      });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for product "${product.name}". Requested: ${quantity}, Available: ${product.stock}`
      });
    }

    let cart = await prisma.cart.findUnique({
      where: { userId }
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId
        }
      });
    }

    let cartItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId
        }
      }
    });

    if (cartItem) {
      const newQuantity = cartItem.quantity + quantity;
      if (product.stock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product "${product.name}". Requested total in cart: ${newQuantity}, Available: ${product.stock}`
        });
      }
      cartItem = await prisma.cartItem.update({
        where: { id: cartItem.id },
        data: { quantity: newQuantity }
      });
    } else {
      cartItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity
        }
      });
    }

    await cache.del(`cart:user:${userId}`);

    res.status(200).json({
      success: true,
      message: 'Item added to cart successfully.',
      data: cartItem
    });

  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const updateCartItemQuantity = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'A non-negative quantity is required.'
      });
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: {
          userId
        }
      },
      include: {
        product: {
          select: { stock: true, name: true }
        }
      }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found or does not belong to your cart.'
      });
    }

    if (quantity > cartItem.product.stock) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for product "${cartItem.product.name}". Requested: ${quantity}, Available: ${cartItem.product.stock}`
      });
    }

    let updatedCartItem;
    if (quantity === 0) {
      await prisma.cartItem.delete({
        where: { id: cartItem.id }
      });
      updatedCartItem = null;
    } else {
      updatedCartItem = await prisma.cartItem.update({
        where: { id: cartItem.id },
        data: { quantity }
      });
    }

    await cache.del(`cart:user:${userId}`);

    const message = updatedCartItem ? 'Cart item quantity updated successfully.' : 'Cart item removed successfully.';
    res.status(200).json({
      success: true,
      message,
      data: updatedCartItem
    });

  } catch (error) {
    console.error('Error updating cart item quantity:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const removeItemFromCart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { cartItemId } = req.params;

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: {
          userId
        }
      }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found or does not belong to your cart.'
      });
    }

    await prisma.cartItem.delete({
      where: { id: cartItem.id }
    });

    await cache.del(`cart:user:${userId}`);

    res.status(200).json({
      success: true,
      message: 'Cart item removed successfully.'
    });

  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const clearCart = async (req, res) => {
  try {
    const userId = req.user.userId;

    const cart = await prisma.cart.findUnique({
      where: { userId }
    });

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: 'Cart is already empty.'
      });
    }

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id }
    });

    await cache.del(`cart:user:${userId}`);

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully.'
    });

  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};