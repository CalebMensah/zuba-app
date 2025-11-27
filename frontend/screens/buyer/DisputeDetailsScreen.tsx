import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useDisputes, Dispute, DisputeType } from '../../hooks/useDisputes';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/colors';

interface RouteParams {
  disputeId: string;
}

const DisputeDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { disputeId } = route.params as RouteParams;
  const { user } = useAuth();

  const {
    loading,
    error,
    getDisputeById,
    updateDispute,
    cancelDispute,
    clearError,
  } = useDisputes();

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddInfoModal, setShowAddInfoModal] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [addingInfo, setAddingInfo] = useState(false);

  useEffect(() => {
    loadDispute();
  }, [disputeId]);

  useFocusEffect(
    useCallback(() => {
      loadDispute();
    }, [disputeId])
  );

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error]);

  const loadDispute = async () => {
    try {
      const disputeData = await getDisputeById(disputeId);
      if (disputeData) {
        setDispute(disputeData);
      } else {
        Alert.alert('Error', 'Dispute not found', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      console.error('Error loading dispute:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDispute();
    setRefreshing(false);
  };

  const handleAddInfo = async () => {
    if (!additionalInfo.trim()) {
      Alert.alert('Error', 'Please provide additional information');
      return;
    }

    if (additionalInfo.trim().length < 10) {
      Alert.alert('Error', 'Additional information must be at least 10 characters');
      return;
    }

    setAddingInfo(true);
    const updatedDispute = await updateDispute(disputeId, additionalInfo.trim());
    setAddingInfo(false);

    if (updatedDispute) {
      setDispute(updatedDispute);
      setAdditionalInfo('');
      setShowAddInfoModal(false);
      Alert.alert('Success', 'Additional information added successfully');
    }
  };

  const handleCancelDispute = () => {
    Alert.alert(
      'Cancel Dispute',
      'Are you sure you want to cancel this dispute? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            const cancelled = await cancelDispute(disputeId, 'Cancelled by user');
            if (cancelled) {
              Alert.alert('Dispute Cancelled', 'Your dispute has been cancelled', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            }
          },
        },
      ]
    );
  };

  const getDisputeTypeLabel = (type: DisputeType): string => {
    const labels: Record<DisputeType, string> = {
      REFUND_REQUEST: 'Refund Request',
      ITEM_NOT_AS_DESCRIBED: 'Not as Described',
      ITEM_NOT_RECEIVED: 'Not Received',
      WRONG_ITEM_SENT: 'Wrong Item',
      DAMAGED_ITEM: 'Damaged Item',
      OTHER: 'Other',
    };
    return labels[type] || type;
  };

  const getDisputeTypeIcon = (type: DisputeType): string => {
    const icons: Record<DisputeType, string> = {
      REFUND_REQUEST: 'cash-outline',
      ITEM_NOT_AS_DESCRIBED: 'alert-circle-outline',
      ITEM_NOT_RECEIVED: 'cube-outline',
      WRONG_ITEM_SENT: 'swap-horizontal-outline',
      DAMAGED_ITEM: 'warning-outline',
      OTHER: 'help-circle-outline',
    };
    return icons[type] || 'help-circle-outline';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return Colors.warning;
      case 'RESOLVED':
        return Colors.success;
      case 'CANCELLED':
        return Colors.gray400;
      default:
        return Colors.gray400;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return Colors.warningLight;
      case 'RESOLVED':
        return Colors.infoLight;
      case 'CANCELLED':
        return Colors.gray100;
      default:
        return Colors.gray100;
    }
  };

  const parseDescription = (description: string) => {
    // Split description by update markers
    const parts = description.split(/\[UPDATE from (Buyer|Seller)\]:/);
    const mainDescription = parts[0].trim();
    const updates: Array<{ from: string; text: string }> = [];

    for (let i = 1; i < parts.length; i += 2) {
      if (parts[i + 1]) {
        updates.push({
          from: parts[i],
          text: parts[i + 1].trim(),
        });
      }
    }

    return { mainDescription, updates };
  };

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
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorText}>Dispute not found</Text>
      </View>
    );
  }

  const { mainDescription, updates } = parseDescription(dispute.description);
  const isBuyer = user?.id === dispute.buyerId;
  const canAddInfo = dispute.status === 'PENDING';
  const canCancel = dispute.status === 'PENDING';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Status Header */}
        <View style={[styles.statusHeader, { backgroundColor: getStatusBgColor(dispute.status) }]}>
          <View style={styles.statusHeaderContent}>
            <View style={styles.statusIconContainer}>
              <Ionicons
                name={getDisputeTypeIcon(dispute.type) as any}
                size={32}
                color={getStatusColor(dispute.status)}
              />
            </View>
            <View style={styles.statusHeaderText}>
              <Text style={styles.disputeTypeLabel}>{getDisputeTypeLabel(dispute.type)}</Text>
              <Text style={styles.disputeId}>Dispute #{dispute.id.slice(0, 8)}</Text>
            </View>
          </View>
          <View style={[styles.statusBadgeLarge, { backgroundColor: Colors.white }]}>
            <Text style={[styles.statusTextLarge, { color: getStatusColor(dispute.status) }]}>
              {dispute.status}
            </Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.timelineDotActive]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Dispute Created</Text>
                <Text style={styles.timelineDate}>
                  {new Date(dispute.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>

            {dispute.updatedAt !== dispute.createdAt && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, styles.timelineDotActive]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Last Updated</Text>
                  <Text style={styles.timelineDate}>
                    {new Date(dispute.updatedAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            )}

            {dispute.resolvedAt && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, styles.timelineDotResolved]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>
                    {dispute.status === 'RESOLVED' ? 'Resolved' : 'Cancelled'}
                  </Text>
                  <Text style={styles.timelineDate}>
                    {new Date(dispute.resolvedAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Order Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <TouchableOpacity
            style={styles.orderCard}
            onPress={() => (navigation as any).navigate('OrderDetails', { orderId: dispute.orderId })}
          >
            <View style={styles.orderCardHeader}>
              <View style={styles.orderCardInfo}>
                <Text style={styles.orderCardTitle}>Order #{dispute.orderId.slice(0, 8)}</Text>
                <Text style={styles.orderCardSubtitle}>
                  {dispute.order?.store?.name || 'Unknown Store'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={Colors.textTertiary} />
            </View>
            {dispute.order && (
              <View style={styles.orderCardDetails}>
                <View style={styles.orderDetailRow}>
                  <Text style={styles.orderDetailLabel}>Total Amount</Text>
                  <Text style={styles.orderDetailValue}>
                    {dispute.order.currency || 'GHS'} {dispute.order.totalAmount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.orderDetailRow}>
                  <Text style={styles.orderDetailLabel}>Order Status</Text>
                  <Text style={styles.orderDetailValue}>{dispute.order.status}</Text>
                </View>
                {dispute.order.payment && (
                  <View style={styles.orderDetailRow}>
                    <Text style={styles.orderDetailLabel}>Payment Status</Text>
                    <Text style={styles.orderDetailValue}>{dispute.order.payment.status}</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Original Complaint */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Original Complaint</Text>
          <View style={styles.complaintCard}>
            <View style={styles.complaintHeader}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {isBuyer ? 'You' : dispute.order?.buyer?.firstName?.charAt(0) || 'B'}
                </Text>
              </View>
              <View style={styles.complaintHeaderText}>
                <Text style={styles.complaintAuthor}>
                  {isBuyer ? 'You' : dispute.order?.buyer?.firstName || 'Buyer'}
                </Text>
                <Text style={styles.complaintRole}>Buyer</Text>
              </View>
            </View>
            <Text style={styles.complaintText}>{mainDescription}</Text>
          </View>
        </View>

        {/* Updates/Messages */}
        {updates.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Updates</Text>
            {updates.map((update, index) => (
              <View key={index} style={styles.updateCard}>
                <View style={styles.updateHeader}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {update.from === 'Buyer'
                        ? isBuyer
                          ? 'You'
                          : 'B'
                        : isBuyer
                        ? 'S'
                        : 'You'}
                    </Text>
                  </View>
                  <View style={styles.updateHeaderText}>
                    <Text style={styles.updateAuthor}>
                      {update.from === 'Buyer'
                        ? isBuyer
                          ? 'You'
                          : 'Buyer'
                        : isBuyer
                        ? 'Seller'
                        : 'You'}
                    </Text>
                    <Text style={styles.updateRole}>{update.from}</Text>
                  </View>
                </View>
                <Text style={styles.updateText}>{update.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Resolution (if resolved) */}
        {dispute.resolution && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resolution</Text>
            <View
              style={[
                styles.resolutionCard,
                dispute.status === 'RESOLVED' && styles.resolutionCardSuccess,
              ]}
            >
              <View style={styles.resolutionHeader}>
                <Ionicons
                  name={
                    dispute.status === 'RESOLVED'
                      ? 'checkmark-circle'
                      : 'close-circle'
                  }
                  size={24}
                  color={dispute.status === 'RESOLVED' ? Colors.success : Colors.gray400}
                />
                <Text style={styles.resolutionTitle}>
                  {dispute.status === 'RESOLVED' ? 'Dispute Resolved' : 'Dispute Cancelled'}
                </Text>
              </View>
              <Text style={styles.resolutionText}>{dispute.resolution}</Text>
            </View>
          </View>
        )}

        {/* Help Section */}
        <View style={styles.section}>
          <View style={styles.helpCard}>
            <Ionicons name="help-circle-outline" size={24} color={Colors.info} />
            <View style={styles.helpText}>
              <Text style={styles.helpTitle}>Need Help?</Text>
              <Text style={styles.helpDescription}>
                If you have questions about this dispute, please contact our support team.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      {canAddInfo && (
        <View style={styles.footer}>
          {canCancel && (
            <TouchableOpacity
              style={styles.cancelDisputeButton}
              onPress={handleCancelDispute}
              disabled={loading}
            >
              <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
              <Text style={styles.cancelDisputeButtonText}>Cancel Dispute</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.addInfoButton}
            onPress={() => setShowAddInfoModal(true)}
            disabled={loading}
          >
            <Ionicons name="add-circle-outline" size={20} color={Colors.white} />
            <Text style={styles.addInfoButtonText}>Add Information</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add Info Modal */}
      <Modal
        visible={showAddInfoModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Additional Information</Text>
              <TouchableOpacity onPress={() => setShowAddInfoModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Provide any additional details that might help resolve this dispute.
            </Text>

            <TextInput
              style={styles.modalTextArea}
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              placeholder="Enter additional information..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={6}
              maxLength={500}
              textAlignVertical="top"
            />

            <Text style={styles.modalCharCount}>{additionalInfo.length}/500 characters</Text>

            <TouchableOpacity
              style={[
                styles.modalSubmitButton,
                (!additionalInfo.trim() || addingInfo) && styles.modalSubmitButtonDisabled,
              ]}
              onPress={handleAddInfo}
              disabled={!additionalInfo.trim() || addingInfo}
            >
              {addingInfo ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.modalSubmitButtonText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.error,
  },
  statusHeader: {
    padding: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  statusHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusHeaderText: {
    flex: 1,
  },
  disputeTypeLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  disputeId: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statusBadgeLarge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statusTextLarge: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 16,
  },
  timelineDotActive: {
    backgroundColor: Colors.primary,
  },
  timelineDotResolved: {
    backgroundColor: Colors.success,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  orderCardInfo: {
    flex: 1,
  },
  orderCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  orderCardSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  orderCardDetails: {
    gap: 8,
  },
  orderDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderDetailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  orderDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  complaintCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  complaintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
  complaintHeaderText: {
    flex: 1,
  },
  complaintAuthor: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  complaintRole: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  complaintText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  updateCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  updateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  updateHeaderText: {
    flex: 1,
  },
  updateAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  updateRole: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  updateText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  resolutionCard: {
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.gray300,
  },
  resolutionCardSuccess: {
    backgroundColor: Colors.infoLight,
    borderColor: Colors.success,
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resolutionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  resolutionText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  helpCard: {
    flexDirection: 'row',
    backgroundColor: Colors.infoLight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.info,
  },
  helpText: {
    flex: 1,
    marginLeft: 12,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.info,
    marginBottom: 4,
  },
  helpDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  cancelDisputeButton: {
    flex: 1,
    backgroundColor: Colors.errorLight,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cancelDisputeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
  },
  addInfoButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    gap: 8,
  },
  addInfoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  modalDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalTextArea: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCharCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 16,
  },
  modalSubmitButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitButtonDisabled: {
    backgroundColor: Colors.disabled,
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default DisputeDetailsScreen;