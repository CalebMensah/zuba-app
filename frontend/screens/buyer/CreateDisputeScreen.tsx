import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDisputes, DisputeType } from '../../hooks/useDisputes';
import { useOrders } from '../../hooks/useOrder';
import { Colors } from '../../constants/colors';

interface RouteParams {
  orderId: string;
}

const DISPUTE_TYPES: Array<{
  value: DisputeType;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: 'REFUND_REQUEST',
    label: 'Refund Request',
    description: 'Request a full or partial refund',
    icon: 'cash-outline',
  },
  {
    value: 'ITEM_NOT_AS_DESCRIBED',
    label: 'Item Not as Described',
    description: 'Product differs from listing description',
    icon: 'alert-circle-outline',
  },
  {
    value: 'ITEM_NOT_RECEIVED',
    label: 'Item Not Received',
    description: 'Order not delivered within expected time',
    icon: 'cube-outline',
  },
  {
    value: 'WRONG_ITEM_SENT',
    label: 'Wrong Item Sent',
    description: 'Received different product than ordered',
    icon: 'swap-horizontal-outline',
  },
  {
    value: 'DAMAGED_ITEM',
    label: 'Damaged Item',
    description: 'Product arrived damaged or defective',
    icon: 'warning-outline',
  },
  {
    value: 'OTHER',
    label: 'Other Issue',
    description: 'Another type of problem',
    icon: 'help-circle-outline',
  },
];

const CreateDisputeScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId } = route.params as RouteParams;

  const { loading: disputeLoading, error, requestRefund, clearError } = useDisputes();
  const { getOrderById } = useOrders();

  const [order, setOrder] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [selectedType, setSelectedType] = useState<DisputeType>('REFUND_REQUEST');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error]);

  const loadOrder = async () => {
    try {
      setLoadingOrder(true);
      const orderData = await getOrderById(orderId);
      if (orderData) {
        setOrder(orderData);
      } else {
        Alert.alert('Error', 'Order not found', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      console.error('Error loading order:', err);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoadingOrder(false);
    }
  };

  const validateForm = (): boolean => {
    if (!reason.trim()) {
      setReasonError('Please provide a detailed reason for your dispute');
      return false;
    }

    if (reason.trim().length < 20) {
      setReasonError('Reason must be at least 20 characters');
      return false;
    }

    if (reason.trim().length > 1000) {
      setReasonError('Reason must not exceed 1000 characters');
      return false;
    }

    setReasonError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    Alert.alert(
      'Submit Dispute',
      'Are you sure you want to submit this dispute? The seller will be notified and you will be contacted for resolution.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            const dispute = await requestRefund(orderId, {
              reason: reason.trim(),
              type: selectedType,
            });

            if (dispute) {
              Alert.alert(
                'Dispute Submitted',
                'Your dispute has been submitted successfully. We will review it and contact you shortly.',
                [
                  {
                    text: 'OK',
                    onPress: () => (navigation as any).navigate('Disputes'),
                  },
                ]
              );
            }
          },
        },
      ]
    );
  };

  const DisputeTypeCard = ({ type }: { type: typeof DISPUTE_TYPES[0] }) => (
    <TouchableOpacity
      style={[
        styles.typeCard,
        selectedType === type.value && styles.typeCardSelected,
      ]}
      onPress={() => setSelectedType(type.value)}
    >
      <View style={styles.typeCardHeader}>
        <View
          style={[
            styles.typeIconContainer,
            selectedType === type.value && styles.typeIconContainerSelected,
          ]}
        >
          <Ionicons
            name={type.icon as any}
            size={24}
            color={selectedType === type.value ? Colors.primary : Colors.textSecondary}
          />
        </View>
        <View style={styles.typeCardContent}>
          <Text
            style={[
              styles.typeLabel,
              selectedType === type.value && styles.typeLabelSelected,
            ]}
          >
            {type.label}
          </Text>
          <Text style={styles.typeDescription}>{type.description}</Text>
        </View>
        {selectedType === type.value && (
          <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
        )}
      </View>
    </TouchableOpacity>
  );

  if (loadingOrder) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          <View style={styles.orderCard}>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>Order ID</Text>
              <Text style={styles.orderValue}>#{order.id.slice(0, 8)}</Text>
            </View>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>Store</Text>
              <Text style={styles.orderValue}>{order.store?.name}</Text>
            </View>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>Total Amount</Text>
              <Text style={styles.orderValue}>
                {order.currency} {order.totalAmount.toFixed(2)}
              </Text>
            </View>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{order.status}</Text>
              </View>
            </View>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>Payment Status</Text>
              <View
                style={[
                  styles.statusBadge,
                  order.paymentStatus === 'SUCCESS' && styles.statusBadgeSuccess,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    order.paymentStatus === 'SUCCESS' && styles.statusTextSuccess,
                  ]}
                >
                  {order.paymentStatus}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Items in Order */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {order.items?.map((item: any, index: number) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.product?.name}</Text>
                <Text style={styles.itemDetails}>
                  Qty: {item.quantity} × {order.currency} {item.price.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                {order.currency} {item.total.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Dispute Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Issue Type</Text>
          <Text style={styles.sectionSubtitle}>
            Choose the option that best describes your problem
          </Text>
          {DISPUTE_TYPES.map((type) => (
            <DisputeTypeCard key={type.value} type={type} />
          ))}
        </View>

        {/* Reason Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Describe Your Issue</Text>
          <Text style={styles.sectionSubtitle}>
            Provide detailed information to help us resolve your dispute quickly
          </Text>
          <View style={[styles.textAreaContainer, reasonError && styles.textAreaError]}>
            <TextInput
              style={styles.textArea}
              value={reason}
              onChangeText={(text) => {
                setReason(text);
                if (reasonError) setReasonError('');
              }}
              placeholder="Explain what happened and why you're filing this dispute. Include relevant details like dates, condition of items, etc."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={8}
              maxLength={1000}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.characterCount}>
            <Text
              style={[
                styles.characterCountText,
                reasonError && styles.characterCountError,
              ]}
            >
              {reasonError || `${reason.length}/1000 characters`}
            </Text>
          </View>
        </View>

        {/* Important Notice */}
        <View style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Ionicons name="information-circle" size={24} color={Colors.info} />
            <Text style={styles.noticeTitle}>Important Information</Text>
          </View>
          <Text style={styles.noticeText}>
            • Your dispute will be reviewed by our team{'\n'}
            • The seller will be notified and may respond{'\n'}
            • Refunds typically take 5-10 business days{'\n'}
            • You may be asked to provide additional evidence{'\n'}
            • False claims may result in account suspension
          </Text>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={disputeLoading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (disputeLoading || !reason.trim()) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={disputeLoading || !reason.trim()}
        >
          {disputeLoading ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Ionicons name="send" size={20} color={Colors.white} />
              <Text style={styles.submitButtonText}>Submit Dispute</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
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
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  orderLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  orderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.warningLight,
  },
  statusBadgeSuccess: {
    backgroundColor: Colors.infoLight,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning,
  },
  statusTextSuccess: {
    color: Colors.success,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  typeCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  typeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.infoLight,
  },
  typeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  typeIconContainerSelected: {
    backgroundColor: Colors.white,
  },
  typeCardContent: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  typeLabelSelected: {
    color: Colors.primary,
  },
  typeDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  textAreaContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  textAreaError: {
    borderColor: Colors.error,
  },
  textArea: {
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  characterCountText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  characterCountError: {
    color: Colors.error,
  },
  noticeCard: {
    backgroundColor: Colors.infoLight,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.info,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.info,
    marginLeft: 8,
  },
  noticeText: {
    fontSize: 13,
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
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  submitButton: {
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
  submitButtonDisabled: {
    backgroundColor: Colors.disabled,
    shadowOpacity: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default CreateDisputeScreen;