import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDisputes, DisputeType } from '../../hooks/useDisputes';
import { useOrder } from '../../hooks/useOrder';
import { OrderItem } from '../../types/order';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Colors } from '../../constants/colors';

const disputeTypes: { label: string; value: DisputeType }[] = [
  { label: 'General Refund Request', value: 'REFUND_REQUEST' },
  { label: 'Item Not As Described', value: 'ITEM_NOT_AS_DESCRIBED' },
  { label: 'Item Not Received', value: 'ITEM_NOT_RECEIVED' },
  { label: 'Wrong Item Sent', value: 'WRONG_ITEM_SENT' },
  { label: 'Damaged Item', value: 'DAMAGED_ITEM' },
  { label: 'Other', value: 'OTHER' },
];

export default function RequestRefundScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const orderId = route.params?.orderId as string;

  // TanStack Query hook for order data
  const { data: order, isLoading, error, refetch } = useOrder(orderId);

  const { requestRefund, loading: disputeLoading, error: disputeError, clearError } = useDisputes();

  const [selectedType, setSelectedType] = useState<DisputeType>('REFUND_REQUEST');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orderId) {
      Alert.alert('Error', 'Order ID not provided');
      navigation.goBack();
    }
  }, [orderId]);

  useEffect(() => {
    if (disputeError) {
      Alert.alert('Error', disputeError);
      clearError();
    }
  }, [disputeError]);

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

