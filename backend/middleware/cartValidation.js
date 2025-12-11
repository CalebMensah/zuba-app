import { body, param } from 'express-validator';

// UUID/CUID validation regex
const idRegex = /^(c[a-z0-9]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

// Maximum values
const MAX_QUANTITY = 10000;

// Validation for adding item to cart
export const validateAddToCart = [
  body('productId')
    .trim()
    .notEmpty()
    .withMessage('Product ID is required')
    .matches(idRegex)
    .withMessage('Invalid product ID format'),
  
  body('quantity')
    .optional()
    .isInt({ min: 1, max: MAX_QUANTITY })
    .withMessage(`Quantity must be between 1 and ${MAX_QUANTITY}`)
    .toInt(),
];

// Validation for updating cart item quantity
export const validateUpdateCartItem = [
  param('cartItemId')
    .trim()
    .notEmpty()
    .withMessage('Cart item ID is required')
    .matches(idRegex)
    .withMessage('Invalid cart item ID format'),
  
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 0, max: MAX_QUANTITY })
    .withMessage(`Quantity must be between 0 and ${MAX_QUANTITY}`)
    .toInt(),
];

// Validation for removing item from cart
export const validateRemoveFromCart = [
  param('cartItemId')
    .trim()
    .notEmpty()
    .withMessage('Cart item ID is required')
    .matches(idRegex)
    .withMessage('Invalid cart item ID format'),
];

// Sanitization middleware
export const sanitizeCartInputs = (req, res, next) => {
  // Ensure quantity is an integer if present
  if (req.body.quantity !== undefined) {
    req.body.quantity = parseInt(req.body.quantity, 10);
    if (isNaN(req.body.quantity)) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a valid number'
      });
    }
  }
  
  next();
};