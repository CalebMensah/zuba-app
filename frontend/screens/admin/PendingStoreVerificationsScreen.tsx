import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useVerification, Verification } from '../../hooks/useVerification';

type NavigationProp = {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
};

const AllPendingStoreVerificationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {
    verifications,
    loading,
    error,
    pagination,
    getPendingVerifications,
    updateVerificationStatus,
  } = useVerification();

  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const LIMIT = 10;

  // Fetch verifications
  const fetchVerifications = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      const result = await getPendingVerifications(pageNum, LIMIT);
      if (result.success) {
        setPage(pageNum);
      }
    },
    [getPendingVerifications]
  );

  // Initial load
  useEffect(() => {
    fetchVerifications(1, false);
  }, []);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVerifications(1, false);
    setRefreshing(false);
  }, [fetchVerifications]);

  // Load more for pagination
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !pagination || page >= pagination.totalPages) {
      return;
    }

    setLoadingMore(true);
    await fetchVerifications(page + 1, true);
    setLoadingMore(false);
  }, [loadingMore, loading, page, pagination, fetchVerifications]);

  // Navigate to verification details
  const handleViewDetails = (verificationId: string) => {
    navigation.navigate('VerificationDetails', { verificationId });
  };

  // Handle approve verification
  const handleApprove = (verification: Verification) => {
    Alert.alert(
      'Approve Verification',
      `Are you sure you want to approve the verification for "${verification.store?.name}"? This will activate the store.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setActionLoading(verification.id);
            const result = await updateVerificationStatus(verification.id, 'verified');
            setActionLoading(null);

            if (result.success) {
              Alert.alert('Success', 'Store verification approved successfully');
              fetchVerifications(1, false);
            } else {
              Alert.alert('Error', result.message || 'Failed to approve verification');
            }
          },
        },
      ]
    );
  };

  // Handle reject verification - show input modal
  const handleRejectPress = (verification: Verification) => {
    setSelectedVerification(verification);
    setRejectionReason('');
    setRejectionModalVisible(true);
  };

  // Submit rejection with reason
  const handleRejectSubmit = async () => {
    if (!selectedVerification) return;

    if (!rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a rejection reason');
      return;
    }

    setRejectionModalVisible(false);
    setActionLoading(selectedVerification.id);

    const result = await updateVerificationStatus(
      selectedVerification.id,
      'rejected',
      rejectionReason.trim()
    );

    setActionLoading(null);

    if (result.success) {
      Alert.alert('Success', 'Verification rejected successfully');
      fetchVerifications(1, false);
    } else {
      Alert.alert('Error', result.message || 'Failed to reject verification');
    }

    setSelectedVerification(null);
    setRejectionReason('');
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate days pending
  const getDaysPending = (dateString: string) => {
    const submittedDate = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - submittedDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Render verification card
  const renderVerificationItem = ({ item }: { item: Verification }) => {
    const daysPending = getDaysPending(item.createdAt);
    const isUrgent = daysPending >= 2;

    return (
      <View style={[styles.verificationCard, isUrgent && styles.urgentCard]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.storeLogoContainer}>
            {item.store && (item.store as any).logo ? (
              <Image source={{ uri: (item.store as any).logo }} style={styles.storeLogo} />
            ) : (
              <View style={styles.storeLogoPlaceholder}>
                <Ionicons name="storefront" size={24} color={Colors.white} />
              </View>
            )}
          </View>

          <View style={styles.storeInfo}>
            <Text style={styles.storeName} numberOfLines={1}>
              {item.store?.name || 'Unknown Store'}
            </Text>
            <Text style={styles.ownerName}>
              {item.store?.user?.firstName || 'Unknown Owner'}
            </Text>
            <Text style={styles.ownerEmail} numberOfLines={1}>
              {item.store?.user?.email}
            </Text>
          </View>

          {isUrgent && (
            <View style={styles.urgentBadge}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
            </View>
          )}
        </View>

        {/* Submission Info */}
        <View style={styles.submissionInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.infoText}>Submitted: {formatDate(item.createdAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color={isUrgent ? Colors.error : Colors.textSecondary} />
            <Text style={[styles.infoText, isUrgent && styles.urgentText]}>
              {daysPending} {daysPending === 1 ? 'day' : 'days'} pending
            </Text>
          </View>
        </View>

        {/* Documents Preview */}
        <View style={styles.documentsPreview}>
          <Text style={styles.documentsLabel}>Documents Submitted:</Text>
          <View style={styles.documentsList}>
            <View style={styles.documentItem}>
              <Ionicons name="card-outline" size={14} color={Colors.success} />
              <Text style={styles.documentText}>Ghana Card</Text>
            </View>
            <View style={styles.documentItem}>
              <Ionicons name="person-outline" size={14} color={Colors.success} />
              <Text style={styles.documentText}>Selfie</Text>
            </View>
            {item.businessDoc && (
              <View style={styles.documentItem}>
                <Ionicons name="document-outline" size={14} color={Colors.success} />
                <Text style={styles.documentText}>Business Doc</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => handleViewDetails(item.id)}
            disabled={actionLoading === item.id}
          >
            <Ionicons name="eye-outline" size={18} color={Colors.primary} />
            <Text style={styles.viewButtonText}>View Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprove(item)}
            disabled={actionLoading === item.id}
          >
            {actionLoading === item.id ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color={Colors.white} />
                <Text style={styles.approveButtonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRejectPress(item)}
            disabled={actionLoading === item.id}
          >
            {actionLoading === item.id ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={18} color={Colors.white} />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="checkmark-done-circle-outline" size={80} color={Colors.gray300} />
      <Text style={styles.emptyText}>No Pending Verifications</Text>
      <Text style={styles.emptySubtext}>
        All store verifications have been processed
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Pending Verifications</Text>
          {pagination && (
            <Text style={styles.headerSubtitle}>
              {pagination.total} {pagination.total === 1 ? 'request' : 'requests'}
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Stats Bar */}
      {pagination && pagination.total > 0 && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pagination.total}</Text>
            <Text style={styles.statLabel}>Total Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {verifications.filter(v => getDaysPending(v.createdAt) >= 2).length}
            </Text>
            <Text style={styles.statLabel}>Urgent (2+ days)</Text>
          </View>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Verifications List */}
      {loading && verifications.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading verifications...</Text>
        </View>
      ) : (
        <FlatList
          data={verifications}
          renderItem={renderVerificationItem}
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

      {/* Rejection Modal */}
      {rejectionModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Verification</Text>
              <TouchableOpacity onPress={() => setRejectionModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Store: {selectedVerification?.store?.name}
            </Text>

            <Text style={styles.inputLabel}>Rejection Reason *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Provide a clear reason for rejection..."
              placeholderTextColor={Colors.textTertiary}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setRejectionModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleRejectSubmit}
              >
                <Text style={styles.submitButtonText}>Reject Verification</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    marginHorizontal: 16,
    marginTop: 16,
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
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  listContent: {
    padding: 16,
  },
  verificationCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  urgentCard: {
    borderColor: Colors.error,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  storeLogoContainer: {
    marginRight: 12,
  },
  storeLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  storeLogoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  ownerName: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  ownerEmail: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  urgentBadge: {
    marginLeft: 8,
  },
  submissionInfo: {
    backgroundColor: Colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  urgentText: {
    color: Colors.error,
    fontWeight: '600',
  },
  documentsPreview: {
    marginBottom: 16,
  },
  documentsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  documentsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  documentText: {
    fontSize: 12,
    color: Colors.successDark,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  viewButton: {
    backgroundColor: Colors.infoLight,
    borderWidth: 1,
    borderColor: Colors.info,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.info,
  },
  approveButton: {
    backgroundColor: Colors.success,
  },
  approveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  rejectButton: {
    backgroundColor: Colors.error,
  },
  rejectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
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
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 100,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  submitButton: {
    backgroundColor: Colors.error,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default AllPendingStoreVerificationsScreen;