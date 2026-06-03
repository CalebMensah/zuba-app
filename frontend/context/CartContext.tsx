import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const GUEST_CART_KEY = '@zuba_guest_cart';

interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  color: string[];
  sizes: string[];
  moq: number;
  storeId: string;
  store?: {
    id: string;
    name: string;
  };
}

interface GuestCartItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
  total: number;
  color?: string;
  size?: string;
  addedAt: number;
}

interface GuestCart {
  items: GuestCartItem[];
  totalItems: number;
  totalValue: number;
}

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
  total: number;
  color?: string,
  size?: string
}

interface Cart {
  id: string | null;
  userId: string;
  items: CartItem[];
  totalItems: number;
  totalValue: number;
}


interface CartContextType {
  cart: Cart | null;
  guestCart: GuestCart | null;
  loading: boolean;
  error: string | null;
  isGuestMode: boolean;
  fetchCart: () => Promise<Cart | null>;
  fetchGuestCart: () => Promise<GuestCart | null>;
  addItem: (productId: string, quantity?: number, color?: string, size?: string) => Promise<any>;
  addToGuestCart: (product: Product, quantity: number, color?: string, size?: string) => Promise<void>;
  updateGuestCartItem: (itemId: string, quantity: number) => Promise<void>;
  removeGuestCartItem: (itemId: string) => Promise<void>;
  clearGuestCart: () => Promise<void>;
  updateItemQuantity: (cartItemId: string, quantity: number) => Promise<any>;
  removeItem: (cartItemId: string) => Promise<any>;
  clearCart: () => Promise<any>;
  syncGuestCartToServer: () => Promise<void>;
  totalItems: number;
  totalValue: number;
}

