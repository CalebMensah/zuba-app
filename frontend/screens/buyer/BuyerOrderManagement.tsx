// screens/BuyerOrderManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useOrders, Order } from '../../hooks/useOrder';
import { useEscrow } from '../../hooks/useEscrow';
import { BuyerStackParamList } from '../../types/navigation';

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';

interface StatusTab {
  status: OrderStatus;
  label: string;
  count: number;
  icon: string;
  iconFamily: 'Ionicons' | 'MaterialIcons' | 'FontAwesome5';
}

const BuyerOrderManagement = () => {
  const navigation = useNavigation<NavigationProp<BuyerStackParamList>>();

  const { loading, error, getBuyerOrders, cancelOrder } = useOrders();
  const { loading: escrowLoading, confirmOrderReceived } = useEscrow();
  const [activeTab, setActiveTab] = useState<OrderStatus>('PENDING');
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Record<OrderStatus, number>>({
    PENDING: 0,
    CONFIRMED: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  });
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  const statusTabs: StatusTab[] = [
    { status: 'PENDING', label: 'Pending', count: statusCounts.PENDING, icon: 'time-outline', iconFamily: 'Ionicons' },
    { status: 'CONFIRMED', label: 'Confirmed', count: statusCounts.CONFIRMED, icon: 'checkmark-circle-outline', iconFamily: 'Ionicons' },
    { status: 'SHIPPED', label: 'Shipped', count: statusCounts.SHIPPED, icon: 'local-shipping', iconFamily: 'MaterialIcons' },
    { status: 'DELIVERED', label: 'Delivered', count: statusCounts.DELIVERED, icon: 'box', iconFamily: 'FontAwesome5' },
    { status: 'COMPLETED', label: 'Completed', count: statusCounts.COMPLETED, icon: 'checkmark-done-circle-outline', iconFamily: 'Ionicons' },
    { status: 'CANCELLED', label: 'Cancelled', count: statusCounts.CANCELLED, icon: 'close-circle-outline', iconFamily: 'Ionicons' },
  ];

  // Fetch orders for active tab
  const fetchOrders = useCallback(async (status: OrderStatus) => {
    const result = await getBuyerOrders(1, 20, status);
    if (result) {
      setOrders(result.orders);
    }
  }, [getBuyerOrders]);

  // Fetch counts for all statuses
  const fetchStatusCounts = useCallback(async () => {
    const statuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
    const counts: Record<OrderStatus, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    for (const status of statuses) {
      const result = await getBuyerOrders(1, 1, status);
      if (result) {
        counts[status] = result.pagination.total;
      }
    }
    setStatusCounts(counts);
  }, [getBuyerOrders]);

  // Initial load
  useEffect(() => {
    fetchOrders(activeTab);
    fetchStatusCounts();
  }, [activeTab]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders(activeTab);
    await fetchStatusCounts();
    setRefreshing(false);
  }, [activeTab, fetchOrders, fetchStatusCounts]);

  // Handle tab change
  const handleTabPress = (status: OrderStatus) => {
    setActiveTab(status);
  };

  // Handle order cancellation
  const handleCancelOrder = async (orderId: string, orderNumber: string) => {
    Alert.alert(
      'Cancel Order',
      `Are you sure you want to cancel order #${orderNumber}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setProcessingOrderId(orderId);
            const result = await cancelOrder(orderId, 'Cancelled by buyer');
            setProcessingOrderId(null);

            if (result) {
              Alert.alert('Success', 'Order cancelled successfully');
              await fetchOrders(activeTab);
              await fetchStatusCounts();
            } else {
              Alert.alert('Error', error || 'Failed to cancel order');
            }
          },
        },
      ]
    );
  };

  // Handle view delivery details
  const handleViewDeliveryDetails = (order: Order) => {
    (navigation as any).navigate('DeliveryDetails', { orderId: order.id });
  };

  // Handle confirm received - releases escrow funds
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
            const result = await confirmOrderReceived(orderId);
            setProcessingOrderId(null);

            if (result.success) {
              Alert.alert(
                'Success', 
                'Order confirmed successfully. Payment has been released to the seller.',
                [{ text: 'OK', onPress: async () => {
                  await fetchOrders(activeTab);
                  await fetchStatusCounts();
                }}]
              );
            } else {
              Alert.alert('Error', result.message || 'Failed to confirm order');
            }
          },
        },
      ]
    );
  };

  // Handle add review navigation
  const handleAddReview = (productId: string, productName: string, orderId: string, productImage: string) => {
    navigation.navigate('ManageReview', {
      orderId,
      productId,
      productName,
      productImage
    });
  };

  // Handle request refund
  const handleRequestRefund = (productId: string, productName: string, orderId: string) => {
    Alert.alert(
      'Request Refund',
      `Do you want to request a refund for "${productName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Refund',
          onPress: () => {
            // TODO: Implement refund request logic
            Alert.alert(
              'Refund Request',
              'Refund request feature coming soon. Please contact customer support for assistance.',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  // Get status badge color
  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return Colors.warning;
      case 'CONFIRMED':
        return Colors.info;
      case 'SHIPPED':
        return Colors.primaryLight;
      case 'DELIVERED':
        return Colors.success;
      case 'COMPLETED':
        return Colors.successDark;
      case 'CANCELLED':
        return Colors.error;
      default:
        return Colors.gray400;
    }
  };

  // Assert OrderStatus helper to validate status strings
  const assertOrderStatus = (status: string): OrderStatus => {
    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'] as const;
    return validStatuses.includes(status as OrderStatus) ? (status as OrderStatus) : 'PENDING';
  };

  // Render icon based on family
  const renderStatusIcon = (tab: StatusTab, isActive: boolean) => {
    const iconColor = isActive ? Colors.white : Colors.textSecondary;
    const iconSize = 16;

    switch (tab.iconFamily) {
      case 'Ionicons':
        return <Ionicons name={tab.icon as any} size={iconSize} color={iconColor} />;
      case 'MaterialIcons':
        return <MaterialIcons name={tab.icon as any} size={iconSize} color={iconColor} />;
      case 'FontAwesome5':
        return <FontAwesome5 name={tab.icon as any} size={iconSize} color={iconColor} />;
      default:
        return null;
    }
  };

  // Render completed order with individual products
  const renderCompletedOrder = ({ item }: { item: Order }) => {
    return (
      <View style={styles.completedOrderContainer}>
        {/* Order Header */}
        <View style={styles.completedOrderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Text style={styles.orderNumber}>Order #{item.id.slice(-8).toUpperCase()}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor('COMPLETED')}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor('COMPLETED') }]}>
                COMPLETED
              </Text>
            </View>
          </View>
          <Text style={styles.orderDate}>
            {new Date(item.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>

        {/* Store Info */}
        <Text style={styles.completedStoreName}>{item.store?.name || 'Store'}</Text>

        {/* Individual Products */}
        {item.items.map((orderItem, index) => {
          const productImage = orderItem.product?.images?.[0] || 'https://via.placeholder.com/100';
          const productName = orderItem.product?.name || 'Product';

          return (
            <View key={index} style={styles.completedProductCard}>
              <Image source={{ uri: productImage }} style={styles.completedProductImage} />
              
              <View style={styles.completedProductDetails}>
                <Text style={styles.completedProductName} numberOfLines={2}>
                  {productName}
                </Text>
                <Text style={styles.completedProductPrice}>
                  {item.currency} {orderItem.price.toFixed(2)} × {orderItem.quantity}
                </Text>

                {/* Action Buttons */}
                <View style={styles.completedProductActions}>
                  <TouchableOpacity
                    style={styles.reviewButton}
                    onPress={() => handleAddReview(
                      orderItem.product?.id || '',
                      productName,
                      item.id,
                      orderItem.product?.images?.[0] || 'https://via.placeholder.com/100'
                    )}
                  >
                    <Ionicons name="star" size={14} color={Colors.white} />
                    <Text style={styles.reviewButtonText}>Add Review</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.refundButton}
                    onPress={() => handleRequestRefund(
                      orderItem.product?.id || '',
                      productName,
                      item.id
                    )}
                  >
                    <MaterialIcons name="money-off" size={14} color={Colors.error} />
                    <Text style={styles.refundButtonText}>Refund</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {/* Total Amount */}
        <View style={styles.completedTotalRow}>
          <Text style={styles.completedTotalLabel}>Order Total:</Text>
          <Text style={styles.completedTotalAmount}>
            {item.currency} {item.totalAmount.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  // Render regular order item (for non-completed orders)
  const renderOrderItem = ({ item }: { item: Order }) => {
    // If order is completed, use special rendering
    if (item.status === 'COMPLETED') {
      return renderCompletedOrder({ item });
    }

    const firstItem = item.items?.[0];
    const firstImage = firstItem?.product?.images?.[0] || 'https://via.placeholder.com/100';
    const productName = firstItem?.product?.name || 'Product';
    const canCancel = item.status === 'PENDING' || item.status === 'CONFIRMED';
    const isShipped = item.status === 'SHIPPED';
    const isDelivered = item.status === 'DELIVERED';
    const isProcessing = processingOrderId === item.id;

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Text style={styles.orderNumber}>Order #{item.id.slice(-8).toUpperCase()}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(assertOrderStatus(item.status))}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor(assertOrderStatus(item.status)) }]}>
                {item.status}
              </Text>
            </View>
          </View>
          <Text style={styles.orderDate}>
            {new Date(item.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>

        <View style={styles.orderContent}>
          <Image source={{ uri: firstImage }} style={styles.productImage} />
          
          <View style={styles.orderDetails}>
            <Text style={styles.productName} numberOfLines={2}>
              {productName}
            </Text>
            {item.items.length > 1 && (
              <Text style={styles.itemCount}>+{item.items.length - 1} more item(s)</Text>
            )}
            <Text style={styles.storeName}>{item.store?.name || 'Store'}</Text>
            
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Total:</Text>
              <Text style={styles.price}>
                {item.currency} {item.totalAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.orderFooter}>
          <TouchableOpacity 
            style={styles.viewDetailsButton} 
            onPress={() => navigation.navigate('OrderDetails', { orderId: item.id })}
          >
            <Text style={styles.viewDetailsText}>View Details</Text>
          </TouchableOpacity>

          {isShipped && (
            <TouchableOpacity
              style={styles.deliveryButton}
              onPress={() => handleViewDeliveryDetails(item)}
            >
              <MaterialIcons name="local-shipping" size={16} color={Colors.white} />
              <Text style={styles.deliveryButtonText}>Delivery</Text>
            </TouchableOpacity>
          )}

          {isDelivered && (
            <TouchableOpacity
              style={[styles.confirmButton, isProcessing && styles.confirmButtonDisabled]}
              onPress={() => handleConfirmReceived(item.id, item.id.slice(-8).toUpperCase())}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {canCancel && (
            <TouchableOpacity
              style={[styles.cancelButton, isProcessing && styles.cancelButtonDisabled]}
              onPress={() => handleCancelOrder(item.id, item.id.slice(-8).toUpperCase())}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📦</Text>
      <Text style={styles.emptyStateTitle}>No {activeTab.toLowerCase()} orders</Text>
      <Text style={styles.emptyStateText}>
        {activeTab === 'PENDING'
          ? 'Your pending orders will appear here'
          : `You don't have any ${activeTab.toLowerCase()} orders yet`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSubtitle}>Track and manage your purchases</Text>
      </View>

      {/* Status Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
        style={styles.tabsScrollView}
      >
        {statusTabs.map((tab) => (
          <TouchableOpacity
            key={tab.status}
            style={[styles.tab, activeTab === tab.status && styles.activeTab]}
            onPress={() => handleTabPress(tab.status)}
          >
            {renderStatusIcon(tab, activeTab === tab.status)}
            <Text style={[styles.tabLabel, activeTab === tab.status && styles.activeTabLabel]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.countBadge, activeTab === tab.status && styles.activeCountBadge]}>
                <Text style={[styles.countText, activeTab === tab.status && styles.activeCountText]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
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
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  tabsScrollView: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.gray100,
    borderRadius: 16,
    marginRight: 6,
    gap: 4,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeTabLabel: {
    color: Colors.white,
  },
  countBadge: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  activeCountBadge: {
    backgroundColor: Colors.primaryDark,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  activeCountText: {
    color: Colors.white,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  orderDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  orderContent: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
  },
  orderDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  itemCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  storeName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  orderFooter: {
    flexDirection: 'row',
    gap: 8,
  },
  viewDetailsButton: {
    flex: 1,
    backgroundColor: Colors.gray100,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.error,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonDisabled: {
    backgroundColor: Colors.disabled,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  deliveryButton: {
    flex: 1,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  deliveryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Colors.success,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  confirmButtonDisabled: {
    backgroundColor: Colors.disabled,
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Completed Order Styles
  completedOrderContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  completedOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completedStoreName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  completedProductCard: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
    gap: 12,
  },
  completedProductImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: Colors.gray100,
  },
  completedProductDetails: {
    flex: 1,
  },
  completedProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  completedProductPrice: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  completedProductActions: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  reviewButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  refundButton: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  refundButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
  },
  completedTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  completedTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  completedTotalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
});

export default BuyerOrderManagement;