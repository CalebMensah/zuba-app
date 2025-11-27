import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdmin } from '../../hooks/useAdmin';
import { Colors } from '../../constants/colors';

// Types
interface Order {
  id: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    quantity: number;
    price: number;
    product: {
      id: string;
      name: string;
    };
  }>;
  deliveryInfo: {
    status: string;
    trackingNumber: string | null;
  } | null;
  buyer: {
    id: string;
    name: string;
    email: string;
  };
  store: {
    id: string;
    name: string;
    url: string;
  };
}

const ORDER_STATUSES = ['ALL', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED','COMPLETED', 'CANCELLED'];
const PAYMENT_STATUSES = ['ALL', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];

export default function AdminOrderManagement() {
  const {
    getAllOrders,
    updateOrderStatus,
    updatePaymentStatus,
    cancelOrder,
    refundOrder,
    loading,
    error,
  } = useAdmin();

  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedOrderForStatus, setSelectedOrderForStatus] = useState<Order | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch orders
  const fetchOrders = useCallback(async (pageNum: number = 1) => {
    const params: any = {
      page: pageNum,
      limit: 20,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
    };

    if (selectedStatus !== 'ALL') {
      params.status = selectedStatus;
    }

    if (selectedPaymentStatus !== 'ALL') {
      params.paymentStatus = selectedPaymentStatus;
    }

    const result = await getAllOrders(params);

    if (result) {
      setOrders(result.data.orders);
      setFilteredOrders(result.data.orders);
      setTotalPages(result.data.pagination.pages);
      setPage(result.data.pagination.page);
    }
  }, [selectedStatus, selectedPaymentStatus, getAllOrders]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Search filter
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredOrders(orders);
    } else {
      const filtered = orders.filter(
        (order) =>
          order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.buyer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.buyer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.store.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredOrders(filtered);
    }
  }, [searchQuery, orders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders(1);
    setRefreshing(false);
  }, [fetchOrders]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    Alert.alert(
      'Update Order Status',
      `Change status to ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const success = await updateOrderStatus(orderId, newStatus);
            if (success) {
              Alert.alert('Success', 'Order status updated');
              fetchOrders(page);
            } else {
              Alert.alert('Error', error || 'Failed to update status');
            }
          },
        },
      ]
    );
  };

  const handlePaymentStatusChange = async (orderId: string, newStatus: string) => {
    Alert.alert(
      'Update Payment Status',
      `Change payment status to ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const success = await updatePaymentStatus(orderId, newStatus);
            if (success) {
              Alert.alert('Success', 'Payment status updated');
              fetchOrders(page);
            } else {
              Alert.alert('Error', error || 'Failed to update payment status');
            }
          },
        },
      ]
    );
  };

  const handleCancelOrder = async (orderId: string) => {
    Alert.prompt(
      'Cancel Order',
      'Enter cancellation reason (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async (reason : any) => {
            const success = await cancelOrder(orderId, reason);
            if (success) {
              Alert.alert('Success', 'Order cancelled');
              fetchOrders(page);
            } else {
              Alert.alert('Error', error || 'Failed to cancel order');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleRefundOrder = async (orderId: string, totalAmount: number) => {
    Alert.prompt(
      'Refund Order',
      `Full amount: $${totalAmount.toFixed(2)}\nEnter refund amount:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async (amountText: any) => {
            const amount = parseFloat(amountText || totalAmount.toString());
            if (isNaN(amount) || amount <= 0) {
              Alert.alert('Error', 'Invalid amount');
              return;
            }
            const success = await refundOrder(orderId, amount);
            if (success) {
              Alert.alert('Success', 'Order refunded');
              fetchOrders(page);
            } else {
              Alert.alert('Error', error || 'Failed to refund order');
            }
          },
        },
      ],
      'plain-text',
      totalAmount.toString()
    );
  };

  const handleUpdateStatusPress = (order: Order) => {
    setSelectedOrderForStatus(order);
    setStatusModalVisible(true);
  };

  const handleStatusSelect = async (newStatus: string) => {
    if (!selectedOrderForStatus) return;

    setStatusModalVisible(false);
    const success = await updateOrderStatus(selectedOrderForStatus.id, newStatus);
    if (success) {
      Alert.alert('Success', 'Order status updated');
      fetchOrders(page);
    } else {
      Alert.alert('Error', error || 'Failed to update status');
    }
    setSelectedOrderForStatus(null);
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return Colors.warning;
      case 'CONFIRMED':
      case 'PROCESSING':
        return Colors.info;
      case 'SHIPPED':
        return Colors.primaryLight;
      case 'DELIVERED':
        return Colors.success;
      case 'CANCELLED':
        return Colors.error;
      default:
        return Colors.gray500;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return Colors.success;
      case 'PENDING':
        return Colors.warning;
      case 'FAILED':
        return Colors.error;
      case 'REFUNDED':
        return Colors.gray600;
      default:
        return Colors.gray500;
    }
  };

  const renderOrderActions = (order: Order) => {
    const actions = [];

    if (order.status === 'PENDING') {
      actions.push(
        <TouchableOpacity
          key="confirm"
          style={[styles.actionButton, { backgroundColor: Colors.success }]}
          onPress={() => handleStatusChange(order.id, 'CONFIRMED')}
        >
          <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
          <Text style={styles.actionButtonText}>Confirm</Text>
        </TouchableOpacity>
      );
    }

    if (order.status === 'CONFIRMED') {
      actions.push(
        <TouchableOpacity
          key="process"
          style={[styles.actionButton, { backgroundColor: Colors.info }]}
          onPress={() => handleStatusChange(order.id, 'PROCESSING')}
        >
          <Ionicons name="hourglass" size={16} color={Colors.white} />
          <Text style={styles.actionButtonText}>Process</Text>
        </TouchableOpacity>
      );
    }

    if (order.status === 'PROCESSING') {
      actions.push(
        <TouchableOpacity
          key="ship"
          style={[styles.actionButton, { backgroundColor: Colors.primaryLight }]}
          onPress={() => handleStatusChange(order.id, 'SHIPPED')}
        >
          <Ionicons name="airplane" size={16} color={Colors.white} />
          <Text style={styles.actionButtonText}>Ship</Text>
        </TouchableOpacity>
      );
    }

    if (order.status === 'SHIPPED') {
      actions.push(
        <TouchableOpacity
          key="deliver"
          style={[styles.actionButton, { backgroundColor: Colors.success }]}
          onPress={() => handleStatusChange(order.id, 'DELIVERED')}
        >
          <Ionicons name="checkbox" size={16} color={Colors.white} />
          <Text style={styles.actionButtonText}>Deliver</Text>
        </TouchableOpacity>
      );
    }

    if (['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
      actions.push(
        <TouchableOpacity
          key="cancel"
          style={[styles.actionButton, { backgroundColor: Colors.error }]}
          onPress={() => handleCancelOrder(order.id)}
        >
          <Ionicons name="close-circle" size={16} color={Colors.white} />
          <Text style={styles.actionButtonText}>Cancel</Text>
        </TouchableOpacity>
      );
    }

    if (order.paymentStatus === 'SUCCESS' && order.status !== 'REFUNDED') {
      actions.push(
        <TouchableOpacity
          key="refund"
          style={[styles.actionButton, { backgroundColor: Colors.accentDark }]}
          onPress={() => handleRefundOrder(order.id, order.totalAmount)}
        >
          <Ionicons name="cash" size={16} color={Colors.white} />
          <Text style={styles.actionButtonText}>Refund</Text>
        </TouchableOpacity>
      );
    }

    return actions;
  };

  const renderOrderCard = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => {
        setSelectedOrder(item);
        setModalVisible(true);
      }}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderIdContainer}>
          <Text style={styles.orderId}>Order #{item.id.slice(0, 8)}</Text>
          <Text style={styles.orderDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <Text style={styles.orderAmount}>${item.totalAmount.toFixed(2)}</Text>
      </View>

      <View style={styles.orderInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="person" size={16} color={Colors.textSecondary} />
          <Text style={styles.infoText}>{item.buyer.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="storefront" size={16} color={Colors.textSecondary} />
          <Text style={styles.infoText}>{item.store.name}</Text>
        </View>
      </View>

      <View style={styles.statusContainer}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getPaymentStatusColor(item.paymentStatus) + '20' }]}>
          <Text style={[styles.statusText, { color: getPaymentStatusColor(item.paymentStatus) }]}>
            {item.paymentStatus}
          </Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: Colors.info }]}
          onPress={() => handleUpdateStatusPress(item)}
        >
          <Ionicons name="create" size={16} color={Colors.white} />
          <Text style={styles.actionButtonText}>Update Status</Text>
        </TouchableOpacity>
        {renderOrderActions(item)}
      </View>
    </TouchableOpacity>
  );

  const renderOrderDetailsModal = () => (
    <Modal
      visible={modalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Order Details</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {selectedOrder && (
            <ScrollView style={styles.modalBody}>
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Order Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Order ID:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.id}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Amount:</Text>
                  <Text style={styles.detailValue}>${selectedOrder.totalAmount.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Customer</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.buyer.name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.buyer.email}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Store</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.store.name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>URL:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.store.url}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Items</Text>
                {selectedOrder.items.map((item, index) => (
                  <View key={item.id} style={styles.itemCard}>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    <Text style={styles.itemDetail}>
                      Qty: {item.quantity} × ${item.price.toFixed(2)}
                    </Text>
                    <Text style={styles.itemTotal}>
                      ${(item.quantity * item.price).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>

              {selectedOrder.deliveryInfo && (
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Delivery</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.deliveryInfo.status}</Text>
                  </View>
                  {selectedOrder.deliveryInfo.trackingNumber && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Tracking:</Text>
                      <Text style={styles.detailValue}>
                        {selectedOrder.deliveryInfo.trackingNumber}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderStatusSelectionModal = () => (
    <Modal
      visible={statusModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setStatusModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Update Order Status</Text>
            <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.sectionTitle}>Select New Status</Text>
            {ORDER_STATUSES.filter(status => status !== 'ALL').map((status) => (
              <TouchableOpacity
                key={status}
                style={styles.statusOption}
                onPress={() => handleStatusSelect(status)}
              >
                <Text style={styles.statusOptionText}>{status}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Order Management</Text>
        <Text style={styles.headerSubtitle}>
          {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by order ID, customer, or store..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={Colors.textTertiary}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        <Text style={styles.filterLabel}>Status:</Text>
        {ORDER_STATUSES.map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              selectedStatus === status && styles.filterChipActive,
            ]}
            onPress={() => setSelectedStatus(status)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedStatus === status && styles.filterChipTextActive,
              ]}
            >
              {status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        <Text style={styles.filterLabel}>Payment:</Text>
        {PAYMENT_STATUSES.map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              selectedPaymentStatus === status && styles.filterChipActive,
            ]}
            onPress={() => setSelectedPaymentStatus(status)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedPaymentStatus === status && styles.filterChipTextActive,
              ]}
            >
              {status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No orders found</Text>
            </View>
          }
        />
      )}

      {renderOrderDetailsModal()}

      {renderStatusSelectionModal()}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    backgroundColor: Colors.primary,
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.8,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    alignSelf: 'center',
    marginRight: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  listContainer: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderIdContainer: {
    flex: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  orderDate: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  orderInfo: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textTertiary,
    marginTop: 16,
  },
  errorBanner: {
    backgroundColor: Colors.errorLight,
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  itemCard: {
    backgroundColor: Colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  itemDetail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statusOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statusOptionText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
});
