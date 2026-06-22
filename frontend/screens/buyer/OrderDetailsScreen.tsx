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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import {
  useOrder,
  useCancelOrder,
  formatCurrency,
} from '../../hooks/useOrder';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Order, OrderStatus } from '../../types/order';
import { useChatContext } from '../../context/ChatContext';
import { useEscrow } from '../../hooks/useEscrow';

const { width } = Dimensions.get('window');

interface OrderDetailsProps {
  route: { params: { orderId: string } };
  navigation: any;
}

interface TimelineStep {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  completed: boolean;
  active: boolean;
  timestamp?: string;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ route, navigation }) => {
  const { orderId } = route.params;

  const { data: order, isLoading, error, refetch } = useOrder(orderId);
  const cancelOrder = useCancelOrder();
  const { loading: escrowLoading, confirmOrderReceived } = useEscrow();
  const { startDirectChat } = useChatContext();

  const [processingConfirm, setProcessingConfirm] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Poll while payment is pending
  useEffect(() => {
    if (!order) return;
    if (order.status === 'PENDING_PAYMENT') {
      const pollInterval = setInterval(() => refetch(), 5000);
      const timeout = setTimeout(() => clearInterval(pollInterval), 120000);
      return () => {
        clearInterval(pollInterval);
        clearTimeout(timeout);
      };
    }
  }, [order?.status, refetch]);

  const isPaid = order?.status !== 'PENDING_PAYMENT';

  const handlePayNow = () => {
    if (!order) return;

    const paymentAny = order.payment as any;
    const paymentRef = paymentAny?.[0]?.gatewayRef || paymentAny?.gatewayRef;
    const authorizationUrl = paymentAny?.[0]?.metadata?.authorizationUrl || paymentAny?.metadata?.authorizationUrl;


    navigation.navigate('Payment', {
      orderId: order.id,
      amount: order.breakdown?.buyerTotal || order.totalAmount,
      currency: order.currency,
      // enable PaymentScreen reuse path
      reference: paymentRef,
      paymentSession: authorizationUrl ? { authorizationUrl } : undefined,
      checkoutSessionId: order.checkoutSession,
    });
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
          onPress: () => {
            cancelOrder.mutate(
              { orderId, reason: 'Cancelled by buyer' },
              {
                onSuccess: () => {
                  Alert.alert('Success', 'Order cancelled successfully', [
                    { text: 'OK', onPress: () => navigation.navigate('BuyerOrderManagement') },
                  ]);
                },
              }
            );
          },
        },
      ]
    );
  };

  const handleConfirmReceived = () => {
    Alert.alert(
      'Confirm Delivery',
      'By confirming, you acknowledge that you have received this order. Payment will be released to the seller.',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Confirm Receipt',
          onPress: async () => {
            setProcessingConfirm(true);
            const success = await confirmOrderReceived(orderId);
            setProcessingConfirm(false);

            if (success) {
              Alert.alert(
                'Success',
                'Order confirmed! Payment has been released to the seller.'
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

  const handleOpenDispute = () => {
    navigation.navigate('CreateDispute', { orderId });
  };

  const handleChatWithSeller = async () => {
    const sellerUserId = order?.store?.userId;
    if (!sellerUserId) {
      Alert.alert('Error', 'Cannot start chat: seller information missing.');
      return;
    }
    try {
      const chatRoom = await startDirectChat(sellerUserId);
      if (!chatRoom?.id) {
        Alert.alert('Error', 'Failed to open chat room.');
        return;
      }
      navigation.navigate('Chat', {
        chatRoomId: chatRoom.id,
        otherUserName: order?.store?.name || 'Seller',
        otherUserAvatar: order?.store?.logo || null,
        otherUserType: 'seller',
        storeName: order?.store?.name || 'Seller',
        storeLogo: order?.store?.logo || null,
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to start chat. Please try again later.');
    }
  };

  const handleViewTracking = () => {
    if (order?.deliveryInfo?.trackingNumber) {
      navigation.navigate('TrackOrder', {
        orderId: order.id,
        trackingNumber: order.deliveryInfo.trackingNumber,
      });
    }
  };

  const handleAddReview = (
    productId: string,
    productName: string,
    orderId: string,
    productImage: string
  ) => {
    navigation.navigate('ManageReview', { orderId, productId, productName, productImage });
  };


  const getTimelineSteps = (): TimelineStep[] => {
    if (!order) return [];

    const status = order.status;

    const completedAfter = (s: OrderStatus) =>
      (['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'] as OrderStatus[]).indexOf(s) >=
      (['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'] as OrderStatus[]).indexOf(status);

    return [
      {
        id: 'payment',
        title: isPaid ? 'Payment Confirmed' : 'Awaiting Payment',
        subtitle: isPaid
          ? 'Payment received successfully'
          : 'Complete payment to proceed',
        icon: isPaid ? 'checkmark-circle' : 'card-outline',
        completed: isPaid,
        active: status === 'PENDING_PAYMENT',
      },
      {
        id: 'processing',
        title: 'Processing',
        subtitle:
          status === 'PROCESSING'
            ? 'Seller is preparing your items'
            : ['SHIPPED', 'COMPLETED'].includes(status)
            ? 'Items prepared and dispatched'
            : 'Waiting to start processing',
        icon: 'cube-outline',
        completed: ['SHIPPED', 'COMPLETED'].includes(status),
        active: status === 'PROCESSING',
        timestamp: status === 'PROCESSING' ? order.updatedAt : undefined,
      },
      {
        id: 'shipped',
        title: 'Shipped',
        subtitle:
          status === 'SHIPPED'
            ? 'Package is on the way'
            : status === 'COMPLETED'
            ? 'Package delivered'
            : 'Not yet shipped',
        icon: 'send-outline',
        completed: status === 'COMPLETED',
        active: status === 'SHIPPED',
        timestamp:
          status === 'SHIPPED' || status === 'COMPLETED'
            ? order.deliveryInfo?.dispatchedAt || order.updatedAt
            : undefined,
      },
      {
        id: 'completed',
        title: 'Completed',
        subtitle:
          status === 'COMPLETED'
            ? 'Order confirmed and payment released'
            : 'Confirm receipt to complete',
        icon: 'checkmark-circle-outline',
        completed: status === 'COMPLETED',
        active: false,
        timestamp:
          status === 'COMPLETED'
            ? order.deliveryInfo?.buyerConfirmedAt || order.updatedAt
            : undefined,
      },
    ];
  };


  const getStatusColor = (): string => {
    switch (order?.status) {
      case 'PENDING_PAYMENT': return Colors.error;
      case 'PAID':            return Colors.info;
      case 'PROCESSING':      return Colors.primary;
      case 'SHIPPED':         return '#7C3AED';
      case 'COMPLETED':       return Colors.success;
      case 'DISPUTED':        return '#F97316';
      case 'CANCELLED':       return Colors.error;
      case 'REFUNDED':        return '#FF9500';
      default:                return Colors.textSecondary;
    }
  };

  const getStatusMessage = (): {
    title: string;
    message: string;
    icon: string;
    color: string;
  } => {
    switch (order?.status) {
      case 'PENDING_PAYMENT':
        return {
          title: 'Payment Required',
          message: 'Complete your payment to start processing your order. Your items are reserved.',
          icon: 'alert-circle-outline',
          color: Colors.error,
        };
      case 'PAID':
        return {
          title: 'Payment Confirmed',
          message: 'Payment received. Waiting for the seller to begin processing your order.',
          icon: 'checkmark-circle-outline',
          color: Colors.info,
        };
      case 'PROCESSING':
        return {
          title: 'Order Processing',
          message: 'The seller is preparing your items for shipment.',
          icon: 'cube-outline',
          color: Colors.primary,
        };
      case 'SHIPPED':
        return {
          title: 'On The Way',
          message: 'Your package has been dispatched and is on its way to you.',
          icon: 'send-outline',
          color: '#7C3AED',
        };
      case 'COMPLETED':
        return {
          title: 'Order Completed',
          message: 'Thank you! Share your experience by leaving a review.',
          icon: 'star-outline',
          color: Colors.success,
        };
      case 'DISPUTED':
        return {
          title: 'Dispute Under Review',
          message: 'Your dispute is being reviewed. We\'ll notify you once a decision is made.',
          icon: 'alert-circle-outline',
          color: '#F97316',
        };
      case 'CANCELLED':
        return {
          title: 'Order Cancelled',
          message: 'This order has been cancelled. Refund will be processed if applicable.',
          icon: 'close-circle-outline',
          color: Colors.error,
        };
      case 'REFUNDED':
        return {
          title: 'Refund Processed',
          message: 'Your refund has been processed successfully.',
          icon: 'cash-outline',
          color: '#FF9500',
        };
      default:
        return {
          title: 'Order Status',
          message: 'Processing your order...',
          icon: 'information-circle-outline',
          color: Colors.primary,
        };
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={styles.errorTitle}>Order Not Found</Text>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Unable to load order details'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backToOrdersButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backToOrdersText}>Back to Orders</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const safeItems = order.items || [];
  const timelineSteps = getTimelineSteps();
  const statusMessage = getStatusMessage();
  const statusColor = getStatusColor();
  const isActionLoading = cancelOrder.isPending || processingConfirm || escrowLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <TouchableOpacity onPress={handleChatWithSeller} style={styles.chatIconButton}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <LinearGradient
          colors={[`${statusColor}20`, `${statusColor}05`]}
          style={styles.statusBanner}
        >
          <View style={styles.statusBannerContent}>
            <View style={[styles.statusIconCircle, { backgroundColor: `${statusColor}30` }]}>
              <Ionicons name={statusMessage.icon as any} size={32} color={statusColor} />
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusBannerTitle}>{statusMessage.title}</Text>
              <Text style={styles.statusBannerMessage}>{statusMessage.message}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Payment Required Alert */}
        {order.status === 'PENDING_PAYMENT' && (
          <View style={styles.paymentAlert}>
            <View style={styles.paymentAlertContent}>
              <Ionicons name="warning" size={24} color={Colors.error} />
              <View style={styles.paymentAlertText}>
                <Text style={styles.paymentAlertTitle}>Payment Required</Text>
                <Text style={styles.paymentAlertSubtitle}>
                  Complete payment to start processing
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.payNowButton}
              onPress={handlePayNow}
              disabled={isActionLoading}
            >
              <Text style={styles.payNowText}>Pay Now</Text>
              <Text style={styles.payNowAmount}>
                {formatCurrency(order.breakdown?.buyerTotal || order.totalAmount, order.currency)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Order Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order ID</Text>
            <Text style={styles.infoValue}>#{order.id.slice(-8).toUpperCase()}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order Date</Text>
            <Text style={styles.infoValue}>
              {new Date(order.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={[styles.statusPill, { backgroundColor: `${statusColor}20` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusPillText, { color: statusColor }]}>
                {order.status?.replace('_', ' ')}
              </Text>
            </View>
          </View>
        </View>

        {/* Order Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.sectionTitle}>Order Timeline</Text>
          <View style={styles.timeline}>
            {timelineSteps.map((step, index) => (
              <View key={step.id} style={styles.timelineItem}>
                <View style={styles.timelineLeftColumn}>
                  <View
                    style={[
                      styles.timelineIconContainer,
                      step.completed && styles.timelineIconCompleted,
                      step.active && styles.timelineIconActive,
                    ]}
                  >
                    <Ionicons
                      name={step.icon as any}
                      size={20}
                      color={
                        step.completed
                          ? Colors.white
                          : step.active
                          ? Colors.primary
                          : Colors.textSecondary
                      }
                    />
                  </View>
                  {index < timelineSteps.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        step.completed && styles.timelineLineCompleted,
                      ]}
                    />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.timelineTitle,
                      (step.completed || step.active) && styles.timelineTitleActive,
                    ]}
                  >
                    {step.title}
                  </Text>
                  <Text style={styles.timelineSubtitle}>{step.subtitle}</Text>
                  {step.timestamp && (
                    <Text style={styles.timelineTimestamp}>
                      {new Date(step.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Tracking Card */}
        {order.status === 'SHIPPED' && order.deliveryInfo?.trackingNumber && (
          <TouchableOpacity style={styles.trackingCard} onPress={handleViewTracking}>
            <View style={styles.trackingContent}>
              <View style={styles.trackingIcon}>
                <MaterialCommunityIcons name="truck-delivery" size={28} color={Colors.primary} />
              </View>
              <View style={styles.trackingInfo}>
                <Text style={styles.trackingTitle}>Track Your Package</Text>
                <Text style={styles.trackingNumber}>
                  Tracking: {order.deliveryInfo.trackingNumber}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>
        )}

        {/* Store Info */}
        <View style={styles.storeCard}>
          <View style={styles.storeHeader}>
            <View style={styles.storeIconContainer}>
              <Ionicons name="storefront" size={24} color={Colors.primary} />
            </View>
            <View style={styles.storeInfo}>
              <Text style={styles.storeLabel}>Sold by</Text>
              <Text style={styles.storeName}>{order.store?.name || 'Store'}</Text>
            </View>
            <TouchableOpacity onPress={handleChatWithSeller} style={styles.storeChatButton}>
              <Ionicons name="chatbubble-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>
            Order Items ({safeItems.length})
          </Text>
          {safeItems.map((item: any, index: number) => (
            <View key={index} style={styles.productItem}>
              <Image
                source={{ uri: item.product?.images?.[0] || 'https://via.placeholder.com/80' }}
                style={styles.productImage}
              />
              <View style={styles.productDetails}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.product?.name || item.productName || item.name || 'Product'}
                </Text>
                <Text style={styles.productQuantity}>Qty: {item.quantity}</Text>
                <Text style={styles.productPrice}>
                  {formatCurrency(item.price, order.currency)}
                </Text>
              </View>
              <View style={styles.productTotal}>
                <Text style={styles.productTotalText}>
                  {formatCurrency(item.total, order.currency)}
                </Text>
              </View>
            </View>
          ))}

          {/* Price Breakdown */}
          <View style={styles.priceBreakdown}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Subtotal</Text>
              <Text style={styles.priceValue}>
                {formatCurrency(order.subtotal, order.currency)}
              </Text>
            </View>
            {order.deliveryFee > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Delivery Fee</Text>
                <Text style={styles.priceValue}>
                  {formatCurrency(order.deliveryFee, order.currency)}
                </Text>
              </View>
            )}
            {order.taxAmount > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Tax</Text>
                <Text style={styles.priceValue}>
                  {formatCurrency(order.taxAmount, order.currency)}
                </Text>
              </View>
            )}
            {order.breakdown?.platformFee > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Platform Fee</Text>
                <Text style={styles.priceValue}>
                  {formatCurrency(order.breakdown.platformFee, order.currency)}
                </Text>
              </View>
            )}
            {order.breakdown?.paystackFee > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Transaction Fee</Text>
                <Text style={styles.priceValue}>
                  {formatCurrency(order.breakdown.paystackFee, order.currency)}
                </Text>
              </View>
            )}
            {order.discount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: Colors.success }]}>Discount</Text>
                <Text style={[styles.priceValue, { color: Colors.success }]}>
                  -{formatCurrency(order.discount, order.currency)}
                </Text>
              </View>
            )}
            <View style={styles.priceDivider} />
            <View style={styles.priceRow}>
              <Text style={styles.priceTotalLabel}>
                {isPaid ? 'Amount Paid' : 'Required Payment'}
              </Text>
              <Text style={styles.priceTotalValue}>
                {formatCurrency(order.breakdown?.buyerTotal || order.totalAmount, order.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Delivery Address */}
        {order.deliveryInfo && (
          <View style={styles.addressCard}>
            <View style={styles.addressHeaderRow}>
              <Text style={styles.sectionTitle}>Delivery Address</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ManageAddresses')} style={styles.editAddressButton}>
                <Text style={styles.editAddressText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.addressContent}
              onPress={() => navigation.navigate('ManageAddresses')}
              activeOpacity={0.7}
            >
              <View style={styles.addressIconContainer}>
                <Ionicons name="location" size={24} color={Colors.primary} />
              </View>
              <View style={styles.addressDetails}>
                <Text style={styles.addressName}>{order.deliveryInfo.recipient || 'N/A'}</Text>
                <Text style={styles.addressPhone}>{order.deliveryInfo.phone || 'N/A'}</Text>
                <Text style={styles.addressText}>{order.deliveryInfo.address || 'N/A'}</Text>
                <Text style={styles.addressText}>
                  {order.deliveryInfo.city}, {order.deliveryInfo.region},{' '}
                  {order.deliveryInfo.country}
                </Text>
                {order.deliveryInfo.dispatchNote && (
                  <Text style={styles.addressText}>
                    Note: {order.deliveryInfo.dispatchNote}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Pay Now */}
          {order.status === 'PENDING_PAYMENT' && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handlePayNow}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="card" size={20} color={Colors.white} />
                  <Text style={styles.primaryButtonText}>
                    Pay Now ({formatCurrency(order.breakdown?.buyerTotal || order.totalAmount, order.currency)})
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Confirm Receipt — available from SHIPPED onward */}
          {order.status === 'SHIPPED' && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleConfirmReceived}
              disabled={isActionLoading}
            >
              {processingConfirm || escrowLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                  <Text style={styles.primaryButtonText}>Confirm Receipt</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Write Review */}
          {order.status === 'COMPLETED' && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                const firstItem = safeItems[0];
                handleAddReview(
                  firstItem?.product?.id || firstItem?.productId || '',
                  firstItem?.product?.name || firstItem?.productName || firstItem?.name || '',
                  order.id,
                  firstItem?.product?.images?.[0] || ''
                );
              }}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="star" size={20} color={Colors.white} />
                <Text style={styles.primaryButtonText}>Write a Review</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Secondary Actions */}
          <View style={styles.secondaryActions}>
            {/* Track Order */}
            {order.status === 'SHIPPED' && order.deliveryInfo?.trackingNumber && (
              <TouchableOpacity style={styles.secondaryButton} onPress={handleViewTracking}>
                <Ionicons name="navigate" size={20} color={Colors.primary} />
                <Text style={styles.secondaryButtonText}>Track Order</Text>
              </TouchableOpacity>
            )}

            {/* Open Dispute — available from SHIPPED onwards */}
            {isPaid && ['SHIPPED', 'COMPLETED'].includes(order.status) && (
              <TouchableOpacity style={styles.secondaryButton} onPress={handleOpenDispute}>
                <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
                <Text style={[styles.secondaryButtonText, { color: Colors.error }]}>
                  Open Dispute
                </Text>
              </TouchableOpacity>
            )}

            {/* Cancel Order */}
            {order.status === 'PENDING_PAYMENT' && (
              <TouchableOpacity
                style={[styles.secondaryButton, styles.cancelButton]}
                onPress={handleCancelOrder}
                disabled={isActionLoading}
              >
                {cancelOrder.isPending ? (
                  <ActivityIndicator size="small" color={Colors.error} />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={20} color={Colors.error} />
                    <Text style={[styles.secondaryButtonText, { color: Colors.error }]}>
                      Cancel Order
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Chat with Seller */}
            <TouchableOpacity style={styles.secondaryButton} onPress={handleChatWithSeller}>
              <Ionicons name="chatbubbles" size={20} color={Colors.primary} />
              <Text style={styles.secondaryButtonText}>Chat with Seller</Text>
            </TouchableOpacity>
          </View>
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
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
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
    marginBottom: 12,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  backToOrdersButton: {
    backgroundColor: Colors.white,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backToOrdersText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  chatIconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statusBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  statusIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statusBannerMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  paymentAlert: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.error,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  paymentAlertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentAlertText: {
    flex: 1,
    marginLeft: 12,
  },
  paymentAlertTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.error,
    marginBottom: 2,
  },
  paymentAlertSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  payNowButton: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  payNowText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  payNowAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  infoCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timelineCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  timeline: {
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineLeftColumn: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  timelineIconCompleted: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timelineIconActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  timelineLineCompleted: {
    backgroundColor: Colors.primary,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 24,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  timelineTitleActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  timelineSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  timelineTimestamp: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  trackingCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  trackingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  trackingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  trackingInfo: {
    flex: 1,
  },
  trackingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  trackingNumber: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  storeCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storeInfo: {
    flex: 1,
  },
  storeLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  storeChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  productItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
    lineHeight: 20,
  },
  productQuantity: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  productTotal: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  productTotalText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  priceBreakdown: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: Colors.border,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  priceDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  priceTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  priceTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  addressCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  addressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  editAddressButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editAddressText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  addressContent: {
    flexDirection: 'row',
  },
  addressIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addressDetails: {
    flex: 1,
  },
  addressName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  addressPhone: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  actionsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  cancelButton: {
    borderColor: Colors.error,
  },
  bottomSpacing: {
    height: 60,
  },
});

export default OrderDetails;