import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../../constants/colors';
import { useBuyerOrders, useCancelOrder, formatCurrency } from '../../hooks/useOrder';
import { Order, OrderItem, OrderStatus } from '../../types/order';
import { useEscrow } from '../../hooks/useEscrow';
import { BuyerStackParamList } from '../../types/navigation';

interface StatusTab {
  status: OrderStatus;
  label: string;
  icon: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const D = {
  bg: '#F0F4FF',
  surface: '#FFFFFF',
  navy: '#0F172A',
  navyMid: '#1E293B',
  blue: '#3B82F6',
  blueDark: '#2563EB',
  blueLight: '#EFF6FF',
  radius: {
    card: 20,
    pill: 100,
    btn: 14,
    badge: 8,
  },
  shadow: {
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
};

const STATUS_CONFIG: Record<OrderStatus, { color: string; bg: string; accent: string; icon: string; label: string }> = {
  PENDING_PAYMENT: { color: '#DC2626', bg: '#FEF2F2', accent: '#FCA5A5', icon: 'time-outline', label: 'Awaiting Payment' },
  PAID:            { color: '#0369A1', bg: '#F0F9FF', accent: '#7DD3FC', icon: 'checkmark-circle-outline', label: 'Paid' },
  PROCESSING:      { color: '#7C3AED', bg: '#F5F3FF', accent: '#C4B5FD', icon: 'sync-outline', label: 'Processing' },
  SHIPPED:         { color: '#0891B2', bg: '#ECFEFF', accent: '#67E8F9', icon: 'airplane-outline', label: 'Shipped' },
  COMPLETED:       { color: '#059669', bg: '#F0FDF4', accent: '#6EE7B7', icon: 'checkmark-done-circle-outline', label: 'Completed' },
  DISPUTED:        { color: '#D97706', bg: '#FFFBEB', accent: '#FCD34D', icon: 'alert-circle-outline', label: 'Disputed' },
  CANCELLED:       { color: '#6B7280', bg: '#F9FAFB', accent: '#D1D5DB', icon: 'close-circle-outline', label: 'Cancelled' },
  REFUNDED:        { color: '#DB2777', bg: '#FDF2F8', accent: '#F9A8D4', icon: 'return-down-back-outline', label: 'Refunded' },
};

const BuyerOrderManagement = () => {
  const navigation = useNavigation<NavigationProp<BuyerStackParamList>>();
  const [activeTab, setActiveTab] = useState<OrderStatus>('PENDING_PAYMENT');
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  const { data: ordersData, isLoading, error, refetch } = useBuyerOrders({
    status: activeTab,
    limit: 50,
    page: 1,
  });
  const cancelOrder = useCancelOrder();
  const { loading: escrowLoading, confirmOrderReceived } = useEscrow();

  const orders = React.useMemo(() => {
    if (!ordersData?.orders) return [];
    return ordersData.orders.filter((order: Order) => {
      if (order.status === 'COMPLETED') {
        const completedDate = new Date(order.updatedAt || order.createdAt);
        const daysSinceCompleted = Math.floor(
          (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceCompleted < 7;
      }
      return true;
    });
  }, [ordersData?.orders]);

  const statusTabs: StatusTab[] = [
    { status: 'PENDING_PAYMENT', label: 'Unpaid',     icon: 'time-outline' },
    { status: 'PAID',            label: 'Paid',       icon: 'checkmark-circle-outline' },
    { status: 'PROCESSING',      label: 'Processing', icon: 'sync-outline' },
    { status: 'SHIPPED',         label: 'Shipped',    icon: 'airplane-outline' },
    { status: 'COMPLETED',       label: 'Completed',  icon: 'checkmark-done-circle-outline' },
    { status: 'DISPUTED',        label: 'Disputed',   icon: 'alert-circle-outline' },
    { status: 'CANCELLED',       label: 'Cancelled',  icon: 'close-circle-outline' },
    { status: 'REFUNDED',        label: 'Refunded',   icon: 'return-down-back-outline' },
  ];

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));
  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const handleOrderPress    = (order: Order) => navigation.navigate('OrderDetails', { orderId: order.id });
  const handleTabPress      = (status: OrderStatus) => setActiveTab(status);

  const handleCancelOrder = (orderId: string, orderNumber: string) => {
    Alert.alert('Cancel Order', `Cancel order #${orderNumber}?`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel Order', style: 'destructive',
        onPress: () => {
          setProcessingOrderId(orderId);
          cancelOrder.mutate(
            { orderId, reason: 'Cancelled by buyer' },
            {
              onSuccess: () => {
                Alert.alert('Done', 'Order cancelled.');
                setProcessingOrderId(null);
                refetch();
              },
              onError: (err) => {
                Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel order');
                setProcessingOrderId(null);
              },
            }
          );
        },
      },
    ]);
  };

