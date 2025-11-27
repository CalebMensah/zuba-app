import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useEscrow } from '../../hooks/useEscrow';
import { Colors } from '../../constants/colors';

interface PendingEscrow {
  id: string;
  amountHeld: number;
  currency: string;
  releaseDate: string;
  releaseStatus: 'PENDING' | 'RELEASED' | 'FAILED';
  order: {
    id: string;
    status: string;
    buyer: { firstName: string; email: string };
    store: { name: string };
  };
  payment: {
    id: string;
    amount: number;
    currency: string;
    status: string;
  };
}

const AdminEscrowsScreen: React.FC = () => {
  const { loading, error, getPendingEscrows } = useEscrow();
  const [escrows, setEscrows] = useState<PendingEscrow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetchEscrows();
  }, []);

  const fetchEscrows = async (pageNum: number = 1, append: boolean = false) => {
    try {
      const response = await getPendingEscrows({ page: pageNum, limit: 20 });
      
      if (response.success && response.data) {
        if (append) {
          setEscrows(prev => [...prev, ...response.data!]);
        } else {
          setEscrows(response.data);
        }
        
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages);
          setPage(response.pagination.page);
        }
      } else {
        Alert.alert('Error', response.message || 'Failed to fetch escrows');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEscrows(1, false);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    
    setLoadingMore(true);
    await fetchEscrows(page + 1, true);
    setLoadingMore(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getDaysUntilRelease = (releaseDate: string) => {
    const now = new Date();
    const release = new Date(releaseDate);
    const diffTime = release.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day';
    return `${diffDays} days`;
  };

  const handleViewDetails = (escrowId: string) => {
    // Navigate to escrow details screen
    Alert.alert('View Details', `Escrow ID: ${escrowId}`);
  };

  const handleForceRelease = (escrowId: string, orderId: string) => {
    Alert.alert(
      'Force Release',
      'Are you sure you want to manually release this escrow?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement force release API call
            Alert.alert('Success', 'Escrow will be released');
          },
        },
      ]
    );
  };

  const renderEscrowCard = ({ item }: { item: PendingEscrow }) => {
    const daysUntilRelease = getDaysUntilRelease(item.releaseDate);
    const isOverdue = daysUntilRelease === 'Overdue';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.orderId}>Order #{item.order.id.slice(0, 8)}</Text>
            <View style={[
              styles.statusBadge,
              isOverdue && styles.statusBadgeOverdue
            ]}>
              <Text style={[
                styles.statusText,
                isOverdue && styles.statusTextOverdue
              ]}>
                {daysUntilRelease}
              </Text>
            </View>
          </View>
          <Text style={styles.amount}>
            {formatCurrency(item.amountHeld, item.currency)}
          </Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Buyer:</Text>
            <Text style={styles.value}>{item.order.buyer.firstName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.valueEmail}>{item.order.buyer.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Store:</Text>
            <Text style={styles.value}>{item.order.store.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Order Status:</Text>
            <View style={styles.orderStatusBadge}>
              <Text style={styles.orderStatusText}>{item.order.status}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Release Date:</Text>
            <Text style={styles.value}>{formatDate(item.releaseDate)}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={() => handleViewDetails(item.id)}
          >
            <Text style={styles.buttonSecondaryText}>View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buttonPrimary}
            onPress={() => handleForceRelease(item.id, item.order.id)}
          >
            <Text style={styles.buttonPrimaryText}>Force Release</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No pending escrows</Text>
      <Text style={styles.emptySubtext}>
        All escrows have been processed or there are no active escrows.
      </Text>
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

  if (loading && escrows.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading escrows...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pending Escrows</Text>
        <Text style={styles.subtitle}>
          {escrows.length} pending release{escrows.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={escrows}
        renderItem={renderEscrowCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
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
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorContainer: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusBadgeOverdue: {
    backgroundColor: Colors.errorLight,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.info,
  },
  statusTextOverdue: {
    color: Colors.error,
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.success,
  },
  cardBody: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
  valueEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    textAlign: 'right',
  },
  orderStatusBadge: {
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonSecondary: {
    flex: 1,
    backgroundColor: Colors.backgroundTertiary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  buttonPrimary: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default AdminEscrowsScreen;