const getStatusColor = (status?: string) => {
    if (!status) return Colors.gray500;
    switch (status.toUpperCase()) {
      case 'SUCCESS':
      case 'DELIVERED':
      case 'COMPLETED':
        return Colors.success;
      case 'PENDING':
        return Colors.warning;
      case 'FAILED':
      case 'CANCELLED':
        return Colors.error;
      default:
        return Colors.gray500;
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      Alert.alert('Required Field', 'Please provide a reason for your refund request.');
      return;
    }

    if (reason.trim().length < 20) {
      Alert.alert(
        'Invalid Input',
        'Please provide a more detailed reason (at least 20 characters).'
      );
      return;
    }

    Alert.alert(
      'Confirm Refund Request',
      'Are you sure you want to submit this refund request? The seller will be notified and you will receive updates via email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            try {
              const dispute = await requestRefund(orderId, {
                reason: reason.trim(),
                type: selectedType,
              });

              if (dispute) {
                Alert.alert(
                  'Success',
                  'Your refund request has been submitted successfully. We will review it and get back to you within 48 hours.',
                  [
                    {
                      text: 'OK',
                      onPress: () => navigation.goBack(),
                    },
                  ]
                );
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to submit refund request. Please try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // Loading state - initial fetch only
  if (isLoading && !order) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size={40} color={Colors.primary} />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error || !order) {
    console.log('Order error or no order:', error, order);
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Failed to load order details'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Ionicons name="refresh" size={20} color={Colors.white} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Request Refund</Text>
          <Text style={styles.headerSubtitle}>
            Please provide details about why you're requesting a refund
          </Text>
        </View>

        {/* Order Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Order ID:</Text>
              <Text style={styles.value}>{order.id}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Status:</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: `${getStatusColor(order.status)}20` },
                ]}
              >
                <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                  {order.status}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Order Date:</Text>
              <Text style={styles.value}>{formatDate(order.createdAt)}</Text>
            </View>
            {order.deliveredAt && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.label}>Delivered:</Text>
                  <Text style={styles.value}>{formatDate(order.deliveredAt)}</Text>
                </View>
              </>
            )}
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Store:</Text>
              <Text style={styles.value}>{order.store?.name || 'N/A'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Total Amount:</Text>
              <Text style={styles.valueAmount}>
                {formatCurrency(order.totalAmount, order.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Items</Text>
            <View style={styles.card}>
              {order.items.map((item: OrderItem, index: number) => (
                <View key={item.id || index}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>
                        {item.name || item.productName || item.product?.name || 'Item'}
                      </Text>
                      <Text style={styles.itemQuantity}>Quantity: {item.quantity}</Text>
                    </View>
                    <Text style={styles.itemPrice}>
                      {formatCurrency(item.price || item.unitPrice || 0, order.currency)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Payment Details */}
        {order.payment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <View style={styles.card}>
              {order.payment.map((payment, index) => (
                <View key={payment.id || index}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.row}>
                    <Text style={styles.label}>Payment ID:</Text>
                    <Text style={styles.value} numberOfLines={1}>{payment.id || 'N/A'}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Gateway:</Text>
                    <Text style={styles.value} numberOfLines={1}>{payment.gateway || 'N/A'}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>Status:</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: `${getStatusColor(payment.status)}20` },
                      ]}
                    >
                      <Text
                        style={[styles.statusText, { color: getStatusColor(payment.status) }]}
                      >
                        {payment.status || 'Unknown'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>Gateway Ref:</Text>
                    <Text style={styles.value} numberOfLines={1}>{payment.gatewayRef || 'N/A'}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>Amount:</Text>
                    <Text style={styles.valueAmount}>
                      {formatCurrency(
                        Number(payment.amount || 0),
                        payment.currency || order.currency || 'GHS'
                      )}
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>Date:</Text>
                    <Text style={styles.value}>
                      {formatDate(payment.createdAt)}
                    </Text>
                  </View>
                  {payment.metadata?.fees && (
                    <View style={styles.divider} />
                  )}
                  {payment.metadata?.fees && (
                    <>
                      <Text style={[styles.label, { marginTop: 8, marginBottom: 4 }]}>Fees Breakdown:</Text>
                      <View style={styles.row}>
                        <Text style={styles.label}>Net Seller:</Text>
                        <Text style={styles.value}>{formatCurrency(payment.metadata.fees.netSeller, order.currency)}</Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.label}>Platform:</Text>
                        <Text style={styles.value}>{formatCurrency(payment.metadata.fees.platformFee, order.currency)}</Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.label}>Paystack:</Text>
                        <Text style={styles.value}>{formatCurrency(payment.metadata.fees.paystackFee, order.currency)}</Text>
                      </View>
                    </>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
        {/* Debug log */}
        {__DEV__ && order && console.log('🔍 RequestRefund - Order Payments:', JSON.stringify(order.payment, null, 2))}

        {/* Refund Request Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Refund Request</Text>

          {/* Dispute Type Selector */}
          <Text style={styles.inputLabel}>Reason Category *</Text>
          <View style={styles.typeSelector}>
            {disputeTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.typeButton,
                  selectedType === type.value && styles.typeButtonActive,
                ]}
                onPress={() => setSelectedType(type.value)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    selectedType === type.value && styles.typeButtonTextActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reason Text Area */}
          <Text style={styles.inputLabel}>Detailed Reason *</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Please describe your reason for requesting a refund in detail (minimum 20 characters)..."
            placeholderTextColor={Colors.textTertiary}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.charCount}>{reason.length}/1000 characters</Text>
        </View>

        {/* Important Notice */}
        <View style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Ionicons name="warning" size={20} color={Colors.warning} />
            <Text style={styles.noticeTitle}>Important Notice</Text>
          </View>
          <Text style={styles.noticeText}>
            • Your refund request will be reviewed within 48 hours{'\n'}• The seller will be
            notified and may respond{'\n'}• You'll receive updates via email and notifications
            {'\n'}• Refunds are processed to the original payment method{'\n'}• Processing time
            may take 5-10 business days
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (submitting || disputeLoading) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting || disputeLoading}
        >
          {submitting || disputeLoading ? (
            <LoadingSpinner size={20} color={Colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Refund Request</Text>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={submitting || disputeLoading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    marginTop: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  valueAmount: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  itemPrice: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeButtonText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 150,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: 8,
  },
  noticeCard: {
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray900,
  },
  noticeText: {
    fontSize: 13,
    color: Colors.gray700,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 52,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.disabled,
    shadowOpacity: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  cancelButton: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});