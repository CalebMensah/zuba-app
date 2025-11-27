import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAdmin } from '../../hooks/useAdmin';

interface Store {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  isVerified: boolean;
  createdAt: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar: string | null;
  role: string;
  isVerified: boolean;
  isSuspended?: boolean;
  createdAt: string;
  updatedAt: string;
  store?: Store | null;
}

type RouteParams = {
  UserDetails: {
    userId: string;
  };
};

type NavigationProp = {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
};

 const UserDetailsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RouteParams, 'UserDetails'>>();
  const { userId } = route.params;

  const {
    getUserById,
    suspendUser,
    reactivateUser,
    deleteUser,
    loading,
    error,
  } = useAdmin();

  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch user details
  const fetchUserDetails = useCallback(async () => {
    const userData = await getUserById(userId);
    if (userData) {
      setUser(userData);
    }
  }, [userId, getUserById]);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserDetails();
    setRefreshing(false);
  }, [fetchUserDetails]);

  // Handle suspend user
  const handleSuspend = () => {
    Alert.alert(
      'Suspend User',
      `Are you sure you want to suspend ${user?.firstName} ${user?.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const success = await suspendUser(userId);
            setActionLoading(false);
            
            if (success) {
              Alert.alert('Success', 'User suspended successfully');
              fetchUserDetails();
            }
          },
        },
      ]
    );
  };

  // Handle reactivate user
  const handleReactivate = () => {
    Alert.alert(
      'Reactivate User',
      `Are you sure you want to reactivate ${user?.firstName} ${user?.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: async () => {
            setActionLoading(true);
            const success = await reactivateUser(userId);
            setActionLoading(false);
            
            if (success) {
              Alert.alert('Success', 'User reactivated successfully');
              fetchUserDetails();
            }
          },
        },
      ]
    );
  };

  // Handle delete user
  const handleDelete = () => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete ${user?.firstName} ${user?.lastName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const success = await deleteUser(userId);
            setActionLoading(false);
            
            if (success) {
              Alert.alert('Success', 'User deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            }
          },
        },
      ]
    );
  };

  // Navigate to user store
  const handleViewStore = () => {
    if (user?.store) {
      navigation.navigate('StoreDetails', { storeId: user.store.id, userId: user.id });
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading && !user) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorTitle}>User not found</Text>
        <Text style={styles.errorText}>
          {error || 'Unable to load user details'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchUserDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user.firstName[0]}{user.lastName[0]}
                </Text>
              </View>
            )}
            {user.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
              </View>
            )}
          </View>

          <Text style={styles.userName}>
            {user.firstName} {user.lastName}
          </Text>

          <View style={styles.badgeContainer}>
            <View style={[styles.roleBadge, getRoleBadgeStyle(user.role)]}>
              <Text style={[styles.roleText, getRoleTextStyle(user.role)]}>
                {user.role}
              </Text>
            </View>
            {user.isSuspended && (
              <View style={styles.suspendedBadge}>
                <Text style={styles.suspendedText}>Suspended</Text>
              </View>
            )}
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color={Colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>
            </View>

            {user.phone && (
              <View style={[styles.infoRow, styles.infoRowBorder]}>
                <Ionicons name="call-outline" size={20} color={Colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{user.phone}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>{formatDate(user.createdAt)}</Text>
              </View>
            </View>

            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Ionicons name="time-outline" size={20} color={Colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Last Updated</Text>
                <Text style={styles.infoValue}>{formatDate(user.updatedAt)}</Text>
              </View>
            </View>

            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Ionicons
                name={user.isVerified ? "checkmark-circle" : "close-circle"}
                size={20}
                color={user.isVerified ? Colors.success : Colors.error}
              />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Verification Status</Text>
                <Text style={[
                  styles.infoValue,
                  { color: user.isVerified ? Colors.success : Colors.error }
                ]}>
                  {user.isVerified ? 'Verified' : 'Not Verified'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Store Information */}
        {user.store && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Store Information</Text>

            <View style={styles.storeCard}>
              <View style={styles.storeHeader}>
                {user.store.logo ? (
                  <Image source={{ uri: user.store.logo }} style={styles.storeLogo} />
                ) : (
                  <View style={styles.storeLogoPlaceholder}>
                    <Ionicons name="storefront" size={24} color={Colors.white} />
                  </View>
                )}
                <View style={styles.storeInfo}>
                  <View style={styles.storeNameRow}>
                    <Text style={styles.storeName}>{user.store.name}</Text>
                    {user.store.isVerified && (
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    )}
                  </View>
                  {user.store.description && (
                    <Text style={styles.storeDescription} numberOfLines={2}>
                      {user.store.description}
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.viewStoreButton}
                onPress={handleViewStore}
              >
                <Text style={styles.viewStoreButtonText}>View Store</Text>
                <Ionicons name="arrow-forward" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          {user.isSuspended ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.reactivateButton]}
              onPress={handleReactivate}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
                  <Text style={styles.actionButtonText}>Reactivate User</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.suspendButton]}
              onPress={handleSuspend}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="ban-outline" size={20} color={Colors.white} />
                  <Text style={styles.actionButtonText}>Suspend User</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={Colors.white} />
                <Text style={styles.actionButtonText}>Delete User</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

// Helper functions for role badge styling
const getRoleBadgeStyle = (role: string) => {
  switch (role) {
    case 'ADMIN':
      return { backgroundColor: Colors.errorLight };
    case 'VENDOR':
      return { backgroundColor: Colors.infoLight };
    default:
      return { backgroundColor: Colors.warningLight };
  }
};

const getRoleTextStyle = (role: string) => {
  switch (role) {
    case 'ADMIN':
      return { color: Colors.error };
    case 'VENDOR':
      return { color: Colors.info };
    default:
      return { color: Colors.warning };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.backgroundSecondary,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  profileSection: {
    backgroundColor: Colors.white,
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '600',
    color: Colors.white,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 2,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  suspendedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.errorLight,
  },
  suspendedText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  infoRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  storeCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  storeLogo: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  storeLogoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeInfo: {
    marginLeft: 12,
    flex: 1,
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
  },
  storeDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  viewStoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  viewStoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  suspendButton: {
    backgroundColor: Colors.warning,
  },
  reactivateButton: {
    backgroundColor: Colors.success,
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default UserDetailsScreen;