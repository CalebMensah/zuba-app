import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAdmin } from '../../hooks/useAdmin';

interface StoreVerification {
  id: string;
  isVerified: boolean;
  verifiedAt: string | null;
}

interface Store {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  isVerified: boolean;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    isSuspended: boolean;
  };
  verification: StoreVerification | null;
}

type NavigationProp = {
  navigate: (screen: string, params?: any) => void;
};

const StoresScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { getAllStores, suspendStore, reactivateStore, deleteStore, loading, error } = useAdmin();

  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [displayedStores, setDisplayedStores] = useState<Store[]>([]);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 10;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch stores
  const fetchStores = useCallback(async () => {
    const result = await getAllStores();
    if (result) {
      setStores(result);
    }
  }, [getAllStores]);

  // Initial load
  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // Filter stores based on search and status
  useEffect(() => {
    let filtered = [...stores];

    // Apply search filter
    if (searchDebounce.trim()) {
      const query = searchDebounce.toLowerCase();
      filtered = filtered.filter(
        (store) =>
          store.name.toLowerCase().includes(query) ||
          store.description?.toLowerCase().includes(query) ||
          store.user.email.toLowerCase().includes(query) ||
          `${store.user.firstName} ${store.user.lastName}`.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      switch (statusFilter) {
        case 'verified':
          filtered = filtered.filter((store) => store.isVerified);
          break;
        case 'unverified':
          filtered = filtered.filter((store) => !store.isVerified);
          break;
        case 'suspended':
          filtered = filtered.filter((store) => store.isSuspended);
          break;
        case 'active':
          filtered = filtered.filter((store) => !store.isSuspended);
          break;
      }
    }

    setFilteredStores(filtered);
    setPage(1);
    setDisplayedStores(filtered.slice(0, ITEMS_PER_PAGE));
  }, [stores, searchDebounce, statusFilter]);

  // Load more for infinite scroll
  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    const startIndex = 0;
    const endIndex = nextPage * ITEMS_PER_PAGE;
    const newDisplayed = filteredStores.slice(startIndex, endIndex);

    if (newDisplayed.length > displayedStores.length) {
      setDisplayedStores(newDisplayed);
      setPage(nextPage);
    }
  }, [page, filteredStores, displayedStores]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStores();
    setRefreshing(false);
  }, [fetchStores]);

  // Navigate to store details
  const handleStorePress = (storeId: string) => {
    navigation.navigate('SellerStoreDetails', { storeId });
  };

  // Navigate to verification details
  const handleVerifyPress = (storeId: string) => {
    navigation.navigate('VerificationDetails', { verificationId: storeId });
  };

  // Handle suspend/reactivate store
  const handleToggleSuspend = (store: Store) => {
    const action = store.isSuspended ? 'reactivate' : 'suspend';
    const actionText = store.isSuspended ? 'Reactivate' : 'Suspend';

    Alert.alert(
      `${actionText} Store`,
      `Are you sure you want to ${action} "${store.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          style: store.isSuspended ? 'default' : 'destructive',
          onPress: async () => {
            setActionLoading(store.id);
            const success = store.isSuspended
              ? await reactivateStore(store.id)
              : await suspendStore(store.id);
            setActionLoading(null);

            if (success) {
              Alert.alert('Success', `Store ${action}ed successfully`);
              fetchStores();
            }
          },
        },
      ]
    );
  };

  // Handle delete store
  const handleDeleteStore = (store: Store) => {
    Alert.alert(
      'Delete Store',
      `Are you sure you want to permanently delete "${store.name}"? This will also delete the store logo and verification records. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(store.id);
            const success = await deleteStore(store.id);
            setActionLoading(null);

            if (success) {
              Alert.alert('Success', 'Store deleted successfully');
              fetchStores();
            }
          },
        },
      ]
    );
  };

  // Render store item
  const renderStoreItem = ({ item }: { item: Store }) => (
    <View style={styles.storeCard}>
      {/* Store Header - Clickable */}
      <TouchableOpacity
        style={styles.storeHeader}
        onPress={() => handleStorePress(item.id)}
        activeOpacity={0.7}
      >
        {/* Store Logo */}
        {item.logo ? (
          <Image source={{ uri: item.logo }} style={styles.storeLogo} />
        ) : (
          <View style={styles.storeLogoPlaceholder}>
            <Ionicons name="storefront" size={32} color={Colors.white} />
          </View>
        )}

        {/* Store Info */}
        <View style={styles.storeInfo}>
          <View style={styles.storeNameRow}>
            <Text style={styles.storeName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isVerified && (
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            )}
          </View>

          {item.description && (
            <Text style={styles.storeDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Owner Info */}
          <View style={styles.ownerInfo}>
            <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.ownerText}>
              {item.user.firstName} {item.user.lastName}
            </Text>
            {item.user.isSuspended && (
              <View style={styles.ownerSuspendedBadge}>
                <Text style={styles.ownerSuspendedText}>Owner Suspended</Text>
              </View>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={24} color={Colors.gray400} />
      </TouchableOpacity>

      {/* Status Badges */}
      <View style={styles.badgeRow}>
        {item.isSuspended && (
          <View style={styles.suspendedBadge}>
            <Ionicons name="ban" size={12} color={Colors.error} />
            <Text style={styles.suspendedText}>Suspended</Text>
          </View>
        )}
        {!item.isVerified && (
          <View style={styles.unverifiedBadge}>
            <Ionicons name="alert-circle" size={12} color={Colors.warning} />
            <Text style={styles.unverifiedText}>Unverified</Text>
          </View>
        )}
        {item.isVerified && !item.isSuspended && (
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
            <Text style={styles.activeText}>Active</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        {!item.isVerified && (
          <TouchableOpacity
            style={[styles.actionButton, styles.verifyButton]}
            onPress={() => handleVerifyPress(item.id)}
            disabled={actionLoading === item.id}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={Colors.info} />
            <Text style={styles.verifyButtonText}>Verify</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.actionButton,
            item.isSuspended ? styles.reactivateButton : styles.suspendButton,
          ]}
          onPress={() => handleToggleSuspend(item)}
          disabled={actionLoading === item.id}
        >
          {actionLoading === item.id ? (
            <ActivityIndicator size="small" color={Colors.warning} />
          ) : (
            <>
              <Ionicons
                name={item.isSuspended ? 'checkmark-circle-outline' : 'ban-outline'}
                size={18}
                color={item.isSuspended ? Colors.success : Colors.warning}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  { color: item.isSuspended ? Colors.success : Colors.warning },
                ]}
              >
                {item.isSuspended ? 'Reactivate' : 'Suspend'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteStore(item)}
          disabled={actionLoading === item.id}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="storefront-outline" size={64} color={Colors.gray300} />
      <Text style={styles.emptyText}>No stores found</Text>
      <Text style={styles.emptySubtext}>
        {searchQuery ? 'Try adjusting your search' : 'Stores will appear here'}
      </Text>
    </View>
  );

  // Render footer (loading more indicator)
  const renderFooter = () => {
    if (displayedStores.length >= filteredStores.length) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stores</Text>
        <Text style={styles.headerSubtitle}>
          {filteredStores.length} {filteredStores.length === 1 ? 'store' : 'stores'}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={Colors.gray400} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search stores, owners, or emails..."
          placeholderTextColor={Colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={Colors.gray400} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
          onPress={() => setStatusFilter('all')}
        >
          <Text style={[styles.filterText, statusFilter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'active' && styles.filterChipActive]}
          onPress={() => setStatusFilter('active')}
        >
          <Text style={[styles.filterText, statusFilter === 'active' && styles.filterTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'verified' && styles.filterChipActive]}
          onPress={() => setStatusFilter('verified')}
        >
          <Text style={[styles.filterText, statusFilter === 'verified' && styles.filterTextActive]}>
            Verified
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'unverified' && styles.filterChipActive]}
          onPress={() => setStatusFilter('unverified')}
        >
          <Text style={[styles.filterText, statusFilter === 'unverified' && styles.filterTextActive]}>
            Unverified
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'suspended' && styles.filterChipActive]}
          onPress={() => setStatusFilter('suspended')}
        >
          <Text style={[styles.filterText, statusFilter === 'suspended' && styles.filterTextActive]}>
            Suspended
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Stores List */}
      {loading && stores.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayedStores}
          renderItem={renderStoreItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
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
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.white,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  storeCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  storeLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  storeLogoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  storeDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  ownerSuspendedBadge: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownerSuspendedText: {
    fontSize: 10,
    color: Colors.error,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  suspendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  suspendedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
  },
  unverifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unverifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.successDark,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
  },
  verifyButton: {
    backgroundColor: Colors.infoLight,
    borderColor: Colors.info,
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.info,
  },
  suspendButton: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warning,
  },
  reactivateButton: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.error,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
export default StoresScreen;