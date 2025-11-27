// screens/SellerOrderManagement.tsx
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useOrders, Order } from '../../hooks/useOrder';
import { useDelivery } from '../../hooks/useDeliveryInfo';

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
type DeliveryStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED' | 'CANCELLED';

interface StatusTab {
  status: OrderStatus;
  label: string;
  count: number;
}

interface SellerOrderManagementProps {
  navigation: any;
}

const SellerOrderManagement: React.FC<SellerOrderManagementProps> = ({ navigation }) => {
  const { loading, error, getSellerOrders, cancelOrder, updateOrderStatus } = useOrders();
  const { setDeliveryStatus, loading: deliveryLoading } = useDelivery();
  
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
  
  // Delivery status modal
  const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingDeliveryStatus, setUpdatingDeliveryStatus] = useState(false);

  const statusTabs: StatusTab[] = [
    { status: 'PENDING', label: 'Pending', count: statusCounts.PENDING },
    { status: 'CONFIRMED', label: 'Confirmed', count: statusCounts.CONFIRMED },
    { status: 'SHIPPED', label: 'Shipped', count: statusCounts.SHIPPED },
    { status: 'DELIVERED', label: 'Delivered', count: statusCounts.DELIVERED },
    { status: 'COMPLETED', label: 'Completed', count: statusCounts.COMPLETED },
    { status: 'CANCELLED', label: 'Cancelled', count: statusCounts.CANCELLED },
  ];

  const deliveryStatuses = [
    { value: 'PROCESSING', label: 'Processing', color: Colors.warning, icon: '📦' },
    { value: 'SHIPPED', label: 'Shipped', color: Colors.primary, icon: '🚚' },
    { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', color: '#FF9500', icon: '🚛' },
    { value: 'DELIVERED', label: 'Delivered', color: Colors.success, icon: '✅' },
    { value: 'RETURNED', label: 'Returned', color: Colors.error, icon: '↩️' },
  ];

  // Fetch orders for active tab
  const fetchOrders = useCallback(async (status: OrderStatus) => {
    const result = await getSellerOrders(1, 20, status);
    if (result) {
      setOrders(result.orders);
    }
  }, [getSellerOrders]);

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
      const result = await getSellerOrders(1, 1, status);
      if (result) {
        counts[status] = result.pagination.total;
      }
    }
    setStatusCounts(counts);
  }, [getSellerOrders]);

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
      `Are you sure you want to cancel order #${orderNumber}? The buyer will be notified.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setProcessingOrderId(orderId);
            const result = await cancelOrder(orderId, 'Cancelled by seller');
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

  // Handle confirm order
  const handleConfirmOrder = async (orderId: string, orderNumber: string) => {
    Alert.alert(
      'Confirm Order',
      `Confirm order #${orderNumber}? You are committing to fulfill this order.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Order',
          onPress: async () => {
            setProcessingOrderId(orderId);
            const result = await updateOrderStatus(orderId, 'CONFIRMED', 'Confirmed by seller');
            setProcessingOrderId(null);
            
            if (result) {
              Alert.alert('Success', 'Order confirmed successfully! Please prepare the items for shipment.');
              await fetchOrders(activeTab);
              await fetchStatusCounts();
            } else {
              Alert.alert('Error', error || 'Failed to confirm order');
            }
          },
        },
      ]
    );
  };

  // Handle mark as shipped - navigate to delivery info
  const handleMarkAsShipped = (order: Order) => {
    navigation.navigate('AddDeliveryInfo', {
      orderId: order.id,
      orderNumber: order.id.slice(-8).toUpperCase(),
      deliveryInfo: order.deliveryInfo,
    });
  };

  const handleOrderDetalsPress = (order: Order) => {
    navigation.navigate('SellerOrderDetails', { orderId: order.id });
  };

  // Handle delivery status update
  const handleOpenDeliveryStatusModal = (order: Order) => {
    setSelectedOrder(order);
    setDeliveryModalVisible(true);
  };

  const handleUpdateDeliveryStatus = async (newStatus: DeliveryStatus) => {
    if (!selectedOrder) return;

    const currentStatus = selectedOrder.deliveryInfo?.status || 'PROCESSING';
    
    if (newStatus === currentStatus) {
      setDeliveryModalVisible(false);
      return;
    }

    Alert.alert(
      'Update Delivery Status',
      `Change delivery status to ${newStatus}?${newStatus === 'DELIVERED' ? ' The buyer will be notified.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            setUpdatingDeliveryStatus(true);
            
            const result = await setDeliveryStatus({
              orderId: selectedOrder.id,
              status: newStatus,
            });
            
            if (result) {
              // Close modal first
              setDeliveryModalVisible(false);
              setUpdatingDeliveryStatus(false);
              
              // Show success message
              Alert.alert('Success', `Delivery status updated to ${newStatus}`);
              
              // Force refresh to get latest data
              setRefreshing(true);
              await Promise.all([
                fetchOrders(activeTab),
                fetchStatusCounts()
              ]);
              setRefreshing(false);
              
              // Clear selected order
              setSelectedOrder(null);
            } else {
              setUpdatingDeliveryStatus(false);
              setDeliveryModalVisible(false);
              Alert.alert('Error', 'Failed to update delivery status. Please try again.');
            }
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

  // Get status message for order cards
  const getStatusMessage = (status: OrderStatus) => {
    switch (status) {
      case 'SHIPPED':
        return 'Awaiting buyer confirmation';
      case 'DELIVERED':
        return 'Awaiting release of funds';
      case 'COMPLETED':
        return 'Order completed';
      default:
        return '';
    }
  };

  const getCurrentDeliveryStatusConfig = (deliveryStatus: string) => {
    return deliveryStatuses.find(s => s.value === deliveryStatus) || deliveryStatuses[0];
  };

  // Render order item
  const renderOrderItem = ({ item }: { item: Order }) => {
    const firstItem = item.items?.[0];
    const firstImage = firstItem?.product?.images?.[0] || 'https://via.placeholder.com/100';
    const productName = firstItem?.product?.name || 'Product';
    const isProcessing = processingOrderId === item.id;
    const statusMessage = getStatusMessage(item.status as OrderStatus);
    const currentDeliveryStatus = item.deliveryInfo?.status || 'PROCESSING';
    const deliveryStatusConfig = getCurrentDeliveryStatusConfig(currentDeliveryStatus);

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Text style={styles.orderNumber}>Order #{item.id.slice(-8).toUpperCase()}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status as OrderStatus)}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status as OrderStatus) }]}>
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
            <Text style={styles.buyerName}>
              Buyer: {item.buyer?.firstName || 'Customer'}
            </Text>
            
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Total:</Text>
              <Text style={styles.price}>
                {item.currency} {item.totalAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Delivery Status Display - Show for SHIPPED and DELIVERED orders */}
        {(item.status === 'SHIPPED' || item.status === 'DELIVERED') && item.deliveryInfo && (
          <View style={styles.deliveryStatusContainer}>
            <View style={styles.deliveryStatusHeader}>
              <Text style={styles.deliveryStatusLabel}>Delivery Status:</Text>
              {item.deliveryInfo.courierService && (
                <Text style={styles.courierName}>{item.deliveryInfo.courierService}</Text>
              )}
            </View>
            
            <View style={styles.statusRowContainer}>
              <View style={[styles.currentStatusBadge, { backgroundColor: `${deliveryStatusConfig.color}20` }]}>
                <Text style={styles.statusIcon}>{deliveryStatusConfig.icon}</Text>
                <Text style={[styles.currentStatusText, { color: deliveryStatusConfig.color }]}>
                  {deliveryStatusConfig.label}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.updateButton}
                onPress={() => handleOpenDeliveryStatusModal(item)}
                disabled={updatingDeliveryStatus}
              >
                {updatingDeliveryStatus && selectedOrder?.id === item.id ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.updateButtonText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>

            {item.deliveryInfo.trackingNumber && (
              <Text style={styles.trackingInfo}>
                Tracking: {item.deliveryInfo.trackingNumber}
              </Text>
            )}
          </View>
        )}

        {/* Status Message */}
        {statusMessage && (
          <View style={styles.statusMessageContainer}>
            <Text style={styles.statusMessage}>
              {statusMessage === 'Awaiting buyer confirmation' && '⏳ '}
              {statusMessage === 'Awaiting release of funds' && '💰 '}
              {statusMessage === 'Order completed' && '✅ '}
              {statusMessage}
            </Text>
          </View>
        )}

        <View style={styles.orderFooter}>
          <TouchableOpacity style={styles.viewDetailsButton} onPress={() => handleOrderDetalsPress}>
            <Text style={styles.viewDetailsText}>View Details</Text>
          </TouchableOpacity>

          {/* PENDING: Show Confirm and Cancel */}
          {item.status === 'PENDING' && (
            <>
              <TouchableOpacity
                style={[styles.confirmButton, isProcessing && styles.buttonDisabled]}
                onPress={() => handleConfirmOrder(item.id, item.id.slice(-8).toUpperCase())}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelButton, isProcessing && styles.buttonDisabled]}
                onPress={() => handleCancelOrder(item.id, item.id.slice(-8).toUpperCase())}
                disabled={isProcessing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {/* CONFIRMED: Show Mark as Shipped and Cancel */}
          {item.status === 'CONFIRMED' && (
            <>
              <TouchableOpacity
                style={[styles.shippedButton, isProcessing && styles.buttonDisabled]}
                onPress={() => handleMarkAsShipped(item)}
                disabled={isProcessing}
              >
                <Text style={styles.shippedButtonText}>Mark as Shipped</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelButton, isProcessing && styles.buttonDisabled]}
                onPress={() => handleCancelOrder(item.id, item.id.slice(-8).toUpperCase())}
                disabled={isProcessing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </>
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
          ? 'New orders will appear here'
          : `You don't have any ${activeTab.toLowerCase()} orders yet`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Seller Orders</Text>
        <Text style={styles.headerSubtitle}>Manage your store orders</Text>
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

      {/* Delivery Status Update Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={deliveryModalVisible}
        onRequestClose={() => setDeliveryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Delivery Status</Text>
              <TouchableOpacity onPress={() => setDeliveryModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <Text style={styles.modalSubtitle}>
                Order #{selectedOrder.id.slice(-8).toUpperCase()}
              </Text>
            )}

            <View style={styles.statusOptions}>
              {deliveryStatuses.map((status) => {
                const isCurrentStatus = selectedOrder?.deliveryInfo?.status === status.value;
                return (
                  <TouchableOpacity
                    key={status.value}
                    style={[
                      styles.statusOption,
                      isCurrentStatus && styles.statusOptionActive,
                    ]}
                    onPress={() => handleUpdateDeliveryStatus(status.value as DeliveryStatus)}
                    disabled={updatingDeliveryStatus}
                  >
                    <View style={styles.statusOptionLeft}>
                      <Text style={styles.statusOptionIcon}>{status.icon}</Text>
                      <View>
                        <Text style={[
                          styles.statusOptionLabel,
                          isCurrentStatus && styles.statusOptionLabelActive
                        ]}>
                          {status.label}
                        </Text>
                        {isCurrentStatus && (
                          <Text style={styles.currentBadge}>Current</Text>
                        )}
                      </View>
                    </View>
                    {isCurrentStatus && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.cancelModalButton}
              onPress={() => setDeliveryModalVisible(false)}
            >
              <Text style={styles.cancelModalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.gray100,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
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
  countBadge: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  activeCountBadge: {
    backgroundColor: Colors.primaryDark,
  },
  countText: {
    fontSize: 11,
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
    padding: 18,
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
    marginBottom: 12,
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
  buyerName: {
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
  deliveryStatusContainer: {
    backgroundColor: Colors.gray100,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  deliveryStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deliveryStatusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  courierName: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  statusRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  currentStatusBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  statusIcon: {
    fontSize: 16,
  },
  currentStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  updateButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  trackingInfo: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  statusMessageContainer: {
    backgroundColor: Colors.gray50,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusMessage: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  orderFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  viewDetailsButton: {
    flex: 1,
    minWidth: '100%',
    backgroundColor: Colors.gray100,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Colors.success,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  shippedButton: {
    flex: 1,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shippedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.error,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  buttonDisabled: {
    opacity: 0.5,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeButton: {
    fontSize: 24,
    color: Colors.textSecondary,
    fontWeight: '300',
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  statusOptions: {
    gap: 12,
    marginBottom: 24,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  statusOptionActive: {
    backgroundColor: `${Colors.primary}10`,
    borderColor: Colors.primary,
  },
  statusOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusOptionIcon: {
    fontSize: 24,
  },
  statusOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusOptionLabelActive: {
    color: Colors.primary,
  },
  currentBadge: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 20,
    color: Colors.primary,
    fontWeight: '700',
  },
  cancelModalButton: {
    backgroundColor: Colors.gray100,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});

export default SellerOrderManagement;