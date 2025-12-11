import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDisputes, Dispute, DisputeStatus } from '../../hooks/useDisputes';

// Icons (you can replace these with your preferred icon library)
const AlertCircleIcon = () => <Text style={styles.icon}>⚠️</Text>;
const ClockIcon = () => <Text style={styles.icon}>🕐</Text>;
const CheckCircleIcon = () => <Text style={styles.icon}>✅</Text>;
const XCircleIcon = () => <Text style={styles.icon}>❌</Text>;
const RefreshIcon = () => <Text style={styles.icon}>🔄</Text>;

type FilterTab = 'all' | 'pending' | 'resolved' | 'cancelled';

const SellerDisputesScreen: React.FC = () => {
  const { getUserDisputes, loading, error, clearError } = useDisputes();
  
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalDisputes, setTotalDisputes] = useState(0);

  // Fetch disputes
  const fetchDisputes = useCallback(async (
    pageNum: number = 1,
    filterStatus?: DisputeStatus,
    append: boolean = false
  ) => {
    try {
      const response = await getUserDisputes(pageNum, 10, filterStatus);
      
      if (response) {
        if (append) {
          setDisputes(prev => [...prev, ...response.disputes]);
        } else {
          setDisputes(response.disputes);
        }
        
        setTotalDisputes(response.pagination.total);
        setHasMore(response.pagination.page < response.pagination.totalPages);
      }
    } catch (err) {
      console.error('Error fetching disputes:', err);
      Alert.alert('Error', 'Failed to fetch disputes. Please try again.');
    }
  }, [getUserDisputes]);

  // Initial load
  useEffect(() => {
    const status = activeTab === 'all' ? undefined : activeTab.toUpperCase() as DisputeStatus;
    fetchDisputes(1, status);
  }, [activeTab]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    const status = activeTab === 'all' ? undefined : activeTab.toUpperCase() as DisputeStatus;
    await fetchDisputes(1, status);
    setRefreshing(false);
  }, [activeTab, fetchDisputes]);

  // Handle load more
  const onLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      const status = activeTab === 'all' ? undefined : activeTab.toUpperCase() as DisputeStatus;
      fetchDisputes(nextPage, status, true);
    }
  }, [loading, hasMore, page, activeTab, fetchDisputes]);

  // Handle tab change
  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setPage(1);
    setDisputes([]);
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Get status color
  const getStatusColor = (status: DisputeStatus): string => {
    switch (status) {
      case 'PENDING':
        return '#F59E0B';
      case 'RESOLVED':
        return '#10B981';
      case 'CANCELLED':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  // Get status icon
  const getStatusIcon = (status: DisputeStatus) => {
    switch (status) {
      case 'PENDING':
        return <ClockIcon />;
      case 'RESOLVED':
        return <CheckCircleIcon />;
      case 'CANCELLED':
        return <XCircleIcon />;
      default:
        return <AlertCircleIcon />;
    }
  };

  // Get dispute type label
  const getDisputeTypeLabel = (type: string): string => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  // Render dispute card
  const renderDisputeCard = ({ item }: { item: Dispute }) => {
    const buyer = item.order?.buyer;
    const orderAmount = item.order?.totalAmount || 0;
    const currency = item.order?.currency || 'USD';
    const escrowStatus = item.order?.escrow?.releaseStatus;

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.statusBadge}>
            {getStatusIcon(item.status)}
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>

        {/* Order Info */}
        <View style={styles.orderInfo}>
          <Text style={styles.orderIdText}>Order #{item.orderId.slice(0, 8)}</Text>
          <Text style={styles.amountText}>{formatCurrency(orderAmount, currency)}</Text>
        </View>

        {/* Dispute Type */}
        <View style={styles.infoRow}>
          <Text style={styles.label}>Type:</Text>
          <Text style={styles.value}>{getDisputeTypeLabel(item.type)}</Text>
        </View>

        {/* Buyer Info */}
        {buyer && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Buyer:</Text>
            <Text style={styles.value}>{buyer.firstName}</Text>
          </View>
        )}

        {/* Escrow Status */}
        {escrowStatus && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Escrow:</Text>
            <View style={[styles.escrowBadge, { 
              backgroundColor: escrowStatus === 'PENDING' ? '#FEF3C7' : 
                              escrowStatus === 'RELEASED' ? '#D1FAE5' : '#FEE2E2' 
            }]}>
              <Text style={[styles.escrowText, {
                color: escrowStatus === 'PENDING' ? '#92400E' :
                       escrowStatus === 'RELEASED' ? '#065F46' : '#991B1B'
              }]}>
                {escrowStatus}
              </Text>
            </View>
          </View>
        )}

        {/* Description */}
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>

        {/* Resolution */}
        {item.resolution && (
          <View style={styles.resolutionBox}>
            <Text style={styles.resolutionLabel}>Resolution:</Text>
            <Text style={styles.resolutionText}>{item.resolution}</Text>
          </View>
        )}

        {/* View Details Button */}
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => handleViewDetails(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.detailsButtonText}>View Details</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Handle view details
  const handleViewDetails = (dispute: Dispute) => {
    // Navigate to dispute details screen
    // navigation.navigate('DisputeDetails', { disputeId: dispute.id });
    Alert.alert(
      'Dispute Details',
      `Dispute ID: ${dispute.id}\nStatus: ${dispute.status}\nType: ${getDisputeTypeLabel(dispute.type)}`,
      [{ text: 'OK' }]
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <AlertCircleIcon />
      <Text style={styles.emptyTitle}>No Disputes Found</Text>
      <Text style={styles.emptyText}>
        {activeTab === 'pending' 
          ? "You don't have any pending disputes."
          : activeTab === 'resolved'
          ? "No resolved disputes to show."
          : activeTab === 'cancelled'
          ? "No cancelled disputes to show."
          : "You don't have any disputes yet."}
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
        <RefreshIcon />
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  // Render footer
  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Disputes & Escrow</Text>
        <Text style={styles.headerSubtitle}>
          {totalDisputes} {totalDisputes === 1 ? 'dispute' : 'disputes'}
        </Text>
      </View>

      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => handleTabChange('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => handleTabChange('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'resolved' && styles.activeTab]}
          onPress={() => handleTabChange('resolved')}
        >
          <Text style={[styles.tabText, activeTab === 'resolved' && styles.activeTabText]}>
            Resolved
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'cancelled' && styles.activeTab]}
          onPress={() => handleTabChange('cancelled')}
        >
          <Text style={[styles.tabText, activeTab === 'cancelled' && styles.activeTabText]}>
            Cancelled
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Disputes List */}
      {loading && disputes.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loaderText}>Loading disputes...</Text>
        </View>
      ) : (
        <FlatList
          data={disputes}
          renderItem={renderDisputeCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3B82F6"
              colors={['#3B82F6']}
            />
          }
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  errorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#991B1B',
    marginRight: 12,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  escrowBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  escrowText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 8,
    lineHeight: 20,
  },
  resolutionBox: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  resolutionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  resolutionText: {
    fontSize: 13,
    color: '#1E3A8A',
    lineHeight: 18,
  },
  detailsButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  icon: {
    fontSize: 18,
  },
});

export default SellerDisputesScreen;