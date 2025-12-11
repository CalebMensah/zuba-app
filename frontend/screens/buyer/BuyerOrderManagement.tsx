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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useOrders } from '../../hooks/useOrder';
import { Order, OrderItem } from '../../types/order';
import { useEscrow } from '../../hooks/useEscrow';
import { BuyerStackParamList } from '../../types/navigation';

const { width } = Dimensions.get('window');

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';

interface StatusTab {
  status: OrderStatus;
  label: string;
  count: number;
  icon: string;
  iconFamily: 'Ionicons' | 'MaterialIcons' | 'FontAwesome5';
  color: string;
  bgColor: string;
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
    { 
      status: 'PENDING', 
      label: 'Pending', 
      count: statusCounts.PENDING, 
      icon: 'hourglass-outline', 
      iconFamily: 'Ionicons',
      color: '#F59E0B',
      bgColor: '#FEF3C7'
    },
    { 
      status: 'CONFIRMED', 
      label: 'Confirmed', 
      count: statusCounts.CONFIRMED, 
      icon: 'checkmark-done', 
      iconFamily: 'Ionicons',
      color: '#3B82F6',
      bgColor: '#DBEAFE'
    },
    { 
      status: 'SHIPPED', 
      label: 'Shipped', 
      count: statusCounts.SHIPPED, 
      icon: 'airplane', 
      iconFamily: 'Ionicons',
      color: '#8B5CF6',
      bgColor: '#EDE9FE'
    },
    { 
      status: 'DELIVERED', 
      label: 'Delivered', 
      count: statusCounts.DELIVERED, 
      icon: 'cube', 
      iconFamily: 'Ionicons',
      color: '#10B981',
      bgColor: '#D1FAE5'
    },
    { 
      status: 'COMPLETED', 
      label: 'Completed', 
      count: statusCounts.COMPLETED, 
      icon: 'checkmark-circle', 
      iconFamily: 'Ionicons',
      color: '#059669',
      bgColor: '#A7F3D0'
    },
    { 
      status: 'CANCELLED', 
      label: 'Cancelled', 
      count: statusCounts.CANCELLED, 
      icon: 'close-circle', 
      iconFamily: 'Ionicons',
      color: '#EF4444',
      bgColor: '#FEE2E2'
    },
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
            (navigation as any).navigate('RequestRefund', {
              orderId,
              productId,
              productName,
            });
          },
        },
      ]
    );
  };

  // Get status configuration
  const getStatusConfig = (status: OrderStatus) => {
    return statusTabs.find(tab => tab.status === status) || statusTabs[0];
  };

  // Assert OrderStatus helper to validate status strings
  const assertOrderStatus = (status: string): OrderStatus => {
    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'] as const;
    return validStatuses.includes(status as OrderStatus) ? (status as OrderStatus) : 'PENDING';
  };

  // Render icon based on family
  const renderStatusIcon = (tab: StatusTab, size: number = 20) => {
    switch (tab.iconFamily) {
      case 'Ionicons':
        return <Ionicons name={tab.icon as any} size={size} color={tab.color} />;
      case 'MaterialIcons':
        return <MaterialIcons name={tab.icon as any} size={size} color={tab.color} />;
      case 'FontAwesome5':
        return <FontAwesome5 name={tab.icon as any} size={size} color={tab.color} />;
      default:
        return null;
    }
  };

  // Render status badge for order card
  const renderOrderStatusBadge = (status: OrderStatus) => {
    const config = getStatusConfig(status);
    return (
      <View style={[styles.orderStatusBadge, { backgroundColor: config.bgColor }]}>
        {renderStatusIcon(config, 16)}
        <Text style={[styles.orderStatusText, { color: config.color }]}>
          {status}
        </Text>
      </View>
    );
  };

  // Render completed order with individual products
  const renderCompletedOrder = ({ item }: { item: Order }) => {
    return (
      <View style={styles.orderCard}>
        {/* Order Header */}
        <View style={styles.orderCardHeader}>
          <View style={styles.orderHeaderTop}>
            <Text style={styles.orderNumber}>#{item.id.slice(-8).toUpperCase()}</Text>
            {renderOrderStatusBadge('COMPLETED')}
          </View>
          <Text style={styles.orderDate}>
            {new Date(item.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>

        {/* Store Info */}
        <View style={styles.storeInfoRow}>
          <Ionicons name="storefront-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.storeName}>{item.store?.name || 'Store'}</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Individual Products */}
        {item.items.map((orderItem: OrderItem, index: number) => {
          const productImage = orderItem.product?.images?.[0] || 'https://via.placeholder.com/100';
          const productName = orderItem.product?.name || 'Product';

          return (
            <View key={index}>
              <View style={styles.productRow}>
                <Image source={{ uri: productImage }} style={styles.productThumbnail} />
                
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {productName}
                  </Text>
                  <Text style={styles.productQuantity}>
                    Qty: {orderItem.quantity} × {item.currency} {orderItem.price.toFixed(2)}
                  </Text>
                </View>

                <Text style={styles.productTotal}>
                  {item.currency} {(orderItem.price * orderItem.quantity).toFixed(2)}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.productActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleAddReview(
                    orderItem.product?.id || '',
                    productName,
                    item.id,
                    orderItem.product?.images?.[0] || 'https://via.placeholder.com/100'
                  )}
                >
                  <Ionicons name="star" size={16} color="#F59E0B" />
                  <Text style={styles.actionButtonText}>Add Review</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.refundActionButton]}
                  onPress={() => handleRequestRefund(
                    orderItem.product?.id || '',
                    productName,
                    item.id
                  )}
                >
                  <MaterialIcons name="replay" size={16} color="#EF4444" />
                  <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Refund</Text>
                </TouchableOpacity>
              </View>

              {index < item.items.length - 1 && <View style={styles.productDivider} />}
            </View>
          );
        })}

        {/* Total */}
        <View style={styles.orderTotal}>
          <Text style={styles.totalLabel}>Order Total</Text>
          <Text style={styles.totalAmount}>
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
        {/* Order Header */}
        <View style={styles.orderCardHeader}>
          <View style={styles.orderHeaderTop}>
            <Text style={styles.orderNumber}>#{item.id.slice(-8).toUpperCase()}</Text>
            {renderOrderStatusBadge(assertOrderStatus(item.status))}
          </View>
          <Text style={styles.orderDate}>
            {new Date(item.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>

        {/* Store Info */}
        <View style={styles.storeInfoRow}>
          <Ionicons name="storefront-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.storeName}>{item.store?.name || 'Store'}</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Product Preview */}
        <View style={styles.productRow}>
          <Image source={{ uri: firstImage }} style={styles.productThumbnail} />
          
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {productName}
            </Text>
            {item.items.length > 1 && (
              <Text style={styles.moreItems}>
                +{item.items.length - 1} more item{item.items.length > 2 ? 's' : ''}
              </Text>
            )}
          </View>

          <Text style={styles.productTotal}>
            {item.currency} {item.totalAmount.toFixed(2)}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.orderActions}>
          <TouchableOpacity 
            style={styles.secondaryActionButton} 
            onPress={() => navigation.navigate('OrderDetails', { orderId: item.id })}
          >
            <Text style={styles.secondaryActionText}>View Details</Text>
          </TouchableOpacity>

          {isShipped && (
            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={() => handleViewDeliveryDetails(item)}
            >
              <MaterialIcons name="local-shipping" size={18} color={Colors.white} />
              <Text style={styles.primaryActionText}>Track</Text>
            </TouchableOpacity>
          )}

          {isDelivered && (
            <TouchableOpacity
              style={[styles.primaryActionButton, isProcessing && styles.disabledButton]}
              onPress={() => handleConfirmReceived(item.id, item.id.slice(-8).toUpperCase())}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
                  <Text style={styles.primaryActionText}>Confirm Receipt</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {canCancel && (
            <TouchableOpacity
              style={[styles.dangerActionButton, isProcessing && styles.disabledButton]}
              onPress={() => handleCancelOrder(item.id, item.id.slice(-8).toUpperCase())}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.dangerActionText}>Cancel Order</Text>
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
      <View style={styles.emptyIconContainer}>
        <Ionicons name="receipt-outline" size={64} color={Colors.gray400} />
      </View>
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

      {/* Status Filter Grid */}
      <View style={styles.statusGrid}>
        {statusTabs.map((tab) => (
          <TouchableOpacity
            key={tab.status}
            style={[
              styles.statusCard,
              activeTab === tab.status && styles.activeStatusCard,
              { borderColor: tab.color }
            ]}
            onPress={() => handleTabPress(tab.status)}
          >
            <View style={[styles.statusIconContainer, { backgroundColor: tab.bgColor }]}>
              {renderStatusIcon(tab, 24)}
            </View>
            <Text style={[
              styles.statusLabel,
              activeTab === tab.status && styles.activeStatusLabel
            ]}>
              {tab.label}
            </Text>
            <View style={[styles.statusCount, { backgroundColor: tab.bgColor }]}>
              <Text style={[styles.statusCountText, { color: tab.color }]}>
                {tab.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

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
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
    alignSelf: 'center',
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    alignSelf: 'center',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  statusCard: {
    width: (width - 40) / 3,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  activeStatusCard: {
    borderWidth: 2,
    backgroundColor: '#FAFAFA',
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  activeStatusLabel: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  statusCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  statusCountText: {
    fontSize: 12,
    fontWeight: '700',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  orderCardHeader: {
    marginBottom: 12,
  },
  orderHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  orderStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orderDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  storeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  storeName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  productThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  productQuantity: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  moreItems: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  productTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  refundActionButton: {
    backgroundColor: '#FEE2E2',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
  },
  productDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  orderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  dangerActionButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  disabledButton: {
    backgroundColor: Colors.disabled,
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
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
});

export default BuyerOrderManagement;