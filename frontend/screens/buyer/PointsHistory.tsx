import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { usePoints, Order } from '../../hooks/usePoints';

const PointsHistoryScreen = () => {
  const navigation = useNavigation();
  const { getPointsHistory, loading, error } = usePoints();

  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalRedemptions, setTotalRedemptions] = useState(0);
  const [totalPointsRedeemed, setTotalPointsRedeemed] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async (pageNum = 1, append = false) => {
    if (pageNum === 1 && !append) {
      setRefreshing(true);
    } else {
      setLoadingMore(true);
    }

    const data = await getPointsHistory(pageNum, 20);

    if (data) {
      if (append) {
        setOrders((prev) => [...prev, ...data.orders]);
      } else {
        setOrders(data.orders);
      }
      setPage(pageNum);
      setHasNextPage(data.pagination.hasNextPage);
      setTotalRedemptions(data.summary.totalRedemptions);
      setTotalPointsRedeemed(data.summary.totalPointsRedeemed);
    }

    setRefreshing(false);
    setLoadingMore(false);
  };

  const onRefresh = () => {
    loadHistory(1, false);
  };

  const loadMore = () => {
    if (!loadingMore && hasNextPage) {
      loadHistory(page + 1, true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return Colors.success;
      case 'CONFIRMED':
      case 'PROCESSING':
        return Colors.info;
      case 'SHIPPED':
      case 'OUT_FOR_DELIVERY':
        return Colors.primary;
      case 'DELIVERED':
        return Colors.success;
      case 'CANCELLED':
        return Colors.error;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
      case 'DELIVERED':
        return 'checkmark-circle';
      case 'CONFIRMED':
      case 'PROCESSING':
        return 'time';
      case 'SHIPPED':
      case 'OUT_FOR_DELIVERY':
        return 'cube';
      case 'CANCELLED':
        return 'close-circle';
      default:
        return 'ellipse';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const renderSummaryCard = () => (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <Ionicons name="stats-chart" size={24} color={Colors.primary} />
        <Text style={styles.summaryTitle}>Redemption Summary</Text>
      </View>

      <View style={styles.summaryContent}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Redemptions</Text>
          <Text style={styles.summaryValue}>{totalRedemptions}</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Points Used</Text>
          <Text style={styles.summaryValue}>
            {totalPointsRedeemed.toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderOrderItem = ({ item }: { item: Order }) => {
    const pointsUsed = Math.ceil(item.totalAmount);
    const firstProduct = item.items[0]?.product;
    const imageUri =
      firstProduct?.images && firstProduct.images.length > 0
        ? firstProduct.images[0]
        : 'https://via.placeholder.com/80';

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => (navigation as any).navigate('OrderDetails', { orderId: item.id })}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderIdContainer}>
            <Text style={styles.orderIdLabel}>Order</Text>
            <Text style={styles.orderIdValue}>#{item.id.slice(-8)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
            <Ionicons
              name={getStatusIcon(item.status)}
              size={14}
              color={getStatusColor(item.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.orderContent}>
          <Image source={{ uri: imageUri }} style={styles.productThumbnail} />

          <View style={styles.orderDetails}>
            <Text style={styles.productName} numberOfLines={2}>
              {firstProduct?.name || 'Product'}
            </Text>
            {item.items.length > 1 && (
              <Text style={styles.moreItems}>
                +{item.items.length - 1} more item{item.items.length - 1 > 1 ? 's' : ''}
              </Text>
            )}
            <Text style={styles.storeName}>{item.store.name}</Text>
          </View>

          <View style={styles.orderRight}>
            <View style={styles.pointsBadge}>
              <Ionicons name="gift" size={16} color={Colors.primary} />
              <Text style={styles.pointsValue}>{pointsUsed}</Text>
            </View>
            <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.orderFooter}>
          <View style={styles.itemCount}>
            <Ionicons name="cube-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.itemCountText}>
              {item.items.reduce((sum, item) => sum + item.quantity, 0)} item
              {item.items.reduce((sum, item) => sum + item.quantity, 0) > 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => (navigation as any).navigate('OrderDetails', { orderId: item.id })}
          >
            <Text style={styles.viewButtonText}>View Details</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="time-outline" size={64} color={Colors.gray300} />
      <Text style={styles.emptyTitle}>No Redemption History</Text>
      <Text style={styles.emptyText}>
        You haven't redeemed any points yet. Browse products and start redeeming your points!
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => (navigation as any).navigate('Points')}
      >
        <Text style={styles.browseButtonText}>Browse Products</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

  if (loading && !refreshing && orders.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={orders.length > 0 ? renderSummaryCard : null}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[
          styles.listContent,
          orders.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </View>
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyListContent: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginLeft: 12,
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  orderIdLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  orderIdValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderContent: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  productThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.gray100,
  },
  orderDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  moreItems: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  storeName: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  orderRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  pointsValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  orderDate: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  itemCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemCountText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default PointsHistoryScreen;