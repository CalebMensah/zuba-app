import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SellerStackParamList } from '../../types/navigation';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../hooks/useStore';
import { Colors } from '../../constants/colors';

const MyStoreScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<SellerStackParamList>>();
  const { store, loading, error, getUserStore, deleteStore, clearError } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStore();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const loadStore = async () => {
    await getUserStore();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStore();
    setRefreshing(false);
  };

  const handleEditStore = () => {
    if (store) {
      navigation.navigate('EditStore', { store });
    }
  };

  const handleDeleteStore = () => {
    if (!store) return;

    Alert.alert(
      'Delete Store',
      'Are you sure you want to delete your store? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteStore(store.id);
            if (success) {
              Alert.alert('Success', 'Store deleted successfully');
              loadStore();
            }
          },
        },
      ]
    );
  };

  const handleCreateStore = () => {
    navigation.navigate('CreateStore');
  };

  const getVerificationStatusColor = (status?: string) => {
    switch (status) {
      case 'verified':
        return Colors.success;
      case 'pending':
        return Colors.warning;
      case 'rejected':
        return Colors.error;
      default:
        return Colors.gray500;
    }
  };

  const getVerificationStatusText = (status?: string) => {
    switch (status) {
      case 'verified':
        return 'Verified';
      case 'pending':
        return 'Pending Verification';
      case 'rejected':
        return 'Verification Rejected';
      default:
        return 'Not Verified';
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your store...</Text>
      </View>
    );
  }

  // No Store Component
  if (!store && !loading) {
    return (
      <View style={styles.noStoreContainer}>
        <Ionicons name="storefront-outline" size={80} color={Colors.gray400} />
        <Text style={styles.noStoreTitle}>No Store Found</Text>
        <Text style={styles.noStoreDescription}>
          You don't have a seller account yet. Create one to start selling your products.
        </Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateStore}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.white} />
          <Text style={styles.createButtonText}>Create Seller Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Store Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          {store?.logo ? (
            <Image source={{ uri: store.logo }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]}>
              <Ionicons name="storefront" size={40} color={Colors.gray400} />
            </View>
          )}
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.storeName}>{store?.name}</Text>
          
          {/* Verification Badge */}
          <View
            style={[
              styles.verificationBadge,
              {
                backgroundColor: getVerificationStatusColor(
                  store?.verification?.status
                ),
              },
            ]}
          >
            <Ionicons
              name={
                store?.verification?.status === 'verified'
                  ? 'checkmark-circle'
                  : store?.verification?.status === 'pending'
                  ? 'time-outline'
                  : 'alert-circle-outline'
              }
              size={14}
              color={Colors.white}
            />
            <Text style={styles.verificationText}>
              {getVerificationStatusText(store?.verification?.status)}
            </Text>
          </View>

          {/* Active Status */}
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: store?.isActive ? Colors.success : Colors.error },
              ]}
            />
            <Text style={styles.statusText}>
              {store?.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>

      {/* Rejection Reason */}
      {store?.verification?.status === 'rejected' &&
        store?.verification?.rejectionReason && (
          <View style={styles.rejectionContainer}>
            <Ionicons name="warning" size={20} color={Colors.error} />
            <Text style={styles.rejectionText}>
              {store.verification.rejectionReason}
            </Text>
          </View>
        )}

      {/* Store Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="star" size={24} color={Colors.warning} />
          <Text style={styles.statValue}>{store?.rating.toFixed(1) || '0.0'}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="chatbubble" size={24} color={Colors.info} />
          <Text style={styles.statValue}>{store?.totalReviews || 0}</Text>
          <Text style={styles.statLabel}>Reviews</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="eye" size={24} color={Colors.primary} />
          <Text style={styles.statValue}>{store?.viewCount || 0}</Text>
          <Text style={styles.statLabel}>Views</Text>
        </View>
      </View>

      {/* Store Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Store Information</Text>

        <View style={styles.detailRow}>
          <Ionicons name="link" size={20} color={Colors.gray500} />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Store URL</Text>
            <Text style={styles.detailValue}>{store?.url}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="location" size={20} color={Colors.gray500} />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={styles.detailValue}>
              {store?.location}, {store?.region}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="grid" size={20} color={Colors.gray500} />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Category</Text>
            <Text style={styles.detailValue}>{store?.category}</Text>
          </View>
        </View>

        {store?.description && (
          <View style={styles.detailRow}>
            <Ionicons name="document-text" size={20} color={Colors.gray500} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValue}>{store.description}</Text>
            </View>
          </View>
        )}

        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={20} color={Colors.gray500} />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>
              {new Date(store?.createdAt || '').toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={handleEditStore}
          disabled={
            store?.verification?.status === 'pending' ||
            store?.verification?.status === 'verified'
          }
        >
          <Ionicons name="create-outline" size={20} color={Colors.white} />
          <Text style={styles.editButtonText}>Edit Store</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteStore}
          disabled={
            store?.verification?.status === 'pending' ||
            store?.verification?.status === 'verified'
          }
        >
          <Ionicons name="trash-outline" size={20} color={Colors.white} />
          <Text style={styles.deleteButtonText}>Delete Store</Text>
        </TouchableOpacity>
      </View>

      {/* Warning for disabled actions */}
      {(store?.verification?.status === 'pending' ||
        store?.verification?.status === 'verified') && (
        <View style={styles.warningContainer}>
          <Ionicons name="information-circle" size={20} color={Colors.info} />
          <Text style={styles.warningText}>
            Store updates and deletion are disabled while verification is{' '}
            {store?.verification?.status}. Contact support for changes.
          </Text>
        </View>
      )}
    </ScrollView>
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
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  noStoreContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 32,
  },
  noStoreTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  noStoreDescription: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: Colors.white,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logoContainer: {
    marginRight: 16,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  logoPlaceholder: {
    backgroundColor: Colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 8,
    gap: 4,
  },
  verificationText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  rejectionContainer: {
    backgroundColor: Colors.errorLight,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  rejectionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error,
    lineHeight: 20,
  },
  statsContainer: {
    backgroundColor: Colors.white,
    margin: 16,
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  section: {
    backgroundColor: Colors.white,
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  actionsContainer: {
    padding: 16,
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  editButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  deleteButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  warningContainer: {
    backgroundColor: Colors.infoLight,
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: Colors.info,
    lineHeight: 20,
  },
});

export default MyStoreScreen;