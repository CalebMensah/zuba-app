import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { usePayment } from '../../hooks/usePayment';
import { useOrders } from '../../hooks/useOrder';
import { Colors } from '../../constants/colors';

interface PaymentOrder {
  orderId: string;
  storeName: string;
  checkoutSession: string;
}

const PaymentScreen = ({ route, navigation }: any) => {
  // Get orders from route params (passed from CheckoutScreen)
  const { orders: ordersParam, totalOrders } = route.params || {};
  const orders: PaymentOrder[] = ordersParam || [];

  const { 
    createCheckoutSession, 
    verifyPayment, 
    getPaymentsByCheckoutSession,
    loading: paymentLoading 
  } = usePayment();
  const { getOrderById } = useOrders();

  const [orderDetails, setOrderDetails] = useState<any[]>([]);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orders && orders.length > 0) {
      loadOrderDetails();
    } else {
      Alert.alert('Error', 'No orders found', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  }, [orders]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      const orderDataPromises = orders.map(order => getOrderById(order.orderId));
      const fetchedOrders = await Promise.all(orderDataPromises);
      
      const validOrders = fetchedOrders.filter(order => order !== null);
      
      if (validOrders.length === 0) {
        Alert.alert('Error', 'Failed to load order details', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
        return;
      }

      setOrderDetails(validOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiatePayment = async () => {
    if (!orderDetails || orderDetails.length === 0) return;

    try {
      // Get user email from first order
      const userEmail = orderDetails[0].buyer?.email || orderDetails[0].buyerEmail || 'user@example.com';
      
      // Extract order IDs
      const orderIds = orders.map(order => order.orderId);

      // Create checkout session for multiple orders
      const response = await createCheckoutSession({
        orderIds,
        email: userEmail,
        callbackUrl: `${process.env.EXPO_PUBLIC_FRONTEND_URL}/payment/success`
      });

      if (response && response.data) {
        setPaymentUrl(response.data.authorizationUrl);
        setPaymentReference(response.data.reference);
        setCheckoutSessionId(response.data.checkoutSessionId);
        setPaymentInitiated(true);
      } else {
        Alert.alert('Error', 'Failed to initiate payment. Please try again.');
      }
    } catch (error: any) {
      console.error('Payment initiation error:', error);
      Alert.alert(
        'Payment Error',
        error.message || 'Failed to initiate payment. Please try again.'
      );
    }
  };

  const handleWebViewNavigationStateChange = (navState: any) => {
    const { url } = navState;

    // Check if payment was successful
    if (url.includes('/payment/success') || url.includes('success')) {
      setPaymentUrl(null);
      handleVerifyPayment();
    }

    // Check if payment was cancelled
    if (url.includes('cancel') || url.includes('cancelled')) {
      setPaymentUrl(null);
      Alert.alert(
        'Payment Cancelled',
        'Your payment was cancelled. Would you like to try again?',
        [
          { text: 'No', onPress: () => navigation.goBack() },
          { text: 'Yes', onPress: () => setPaymentInitiated(false) }
        ]
      );
    }
  };

  const handleVerifyPayment = async () => {
    if (!paymentReference) {
      Alert.alert('Error', 'Payment reference not found');
      return;
    }

    setVerifying(true);

    try {
      const verification = await verifyPayment(paymentReference);

      if (verification && verification.success) {
        const payments = verification.data.payments;
        const isMultiStore = verification.data.isMultiStore;

        // Check if all payments are successful
        const allSuccessful = payments.every(p => p.status === 'SUCCESS');

        if (allSuccessful) {
          Alert.alert(
            'Payment Successful! 🎉',
            `Your payment for ${payments.length} order(s) has been confirmed.`,
            [
              {
                text: 'View Orders',
                onPress: () => {
                  if (checkoutSessionId) {
                    navigation.navigate('OrderSummary', { 
                      checkoutSession: checkoutSessionId 
                    });
                  } else {
                    navigation.navigate('Orders');
                  }
                }
              }
            ]
          );
        } else {
          const successCount = payments.filter(p => p.status === 'SUCCESS').length;
          Alert.alert(
            'Payment Partially Processed',
            `${successCount} of ${payments.length} payment(s) successful. Please check your orders.`,
            [
              {
                text: 'View Orders',
                onPress: () => navigation.navigate('Orders')
              }
            ]
          );
        }
      } else {
        Alert.alert('Verification Failed', 'Unable to verify payment. Please contact support.');
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      Alert.alert(
        'Verification Error',
        'Failed to verify payment. Please contact support if payment was deducted.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } finally {
      setVerifying(false);
    }
  };

  const formatPrice = (price: number) => {
    return `GH₵ ${price.toFixed(2)}`;
  };

  // Calculate total amount across all orders
  const totalAmount = orderDetails.reduce((sum, order) => sum + order.totalAmount, 0);
  const totalItems = orderDetails.reduce((sum, order) => sum + (order.items?.length || 0), 0);

  // Show loading state
  if (loading || orderDetails.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading payment details...</Text>
      </View>
    );
  }

  // Show WebView when payment is initiated
  if (paymentInitiated && paymentUrl) {
    return (
      <View style={styles.webViewContainer}>
        <View style={styles.webViewHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              Alert.alert(
                'Cancel Payment?',
                'Are you sure you want to cancel this payment?',
                [
                  { text: 'No', style: 'cancel' },
                  {
                    text: 'Yes',
                    onPress: () => {
                      setPaymentUrl(null);
                      setPaymentInitiated(false);
                    }
                  }
                ]
              );
            }}
          >
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.webViewTitle}>Complete Payment</Text>
          <View style={styles.placeholder} />
        </View>
        <WebView
          source={{ uri: paymentUrl }}
          onNavigationStateChange={handleWebViewNavigationStateChange}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          )}
        />
      </View>
    );
  }

  // Show verification screen
  if (verifying) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Verifying payment...</Text>
        <Text style={styles.loadingSubtext}>Please wait</Text>
      </View>
    );
  }

  // Main payment screen
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
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Payment Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="card" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.summaryTitle}>Payment Required</Text>
          <Text style={styles.summaryText}>
            Complete your payment to confirm {orderDetails.length} order(s)
          </Text>
          
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Total Amount to Pay</Text>
            <Text style={styles.amountValue}>{formatPrice(totalAmount)}</Text>
          </View>

          {/* Multi-store indicator */}
          {orderDetails.length > 1 && (
            <View style={styles.multiStoreIndicator}>
              <Ionicons name="storefront" size={16} color={Colors.warning} />
              <Text style={styles.multiStoreText}>
                Payment covers {orderDetails.length} orders from different stores
              </Text>
            </View>
          )}
        </View>

        {/* Orders Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Orders Summary</Text>
          {orderDetails.map((order, index) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderTitle}>
                  Order #{index + 1}
                </Text>
                <Text style={styles.orderAmount}>{formatPrice(order.totalAmount)}</Text>
              </View>
              
              <View style={styles.orderDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="storefront-outline" size={16} color={Colors.gray600} />
                  <Text style={styles.detailText}>{order.store?.name || 'Store'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="receipt-outline" size={16} color={Colors.gray600} />
                  <Text style={styles.detailText}>Order ID: #{order.id.slice(0, 8)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="cube-outline" size={16} color={Colors.gray600} />
                  <Text style={styles.detailText}>{order.items?.length || 0} item(s)</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={16} color={Colors.gray600} />
                  <View style={[styles.statusBadge, getStatusBadgeStyle(order.status)]}>
                    <Text style={styles.statusText}>{order.status}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Total Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.detailsCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Orders</Text>
              <Text style={styles.summaryValue}>{orderDetails.length}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Items</Text>
              <Text style={styles.summaryValue}>{totalItems}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Delivery Address (from first order) */}
        {orderDetails[0]?.deliveryInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <View style={styles.addressCard}>
              <View style={styles.addressRow}>
                <Ionicons name="person" size={16} color={Colors.gray600} />
                <Text style={styles.addressText}>{orderDetails[0].deliveryInfo.recipient}</Text>
              </View>
              <View style={styles.addressRow}>
                <Ionicons name="call" size={16} color={Colors.gray600} />
                <Text style={styles.addressText}>{orderDetails[0].deliveryInfo.phone}</Text>
              </View>
              <View style={styles.addressRow}>
                <Ionicons name="location" size={16} color={Colors.gray600} />
                <Text style={styles.addressText}>
                  {orderDetails[0].deliveryInfo.address}, {orderDetails[0].deliveryInfo.city}, {orderDetails[0].deliveryInfo.region}
                </Text>
              </View>
            </View>
            {orderDetails.length > 1 && (
              <Text style={styles.addressNote}>
                * All orders will be delivered to this address
              </Text>
            )}
          </View>
        )}

        {/* Payment Method Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentMethodCard}>
            <View style={styles.paystackLogo}>
              <Ionicons name="card-outline" size={32} color={Colors.primary} />
              <Text style={styles.paystackText}>Paystack</Text>
            </View>
            <Text style={styles.paymentMethodText}>
              Secure payment powered by Paystack
            </Text>
            <View style={styles.paymentFeatures}>
              <View style={styles.featureItem}>
                <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
                <Text style={styles.featureText}>Secure & Encrypted</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="card" size={16} color={Colors.success} />
                <Text style={styles.featureText}>All Cards Accepted</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="phone-portrait" size={16} color={Colors.success} />
                <Text style={styles.featureText}>Mobile Money</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Ionicons name="lock-closed" size={20} color={Colors.info} />
          <Text style={styles.securityText}>
            Your payment information is secure and encrypted. All {orderDetails.length} order(s) will be processed together.
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.payButton, paymentLoading && styles.payButtonDisabled]}
          onPress={handleInitiatePayment}
          disabled={paymentLoading}
        >
          {paymentLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="card" size={20} color={Colors.white} />
              <Text style={styles.payButtonText}>
                Pay {formatPrice(totalAmount)}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Helper function to get status badge style
const getStatusBadgeStyle = (status: string) => {
  switch (status) {
    case 'PENDING':
      return { backgroundColor: Colors.warning + '20' };
    case 'CONFIRMED':
      return { backgroundColor: Colors.success + '20' };
    case 'PROCESSING':
      return { backgroundColor: Colors.info + '20' };
    case 'CANCELLED':
      return { backgroundColor: Colors.error + '20' };
    default:
      return { backgroundColor: Colors.gray200 };
  }
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
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
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
  summaryCard: {
    backgroundColor: Colors.white,
    marginTop: 16,
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  amountContainer: {
    width: '100%',
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
  },
  multiStoreIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF4E6',
    borderRadius: 8,
  },
  multiStoreText: {
    flex: 1,
    fontSize: 12,
    color: '#D97706',
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  orderCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  orderDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  detailsCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  addressCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
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
  },
  addressNote: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  paymentMethodCard: {
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  paystackLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  paystackText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  paymentMethodText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  paymentFeatures: {
    width: '100%',
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.infoLight,
    borderRadius: 8,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: Colors.info,
  },
  bottomSpacer: {
    height: 100,
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
  payButton: {
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
  payButtonDisabled: {
    backgroundColor: Colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  payButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    padding: 8,
  },
  webViewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
});

export default PaymentScreen;