  const handlePayNow = (order: Order) => {
    const paymentAny = order.payment as any;
    const paymentRef = paymentAny?.[0]?.gatewayRef || paymentAny?.gatewayRef;
    const authorizationUrl = paymentAny?.[0]?.metadata?.authorizationUrl || paymentAny?.metadata?.authorizationUrl;
    (navigation as any).navigate('Payment', {
      orders: [{ orderId: order.id, storeName: order.store?.name || 'Store', amount: undefined, checkoutSession: order.checkoutSession || order.id }],
      totalOrders: 1,
      reference: paymentRef,
      paymentSession: authorizationUrl ? { authorizationUrl } : undefined,
    });
  };

  const handleViewDeliveryDetails = (order: Order) => {
    (navigation as any).navigate('DeliveryDetails', { orderId: order.id });
  };

  const handleConfirmReceived = async (orderId: string, orderNumber: string) => {
    Alert.alert('Confirm Receipt', `Received order #${orderNumber}? Payment releases to seller.`, [
      { text: 'Not Yet', style: 'cancel' },
      {
        text: 'Yes, Confirm',
        onPress: async () => {
          setProcessingOrderId(orderId);
          const success = await confirmOrderReceived(orderId);
          setProcessingOrderId(null);
          if (success) {
            Alert.alert('Done', 'Payment released to seller.');
            refetch();
          } else {
            Alert.alert('Error', 'Please try again.');
          }
        },
      },
    ]);
  };

  const handleAddReview = (productId: string, productName: string, orderId: string, productImage: string) => {
    navigation.navigate('ManageReview', { orderId, productId, productName, productImage });
  };

