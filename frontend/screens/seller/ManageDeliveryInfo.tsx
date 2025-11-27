import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

const ManageDeliveryInfo = () => {
  const navigation = useNavigation();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [editFormData, setEditFormData] = useState({
    courierService: '',
    driverName: '',
    driverPhone: '',
    driverVehicleNumber: '',
    trackingNumber: '',
    trackingUrl: '',
    estimatedDelivery: '',
    notes: ''
  });

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${API_URL}/orders/seller`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const ordersWithDelivery = response.data.data.orders.filter(
          order => order.deliveryInfo && 
          (order.deliveryInfo.courierService || order.deliveryInfo.driverName)
        );
        setDeliveries(ordersWithDelivery);
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      Alert.alert('Error', 'Failed to fetch delivery information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeliveries();
  };

  const handleMarkAsDelivered = async (orderId) => {
    Alert.alert(
      'Mark as Delivered',
      'Are you sure you want to mark this order as delivered?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              const response = await axios.patch(
                `${API_URL}/delivery/${orderId}/status`,
                { status: 'DELIVERED' },
                { headers: { Authorization: `Bearer ${token}` } }
              );

              if (response.data.success) {
                Alert.alert('Success', 'Order marked as delivered');
                fetchDeliveries();
              }
            } catch (error) {
              console.error('Error marking as delivered:', error);
              Alert.alert('Error', error.response?.data?.message || 'Failed to update status');
            }
          }
        }
      ]
    );
  };

  const handleDelete = async (orderId) => {
    Alert.alert(
      'Delete Courier Assignment',
      'Are you sure you want to remove the courier assignment for this order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              const response = await axios.delete(
                `${API_URL}/delivery/${orderId}/courier`,
                { headers: { Authorization: `Bearer ${token}` } }
              );

              if (response.data.success) {
                Alert.alert('Success', 'Courier assignment removed');
                fetchDeliveries();
              }
            } catch (error) {
              console.error('Error deleting courier:', error);
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete');
            }
          }
        }
      ]
    );
  };

  const openEditModal = (delivery) => {
    setSelectedDelivery(delivery);
    setEditFormData({
      courierService: delivery.deliveryInfo.courierService || '',
      driverName: delivery.deliveryInfo.driverName || '',
      driverPhone: delivery.deliveryInfo.driverPhone || '',
      driverVehicleNumber: delivery.deliveryInfo.driverVehicleNumber || '',
      trackingNumber: delivery.deliveryInfo.trackingNumber || '',
      trackingUrl: delivery.deliveryInfo.trackingUrl || '',
      estimatedDelivery: delivery.deliveryInfo.estimatedDelivery || '',
      notes: delivery.deliveryInfo.notes || ''
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.patch(
        `${API_URL}/delivery/${selectedDelivery.id}/courier`,
        editFormData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert('Success', 'Delivery information updated');
        setEditModalVisible(false);
        fetchDeliveries();
      }
    } catch (error) {
      console.error('Error updating delivery:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to update');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING: '#FFA500',
      PROCESSING: '#2196F3',
      SHIPPED: '#9C27B0',
      OUT_FOR_DELIVERY: '#FF9800',
      DELIVERED: '#4CAF50',
      RETURNED: '#F44336',
      CANCELLED: '#757575'
    };
    return colors[status] || '#757575';
  };

  const renderDeliveryCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>Order #{item.id.slice(-8)}</Text>
          <View style={styles.statusBadge}>
            <View 
              style={[
                styles.statusDot, 
                { backgroundColor: getStatusColor(item.deliveryInfo.status) }
              ]} 
            />
            <Text style={styles.statusText}>{item.deliveryInfo.status}</Text>
          </View>
        </View>
        <Text style={styles.orderAmount}>GHS {item.totalAmount.toFixed(2)}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Icon name="truck-delivery" size={20} color="#666" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Courier Service</Text>
            <Text style={styles.infoValue}>{item.deliveryInfo.courierService}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Icon name="account" size={20} color="#666" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Driver</Text>
            <Text style={styles.infoValue}>{item.deliveryInfo.driverName}</Text>
          </View>
        </View>

        {item.deliveryInfo.driverPhone && (
          <View style={styles.infoRow}>
            <Icon name="phone" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Driver Phone</Text>
              <Text style={styles.infoValue}>{item.deliveryInfo.driverPhone}</Text>
            </View>
          </View>
        )}

        <View style={styles.infoRow}>
          <Icon name="car" size={20} color="#666" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Vehicle Number</Text>
            <Text style={styles.infoValue}>{item.deliveryInfo.driverVehicleNumber}</Text>
          </View>
        </View>

        {item.deliveryInfo.trackingNumber && (
          <View style={styles.infoRow}>
            <Icon name="package-variant" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Tracking Number</Text>
              <Text style={styles.infoValue}>{item.deliveryInfo.trackingNumber}</Text>
            </View>
          </View>
        )}

        <View style={styles.infoRow}>
          <Icon name="map-marker" size={20} color="#666" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Delivery Address</Text>
            <Text style={styles.infoValue}>
              {item.deliveryInfo.address}, {item.deliveryInfo.city}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.deliveredButton]}
          onPress={() => handleMarkAsDelivered(item.id)}
          disabled={item.deliveryInfo.status === 'DELIVERED'}
        >
          <Icon name="check-circle" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Mark Delivered</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Icon name="pencil" size={20} color="#2196F3" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item.id)}
        >
          <Icon name="delete" size={20} color="#F44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEditModal = () => (
    <Modal
      visible={editModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setEditModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Delivery Info</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Courier Service *</Text>
              <TextInput
                style={styles.input}
                value={editFormData.courierService}
                onChangeText={(text) => setEditFormData({...editFormData, courierService: text})}
                placeholder="e.g., DHL, FedEx"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Driver Name *</Text>
              <TextInput
                style={styles.input}
                value={editFormData.driverName}
                onChangeText={(text) => setEditFormData({...editFormData, driverName: text})}
                placeholder="Driver's full name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Driver Phone</Text>
              <TextInput
                style={styles.input}
                value={editFormData.driverPhone}
                onChangeText={(text) => setEditFormData({...editFormData, driverPhone: text})}
                placeholder="Driver's phone number"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Vehicle Number *</Text>
              <TextInput
                style={styles.input}
                value={editFormData.driverVehicleNumber}
                onChangeText={(text) => setEditFormData({...editFormData, driverVehicleNumber: text})}
                placeholder="License plate number"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tracking Number</Text>
              <TextInput
                style={styles.input}
                value={editFormData.trackingNumber}
                onChangeText={(text) => setEditFormData({...editFormData, trackingNumber: text})}
                placeholder="Package tracking number"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tracking URL</Text>
              <TextInput
                style={styles.input}
                value={editFormData.trackingUrl}
                onChangeText={(text) => setEditFormData({...editFormData, trackingUrl: text})}
                placeholder="https://..."
                keyboardType="url"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editFormData.notes}
                onChangeText={(text) => setEditFormData({...editFormData, notes: text})}
                placeholder="Additional delivery notes"
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveEdit}
            >
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manage Deliveries</Text>
        <Text style={styles.headerSubtitle}>{deliveries.length} active deliveries</Text>
      </View>

      {deliveries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="truck-delivery-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>No Deliveries Yet</Text>
          <Text style={styles.emptyText}>
            Courier assignments will appear here once you assign them to orders
          </Text>
        </View>
      ) : (
        <FlatList
          data={deliveries}
          renderItem={renderDeliveryCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
    backgroundColor: '#f5f5f5'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666'
  },
  listContainer: {
    padding: 15
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333'
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF'
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12
  },
  infoSection: {
    marginBottom: 12
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  infoContent: {
    flex: 1,
    marginLeft: 12
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6
  },
  deliveredButton: {
    flex: 1,
    backgroundColor: '#4CAF50'
  },
  editButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333'
  },
  modalScroll: {
    padding: 20
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fafafa'
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top'
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});

export default ManageDeliveryInfo;