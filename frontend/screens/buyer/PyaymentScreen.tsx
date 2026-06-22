import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import type { OrderWithBreakdown } from '../../types/order';
import { usePayment } from '../../hooks/usePayment';
import { orderAPI } from '../../services/orderApi';
import { orderKeys } from '../../hooks/useOrder';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Colors } from '../../constants/colors';

interface PaymentOrder {
  orderId: string;
  storeName: string;
  checkoutSession: string;
}

const PaymentScreen = ({ route, navigation }: any) => {
  const {
    orders: ordersParam,
    orderId,
    paymentSession,
    totalAmount: totalAmountParam,
    totalOrders,
    email: emailParam,
    reference,
    checkoutSessionId,
  } = route.params || {};

  // Support both navigation formats:
  // 1) Multi-order: { orders: [{ orderId, ... }] }
  // 2) Single order (OrderDetails -> Payment): { orderId: '...' }
  const orders: PaymentOrder[] =
    (ordersParam && Array.isArray(ordersParam) ? ordersParam : []).length > 0
      ? (ordersParam as PaymentOrder[])
      : orderId
      ? [{
          orderId: String(orderId),
          storeName: '',
          checkoutSession: '',
        }]
      : [];

  const { createCheckoutSession, verifyPayment, loading: paymentLoading } = usePayment();

  const [email, setEmail] = useState(emailParam || '');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [sessionReference, setSessionReference] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
const [isVerifying, setIsVerifying] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

const orderQueries = useQueries({
  queries: orders.map((order) => ({
    queryKey: orderKeys.detail(order.orderId),
    queryFn: () => orderAPI.getOrderById(order.orderId),
    enabled: !!order.orderId,
    staleTime: 60000,
  })),
}) as UseQueryResult<OrderWithBreakdown>[];

  // Derive loading and error states from all queries
  const isLoadingOrders = orderQueries.some((query) => query.isLoading);
  const hasErrors = orderQueries.some((query) => query.error);
  const orderDetails = orderQueries
    .map((query) => query.data)
    .filter((order): order is OrderWithBreakdown => Boolean(order)) as OrderWithBreakdown[];

  // Check authentication status
  const checkAuthentication = async (): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem('token');
      const user = await AsyncStorage.getItem('user');

      if (!token || !user) {
        console.log(' No authentication token or user data found');
        return false;
      }

      if (!token.startsWith('eyJ')) {
        console.log('Invalid token format');
        return false;
      }

      setIsAuthenticated(true);
      console.log('User authenticated');
      return true;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  };

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    try {
      const authenticated = await checkAuthentication();
      if (!authenticated) {
        Alert.alert(
          'Authentication Required',
          'Please log in to continue with payment.',
          [
            { text: 'Cancel', onPress: () => navigation.goBack() },
            { text: 'Log In', onPress: () => navigation.navigate('Login') },
          ]
        );
        return;
      }

      if (!orders || orders.length === 0) {
        Alert.alert('Error', 'No orders found', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
    } catch (error) {
      console.error('Error initializing payment screen:', error);
      Alert.alert('Error', 'Failed to initialize payment screen');
      navigation.goBack();
    }
  };

  const { user } = useAuth();
  useEffect(() => {
    if (orderDetails.length > 0 && !email) {
      const orderEmail = orderDetails[0].buyer?.email || '';
      const finalEmail = orderEmail || user?.email || emailParam || '';
      setEmail(finalEmail);
    }
  }, [orderDetails, user?.email, emailParam]);

  const handlePayNow = async () => {
    try {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address');
        return;
      }

      if (totalAmount <= 0) {
        Alert.alert('Invalid Amount', 'Cannot process payment with zero amount. Please check your orders.');
        return;
      }

      if (!orders || orders.length === 0) {
        Alert.alert('Error', 'No orders found for payment');
        return;
      }

      if (!totalAmount || totalAmount <= 0) {
        Alert.alert('Error', 'Invalid payment amount');
        return;
      }

      console.log('Starting payment process with:', {
        ordersCount: orders.length,
        totalAmount,
        email,
        hasPaymentSession: !!paymentSession,
        hasReference: !!reference,
        referenceValue: reference,
      });

      let paymentReference: string = '';
      let paymentAmount: number = 0;
      let authorizationUrl: string = '';

      if (paymentSession && reference) {
        console.log('Using existing payment session with reference:', reference);
        paymentReference = reference;
        paymentAmount = totalAmount;
        authorizationUrl = paymentSession.authorizationUrl;
      } else {
        console.log('Creating new checkout session');
        const orderIds = orders.map((order) => order.orderId);

        // Guard against stale/invalid orders (already paid or already have pending payments)
        try {
          const response = await createCheckoutSession({
            orderIds,
            email: email.trim(),
          });

          if (response && response.data) {
            console.log('Checkout session created:', response.data);
            paymentReference = response.data.reference;
            setPaymentAmount(response.data.totalAmount);
            paymentAmount = response.data.totalAmount;
            authorizationUrl = response.data.authorizationUrl;

            if (!totalAmountParam) {
              console.log('Refetching orders for breakdown details...');
              orderQueries.forEach((query) => query.refetch());
            } else {
              console.log('Using totalAmountParam from CheckoutScreen - skipping refetch');
            }
          } else {
            console.error('No response data from checkout session creation');
            Alert.alert('Error', 'Failed to initiate payment. Please try again.');
            return;
          }
        } catch (e: any) {
          console.error('Checkout session creation failed:', e);
          const msg: string = e?.message || '';
          if (msg.includes('Invalid orders') || msg.includes('pending payments')) {
            Alert.alert(
              'Payment not available',
              'This order has already been processed or already has a pending payment. Please check your Orders tab.'
            );
            return;
          }
          throw e;
        }
      }

      if (!paymentAmount || paymentAmount <= 0) {
        Alert.alert('Invalid Amount', 'Payment amount is invalid');
        return;
      }

      if (!paymentReference || paymentReference.length < 5) {
        Alert.alert('Invalid Reference', 'Payment reference is invalid');
        return;
      }

      if (!authorizationUrl) {
        Alert.alert('Error', 'Payment authorization URL not found');
        return;
      }

      console.log('Opening Paystack payment page:', {
        reference: paymentReference,
        amount: paymentAmount,
        authorizationUrl,
      });

      setSessionReference(paymentReference);
      setAuthUrl(authorizationUrl);
    } catch (error: any) {
      console.error('Payment initiation error:', error);

      let errorMessage = 'Failed to initiate payment. Please try again.';

      if (error.message.includes('Authentication required')) {
        errorMessage = 'Please log in again to continue with payment.';
      } else if (error.message.includes('Too many payment attempts')) {
        errorMessage =
          'Too many payment attempts. Please wait a few minutes before trying again.';
      } else if (error.message.includes('Network error')) {
        errorMessage =
          'Network connection error. Please check your internet connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Payment Error', errorMessage, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: () => handlePayNow() },
      ]);
    }
  };