  const handleOpenDispute = (orderId: string) => {
    Alert.alert('Open Dispute', 'Open a dispute for this order?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', onPress: () => (navigation as any).navigate('CreateDispute', { orderId }) },
    ]);
  };

  // ─── Order Card ─────────────────────────────────────────────────────────────
  const renderOrderItem = ({ item }: { item: Order }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG['CANCELLED'];
    const firstItem = item.items?.[0];
    const firstImage = firstItem?.product?.images?.[0] || 'https://via.placeholder.com/100';
    const productName = firstItem?.product?.name || firstItem?.productName || firstItem?.name || 'Product';
    const isProcessing = processingOrderId === item.id;
    const hasDeliveryInfo = !!item.deliveryInfo;
    const isActionLoading = isProcessing || cancelOrder.isPending;
    const orderNum = `#${item.id.slice(-8).toUpperCase()}`;

    const renderStatusBanner = () => {
      const banners: Partial<Record<OrderStatus, { msg: string; detail: string }>> = {
        PROCESSING: !hasDeliveryInfo
          ? { msg: 'Awaiting Courier Assignment', detail: 'Seller is preparing your order.' }
          : undefined,
        SHIPPED: { msg: '⚡ Auto-release in 4 days', detail: "Confirm receipt or open a dispute before funds are released." },
        COMPLETED: { msg: '✓ Order Complete', detail: 'Leave a review or open a dispute if needed.' },
        DISPUTED: { msg: '⚖ Dispute Under Review', detail: "Our team is reviewing your dispute." },
        CANCELLED: {
          msg: 'Order Cancelled',
          detail: item.cancelledBy === 'buyer' ? 'You cancelled this order.' : 'Cancelled by the seller.',
        },
        REFUNDED: {
          msg: 'Refund Processed',
          detail: item.refundAmount
            ? `${formatCurrency(item.refundAmount, item.currency)} has been refunded.`
            : 'Your refund has been processed.',
        },
      };
      const b = banners[item.status];
      if (!b) return null;
      return (
        <View style={[styles.banner, { backgroundColor: cfg.bg, borderColor: cfg.accent }]}>
          <Text style={[styles.bannerMsg, { color: cfg.color }]}>{b.msg}</Text>
          <Text style={[styles.bannerDetail, { color: cfg.color }]}>{b.detail}</Text>
        </View>
      );
    };

    return (
      <View style={[styles.card, D.shadow]}>
        {/* Accent stripe */}
        <View style={[styles.cardStripe, { backgroundColor: cfg.color }]} />

        {/* Tappable body */}
        <TouchableOpacity style={styles.cardBody} onPress={() => handleOrderPress(item)} activeOpacity={0.8}>
          {/* Top row */}
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.orderNum}>{orderNum}</Text>
              <Text style={styles.orderDate}>
                {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
              <Text style={[styles.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          {/* Store */}
          <View style={styles.storeRow}>
            <View style={styles.storeAvatar}>
              <Ionicons name="storefront" size={12} color={D.blue} />
            </View>
            <Text style={styles.storeName}>{item.store?.name || 'Store'}</Text>
            <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Product row */}
          <View style={styles.productRow}>
            <Image source={{ uri: firstImage }} style={styles.productImg} />
            <View style={styles.productMeta}>
              <Text style={styles.productName} numberOfLines={2}>{productName}</Text>
              {item.items.length > 1 && (
                <View style={styles.moreBadge}>
                  <Text style={styles.moreText}>+{item.items.length - 1} item{item.items.length > 2 ? 's' : ''}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Status banner */}
          {renderStatusBanner()}

          {/* Amount */}
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={styles.amountValue}>{formatCurrency(item.totalAmount, item.currency)}</Text>
          </View>
        </TouchableOpacity>

        {/* Action Zone */}
        {(item.status === 'PENDING_PAYMENT' || item.status === 'PROCESSING' ||
          item.status === 'SHIPPED' || item.status === 'COMPLETED') && (
          <View style={[styles.actionZone, { borderTopColor: cfg.bg }]}>

            {item.status === 'PENDING_PAYMENT' && (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.btnPrimary, { backgroundColor: '#10B981' }, isActionLoading && styles.btnDisabled]}
                  onPress={() => handlePayNow(item)}
                  disabled={isActionLoading}
                >
                  <Ionicons name="card" size={16} color="#fff" />
                  <Text style={styles.btnPrimaryText}>Pay Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnOutline, { borderColor: '#FCA5A5' }, isActionLoading && styles.btnDisabled]}
                  onPress={() => handleCancelOrder(item.id, orderNum)}
                  disabled={isActionLoading}
                >
                  {isProcessing && cancelOrder.isPending
                    ? <ActivityIndicator size="small" color="#DC2626" />
                    : <Text style={[styles.btnOutlineText, { color: '#DC2626' }]}>Cancel</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {item.status === 'PROCESSING' && (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.btnOutline, { borderColor: '#FCA5A5', flex: 1 }, isActionLoading && styles.btnDisabled]}
                  onPress={() => handleOpenDispute(item.id)}
                  disabled={isActionLoading}
                >
                  <MaterialIcons name="gavel" size={15} color="#DC2626" />
                  <Text style={[styles.btnOutlineText, { color: '#DC2626' }]}>Dispute</Text>
                </TouchableOpacity>
                {hasDeliveryInfo && (
                  <TouchableOpacity
                    style={[styles.btnPrimary, { backgroundColor: D.blue, flex: 1.4 }]}
                    onPress={() => handleViewDeliveryDetails(item)}
                  >
                    <MaterialIcons name="local-shipping" size={15} color="#fff" />
                    <Text style={styles.btnPrimaryText}>Track Order</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {item.status === 'SHIPPED' && (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.btnPrimary, { backgroundColor: '#059669', flex: 1.4 }, (isProcessing || escrowLoading) && styles.btnDisabled]}
                  onPress={() => handleConfirmReceived(item.id, orderNum)}
                  disabled={isProcessing || escrowLoading}
                >
                  {isProcessing || escrowLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <>
                        <Ionicons name="checkmark-circle" size={16} color="#fff" />
                        <Text style={styles.btnPrimaryText}>Confirm Received</Text>
                      </>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnOutline, { borderColor: '#BAE6FD', flex: 1 }]}
                  onPress={() => handleViewDeliveryDetails(item)}
                >
                  <MaterialIcons name="local-shipping" size={15} color={D.blue} />
                  <Text style={[styles.btnOutlineText, { color: D.blue }]}>Track</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.status === 'COMPLETED' && (
              <>
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.btnOutline, { borderColor: '#BAE6FD', flex: 1 }]}
                    onPress={() => handleViewDeliveryDetails(item)}
                  >
                    <MaterialIcons name="local-shipping" size={15} color={D.blue} />
                    <Text style={[styles.btnOutlineText, { color: D.blue }]}>Track</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnOutline, { borderColor: '#FCA5A5', flex: 1 }]}
                    onPress={() => handleOpenDispute(item.id)}
                  >
                    <MaterialIcons name="gavel" size={15} color="#DC2626" />
                    <Text style={[styles.btnOutlineText, { color: '#DC2626' }]}>Dispute</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.reviewPanel}>
                  <View style={styles.reviewPanelHeader}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.reviewPanelTitle}>Rate your purchase</Text>
                  </View>
                  {item.items.map((oi: OrderItem, idx: number) => {
                    const img = oi.product?.images?.[0] || 'https://via.placeholder.com/100';
                    const name = oi.product?.name || oi.productName || oi.name || 'Product';
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.reviewItem}
                        onPress={() => handleAddReview(oi.product?.id || oi.productId || '', name, item.id, img)}
                      >
                        <Image source={{ uri: img }} style={styles.reviewImg} />
                        <Text style={styles.reviewName} numberOfLines={1}>{name}</Text>
                        <View style={styles.reviewCta}>
                          <Ionicons name="star-outline" size={12} color="#F59E0B" />
                          <Text style={styles.reviewCtaText}>Review</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIcon, { backgroundColor: STATUS_CONFIG[activeTab]?.bg || D.blueLight }]}>
        <Ionicons name={STATUS_CONFIG[activeTab]?.icon as any || 'cube-outline'} size={36} color={STATUS_CONFIG[activeTab]?.color || D.blue} />
      </View>
      <Text style={styles.emptyTitle}>No {activeTab.replace('_', ' ').toLowerCase()} orders</Text>
      <Text style={styles.emptyDesc}>
        {activeTab === 'PENDING_PAYMENT'
          ? 'Orders awaiting payment will appear here.'
          : `Your ${activeTab.replace('_', ' ').toLowerCase()} orders will show up here.`}
      </Text>
    </View>
  );

  const total = ordersData?.pagination?.total || 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Header ── */}
      <LinearGradient colors={[D.navy, D.navyMid]} style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSub}>Track and manage your purchases</Text>
      </LinearGradient>

      {/* ── Tab Strip ── */}
      <View style={styles.tabStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
          {statusTabs.map((t) => {
            const active = activeTab === t.status;
            const cfg = STATUS_CONFIG[t.status];
            return (
              <TouchableOpacity
                key={t.status}
                style={[styles.tab, active && { backgroundColor: cfg.color }]}
                onPress={() => handleTabPress(t.status)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={t.icon as any}
                  size={13}
                  color={active ? '#fff' : Colors.textSecondary}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
                {active && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{total}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Body ── */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={D.blue} />
          <Text style={styles.loadingText}>Loading orders…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorWrap}>
          <Ionicons name="cloud-offline-outline" size={56} color="#CBD5E1" />
          <Text style={styles.errorTitle}>Couldn't load orders</Text>
          <Text style={styles.errorDesc}>{error instanceof Error ? error.message : 'Something went wrong.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} colors={[D.blue]} tintColor={D.blue} />}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: D.bg,
  },

  // ─── Header ───────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '400',
  },

  // ─── Tabs ─────────────────────────────────────────────────────────────────
  tabStrip: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#F8FAFC',
    borderRadius: 100,
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  tabBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 100,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ─── List ─────────────────────────────────────────────────────────────────
  list: {
    padding: 16,
    paddingBottom: 48,
    gap: 16,
  },

  // ─── Card ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: D.surface,
    borderRadius: D.radius.card,
    overflow: 'hidden',
  },
  cardStripe: {
    height: 4,
  },
  cardBody: {
    padding: 18,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNum: {
    fontSize: 17,
    fontWeight: '800',
    color: D.navy,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    gap: 5,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  storeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: D.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 14,
  },
  productRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  productImg: {
    width: 76,
    height: 76,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  productMeta: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: D.navy,
    lineHeight: 21,
  },
  moreBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  moreText: {
    fontSize: 11,
    color: D.blue,
    fontWeight: '600',
  },
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  bannerMsg: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerDetail: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    opacity: 0.8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  amountLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '800',
    color: D.blue,
    letterSpacing: -0.5,
  },

  // ─── Action Zone ──────────────────────────────────────────────────────────
  actionZone: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: D.radius.btn,
    gap: 7,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: D.radius.btn,
    borderWidth: 1.5,
    gap: 6,
    backgroundColor: '#FAFAFA',
  },
  btnOutlineText: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },

  // ─── Review Panel ─────────────────────────────────────────────────────────
  reviewPanel: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  reviewPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  reviewPanelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  reviewImg: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  reviewName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: D.navy,
  },
  reviewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reviewCtaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },

  // ─── Empty / Loading / Error ──────────────────────────────────────────────
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: D.navy,
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  emptyDesc: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 21,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: '#94A3B8',
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: D.navy,
    marginTop: 12,
  },
  errorDesc: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: D.blue,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default BuyerOrderManagement;