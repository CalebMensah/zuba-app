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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAdmin } from '../../hooks/useAdmin';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar: string | null;
  role: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

type NavigationProp = {
  navigate: (screen: string, params?: any) => void;
};

const AdminUsersScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { getAllUsers, loading, error } = useAdmin();

  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('');

  const LIMIT = 20;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch users
  const fetchUsers = useCallback(async (
    pageNum: number = 1,
    search: string = '',
    role: string = '',
    append: boolean = false
  ) => {
    if (pageNum === 1) {
      setUsers([]);
    }

    try {
      const result = await getAllUsers({
        page: pageNum,
        limit: LIMIT,
        search: search.trim(),
        role: role || undefined,
      });

      if (result) {
        if (append) {
          setUsers(prev => [...prev, ...result.users]);
        } else {
          setUsers(result.users);
        }
        setTotalPages(result.pagination.totalPages);
        setPage(pageNum);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }, [getAllUsers]);

  // Initial load
  useEffect(() => {
    fetchUsers(1, searchDebounce, roleFilter, false);
  }, [searchDebounce, roleFilter]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers(1, searchDebounce, roleFilter, false);
    setRefreshing(false);
  }, [fetchUsers, searchDebounce, roleFilter]);

  // Load more (infinite scroll)
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || page >= totalPages) return;

    setLoadingMore(true);
    await fetchUsers(page + 1, searchDebounce, roleFilter, true);
    setLoadingMore(false);
  }, [loadingMore, loading, page, totalPages, fetchUsers, searchDebounce, roleFilter]);

  // Navigate to user details
  const handleUserPress = (userId: string) => {
    navigation.navigate('UserDetails', { userId });
  };

  // Render user item
  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => handleUserPress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.userCardContent}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {item.firstName[0]}{item.lastName[0]}
              </Text>
            </View>
          )}
          {item.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            </View>
          )}
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.metaContainer}>
            <View style={[styles.roleBadge, getRoleBadgeStyle(item.role)]}>
              <Text style={[styles.roleText, getRoleTextStyle(item.role)]}>
                {item.role}
              </Text>
            </View>
            {item.phone && (
              <Text style={styles.phoneText}>
                <Ionicons name="call-outline" size={12} /> {item.phone}
              </Text>
            )}
          </View>
        </View>

        {/* Arrow */}
        <Ionicons name="chevron-forward" size={24} color={Colors.gray400} />
      </View>
    </TouchableOpacity>
  );

  // Helper function for role badge styling
  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return { backgroundColor: Colors.errorLight };
      case 'SELLER':
        return { backgroundColor: Colors.infoLight };
      default:
        return { backgroundColor: Colors.warningLight };
    }
  };

  const getRoleTextStyle = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return { color: Colors.error };
      case 'SELLER':
        return { color: Colors.info };
      default:
        return { color: Colors.warning };
    }
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color={Colors.gray300} />
      <Text style={styles.emptyText}>No users found</Text>
      <Text style={styles.emptySubtext}>
        {searchQuery ? 'Try adjusting your search' : 'Users will appear here'}
      </Text>
    </View>
  );

  // Render footer (loading more indicator)
  const renderFooter = () => {
    if (!loadingMore) return null;
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
        <Text style={styles.headerTitle}>Users</Text>
        <Text style={styles.headerSubtitle}>
          {users.length > 0 ? `${users.length} users loaded` : 'Loading...'}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={Colors.gray400} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or phone..."
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

      {/* Role Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterChip, roleFilter === '' && styles.filterChipActive]}
          onPress={() => setRoleFilter('')}
        >
          <Text style={[styles.filterText, roleFilter === '' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, roleFilter === 'BUYER' && styles.filterChipActive]}
          onPress={() => setRoleFilter('BUYER')}
        >
          <Text style={[styles.filterText, roleFilter === 'BUYER' && styles.filterTextActive]}>
            Users
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, roleFilter === 'SELLER' && styles.filterChipActive]}
          onPress={() => setRoleFilter('SELLER')}
        >
          <Text style={[styles.filterText, roleFilter === 'SELLER' && styles.filterTextActive]}>
            Vendors
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, roleFilter === 'ADMIN' && styles.filterChipActive]}
          onPress={() => setRoleFilter('ADMIN')}
        >
          <Text style={[styles.filterText, roleFilter === 'ADMIN' && styles.filterTextActive]}>
            Admins
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

      {/* Users List */}
      {loading && page === 1 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={item => item.id}
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
    paddingHorizontal: 16,
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
    fontSize: 14,
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
  userCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.white,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderRadius: 10,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  phoneText: {
    fontSize: 12,
    color: Colors.textTertiary,
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

export default AdminUsersScreen;