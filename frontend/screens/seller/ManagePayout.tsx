import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePaymentAccount, PaymentAccount } from '../../hooks/useAccountDetails';
import { Colors } from '../../constants/colors';

const ManagePayoutAccount: React.FC = () => {
  const navigation = useNavigation();
  const {
    loading,
    error,
    paymentAccount,
    getMyPaymentAccount,
    deletePaymentAccount,
    clearError,
  } = usePaymentAccount();

  const [refreshing, setRefreshing] = useState(false);

  // Fetch payment account on screen focus
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
    if (paymentAccount) {
      (navigation as any).navigate('EditAccount' as never, { 
        accountId: paymentAccount.id
      } as never);
    }
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
            }
          },
        },
      ]
    );
  };

  const handleAddAccount = () => {
    navigation.navigate('AddAccount' as never);
  };

  const renderAccountCard = (account: PaymentAccount) => {
    const isBankAccount = account.accountType === 'bank';

    return (
      <View style={styles.accountCard}>
        {/* Account Type Header */}
        <View style={styles.accountHeader}>
          <View style={styles.accountTypeContainer}>
            <Ionicons
              name={isBankAccount ? 'business' : 'phone-portrait'}
              size={24}
              color={Colors.primary}
            />
            <Text style={styles.accountTypeText}>
              {isBankAccount ? 'Bank Account' : 'Mobile Money'}
            </Text>
          </View>
          {account.isPrimary && (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>Default</Text>
            </View>
          )}
        </View>

        {/* Account Details */}
        <View style={styles.accountDetails}>
          {isBankAccount ? (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Bank Name</Text>
                <Text style={styles.detailValue}>{account.bankName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Account Name</Text>
                <Text style={styles.detailValue}>{account.accountName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Account Number</Text>
                <Text style={styles.detailValue}>{account.accountNumber}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Provider</Text>
                <Text style={styles.detailValue}>{account.provider}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Mobile Number</Text>
                <Text style={styles.detailValue}>{account.mobileNumber}</Text>
              </View>
            </>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEdit}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={20} color={Colors.primary} />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>

        {/* Status */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: account.isActive ? Colors.success : Colors.gray400 },
            ]}
          />
          <Text style={styles.statusText}>
            {account.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="wallet-outline" size={80} color={Colors.gray300} />
      </View>
      <Text style={styles.emptyTitle}>No Payout Account</Text>
      <Text style={styles.emptyDescription}>
        Add a payout account to start receiving payments for goods
      </Text>
      <TouchableOpacity
        style={styles.addAccountButton}
        onPress={handleAddAccount}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle-outline" size={24} color={Colors.white} />
        <Text style={styles.addAccountButtonText}>Add Account</Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={60} color={Colors.error} />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => {
          clearError();
          loadPaymentAccount();
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payout Accounts</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading account...</Text>
          </View>
        ) : error && !paymentAccount ? (
          renderError()
        ) : !paymentAccount ? (
          renderEmptyState()
        ) : (
          <>
            {renderAccountCard(paymentAccount)}

            {/* Add Another Account Button (Optional - if you support multiple accounts later) */}
            <TouchableOpacity
              style={styles.addNewButton}
              onPress={handleAddAccount}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={24} color={Colors.primary} />
              <Text style={styles.addNewButtonText}>Update Account</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginTop: 30
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    gap: 8,
  },
  addAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  accountCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  accountTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  primaryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: Colors.success,
    borderRadius: 12,
  },
  primaryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  accountDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    flex: 2,
    textAlign: 'right',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.errorLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.error,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    gap: 8,
  },
  addNewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});

export default ManagePayoutAccount;