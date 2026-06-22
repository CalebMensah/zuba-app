import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import type { OrderWithBreakdown } from '../../types/order';
import { usePayment } from '../../hooks/usePayment';
import { orderAPI } from '../../services/orderApi';
import { orderKeys } from '../../hooks/useOrder';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Colors } from '../../constants/colors';

// ─── Design tokens ─────────────────────────────────────────────────────────
const D = {
  navy: '#0F172A',
  navyMid: '#1E293B',
  blue: '#3B82F6',
  blueDark: '#2563EB',
  blueLight: '#EFF6FF',
  green: '#10B981',
  greenLight: '#ECFDF5',
  slate: '#64748B',
  border: '#E2E8F0',
  bg: '#F0F4FF',
  surface: '#FFFFFF',
  radius: { card: 20, btn: 14, pill: 100, input: 14 },
  shadow: {
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
};

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

  const orders: PaymentOrder[] =
    (ordersParam && Array.isArray(ordersParam) ? ordersParam : []).length > 0
      ? (ordersParam as PaymentOrder[])
      : orderId
      ? [{ orderId: String(orderId), storeName: '', checkoutSession: '' }]
      : [];

  const { createCheckoutSession, verifyPayment, loading: paymentLoading } = usePayment();
  const { user } = useAuth();

  const [email, setEmail] = useState(emailParam || '');
  const [emailFocused, setEmailFocused] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [sessionReference, setSessionReference] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);

  const orderQueries = useQueries({
    queries: orders.map((order) => ({
      queryKey: orderKeys.detail(order.orderId),
      queryFn: () => orderAPI.getOrderById(order.orderId),
      enabled: !!order.orderId,
      staleTime: 60000,
    })),
  }) as UseQueryResult<OrderWithBreakdown>[];

  const isLoadingOrders = orderQueries.some((q) => q.isLoading);
  const hasErrors = orderQueries.some((q) => q.error);
  const orderDetails = orderQueries
    .map((q) => q.data)
    .filter((o): o is OrderWithBreakdown => Boolean(o));

  const checkAuthentication = async (): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem('token');
      const user = await AsyncStorage.getItem('user');
      if (!token || !user || !token.startsWith('eyJ')) return false;
      setIsAuthenticated(true);
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => { initializeScreen(); }, []);

  const initializeScreen = async () => {
    try {
      const authenticated = await checkAuthentication();
      if (!authenticated) {
        Alert.alert('Authentication Required', 'Please log in to continue.', [
          { text: 'Cancel', onPress: () => navigation.goBack() },
          { text: 'Log In', onPress: () => navigation.navigate('Login') },
        ]);
        return;
      }
      if (!orders || orders.length === 0) {
        Alert.alert('Error', 'No orders found', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch {
      Alert.alert('Error', 'Failed to initialize payment screen');
      navigation.goBack();
    }
  };

  useEffect(() => {
    if (orderDetails.length > 0 && !email) {
      setEmail(orderDetails[0].buyer?.email || user?.email || emailParam || '');
    }
  }, [orderDetails, user?.email, emailParam]);

  const totalAmount =
    totalAmountParam ??
    (paymentAmount > 0
      ? paymentAmount
      : orderDetails.reduce((sum, o) => sum + (o.buyerTotalAmount ?? o.breakdown?.buyerTotal ?? o.totalAmount ?? 0), 0));

  const formatPrice = (price: number) => `GH₵ ${parseFloat(price.toString()).toFixed(2)}`;

  const handlePayNow = async () => {
    try {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
        return;
      }
      if (totalAmount <= 0) {
        Alert.alert('Invalid Amount', 'Cannot process a zero amount.');
        return;
      }
      if (!orders || orders.length === 0) {
        Alert.alert('Error', 'No orders found for payment.');
        return;
      }

      let paymentReference = '';
      let resolvedAmount = 0;
      let authorizationUrl = '';

      if (paymentSession && reference) {
        paymentReference = reference;
        resolvedAmount = totalAmount;
        authorizationUrl = paymentSession.authorizationUrl;
      } else {
        try {
          const response = await createCheckoutSession({ orderIds: orders.map((o) => o.orderId), email: email.trim() });
          if (response?.data) {
            paymentReference = response.data.reference;
            setPaymentAmount(response.data.totalAmount);
            resolvedAmount = response.data.totalAmount;
            authorizationUrl = response.data.authorizationUrl;
            if (!totalAmountParam) orderQueries.forEach((q) => q.refetch());
          } else {
            Alert.alert('Error', 'Failed to initiate payment. Please try again.');
            return;
          }
        } catch (e: any) {
          const msg: string = e?.message || '';
          if (msg.includes('Invalid orders') || msg.includes('pending payments')) {
            Alert.alert('Payment Not Available', 'This order has already been processed or has a pending payment.');
            return;
          }
          throw e;
        }
      }

      if (!resolvedAmount || resolvedAmount <= 0 || !paymentReference || !authorizationUrl) {
        Alert.alert('Error', 'Invalid payment details. Please try again.');
        return;
      }

      setSessionReference(paymentReference);
      setAuthUrl(authorizationUrl);
    } catch (error: any) {
      let msg = 'Failed to initiate payment. Please try again.';
      if (error.message?.includes('Authentication required')) msg = 'Please log in again.';
      else if (error.message?.includes('Too many payment attempts')) msg = 'Too many attempts. Wait a few minutes.';
      else if (error.message?.includes('Network error')) msg = 'Check your internet connection.';
      else if (error.message) msg = error.message;
      Alert.alert('Payment Error', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: handlePayNow },
      ]);
    }
  };

  const handleWebViewNavigationStateChange = async (navState: any) => {
    const { url } = navState as { url?: string };
    if (!url || isVerifying) return;
    const isSuccess = url.includes('/paystack/pay/complete/') || url.includes('status=success') || url.includes('&trxref=') || url.includes('#success') || url.includes('payment-success');
    const isCancel = url.includes('/paystack/pay/cancel/') || url.includes('status=cancelled') || url.includes('cancel');
    if ((isSuccess || isCancel) && !isVerifying && sessionReference) {
      setIsVerifying(true);
      const ref = sessionReference;
      setAuthUrl(null);
      setSessionReference(null);
      try {
        await new Promise((r) => setTimeout(r, 1500));
        const verification = await verifyPayment(ref);
        if (verification?.success) {
          Alert.alert('Payment Successful!', 'Your payment has been verified.', [{ text: 'View Orders', onPress: () => navigation.replace('Orders') }]);
        } else {
          setIsVerifying(false);
          Alert.alert('Payment Pending', 'Check your Orders tab for status.', [{ text: 'Go to Orders', onPress: () => navigation.replace('Orders') }]);
        }
      } catch {
        setIsVerifying(false);
        Alert.alert('Verification Issue', 'Check your Orders tab for payment status.', [{ text: 'Go to Orders', onPress: () => navigation.replace('Orders') }]);
      }
    }
  };

  const injectedJavaScript = `
    (function() {
      let currentUrl = window.location.href;
      setInterval(() => {
        if (window.location.href !== currentUrl) {
          currentUrl = window.location.href;
        }
      }, 1000);
    })();
  `;

  const handleWebViewMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'PAYMENT_SUCCESS' && !isVerifying && sessionReference) {
        setIsVerifying(true);
        const ref = sessionReference;
        setAuthUrl(null);
        await new Promise((r) => setTimeout(r, 1000));
        const verification = await verifyPayment(ref);
        if (verification?.success) {
          Alert.alert('Success!', 'Payment verified.', [{ text: 'OK', onPress: () => navigation.replace('BuyerOrders') }]);
        }
      } else if (message.type === 'PAYMENT_CANCEL') {
        Alert.alert('Payment Cancelled', 'You can try again anytime.', [{ text: 'OK', onPress: () => setAuthUrl(null) }]);
      }
    } catch {}
  };

  // ─── Loading / Error states ────────────────────────────────────────────────
  if (isLoadingOrders && orderDetails.length === 0) {
    return (
      <LinearGradient colors={[D.navy, D.navyMid]} style={styles.centeredScreen}>
        <LoadingSpinner size={40} color="#FFFFFF" />
        <Text style={styles.centeredText}>Loading payment details…</Text>
      </LinearGradient>
    );
  }

  if (hasErrors && orderDetails.length === 0) {
    return (
      <LinearGradient colors={[D.navy, D.navyMid]} style={styles.centeredScreen}>
        <Ionicons name="cloud-offline-outline" size={56} color="#94A3B8" />
        <Text style={[styles.centeredText, { color: '#F87171', marginBottom: 8 }]}>Couldn't load order details</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => orderQueries.forEach((q) => q.refetch())}>
          <Ionicons name="refresh" size={18} color={D.navy} />
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const subtotal = orderDetails.reduce((s, o) => s + Number(o.breakdown?.subtotal ?? o.totalAmount ?? 0), 0);
  const deliveryFee = orderDetails.reduce((s, o) => s + Number(o.breakdown?.deliveryFee ?? 0), 0);
  const platformFee = orderDetails.reduce((s, o) => s + Number(o.breakdown?.platformFee ?? 0), 0);
  const paystackFee = orderDetails.reduce((s, o) => s + Number(o.breakdown?.paystackFee ?? 0), 0);

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <LinearGradient colors={[D.navy, D.navyMid]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Checkout</Text>
          <Text style={styles.headerSub}>{orderDetails.length} order{orderDetails.length !== 1 ? 's' : ''} · {formatPrice(totalAmount)}</Text>
        </View>
        <View style={{ width: 38 }} />
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Hero amount card ── */}
        <View style={[styles.heroCard, D.shadow]}>
          <View style={styles.heroIconWrap}>
            <LinearGradient colors={[D.blue, D.blueDark]} style={styles.heroIcon}>
              <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={styles.heroLabel}>Amount Due</Text>
          <Text style={styles.heroAmount}>{formatPrice(totalAmount)}</Text>
          <View style={styles.heroBadge}>
            <Ionicons name="lock-closed" size={11} color={D.green} />
            <Text style={styles.heroBadgeText}>Secured by Paystack</Text>
          </View>
          {orderDetails.length > 1 && (
            <View style={styles.multiStoreBanner}>
              <Ionicons name="storefront-outline" size={14} color="#D97706" />
              <Text style={styles.multiStoreText}>
                Paying for {orderDetails.length} orders from different stores
              </Text>
            </View>
          )}
        </View>

        {/* ── Email ── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionLabel}>Receipt Email</Text>
          <View style={[styles.inputRow, emailFocused && styles.inputRowFocused]}>
            <Ionicons name="mail-outline" size={18} color={emailFocused ? D.blue : D.slate} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              placeholder="your@email.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {email.includes('@') && (
              <Ionicons name="checkmark-circle" size={18} color={D.green} />
            )}
          </View>
          <Text style={styles.inputHint}>Your receipt will be sent to this address</Text>
        </View>

        {/* ── Orders ── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionLabel}>Order Summary</Text>
          <View style={[styles.card, D.shadow]}>
            {orderDetails.map((order, idx) => (
              <View key={order.id}>
                {idx > 0 && <View style={styles.innerDivider} />}
                <View style={styles.orderRow}>
                  <View style={styles.orderIconWrap}>
                    <Ionicons name="cube-outline" size={18} color={D.blue} />
                  </View>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderTitle}>{order.store?.name || `Order ${idx + 1}`}</Text>
                    <Text style={styles.orderMeta}>{order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={styles.orderAmt}>{formatPrice(order.buyerTotalAmount)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Breakdown ── */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionLabel}>Payment Breakdown</Text>
          <View style={[styles.card, D.shadow]}>
            {[
              { label: 'Subtotal', value: subtotal },
              { label: 'Delivery Fee', value: deliveryFee },
              { label: 'Platform Fee (3%)', value: platformFee },
              { label: 'Paystack Fee (1.95%)', value: paystackFee },
            ].map(({ label, value }) => (
              <View key={label} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{label}</Text>
                <Text style={styles.breakdownValue}>{formatPrice(value)}</Text>
              </View>
            ))}
            <View style={styles.totalDivider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
            </View>
          </View>
        </View>

        {/* ── Security note ── */}
        <View style={styles.securityRow}>
          <Ionicons name="lock-closed-outline" size={13} color={D.slate} />
          <Text style={styles.securityText}>Your payment is encrypted and secure</Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Pay Button ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.payBtn, paymentLoading && styles.payBtnDisabled]}
          onPress={handlePayNow}
          disabled={paymentLoading}
          activeOpacity={0.85}
        >
          {paymentLoading ? (
            <LoadingSpinner size={20} color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
              <Text style={styles.payBtnText}>Pay {formatPrice(totalAmount)}</Text>
              <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.poweredBy}>Powered by Paystack</Text>
      </View>

      {/* ── WebView overlay ── */}
      {authUrl && (
        <View style={styles.webviewOverlay}>
          <LinearGradient colors={[D.navy, D.navyMid]} style={styles.webviewHeader}>
            <View>
              <Text style={styles.webviewTitle}>Complete Payment</Text>
              <Text style={styles.webviewAmt}>{formatPrice(totalAmount)}</Text>
            </View>
            <TouchableOpacity
              style={styles.webviewCloseBtn}
              onPress={() => {
                setAuthUrl(null);
                setSessionReference(null);
                setIsVerifying(false);
                Alert.alert('Payment Cancelled', 'Would you like to try again?', [
                  { text: 'Not Now', style: 'cancel' },
                  { text: 'Retry', onPress: handlePayNow },
                ]);
              }}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>
          <WebView
            source={{ uri: authUrl }}
            onNavigationStateChange={handleWebViewNavigationStateChange}
            onMessage={handleWebViewMessage}
            injectedJavaScript={injectedJavaScript}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webviewLoading}>
                <LoadingSpinner size={36} color={D.blue} />
                <Text style={styles.webviewLoadingText}>Loading secure payment…</Text>
              </View>
            )}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            style={{ flex: 1, backgroundColor: '#fff' }}
            onError={() => {
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
  root: { flex: 1, backgroundColor: D.bg },

  // ─── Centered screens (loading/error) ─────────────────────────────────────
  centeredScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  centeredText: { fontSize: 15, color: '#94A3B8', fontWeight: '500' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: D.radius.btn, marginTop: 8,
  },
  retryBtnText: { fontSize: 15, fontWeight: '700', color: D.navy },

  // ─── Header ───────────────────────────────────────────────────────────────
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  // ─── Scroll ───────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // ─── Hero card ────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: D.surface, borderRadius: D.radius.card,
    padding: 28, alignItems: 'center', marginBottom: 16,
  },
  heroIconWrap: { marginBottom: 16 },
  heroIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  heroLabel: { fontSize: 13, color: D.slate, fontWeight: '500', marginBottom: 6 },
  heroAmount: { fontSize: 38, fontWeight: '800', color: D.navy, letterSpacing: -1, marginBottom: 12 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: D.greenLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '700', color: D.green },
  multiStoreBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 14,
  },
  multiStoreText: { fontSize: 12, color: '#D97706', fontWeight: '500', flex: 1 },

  // ─── Section ──────────────────────────────────────────────────────────────
  sectionWrap: { marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: D.slate, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },

  // ─── Input ────────────────────────────────────────────────────────────────
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: D.surface, borderRadius: D.radius.input,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: D.border,
  },
  inputRowFocused: { borderColor: D.blue, backgroundColor: D.blueLight },
  input: { flex: 1, fontSize: 15, color: D.navy, fontWeight: '500' },
  inputHint: { fontSize: 11, color: '#94A3B8', marginTop: 6, marginLeft: 2 },

  // ─── Card ─────────────────────────────────────────────────────────────────
  card: { backgroundColor: D.surface, borderRadius: D.radius.card, overflow: 'hidden' },
  innerDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },

  // ─── Order row ────────────────────────────────────────────────────────────
  orderRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  orderIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: D.blueLight, alignItems: 'center', justifyContent: 'center',
  },
  orderInfo: { flex: 1 },
  orderTitle: { fontSize: 14, fontWeight: '700', color: D.navy },
  orderMeta: { fontSize: 12, color: D.slate, marginTop: 2 },
  orderAmt: { fontSize: 15, fontWeight: '800', color: D.blue },

  // ─── Breakdown ────────────────────────────────────────────────────────────
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  breakdownLabel: { fontSize: 14, color: D.slate },
  breakdownValue: { fontSize: 14, fontWeight: '600', color: D.navy },
  totalDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: D.navy },
  totalValue: { fontSize: 18, fontWeight: '800', color: D.blue },

  // ─── Security note ────────────────────────────────────────────────────────
  securityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 4 },
  securityText: { fontSize: 12, color: '#94A3B8' },

  // ─── Bottom bar ───────────────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: D.surface,
    paddingHorizontal: 16, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 1, borderTopColor: D.border,
    shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 12,
  },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: D.radius.btn,
    backgroundColor: D.blue,
    shadowColor: D.blue, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  payBtnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0, elevation: 0 },
  payBtnText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  poweredBy: { textAlign: 'center', fontSize: 11, color: '#94A3B8', marginTop: 8 },

  // ─── WebView overlay ──────────────────────────────────────────────────────
  webviewOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', zIndex: 999 },
  webviewHeader: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  webviewTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  webviewAmt: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  webviewCloseBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  webviewLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  webviewLoadingText: { fontSize: 14, color: D.slate },
});

export default PaymentScreen;