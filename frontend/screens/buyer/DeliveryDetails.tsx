import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Clipboard,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useDelivery } from '../../hooks/useDelivery';
import { DeliveryInfo, DeliveryStatus } from '../../types/order';

interface RouteParams {
  orderId: string;
}

const DeliveryInfoScreen = () => {
  const route = useRoute();
  const { orderId } = route.params as RouteParams;

  const { loading, error, getDeliveryInfo, clearError } = useDelivery();

  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDeliveryInfo();
    return () => clearError();
  }, [orderId]);

  const fetchDeliveryInfo = async () => {
    const data = await getDeliveryInfo(orderId);
    if (data) {
      setDeliveryInfo(data);
    } else if (error) {
      Alert.alert('Error', error);
    }
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeliveryInfo();
  };

  const handleCopyTrackingNumber = () => {
    if (deliveryInfo?.trackingNumber) {
      Clipboard.setString(deliveryInfo.trackingNumber);
      Alert.alert(
        'Copied',
        `Tracking number ${deliveryInfo.trackingNumber} copied to clipboard. Visit your courier's website to track your package.`
      );
    } else {
      Alert.alert('No Tracking Info', 'Tracking information is not available yet.');
    }
  };

  const getStatusColor = (status: DeliveryStatus): string => {
    switch (status) {
      case 'PENDING':
        return Colors.gray400;
      case 'PROCESSING':
        return Colors.info;
      case 'DISPATCHED':
        return Colors.primary;
      case 'DELIVERED':
        return Colors.success;
      case 'FAILED':
        return Colors.error;
      case 'RETURNED':
        return Colors.gray600;
      default:
        return Colors.gray400;
    }
  };

  const getStatusIcon = (status: DeliveryStatus): string => {
    switch (status) {
      case 'PENDING':
        return 'time-outline';
      case 'PROCESSING':
        return 'construct-outline';
      case 'DISPATCHED':
        return 'send-outline';
      case 'DELIVERED':
        return 'checkmark-circle-outline';
      case 'FAILED':
        return 'close-circle-outline';
      case 'RETURNED':
        return 'return-up-back-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const getStatusMessage = (status: DeliveryStatus): string => {
    switch (status) {
      case 'PENDING':
        return 'Your order is awaiting processing';
      case 'PROCESSING':
        return 'Your order is being prepared for shipment';
      case 'DISPATCHED':
        return 'Your order has been dispatched and is on the way';
      case 'DELIVERED':
        return 'Your order has been delivered';
      case 'FAILED':
        return 'Delivery attempt failed. Please contact support.';
      case 'RETURNED':
        return 'Your order has been returned';
      default:
        return 'Status unknown';
    }
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Not available';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderInfoRow = (
    icon: string,
    label: string,
    value: string | null | undefined,
    onPress?: () => void
  ) => {
    if (!value) return null;

    return (
      <TouchableOpacity
        style={styles.infoRow}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
        <View style={styles.infoRowLeft}>
          <Ionicons name={icon as any} size={22} color={Colors.primary} />
          <Text style={styles.infoLabel}>{label}</Text>
        </View>
        <View style={styles.infoRowRight}>
          <Text style={styles.infoValue}>{value}</Text>
          {onPress && (
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !deliveryInfo) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading delivery information...</Text>
      </View>
    );
  }

  if (!deliveryInfo && !loading) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="cube-outline" size={80} color={Colors.gray300} />
        <Text style={styles.emptyTitle}>No Delivery Information</Text>
        <Text style={styles.emptySubtitle}>
          Delivery information is not available for this order yet.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchDeliveryInfo}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = deliveryInfo?.status as DeliveryStatus;

  return (
    <ScrollView
      style={styles.container}
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
      {/* Status Section */}
      <View style={styles.statusSection}>
        <View
          style={[
            styles.statusIconContainer,
            { backgroundColor: getStatusColor(status) + '20' },
          ]}
        >
          <Ionicons
            name={getStatusIcon(status) as any}
            size={48}
            color={getStatusColor(status)}
          />
        </View>
        <Text style={styles.statusTitle}>
          {deliveryInfo?.status?.replace(/_/g, ' ')}
        </Text>
        <Text style={styles.statusMessage}>{getStatusMessage(status)}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(status) },
          ]}
        >
          <Text style={styles.statusBadgeText}>
            {deliveryInfo?.status?.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      {/* Copy Tracking Number */}
      {deliveryInfo?.trackingNumber && (
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={handleCopyTrackingNumber}
          >
            <Ionicons name="copy-outline" size={20} color={Colors.white} />
            <Text style={styles.primaryActionButtonText}>Copy Tracking Number</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Courier & Tracking */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="car-outline" size={24} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Courier & Tracking</Text>
        </View>
        <View style={styles.sectionContent}>
          {renderInfoRow(
            'business-outline',
            'Courier Service',
            deliveryInfo?.courierService ?? null
          )}
          {renderInfoRow(
            'barcode-outline',
            'Tracking Number',
            deliveryInfo?.trackingNumber ?? null,
            deliveryInfo?.trackingNumber ? handleCopyTrackingNumber : undefined
          )}
          {deliveryInfo?.estimatedDeliveryDays && renderInfoRow(
            'time-outline',
            'Estimated Delivery',
            `${deliveryInfo.estimatedDeliveryDays} day${deliveryInfo.estimatedDeliveryDays !== 1 ? 's' : ''}`
          )}
        </View>
      </View>

      {/* Delivery Address */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="location" size={24} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Delivery Address</Text>
        </View>
        <View style={styles.sectionContent}>
          {renderInfoRow(
            'person-outline',
            'Recipient',
            deliveryInfo?.recipient ?? null
          )}
          {renderInfoRow(
            'call-outline',
            'Phone',
            deliveryInfo?.phone ?? null
          )}
          {renderInfoRow(
            'location-outline',
            'Address',
            deliveryInfo?.address ?? null
          )}
          {renderInfoRow(
            'map-outline',
            'City',
            deliveryInfo
              ? `${deliveryInfo.city}, ${deliveryInfo.region}`
              : null
          )}
        </View>
      </View>

      {/* Delivery Timeline */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar" size={24} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Timeline</Text>
        </View>
        <View style={styles.sectionContent}>
          {renderInfoRow(
            'calendar-outline',
            'Order Created',
            formatDate(deliveryInfo?.createdAt)
          )}
          {deliveryInfo?.dispatchedAt && renderInfoRow(
            'send-outline',
            'Dispatched At',
            formatDate(deliveryInfo.dispatchedAt)
          )}
          {deliveryInfo?.deliveredAt && renderInfoRow(
            'checkmark-circle-outline',
            'Delivered On',
            formatDate(deliveryInfo.deliveredAt)
          )}
          {deliveryInfo?.buyerConfirmedAt && renderInfoRow(
            'shield-checkmark-outline',
            'Confirmed By Buyer',
            formatDate(deliveryInfo.buyerConfirmedAt)
          )}
          {renderInfoRow(
            'refresh-outline',
            'Last Updated',
            formatDate(deliveryInfo?.updatedAt)
          )}
        </View>
      </View>

      {/* Dispatch Note */}
      {deliveryInfo?.dispatchNote && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={24} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Dispatch Note</Text>
          </View>
          <View style={styles.notesContainer}>
            <Text style={styles.notesText}>{deliveryInfo.dispatchNote}</Text>
          </View>
        </View>
      )}

      {/* Contact Support */}
      <View style={styles.supportSection}>
        <Text style={styles.supportText}>Need help with your delivery?</Text>
        <TouchableOpacity
          style={styles.supportButton}
          onPress={() =>
            Alert.alert('Support', 'Contact support feature coming soon.')
          }
        >
          <Ionicons name="help-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.supportButtonText}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  statusSection: {
    backgroundColor: Colors.white,
    padding: 32,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statusIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  statusMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  actionSection: {
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
  },
  primaryActionButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryActionButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    backgroundColor: Colors.white,
    marginTop: 12,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  sectionContent: {
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  infoRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  infoValue: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
    textAlign: 'right',
    flexShrink: 1,
  },
  notesContainer: {
    backgroundColor: Colors.backgroundSecondary,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  notesText: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  supportSection: {
    backgroundColor: Colors.white,
    marginTop: 12,
    padding: 20,
    alignItems: 'center',
  },
  supportText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  supportButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default DeliveryInfoScreen;