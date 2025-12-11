import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { usePayment } from '../../hooks/usePayment';

type FilterStatus = 'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED';

const UserPaymentsScreen = () => {
  const navigation = useNavigation();
  const {
    getUserPayments,
    payments,
    pagination,
    loading,
    error,
    clearPayments,
  } = usePayment();

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadPayments();
    return () => clearPayments();
  }, []);

  const loadPayments = async (page = 1, status?: string) => {
    try {
      setCurrentPage(page);
      const filterStatus = status || (statusFilter !== 'ALL' ? statusFilter : undefined);
      await getUserPayments(page, 10, filterStatus);
    } catch (err) {
      console.error('Failed to load payments:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPayments(1);
    setRefreshing(false);
  };

  const handleStatusFilterChange = (status: FilterStatus) => {
    setStatusFilter(status);
    setShowFilters(false);
    loadPayments(1, status !== 'ALL' ? status : undefined);
  };

  const handleLoadMore = () => {
    if (pagination && currentPage < pagination.totalPages && !loading) {
      loadPayments(currentPage + 1);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return Colors.success;
      case 'PENDING':
        return Colors.warning;
      case 'FAILED':
        return Colors.error;
      default:
        return Colors.gray500;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return '#D1FAE5';
      case 'PENDING':
        return Colors.warningLight;
      case 'FAILED':
        return Colors.errorLight;
      default:
        return Colors.gray100;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'checkmark-circle';
      case 'PENDING':
        return 'time';
      case 'FAILED':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffInDays === 1) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const calculateTotalAmount = () => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const getSuccessfulPaymentsCount = () => {
    return payments.filter(p => p.status === 'SUCCESS').length;
  };

  const renderSummaryCard = () => {
    if (payments.length === 0) return null;

    const totalAmount = calculateTotalAmount();
    const successCount = getSuccessfulPaymentsCount();
    const successRate = ((successCount / payments.length) * 100).toFixed(0);

    return (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Payment Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconContainer}>
              <Ionicons name="wallet" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.summaryLabel}>Total Spent</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(totalAmount, payments[0]?.currency || 'GHS')}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconContainer}>
              <Ionicons name="receipt" size={20} color={Colors.success} />
            </View>
            <Text style={styles.summaryLabel}>Transactions</Text>
            <Text style={styles.summaryValue}>{payments.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconContainer}>
              <Ionicons name="checkmark-done" size={20} color={Colors.info} />
            </View>
            <Text style={styles.summaryLabel}>Success Rate</Text>
            <Text style={styles.summaryValue}>{successRate}%</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderPaymentItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.paymentCard}
      onPress={() => (navigation as any).navigate('PaymentDetails' as never, { paymentId: item.id } as never)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.storeInfo}>
          <View style={styles.storeIconContainer}>
            <Ionicons name="storefront" size={20} color={Colors.primary} />
          </View>
          <View style={styles.storeDetails}>
            <Text style={styles.storeName}>{item.order.store.name}</Text>
            <Text style={styles.orderId}>Order #{item.orderId.slice(0, 8)}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(item.status) }]}>
          <Ionicons 
            name={getStatusIcon(item.status) as any} 
            size={12} 
            color={getStatusColor(item.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.paymentInfo}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Amount</Text>
            <Text style={styles.infoValue}>
              {formatCurrency(item.amount, item.currency)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Gateway</Text>
            <Text style={styles.infoValue}>{item.gateway.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Reference</Text>
            <Text style={styles.infoValueSmall} numberOfLines={1}>
              {item.gatewayRef}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValueSmall}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.viewDetailsButton}>
          <Text style={styles.viewDetailsText}>View Details</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
        </View>
      </View>

      {item.order.checkoutSession && (
        <View style={styles.multiStoreBadge}>
          <Ionicons name="git-merge" size={12} color={Colors.info} />
          <Text style={styles.multiStoreText}>Multi-Store Purchase</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFilters(false)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setShowFilters(false)}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter by Status</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterOptions}>
            {['ALL', 'SUCCESS', 'PENDING', 'FAILED'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterOption,
                  statusFilter === status && styles.filterOptionActive,
                ]}
                onPress={() => handleStatusFilterChange(status as FilterStatus)}
              >
                <View style={styles.filterOptionContent}>
                  {status !== 'ALL' && (
                    <Ionicons 
                      name={getStatusIcon(status) as any}
                      size={20} 
                      color={statusFilter === status ? Colors.white : getStatusColor(status)} 
                    />
                  )}
                  <Text
                    style={[
                      styles.filterOptionText,
                      statusFilter === status && styles.filterOptionTextActive,
                    ]}
                  >
                    {status === 'ALL' ? 'All Payments' : status}
                  </Text>
                </View>
                {statusFilter === status && (
                  <Ionicons name="checkmark" size={24} color={Colors.white} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.headerTitle}>My Payments</Text>
          <Text style={styles.headerSubtitle}>
            {pagination ? `${pagination.total} total transaction${pagination.total !== 1 ? 's' : ''}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.filterHeaderButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options" size={24} color={Colors.primary} />
          {statusFilter !== 'ALL' && <View style={styles.filterBadge} />}
        </TouchableOpacity>
      </View>

      {statusFilter !== 'ALL' && (
        <View style={styles.activeFilterContainer}>
          <View style={styles.activeFilterChip}>
            <Ionicons name={getStatusIcon(statusFilter) as any} size={14} color={getStatusColor(statusFilter)} />
            <Text style={styles.activeFilterText}>Showing {statusFilter} payments</Text>
            <TouchableOpacity onPress={() => handleStatusFilterChange('ALL')}>
              <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {renderSummaryCard()}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="wallet-outline" size={80} color={Colors.gray300} />
      </View>
      <Text style={styles.emptyTitle}>
        {statusFilter !== 'ALL' ? `No ${statusFilter.toLowerCase()} payments` : 'No Payments Yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {statusFilter !== 'ALL' 
          ? 'Try changing your filter to see other payments' 
          : 'Your payment history will appear here when you make purchases'}
      </Text>
      {statusFilter !== 'ALL' && (
        <TouchableOpacity 
          style={styles.clearFilterButton}
          onPress={() => handleStatusFilterChange('ALL')}
        >
          <Text style={styles.clearFilterButtonText}>View All Payments</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={20} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={payments}
        renderItem={renderPaymentItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!loading ? renderEmpty : null}
        ListFooterComponent={
          loading && payments.length > 0 ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading more...</Text>
            </View>
          ) : pagination && currentPage < pagination.totalPages ? (
            <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
              <Text style={styles.loadMoreText}>Load More</Text>
              <Ionicons name="chevron-down" size={20} color={Colors.primary} />
            </TouchableOpacity>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={[
          styles.listContent,
          payments.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      />

      {renderFilterModal()}

      {loading && payments.length === 0 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingOverlayText}>Loading your payments...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    marginTop:30,
  },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  filterHeaderButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  activeFilterContainer: {
    marginBottom: 16,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
  },
  activeFilterText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  paymentCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storeDetails: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  orderId: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  paymentInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  infoValueSmall: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewDetailsText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  multiStoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  multiStoreText: {
    fontSize: 12,
    color: Colors.info,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  clearFilterButton: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  clearFilterButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    padding: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  filterOptions: {
    gap: 12,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  filterOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  filterOptionTextActive: {
    color: Colors.white,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingOverlayText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});

export default UserPaymentsScreen;