import React, { useEffect, useState, useCallback } from 'react';
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
import { useOrders, Order } from '../../hooks/useOrder';
import { Colors } from '../../constants/colors';

const UnpaidOrdersScreen = () => {
  const navigation = useNavigation();
  const {
    getUnpaidOrders,
    getUnpaidOrdersSummary,
    cancelUnpaidOrder,
    loading,
    error,
  } = useOrders();

  const [unpaidOrders, setUnpaidOrders] = useState<Order[]>([]);
  const [ordersByStore, setOrdersByStore] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Fetch unpaid orders
  const fetchUnpaidOrders = useCallback(async (pageNum: number = 1, refresh: boolean = false) => {
    try {
      const response = await getUnpaidOrders(pageNum, 10);
      
      if (response) {
        if (refresh) {
          setUnpaidOrders(response.orders);
        } else {
          setUnpaidOrders(prev => [...prev, ...response.orders]);
        }
        setOrdersByStore(response.ordersByStore);
        setSummary(response.summary);
        setHasMore(response.pagination.hasNextPage);
      }
    } catch (err) {
      console.error('Error fetching unpaid orders:', err);
    }
  }, [getUnpaidOrders]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const summaryData = await getUnpaidOrdersSummary();
      if (summaryData) {
        setSummary(summaryData);
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, [getUnpaidOrdersSummary]);

  // Initial load
  useEffect(() => {
    fetchUnpaidOrders(1, true);
    fetchSummary();
  }, []);

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchUnpaidOrders(1, true);
      fetchSummary();
    }, [])
  );

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await fetchUnpaidOrders(1, true);
    await fetchSummary();
    setRefreshing(false);
  };

  // Load more orders
  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchUnpaidOrders(nextPage, false);
    }
  };

  // Handle cancel order
  const handleCancelOrder = (orderId: string) => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this unpaid order? Product stock will be restored.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingOrderId(orderId);
            const success = await cancelUnpaidOrder(orderId);
            
            if (success) {
              Alert.alert('Success', 'Order cancelled successfully');
              // Refresh the list
              await fetchUnpaidOrders(1, true);
              await fetchSummary();
            } else {
              Alert.alert('Error', error || 'Failed to cancel order');
            }
            setCancellingOrderId(null);
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
    });
  };

  // Handle proceed to payment for all orders from a store
  const handlePayAllFromStore = (storeOrders: Order[], storeName: string) => {
    (navigation as any).navigate('Payment', { 
      orders: storeOrders.map(order => ({
        orderId: order.id,
        storeName: storeName,
        checkoutSession: order.checkoutSession || order.id,
      })),
      totalOrders: storeOrders.length,
    });
  };

  // Handle proceed to payment for all unpaid orders
  const handlePayAllOrders = () => {
    const ordersForPayment = unpaidOrders.map(order => ({
      orderId: order.id,
      storeName: order.store?.name || 'Store',
      checkoutSession: order.checkoutSession || order.id,
    }));

    (navigation as any).navigate('Payment', { 
      orders: ordersForPayment,
      totalOrders: ordersForPayment.length,
    });
  };

  // Handle view order details
  const handleViewDetails = (orderId: string) => {
    (navigation as any).navigate('OrderDetails', { orderId });
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'GHS') => {
    return `${currency} ${amount.toFixed(2)}`;
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
    const isCancelling = cancellingOrderId === order.id;

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
                  {item.product?.name || 'Product'}
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
            <Ionicons name="eye-outline" size={18} color={Colors.primary} />
            <Text style={styles.viewDetailsText}>View Details</Text>
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
                <Ionicons name="close-circle-outline" size={18} color={Colors.white} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.payButton}
            onPress={() => handleProceedToPayment(order)}
          >
            <Ionicons name="card-outline" size={18} color={Colors.white} />
            <Text style={styles.payButtonText}>Pay Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render summary card
  const renderSummary = () => {
    if (!summary) return null;

    return (
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Ionicons name="wallet-outline" size={24} color={Colors.primary} />
          <Text style={styles.summaryTitle}>Unpaid Orders Summary</Text>
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.totalUnpaidOrders}</Text>
            <Text style={styles.summaryLabel}>Total Orders</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {formatCurrency(summary.totalAmount, summary.currency)}
            </Text>
            <Text style={styles.summaryLabel}>Total Amount</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.totalItems}</Text>
            <Text style={styles.summaryLabel}>Total Items</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.uniqueStores}</Text>
            <Text style={styles.summaryLabel}>Stores</Text>
          </View>
        </View>

        {/* Pay All Button */}
        {summary.totalUnpaidOrders > 0 && (
          <TouchableOpacity
            style={styles.payAllButton}
            onPress={handlePayAllOrders}
          >
            <Ionicons name="card" size={20} color={Colors.white} />
            <Text style={styles.payAllButtonText}>
              Pay All Orders ({summary.totalUnpaidOrders})
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Empty state
  if (!loading && unpaidOrders.length === 0) {
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
            refreshing={refreshing}
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
        {/* Summary Card */}
        {renderSummary()}

        {/* Alert Banner */}
        <View style={styles.alertBanner}>
          <Ionicons name="alert-circle-outline" size={20} color={Colors.warning} />
          <Text style={styles.alertText}>
            Complete payment to secure your orders
          </Text>
        </View>

        {/* Orders List */}
        <View style={styles.ordersContainer}>
          <Text style={styles.sectionTitle}>Your Unpaid Orders</Text>
          {unpaidOrders.map(order => renderOrderCard(order))}
        </View>

        {/* Loading More Indicator */}
        {loading && page > 1 && (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingMoreText}>Loading more orders...</Text>
          </View>
        )}
      </ScrollView>

      {/* Initial Loading */}
      {loading && page === 1 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading unpaid orders...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  payAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 16,
  },
  payAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginLeft: 8,
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
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 4,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
    borderRadius: 8,
    paddingVertical: 10,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    marginLeft: 4,
  },
  payButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    borderRadius: 8,
    paddingVertical: 10,
  },
  payButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    marginLeft: 4,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
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