const handleWebViewNavigationStateChange = async (navState: any) => {
    const { url, loading } = navState as { url?: string; loading?: boolean };
    if (!url || isVerifying) return;

    console.log('WebView navigation:', { url, loading, isVerifying, sessionReference });

    const isSuccessPage = 
      url.includes('/paystack/pay/complete/') ||
      url.includes('status=success') ||
      url.includes('&trxref=') ||
      url.includes('#success') ||
      url.includes('payment-success');

    const isCancelPage = 
      url.includes('/paystack/pay/cancel/') ||
      url.includes('status=cancelled') ||
      url.includes('cancel');

    if (isSuccessPage || isCancelPage) {
      console.log(`${isSuccessPage ? 'SUCCESS' : 'CANCEL'} page detected:`, url);
      
      if (isVerifying || !sessionReference) {
        console.log('Already processing, skipping');
        return;
      }

      setIsVerifying(true);
      const referenceToVerify = sessionReference!;
      
      // Hide WebView immediately
      setAuthUrl(null);
      setSessionReference(null);

      try {
        console.log('Auto-verifying payment:', referenceToVerify);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Brief delay

        const verification = await verifyPayment(referenceToVerify);
        
        if (verification?.success) {
          console.log('Auto-verification SUCCESS!');
          Alert.alert(
            'Payment Successful!',
            `Your payment has been verified successfully.\n\nRedirecting to Orders...`,
            [{ text: 'OK', onPress: () => navigation.replace('Orders') }]
          );
        } else {
          console.warn('Auto-verification failed:', verification);
          setIsVerifying(false);
          Alert.alert(
            'Payment Pending',
            'Payment initiated but needs verification.\n\nCheck your Orders tab.',
            [{ text: 'Go to Orders', onPress: () => navigation.replace('Orders') }]
          );
        }
      } catch (err: any) {
        console.error('Auto-verification error:', err);
        setIsVerifying(false);
        Alert.alert(
          'Verification Issue',
          'Please check your Orders tab for payment status.',
          [{ text: 'Go to Orders', onPress: () => navigation.replace('Orders') }]
        );
      }
    }
  };

  const injectedJavaScript = `
    (function() {
      function pollPaystackStatus() {
        // Paystack success indicators
        const successSelectors = [
          '.checkout-success',
          '[data-testid="success-screen"]',
          '.payment-success',
          '#success-message',
          '.success-icon',
          'h1:contains("Success")',
          'h2:contains("Complete")',
          '.checkmark-icon'
        ];
        
        const cancelSelectors = [
          '.checkout-cancel',
          '[data-testid="cancel-screen"]',
          '.payment-cancel',
          '#cancel-message',
          '.cancel-icon',
          'h1:contains("Cancelled")',
          '.error-icon'
        ];
        
        const checkSuccess = () => {
          for (let selector of successSelectors) {
            if (document.querySelector(selector.split(':contains("')[0]) || 
                document.body.textContent.includes('success') ||
                document.body.textContent.includes('complete') ||
                document.title.includes('Success')) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PAYMENT_SUCCESS',
                timestamp: Date.now()
              }));
              return true;
            }
          }
          return false;
        };
        
        const checkCancel = () => {
          for (let selector of cancelSelectors) {
            if (document.querySelector(selector.split(':contains("')[0]) || 
                document.body.textContent.includes('cancelled') ||
                document.body.textContent.includes('failed') ||
                document.title.includes('Cancel')) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PAYMENT_CANCEL',
                timestamp: Date.now()
              }));
              return true;
            }
          }
          return false;
        };
        
        if (checkSuccess() || checkCancel()) return;
        
        // Poll every 2 seconds
        setTimeout(pollPaystackStatus, 2000);
      }
      
      // Initial check + start polling
      pollPaystackStatus();
      
      // Listen for URL changes
      let currentUrl = window.location.href;
      setInterval(() => {
        if (window.location.href !== currentUrl) {
          currentUrl = window.location.href;
          console.log('URL changed:', currentUrl);
          checkSuccess() || checkCancel();
        }
      }, 1000);
    })();
  `;

  const handleWebViewMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('📱 WebView message:', message);
      
      if (message.type === 'PAYMENT_SUCCESS' && !isVerifying && sessionReference) {
        console.log('JS Success detection!');
        setIsVerifying(true);
        const referenceToVerify = sessionReference;
        setAuthUrl(null);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const verification = await verifyPayment(referenceToVerify);
        if (verification?.success) {
          Alert.alert('Success!', 'Payment verified. Redirecting...', [
            { text: 'OK', onPress: () => navigation.replace('BuyerOrders') }
          ]);
        }
      } else if (message.type === 'PAYMENT_CANCEL') {
        console.log('JS Cancel detection');
        Alert.alert(
          'Payment Cancelled',
          'Payment was cancelled. You can try again anytime.',
          [{ text: 'OK', onPress: () => setAuthUrl(null) }]
        );
      }
    } catch (e) {
      console.log('Non-JSON message from WebView:', event.nativeEvent.data);
    }
  };
  
  useEffect(() => {
    // intentionally empty
  }, []);


  const formatPrice = (price: number) => {
    return `GH₵ ${parseFloat(price.toString()).toFixed(2)}`;
  };

  const totalAmount = totalAmountParam ?? 
                     (paymentAmount > 0 ? paymentAmount : 
                       orderDetails.reduce((sum, order) => {
                         return sum + (order.buyerTotalAmount ?? 
(order.breakdown?.buyerTotal ?? 
                                      order.buyerTotalAmount ?? 
                                      order.totalAmount ?? 0));
                       }, 0)
                     );
  
  useEffect(() => {
    console.log('TOTAL AMOUNT DEBUG:', {
      totalAmountParam,
      paymentAmount,
      orderDetailsCount: orderDetails.length,
      orderDetails: orderDetails.map(o => ({
        id: o.id,
        buyerTotalAmount: o.buyerTotalAmount,
        breakdownTotal: o.breakdown?.buyerTotal ?? o.buyerTotalAmount,
        subtotal: o.breakdown?.subtotal
      })),
      calculatedTotal: orderDetails.reduce((sum, o) => sum + (o.buyerTotalAmount ?? 0), 0),
      finalTotal: totalAmount
    });
  }, [totalAmount, orderDetails, totalAmountParam]);

  // Log for debugging
  if (!totalAmountParam) {
    console.warn('No totalAmountParam - using dynamic recalc');
  } else {
    console.log('Using totalAmountParam from CheckoutScreen:', totalAmount);
  }
  
  // Keep breakdown calcs for display (backend provides details)
  const subtotal = orderDetails.reduce((sum, order) => sum + (order.breakdown?.subtotal ?? order.totalAmount ?? 0), 0);
  const platformFeeTotal = orderDetails.reduce((sum, order) => sum + Number(order.breakdown?.platformFee ?? 0), 0);
  const paystackFeeTotal = orderDetails.reduce((sum, order) => sum + Number(order.breakdown?.paystackFee ?? 0), 0);
  const totalItems = orderDetails.reduce(
    (sum, order) => sum + (order.items?.length || 0),
    0
  );

  // Loading state - initial fetch only
  if (isLoadingOrders && orderDetails.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size={40} color={Colors.primary} />
        <Text style={styles.loadingText}>Loading payment details...</Text>
      </View>
    );
  }

  // Error state
  if (hasErrors && orderDetails.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorText}>Failed to load order details</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            orderQueries.forEach((query) => query.refetch());
          }}
        >
          <Ionicons name="refresh" size={20} color={Colors.white} />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="card" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.summaryTitle}>Complete Your Payment</Text>
          <Text style={styles.summaryText}>Confirm {orderDetails.length} order(s)</Text>

          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Total Amount</Text>
            <Text style={styles.amountValue}>{formatPrice(totalAmount)}</Text>
          </View>

          {orderDetails.length > 1 && (
            <View style={styles.multiStoreIndicator}>
              <Ionicons name="storefront" size={16} color={Colors.warning} />
              <Text style={styles.multiStoreText}>
                Payment for {orderDetails.length} orders from different stores
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email Address</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={Colors.gray400} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={Colors.gray400}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <Text style={styles.inputHint}>Payment receipt will be sent to this email</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {orderDetails.map((order, index) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderTitle}>Order #{index + 1}</Text>
                <Text style={styles.orderAmount}>
                  {formatPrice(order.buyerTotalAmount)}
                </Text>
              </View>

              <View style={styles.orderDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="storefront-outline" size={16} color={Colors.gray600} />
                  <Text style={styles.detailText}>{order.store?.name || 'Store'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="cube-outline" size={16} color={Colors.gray600} />
                  <Text style={styles.detailText}>{order.items?.length || 0} item(s)</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Breakdown</Text>
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Subtotal</Text>
              <Text style={styles.breakdownValue}>
                {formatPrice(
                  orderDetails.reduce((sum, o) => sum + Number(o.breakdown?.subtotal ?? o.totalAmount ?? 0), 0)
                )}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Delivery Fee</Text>
              <Text style={styles.breakdownValue}>
                {formatPrice(
                  orderDetails.reduce((sum, o) => sum + Number(o.breakdown?.deliveryFee ?? 0), 0)
                )}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Platform Fee (3%)</Text>
              <Text style={styles.breakdownValue}>
                {formatPrice(
                  orderDetails.reduce(
                    (sum, o) => sum + Number(o.breakdown?.platformFee ?? 0),
                    0
                  )
                )}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Paystack Fee (1.95%)</Text>
              <Text style={styles.breakdownValue}>
                {formatPrice(
                  orderDetails.reduce(
                    (sum, o) => sum + Number(o.breakdown?.paystackFee ?? 0),
                    0
                  )
                )}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.payButton, paymentLoading && styles.payButtonDisabled]}
          onPress={handlePayNow}
          disabled={paymentLoading}
        >
          {paymentLoading ? (
            <LoadingSpinner size={20} color={Colors.white} />
          ) : (
            <>
              <Ionicons name="lock-closed" size={20} color={Colors.white} />
              <Text style={styles.payButtonText}>Pay {formatPrice(totalAmount)}</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.paystackBadge}>Powered by Paystack</Text>
      </View>

      {authUrl && (
        <View style={styles.webviewContainer}>
          <View style={styles.webviewHeader}>
            <View>
              <Text style={styles.webviewHeaderTitle}>Complete Payment</Text>
              <Text style={styles.webviewHeaderAmount}>{formatPrice(totalAmount)}</Text>
            </View>
            <TouchableOpacity
              style={styles.webviewClose}
              onPress={() => {
                setAuthUrl(null);
                setSessionReference(null);
                setIsVerifying(false);
                Alert.alert(
                  'Payment Cancelled',
                  'Your payment was cancelled. Would you like to try again?',
                  [
                    { text: 'No', style: 'cancel' },
                    { text: 'Yes', onPress: () => handlePayNow() },
                  ]
                );
              }}
            >
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: authUrl }}
            onNavigationStateChange={handleWebViewNavigationStateChange}
            onMessage={handleWebViewMessage}
            injectedJavaScript={injectedJavaScript}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webviewLoadingContainer}>
                <LoadingSpinner size={40} color={Colors.primary} />
                <Text style={styles.loadingText}>Loading payment page...</Text>
              </View>
            )}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            sharedCookiesEnabled={true}
            style={styles.webview}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('❌ WebView error:', nativeEvent);
              Alert.alert('Error', 'Failed to load payment page. Please try again.');
              setAuthUrl(null);
              setIsVerifying(false);
            }}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#fff',
    marginTop: 16,
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  amountContainer: {
    width: '100%',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#007AFF',
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
    color: '#333',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    marginLeft: 4,
  },
  orderCard: {
    backgroundColor: '#fff',
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
    borderBottomColor: '#e0e0e0',
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
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
    color: '#666',
  },
  breakdownCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#666',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  bottomSpacer: {
    height: 120,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  payButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    minHeight: 52,
  },
  payButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  paystackBadge: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  webviewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 999,
  },
  webviewHeader: {
    height: 88,
    paddingTop: 36,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  webviewHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  webviewHeaderAmount: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '700',
    marginTop: 4,
  },
  webviewClose: {
    padding: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webviewLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
});

export default PaymentScreen;