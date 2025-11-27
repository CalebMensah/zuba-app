import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useOrders, Order } from '../../hooks/useOrder';
import { useDelivery } from '../../hooks/useDeliveryInfo';
import { Colors } from '../../constants/colors';

// Navigation types
type RootStackParamList = {
  SellerOrderDetails: { orderId: string };
  AddDeliveryCourierInfo: { orderId: string };
};

type SellerOrderDetailsRouteProp = RouteProp<RootStackParamList, 'SellerOrderDetails'>;
type SellerOrderDetailsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SellerOrderDetails: React.FC = () => {
  const route = useRoute<SellerOrderDetailsRouteProp>();
  const navigation = useNavigation<SellerOrderDetailsNavigationProp>();
  const { orderId } = route.params;

  const { getOrderById, updateOrderStatus, cancelOrder, loading, error } = useOrders();
  const { setDeliveryStatus, getDeliveryInfo, loading: deliveryLoading } = useDelivery();

  const [order, setOrder] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Fetch order details
  const fetchOrderDetails = useCallback(async () => {
    try {
      const orderData = await getOrderById(orderId);
      if (orderData) {
        setOrder(orderData);
      }
    } catch (err) {
      console.error('Error fetching order:', err);
    }
  }, [orderId, getOrderById]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrderDetails();
    setRefreshing(false);
  }, [fetchOrderDetails]);

  // Confirm order
  const handleConfirmOrder = async () => {
    Alert.alert(
      'Confirm Order',
      'Are you sure you want to confirm this order? The buyer will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActionLoading(true);
            const result = await updateOrderStatus(orderId, 'CONFIRMED', 'Order confirmed by seller');
            setActionLoading(false);
            
            if (result) {
              Alert.alert('Success', 'Order confirmed successfully');
              fetchOrderDetails();
            } else {
              Alert.alert('Error', error || 'Failed to confirm order');
            }
          },
        },
      ]
    );
  };

  // Cancel order
  const handleCancelOrder = async () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            Alert.prompt(
              'Cancellation Reason',
              'Please provide a reason for cancellation (optional)',
              async (reason) => {
                setActionLoading(true);
                const result = await cancelOrder(orderId, reason || 'Cancelled by seller');
                setActionLoading(false);
                
                if (result) {
                  Alert.alert('Success', 'Order cancelled successfully', [
                    {
                      text: 'OK',
                      onPress: () => navigation.goBack(),
                    },
                  ]);
                } else {
                  Alert.alert('Error', error || 'Failed to cancel order');
                }
              }
            );
          },
        },
      ]
    );
  };

  // Navigate to add delivery info
  const handleMarkAsDelivered = () => {
    navigation.navigate('AddDeliveryCourierInfo', { orderId });
  };

  // Update delivery status
  const handleUpdateDeliveryStatus = () => {
    setShowStatusModal(true);
  };

  // Handle delivery status change
  const handleDeliveryStatusChange = async (newStatus: string) => {
    setShowStatusModal(false);
    
    Alert.alert(
      'Update Delivery Status',
      `Change delivery status to ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            setActionLoading(true);
            const result = await setDeliveryStatus({ orderId, status: newStatus as any });
            
            if (result) {
              Alert.alert('Success', 'Delivery status updated successfully');
              fetchOrderDetails();
            } else {
              Alert.alert('Error', 'Failed to update delivery status');
            }
            setActionLoading(false);
          },
        },
      ]
    );
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      PENDING: { bg: Colors.warningLight, text: Colors.warning, label: 'Pending' },
      CONFIRMED: { bg: Colors.infoLight, text: Colors.info, label: 'Confirmed' },
      PROCESSING: { bg: Colors.primaryLight + '20', text: Colors.primary, label: 'Processing' },
      SHIPPED: { bg: Colors.successLight + '20', text: Colors.success, label: 'Shipped' },
      OUT_FOR_DELIVERY: { bg: Colors.successLight + '20', text: Colors.success, label: 'Out for Delivery' },
      DELIVERED: { bg: Colors.successLight, text: Colors.successDark, label: 'Delivered' },
      COMPLETED: { bg: Colors.success, text: Colors.white, label: 'Completed' },
      CANCELLED: { bg: Colors.errorLight, text: Colors.error, label: 'Cancelled' },
    };

    const config = statusConfig[status] || statusConfig.PENDING;

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
        <Text style={[styles.statusText, { color: config.text }]}>{config.label}</Text>
      </View>
    );
  };

  // Render payment status
  const renderPaymentStatus = (paymentStatus: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      PENDING: { bg: Colors.warningLight, text: Colors.warning, label: 'Payment Pending' },
      PROCESSING: { bg: Colors.infoLight, text: Colors.info, label: 'Processing Payment' },
      SUCCESS: { bg: Colors.successLight, text: Colors.successDark, label: 'Paid' },
      FAILED: { bg: Colors.errorLight, text: Colors.error, label: 'Payment Failed' },
      REFUNDED: { bg: Colors.gray200, text: Colors.gray700, label: 'Refunded' },
    };

    const config = statusConfig[paymentStatus] || statusConfig.PENDING;

    return (
      <View style={[styles.paymentBadge, { backgroundColor: config.bg }]}>
        <Text style={[styles.paymentText, { color: config.text }]}>{config.label}</Text>
      </View>
    );
  };

  // Render action buttons based on order status
  const renderActionButtons = () => {
    if (!order) return null;

    const { status } = order;

    switch (status) {
      case 'PENDING':
        return (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={handleConfirmOrder}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
                  <Text style={styles.actionButtonText}>Confirm Order</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancelOrder}
              disabled={actionLoading}
            >
              <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
              <Text style={[styles.actionButtonText, { color: Colors.error }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case 'CONFIRMED':
      case 'PROCESSING':
        return (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.deliveryButton]}
              onPress={handleMarkAsDelivered}
            >
              <Ionicons name="car-outline" size={20} color={Colors.white} />
              <Text style={styles.actionButtonText}>Mark as Shipped</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancelOrder}
              disabled={actionLoading}
            >
              <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
              <Text style={[styles.actionButtonText, { color: Colors.error }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case 'SHIPPED':
        return (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={handleUpdateDeliveryStatus}
              disabled={actionLoading}
            >
              <Ionicons name="swap-horizontal-outline" size={20} color={Colors.white} />
              <Text style={styles.actionButtonText}>Update Delivery Status</Text>
            </TouchableOpacity>
            <View style={styles.statusMessageContainer}>
              <Ionicons name="time-outline" size={24} color={Colors.info} />
              <Text style={styles.statusMessageText}>
                Order has been shipped. Waiting for delivery confirmation.
              </Text>
            </View>
          </View>
        );

      case 'OUT_FOR_DELIVERY':
        return (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={handleUpdateDeliveryStatus}
              disabled={actionLoading}
            >
              <Ionicons name="swap-horizontal-outline" size={20} color={Colors.white} />
              <Text style={styles.actionButtonText}>Update Delivery Status</Text>
            </TouchableOpacity>
            <View style={styles.statusMessageContainer}>
              <Ionicons name="hourglass-outline" size={24} color={Colors.warning} />
              <Text style={styles.statusMessageText}>
                Order is out for delivery. Awaiting buyer confirmation.
              </Text>
            </View>
          </View>
        );

      case 'DELIVERED':
        return (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={handleUpdateDeliveryStatus}
              disabled={actionLoading}
            >
              <Ionicons name="swap-horizontal-outline" size={20} color={Colors.white} />
              <Text style={styles.actionButtonText}>Update Delivery Status</Text>
            </TouchableOpacity>
            <View style={styles.statusMessageContainer}>
              <Ionicons name="lock-closed-outline" size={24} color={Colors.success} />
              <Text style={styles.statusMessageText}>
                Order delivered. Funds held in escrow until buyer confirms receipt.
              </Text>
            </View>
          </View>
        );

      case 'COMPLETED':
        return (
          <View style={styles.completedContainer}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            <Text style={styles.completedTitle}>Order Completed Successfully!</Text>
            <Text style={styles.completedText}>
              Payment has been released to your account.
            </Text>
          </View>
        );

      case 'CANCELLED':
        return (
          <View style={styles.cancelledContainer}>
            <Ionicons name="close-circle" size={48} color={Colors.error} />
            <Text style={styles.cancelledTitle}>Order Cancelled</Text>
            {order.cancelledBy && (
              <Text style={styles.cancelledText}>
                Cancelled by: {order.cancelledBy === 'seller' ? 'You' : 'Buyer'}
              </Text>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  if (loading && !order) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    );
  }

  if (!order && !loading) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorTitle}>Order Not Found</Text>
        <Text style={styles.errorText}>Unable to load order details.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchOrderDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.orderIdText}>Order #{order?.id.slice(0, 8)}</Text>
        <View style={styles.statusRow}>
          {renderStatusBadge(order?.status || 'PENDING')}
          {renderPaymentStatus(order?.paymentStatus || 'PENDING')}
        </View>
      </View>

      {/* Action Buttons */}
      {renderActionButtons()}

      {/* Buyer Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Buyer Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color={Colors.gray600} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>
                {order?.buyer?.firstName} {order?.buyer?.lastName}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={Colors.gray600} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{order?.buyer?.email}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Delivery Information */}
      {order?.deliveryInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={20} color={Colors.gray600} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Recipient</Text>
                <Text style={styles.infoValue}>{order.deliveryInfo.recipient}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color={Colors.gray600} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{order.deliveryInfo.phone}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color={Colors.gray600} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>
                  {order.deliveryInfo.address}, {order.deliveryInfo.city},{' '}
                  {order.deliveryInfo.region}
                </Text>
              </View>
            </View>
            {order.deliveryInfo.trackingNumber && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Ionicons name="barcode-outline" size={20} color={Colors.gray600} />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Tracking Number</Text>
                    <Text style={styles.infoValue}>{order.deliveryInfo.trackingNumber}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Order Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Items</Text>
        {order?.items.map((item: any, index: number) => (
          <View key={index} style={styles.itemCard}>
            <Image
              source={{
                uri: item.product?.images?.[0] || 'https://via.placeholder.com/80',
              }}
              style={styles.itemImage}
            />
            <View style={styles.itemDetails}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.product?.name}
              </Text>
              <Text style={styles.itemQuantity}>Quantity: {item.quantity}</Text>
              <Text style={styles.itemPrice}>
                {order.currency} {item.price.toFixed(2)} × {item.quantity}
              </Text>
            </View>
            <Text style={styles.itemTotal}>
              {order.currency} {item.total.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      {/* Order Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              {order?.currency} {order?.subtotal.toFixed(2)}
            </Text>
          </View>
          {order && order.deliveryFee > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>
                {order.currency} {order.deliveryFee.toFixed(2)}
              </Text>
            </View>
          )}
          {order && order.taxAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>
                {order.currency} {order.taxAmount.toFixed(2)}
              </Text>
            </View>
          )}
          {order && order.discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: Colors.success }]}>Discount</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>
                -{order.currency} {order.discount.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {order?.currency} {order?.totalAmount.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* Order Timeline */}
      {order?.statusHistory && order.statusHistory.length > 0 && (() => {
        const statusHistory = order?.statusHistory ?? [];
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Timeline</Text>
            <View style={styles.timelineCard}>
              {statusHistory.map((status: any, index: number) => (
                <View key={index} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  {index < statusHistory.length - 1 && <View style={styles.timelineLine} />}
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineStatus}>{status.newStatus}</Text>
                    <Text style={styles.timelineDate}>
                      {new Date(status.createdAt).toLocaleDateString()} at{' '}
                      {new Date(status.createdAt).toLocaleTimeString()}
                    </Text>
                    {status.reason && (
                      <Text style={styles.timelineReason}>{status.reason}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        );
      })()}

      <View style={styles.bottomPadding} />
    </ScrollView>

    {/* Delivery Status Modal */}
    {showStatusModal && (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Update Delivery Status</Text>
            <TouchableOpacity onPress={() => setShowStatusModal(false)}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.statusOptions}>
            {[
              { value: 'PENDING', label: 'Pending', icon: 'time-outline', color: Colors.warning },
              { value: 'PROCESSING', label: 'Processing', icon: 'hourglass-outline', color: Colors.info },
              { value: 'SHIPPED', label: 'Shipped', icon: 'airplane-outline', color: Colors.primary },
              { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: 'car-outline', color: Colors.primaryLight },
              { value: 'DELIVERED', label: 'Delivered', icon: 'checkmark-circle-outline', color: Colors.success },
              { value: 'RETURNED', label: 'Returned', icon: 'return-down-back-outline', color: Colors.accent },
              { value: 'CANCELLED', label: 'Cancelled', icon: 'close-circle-outline', color: Colors.error },
            ].map((status) => (
              <TouchableOpacity
                key={status.value}
                style={[
                  styles.statusOption,
                  order?.deliveryInfo?.status === status.value && styles.statusOptionActive
                ]}
                onPress={() => handleDeliveryStatusChange(status.value)}
                disabled={order?.deliveryInfo?.status === status.value}
              >
                <Ionicons name={status.icon as any} size={24} color={status.color} />
                <Text style={[
                  styles.statusOptionText,
                  order?.deliveryInfo?.status === status.value && styles.statusOptionTextActive
                ]}>
                  {status.label}
                </Text>
                {order?.deliveryInfo?.status === status.value && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    )}
  </>
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
    backgroundColor: Colors.backgroundSecondary,
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
    backgroundColor: Colors.backgroundSecondary,
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
  header: {
    backgroundColor: Colors.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  orderIdText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paymentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  paymentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionContainer: {
    padding: 16,
    gap: 12,
    backgroundColor: Colors.white,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  confirmButton: {
    backgroundColor: Colors.success,
  },
  deliveryButton: {
    backgroundColor: Colors.primary,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  cancelButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  statusMessageContainer: {
    backgroundColor: Colors.backgroundTertiary,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  statusMessageText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  completedContainer: {
    backgroundColor: Colors.white,
    padding: 24,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  completedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 8,
  },
  completedText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  cancelledContainer: {
    backgroundColor: Colors.white,
    padding: 24,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelledTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 8,
  },
  cancelledText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: Colors.white,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  itemCard: {
    backgroundColor: Colors.white,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 1,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.gray200,
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    alignSelf: 'flex-start',
  },
  summaryCard: {
    backgroundColor: Colors.white,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  timelineCard: {
    backgroundColor: Colors.white,
    padding: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginTop: 4,
    marginRight: 12,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    bottom: -20,
    width: 2,
    backgroundColor: Colors.border,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  timelineReason: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 24,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusOptions: {
    padding: 16,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  statusOptionActive: {
    backgroundColor: Colors.primaryLight + '15',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  statusOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  statusOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  currentBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SellerOrderDetails;