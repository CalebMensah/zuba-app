import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useEscrow } from '../../hooks/useEscrow';
import { Colors } from '../../constants/colors';

interface EscrowData {
  id: string;
  amountHeld: number;
  currency: string;
  releaseDate: string;
  releaseStatus: 'PENDING' | 'RELEASED' | 'FAILED';
  releaseReason?: string;
  releasedAt?: string;
  releasedTo?: string;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    status: string;
    buyerId: string;
    storeId: string;
    buyer?: {
      id: string;
      firstName: string;
      email: string;
    };
    store?: {
      name: string;
      userId: string;
      user?: {
        id: string;
        firstName: string;
        email: string;
      };
    };
  };
  payment?: {
    id: string;
    amount: number;
    currency: string;
    status: string;
  };
}

interface EscrowStatusData {
  escrow: EscrowData;
  canConfirmReceipt: boolean;
}

interface Props {
  route: {
    params: {
      orderId: string;
    };
  };
  navigation: any;
}

const EscrowScreen: React.FC<Props> = ({ route, navigation }) => {
  const { orderId } = route.params;
  const { user } = useAuth();
  const { loading, error, getOrderEscrowStatus, confirmOrderReceived } = useEscrow();
  
  const [escrowData, setEscrowData] = useState<EscrowStatusData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const isBuyer = user?.role === 'BUYER';
  const isSeller = user?.role === 'SELLER';

  useEffect(() => {
    fetchEscrowStatus();
  }, [orderId]);

  const fetchEscrowStatus = async () => {
    try {
      const response = await getOrderEscrowStatus(orderId);
      
      if (response.success && response.data) {
        setEscrowData(response.data);
      } else {
        Alert.alert('Error', response.message || 'Failed to fetch escrow status');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEscrowStatus();
    setRefreshing(false);
  };

  const handleConfirmReceipt = async () => {
    setConfirming(true);
    setShowConfirmModal(false);

    try {
      const response = await confirmOrderReceived(orderId);
      
      if (response.success) {
        Alert.alert(
          'Success',
          'Order confirmed! Funds have been released to the seller.',
          [
            {
              text: 'OK',
              onPress: () => {
                fetchEscrowStatus();
                // Navigate back or to orders screen
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to confirm order receipt');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setConfirming(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getDaysUntilRelease = (releaseDate: string) => {
    const now = new Date();
    const release = new Date(releaseDate);
    const diffTime = release.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: 'Release overdue', color: Colors.error };
    if (diffDays === 0) return { text: 'Releases today', color: Colors.warning };
    if (diffDays === 1) return { text: 'Releases in 1 day', color: Colors.info };
    return { text: `Releases in ${diffDays} days`, color: Colors.info };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return Colors.warning;
      case 'RELEASED':
        return Colors.success;
      case 'FAILED':
        return Colors.error;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusBackground = (status: string) => {
    switch (status) {
      case 'PENDING':
        return Colors.warningLight;
      case 'RELEASED':
        return Colors.successLight;
      case 'FAILED':
        return Colors.errorLight;
      default:
        return Colors.gray100;
    }
  };

  if (loading && !escrowData) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading escrow details...</Text>
      </View>
    );
  }

  if (!escrowData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No escrow data available</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchEscrowStatus}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { escrow, canConfirmReceipt } = escrowData;
  const releaseInfo = getDaysUntilRelease(escrow.releaseDate);

  return (
    <View style={styles.container}>
      <ScrollView
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Escrow Details</Text>
          <Text style={styles.subtitle}>Order #{orderId.slice(0, 8)}</Text>
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.statusContainer}>
            <Text style={styles.sectionLabel}>Escrow Status</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getStatusBackground(escrow.releaseStatus) }
            ]}>
              <Text style={[
                styles.statusText,
                { color: getStatusColor(escrow.releaseStatus) }
              ]}>
                {escrow.releaseStatus}
              </Text>
            </View>
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Amount Held</Text>
            <Text style={styles.amount}>
              {formatCurrency(escrow.amountHeld, escrow.currency)}
            </Text>
          </View>
        </View>

        {/* Release Information */}
        {escrow.releaseStatus === 'PENDING' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Release Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Scheduled Release</Text>
              <Text style={styles.infoValue}>{formatDate(escrow.releaseDate)}</Text>
            </View>
            <View style={[
              styles.releaseTimerBadge,
              { backgroundColor: releaseInfo.color + '20' }
            ]}>
              <Text style={[styles.releaseTimerText, { color: releaseInfo.color }]}>
                ⏰ {releaseInfo.text}
              </Text>
            </View>

            {isBuyer && (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  💡 You can confirm receipt once the order is delivered to release funds immediately.
                </Text>
              </View>
            )}

            {isSeller && (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  💡 Funds will be automatically released on the scheduled date or when the buyer confirms receipt.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Released Information */}
        {escrow.releaseStatus === 'RELEASED' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Release Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Released At</Text>
              <Text style={styles.infoValue}>{formatDate(escrow.releasedAt!)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Released By</Text>
              <Text style={styles.infoValue}>
                {escrow.releasedTo === 'buyer_confirmation' ? 'Buyer Confirmation' : 'Auto Release'}
              </Text>
            </View>
            {escrow.releaseReason && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Reason</Text>
                <Text style={styles.infoValue}>
                  {escrow.releaseReason.replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Failed Information */}
        {escrow.releaseStatus === 'FAILED' && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.sectionTitle}>Release Failed</Text>
            {escrow.releaseReason && (
              <Text style={styles.errorMessage}>{escrow.releaseReason}</Text>
            )}
            <Text style={styles.errorSubtext}>
              Please contact support for assistance.
            </Text>
          </View>
        )}

        {/* Order Details */}
        {escrow.order && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Order Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Status</Text>
              <View style={styles.orderStatusBadge}>
                <Text style={styles.orderStatusText}>{escrow.order.status}</Text>
              </View>
            </View>
            {isBuyer && escrow.order.store && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Store</Text>
                  <Text style={styles.infoValue}>{escrow.order.store.name}</Text>
                </View>
                {escrow.order.store.user && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Seller</Text>
                    <Text style={styles.infoValue}>
                      {escrow.order.store.user.firstName}
                    </Text>
                  </View>
                )}
              </>
            )}
            {isSeller && escrow.order.buyer && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Buyer</Text>
                  <Text style={styles.infoValue}>
                    {escrow.order.buyer.firstName}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Buyer Email</Text>
                  <Text style={styles.infoValueEmail}>
                    {escrow.order.buyer.email}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Payment Details */}
        {escrow.payment && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment ID</Text>
              <Text style={styles.infoValue}>{escrow.payment.id.slice(0, 12)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Amount</Text>
              <Text style={styles.infoValue}>
                {formatCurrency(escrow.payment.amount, escrow.payment.currency)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>{escrow.payment.status}</Text>
            </View>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.timelineDotCompleted]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Escrow Created</Text>
                <Text style={styles.timelineDate}>{formatDate(escrow.createdAt)}</Text>
              </View>
            </View>
            
            {escrow.releaseStatus === 'RELEASED' && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, styles.timelineDotCompleted]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Funds Released</Text>
                  <Text style={styles.timelineDate}>{formatDate(escrow.releasedAt!)}</Text>
                </View>
              </View>
            )}

            {escrow.releaseStatus === 'PENDING' && (
              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Scheduled Release</Text>
                  <Text style={styles.timelineDate}>{formatDate(escrow.releaseDate)}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      {isBuyer && canConfirmReceipt && escrow.releaseStatus === 'PENDING' && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => setShowConfirmModal(true)}
            disabled={confirming}
          >
            {confirming ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.confirmButtonText}>Confirm Receipt & Release Funds</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.actionHint}>
            By confirming, you acknowledge receiving the order and approve the release of funds to the seller.
          </Text>
        </View>
      )}

      {isSeller && escrow.releaseStatus === 'PENDING' && (
        <View style={styles.actionContainer}>
          <View style={styles.sellerInfoBox}>
            <Text style={styles.sellerInfoTitle}>⏳ Awaiting Release</Text>
            <Text style={styles.sellerInfoText}>
              Funds will be released {releaseInfo.text.toLowerCase()} or when the buyer confirms receipt.
            </Text>
          </View>
        </View>
      )}

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Order Receipt</Text>
            <Text style={styles.modalText}>
              Have you received your order in good condition?
            </Text>
            <Text style={styles.modalSubtext}>
              This will immediately release {formatCurrency(escrow.amountHeld, escrow.currency)} to the seller.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonConfirm}
                onPress={handleConfirmReceipt}
              >
                <Text style={styles.modalButtonConfirmText}>Yes, Release Funds</Text>
              </TouchableOpacity>
            </View>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  errorCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
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
  amountContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  amountLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.success,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
  infoValueEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    textAlign: 'right',
  },
  releaseTimerBadge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  releaseTimerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoBoxText: {
    fontSize: 13,
    color: Colors.info,
    lineHeight: 18,
  },
  orderStatusBadge: {
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning,
  },
  errorMessage: {
    fontSize: 14,
    color: Colors.error,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.gray300,
    marginTop: 4,
    marginRight: 12,
  },
  timelineDotCompleted: {
    backgroundColor: Colors.success,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  actionHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  sellerInfoBox: {
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  sellerInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.info,
    marginBottom: 8,
  },
  sellerInfoText: {
    fontSize: 14,
    color: Colors.info,
    textAlign: 'center',
    lineHeight: 20,
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
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: Colors.backgroundTertiary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default EscrowScreen;