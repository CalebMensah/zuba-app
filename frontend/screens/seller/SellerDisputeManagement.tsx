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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDisputes, Dispute, DisputeStatus } from '../../hooks/useDisputes';
import { SellerStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';

type FilterTab = 'all' | 'pending' | 'resolved' | 'cancelled';

const SellerDisputesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<SellerStackParamList>>();
  const { getUserDisputes, loading, error, clearError } = useDisputes();

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalDisputes, setTotalDisputes] = useState(0);

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

  useEffect(() => {
    const status = activeTab === 'all' ? undefined : activeTab.toUpperCase() as DisputeStatus;
    fetchDisputes(1, status);
  }, [activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    const status = activeTab === 'all' ? undefined : activeTab.toUpperCase() as DisputeStatus;
    await fetchDisputes(1, status);
    setRefreshing(false);
  }, [activeTab, fetchDisputes]);

  const onLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      const status = activeTab === 'all' ? undefined : activeTab.toUpperCase() as DisputeStatus;
      fetchDisputes(nextPage, status, true);
    }
  }, [loading, hasMore, page, activeTab, fetchDisputes]);

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setPage(1);
    setDisputes([]);
  };

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

  const formatCurrency = (amount: number, currency: string = 'GHS'): string => {
    return `GH₵${parseFloat(String(amount)).toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getStatusColor = (status: DisputeStatus): string => {
    switch (status) {
      case 'PENDING': return Colors.warning;
      case 'RESOLVED': return Colors.success;
      case 'CANCELLED': return Colors.textSecondary;
      default: return Colors.textSecondary;
    }
  };

  const getStatusIcon = (status: DisputeStatus) => {
    switch (status) {
      case 'PENDING':
        return <Ionicons name="time-outline" size={16} color={Colors.warning} />;
      case 'RESOLVED':
        return <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />;
      case 'CANCELLED':
        return <Ionicons name="close-circle-outline" size={16} color={Colors.textSecondary} />;
      default:
        return <Ionicons name="alert-circle-outline" size={16} color={Colors.textSecondary} />;
    }
  };

  const getDisputeTypeLabel = (type: string): string => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleViewDetails = (dispute: Dispute) => {
    navigation.navigate('DisputeDetails' as any, { disputeId: dispute.id } as any);
  };

  const renderDisputeCard = ({ item }: { item: Dispute }) => {
    const buyer = item.order?.buyer;
    const orderAmount = item.order?.totalAmount || 0;
    const currency = item.order?.currency || 'GHS';
    const escrowStatus = item.order?.escrow?.releaseStatus;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.statusBadge}>
            {getStatusIcon(item.status)}
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>

        <View style={styles.orderInfo}>
          <Text style={styles.orderIdText}>Order #{item.orderId.slice(0, 8)}</Text>
          <Text style={styles.amountText}>{formatCurrency(orderAmount, currency)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Type:</Text>
          <Text style={styles.value}>{getDisputeTypeLabel(item.type)}</Text>
        </View>

        {buyer && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Buyer:</Text>
            <Text style={styles.value}>{buyer.firstName}</Text>
          </View>
        )}

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

        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>

        {item.resolution && (
          <View style={styles.resolutionBox}>
            <Text style={styles.resolutionLabel}>Resolution:</Text>
            <Text style={styles.resolutionText}>{item.resolution}</Text>
          </View>
        )}

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

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="alert-circle-outline" size={56} color={Colors.gray400} />
      <Text style={styles.emptyTitle}>No Disputes Found</Text>
      <Text style={styles.emptyText}>
        {activeTab === 'pending'
          ? "You don't have any pending disputes."
          : activeTab === 'resolved'
          ? 'No resolved disputes to show.'
          : activeTab === 'cancelled'
          ? 'No cancelled disputes to show.'
          : "You don't have any disputes yet."}
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
        <Ionicons name="refresh-outline" size={18} color={Colors.white} />
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Disputes &amp; Escrow</Text>
        <Text style={styles.headerSubtitle}>
          {totalDisputes} {totalDisputes === 1 ? 'dispute' : 'disputes'}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {(['all', 'pending', 'resolved', 'cancelled'] as FilterTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && disputes.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
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
              tintColor={Colors.primary}
              colors={[Colors.primary]}
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
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  tabsContainer: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    backgroundColor: Colors.gray100,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.white,
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
    color: Colors.error,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
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
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.gray100,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
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
    color: Colors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  resolutionBox: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  resolutionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  resolutionText: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  detailsButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default SellerDisputesScreen;