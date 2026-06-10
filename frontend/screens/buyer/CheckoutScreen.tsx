import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useAddress } from '../../hooks/useAddress';
import { useCreateOrder } from '../../hooks/useOrder';
import { usePayment } from '../../hooks/usePayment';
import { LoadingSpinner } from '../../components/LoadingSpinner';
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

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageURL?: string;
  color?: string;
  size?: string;
  storeId: string;
  storeName: string;
}

const CheckoutScreen = ({ navigation, route }: any) => {
  const { cart, loading: cartLoading, fetchCart, clearCart } = useCart();
  const { getUserAddresses, loading: addressLoading } = useAddress();
  const { user } = useAuth();

  const createOrderMutation = useCreateOrder();
  
  const { createCheckoutSession, loading: paymentLoading } = usePayment();

  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  // Constants
  const deliveryFee = 0; // To be negotiated with seller
  const taxAmount = 0;
  const discount = 0;
const PAYSTACK_COLLECTION_PERCENT = 1.95; // 1.95% collection fee
const PLATFORM_FEE_PERCENT = 0.03;  // 3% platform fee

  useEffect(() => {
    loadCheckoutData();
  }, []);

  const loadCheckoutData = async () => {
    await loadAddresses();
  };

  const loadAddresses = async () => {
    const addresses = await getUserAddresses();
    if (addresses && addresses.length > 0) {
      const defaultAddr = addresses.find((addr) => addr.isDefault) || addresses[0];
      setSelectedAddress(defaultAddr);
    }
  };

  const onRefresh = async () => {
    await fetchCart();
    await loadCheckoutData();
  };

  // Calculate platform fee
  const calculatePlatformFee = (subtotal: number) => {
    return parseFloat((subtotal * PLATFORM_FEE_PERCENT).toFixed(2));
  };

  // Calculate Paystack collection fee (what buyer pays)
  const calculatePaystackCollectionFee = (amount: number) => {
    const percentFee = amount * (PAYSTACK_COLLECTION_PERCENT / 100);
    return parseFloat(percentFee.toFixed(2));
  };

  // Group cart items by store
  const groupItemsByStore = () => {
    if (!cart?.items) return [];

    const storeMap: { [key: string]: CartItem[] } = {};

    cart.items.forEach((cartItem) => {
      const item: CartItem = {
        productId: cartItem.productId,
        name: cartItem.product.name,
        price: cartItem.product.price,
        quantity: cartItem.quantity,
        imageURL: cartItem.product.images[0],
        color: cartItem.product.color?.[0],
        size: cartItem.product.sizes?.[0],
        storeId: cartItem.product.storeId,
        storeName: cartItem.product.store?.name || 'Unknown Store',
      };

      if (!storeMap[item.storeId]) {
        storeMap[item.storeId] = [];
      }
      storeMap[item.storeId].push(item);
    });

    return Object.entries(storeMap).map(([storeId, items]) => ({
      storeId,
      storeName: items[0].storeName,
      items,
      subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    }));
  };

  const storeGroups = groupItemsByStore();

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = storeGroups.reduce((sum, group) => sum + group.subtotal, 0);
    const totalDeliveryFee = deliveryFee * storeGroups.length; // Per store
    const orderSubtotal = subtotal + totalDeliveryFee + taxAmount - discount;
    const platformFee = calculatePlatformFee(orderSubtotal);
    const taxableForPaystack = orderSubtotal + platformFee;
    const paystackCollectionFee = calculatePaystackCollectionFee(taxableForPaystack);
    const total = orderSubtotal + platformFee + paystackCollectionFee;
    const totalItems = cart?.items?.length || 0;

    return {
      subtotal,
      totalDeliveryFee,
      taxAmount,
      discount,
      orderSubtotal,
      platformFee,
      paystackCollectionFee,
      total,
      totalItems,
    };
  };

  const {
    subtotal,
    totalDeliveryFee,
    orderSubtotal,
    platformFee,
    paystackCollectionFee,
    total,
    totalItems,
  } = calculateTotals();

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please add a delivery address to continue');
      return;
    }

    if (!cart?.items || cart.items.length === 0) {
      Alert.alert('Empty Cart', 'No items to checkout');
      return;
    }

    // Show confirmation for multiple stores
    if (storeGroups.length > 1) {
      Alert.alert(
        'Confirm Orders',
        `You are placing ${storeGroups.length} separate orders from different stores. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: () => processOrder() },
        ]
      );
    } else {
      processOrder();
    }
  };

  const processOrder = async () => {
    setPlacingOrder(true);

    try {
      // Prepare delivery info
      const deliveryInfo = {
        recipient: selectedAddress!.recipient,
        phone: selectedAddress!.phone,
        address: `${selectedAddress!.addressLine1}${
          selectedAddress!.addressLine2 ? ', ' + selectedAddress!.addressLine2 : ''
        }`,
        city: selectedAddress!.city,
        region: selectedAddress!.region,
        country: selectedAddress!.country || 'Ghana',
        postalCode: selectedAddress!.postalCode || undefined,
        deliveryMethod: 'SELLER_DELIVERY' as const,
      };

      const items =
        cart?.items?.map((cartItem) => ({
          productId: cartItem.productId,
          quantity: cartItem.quantity,
          price: cartItem.product.price,
        })) || [];

      const checkoutSession = `cs_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const orderData = {
        items,
        deliveryInfo,
        deliveryFee,
        taxAmount,
        discount,
        currency: 'GHS',
        checkoutSession,
      };

      const orderResult = await createOrderMutation.mutateAsync(orderData);

      if (!orderResult || !orderResult.orders || orderResult.orders.length === 0) {
        throw new Error('Failed to create orders');
      }

      const userEmail = orderResult.orders[0]?.buyer?.realEmail || user?.email || '';

      const orderIds = orderResult.orders.map((order) => order.id);
      const paymentSessionData = {
        orderIds,
        email: userEmail,
      };

      const paymentResult = await createCheckoutSession(paymentSessionData);

      if (!paymentResult || !paymentResult.data) {
        throw new Error('Failed to create payment session');
      }
      await clearCart();

      navigation.navigate('Payment', {
        orders: orderResult.orders.map((order) => ({
          orderId: order.id,
          storeName: order.store?.name,
          amount: order.buyerTotalAmount,
          checkoutSession: order.checkoutSession,
        })),
        paymentSession: {
          authorizationUrl: paymentResult.data.authorizationUrl,
          reference: paymentResult.data.reference,
          checkoutSessionId: paymentResult.data.checkoutSessionId,
        },
        totalAmount: orderResult.orders.reduce(
          (sum, order) => sum + order.buyerTotalAmount,
          0
        ),
        totalOrders: orderResult.orders.length,
        email: userEmail,
        reference: paymentResult?.data?.reference,
        checkoutSessionId: paymentResult?.data?.checkoutSessionId,
      });
    } catch (error: any) {
      console.error('Order creation and payment initiation error:', error);

      let errorMessage = 'Something went wrong. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Order Processing Failed', errorMessage, [
        { text: 'OK', onPress: () => setPlacingOrder(false) },
      ]);
    } finally {
      setPlacingOrder(false);
    }
  };

  const formatPrice = (price: number) => {
    return `GH₵ ${parseFloat(price.toString()).toFixed(2)}`;
  };

  if (cartLoading || !cart) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size={40} color={Colors.primary} />
        <Text style={styles.loadingText}>Loading checkout...</Text>
      </View>
    );
  }

  if (!cart.items || cart.items.length === 0) {
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

  // Determine if mutations are loading
  const isProcessing =
    placingOrder || createOrderMutation.isPending || paymentLoading;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={cartLoading && !!cart}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Multi-Store Notice */}
        {storeGroups.length > 1 && (
          <View style={styles.multiStoreNotice}>
            <Ionicons name="information-circle" size={20} color={Colors.warning} />
            <Text style={styles.multiStoreText}>
              You're ordering from {storeGroups.length} different stores. This will create{' '}
              {storeGroups.length} separate orders.
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
                  onPress={() =>
                    navigation.navigate('ManageAddresses', { fromCheckout: true })
                  }
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
        {storeGroups.map((group, storeIndex) => (
          <View key={group.storeId} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="storefront" size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>
                  {group.storeName} ({group.items.length} items)
                </Text>
              </View>
            </View>

            <View style={styles.itemsContainer}>
              {group.items.map((item, itemIndex) => (
                <View key={`${item.productId}-${itemIndex}`} style={styles.orderItem}>
                  <Image
                    source={{
                      uri: item.imageURL || 'https://via.placeholder.com/80',
                    }}
                    style={styles.productImage}
                  />
                  <View style={styles.productDetails}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.name}
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
              <Text style={styles.storeSubtotalValue}>
                {formatPrice(group.subtotal)}
              </Text>
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
                Delivery Fee ({storeGroups.length}{' '}
                {storeGroups.length === 1 ? 'store' : 'stores'})
              </Text>
              <Text style={styles.summaryValue}>{formatPrice(totalDeliveryFee)}</Text>
            </View>
            <Text style={styles.deliveryNote}>To be negotiated with seller</Text>

            {taxAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax</Text>
                <Text style={styles.summaryValue}>{formatPrice(taxAmount)}</Text>
              </View>
            )}

            {discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={[styles.summaryValue, styles.discountValue]}>
                  -{formatPrice(discount)}
                </Text>
              </View>
            )}

            {/* Platform Fee */}
            <View style={styles.summaryRow}>
              <View style={styles.feeInfoContainer}>
                <Text style={styles.summaryLabel}>Platform Fee (3%)</Text>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(
                      'Platform Fee',
                      '3% platform fee supports Zuba Marketplace operations and services.'
                    )
                  }
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.summaryValue}>{formatPrice(platformFee)}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Order Subtotal</Text>
              <Text style={styles.summaryValue}>{formatPrice(orderSubtotal)}</Text>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.feeInfoContainer}>
                <Text style={styles.summaryLabel}>Payment Processing Fee ({PAYSTACK_COLLECTION_PERCENT}%)</Text>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(
                      'Payment Processing Fee',
                      `Paystack charges ${PAYSTACK_COLLECTION_PERCENT}% to process your payment securely.`
                    )
                  }
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.summaryValue}>
                {formatPrice(paystackCollectionFee)}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total to Pay</Text>
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
            (!selectedAddress || isProcessing) && styles.checkoutButtonDisabled,
          ]}
          onPress={handlePlaceOrder}
          disabled={!selectedAddress || isProcessing}
        >
          {isProcessing ? (
            <View style={styles.buttonContentRow}>
              <LoadingSpinner size={20} color={Colors.white} />
              <Text style={styles.checkoutButtonText}>
                {createOrderMutation.isPending
                  ? 'Creating Orders...'
                  : paymentLoading
                  ? 'Setting up Payment...'
                  : 'Processing...'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.checkoutButtonText}>
                Place {storeGroups.length === 1 ? 'Order' : `${storeGroups.length} Orders`}{' '}
                & Pay
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
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 12,
  },
  loadingText: {
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
    color: Colors.primary,
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
    color: Colors.primary,
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
  discountValue: {
    color: Colors.success,
  },
  deliveryNote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.textTertiary,
    marginLeft: 16,
    marginTop: -4,
    marginBottom: 4,
  },
  feeInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    minHeight: 52,
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
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default CheckoutScreen;