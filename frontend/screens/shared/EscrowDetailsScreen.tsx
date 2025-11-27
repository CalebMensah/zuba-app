import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useEscrow } from '../hooks/useEscrow';

// Types
type RootStackParamList = {
  EscrowDetails: { escrowId: string };
  OrderDetails: { orderId: string };
};

type EscrowDetailsRouteProp = RouteProp<RootStackParamList, 'EscrowDetails'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface EscrowDetails {
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
  payment?: {
    id: string;
    amount: number;
    currency: string;
    status: string;
  };
  order?: {
    id: string;
    status: string;
    buyerId: string;
    storeId: string;
    buyer?: {
      id: string;
      name?: string;
      firstName?: string;
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
}

const EscrowDetailsScreen: React.FC = () => {
  const route = useRoute<EscrowDetailsRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { getEscrowDetails, confirmOrderReceived, loading } = useEscrow();

  const [escrow, setEscrow] = useState<EscrowDetails | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const { escrowId } = route.params;

  useEffect(() => {
    fetchEscrowDetails();
  }, [escrowId]);

  const fetchEscrowDetails = async () => {
    try {
      const response = await getEscrowDetails(escrowId);
      if (response.success && response.data) {
        setEscrow(response.data);
      } else {
        Alert.alert('Error', response.message || 'Failed to fetch escrow details');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEscrowDetails();
    setRefreshing(false);
  };

  const handleConfirmReceipt = () => {
    Alert.alert(
      'Confirm Receipt',
      'By confirming receipt, funds will be immediately released to the seller. This action cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            if (!escrow?.order?.id) return;

            setActionLoading(true);
            try {
              const response = await confirmOrderReceived(escrow.order.id);
              if (response.success) {
                Alert.alert('Success', 'Order confirmed! Funds have been released to the seller.', [
                  {
                    text: 'OK',
                    onPress: () => {
                      fetchEscrowDetails();
                    },
                  },
                ]);
              } else {
                Alert.alert('Error', response.message || 'Failed to confirm order');
              }
            } catch (error) {
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'Please reach out to our support team for assistance with this escrow.',
      [{ text: 'OK' }]
    );
  };

  const handleViewOrder = () => {
    if (escrow?.order?.id) {
      navigation.navigate('OrderDetails', { orderId: escrow.order.id });
    }
  };

  const handleRetryRelease = () => {
    Alert.alert(
      'Retry Release',
      'This will attempt to release the escrow funds again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retry',
          onPress: () => {
            // TODO: Implement retry release functionality
            Alert.alert('Admin Action', 'Retry release functionality will be implemented');
          },
        },
      ]
    );
  };

  const handleViewLogs = () => {
    Alert.alert('Admin Action', 'View logs functionality will be implemented');
  };

  const getUserRole = (): 'ADMIN' | 'SELLER' | 'BUYER' | 'UNKNOWN' => {
    if (!user || !escrow?.order) return 'UNKNOWN';

    if (user.role === 'ADMIN') return 'ADMIN';
    if (escrow.order.store?.userId === user.id) return 'SELLER';
    if (escrow.order.buyerId === user.id) return 'BUYER';

    return 'UNKNOWN';
  };

  const canConfirmReceipt = (): boolean => {
    const role = getUserRole();
    return (
      role === 'BUYER' &&
      escrow?.order?.status === 'DELIVERED' &&
      escrow?.releaseStatus === 'PENDING'
    );
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'PENDING':
        return '#F59E0B';
      case 'RELEASED':
        return '#10B981';
      case 'FAILED':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    const color = getStatusColor(status);
    switch (status) {
      case 'PENDING':
        return <Ionicons name="time-outline" size={20} color={color} />;
      case 'RELEASED':
        return <Ionicons name="checkmark-circle" size={20} color={color} />;
      case 'FAILED':
        return <Ionicons name="close-circle" size={20} color={color} />;
      default:
        return <Ionicons name="alert-circle-outline" size={20} color={color} />;
    }
  };

  const renderActionButtons = () => {
    const role = getUserRole();

    if (actionLoading || loading) {
      return (
        <View style={styles.actionContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      );
    }

    switch (role) {
      case 'BUYER':
        return (
          <View style={styles.actionContainer}>
            {canConfirmReceipt() ? (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.primaryButton]}
                  onPress={handleConfirmReceipt}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Confirm Receipt & Release Funds</Text>
                </TouchableOpacity>
                <Text style={styles.actionHint}>
                  By confirming, funds will be released to the seller immediately
                </Text>
              </>
            ) : escrow?.releaseStatus === 'PENDING' ? (
              <>
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={20} color="#F59E0B" />
                  <Text style={styles.infoText}>
                    Funds will be automatically released on {formatDate(escrow.releaseDate)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryButton]}
                  onPress={handleViewOrder}
                >
                  <Ionicons name="cube-outline" size={20} color="#3B82F6" />
                  <Text style={styles.secondaryButtonText}>View Order Details</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={handleViewOrder}
              >
                <Ionicons name="cube-outline" size={20} color="#3B82F6" />
                <Text style={styles.secondaryButtonText}>View Order Details</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.tertiaryButton]}
              onPress={handleContactSupport}
            >
              <Ionicons name="help-circle-outline" size={20} color="#6B7280" />
              <Text style={styles.tertiaryButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        );

      case 'SELLER':
        return (
          <View style={styles.actionContainer}>
            {escrow?.releaseStatus === 'PENDING' ? (
              <View style={styles.infoBox}>
                <Ionicons name="time-outline" size={20} color="#F59E0B" />
                <Text style={styles.infoText}>
                  Awaiting buyer confirmation or automatic release on{' '}
                  {formatDate(escrow.releaseDate)}
                </Text>
              </View>
            ) : escrow?.releaseStatus === 'RELEASED' ? (
              <View style={[styles.infoBox, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={[styles.infoText, { color: '#047857' }]}>
                  Funds have been released to your account
                </Text>
              </View>
            ) : (
              <View style={[styles.infoBox, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={[styles.infoText, { color: '#991B1B' }]}>
                  Escrow release failed. Please contact support.
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={handleViewOrder}
            >
              <Ionicons name="cube-outline" size={20} color="#3B82F6" />
              <Text style={styles.secondaryButtonText}>View Order Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.tertiaryButton]}
              onPress={handleContactSupport}
            >
              <Ionicons name="help-circle-outline" size={20} color="#6B7280" />
              <Text style={styles.tertiaryButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        );

      case 'ADMIN':
        return (
          <View style={styles.actionContainer}>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMIN VIEW</Text>
            </View>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={handleViewOrder}
            >
              <Ionicons name="cube-outline" size={20} color="#3B82F6" />
              <Text style={styles.secondaryButtonText}>View Order Details</Text>
            </TouchableOpacity>
            {escrow?.releaseStatus === 'FAILED' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.warningButton]}
                onPress={handleRetryRelease}
              >
                <Ionicons name="reload" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Retry Release</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.tertiaryButton]}
              onPress={handleViewLogs}
            >
              <MaterialCommunityIcons name="file-document-outline" size={20} color="#6B7280" />
              <Text style={styles.tertiaryButtonText}>View Logs</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return (
          <View style={styles.actionContainer}>
            <Text style={styles.unauthorizedText}>Unauthorized to perform actions on this escrow</Text>
          </View>
        );
    }
  };

  if (loading && !escrow) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading escrow details...</Text>
      </View>
    );
  }

  if (!escrow) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Escrow not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchEscrowDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        {/* Status Header */}
        <View style={styles.statusHeader}>
          <View style={styles.statusBadge}>
            {getStatusIcon(escrow.releaseStatus)}
            <Text style={[styles.statusText, { color: getStatusColor(escrow.releaseStatus) }]}>
              {escrow.releaseStatus}
            </Text>
          </View>
        </View>

        {/* Amount Card */}
        <View style={styles.card}>
          <View style={styles.amountContainer}>
            <MaterialCommunityIcons name="cash" size={32} color="#3B82F6" />
            <View style={styles.amountDetails}>
              <Text style={styles.amountLabel}>Amount Held</Text>
              <Text style={styles.amountValue}>
                {escrow.currency} {escrow.amountHeld.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Escrow Information */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Escrow Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Escrow ID</Text>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
              {escrow.id}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Release Date</Text>
            <View style={styles.infoValueWithIcon}>
              <Ionicons name="calendar-outline" size={16} color="#6B7280" />
              <Text style={styles.infoValue}>{formatDate(escrow.releaseDate)}</Text>
            </View>
          </View>

          {escrow.releasedAt && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Released At</Text>
              <Text style={styles.infoValue}>{formatDate(escrow.releasedAt)}</Text>
            </View>
          )}

          {escrow.releasedTo && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Released By</Text>
              <Text style={styles.infoValue}>
                {escrow.releasedTo.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
          )}

          {escrow.releaseReason && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Release Reason</Text>
              <Text style={styles.infoValue}>
                {escrow.releaseReason.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created At</Text>
            <Text style={styles.infoValue}>{formatDate(escrow.createdAt)}</Text>
          </View>
        </View>

        {/* Order Information */}
        {escrow.order && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Order Information</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order ID</Text>
              <TouchableOpacity onPress={handleViewOrder}>
                <Text style={[styles.infoValue, styles.linkText]}>
                  #{escrow.order.id.slice(0, 8)}...
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Status</Text>
              <Text style={styles.infoValue}>{escrow.order.status}</Text>
            </View>

            {escrow.order.buyer && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Buyer</Text>
                <View style={styles.infoValueWithIcon}>
                  <Ionicons name="person-outline" size={16} color="#6B7280" />
                  <Text style={styles.infoValue}>
                    {escrow.order.buyer.firstName || escrow.order.buyer.name || 'N/A'}
                  </Text>
                </View>
              </View>
            )}

            {escrow.order.store && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Store</Text>
                <View style={styles.infoValueWithIcon}>
                  <Ionicons name="storefront-outline" size={16} color="#6B7280" />
                  <Text style={styles.infoValue}>{escrow.order.store.name}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Payment Information */}
        {escrow.payment && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment Information</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment ID</Text>
              <Text style={styles.infoValue}>{escrow.payment.id.slice(0, 8)}...</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment Amount</Text>
              <Text style={styles.infoValue}>
                {escrow.payment.currency} {escrow.payment.amount.toLocaleString()}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment Status</Text>
              <Text style={styles.infoValue}>{escrow.payment.status}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {renderActionButtons()}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statusHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  amountDetails: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'right',
  },
  infoValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  linkText: {
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
  actionContainer: {
    marginTop: 8,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  secondaryButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  tertiaryButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  warningButton: {
    backgroundColor: '#F59E0B',
  },
  actionHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  adminBadge: {
    backgroundColor: '#7C3AED',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
  },
  adminBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  unauthorizedText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default EscrowDetailsScreen;