import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
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
type FilterGateway = 'ALL' | 'paystack';

const PaymentsScreen = () => {
  const navigation = useNavigation();
  const {
    getAllPayments,
    adminPayments,
    adminStatistics,
    adminPagination,
    loading,
    error,
    clearAdminPayments,
  } = usePayment();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadPayments();
    return () => clearAdminPayments();
  }, []);

  const loadPayments = async (page = 1) => {
    try {
      const filters: any = { page, limit: 20 };
      
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      if (currencyFilter !== 'ALL') filters.currency = currencyFilter;
      if (searchQuery.trim()) filters.search = searchQuery.trim();

      await getAllPayments(filters);
    } catch (err) {
      console.error('Failed to load payments:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPayments(1);
    setRefreshing(false);
  };

  const handleSearch = () => {
    loadPayments(1);
  };

  const handleStatusFilterChange = (status: FilterStatus) => {
    setStatusFilter(status);
    setShowFilters(false);
  };

  const handleCurrencyFilterChange = (currency: string) => {
    setCurrencyFilter(currency);
  };

  const handleLoadMore = () => {
    if (adminPagination && adminPagination.hasMore && !loading) {
      loadPayments(adminPagination.page + 1);
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

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStatCard = (title: string, value: string | number, icon: string, color: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statIconContainer}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );

  const renderPaymentItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.paymentCard}
      onPress={() => (navigation as any).navigate('PaymentDetails', { paymentId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.paymentHeader}>
        <View style={styles.paymentHeaderLeft}>
          <Text style={styles.paymentRef}>Ref: {item.gatewayRef}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(item.status) }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
        </View>
        <Text style={styles.paymentAmount}>
          {formatCurrency(item.amount, item.currency)}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.paymentDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={16} color={Colors.gray500} />
          <Text style={styles.detailText}>
            {item.order.buyer.firstName} {item.order.buyer.lastName}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="mail-outline" size={16} color={Colors.gray500} />
          <Text style={styles.detailText}>{item.order.buyer.email}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="storefront-outline" size={16} color={Colors.gray500} />
          <Text style={styles.detailText}>{item.order.store.name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="card-outline" size={16} color={Colors.gray500} />
          <Text style={styles.detailText}>{item.gateway.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.paymentFooter}>
        <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        <View style={styles.viewDetailsButton}>
          <Text style={styles.viewDetailsText}>View Details</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </View>
      </View>

      {item.escrow && (
        <View style={styles.escrowBadge}>
          <Ionicons name="shield-checkmark" size={12} color={Colors.info} />
          <Text style={styles.escrowText}>Escrow: {item.escrow.status}</Text>
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
            <Text style={styles.modalTitle}>Filter Payments</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.filterChips}>
              {['ALL', 'SUCCESS', 'PENDING', 'FAILED'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterChip,
                    statusFilter === status && styles.filterChipActive,
                  ]}
                  onPress={() => handleStatusFilterChange(status as FilterStatus)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      statusFilter === status && styles.filterChipTextActive,
                    ]}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Currency</Text>
            <View style={styles.filterChips}>
              {['ALL', 'GHS', 'USD', 'EUR'].map((currency) => (
                <TouchableOpacity
                  key={currency}
                  style={[
                    styles.filterChip,
                    currencyFilter === currency && styles.filterChipActive,
                  ]}
                  onPress={() => handleCurrencyFilterChange(currency)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      currencyFilter === currency && styles.filterChipTextActive,
                    ]}
                  >
                    {currency}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => {
              setShowFilters(false);
              loadPayments(1);
            }}
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>All Payments</Text>
      
      {/* Statistics Cards */}
      {adminStatistics && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
          {renderStatCard(
            'Total Revenue',
            formatCurrency(adminStatistics.totalAmount, 'GHS'),
            'cash-outline',
            Colors.success
          )}
          {renderStatCard(
            'Total Payments',
            adminStatistics.totalPayments.toString(),
            'card-outline',
            Colors.primary
          )}
          {renderStatCard(
            'Average',
            formatCurrency(adminStatistics.averageAmount, 'GHS'),
            'analytics-outline',
            Colors.info
          )}
          {adminStatistics.byStatus.map((stat) => (
            renderStatCard(
              stat.status,
              `${stat.count} (${formatCurrency(stat.totalAmount, 'GHS')})`,
              'checkmark-circle-outline',
              getStatusColor(stat.status)
            )
          ))}
        </ScrollView>
      )}

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={Colors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by ref, email, or name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            placeholderTextColor={Colors.gray400}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={Colors.gray400} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="filter" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Active Filters */}
      {(statusFilter !== 'ALL' || currencyFilter !== 'ALL') && (
        <View style={styles.activeFilters}>
          {statusFilter !== 'ALL' && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterText}>Status: {statusFilter}</Text>
              <TouchableOpacity onPress={() => setStatusFilter('ALL')}>
                <Ionicons name="close" size={16} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          )}
          {currencyFilter !== 'ALL' && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterText}>Currency: {currencyFilter}</Text>
              <TouchableOpacity onPress={() => setCurrencyFilter('ALL')}>
                <Ionicons name="close" size={16} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
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
        data={adminPayments}
        renderItem={renderPaymentItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color={Colors.gray300} />
              <Text style={styles.emptyTitle}>No Payments Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try adjusting your search or filters' : 'Payments will appear here'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading && adminPayments.length > 0 ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
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
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
      />

      {renderFilterModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  statsContainer: {
    marginBottom: 16,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderLeftWidth: 4,
    minWidth: 200,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  activeFilterText: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  paymentCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  paymentHeaderLeft: {
    flex: 1,
    gap: 6,
  },
  paymentRef: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  paymentDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  paymentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  escrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  escrowText: {
    fontSize: 12,
    color: Colors.info,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
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
    maxHeight: '70%',
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
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default PaymentsScreen;