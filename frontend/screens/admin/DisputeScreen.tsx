import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDisputes, Dispute, DisputeStatus, DisputeType } from '../../hooks/useDisputes';
import { Colors } from '../../constants/colors';

const AdminDisputesScreen = () => {
  const navigation = useNavigation();
  const { loading, error, getAllDisputes, clearError } = useDisputes();

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<DisputeStatus | 'ALL'>('ALL');
  const [selectedType, setSelectedType] = useState<DisputeType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const statusFilters: (DisputeStatus | 'ALL')[] = ['ALL', 'PENDING', 'RESOLVED', 'CANCELLED'];
  const typeFilters: (DisputeType | 'ALL')[] = [
    'ALL',
    'REFUND_REQUEST',
    'ITEM_NOT_AS_DESCRIBED',
    'ITEM_NOT_RECEIVED',
    'WRONG_ITEM_SENT',
    'DAMAGED_ITEM',
    'OTHER',
  ];

  const fetchDisputes = useCallback(async (pageNum: number = 1, showLoader: boolean = true) => {
    if (!showLoader) setRefreshing(true);

    const statusFilter = selectedStatus !== 'ALL' ? selectedStatus : undefined;
    const typeFilter = selectedType !== 'ALL' ? selectedType : undefined;

    const result = await getAllDisputes(pageNum, 20, statusFilter, typeFilter);

    if (result) {
      setDisputes(result.disputes);
      setTotalPages(result.pagination.totalPages);
      setPage(result.pagination.page);
    } else if (error) {
      Alert.alert('Error', error);
    }

    setRefreshing(false);
  }, [getAllDisputes, selectedStatus, selectedType, error]);

  useEffect(() => {
    fetchDisputes(1);
  }, [selectedStatus, selectedType]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error, clearError]);

  const onRefresh = () => {
    fetchDisputes(1, false);
  };

  const loadNextPage = () => {
    if (page < totalPages && !loading) {
      fetchDisputes(page + 1);
    }
  };

  const loadPreviousPage = () => {
    if (page > 1 && !loading) {
      fetchDisputes(page - 1);
    }
  };

  const handleViewDetails = (disputeId: string) => {
    (navigation as any).navigate('DisputeDetails' as never, { disputeId } as never);
  };

  const getStatusColor = (status: DisputeStatus) => {
    switch (status) {
      case 'PENDING':
        return Colors.warning;
      case 'RESOLVED':
        return Colors.success;
      case 'CANCELLED':
        return Colors.error;
      default:
        return Colors.gray500;
    }
  };

  const getTypeLabel = (type: DisputeType) => {
    return type.replace(/_/g, ' ');
  };

  const filteredDisputes = disputes.filter((dispute) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      dispute.id.toLowerCase().includes(query) ||
      dispute.orderId.toLowerCase().includes(query) ||
      dispute.order?.buyer?.firstName.toLowerCase().includes(query) ||
      dispute.order?.store?.name.toLowerCase().includes(query)
    );
  });

  const renderDisputeCard = ({ item }: { item: Dispute }) => (
    <View style={styles.disputeCard}>
      <View style={styles.cardHeader}>
        <View style={styles.disputeInfo}>
          <Text style={styles.disputeId}>Dispute #{item.id.slice(0, 8)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
        </View>
        <Text style={styles.dateText}>
          {new Date(item.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Order ID:</Text>
          <Text style={styles.value}>#{item.orderId.slice(0, 8)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Type:</Text>
          <Text style={styles.value}>{getTypeLabel(item.type)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Buyer:</Text>
          <Text style={styles.value}>{item.order?.buyer?.firstName || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Store:</Text>
          <Text style={styles.value}>{item.order?.store?.name || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Amount:</Text>
          <Text style={styles.amountText}>
            {item.order?.currency || '$'} {item.order?.totalAmount?.toFixed(2) || '0.00'}
          </Text>
        </View>

        <View style={styles.descriptionContainer}>
          <Text style={styles.label}>Description:</Text>
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => handleViewDetails(item.id)}
        >
          <Text style={styles.detailsButtonText}>View Details</Text>
        </TouchableOpacity>

        {item.status === 'PENDING' && (
          <TouchableOpacity
            style={styles.resolveButton}
            onPress={() => (navigation as any).navigate('DisputeDetails' as never, { 
              disputeId: item.id, 
              autoResolve: true 
            } as never)}
          >
            <Text style={styles.resolveButtonText}>Resolve</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No Disputes Found</Text>
      <Text style={styles.emptyStateText}>
        {selectedStatus !== 'ALL' || selectedType !== 'ALL'
          ? 'Try adjusting your filters'
          : 'There are no disputes to display'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Disputes Management</Text>
        <Text style={styles.headerSubtitle}>
          {filteredDisputes.length} dispute{filteredDisputes.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by ID, order, buyer, or store..."
          placeholderTextColor={Colors.gray400}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Status Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Status:</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={statusFilters}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedStatus === item && styles.filterChipActive,
              ]}
              onPress={() => setSelectedStatus(item)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedStatus === item && styles.filterChipTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {/* Type Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Type:</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={typeFilters}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedType === item && styles.filterChipActive,
              ]}
              onPress={() => setSelectedType(item)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedType === item && styles.filterChipTextActive,
                ]}
              >
                {item === 'ALL' ? 'ALL' : getTypeLabel(item)}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {/* Disputes List */}
      {loading && disputes.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading disputes...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDisputes}
          renderItem={renderDisputeCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
            />
          }
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.paginationButton, page === 1 && styles.paginationButtonDisabled]}
            onPress={loadPreviousPage}
            disabled={page === 1 || loading}
          >
            <Text
              style={[
                styles.paginationButtonText,
                page === 1 && styles.paginationButtonTextDisabled,
              ]}
            >
              Previous
            </Text>
          </TouchableOpacity>

          <Text style={styles.paginationText}>
            Page {page} of {totalPages}
          </Text>

          <TouchableOpacity
            style={[
              styles.paginationButton,
              page === totalPages && styles.paginationButtonDisabled,
            ]}
            onPress={loadNextPage}
            disabled={page === totalPages || loading}
          >
            <Text
              style={[
                styles.paginationButtonText,
                page === totalPages && styles.paginationButtonTextDisabled,
              ]}
            >
              Next
            </Text>
          </TouchableOpacity>
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
  header: {
    backgroundColor: Colors.white,
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  searchContainer: {
    backgroundColor: Colors.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    backgroundColor: Colors.gray50,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterSection: {
    backgroundColor: Colors.white,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginLeft: 16,
    marginBottom: 8,
  },
  filterList: {
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  listContent: {
    padding: 16,
  },
  disputeCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.gray50,
  },
  disputeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  disputeId: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  cardBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  descriptionContainer: {
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailsButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  resolveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.success,
    alignItems: 'center',
  },
  resolveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  paginationButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: Colors.disabled,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  paginationButtonTextDisabled: {
    color: Colors.disabledText,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
});

export default AdminDisputesScreen;