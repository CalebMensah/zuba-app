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
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/colors';

interface Variation {
  color?: string;
  size?: string;
  quantity: number;
  cartItemId: string;
}

interface ProductGroup {
  productId: string;
  product: any;
  variations: Variation[];
  totalQuantity: number;
  totalPrice: number;
}

interface SelectedItem {
  cartItemId: string;
  productId: string;
  quantity: number;
  color?: string;
  size?: string;
  storeId: string;
}

interface GroupedItems {
  [storeId: string]: {
    storeName: string;
    items: SelectedItem[];
  };
}

const CartScreen = () => {
  const navigation = useNavigation();
  const { isGuest } = useAuth();
  const {
    cart,
    guestCart,
    loading,
    updateItemQuantity,
    removeItem,
    clearCart,
    addItem,
    updateGuestCartItem,
    removeGuestCartItem,
    clearGuestCart,
    addToGuestCart
  } = useCart();

  const currentCart = isGuest ? guestCart : cart;
  const currentCartItems = currentCart?.items || [];
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [existingVariations, setExistingVariations] = useState<Variation[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingVariation, setEditingVariation] = useState<Variation | null>(null);
  
  const [modalColor, setModalColor] = useState<string | undefined>();
  const [modalSize, setModalSize] = useState<string | undefined>();
  const [modalQuantity, setModalQuantity] = useState(1);

  const groupCartItemsByProduct = (): ProductGroup[] => {
    if (!currentCartItems || currentCartItems.length === 0) return [];

    const grouped = currentCartItems.reduce((acc, item) => {
      const productId = item.productId;
      
      if (!acc[productId]) {
        acc[productId] = {
          productId,
          product: item.product,
          variations: [],
          totalQuantity: 0,
          totalPrice: 0,
        };
      }

      acc[productId].variations.push({
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        cartItemId: item.id,
      });
      
      acc[productId].totalQuantity += item.quantity;
      acc[productId].totalPrice += item.total;

      return acc;
    }, {} as Record<string, ProductGroup>);

    return Object.values(grouped);
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleRemoveVariation = async (cartItemId: string) => {
    Alert.alert(
      'Remove Variation',
      'Are you sure you want to remove this variation from cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isGuest) {
                await removeGuestCartItem(cartItemId);
              } else {
                await removeItem(cartItemId);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to remove variation');
            }
          },
        },
      ]
    );
  };

  const openAddVariationModal = (productGroup: ProductGroup) => {
    setIsEditMode(false);
    setEditingVariation(null);
    setSelectedProduct(productGroup.product);
    setExistingVariations(productGroup.variations);
    
    const colors = productGroup.product.color || [];
    const sizes = productGroup.product.sizes || [];
    const moq = productGroup.product.moq || 1;
    
    setModalColor(colors.length > 0 ? colors[0] : undefined);
    setModalSize(sizes.length > 0 ? sizes[0] : undefined);
    setModalQuantity(moq);
    setModalVisible(true);
  };

  const openEditVariationModal = (variation: Variation, productGroup: ProductGroup) => {
    setIsEditMode(true);
    setEditingVariation(variation);
    setSelectedProduct(productGroup.product);
    setExistingVariations(productGroup.variations);
    
    setModalColor(variation.color);
    setModalSize(variation.size);
    setModalQuantity(variation.quantity);
    setModalVisible(true);
  };

  const closeVariationModal = () => {
    setModalVisible(false);
    setModalColor(undefined);
    setModalSize(undefined);
    setModalQuantity(1);
    setIsEditMode(false);
    setEditingVariation(null);
  };

  const isVariationAlreadyInCart = (color?: string, size?: string): boolean => {
    return existingVariations.some(
      v => (v.color || null) === (color || null) && (v.size || null) === (size || null)
    );
  };

  const handleModalAction = async () => {
    if (!selectedProduct) return;

    const moq = selectedProduct.moq || 1;
    if (modalQuantity < moq) {
      Alert.alert('Invalid Quantity', `Minimum order quantity is ${moq}`);
      return;
    }

    if (isEditMode && editingVariation) {
      // Edit existing variation
      try {
        if (isGuest) {
          await updateGuestCartItem(editingVariation.cartItemId, modalQuantity);
        } else {
          await updateItemQuantity(editingVariation.cartItemId, modalQuantity);
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        closeVariationModal();
      } catch (error) {
        Alert.alert('Error', 'Failed to update variation quantity');
      }
    } else {
      // Add new variation
      if (isVariationAlreadyInCart(modalColor, modalSize)) {
        Alert.alert(
          'Variation Already Selected',
          'This variation is already in your cart. Click on the variation pill to adjust its quantity.'
        );
        return;
      }

      try {
        if (isGuest) {
          await addToGuestCart(selectedProduct, modalQuantity, modalColor, modalSize);
        } else {
          await addItem(selectedProduct.id, modalQuantity, modalColor || undefined, modalSize || undefined);
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        closeVariationModal();
      } catch (error) {
        Alert.alert('Error', 'Failed to add variation to cart');
      }
    }
  };

  const groupItemsByStore = (): GroupedItems => {
    const grouped: GroupedItems = {};
    
    Array.from(selectedProducts).forEach(productId => {
      const productGroup = groupCartItemsByProduct().find(g => g.productId === productId);
      
      if (productGroup) {
        productGroup.variations.forEach(variation => {
          const cartItem = cart?.items.find(item => item.id === variation.cartItemId);
          
          if (cartItem) {
            const storeId = cartItem.product.storeId;
            const storeName = cartItem.product.store?.name || 'Unknown Store';
            
            if (!grouped[storeId]) {
              grouped[storeId] = {
                storeName,
                items: [],
              };
            }
            
            grouped[storeId].items.push({
              cartItemId: cartItem.id,
              productId: cartItem.productId,
              quantity: cartItem.quantity,
              color: cartItem.color,
              size: cartItem.size,
              storeId: cartItem.product.storeId,
            });
          }
        });
      }
    });
    
    return grouped;
  };

  const generateCheckoutSession = (): string => {
    return `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handlePlaceOrder = () => {
    if (selectedProducts.size === 0) {
      Alert.alert('No Items Selected', 'Please select at least one product to place an order');
      return;
    }

    // For guest users, prompt to sign in before checkout
    if (isGuest) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to your account to complete your purchase and save your cart permanently.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In',
            onPress: () => (navigation as any).navigate ('Login')
          },
        ]
      );
      return;
    }

    const groupedItems = groupItemsByStore();
    const storeCount = Object.keys(groupedItems).length;

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

  const proceedToCheckout = (groupedItems: GroupedItems) => {
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
        checkoutSession: generateCheckoutSession(),
      };
    });

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
              if (isGuest) {
                await clearGuestCart();
              } else {
                await clearCart();
              }
              setSelectedProducts(new Set());
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cart');
            }
          },
        },
      ]
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Cart will automatically refetch
    } catch (error) {
      console.error('Error refreshing cart:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const renderVariationPill = (variation: Variation, productGroup: ProductGroup) => {
    return (
      <TouchableOpacity
        key={variation.cartItemId}
        style={styles.variationPill}
        onPress={() => openEditVariationModal(variation, productGroup)}
        activeOpacity={0.7}
      >
        {variation.color && (
          <Text style={styles.pillText}>{variation.color}</Text>
        )}
        {variation.size && (
          <Text style={styles.pillText}>{variation.size}</Text>
        )}
        <Text style={styles.pillText}>× {variation.quantity}</Text>
        
        <TouchableOpacity
          style={styles.pillRemoveButton}
          onPress={(e) => {
            e.stopPropagation();
            handleRemoveVariation(variation.cartItemId);
          }}
        >
          <Text style={styles.pillRemoveText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderProductGroup = ({ item }: { item: ProductGroup }) => {
    const product = item.product;
    const moq = product.moq || 1;
    const hasColors = product.color && product.color.length > 0;
    const hasSizes = product.sizes && product.sizes.length > 0;
    const isSelected = selectedProducts.has(item.productId);

    return (
      <View style={styles.productCard}>
        <View style={styles.productHeader}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => toggleProductSelection(item.productId)}
          >
            <View style={[styles.checkboxInner, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>

          <Image
            source={{ uri: product.images?.[0] || 'https://via.placeholder.com/80' }}
            style={styles.productImage}
          />
          
          <View style={styles.productHeaderInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.storeName}>from {product.store?.name || 'Unknown Store'}</Text>
            <Text style={styles.productPrice}>GH₵{product.price}</Text>
            <Text style={styles.moqText}>MOQ: {moq}</Text>
          </View>
        </View>

        <View style={styles.variationsContainer}>
          <Text style={styles.variationsLabel}>Variations in Cart:</Text>
          <View style={styles.pillsWrapper}>
            {item.variations.map(variation => renderVariationPill(variation, item))}
          </View>
        </View>

        {(hasColors || hasSizes) && (
          <TouchableOpacity
            style={styles.chooseAnotherButton}
            onPress={() => openAddVariationModal(item)}
          >
            <Text style={styles.chooseAnotherText}>+ Add Another Variation</Text>
          </TouchableOpacity>
        )}

        <View style={styles.productFooter}>
          <Text style={styles.totalQuantityText}>Total Quantity: {item.totalQuantity}</Text>
          <Text style={styles.totalPriceText}>Total: GH₵{item.totalPrice.toFixed(2)}</Text>
        </View>
      </View>
    );
  };

  const renderVariationModal = () => {
    if (!selectedProduct) return null;

    const colors = selectedProduct.color || [];
    const sizes = selectedProduct.sizes || [];
    const moq = selectedProduct.moq || 1;

    return (
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeVariationModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditMode ? 'Edit Variation Quantity' : 'Add New Variation'}
              </Text>
              <TouchableOpacity onPress={closeVariationModal}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              {!isEditMode && colors.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Color:</Text>
                  <View style={styles.optionsGrid}>
                    {colors.map((color: string) => {
                      return (
                        <TouchableOpacity
                          key={color}
                          style={[
                            styles.optionButton,
                            modalColor === color && styles.optionButtonSelected,
                          ]}
                          onPress={() => setModalColor(color)}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              modalColor === color && styles.optionTextSelected,
                            ]}
                          >
                            {color}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {!isEditMode && sizes.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Size:</Text>
                  <View style={styles.optionsGrid}>
                    {sizes.map((size: string) => {
                      return (
                        <TouchableOpacity
                          key={size}
                          style={[
                            styles.optionButton,
                            modalSize === size && styles.optionButtonSelected,
                          ]}
                          onPress={() => setModalSize(size)}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              modalSize === size && styles.optionTextSelected,
                            ]}
                          >
                            {size}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {isEditMode && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Current Selection:</Text>
                  <View style={styles.currentSelectionBadge}>
                    {modalColor && <Text style={styles.currentSelectionText}>{modalColor}</Text>}
                    {modalSize && <Text style={styles.currentSelectionText}>{modalSize}</Text>}
                  </View>
                </View>
              )}

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Quantity (MOQ: {moq}):</Text>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => setModalQuantity(Math.max(moq, modalQuantity - 1))}
                    disabled={modalQuantity <= moq}
                  >
                    <Text style={styles.quantityButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{modalQuantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => setModalQuantity(modalQuantity + 1)}
                  >
                    <Text style={styles.quantityButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.addToCartButton}
                onPress={handleModalAction}
              >
                <Text style={styles.addToCartButtonText}>
                  {isEditMode ? 'Update Quantity' : 'Add to Cart'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading && !cart) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const productGroups = groupCartItemsByProduct();

  if (!cart || productGroups.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Your cart is empty</Text>
      </View>
    );
  }

  const selectedItemsSummary = Array.from(selectedProducts).reduce((acc, productId) => {
    const productGroup = productGroups.find(g => g.productId === productId);
    if (productGroup) {
      acc.total += productGroup.totalPrice;
      acc.count += productGroup.variations.length;
    }
    return acc;
  }, { total: 0, count: 0 });

  const selectedStores = new Set(
    Array.from(selectedProducts).map(productId => {
      const productGroup = productGroups.find(g => g.productId === productId);
      return productGroup?.product.storeId;
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
        data={productGroups}
        renderItem={renderProductGroup}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      />

      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Selected Products:</Text>
          <Text style={styles.summaryValue}>{selectedProducts.size}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Variations:</Text>
          <Text style={styles.summaryValue}>{selectedItemsSummary.count}</Text>
        </View>
        {selectedStores.size > 1 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Stores:</Text>
            <Text style={styles.summaryValue}>{selectedStores.size} (separate orders)</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Selected Total:</Text>
          <Text style={styles.totalValue}>GH₵{selectedItemsSummary.total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            selectedProducts.size === 0 && styles.disabledButton
          ]}
          onPress={handlePlaceOrder}
          disabled={selectedProducts.size === 0}
        >
          <Text style={styles.placeOrderButtonText}>
            Proceed to Checkout ({selectedItemsSummary.count} variations)
          </Text>
        </TouchableOpacity>
      </View>

      {renderVariationModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginTop: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  clearButton: {
    color: '#ff3b30',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  checkbox: {
    marginRight: 12,
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  productHeaderInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  storeName: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  moqText: {
    fontSize: 12,
    color: '#666',
  },
  variationsContainer: {
    marginTop: 12,
    marginBottom: 12,
  },
  variationsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  pillsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    gap: 6,
  },
  pillText: {
    fontSize: 13,
    color: '#000',
    fontWeight: '500',
  },
  pillRemoveButton: {
    marginLeft: 4,
    paddingLeft: 4,
  },
  pillRemoveText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chooseAnotherButton: {
    backgroundColor: 'transparent',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  chooseAnotherText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalQuantityText: {
    fontSize: 14,
    color: '#666',
  },
  totalPriceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  placeOrderButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  placeOrderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
  },
  modalSection: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  currentSelectionBadge: {
    flexDirection: 'row',
    gap: 8,
  },
  currentSelectionText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    margin: 4,
  },
  optionButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#e3f2fd',
  },
  optionText: {
    fontSize: 14,
    color: '#000',
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  quantityButton: {
    width: 40,
    height: 40,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  quantityButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    minWidth: 40,
    textAlign: 'center',
  },
  addToCartButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  addToCartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}
)

export default CartScreen;