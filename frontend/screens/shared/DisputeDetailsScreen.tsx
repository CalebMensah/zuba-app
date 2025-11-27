import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDisputes, Dispute, DisputeStatus, DisputeType } from '../../hooks/useDisputes';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/colors';

interface RouteParams {
  disputeId: string;
  autoResolve?: boolean;
}

const DisputeDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { disputeId, autoResolve } = route.params as RouteParams;
  const { user } = useAuth();

  const {
    loading,
    error,
    getDisputeById,
    resolveDispute,
    updateDispute,
    cancelDispute,
    clearError,
  } = useDisputes();

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Form states
  const [resolution, setResolution] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDisputeDetails();
  }, [disputeId]);

  useEffect(() => {
    if (autoResolve && dispute && dispute.status === 'PENDING' && user?.role === 'ADMIN') {
      setShowResolveModal(true);
    }
  }, [autoResolve, dispute]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error, clearError]);

  const fetchDisputeDetails = async () => {
    setRefreshing(true);
    const result = await getDisputeById(disputeId);
    if (result) {
      setDispute(result);
      setRefundAmount(result.order?.totalAmount?.toString() || '');
    }
    setRefreshing(false);
  };

  const handleResolve = async (status: 'RESOLVED' | 'CANCELLED') => {
    if (!resolution.trim()) {
      Alert.alert('Error', 'Please provide resolution details');
      return;
    }

    setActionLoading(true);

    const refundAmountNum = refundAmount ? parseFloat(refundAmount) : undefined;

    const result = await resolveDispute(disputeId, {
      status,
      resolution,
      refundAmount: refundAmountNum,
    });

    setActionLoading(false);

    if (result) {
      if (result.requiresManualRefund) {
        Alert.alert(
          'Manual Refund Required',
          'The dispute has been resolved, but funds were already released to the seller. Manual refund processing is required.',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowResolveModal(false);
                fetchDisputeDetails();
              },
            },
          ]
        );
      } else {
        Alert.alert('Success', 'Dispute resolved successfully', [
          {
            text: 'OK',
            onPress: () => {
              setShowResolveModal(false);
              fetchDisputeDetails();
            },
          },
        ]);
      }
    }
  };

  const handleUpdate = async () => {
    if (!additionalInfo.trim()) {
      Alert.alert('Error', 'Please provide additional information');
      return;
    }

    setActionLoading(true);
    const result = await updateDispute(disputeId, additionalInfo);
    setActionLoading(false);

    if (result) {
      Alert.alert('Success', 'Dispute updated successfully', [
        {
          text: 'OK',
          onPress: () => {
            setShowUpdateModal(false);
            setAdditionalInfo('');
            fetchDisputeDetails();
          },
        },
      ]);
    }
  };

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Dispute',
      'Are you sure you want to cancel this dispute?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const result = await cancelDispute(disputeId, cancelReason);
            setActionLoading(false);

            if (result) {
              Alert.alert('Success', 'Dispute cancelled successfully', [
                {
                  text: 'OK',
                  onPress: () => {
                    setShowCancelModal(false);
                    fetchDisputeDetails();
                  },
                },
              ]);
            }
          },
        },
      ]
    );
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

  const isAdmin = user?.role === 'ADMIN';
  const isBuyer = dispute?.buyerId === user?.id;
  const isSeller = dispute?.sellerId === user?.id;
  const isPending = dispute?.status === 'PENDING';

  if (loading && !dispute) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading dispute details...</Text>
      </View>
    );
  }

  if (!dispute) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Dispute Not Found</Text>
        <Text style={styles.errorText}>Unable to load dispute details</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <ActivityIndicator
            refreshing={refreshing}
            onRefresh={fetchDisputeDetails}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Header Card */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.disputeId}>Dispute #{dispute.id.slice(0, 8)}</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${getStatusColor(dispute.status)}20` },
              ]}
            >
              <Text style={[styles.statusText, { color: getStatusColor(dispute.status) }]}>
                {dispute.status}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoSection}>
            <InfoRow label="Type" value={getTypeLabel(dispute.type)} />
            <InfoRow
              label="Created"
              value={new Date(dispute.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
            {dispute.resolvedAt && (
              <InfoRow
                label="Resolved"
                value={new Date(dispute.resolvedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              />
            )}
          </View>
        </View>

        {/* Order Information */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.divider} />
          <View style={styles.infoSection}>
            <InfoRow label="Order ID" value={`#${dispute.orderId.slice(0, 8)}`} />
            <InfoRow label="Order Status" value={dispute.order?.status || 'N/A'} />
            <InfoRow
              label="Amount"
              value={`${dispute.order?.currency || '$'} ${dispute.order?.totalAmount?.toFixed(2) || '0.00'}`}
              valueStyle={styles.amountValue}
            />
            {dispute.order?.payment && (
              <>
                <InfoRow label="Payment Status" value={dispute.order.payment.status} />
                {dispute.order.payment.gatewayRef && (
                  <InfoRow
                    label="Payment Ref"
                    value={dispute.order.payment.gatewayRef.slice(0, 16)}
                  />
                )}
              </>
            )}
            {dispute.order?.escrow && (
              <InfoRow
                label="Escrow Status"
                value={dispute.order.escrow.releaseStatus}
                valueStyle={{
                  color:
                    dispute.order.escrow.releaseStatus === 'RELEASED'
                      ? Colors.error
                      : dispute.order.escrow.releaseStatus === 'REFUNDED'
                      ? Colors.success
                      : Colors.warning,
                }}
              />
            )}
          </View>
        </View>

        {/* Parties Information */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Parties Involved</Text>
          <View style={styles.divider} />
          <View style={styles.infoSection}>
            <View style={styles.partySection}>
              <Text style={styles.partyLabel}>Buyer</Text>
              <Text style={styles.partyName}>
                {dispute.order?.buyer?.firstName || 'N/A'}
              </Text>
              <Text style={styles.partyEmail}>{dispute.order?.buyer?.email || ''}</Text>
            </View>
            <View style={[styles.divider, { marginVertical: 12 }]} />
            <View style={styles.partySection}>
              <Text style={styles.partyLabel}>Seller</Text>
              <Text style={styles.partyName}>{dispute.order?.store?.name || 'N/A'}</Text>
              <Text style={styles.partyEmail}>
                {dispute.order?.store?.user?.email || ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Description</Text>
          <View style={styles.divider} />
          <Text style={styles.descriptionText}>{dispute.description}</Text>
        </View>

        {/* Resolution (if resolved) */}
        {dispute.resolution && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Resolution</Text>
            <View style={styles.divider} />
            <Text style={styles.descriptionText}>{dispute.resolution}</Text>
          </View>
        )}

        {/* Action Buttons */}
        {isPending && (
          <View style={styles.actionsCard}>
            {isAdmin && (
              <>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => setShowResolveModal(true)}
                >
                  <Text style={styles.primaryButtonText}>Resolve Dispute</Text>
                </TouchableOpacity>
              </>
            )}

            {(isBuyer || isSeller) && (
              <>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setShowUpdateModal(true)}
                >
                  <Text style={styles.secondaryButtonText}>Add Information</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dangerButton}
                  onPress={() => setShowCancelModal(true)}
                >
                  <Text style={styles.dangerButtonText}>Cancel Dispute</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Resolve Modal (Admin Only) */}
      <Modal
        visible={showResolveModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowResolveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Resolve Dispute</Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter resolution details..."
              placeholderTextColor={Colors.gray400}
              value={resolution}
              onChangeText={setResolution}
              multiline
              numberOfLines={4}
            />

            <TextInput
              style={styles.input}
              placeholder="Refund amount (optional)"
              placeholderTextColor={Colors.gray400}
              value={refundAmount}
              onChangeText={setRefundAmount}
              keyboardType="decimal-pad"
            />

            <Text style={styles.helperText}>
              Leave refund amount empty to refund the full order amount
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowResolveModal(false)}
                disabled={actionLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => handleResolve('RESOLVED')}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>Resolve</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Update Modal (Buyer/Seller) */}
      <Modal
        visible={showUpdateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUpdateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Information</Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter additional information..."
              placeholderTextColor={Colors.gray400}
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowUpdateModal(false)}
                disabled={actionLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleUpdate}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Modal (Buyer/Seller) */}
      <Modal
        visible={showCancelModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Dispute</Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Reason for cancellation (optional)..."
              placeholderTextColor={Colors.gray400}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCancelModal(false)}
                disabled={actionLoading}
              >
                <Text style={styles.cancelButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.dangerButton]}
                onPress={handleCancel}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.dangerButtonText}>Cancel Dispute</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Helper Component
const InfoRow = ({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: any;
}) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}:</Text>
    <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  disputeId: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  infoSection: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  amountValue: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '700',
  },
  partySection: {
    gap: 4,
  },
  partyLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  partyName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  partyEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  descriptionText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  actionsCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  dangerButton: {
    backgroundColor: Colors.error,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  input: {
    backgroundColor: Colors.gray50,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  modalActions: {
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
    backgroundColor: Colors.gray100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default DisputeDetailsScreen;