interface CartProviderProps {
  children: ReactNode;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [guestCart, setGuestCart] = useState<GuestCart | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('token');
      return token;
    } catch (err) {
      console.error('Error getting auth token:', err);
      return null;
    }
  };

  const checkAuthState = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const isGuest = await AsyncStorage.getItem('isGuest');
      
      if (token) {
        setIsGuestMode(false);
        return true;
      } else if (isGuest === 'true') {
        setIsGuestMode(true);
        return false;
      }
      return null;
    } catch (err) {
      return null;
    }
  };

  const calculateGuestCartTotals = (items: GuestCartItem[]): { totalItems: number; totalValue: number } => {
    return {
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      totalValue: items.reduce((sum, item) => sum + item.total, 0),
    };
  };

  const fetchGuestCart = useCallback(async (): Promise<GuestCart | null> => {
    try {
      const storedCart = await AsyncStorage.getItem(GUEST_CART_KEY);
      if (storedCart) {
        const parsedCart = JSON.parse(storedCart);
        setGuestCart(parsedCart);
        return parsedCart;
      }
      const emptyCart: GuestCart = { items: [], totalItems: 0, totalValue: 0 };
      setGuestCart(emptyCart);
      return emptyCart;
    } catch (err) {
      console.error('Error fetching guest cart:', err);
      return null;
    }
  }, []);

  const addToGuestCart = async (product: Product, quantity: number = 1, color?: string, size?: string): Promise<void> => {
    try {
      let currentCart = guestCart || { items: [], totalItems: 0, totalValue: 0 };
      
      // Check if same variation already exists
      const existingIndex = currentCart.items.findIndex(
        item => item.productId === product.id && item.color === color && item.size === size
      );

      if (existingIndex >= 0) {
        // Update existing item quantity
        currentCart.items[existingIndex].quantity += quantity;
        currentCart.items[existingIndex].total = product.price * currentCart.items[existingIndex].quantity;
      } else {
        // Add new item
        const newItem: GuestCartItem = {
          id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId: product.id,
          quantity,
          product,
          total: product.price * quantity,
          color,
          size,
          addedAt: Date.now(),
        };
        currentCart.items.push(newItem);
      }

      const totals = calculateGuestCartTotals(currentCart.items);
      currentCart = { ...currentCart, ...totals };
      
      await AsyncStorage.setItem(GUEST_CART_KEY, JSON.stringify(currentCart));
      setGuestCart(currentCart);
    } catch (err) {
      console.error('Error adding to guest cart:', err);
      throw err;
    }
  };

  const updateGuestCartItem = async (itemId: string, quantity: number): Promise<void> => {
    try {
      if (!guestCart) return;
      
      const updatedItems = guestCart.items.map(item => {
        if (item.id === itemId) {
          return { ...item, quantity, total: item.product.price * quantity };
        }
        return item;
      });

      const totals = calculateGuestCartTotals(updatedItems);
      const updatedCart = { items: updatedItems, ...totals };
      
      await AsyncStorage.setItem(GUEST_CART_KEY, JSON.stringify(updatedCart));
      setGuestCart(updatedCart);
    } catch (err) {
      console.error('Error updating guest cart item:', err);
      throw err;
    }
  };

  const removeGuestCartItem = async (itemId: string): Promise<void> => {
    try {
      if (!guestCart) return;
      
      const updatedItems = guestCart.items.filter(item => item.id !== itemId);
      const totals = calculateGuestCartTotals(updatedItems);
      const updatedCart = { items: updatedItems, ...totals };
      
      await AsyncStorage.setItem(GUEST_CART_KEY, JSON.stringify(updatedCart));
      setGuestCart(updatedCart);
    } catch (err) {
      console.error('Error removing guest cart item:', err);
      throw err;
    }
  };

  const clearGuestCart = async (): Promise<void> => {
    try {
      const emptyCart: GuestCart = { items: [], totalItems: 0, totalValue: 0 };
      await AsyncStorage.setItem(GUEST_CART_KEY, JSON.stringify(emptyCart));
      setGuestCart(emptyCart);
    } catch (err) {
      console.error('Error clearing guest cart:', err);
      throw err;
    }
  };

  const syncGuestCartToServer = async (): Promise<void> => {
    const token = await getAuthToken();
    if (!token || !guestCart || guestCart.items.length === 0) return;

    setLoading(true);
    try {
      // Add each item to server cart
      for (const item of guestCart.items) {
        await fetch(`${API_URL}/cart/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId: item.productId,
            quantity: item.quantity,
            color: item.color,
            size: item.size,
          }),
        });
      }

      // Clear guest cart after successful sync
      await clearGuestCart();
      await fetchCart();
    } catch (err) {
      console.error('Error syncing guest cart to server:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchCart = useCallback(async (): Promise<Cart | null> => {
    const authStatus = await checkAuthState();
    
    // If guest mode, fetch guest cart
    if (authStatus === false) {
      await fetchGuestCart();
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_URL}/cart`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch cart');
      }

      setCart(result.data);
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error fetching cart:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchGuestCart]);

  const addItem = async (productId: string, quantity: number = 1, color?: string, size?: string): Promise<any> => {
    const authStatus = await checkAuthState();
    
    // If guest mode, handle locally
    if (authStatus === false) {
      // For guest mode, we'd need the product info - this should be passed differently
      throw new Error('Guest mode requires product object. Use addToGuestCart instead.');
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_URL}/cart/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId, quantity, color, size }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to add item to cart');
      }

      await fetchCart();
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error adding item to cart:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateItemQuantity = async (cartItemId: string, quantity: number): Promise<any> => {
    const authStatus = await checkAuthState();
    
    // If guest mode, handle locally
    if (authStatus === false) {
      await updateGuestCartItem(cartItemId, quantity);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_URL}/cart/items/${cartItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update item quantity');
      }

      await fetchCart();
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error updating item quantity:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (cartItemId: string): Promise<any> => {
    const authStatus = await checkAuthState();
    
    // If guest mode, handle locally
    if (authStatus === false) {
      await removeGuestCartItem(cartItemId);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_URL}/cart/items/${cartItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to remove item from cart');
      }

      await fetchCart();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error removing item from cart:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async (): Promise<any> => {
    const authStatus = await checkAuthState();
    
    // If guest mode, handle locally
    if (authStatus === false) {
      await clearGuestCart();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_URL}/cart`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to clear cart');
      }

      setCart({
        id: null,
        userId: cart?.userId || '',
        items: [],
        totalItems: 0,
        totalValue: 0.0
      });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error clearing cart:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const value: CartContextType = {
    cart,
    guestCart,
    loading,
    error,
    isGuestMode,
    fetchCart,
    fetchGuestCart,
    addItem,
    addToGuestCart,
    updateGuestCartItem,
    removeGuestCartItem,
    clearGuestCart,
    updateItemQuantity,
    removeItem,
    clearCart,
    syncGuestCartToServer,
    totalItems: isGuestMode ? (guestCart?.totalItems || 0) : (cart?.totalItems || 0),
    totalValue: isGuestMode ? (guestCart?.totalValue || 0) : (cart?.totalValue || 0),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
