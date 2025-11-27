import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';
import { useAddress } from '../../hooks/useAddress';
import { useOrders } from '../../hooks/useOrder';
import { Colors } from '../../constants/colors';

interface Address {
  id: string;
  recipient: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region: string;
  country: string;
  postalCode?: string | null;
  isDefault: boolean;
}

interface OrderSummary {
  storeId: string;
  storeName: string;
  items: any[];
  subtotal: number;
  checkoutSession: string;
}

const CheckoutScreen = ({ navigation, route }: any) => {
  const { cart, loading: cartLoading, fetchCart } = useCart();
  const { getUserAddresses, loading: addressLoading } = useAddress();
  const { createOrder, loading: orderLoading } = useOrders();

  // Get orders data from route params (passed from CartScreen)
  const ordersFromCart: OrderSummary[] = route.params?.orders || [];

  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deliveryFee] = useState(0); // You can calculate this dynamically per store
  const [placingOrders, setPlacingOrders] = useState(false);

  useEffect(() => {
    loadCheckoutData();
  }, []);

  const loadCheckoutData = async () => {
    await loadAddresses();
  };

  const loadAddresses = async () => {
    const addresses = await getUserAddresses();
    if (addresses && addresses.length > 0) {
      const defaultAddr = addresses.find(addr => addr.isDefault) || addresses[0];
      setSelectedAddress(defaultAddr);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCart();
    await loadCheckoutData();
    setRefreshing(false);
  };

  const handlePlaceOrders = async () => {
    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please add a delivery address to continue');
      return;
    }

    if (!ordersFromCart || ordersFromCart.length === 0) {
      Alert.alert('Empty Cart', 'No items to checkout');
      return;
    }

    // Show confirmation for multiple stores
    if (ordersFromCart.length > 1) {
      Alert.alert(
        'Confirm Orders',
        `You are placing ${ordersFromCart.length} separate orders from different stores. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: () => processOrders() },
        ]
      );
    } else {
      processOrders();
    }
  };

  const processOrders = async () => {
    setPlacingOrders(true);
    const successfulOrders: any[] = [];
    const failedOrders: string[] = [];

    try {
      // Map address to delivery info
      const deliveryInfo = {
        recipient: selectedAddress!.recipient,
        phone: selectedAddress!.phone,
        address: `${selectedAddress!.addressLine1}${selectedAddress!.addressLine2 ? ', ' + selectedAddress!.addressLine2 : ''}`,
        city: selectedAddress!.city,
        region: selectedAddress!.region,
        country: selectedAddress!.country || 'Ghana',
        postalCode: selectedAddress!.postalCode || undefined,
        deliveryFee: deliveryFee,
        notes: '',
      };

      // Create order for each store
      for (const orderSummary of ordersFromCart) {
        try {
          const totalAmount = orderSummary.subtotal + deliveryFee;

          const orderData = {
            storeId: orderSummary.storeId,
            items: orderSummary.items,
            deliveryInfo,
            totalAmount,
            subtotal: orderSummary.subtotal,
            deliveryFee,
            currency: 'GHS',
            checkoutSession: orderSummary.checkoutSession, // Use the session from cart
          };

          const order = await createOrder(orderData);

          if (order) {
            successfulOrders.push({
              orderId: order.id,
              storeName: orderSummary.storeName,
              checkoutSession: orderSummary.checkoutSession,
            });
          } else {
            failedOrders.push(orderSummary.storeName);
          }
        } catch (error) {
          console.error(`Failed to create order for ${orderSummary.storeName}:`, error);
          failedOrders.push(orderSummary.storeName);
        }
      }

      // Show results and navigate
      if (successfulOrders.length > 0 && failedOrders.length === 0) {
        // All orders successful
        Alert.alert(
          'Orders Created!',
          `${successfulOrders.length} order(s) created successfully. Proceed to payment.`,
          [
            {
              text: 'Go to Payment',
              onPress: () => {
                // Navigate to payment with all order IDs
                navigation.navigate('Payment', {
                  orders: successfulOrders,
                  totalOrders: successfulOrders.length,
                });
              },
            },
          ]
        );
      } else if (successfulOrders.length > 0 && failedOrders.length > 0) {
        // Partial success
        Alert.alert(
          'Partial Success',
          `${successfulOrders.length} order(s) created successfully.\n${failedOrders.length} order(s) failed for: ${failedOrders.join(', ')}\n\nDo you want to proceed with successful orders?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => navigation.goBack(),
            },
            {
              text: 'Proceed',
              onPress: () => {
                navigation.navigate('Payment', {
                  orders: successfulOrders,
                  totalOrders: successfulOrders.length,
                });
              },
            },
          ]
        );
      } else {
        // All failed
        Alert.alert(
          'Order Failed',
          'Failed to create orders. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Order creation error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setPlacingOrders(false);
    }
  };

  const formatPrice = (price: number) => {
    return `GH₵ ${price.toFixed(2)}`;
  };

  // Calculate totals across all stores
  const calculateTotals = () => {
    const subtotal = ordersFromCart.reduce((sum, order) => sum + order.subtotal, 0);
    const totalDeliveryFee = deliveryFee * ordersFromCart.length; // Delivery fee per store
    const total = subtotal + totalDeliveryFee;
    const totalItems = ordersFromCart.reduce((sum, order) => sum + order.items.length, 0);

    return { subtotal, totalDeliveryFee, total, totalItems };
  };

  const { subtotal, totalDeliveryFee, total, totalItems } = calculateTotals();

  if (cartLoading && ordersFromCart.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading checkout...</Text>
      </View>
    );
  }

  if (ordersFromCart.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={80} color={Colors.gray300} />
        <Text style={styles.emptyTitle}>No items to checkout</Text>
        <Text style={styles.emptyText}>Add items to your cart to checkout</Text>
        <TouchableOpacity
          style={styles.shopButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.shopButtonText}>Start Shopping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Multi-Store Notice */}
        {ordersFromCart.length > 1 && (
          <View style={styles.multiStoreNotice}>
            <Ionicons name="information-circle" size={20} color={Colors.warning} />
            <Text style={styles.multiStoreText}>
              You're ordering from {ordersFromCart.length} different stores. 
              This will create {ordersFromCart.length} separate orders.
            </Text>
          </View>
        )}

        {/* Delivery Address Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="location" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Delivery Address</Text>
            </View>
          </View>

          {selectedAddress ? (
            <View style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <View style={styles.addressLabelContainer}>
                  <Text style={styles.addressName}>{selectedAddress.recipient}</Text>
                  {selectedAddress.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ManageAddresses', { fromCheckout: true })}
                >
                  <Text style={styles.changeText}>Change</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.addressDetails}>
                <View style={styles.addressRow}>
                  <Ionicons name="call-outline" size={16} color={Colors.gray600} />
                  <Text style={styles.addressText}>{selectedAddress.phone}</Text>
                </View>
                <View style={styles.addressRow}>
                  <Ionicons name="home-outline" size={16} color={Colors.gray600} />
                  <Text style={styles.addressText}>
                    {selectedAddress.addressLine1}
                    {selectedAddress.addressLine2 && `, ${selectedAddress.addressLine2}`}
                  </Text>
                </View>
                <View style={styles.addressRow}>
                  <Ionicons name="navigate-outline" size={16} color={Colors.gray600} />
                  <Text style={styles.addressText}>
                    {selectedAddress.city}, {selectedAddress.region}
                    {selectedAddress.postalCode && ` - ${selectedAddress.postalCode}`}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addAddressCard}
              onPress={() => navigation.navigate('AddAddress', { fromCheckout: true })}
            >
              <Ionicons name="add-circle-outline" size={32} color={Colors.primary} />
              <Text style={styles.addAddressTitle}>Add Delivery Address</Text>
              <Text style={styles.addAddressText}>
                You need to add a delivery address to continue
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Order Items by Store */}
        {ordersFromCart.map((orderSummary, storeIndex) => (
          <View key={orderSummary.checkoutSession} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="storefront" size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>
                  {orderSummary.storeName} ({orderSummary.items.length} items)
                </Text>
              </View>
            </View>

            <View style={styles.itemsContainer}>
              {orderSummary.items.map((item, itemIndex) => (
                <View key={`${orderSummary.storeId}-${item.productId}-${itemIndex}`} style={styles.orderItem}>
                  <Image
                    source={{ uri: item.imageURL || 'https://via.placeholder.com/80' }}
                    style={styles.productImage}
                  />
                  <View style={styles.productDetails}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.name || `Product #${item.productId.substring(0, 8)}`}
                    </Text>
                    <View style={styles.productMeta}>
                      {item.color && (
                        <View style={styles.metaItem}>
                          <Text style={styles.metaLabel}>Color:</Text>
                          <Text style={styles.metaValue}>{item.color}</Text>
                        </View>
                      )}
                      {item.size && (
                        <View style={styles.metaItem}>
                          <Text style={styles.metaLabel}>Size:</Text>
                          <Text style={styles.metaValue}>{item.size}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.productBottom}>
                      <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
                      <Text style={styles.quantity}>Qty: {item.quantity}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Store Subtotal */}
            <View style={styles.storeSubtotal}>
              <Text style={styles.storeSubtotalLabel}>Store Subtotal</Text>
              <Text style={styles.storeSubtotalValue}>{formatPrice(orderSummary.subtotal)}</Text>
            </View>
          </View>
        ))}

        {/* Order Summary Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="receipt-outline" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Order Summary</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal ({totalItems} items)</Text>
              <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Delivery Fee ({ordersFromCart.length} {ordersFromCart.length === 1 ? 'store' : 'stores'})
              </Text>
              <Text style={styles.summaryValue}>{formatPrice(totalDeliveryFee)}</Text>
            </View>
            <Text style={{ ...styles.summaryLabel, marginLeft: 16, fontStyle: 'italic', fontSize: 12, color: '#555' }}>
              To be negotiated with seller
            </Text>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(total)}</Text>
            </View>
          </View>
        </View>

        {/* Spacer for bottom button */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={styles.bottomContainer}>
        <View style={styles.totalContainer}>
          <Text style={styles.bottomTotalLabel}>Total Amount</Text>
          <Text style={styles.bottomTotalValue}>{formatPrice(total)}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.checkoutButton,
            (!selectedAddress || placingOrders) && styles.checkoutButtonDisabled,
          ]}
          onPress={handlePlaceOrders}
          disabled={!selectedAddress || placingOrders}
        >
          {placingOrders ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Text style={styles.checkoutButtonText}>
                Place {ordersFromCart.length === 1 ? 'Order' : `${ordersFromCart.length} Orders`}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.white} />
            </>
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  shopButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  shopButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  multiStoreNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4E6',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    gap: 12,
  },
  multiStoreText: {
    flex: 1,
    fontSize: 14,
    color: '#D97706',
    lineHeight: 20,
  },
  section: {
    marginTop: 12,
    backgroundColor: Colors.white,
    paddingVertical: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addressCard: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  addressLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  defaultBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.white,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  addressDetails: {
    gap: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  addressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  addAddressCard: {
    marginHorizontal: 16,
    padding: 32,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAddressTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  addAddressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  itemsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  orderItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.gray200,
  },
  productDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  productMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  productBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  quantity: {
    fontSize: 14,
    color: Colors.textSecondary,
    backgroundColor: Colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  storeSubtotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  storeSubtotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  storeSubtotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  summaryCard: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  bottomSpacer: {
    height: 120,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bottomTotalLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  bottomTotalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  checkoutButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  checkoutButtonDisabled: {
    backgroundColor: Colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  checkoutButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CheckoutScreen;