import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useDisputes, Dispute, DisputeStatus, DisputeType } from '../../hooks/useDisputes';
import { Colors } from '../../constants/colors';

const DisputesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { loading, error, getUserDisputes, clearError } = useDisputes();

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<DisputeStatus | 'ALL'>('ALL');
  const [stats, setStats] = useState({
    pending: 0,
    resolved: 0,
    cancelled: 0,
  });

  useEffect(() => {
    loadDisputes();
  }, [selectedStatus]);

  useFocusEffect(
    useCallback(() => {
      loadDisputes();
    }, [selectedStatus])
  );

  const loadDisputes = async (pageNum: number = 1) => {
    try {
      const status = selectedStatus === 'ALL' ? undefined : selectedStatus;
      const result = await getUserDisputes(pageNum, 10, status);

      if (result) {
        if (pageNum === 1) {
          setDisputes(result.disputes);
        } else {
          setDisputes((prev) => [...prev, ...result.disputes]);
        }

        setHasMore(result.pagination.page < result.pagination.totalPages);
        setPage(pageNum);

        // Calculate stats
        const allDisputes = await getUserDisputes(1, 1000);
        if (allDisputes) {
          const pending = allDisputes.disputes.filter((d) => d.status === 'PENDING').length;
          const resolved = allDisputes.disputes.filter((d) => d.status === 'RESOLVED').length;
          const cancelled = allDisputes.disputes.filter((d) => d.status === 'CANCELLED').length;
          setStats({ pending, resolved, cancelled });
        }
      }
    } catch (err) {
      console.error('Error loading disputes:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDisputes(1);
    setRefreshing(false);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      loadDisputes(page + 1);
    }
  };

  const getDisputeTypeLabel = (type: DisputeType): string => {
    const labels: Record<DisputeType, string> = {
      REFUND_REQUEST: 'Refund Request',
      ITEM_NOT_AS_DESCRIBED: 'Not as Described',
      ITEM_NOT_RECEIVED: 'Not Received',
      WRONG_ITEM_SENT: 'Wrong Item',
      DAMAGED_ITEM: 'Damaged Item',
      OTHER: 'Other',
    };
    return labels[type] || type;
  };

  const getDisputeTypeIcon = (type: DisputeType): string => {
    const icons: Record<DisputeType, string> = {
      REFUND_REQUEST: 'cash-outline',
      ITEM_NOT_AS_DESCRIBED: 'alert-circle-outline',
      ITEM_NOT_RECEIVED: 'cube-outline',
      WRONG_ITEM_SENT: 'swap-horizontal-outline',
      DAMAGED_ITEM: 'warning-outline',
      OTHER: 'help-circle-outline',
    };
    return icons[type] || 'help-circle-outline';
  };

  const getStatusColor = (status: DisputeStatus) => {
    switch (status) {
      case 'PENDING':
        return Colors.warning;
      case 'RESOLVED':
        return Colors.success;
      case 'CANCELLED':
        return Colors.gray400;
      default:
        return Colors.gray400;
    }
  };

  const getStatusBgColor = (status: DisputeStatus) => {
    switch (status) {
      case 'PENDING':
        return Colors.warningLight;
      case 'RESOLVED':
        return Colors.successLight;
      case 'CANCELLED':
        return Colors.gray100;
      default:
        return Colors.gray100;
    }
  };

  const StatusFilter = ({ status, label, count }: any) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedStatus === status && styles.filterButtonActive,
      ]}
      onPress={() => setSelectedStatus(status)}
    >
      <Text
        style={[
          styles.filterButtonText,
          selectedStatus === status && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.filterBadge,
          selectedStatus === status && styles.filterBadgeActive,
        ]}
      >
        <Text
          style={[
            styles.filterBadgeText,
            selectedStatus === status && styles.filterBadgeTextActive,
          ]}
        >
          {count}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const DisputeCard = ({ dispute }: { dispute: Dispute }) => (
    <TouchableOpacity
      style={styles.disputeCard}
      onPress={() => (navigation as any).navigate('DisputeDetails', { disputeId: dispute.id })}
    >
      <View style={styles.disputeHeader}>
        <View style={styles.disputeTypeContainer}>
          <View style={[styles.disputeTypeIcon, { backgroundColor: getStatusBgColor(dispute.status) }]}>
            <Ionicons
              name={getDisputeTypeIcon(dispute.type) as any}
              size={20}
              color={getStatusColor(dispute.status)}
            />
          </View>
          <View style={styles.disputeHeaderText}>
            <Text style={styles.disputeType}>{getDisputeTypeLabel(dispute.type)}</Text>
            <Text style={styles.orderId}>Order #{dispute.orderId.slice(0, 8)}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(dispute.status) }]}>
          <Text style={[styles.statusText, { color: getStatusColor(dispute.status) }]}>
            {dispute.status}
          </Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {dispute.description}
      </Text>

      {dispute.order && (
        <View style={styles.orderInfo}>
          <View style={styles.orderInfoRow}>
            <Ionicons name="storefront-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.orderInfoText}>
              {dispute.order.store?.name || 'Unknown Store'}
            </Text>
          </View>
          <View style={styles.orderInfoRow}>
            <Ionicons name="cash-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.orderInfoText}>
              {dispute.order.currency || 'GHS'} {dispute.order.totalAmount.toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.disputeFooter}>
        <View style={styles.dateContainer}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textTertiary} />
          <Text style={styles.dateText}>
            {new Date(dispute.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.viewDetails}>
          <Text style={styles.viewDetailsText}>View Details</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <MaterialIcons name="gavel" size={64} color={Colors.gray300} />
      </View>
      <Text style={styles.emptyTitle}>No Disputes Found</Text>
      <Text style={styles.emptyMessage}>
        {selectedStatus === 'ALL'
          ? "You don't have any disputes yet."
          : `You don't have any ${selectedStatus.toLowerCase()} disputes.`}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={24} color={Colors.warning} />
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle-outline" size={24} color={Colors.success} />
          <Text style={styles.statValue}>{stats.resolved}</Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="close-circle-outline" size={24} color={Colors.gray400} />
          <Text style={styles.statValue}>{stats.cancelled}</Text>
          <Text style={styles.statLabel}>Cancelled</Text>
        </View>
      </View>

      {/* Status Filters */}
      <View style={styles.filtersContainer}>
        <StatusFilter status="ALL" label="All" count={stats.pending + stats.resolved + stats.cancelled} />
        <StatusFilter status="PENDING" label="Pending" count={stats.pending} />
        <StatusFilter status="RESOLVED" label="Resolved" count={stats.resolved} />
        <StatusFilter status="CANCELLED" label="Cancelled" count={stats.cancelled} />
      </View>

      {/* Disputes List */}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={disputes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DisputeCard dispute={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={EmptyState}
          ListFooterComponent={
            loading && page > 1 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.white,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterButtonTextActive: {
    color: Colors.white,
  },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeActive: {
    backgroundColor: Colors.primaryLight,
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  filterBadgeTextActive: {
    color: Colors.white,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  disputeCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  disputeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  disputeTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  disputeTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  disputeHeaderText: {
    flex: 1,
  },
  disputeType: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  orderId: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginBottom: 12,
  },
  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderInfoText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  disputeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default DisputesScreen;