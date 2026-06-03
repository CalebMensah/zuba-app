import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../../constants/colors';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  useSellerOrders,
  useAcceptOrder,
  useRejectOrder,
  OrderWithBreakdown,
} from '../../hooks/useOrder';
import { useDelivery } from '../../hooks/useDelivery';
import { OrderStatus } from '../../types/order';

interface StatusTab {
  status: OrderStatus;
  label: string;
}

interface SellerOrderManagementProps {
  navigation: any;
}

// ── Courier form shape — matches ShipOrderParams ──────────────────────────────
interface CourierFormData {
  courierService: string;
  trackingNumber: string;
  estimatedDeliveryDays: string;
  dispatchNote: string;
}

const EMPTY_COURIER: CourierFormData = {
  courierService: '',
  trackingNumber: '',
  estimatedDeliveryDays: '',
  dispatchNote: '',
};

const SellerOrderManagement: React.FC<SellerOrderManagementProps> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<OrderStatus>('PAID');
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  // Shipping modal state
  const [shippingModalVisible, setShippingModalVisible] = useState(false);
  const [courierData, setCourierData] = useState<CourierFormData>(EMPTY_COURIER);
  const [selectedImages, setSelectedImages] = useState<{ uri: string }[]>([]);
  const [uploadingShip, setUploadingShip] = useState(false);
  const [orderForShipping, setOrderForShipping] = useState<OrderWithBreakdown | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Alert dedup ref
  const alertShownRef = useRef<Set<string>>(new Set());

  // ── Queries ─────────────────────────────────────────────────────────────────
  const paidQuery       = useSellerOrders({ page: 1, limit: 50, status: 'PAID', paymentStatus: 'SUCCESS' });
  const processingQuery = useSellerOrders({ page: 1, limit: 50, status: 'PROCESSING' });
  const shippedQuery    = useSellerOrders({ page: 1, limit: 50, status: 'SHIPPED' });
  const completedQuery  = useSellerOrders({ page: 1, limit: 50, status: 'COMPLETED' });
  const disputedQuery   = useSellerOrders({ page: 1, limit: 50, status: 'DISPUTED' });
  const cancelledQuery  = useSellerOrders({ page: 1, limit: 50, status: 'CANCELLED' });
  const refundedQuery   = useSellerOrders({ page: 1, limit: 50, status: 'REFUNDED' });

  const queryMap: Partial<Record<OrderStatus, ReturnType<typeof useSellerOrders>>> = {
    PAID:        paidQuery,
    PROCESSING:  processingQuery,
    SHIPPED:     shippedQuery,
    COMPLETED:   completedQuery,
    DISPUTED:    disputedQuery,
    CANCELLED:   cancelledQuery,
    REFUNDED:    refundedQuery,
  };

  const activeQuery = queryMap[activeTab];
  const orders = activeQuery?.data?.orders ?? [];

  // ── Mutations ────────────────────────────────────────────────────────────────
  const acceptOrderMutation = useAcceptOrder();
  const rejectOrderMutation = useRejectOrder();

  const { shipOrder, error: deliveryError } = useDelivery();

  // ── Status tabs ──────────────────────────────────────────────────────────────
  const statusTabs: StatusTab[] = [
    { status: 'PAID',       label: 'Paid (Pending Acceptance)' },
    { status: 'PROCESSING', label: 'Processing' },
    { status: 'SHIPPED',    label: 'Shipped' },
    { status: 'COMPLETED',  label: 'Completed' },
    { status: 'DISPUTED',   label: 'Disputed' },
    { status: 'CANCELLED',  label: 'Cancelled' },
    { status: 'REFUNDED',   label: 'Refunded' },
  ];

  const getTabCount = (status: OrderStatus): number =>
    queryMap[status]?.data?.pagination?.total ?? 0;

  // ── Permissions ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera roll access is needed to upload delivery proof.');
        }
      }
    })();
  }, []);

  // ── Proof reminder on focus ───────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'PROCESSING' && orders.length > 0) {
        setTimeout(() => {
          const orderNeedingProof = orders.find((order) => {
            const hasProof =
              order.deliveryInfo?.deliveryProofs &&
              order.deliveryInfo.deliveryProofs.length > 0;
            return order.deliveryInfo && !hasProof && !alertShownRef.current.has(order.id);
          });

          if (orderNeedingProof) {
            alertShownRef.current.add(orderNeedingProof.id);
            Alert.alert(
              'Delivery Proof Required',
              `Order #${orderNeedingProof.id.slice(-8).toUpperCase()} needs delivery proof to be marked as shipped.`,
              [
                {
                  text: 'Later',
                  style: 'cancel',
                  onPress: () => alertShownRef.current.delete(orderNeedingProof.id),
                },
                {
                  text: 'Ship Order',
                  onPress: () => handleStartShippingFlow(orderNeedingProof),
                },
              ]
            );
          }
        }, 2000);
      }
    }, [activeTab, orders])
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const onRefresh = useCallback(() => { activeQuery?.refetch?.(); }, [activeQuery]);

  const handleTabPress = (status: OrderStatus) => setActiveTab(status);

  const handleOrderPress = (order: OrderWithBreakdown) => {
    navigation.navigate('SellerOrderDetails', { orderId: order.id });
  };

  const handleAcceptOrder = (orderId: string, orderNumber: string) => {
    Alert.alert(
      'Accept Order',
      `Accept order #${orderNumber}? The buyer will be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept Order',
          onPress: async () => {
            setProcessingOrderId(orderId);
            try {
              await acceptOrderMutation.mutateAsync(orderId);
              Alert.alert('Success', 'Order accepted! Please prepare items for shipment.');
              paidQuery.refetch();
              processingQuery.refetch();
            } catch (e) {
              console.error('Accept order error:', e);
            } finally {
              setProcessingOrderId(null);
            }
          },
        },
      ]
    );
  };

  const handleRejectOrder = (orderId: string, orderNumber: string) => {
    Alert.prompt(
      'Reject Order',
      `Please provide a reason for rejecting order #${orderNumber}:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject & Refund',
          style: 'destructive',
          onPress: async (reason: any) => {
            if (!reason?.trim()) {
              Alert.alert('Error', 'Please provide a reason for rejection');
              return;
            }
            setProcessingOrderId(orderId);
            try {
              const result = await rejectOrderMutation.mutateAsync({ orderId, reason });
              Alert.alert(
                'Order Rejected',
                `Order rejected. The buyer has been refunded ${result.refundAmount}.`
              );
              activeQuery?.refetch();
              refundedQuery.refetch();
            } catch (e) {
              console.error('Reject order error:', e);
            } finally {
              setProcessingOrderId(null);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleStartShippingFlow = (order: OrderWithBreakdown) => {
    setOrderForShipping(order);
    setCourierData({
      courierService: order.deliveryInfo?.courierService || '',
      trackingNumber: order.deliveryInfo?.trackingNumber || '',
      estimatedDeliveryDays: order.deliveryInfo?.estimatedDeliveryDays
        ? String(order.deliveryInfo.estimatedDeliveryDays)
        : '',
      dispatchNote: order.deliveryInfo?.dispatchNote || '',
    });
    setSelectedImages([]);
    setFormErrors({});
    setShippingModalVisible(true);
  };

  const closeShippingModal = () => {
    if (uploadingShip) return;
    setShippingModalVisible(false);
    setSelectedImages([]);
    setFormErrors({});
    setOrderForShipping(null);
    setCourierData(EMPTY_COURIER);
  };

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5,
      });
      if (!result.canceled && result.assets) {
        setSelectedImages(result.assets.map(a => ({ uri: a.uri })));
      }
    } catch {
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleShippingSubmit = async () => {
    const errors: Record<string, string> = {};

    if (!courierData.courierService.trim()) {
      errors.courierService = 'Courier service is required';
    }
    if (selectedImages.length === 0) {
      errors.images = 'At least one proof image is required';
    }
    if (
      courierData.estimatedDeliveryDays.trim() &&
      (isNaN(parseInt(courierData.estimatedDeliveryDays)) ||
        parseInt(courierData.estimatedDeliveryDays) < 1)
    ) {
      errors.estimatedDeliveryDays = 'Must be a positive number';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (!orderForShipping) return;
    setUploadingShip(true);

    try {
      const params = {
        courierService: courierData.courierService,
        trackingNumber: courierData.trackingNumber || undefined,
        estimatedDeliveryDays: courierData.estimatedDeliveryDays
          ? parseInt(courierData.estimatedDeliveryDays)
          : undefined,
        dispatchNote: courierData.dispatchNote || undefined,
      };

      const imageUris = selectedImages.map(a => a.uri);
      const result = await shipOrder(orderForShipping.id, params, imageUris);

      if (result) {
        Alert.alert('Shipped!', 'Order marked as shipped. Buyer has been notified.');
        closeShippingModal();
        processingQuery.refetch();
        shippedQuery.refetch();
      } else {
        Alert.alert('Error', deliveryError || 'Failed to ship order. Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Ship failed');
    } finally {
      setUploadingShip(false);
    }
  };

  // ── Status color ──────────────────────────────────────────────────────────────
  const getStatusColor = (status: OrderStatus): string => {
    switch (status) {
      case 'PENDING_PAYMENT': return Colors.error;
      case 'PAID':            return Colors.warning;
      case 'PROCESSING':      return Colors.info;
      case 'SHIPPED':         return Colors.primary;
      case 'COMPLETED':       return Colors.success;
      case 'DISPUTED':        return '#F97316';
      case 'CANCELLED':       return Colors.error;
      case 'REFUNDED':        return '#FF9500';
      default:                return Colors.gray400;
    }
  };

  // ── Order card ────────────────────────────────────────────────────────────────
  const renderOrderItem = ({ item }: { item: OrderWithBreakdown }) => {
    const firstItem = item.items?.[0];
    const firstImage = firstItem?.product?.images?.[0] || 'https://via.placeholder.com/100';
    const productName = firstItem?.product?.name || 'Product';
    const isProcessing = processingOrderId === item.id;
    const hasDeliveryInfo = !!item.deliveryInfo;
    const isEscrowReleased = item.escrow?.releasedStatus === 'RELEASED';
    const statusColor = getStatusColor(item.status as OrderStatus);

    return (
      <View style={styles.orderCardContainer}>
        <TouchableOpacity
          style={styles.orderInfoSection}
          onPress={() => handleOrderPress(item)}
          activeOpacity={0.7}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.orderMeta}>
              <Text style={styles.orderNumber}>#{item.id.slice(-8).toUpperCase()}</Text>
              <Text style={styles.orderDate}>
                {new Date(item.createdAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: `${statusColor}15` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusLabel, { color: statusColor }]}>
                {item.status?.replace('_', ' ')}
              </Text>
            </View>
          </View>

          {/* Product */}
          <View style={styles.productSection}>
            <Image source={{ uri: firstImage }} style={styles.productImage} />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>{productName}</Text>
              {item.items.length > 1 && (
                <View style={styles.multiItemBadge}>
                  <Text style={styles.multiItemText}>
                    +{item.items.length - 1} more item{item.items.length > 2 ? 's' : ''}
                  </Text>
                </View>
              )}
              <Text style={styles.buyerInfo}>Customer: {item.buyer?.firstName || 'N/A'}</Text>
            </View>
          </View>

          {/* Price */}
          <View style={styles.priceSection}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>
              {item.currency} {item.totalAmount.toFixed(2)}
            </Text>
          </View>

          {/* Info cards */}
          {item.status === 'SHIPPED' && (
            <View style={styles.infoCard}>
              <Ionicons name="time-outline" size={24} color="#0C5460" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Awaiting Buyer Confirmation</Text>
                <Text style={styles.infoText}>
                  Funds will be released once the buyer confirms receipt.
                </Text>
              </View>
            </View>
          )}

          {item.status === 'DISPUTED' && (
            <View style={[styles.infoCard, { backgroundColor: '#FFE8D6' }]}>
              <Ionicons name="alert-circle-outline" size={24} color="#F97316" />
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: '#F97316' }]}>Dispute Under Review</Text>
                <Text style={[styles.infoText, { color: '#F97316' }]}>
                  Our team is reviewing the dispute. Funds are on hold.
                </Text>
              </View>
            </View>
          )}

          {item.status === 'COMPLETED' && (
            <View style={[styles.infoCard, { backgroundColor: '#D4EDDA' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#155724" />
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: '#155724' }]}>
                  {isEscrowReleased ? 'Funds Released' : 'Order Completed'}
                </Text>
                <Text style={[styles.infoText, { color: '#155724' }]}>
                  {isEscrowReleased
                    ? `Payout of ${item.currency} ${item.breakdown.netSellerPayout.toFixed(2)} has been processed.`
                    : 'This order has been completed successfully.'}
                </Text>
              </View>
            </View>
          )}

          {item.status === 'CANCELLED' && (
            <View style={[styles.infoCard, { backgroundColor: '#F8D7DA' }]}>
              <Ionicons name="close-circle" size={24} color="#721C24" />
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: '#721C24' }]}>Order Cancelled</Text>
                <Text style={[styles.infoText, { color: '#721C24' }]}>
                  {item.cancelledBy === 'seller' ? 'You cancelled this order.' : 'This order was cancelled.'}
                </Text>
              </View>
            </View>
          )}

          {item.status === 'REFUNDED' && (
            <View style={[styles.infoCard, { backgroundColor: '#FFF3CD' }]}>
              <Ionicons name="cash" size={24} color="#856404" />
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: '#856404' }]}>Refund Processed</Text>
                <Text style={[styles.infoText, { color: '#856404' }]}>
                  {item.breakdown.refundAmount
                    ? `Refund of ${item.currency} ${item.breakdown.refundAmount.toFixed(2)} processed.`
                    : 'This order has been refunded to the buyer.'}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Action buttons */}
        {(item.status === 'PAID' || item.status === 'PROCESSING') && (
          <View style={styles.actionButtonsSection}>
            {item.status === 'PAID' && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.acceptBtn, isProcessing && styles.btnDisabled]}
                  onPress={() => handleAcceptOrder(item.id, item.id.slice(-8).toUpperCase())}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <LoadingSpinner size={20} color={Colors.white} />
                  ) : (
                    <Text style={styles.acceptBtnText}>Accept Order</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn, isProcessing && styles.btnDisabled]}
                  onPress={() => handleRejectOrder(item.id, item.id.slice(-8).toUpperCase())}
                  disabled={isProcessing}
                >
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.status === 'PROCESSING' && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.primaryActionBtn, isProcessing && styles.btnDisabled]}
                  onPress={() => handleStartShippingFlow(item)}
                  disabled={isProcessing}
                >
                  <Text style={styles.primaryActionBtnText}>
                    {hasDeliveryInfo ? 'Ship Order' : 'Add Delivery & Ship'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn, isProcessing && styles.btnDisabled]}
                  onPress={() => handleRejectOrder(item.id, item.id.slice(-8).toUpperCase())}
                  disabled={isProcessing}
                >
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="cube-outline" size={48} color={Colors.gray400} />
      </View>
      <Text style={styles.emptyTitle}>
        No {activeTab.replace('_', ' ').toLowerCase()} orders
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'PAID'
          ? 'New paid orders will appear here when customers place them'
          : `You don't have any ${activeTab.replace('_', ' ').toLowerCase()} orders at the moment`}
      </Text>
    </View>
  );

  if (activeQuery?.isLoading && !activeQuery?.data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Orders</Text>
          <Text style={styles.headerSubtitle}>Manage and fulfill your orders</Text>
        </View>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size={40} color={Colors.primary} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <Text style={styles.headerSubtitle}>Manage and fulfill your orders</Text>
      </View>

      {/* Status Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
          style={styles.tabsScrollView}
        >
          {statusTabs.map((tab) => {
            const isActive = activeTab === tab.status;
            return (
              <TouchableOpacity
                key={tab.status}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => handleTabPress(tab.status)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
                  {tab.label}
                </Text>
                <View style={[styles.badge, isActive && styles.activeBadge]}>
                  <Text style={[styles.badgeText, isActive && styles.activeBadgeText]}>
                    {getTabCount(tab.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Orders List */}
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={!!activeQuery?.isFetching && !!activeQuery?.data}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* Ship Order Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={shippingModalVisible}
        onRequestClose={closeShippingModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ship Order</Text>
              <TouchableOpacity
                onPress={closeShippingModal}
                style={styles.closeBtn}
                disabled={uploadingShip}
              >
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {orderForShipping && (
              <Text style={styles.modalSubtitle}>
                Order #{orderForShipping.id.slice(-8).toUpperCase()}
              </Text>
            )}

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>
                Courier Details{' '}
                <Text style={styles.required}>* Required</Text>
              </Text>

              {/* Courier Service */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  Courier Service <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, formErrors.courierService && styles.inputError]}
                  value={courierData.courierService}
                  onChangeText={(text) => {
                    setCourierData(p => ({ ...p, courierService: text }));
                    if (formErrors.courierService) setFormErrors(p => ({ ...p, courierService: '' }));
                  }}
                  placeholder="e.g., DHL, FedEx, GIG Logistics"
                  placeholderTextColor={Colors.gray400}
                />
                {formErrors.courierService ? (
                  <Text style={styles.errorText}>{formErrors.courierService}</Text>
                ) : null}
              </View>

              {/* Tracking Number */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Tracking Number</Text>
                <TextInput
                  style={styles.input}
                  value={courierData.trackingNumber}
                  onChangeText={(text) => setCourierData(p => ({ ...p, trackingNumber: text }))}
                  placeholder="Enter tracking number (optional)"
                  placeholderTextColor={Colors.gray400}
                />
              </View>

              {/* Estimated Delivery Days */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Estimated Delivery Days</Text>
                <TextInput
                  style={[styles.input, formErrors.estimatedDeliveryDays && styles.inputError]}
                  value={courierData.estimatedDeliveryDays}
                  onChangeText={(text) => {
                    setCourierData(p => ({ ...p, estimatedDeliveryDays: text }));
                    if (formErrors.estimatedDeliveryDays) setFormErrors(p => ({ ...p, estimatedDeliveryDays: '' }));
                  }}
                  placeholder="e.g., 3"
                  placeholderTextColor={Colors.gray400}
                  keyboardType="numeric"
                />
                {formErrors.estimatedDeliveryDays ? (
                  <Text style={styles.errorText}>{formErrors.estimatedDeliveryDays}</Text>
                ) : null}
              </View>

              {/* Dispatch Note */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Dispatch Note</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={courierData.dispatchNote}
                  onChangeText={(text) => setCourierData(p => ({ ...p, dispatchNote: text }))}
                  placeholder="Additional dispatch notes (optional)"
                  placeholderTextColor={Colors.gray400}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Proof Images */}
              <Text style={styles.sectionTitle}>
                Handover Proof <Text style={styles.required}>* Required</Text>
              </Text>
              <Text style={styles.proofInstructionText}>
                Upload clear photos showing package handover to courier.
              </Text>

              {selectedImages.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.imagePreviewScroll}
                >
                  {selectedImages.map((image, index) => (
                    <View key={index} style={styles.imagePreviewContainer}>
                      <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => removeImage(index)}
                        disabled={uploadingShip}
                      >
                        <Ionicons name="close" size={16} color={Colors.white} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.emptyImageState}>
                  <Ionicons name="camera-outline" size={36} color={Colors.gray400} />
                  <Text style={styles.emptyImageText}>No images selected (1+ required)</Text>
                </View>
              )}

              {formErrors.images ? (
                <Text style={[styles.errorText, { marginBottom: 8 }]}>{formErrors.images}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.pickImagesBtn, uploadingShip && styles.btnDisabled]}
                onPress={pickImages}
                disabled={uploadingShip}
              >
                <Text style={styles.pickImagesBtnText}>
                  {selectedImages.length > 0
                    ? `Change Photos (${selectedImages.length})`
                    : 'Select Handover Photos'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.uploadProofBtn,
                  (!courierData.courierService || selectedImages.length === 0 || uploadingShip) &&
                    styles.btnDisabled,
                ]}
                onPress={handleShippingSubmit}
                disabled={uploadingShip}
              >
                {uploadingShip ? (
                  <LoadingSpinner size={20} color={Colors.white} />
                ) : (
                  <Text style={styles.uploadProofBtnText}>
                    Ship Order ({selectedImages.length} photo{selectedImages.length !== 1 ? 's' : ''})
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: { fontSize: 15, color: Colors.textSecondary, fontWeight: '400' },
  tabsWrapper: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 64,
  },
  tabsScrollView: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabsContainer: { paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    gap: 8,
    minHeight: 40,
  },
  activeTab: { backgroundColor: Colors.primary },
  tabLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  activeTabLabel: { color: Colors.white },
  badge: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBadge: { backgroundColor: Colors.primaryDark },
  badgeText: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  activeBadgeText: { color: Colors.white },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 16, color: Colors.textSecondary, fontFamily: Typography.medium },
  listContent: { padding: 20, paddingBottom: 40 },
  orderCardContainer: { marginBottom: 16 },
  orderInfoSection: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  orderMeta: { gap: 4 },
  orderNumber: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  orderDate: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  productSection: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  productImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: Colors.gray100 },
  productInfo: { flex: 1, justifyContent: 'center', gap: 4 },
  productName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, lineHeight: 20 },
  multiItemBadge: { alignSelf: 'flex-start', backgroundColor: Colors.gray100, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  multiItemText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  buyerInfo: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  totalLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  totalAmount: { fontSize: 22, fontWeight: '700', color: Colors.primary },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1ECF1',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 10,
  },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#0C5460', marginBottom: 2 },
  infoText: { fontSize: 12, color: '#0C5460' },
  actionButtonsSection: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  acceptBtn: { backgroundColor: Colors.success },
  acceptBtnText: { fontSize: 14, fontWeight: '600', color: Colors.white },
  primaryActionBtn: { backgroundColor: Colors.primary },
  primaryActionBtnText: { fontSize: 14, fontWeight: '600', color: Colors.white },
  rejectBtn: { backgroundColor: Colors.errorLight },
  rejectBtnText: { fontSize: 14, fontWeight: '600', color: Colors.error },
  btnDisabled: { opacity: 0.5 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyIconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.gray100, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.gray300, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.gray100, justifyContent: 'center', alignItems: 'center' },
  modalSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24, fontWeight: '500' },
  formScroll: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 24, marginBottom: 12 },
  required: { color: Colors.error },
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  inputError: { borderColor: Colors.error },
  errorText: { fontSize: 12, color: Colors.error, marginTop: 4 },
  textArea: { height: 80, textAlignVertical: 'top' },
  proofInstructionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    backgroundColor: Colors.gray50,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  imagePreviewScroll: { maxHeight: 200, marginBottom: 12 },
  imagePreviewContainer: { position: 'relative', marginRight: 12 },
  imagePreview: { width: 150, height: 150, borderRadius: 12, backgroundColor: Colors.gray100 },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyImageState: {
    height: 150,
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.gray200,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  emptyImageText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  pickImagesBtn: {
    backgroundColor: Colors.gray100,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray300,
    marginBottom: 12,
  },
  pickImagesBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  uploadProofBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: 8,
  },
  uploadProofBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },
});

export default SellerOrderManagement;