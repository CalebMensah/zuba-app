import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { 
  useUnpaidOrders, 
  useCancelUnpaidOrder,
  formatCurrency,
  orderKeys 
} from '../../hooks/useOrder';
import socketService from '../../services/socketServices';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { Colors } from '../../constants/colors';
import { Order } from '../../types/order';

const UnpaidOrdersScreen = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  
  // TanStack Query hooks
  const { data: ordersData, isLoading, error, refetch } = useUnpaidOrders({
    page,
    limit: 10,
  });
  const cancelUnpaidOrder = useCancelUnpaidOrder();

  // Socket listener for real-time order cancels
  useEffect(() => {
    const handleOrderCancelled = (data: { userId: string; orderId: string }) => {
      if (data.userId === 'current-user-id') { // Replace with actual user ID from context
        queryClient.invalidateQueries({ queryKey: orderKeys.unpaid() });
        console.log('Order cancelled via socket:', data.orderId);
      }
    };

    socketService.onOrderCancelled(handleOrderCancelled);

    return () => {
      socketService.off('order_cancelled');
    };
  }, [queryClient]);


  // Refetch on screen focus
  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Pull to refresh
  const onRefresh = () => {
    setPage(1);
    refetch();
  };

  // Load more orders
  const loadMore = () => {
    if (ordersData?.pagination?.hasNextPage && !isLoading) {
      setPage(prev => prev + 1);
    }
  };

  // Handle cancel order
  const handleCancelOrder = (orderId: string) => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this unpaid order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            cancelUnpaidOrder.mutate(orderId, {
              onSuccess: () => {
                Alert.alert('Success', 'Order cancelled successfully');
              },
            });
          },
        },
      ]
    );
  };

  // Handle proceed to payment for single order
  const handleProceedToPayment = (order: Order) => {
    (navigation as any).navigate('Payment', { 
      orders: [{
        orderId: order.id,
        storeName: order.store?.name || 'Store',
        checkoutSession: order.checkoutSession || order.id,
      }],
      totalOrders: 1,
      checkoutSessionId: order.checkoutSession || order.id,
    });
  };

  // Handle view order details
  const handleViewDetails = (orderId: string) => {
    (navigation as any).navigate('OrderDetails', { orderId });
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Render order card
  const renderOrderCard = (order: Order) => {
    const isCancelling = cancelUnpaidOrder.isPending && cancelUnpaidOrder.variables === order.id;

    return (
      <View key={order.id} style={styles.orderCard}>
        {/* Order Header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Text style={styles.orderIdText}>Order #{order.id.slice(0, 8)}</Text>
            <Text style={styles.orderDateText}>{formatDate(order.createdAt)}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>UNPAID</Text>
          </View>
        </View>

        {/* Store Info */}
        {order.store && (
          <View style={styles.storeInfo}>
            {order.store.logo ? (
              <Image source={{ uri: order.store.logo }} style={styles.storeLogo} />
            ) : (
              <View style={[styles.storeLogo, styles.storeLogoPlaceholder]}>
                <Ionicons name="storefront" size={16} color={Colors.gray400} />
              </View>
            )}
            <Text style={styles.storeNameText}>{order.store.name}</Text>
          </View>
        )}

        {/* Order Items */}
        <View style={styles.itemsContainer}>
          {order.items.slice(0, 2).map((item, index) => (
            <View key={index} style={styles.itemRow}>
              {item.product?.images?.[0] ? (
                <Image
                  source={{ uri: item.product.images[0] }}
                  style={styles.productImage}
                />
              ) : (
                <View style={[styles.productImage, styles.productImagePlaceholder]}>
                  <Ionicons name="image-outline" size={20} color={Colors.gray400} />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.product?.name || item.productName || item.name || 'Product'}
                </Text>
                <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>
                {formatCurrency(item.total, order.currency)}
              </Text>
            </View>
          ))}
          {order.items.length > 2 && (
            <Text style={styles.moreItemsText}>
              +{order.items.length - 2} more item{order.items.length - 2 > 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* Order Total */}
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Amount:</Text>
          <Text style={styles.totalAmount}>
            {formatCurrency(order.totalAmount, order.currency)}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={() => handleViewDetails(order.id)}
          >
            <Ionicons name="eye-outline" size={14} color={Colors.primary} />
            <Text style={styles.viewDetailsText}>Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelButton, isCancelling && styles.cancelButtonDisabled]}
            onPress={() => handleCancelOrder(order.id)}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={14} color={Colors.white} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.payButton}
            onPress={() => handleProceedToPayment(order)}
          >
            <Ionicons name="card-outline" size={14} color={Colors.white} />
            <Text style={styles.payButtonText}>Pay</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Loading state
  if (isLoading && page === 1) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading unpaid orders...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error && !ordersData) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={styles.errorTitle}>Failed to Load Orders</Text>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Unable to load unpaid orders'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const unpaidOrders = ordersData?.orders || [];

  // Empty state
  if (unpaidOrders.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={80} color={Colors.gray300} />
          <Text style={styles.emptyStateTitle}>No Unpaid Orders</Text>
          <Text style={styles.emptyStateText}>
            All your orders have been paid for. Great job!
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => (navigation as any).navigate('BuyerHome')}
          >
            <Text style={styles.shopButtonText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
          if (isCloseToBottom) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {/* Alert Banner */}
        <View style={styles.alertBanner}>
          <Ionicons name="alert-circle-outline" size={20} color={Colors.warning} />
          <Text style={styles.alertText}>
            Complete payment to secure your orders
          </Text>
        </View>

        {/* Summary Info */}
        {ordersData?.summary && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Orders</Text>
                <Text style={styles.summaryValue}>{ordersData.summary.totalUnpaidOrders}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Amount</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(ordersData.summary.totalAmount, ordersData.summary.currency)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Orders List */}
        <View style={styles.ordersContainer}>
          <Text style={styles.sectionTitle}>Your Unpaid Orders ({unpaidOrders.length})</Text>
          {unpaidOrders.map(order => renderOrderCard(order))}
        </View>

        {/* Loading More Indicator */}
        {isLoading && page > 1 && (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingMoreText}>Loading more orders...</Text>
          </View>
        )}

        {/* No More Orders */}
        {!isLoading && !ordersData?.pagination?.hasNextPage && unpaidOrders.length > 0 && (
          <View style={styles.endOfList}>
            <Text style={styles.endOfListText}>You've reached the end</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    marginTop: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  alertText: {
    fontSize: 14,
    color: Colors.warning,
    marginLeft: 8,
    flex: 1,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 16,
  },
  ordersContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  orderDateText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusBadge: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  storeLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  storeLogoPlaceholder: {
    backgroundColor: Colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeNameText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  itemsContainer: {
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  productImagePlaceholder: {
    backgroundColor: Colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  moreItemsText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  viewDetailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
    borderRadius: 8,
    paddingVertical: 8,
    gap: 4,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  payButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    borderRadius: 8,
    paddingVertical: 8,
    gap: 4,
  },
  payButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  endOfList: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  endOfListText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
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
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  shopButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default UnpaidOrdersScreen;