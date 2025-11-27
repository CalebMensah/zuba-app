// screens/OrderDetails.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useOrders, Order } from '../../hooks/useOrder';

interface OrderDetailsProps {
  route: {
    params: {
      orderId: string;
    };
  };
  navigation: any;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ route, navigation }) => {
  const { orderId } = route.params;
  const { loading, error, getOrderById, cancelOrder, updateOrderStatus } = useOrders();
  const [order, setOrder] = useState<Order | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    const result = await getOrderById(orderId);
    if (result) {
      setOrder(result);
    }
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? This action cannot be undone.',
      [
        { text: 'No, Keep Order', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const result = await cancelOrder(orderId, 'Cancelled by buyer');
            setActionLoading(false);
            if (result) {
              Alert.alert('Success', 'Order cancelled successfully', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } else {
              Alert.alert('Error', error || 'Failed to cancel order');
            }
          },
        },
      ]
    );
  };

  const handleConfirmReceived = () => {
    Alert.alert(
      'Confirm Delivery',
      'By confirming, you acknowledge that you have received this order in good condition. Payment will be released to the seller.',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Confirm Receipt',
          onPress: async () => {
            setActionLoading(true);
            const result = await updateOrderStatus(orderId, 'COMPLETED', 'Confirmed by buyer');
            setActionLoading(false);
            if (result) {
              Alert.alert('Success', 'Order confirmed! Payment has been released to the seller.');
              fetchOrderDetails();
            } else {
              Alert.alert('Error', error || 'Failed to confirm order');
            }
          },
        },
      ]
    );
  };

  const handleRequestRefund = () => {
    Alert.alert(
      'Request Refund',
      'Please provide a reason for requesting a refund. Our team will review your request.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Contact Support',
          onPress: () => {
            // Navigate to support or chat
            Alert.alert('Support', 'Redirecting to support...');
          },
        },
      ]
    );
  };

  const handleChatWithSeller = () => {
    if (order?.store?.userId) {
      navigation.navigate('Chat', {
        sellerId: order.store.userId,
        sellerName: order.store.name,
      });
    }
  };

  const handleViewDeliveryDetails = () => {
    navigation.navigate('DeliveryDetails', {
      orderId: order?.id,
      deliveryInfo: order?.deliveryInfo,
    });
  };

  const handleAddReview = () => {
    navigation.navigate('AddReview', {
      orderId: order?.id,
      items: order?.items,
    });
  };

  const getStepInfo = () => {
    if (!order) return null;

    const daysUntilAutoRelease = 4;
    const deliveredDate = order.deliveredAt ? new Date(order.deliveredAt) : null;
    const daysElapsed = deliveredDate
      ? Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const daysRemaining = Math.max(0, daysUntilAutoRelease - daysElapsed);

    switch (order.status) {
      case 'PENDING':
        return {
          step: 1,
          title: 'Order Placed Successfully',
          description: 'Your order has been received and is awaiting confirmation from the seller. You will be notified once the seller confirms your order.',
          icon: '📦',
          color: Colors.warning,
          actions: ['cancel', 'chat'],
        };
      case 'CONFIRMED':
        return {
          step: 2,
          title: 'Order Confirmed',
          description: 'Great news! The seller has confirmed your order and is preparing it for shipment. You will receive delivery details soon.',
          icon: '✅',
          color: Colors.info,
          actions: ['cancel', 'chat'],
        };
      case 'SHIPPED':
        return {
          step: 3,
          title: 'Order Shipped',
          description: 'Your order is on its way! The seller has shipped your package. Track your delivery below.',
          icon: '🚚',
          color: Colors.primaryLight,
          actions: ['delivery', 'chat'],
        };
      case 'DELIVERED':
        return {
          step: 4,
          title: 'Order Delivered',
          description: `Your order has been delivered! Please confirm receipt to release payment to the seller. If not confirmed within ${daysRemaining} day(s), funds will be automatically released.`,
          icon: '🎉',
          color: Colors.success,
          actions: ['confirm', 'refund', 'chat'],
        };
      case 'COMPLETED':
        return {
          step: 5,
          title: 'Order Completed',
          description: 'Thank you for your purchase! Your order is complete. Share your experience by reviewing the products you purchased and earn reward points.',
          icon: '⭐',
          color: Colors.successDark,
          actions: ['review'],
        };
      case 'CANCELLED':
        return {
          step: 6,
          title: 'Order Cancelled',
          description: 'This order has been cancelled. If you were charged, your refund will be processed within 3-5 business days.',
          icon: '❌',
          color: Colors.error,
          actions: [],
        };
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stepInfo = getStepInfo();
  const firstItem = order.items?.[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Order Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.orderNumber}>Order #{order.id.slice(-8).toUpperCase()}</Text>
              <Text style={styles.orderDate}>
                {new Date(order.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${stepInfo?.color}20` }]}>
              <Text style={[styles.statusText, { color: stepInfo?.color }]}>
                {order.status}
              </Text>
            </View>
          </View>

          {/* Product Preview */}
          <View style={styles.productPreview}>
            <Image
              source={{ uri: firstItem?.product?.images?.[0] || 'https://via.placeholder.com/80' }}
              style={styles.productImage}
            />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {firstItem?.product?.name || 'Product'}
              </Text>
              <Text style={styles.productQuantity}>Qty: {firstItem?.quantity || 1}</Text>
              {order.items.length > 1 && (
                <Text style={styles.moreItems}>+{order.items.length - 1} more item(s)</Text>
              )}
            </View>
          </View>

          {/* Store Info */}
          <View style={styles.storeInfo}>
            <Text style={styles.storeLabel}>Store</Text>
            <Text style={styles.storeName}>{order.store?.name || 'Store'}</Text>
          </View>

          {/* Order Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Order Total</Text>
            <Text style={styles.totalAmount}>
              {order.currency} {order.totalAmount.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Progress Steps */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Order Progress</Text>
            <Text style={styles.progressStep}>Step {stepInfo?.step}/5</Text>
          </View>

          <View style={styles.stepIndicator}>
            {[1, 2, 3, 4, 5].map((step) => (
              <View key={step} style={styles.stepContainer}>
                <View
                  style={[
                    styles.stepDot,
                    step <= (stepInfo?.step || 0) && step !== 6 && styles.stepDotActive,
                    step === stepInfo?.step && { backgroundColor: stepInfo?.color },
                  ]}
                >
                  {step === stepInfo?.step && <Text style={styles.stepDotText}>{step}</Text>}
                </View>
                {step < 5 && (
                  <View
                    style={[
                      styles.stepLine,
                      step < (stepInfo?.step || 0) && styles.stepLineActive,
                    ]}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Status Card */}
        <View style={[styles.statusCard, { borderLeftColor: stepInfo?.color }]}>
          <Text style={styles.statusIcon}>{stepInfo?.icon}</Text>
          <Text style={styles.statusTitle}>{stepInfo?.title}</Text>
          <Text style={styles.statusDescription}>{stepInfo?.description}</Text>
        </View>

        {/* Delivery Info (if available) */}
        {order.deliveryInfo && order.status !== 'PENDING' && (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Delivery Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Recipient:</Text>
              <Text style={styles.infoValue}>{order.deliveryInfo.recipient}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{order.deliveryInfo.phone}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address:</Text>
              <Text style={styles.infoValue}>
                {order.deliveryInfo.address}, {order.deliveryInfo.city}, {order.deliveryInfo.region}
              </Text>
            </View>
            {order.deliveryInfo.trackingNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tracking:</Text>
                <Text style={styles.infoValue}>{order.deliveryInfo.trackingNumber}</Text>
              </View>
            )}
          </View>
        )}

        {/* Order Items */}
        <View style={styles.itemsCard}>
          <Text style={styles.itemsCardTitle}>Order Items ({order.items.length})</Text>
          {order.items.map((item: any, index: number) => (
            <View key={index} style={styles.itemRow}>
              <Image
                source={{ uri: item.product?.images?.[0] || 'https://via.placeholder.com/60' }}
                style={styles.itemImage}
              />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.product?.name || 'Product'}</Text>
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

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {stepInfo?.actions.includes('cancel') && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelOrder}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel Order</Text>
              )}
            </TouchableOpacity>
          )}

          {stepInfo?.actions.includes('delivery') && (
            <TouchableOpacity
              style={styles.deliveryButton}
              onPress={handleViewDeliveryDetails}
            >
              <Text style={styles.deliveryButtonText}>📦 View Delivery Details</Text>
            </TouchableOpacity>
          )}

          {stepInfo?.actions.includes('confirm') && (
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmReceived}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.confirmButtonText}>✓ Confirm Receipt</Text>
              )}
            </TouchableOpacity>
          )}

          {stepInfo?.actions.includes('refund') && (
            <TouchableOpacity
              style={styles.refundButton}
              onPress={handleRequestRefund}
            >
              <Text style={styles.refundButtonText}>Request Refund</Text>
            </TouchableOpacity>
          )}

          {stepInfo?.actions.includes('review') && (
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={handleAddReview}
            >
              <Text style={styles.reviewButtonText}>⭐ Write a Review & Earn Points</Text>
            </TouchableOpacity>
          )}

          {stepInfo?.actions.includes('chat') && (
            <TouchableOpacity
              style={styles.chatButton}
              onPress={handleChatWithSeller}
            >
              <Text style={styles.chatButtonText}>💬 Chat with Seller</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
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
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: Colors.textPrimary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  productPreview: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  productQuantity: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  moreItems: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  storeInfo: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  storeLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  progressCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  progressStep: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepDotText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.gray200,
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: Colors.primary,
  },
  statusCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 24,
    borderRadius: 16,
    borderLeftWidth: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  statusDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  infoCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    width: 90,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  itemsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  itemsCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.gray100,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  cancelButton: {
    backgroundColor: Colors.error,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  deliveryButton: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  deliveryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  confirmButton: {
    backgroundColor: Colors.success,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  refundButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.error,
  },
  refundButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.error,
  },
  reviewButton: {
    backgroundColor: Colors.warning,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  chatButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  bottomSpacing: {
    height: 32,
  },
});

export default OrderDetails;