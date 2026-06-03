import React from 'react';
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
import {
  useOrder,
  useCancelOrder,
  useAcceptOrder,
  useRejectOrder,
  formatCurrency,
} from '../../hooks/useOrder';
import { Colors } from '../../constants/colors';
import { OrderStatus } from '../../types/order';

// ── Navigation types ──────────────────────────────────────────────────────────

type RootStackParamList = {
  SellerOrderDetails: { orderId: string };
  ShipOrderScreen: { orderId: string; isEdit: boolean };
};

type SellerOrderDetailsRouteProp = RouteProp<RootStackParamList, 'SellerOrderDetails'>;
type SellerOrderDetailsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SellerOrderDetails: React.FC = () => {
  const route = useRoute<SellerOrderDetailsRouteProp>();
  const navigation = useNavigation<SellerOrderDetailsNavigationProp>();
  const { orderId } = route.params;

  const { data: order, isLoading, error, refetch } = useOrder(orderId);
  const cancelOrder = useCancelOrder();
  const acceptOrder = useAcceptOrder();
  const rejectOrder = useRejectOrder();

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAcceptOrder = () => {
    Alert.alert(
      'Confirm Order',
      'Are you sure you want to accept this order? The buyer will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            acceptOrder.mutate(orderId, {
              onSuccess: () => Alert.alert('Success', 'Order accepted successfully.'),
            });
          },
        },
      ]
    );
  };

  const handleRejectOrder = () => {
    Alert.alert(
      'Reject Order',
      'Are you sure you want to reject this order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'Rejection Reason',
              'Please provide a reason for rejection (required)',
              async (reason) => {
                if (!reason || reason.trim().length === 0) {
                  Alert.alert('Error', 'Rejection reason is required');
                  return;
                }
                rejectOrder.mutate(
                  { orderId, reason: reason.trim() },
                  {
                    onSuccess: () => {
                      Alert.alert('Success', 'Order rejected successfully.', [
                        { text: 'OK', onPress: () => navigation.goBack() },
                      ]);
                    },
                  }
                );
              }
            );
          },
        },
      ]
    );
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'Cancellation Reason',
              'Please provide a reason (optional)',
              async (reason) => {
                cancelOrder.mutate(
                  { orderId, reason: reason || 'Cancelled by seller' },
                  {
                    onSuccess: () => {
                      Alert.alert('Success', 'Order cancelled successfully.', [
                        { text: 'OK', onPress: () => navigation.goBack() },
                      ]);
                    },
                  }
                );
              }
            );
          },
        },
      ]
    );
  };

  const handleShipOrder = () => {
    navigation.navigate('ShipOrderScreen', { orderId, isEdit: false });
  };

  // ── Status Badges ────────────────────────────────────────────────────────────

  const renderStatusBadge = (status: OrderStatus) => {
    const config: Record<OrderStatus, { bg: string; text: string; label: string }> = {
      PENDING_PAYMENT: { bg: Colors.errorLight,   text: Colors.error,       label: 'Pending Payment' },
      PAID:            { bg: Colors.infoLight,    text: Colors.info,        label: 'Paid' },
      PROCESSING:      { bg: Colors.primaryLight + '20', text: Colors.primary, label: 'Processing' },
      SHIPPED:         { bg: Colors.successLight + '20', text: Colors.success, label: 'Shipped' },
      COMPLETED:       { bg: Colors.success,      text: Colors.white,       label: 'Completed' },
      DISPUTED:        { bg: '#FFE8D6',            text: '#F97316',          label: 'Disputed' },
      CANCELLED:       { bg: Colors.errorLight,   text: Colors.error,       label: 'Cancelled' },
      REFUNDED:        { bg: Colors.gray200,       text: Colors.gray700,     label: 'Refunded' },
    };

    const c = config[status] ?? config.PAID;
    return (
      <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
        <Text style={[styles.statusText, { color: c.text }]}>{c.label}</Text>
      </View>
    );
  };

  const renderPaymentStatus = (paymentStatus?: string) => {
    if (!paymentStatus) return null;

    const config: Record<string, { bg: string; text: string; label: string }> = {
      PENDING:    { bg: Colors.warningLight,  text: Colors.warning,     label: 'Payment Pending' },
      PROCESSING: { bg: Colors.infoLight,     text: Colors.info,        label: 'Processing Payment' },
      SUCCESS:    { bg: Colors.successLight,  text: Colors.successDark, label: 'Paid' },
      FAILED:     { bg: Colors.errorLight,    text: Colors.error,       label: 'Payment Failed' },
      REFUNDED:   { bg: Colors.gray200,       text: Colors.gray700,     label: 'Refunded' },
    };

    const c = config[paymentStatus] ?? config.PENDING;
    return (
      <View style={[styles.paymentBadge, { backgroundColor: c.bg }]}>
        <Text style={[styles.paymentText, { color: c.text }]}>{c.label}</Text>
      </View>
    );
  };

  // ── Action Buttons ───────────────────────────────────────────────────────────

  const renderActionButtons = () => {
    if (!order) return null;

    const { status } = order;
    const isProcessing =
      acceptOrder.isPending || rejectOrder.isPending || cancelOrder.isPending;

    switch (status) {
      // ── PAId: accept or reject ──────────────────────────────────────────
      case 'PAID':
        return (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={handleAcceptOrder}
              disabled={isProcessing}
            >
              {acceptOrder.isPending ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
                  <Text style={styles.actionButtonText}>Accept Order</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleRejectOrder}
              disabled={isProcessing}
            >
              {rejectOrder.isPending ? (
                <ActivityIndicator color={Colors.error} size="small" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
                  <Text style={[styles.actionButtonText, { color: Colors.error }]}>
                    Reject Order
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        );

      // ── PROCESSING: ship or cancel ──────────────────────────────────────
      case 'PROCESSING':
        return (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.deliveryButton]}
              onPress={handleShipOrder}
              disabled={isProcessing}
            >
              <Ionicons name="send-outline" size={20} color={Colors.white} />
              <Text style={styles.actionButtonText}>Ship Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancelOrder}
              disabled={isProcessing}
            >
              {cancelOrder.isPending ? (
                <ActivityIndicator color={Colors.error} size="small" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
                  <Text style={[styles.actionButtonText, { color: Colors.error }]}>Cancel</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        );

      // ── SHIPPED: awaiting buyer confirmation ────────────────────────────
      case 'SHIPPED':
        return (
          <View style={styles.actionContainer}>
            <View style={styles.statusMessageContainer}>
              <Ionicons name="time-outline" size={24} color={Colors.info} />
              <Text style={styles.statusMessageText}>
                Order has been shipped. Funds will be released once the buyer confirms receipt.
              </Text>
            </View>
          </View>
        );

      // ── DISPUTED ────────────────────────────────────────────────────────
      case 'DISPUTED':
        return (
          <View style={styles.actionContainer}>
            <View style={[styles.statusMessageContainer, { backgroundColor: '#FFE8D6' }]}>
              <Ionicons name="alert-circle-outline" size={24} color="#F97316" />
              <Text style={[styles.statusMessageText, { color: '#F97316' }]}>
                A dispute has been opened for this order. Our team is reviewing it.
              </Text>
            </View>
          </View>
        );

      // ── COMPLETED ───────────────────────────────────────────────────────
      case 'COMPLETED':
        return (
          <View style={styles.completedContainer}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            <Text style={styles.completedTitle}>Order Completed!</Text>
            <Text style={styles.completedText}>Payment has been released to your account.</Text>
          </View>
        );

      // ── CANCELLED ───────────────────────────────────────────────────────
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

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorTitle}>Order Not Found</Text>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Unable to load order details.'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const safeItems = order.items || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() => refetch()}
          colors={[Colors.primary]}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.orderIdText}>Order #{order.id.slice(0, 8)}</Text>
        <View style={styles.statusRow}>
          {renderStatusBadge(order.status)}
          {renderPaymentStatus(order.paymentStatus)}
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
                {order.buyer?.firstName} {order.buyer?.lastName}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={Colors.gray600} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{order.buyer?.email}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Delivery Information */}
      {order.deliveryInfo && (
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
            {order.deliveryInfo.courierService && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Ionicons name="car-outline" size={20} color={Colors.gray600} />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Courier</Text>
                    <Text style={styles.infoValue}>{order.deliveryInfo.courierService}</Text>
                  </View>
                </View>
              </>
            )}
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
            {order.deliveryInfo.estimatedDeliveryDays && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={20} color={Colors.gray600} />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Estimated Delivery</Text>
                    <Text style={styles.infoValue}>
                      {order.deliveryInfo.estimatedDeliveryDays} day
                      {order.deliveryInfo.estimatedDeliveryDays !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              </>
            )}
            {order.deliveryInfo.dispatchNote && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Ionicons name="document-text-outline" size={20} color={Colors.gray600} />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Dispatch Note</Text>
                    <Text style={styles.infoValue}>{order.deliveryInfo.dispatchNote}</Text>
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
        {safeItems.map((item: any, index: number) => (
          <View key={index} style={styles.itemCard}>
            <Image
              source={{ uri: item.product?.images?.[0] || 'https://via.placeholder.com/80' }}
              style={styles.itemImage}
            />
            <View style={styles.itemDetails}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.product?.name || item.productName || item.name}
              </Text>
              <Text style={styles.itemQuantity}>Quantity: {item.quantity}</Text>
              <Text style={styles.itemPrice}>
                {formatCurrency(item.unitPrice || item.price, order.currency)} × {item.quantity}
              </Text>
            </View>
            <Text style={styles.itemTotal}>
              {formatCurrency(item.total, order.currency)}
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
              {formatCurrency(order.subtotal, order.currency)}
            </Text>
          </View>
          {order.deliveryFee > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(order.deliveryFee, order.currency)}
              </Text>
            </View>
          )}
          {order.taxAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(order.taxAmount, order.currency)}
              </Text>
            </View>
          )}
          {order.discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: Colors.success }]}>Discount</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>
                -{formatCurrency(order.discount, order.currency)}
              </Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(order.totalAmount, order.currency)}
            </Text>
          </View>
        </View>
      </View>

      {/* Order Timeline */}
      {order.statusHistory && order.statusHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Timeline</Text>
          <View style={styles.timelineCard}>
            {order.statusHistory.map((status: any, index: number) => (
              <View key={index} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                {index < order.statusHistory!.length - 1 && (
                  <View style={styles.timelineLine} />
                )}
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
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
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
  rejectButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.error,
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
});

export default SellerOrderDetails;