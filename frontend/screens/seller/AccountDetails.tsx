import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { usePaymentAccount } from '../../hooks/useAccountDetails';

export default function AddressDetails({ navigation }: any) {
  const {
    loading,
    error,
    paymentAccount,
    getMyPaymentAccount,
    deletePaymentAccount,
  } = usePaymentAccount();

  const [refreshing, setRefreshing] = useState(false);

  // Fetch payment account when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadPaymentAccount();
    }, [])
  );

  const loadPaymentAccount = async () => {
    await getMyPaymentAccount();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPaymentAccount();
    setRefreshing(false);
  };

  const handleEdit = () => {
    if (!paymentAccount) return;
    navigation.navigate('EditAddress', { paymentAccount });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Payment Account',
      'Are you sure you want to delete this payment account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deletePaymentAccount();
            if (success) {
              Alert.alert('Success', 'Payment account deleted successfully');
            } else if (error) {
              Alert.alert('Error', error);
            }
          },
        },
      ]
    );
  };

  const handleAddAccount = () => {
    navigation.navigate('AddAddress');
  };

  // Loading state
  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading payment account...</Text>
      </View>
    );
  }

  // No account state
  if (!paymentAccount && !loading) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>💳</Text>
          </View>
          <Text style={styles.emptyTitle}>No Payment Account</Text>
          <Text style={styles.emptySubtitle}>
            Add a payment account to receive payments from your customers
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddAccount}>
            <Text style={styles.addButtonText}>Add Payment Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Account details view
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Payment Account</Text>
        <Text style={styles.subtitle}>
          View and manage your payment account details
        </Text>
      </View>

      {/* Account Type Badge */}
      <View style={styles.card}>
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {paymentAccount?.accountType === 'bank'
                ? 'Bank Account'
                : 'Mobile Money'}
            </Text>
          </View>
          {paymentAccount?.isPrimary && (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>Primary</Text>
            </View>
          )}
        </View>

        {/* Bank Account Details */}
        {paymentAccount?.accountType === 'bank' && (
          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bank Name</Text>
              <Text style={styles.detailValue}>
                {paymentAccount.bankName || 'N/A'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Number</Text>
              <Text style={styles.detailValue}>
                {paymentAccount.accountNumber || 'N/A'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Name</Text>
              <Text style={styles.detailValue}>
                {paymentAccount.accountName || 'N/A'}
              </Text>
            </View>
          </View>
        )}

        {/* Mobile Money Details */}
        {paymentAccount?.accountType === 'mobile_money' && (
          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Provider</Text>
              <Text style={styles.detailValue}>
                {paymentAccount.provider || 'N/A'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Mobile Number</Text>
              <Text style={styles.detailValue}>
                {paymentAccount.mobileNumber || 'N/A'}
              </Text>
            </View>
          </View>
        )}

        {/* Status */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Status</Text>
          <View
            style={[
              styles.statusBadge,
              paymentAccount?.isActive
                ? styles.statusActive
                : styles.statusInactive,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                paymentAccount?.isActive
                  ? styles.statusDotActive
                  : styles.statusDotInactive,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                paymentAccount?.isActive
                  ? styles.statusTextActive
                  : styles.statusTextInactive,
              ]}
            >
              {paymentAccount?.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Text style={styles.editButtonText}>Edit Account</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      {/* Info Section */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>ℹ️ Important Information</Text>
        <Text style={styles.infoText}>
          • This account will be used to receive payments from your customers
        </Text>
        <Text style={styles.infoText}>
          • Make sure the details are accurate to avoid payment delays
        </Text>
        <Text style={styles.infoText}>
          • You can update your account details at any time
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    maxWidth: 300,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIconText: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  badge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  primaryBadgeText: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 20,
  },
  detailRow: {
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  statusActive: {
    backgroundColor: Colors.successLight,
  },
  statusInactive: {
    backgroundColor: Colors.gray100,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: Colors.success,
  },
  statusDotInactive: {
    backgroundColor: Colors.gray400,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusTextActive: {
    color: Colors.success,
  },
  statusTextInactive: {
    color: Colors.gray600,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  editButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  deleteButtonText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: Colors.infoLight,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
});