import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../../context/CartContext';
import { useOrders } from '../../hooks/useOrder';
import { Colors } from '../../constants/colors';

interface SelectedItem {
  cartItemId: string;
  productId: string;
  quantity: number;
  color?: string;
  size?: string;
  storeId: string; // ADDED: Track store for each item
}

interface GroupedItems {
  [storeId: string]: {
    storeName: string;
    items: SelectedItem[];
  };
}

const CartScreen = () => {
  const navigation = useNavigation();
  const { cart, loading, updateItemQuantity, removeItem, clearCart } = useCart();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemConfigurations, setItemConfigurations] = useState<Map<string, SelectedItem>>(new Map());

  useEffect(() => {
    if (cart?.items) {
      const configurations = new Map<string, SelectedItem>();
      cart.items.forEach(item => {
        const colors = item.product.color || [];
        const sizes = item.product.sizes || [];
        const moq = item.product.moq || 1;

        configurations.set(item.id, {
          cartItemId: item.id,
          productId: item.productId,
          quantity: Math.max(item.quantity, moq),
          color: colors.length > 0 ? colors[0] : undefined,
          size: sizes.length > 0 ? sizes[0] : undefined,
          storeId: item.product.storeId, // ADDED: Store the storeId
        });
      });
      setItemConfigurations(configurations);
    }
  }, [cart]);

  const toggleItemSelection = (cartItemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cartItemId)) {
        newSet.delete(cartItemId);
      } else {
        newSet.add(cartItemId);
      }
      return newSet;
    });
  };

  const updateConfiguration = (cartItemId: string, field: keyof SelectedItem, value: any) => {
    setItemConfigurations(prev => {
      const newMap = new Map(prev);
      const config = newMap.get(cartItemId);
      if (config) {
        newMap.set(cartItemId, { ...config, [field]: value });
      }
      return newMap;
    });
  };

  const handleQuantityChange = async (cartItemId: string, newQuantity: number, moq: number) => {
    if (newQuantity < moq) {
      Alert.alert('Invalid Quantity', `Minimum order quantity is ${moq}`);
      return;
    }

    try {
      await updateItemQuantity(cartItemId, newQuantity);
      updateConfiguration(cartItemId, 'quantity', newQuantity);
    } catch (error) {
      Alert.alert('Error', 'Failed to update quantity');
    }
  };

  const handleRemoveItem = async (cartItemId: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeItem(cartItemId);
              setSelectedItems(prev => {
                const newSet = new Set(prev);
                newSet.delete(cartItemId);
                return newSet;
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to remove item');
            }
          },
        },
      ]
    );
  };

  // UPDATED: Group items by store
  const groupItemsByStore = (): GroupedItems => {
    const grouped: GroupedItems = {};
    
    Array.from(selectedItems).forEach(cartItemId => {
      const config = itemConfigurations.get(cartItemId);
      const cartItem = cart?.items.find(item => item.id === cartItemId);
      
      if (config && cartItem) {
        const storeId = config.storeId;
        const storeName = cartItem.product.store?.name || 'Unknown Store';
        
        if (!grouped[storeId]) {
          grouped[storeId] = {
            storeName,
            items: [],
          };
        }
        
        grouped[storeId].items.push(config);
      }
    });
    
    return grouped;
  };

  // UPDATED: Generate checkout session ID
  const generateCheckoutSession = (): string => {
    return `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Handle place order with multi-store support
  const handlePlaceOrder = () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Items Selected', 'Please select at least one item to place an order');
      return;
    }

    // Group items by store
    const groupedItems = groupItemsByStore();
    const storeCount = Object.keys(groupedItems).length;

    // Confirm if multiple stores
    if (storeCount > 1) {
      Alert.alert(
        'Multiple Stores',
        `Your cart contains items from ${storeCount} different stores. This will create ${storeCount} separate orders. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => proceedToCheckout(groupedItems) },
        ]
      );
    } else {
      proceedToCheckout(groupedItems);
    }
  };

  // Proceed to checkout screen with grouped items
  const proceedToCheckout = (groupedItems: GroupedItems) => {
    // Calculate totals for each store
      const orderSummaries = Object.entries(groupedItems).map(([storeId, data]) => {
        let subtotal = 0;
        
        const items = data.items.map(config => {
          const cartItem = cart?.items.find(item => item.id === config.cartItemId);
          if (!cartItem) return null;
          
          const itemTotal = cartItem.product.price * config.quantity;
          subtotal += itemTotal;
          
          return {
            productId: config.productId,
            quantity: config.quantity,
            price: cartItem.product.price,
            color: config.color,
            size: config.size,
            name: cartItem.product.name,
            imageURL: cartItem.product.images?.[0] || null,
          };
        }).filter(Boolean);

        return {
          storeId,
          storeName: data.storeName,
          items,
          subtotal,
          checkoutSession: generateCheckoutSession(), // Generate unique session per store
        };
      });

       console.log('Order Summaries:', JSON.stringify(orderSummaries, null, 2));

    // Navigate to checkout screen with grouped order data
    (navigation as any).navigate('Checkout', {
      orders: orderSummaries,
    });
  };

  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to clear your entire cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearCart();
              setSelectedItems(new Set());
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cart');
            }
          },
        },
      ]
    );
  };

  const renderCartItem = ({ item }: { item: any }) => {
    const config = itemConfigurations.get(item.id);
    const isSelected = selectedItems.has(item.id);
    const moq = item.product.moq || 1;
    const colors = item.product.color || [];
    const sizes = item.product.sizes || [];

    if (!config) return null;

    return (
      <View style={styles.cartItem}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => toggleItemSelection(item.id)}
        >
          <View style={[styles.checkboxInner, isSelected && styles.checkboxSelected]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>

        <Image
          source={{ uri: item.product.images?.[0] || 'https://via.placeholder.com/80' }}
          style={styles.productImage}
        />

        <View style={styles.itemDetails}>
          <Text style={styles.productName}>{item.product.name}</Text>
          {/* ADDED: Show store name */}
          <Text style={styles.storeName}>from {item.product.store?.name || 'Unknown Store'}</Text>
          <Text style={styles.productPrice}>GH₵{item.product.price}</Text>
          <Text style={styles.moqText}>MOQ: {moq}</Text>

          {colors.length > 0 && (
            <View style={styles.configRow}>
              <Text style={styles.configLabel}>Color:</Text>
              <Picker
                selectedValue={config.color}
                style={styles.picker}
                onValueChange={(value: any) => updateConfiguration(item.id, 'color', value)}
              >
                {colors.map((color: string) => (
                  <Picker.Item key={color} label={color} value={color} />
                ))}
              </Picker>
            </View>
          )}

          {sizes.length > 0 && (
            <View style={styles.configRow}>
              <Text style={styles.configLabel}>Size:</Text>
              <Picker
                selectedValue={config.size}
                style={styles.picker}
                onValueChange={(value: any) => updateConfiguration(item.id, 'size', value)}
              >
                {sizes.map((size: string) => (
                  <Picker.Item key={size} label={size} value={size} />
                ))}
              </Picker>
            </View>
          )}

          <View style={styles.quantityContainer}>
            <Text style={styles.configLabel}>Quantity:</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleQuantityChange(item.id, config.quantity - 1, moq)}
                disabled={config.quantity <= moq}
              >
                <Text style={styles.quantityButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantityText}>{config.quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleQuantityChange(item.id, config.quantity + 1, moq)}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.itemTotal}>Total: GH₵{item.total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveItem(item.id)}
        >
          <Text style={styles.removeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && !cart) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Your cart is empty</Text>
      </View>
    );
  }

  // Calculate selected items summary
  const selectedItemsSummary = Array.from(selectedItems).reduce((acc, cartItemId) => {
    const cartItem = cart.items.find(item => item.id === cartItemId);
    if (cartItem) {
      acc.total += cartItem.total;
      acc.count += 1;
    }
    return acc;
  }, { total: 0, count: 0 });

  // Get unique store count for selected items
  const selectedStores = new Set(
    Array.from(selectedItems).map(cartItemId => {
      const config = itemConfigurations.get(cartItemId);
      return config?.storeId;
    }).filter(Boolean)
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping Cart</Text>
        <TouchableOpacity onPress={handleClearCart}>
          <Text style={styles.clearButton}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={cart.items}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
      />

      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Selected Items:</Text>
          <Text style={styles.summaryValue}>{selectedItems.size}</Text>
        </View>
        {/* ADDED: Show store count */}
        {selectedStores.size > 1 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Stores:</Text>
            <Text style={styles.summaryValue}>{selectedStores.size} (separate orders)</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Items:</Text>
          <Text style={styles.summaryValue}>{cart.totalItems}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Selected Total:</Text>
          <Text style={styles.totalValue}>GH₵{selectedItemsSummary.total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            selectedItems.size === 0 && styles.disabledButton
          ]}
          onPress={handlePlaceOrder}
          disabled={selectedItems.size === 0}
        >
          <Text style={styles.placeOrderButtonText}>
            Proceed to Checkout ({selectedItems.size} items)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginTop: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  clearButton: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  checkbox: {
    marginRight: 12,
    justifyContent: 'center',
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  storeName: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  moqText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginRight: 8,
    minWidth: 60,
  },
  picker: {
    flex: 1,
    height: 40,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 32,
    height: 32,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginHorizontal: 16,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  removeButton: {
    padding: 8,
  },
  removeButtonText: {
    fontSize: 20,
    color: Colors.error,
  },
  footer: {
    backgroundColor: Colors.white,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  placeOrderButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    backgroundColor: Colors.disabled,
  },
  placeOrderButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});

export default CartScreen;