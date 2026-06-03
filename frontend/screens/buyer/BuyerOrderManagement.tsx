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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography } from '../../constants/colors';
import { useBuyerOrders, useCancelOrder, formatCurrency } from '../../hooks/useOrder';
import { Order, OrderItem, OrderStatus } from '../../types/order';
import { useEscrow } from '../../hooks/useEscrow';
import { BuyerStackParamList } from '../../types/navigation';

interface StatusTab {
  status: OrderStatus;
  label: string;
}

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

  // Filter out COMPLETED orders older than 7 days
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
    { status: 'PENDING_PAYMENT', label: 'Unpaid' },
    { status: 'PAID',            label: 'Paid' },
    { status: 'PROCESSING',      label: 'Processing' },
    { status: 'SHIPPED',         label: 'Shipped' },
    { status: 'COMPLETED',       label: 'Completed' },
    { status: 'DISPUTED',        label: 'Disputed' },
    { status: 'CANCELLED',       label: 'Cancelled' },
    { status: 'REFUNDED',        label: 'Refunded' },
  ];

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleTabPress = (status: OrderStatus) => setActiveTab(status);

  const handleOrderPress = (order: Order) => {
    navigation.navigate('OrderDetails', { orderId: order.id });
  };

  const handleCancelOrder = (orderId: string, orderNumber: string) => {
    Alert.alert(
      'Cancel Order',
      `Are you sure you want to cancel order #${orderNumber}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            setProcessingOrderId(orderId);
            cancelOrder.mutate(
              { orderId, reason: 'Cancelled by buyer' },
              {
                onSuccess: () => {
                  Alert.alert('Success', 'Order cancelled successfully');
                  setProcessingOrderId(null);
                },
                onError: (error) => {
                  Alert.alert(
                    'Error',
                    error instanceof Error ? error.message : 'Failed to cancel order'
                  );
                  setProcessingOrderId(null);
                },
              }
            );
          },
        },
      ]
    );
  };

  const handlePayNow = (order: Order) => {
    (navigation as any).navigate('Payment', {
      orders: [
        {
          orderId: order.id,
          storeName: order.store?.name || 'Store',
          amount: order.totalAmount,
          checkoutSession: order.checkoutSession || order.id,
        },
      ],
      totalAmount: order.totalAmount,
      totalOrders: 1,
    });
  };

  const handleViewDeliveryDetails = (order: Order) => {
    (navigation as any).navigate('DeliveryDetails', { orderId: order.id });
  };

  const handleConfirmReceived = async (orderId: string, orderNumber: string) => {
    Alert.alert(
      'Confirm Receipt',
      `Have you received order #${orderNumber}? This will release payment to the seller.`,
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Yes, Confirm',
          onPress: async () => {
            setProcessingOrderId(orderId);
            const success = await confirmOrderReceived(orderId);
            setProcessingOrderId(null);

            if (success) {
              Alert.alert(
                'Success',
                'Order confirmed successfully. Payment has been released to the seller.'
              );
              refetch();
            } else {
              Alert.alert('Error', 'Failed to confirm order. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleAddReview = (
    productId: string,
    productName: string,
    orderId: string,
    productImage: string
  ) => {
    navigation.navigate('ManageReview', { orderId, productId, productName, productImage });
  };

  const handleOpenDispute = (orderId: string) => {
    Alert.alert(
      'Open Dispute',
      'Do you want to open a dispute for this order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => (navigation as any).navigate('CreateDispute', { orderId }),
        },
      ]
    );
  };

  const getStatusColor = (status: OrderStatus): string => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return '#DC2626';
      case 'PAID':
        return Colors.info;
      case 'PROCESSING':
        return Colors.primary;
      case 'SHIPPED':
        return '#7C3AED';
      case 'COMPLETED':
        return Colors.success;
      case 'DISPUTED':
        return '#F97316';
      case 'CANCELLED':
        return Colors.error;
      case 'REFUNDED':
        return '#FF9500';
      default:
        return Colors.gray400;
    }
  };

  const renderOrderItem = ({ item }: { item: Order }) => {
    const firstItem = item.items?.[0];
    const firstImage =
      firstItem?.product?.images?.[0] || 'https://via.placeholder.com/100';
    const productName =
      firstItem?.product?.name ||
      firstItem?.productName ||
      firstItem?.name ||
      'Product';
    const isProcessing = processingOrderId === item.id;
    const hasDeliveryInfo = !!item.deliveryInfo;
    const isActionLoading = isProcessing || cancelOrder.isPending;

    return (
      <View style={styles.orderCardContainer}>
        {/* Tappable order info */}
        <TouchableOpacity
          style={styles.orderInfoSection}
          onPress={() => handleOrderPress(item)}
          activeOpacity={0.7}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.orderMeta}>
              <Text style={styles.orderNumber}>
                #{item.id.slice(-8).toUpperCase()}
              </Text>
              <Text style={styles.orderDate}>
                {new Date(item.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: `${getStatusColor(item.status)}15` },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: getStatusColor(item.status) },
                ]}
              />
              <Text
                style={[
                  styles.statusLabel,
                  { color: getStatusColor(item.status) },
                ]}
              >
                {item.status?.replace('_', ' ')}
              </Text>
            </View>
          </View>

          {/* Store */}
          <View style={styles.storeInfo}>
            <Ionicons name="storefront-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.storeName}>{item.store?.name || 'Store'}</Text>
          </View>

          {/* Product */}
          <View style={styles.productSection}>
            <Image source={{ uri: firstImage }} style={styles.productImage} />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {productName}
              </Text>
              {item.items.length > 1 && (
                <View style={styles.multiItemBadge}>
                  <Text style={styles.multiItemText}>
                    +{item.items.length - 1} more item
                    {item.items.length > 2 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Price */}
          <View style={styles.priceSection}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>
              {formatCurrency(item.totalAmount, item.currency)}
            </Text>
          </View>

          {/* Status info cards */}
          {item.status === 'PROCESSING' && !hasDeliveryInfo && (
            <View style={styles.infoCard}>
              <Ionicons name="time-outline" size={24} color="#0C5460" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Awaiting Courier Assignment</Text>
                <Text style={styles.infoText}>
                  The seller is preparing your order and will assign a courier soon.
                </Text>
              </View>
            </View>
          )}

          {item.status === 'SHIPPED' && (
            <View style={[styles.infoCard, { backgroundColor: '#FFF3CD' }]}>
              <Ionicons name="warning-outline" size={24} color="#856404" />
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: '#856404' }]}>
                  Auto-Release Notice
                </Text>
                <Text style={[styles.infoText, { color: '#856404' }]}>
                  Funds will automatically be released to the seller after 4 days
                  if you don't confirm receipt or open a dispute.
                </Text>
              </View>
            </View>
          )}

          {item.status === 'COMPLETED' && (
            <View style={[styles.infoCard, { backgroundColor: '#D4EDDA' }]}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#155724" />
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: '#155724' }]}>
                  Order Completed
                </Text>
                <Text style={[styles.infoText, { color: '#155724' }]}>
                  Thank you for your purchase! You can still open a dispute or
                  leave a review.
                </Text>
              </View>
            </View>
          )}

          {item.status === 'DISPUTED' && (
            <View style={[styles.infoCard, { backgroundColor: '#FFE8D6' }]}>
              <Ionicons name="alert-circle-outline" size={24} color="#F97316" />
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: '#F97316' }]}>
                  Dispute Under Review
                </Text>
                <Text style={[styles.infoText, { color: '#F97316' }]}>
                  Your dispute is being reviewed by our team. We'll notify you
                  once a decision is made.
                </Text>
              </View>
            </View>
          )}

          {item.status === 'CANCELLED' && (
            <View style={[styles.infoCard, { backgroundColor: '#F8D7DA' }]}>
              <Ionicons name="close-circle-outline" size={24} color="#721C24" />
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: '#721C24' }]}>
                  Order Cancelled
                </Text>
                <Text style={[styles.infoText, { color: '#721C24' }]}>
                  {item.cancelledBy === 'buyer'
                    ? 'You cancelled this order.'
                    : 'This order was cancelled by the seller.'}
                </Text>
              </View>
            </View>
          )}

          {item.status === 'REFUNDED' && (
            <View style={[styles.infoCard, { backgroundColor: '#FFF3CD' }]}>
              <Ionicons name="cash-outline" size={24} color="#856404" />
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: '#856404' }]}>
                  Refund Processed
                </Text>
                <Text style={[styles.infoText, { color: '#856404' }]}>
                  {item.refundAmount
                    ? `Refund of ${formatCurrency(item.refundAmount, item.currency)} has been processed.`
                    : 'Your refund has been processed successfully.'}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Action buttons */}
        {(item.status === 'PENDING_PAYMENT' ||
          item.status === 'PROCESSING' ||
          item.status === 'SHIPPED' ||
          item.status === 'COMPLETED') && (
          <View style={styles.actionButtonsSection}>

            {/* PENDING_PAYMENT — Pay Now + Cancel */}
            {item.status === 'PENDING_PAYMENT' && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.payBtn,
                    isActionLoading && styles.btnDisabled,
                  ]}
                  onPress={() => handlePayNow(item)}
                  disabled={isActionLoading}
                >
                  <Ionicons name="card" size={16} color={Colors.white} />
                  <Text style={styles.payBtnText}>Pay Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.cancelBtn,
                    isActionLoading && styles.btnDisabled,
                  ]}
                  onPress={() =>
                    handleCancelOrder(item.id, item.id.slice(-8).toUpperCase())
                  }
                  disabled={isActionLoading}
                >
                  {isProcessing && cancelOrder.isPending ? (
                    <ActivityIndicator size="small" color={Colors.error} />
                  ) : (
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* PROCESSING — Open Dispute + View Logistics (if delivery info exists) */}
            {item.status === 'PROCESSING' && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.refundBtn,
                    isActionLoading && styles.btnDisabled,
                  ]}
                  onPress={() => handleOpenDispute(item.id)}
                  disabled={isActionLoading}
                >
                  <MaterialIcons name="gavel" size={16} color="#EF4444" />
                  <Text style={styles.refundBtnText}>Open Dispute</Text>
                </TouchableOpacity>
                {hasDeliveryInfo && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.logisticsBtn]}
                    onPress={() => handleViewDeliveryDetails(item)}
                  >
                    <MaterialIcons name="local-shipping" size={16} color={Colors.white} />
                    <Text style={styles.logisticsBtnText}>View Logistics</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* SHIPPED — Confirm Received + View Logistics */}
            {item.status === 'SHIPPED' && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.confirmBtn,
                    (isProcessing || escrowLoading) && styles.btnDisabled,
                  ]}
                  onPress={() =>
                    handleConfirmReceived(item.id, item.id.slice(-8).toUpperCase())
                  }
                  disabled={isProcessing || escrowLoading}
                >
                  {isProcessing || escrowLoading ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
                      <Text style={styles.confirmBtnText}>Confirm Received</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.logisticsBtn]}
                  onPress={() => handleViewDeliveryDetails(item)}
                >
                  <MaterialIcons name="local-shipping" size={16} color={Colors.white} />
                  <Text style={styles.logisticsBtnText}>View Logistics</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* COMPLETED — View Logistics + Open Dispute + Product Reviews */}
            {item.status === 'COMPLETED' && (
              <>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.logisticsBtn]}
                    onPress={() => handleViewDeliveryDetails(item)}
                  >
                    <MaterialIcons name="local-shipping" size={16} color={Colors.white} />
                    <Text style={styles.logisticsBtnText}>View Logistics</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.refundBtn]}
                    onPress={() => handleOpenDispute(item.id)}
                  >
                    <MaterialIcons name="gavel" size={16} color="#EF4444" />
                    <Text style={styles.refundBtnText}>Open Dispute</Text>
                  </TouchableOpacity>
                </View>

                {/* Per-product reviews */}
                <View style={styles.reviewSection}>
                  <Text style={styles.reviewSectionTitle}>Rate Your Purchase</Text>
                  {item.items.map((orderItem: OrderItem, index: number) => {
                    const productImage =
                      orderItem.product?.images?.[0] ||
                      'https://via.placeholder.com/100';
                    const itemProductName =
                      orderItem.product?.name ||
                      orderItem.productName ||
                      orderItem.name ||
                      'Product';
                    return (
                      <TouchableOpacity
                        key={index}
                        style={styles.reviewProductItem}
                        onPress={() =>
                          handleAddReview(
                            orderItem.product?.id || orderItem.productId || '',
                            itemProductName,
                            item.id,
                            productImage
                          )
                        }
                      >
                        <Image
                          source={{ uri: productImage }}
                          style={styles.reviewProductImage}
                        />
                        <View style={styles.reviewProductInfo}>
                          <Text
                            style={styles.reviewProductName}
                            numberOfLines={1}
                          >
                            {itemProductName}
                          </Text>
                          <View style={styles.reviewProductAction}>
                            <Ionicons name="star" size={14} color="#F59E0B" />
                            <Text style={styles.reviewProductActionText}>
                              Add Review
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={Colors.textSecondary}
                        />
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

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="cube-outline" size={48} color={Colors.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>
        No {activeTab.replace('_', ' ').toLowerCase()} orders
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'PENDING_PAYMENT'
          ? 'Orders awaiting payment will appear here'
          : `You don't have any ${activeTab.replace('_', ' ').toLowerCase()} orders at the moment`}
      </Text>
    </View>
  );

  const currentTabCount = ordersData?.pagination?.total || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSubtitle}>Track and manage your purchases</Text>
      </View>

      {/* Status Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
          style={styles.tabsScrollView}
        >
          {statusTabs.map((tab) => {
            const isActive = activeTab === tab.status;
            return (
              <TouchableOpacity
                key={tab.status}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => handleTabPress(tab.status)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
                  {tab.label}
                </Text>
                {isActive && (
                  <View style={[styles.badge, styles.activeBadge]}>
                    <Text style={[styles.badgeText, styles.activeBadgeText]}>
                      {currentTabCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Orders List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={styles.errorTitle}>Failed to Load Orders</Text>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Unable to load your orders'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  tabsWrapper: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 64,
  },
  tabsScrollView: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    gap: 8,
    minHeight: 40,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeTabLabel: {
    color: Colors.white,
  },
  badge: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBadge: {
    backgroundColor: Colors.primaryDark,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  activeBadgeText: {
    color: Colors.white,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  orderCardContainer: {
    marginBottom: 16,
  },
  orderInfoSection: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderMeta: {
    gap: 4,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  orderDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  productSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  multiItemBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  multiItemText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1ECF1',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 10,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C5460',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    color: '#0C5460',
  },
  actionButtonsSection: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  payBtn: {
    backgroundColor: Colors.success,
  },
  payBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  cancelBtn: {
    backgroundColor: Colors.errorLight,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
  refundBtn: {
    backgroundColor: '#FEE2E2',
  },
  refundBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  logisticsBtn: {
    backgroundColor: Colors.primary,
  },
  logisticsBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  confirmBtn: {
    backgroundColor: Colors.success,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  reviewSection: {
    marginTop: 8,
    padding: 12,
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    gap: 8,
  },
  reviewSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  reviewProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 10,
    borderRadius: 8,
    gap: 10,
  },
  reviewProductImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.gray100,
  },
  reviewProductInfo: {
    flex: 1,
    gap: 2,
  },
  reviewProductName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  reviewProductAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewProductActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#F59E0B',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});

export default BuyerOrderManagement;