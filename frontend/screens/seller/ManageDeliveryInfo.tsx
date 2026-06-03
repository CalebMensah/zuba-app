import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useDelivery } from '../../hooks/useDelivery';
import { Colors } from '../../constants/colors';
import { DeliveryStatus } from '../../types/order';

const ManageDeliveriesScreen = () => {
  const {
    loading,
    error,
    getAllSellerDeliveries,
    updateDeliveryInfo,
    clearError,
  } = useDelivery();

  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    courierService: '',
    trackingNumber: '',
    estimatedDeliveryDays: '',
    dispatchNote: '',
    status: '' as DeliveryStatus | '',
  });
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    fetchDeliveries();
    return () => clearError();
  }, []);

  const fetchDeliveries = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const result = await getAllSellerDeliveries({ page: 1, limit: 50 });

    if (result) {
      setDeliveries(result.deliveries);
      setPagination(result.pagination);
    }

    setInitialLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => fetchDeliveries(true);

  const openEditModal = (delivery: any) => {
    setSelectedDelivery(delivery);
    setEditFormData({
      courierService: delivery.courierService || '',
      trackingNumber: delivery.trackingNumber || '',
      estimatedDeliveryDays: delivery.estimatedDeliveryDays
        ? String(delivery.estimatedDeliveryDays)
        : '',
      dispatchNote: delivery.dispatchNote || '',
      status: delivery.status || '',
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedDelivery) return;

    if (!editFormData.courierService.trim()) {
      Alert.alert('Validation Error', 'Courier service is required.');
      return;
    }

    if (
      editFormData.estimatedDeliveryDays.trim() &&
      (isNaN(parseInt(editFormData.estimatedDeliveryDays)) ||
        parseInt(editFormData.estimatedDeliveryDays) < 1)
    ) {
      Alert.alert('Validation Error', 'Estimated delivery days must be a positive number.');
      return;
    }

    setSaveLoading(true);

    const result = await updateDeliveryInfo({
      orderId: selectedDelivery.order.id,
      courierService: editFormData.courierService,
      trackingNumber: editFormData.trackingNumber || undefined,
      estimatedDeliveryDays: editFormData.estimatedDeliveryDays
        ? parseInt(editFormData.estimatedDeliveryDays)
        : undefined,
      dispatchNote: editFormData.dispatchNote || undefined,
      status: editFormData.status || undefined,
    });

    setSaveLoading(false);

    if (result) {
      // Update local state to avoid full refetch
      setDeliveries(prev =>
        prev.map(d =>
          d.order.id === selectedDelivery.order.id
            ? { ...d, ...result }
            : d
        )
      );
      setEditModalVisible(false);
      Alert.alert('Success', 'Delivery information updated.');
    } else if (error) {
      Alert.alert('Error', error);
    }
  };

  const getStatusColor = (status: DeliveryStatus): string => {
    const colors: Record<DeliveryStatus, string> = {
      PENDING: '#FFA500',
      PROCESSING: '#2196F3',
      DISPATCHED: '#9C27B0',
      DELIVERED: '#4CAF50',
      FAILED: '#F44336',
      RETURNED: '#757575',
    };
    return colors[status] || '#757575';
  };

  const EDITABLE_STATUSES: DeliveryStatus[] = [
    'PENDING',
    'PROCESSING',
    'DISPATCHED',
    'FAILED',
    'RETURNED',
  ];

  const renderDeliveryCard = ({ item }: { item: any }) => (
    <View style={styles.card}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>
            Order #{item.order?.orderNumber || item.order?.id?.slice(-8)}
          </Text>
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(item.status) },
              ]}
            />
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.orderAmount}>
          GHS {item.order?.totalAmount?.toFixed(2) ?? '—'}
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Delivery Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Ionicons name="car-outline" size={20} color="#666" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Courier Service</Text>
            <Text style={styles.infoValue}>
              {item.courierService || '—'}
            </Text>
          </View>
        </View>

        {item.trackingNumber && (
          <View style={styles.infoRow}>
            <Ionicons name="cube-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Tracking Number</Text>
              <Text style={styles.infoValue}>{item.trackingNumber}</Text>
            </View>
          </View>
        )}

        {item.estimatedDeliveryDays && (
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Estimated Delivery</Text>
              <Text style={styles.infoValue}>
                {item.estimatedDeliveryDays} day
                {item.estimatedDeliveryDays !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        )}

        {item.dispatchedAt && (
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Dispatched At</Text>
              <Text style={styles.infoValue}>
                {new Date(item.dispatchedAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={20} color="#666" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Delivery Address</Text>
            <Text style={styles.infoValue}>
              {item.address}, {item.city}
            </Text>
          </View>
        </View>

        {item.dispatchNote && (
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Dispatch Note</Text>
              <Text style={styles.infoValue}>{item.dispatchNote}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Buyer Info */}
      {item.order?.buyer && (
        <View style={styles.buyerRow}>
          <Ionicons name="person-outline" size={16} color="#999" />
          <Text style={styles.buyerText}>
            {item.order.buyer.firstName} {item.order.buyer.lastName}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="pencil" size={16} color={Colors.primary} />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEditModal = () => (
    <Modal
      visible={editModalVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setEditModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Delivery Info</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Courier Service <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={editFormData.courierService}
                onChangeText={text =>
                  setEditFormData(prev => ({ ...prev, courierService: text }))
                }
                placeholder="e.g., DHL, GIG Logistics"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tracking Number</Text>
              <TextInput
                style={styles.input}
                value={editFormData.trackingNumber}
                onChangeText={text =>
                  setEditFormData(prev => ({ ...prev, trackingNumber: text }))
                }
                placeholder="Package tracking number"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Estimated Delivery Days</Text>
              <TextInput
                style={styles.input}
                value={editFormData.estimatedDeliveryDays}
                onChangeText={text =>
                  setEditFormData(prev => ({ ...prev, estimatedDeliveryDays: text }))
                }
                placeholder="e.g., 3"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.statusOptions}>
                {EDITABLE_STATUSES.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.statusOption,
                      editFormData.status === s && {
                        backgroundColor: getStatusColor(s),
                        borderColor: getStatusColor(s),
                      },
                    ]}
                    onPress={() =>
                      setEditFormData(prev => ({ ...prev, status: s }))
                    }
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        editFormData.status === s && styles.statusOptionTextActive,
                      ]}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Dispatch Note</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editFormData.dispatchNote}
                onChangeText={text =>
                  setEditFormData(prev => ({ ...prev, dispatchNote: text }))
                }
                placeholder="Additional dispatch notes"
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saveLoading && styles.saveButtonDisabled]}
              onPress={handleSaveEdit}
              disabled={saveLoading}
            >
              {saveLoading ? (
                <LoadingSpinner size={20} color={Colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (initialLoading) {
    return (
      <View style={styles.centerContainer}>
        <LoadingSpinner size={40} color={Colors.primary} />
        <Text style={styles.loadingText}>Loading deliveries...</Text>
      </View>
    );
  }

  if (error && deliveries.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorText}>Failed to load deliveries</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => fetchDeliveries()}
        >
          <Ionicons name="refresh" size={20} color={Colors.white} />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manage Deliveries</Text>
        <Text style={styles.headerSubtitle}>
          {pagination?.totalCount ?? deliveries.length} deliveries
        </Text>
      </View>

      {deliveries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>No Deliveries Yet</Text>
          <Text style={styles.emptyText}>
            Deliveries will appear here once you ship an order.
          </Text>
        </View>
      ) : (
        <FlatList
          data={deliveries}
          renderItem={renderDeliveryCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
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

      {renderEditModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    marginTop: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: Colors.white,
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  listContainer: {
    padding: 15,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  infoSection: {
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  buyerText: {
    fontSize: 13,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  editButton: {
    backgroundColor: '#E3F2FD',
  },
  editButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalScroll: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: Colors.error,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  statusOptionTextActive: {
    color: Colors.white,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ManageDeliveriesScreen;