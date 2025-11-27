import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useAddress } from '../../hooks/useAddress';
import { Ionicons } from '@expo/vector-icons';

interface Address {
  id: string;
  userId: string;
  recipient: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region: string;
  country: string;
  postalCode?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const ManageAddressesScreen = ({ navigation }: any) => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const {
    loading,
    error,
    getUserAddresses,
    deleteAddress,
    setDefaultAddress,
  } = useAddress();

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    const fetchedAddresses = await getUserAddresses();
    setAddresses(fetchedAddresses);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAddresses();
    setRefreshing(false);
  };

  const handleSetDefault = async (addressId: string) => {
    const success = await setDefaultAddress(addressId);
    if (success) {
      Alert.alert('Success', 'Default address updated successfully');
      loadAddresses();
    } else {
      Alert.alert('Error', error || 'Failed to set default address');
    }
  };

  const handleDelete = (addressId: string, isDefault: boolean) => {
    if (isDefault && addresses.length === 1) {
      Alert.alert(
        'Cannot Delete',
        'Cannot delete the only default address. Please add another address first.'
      );
      return;
    }

    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteAddress(addressId);
            if (success) {
              Alert.alert('Success', 'Address deleted successfully');
              loadAddresses();
            } else {
              Alert.alert('Error', error || 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (address: Address) => {
    navigation.navigate('EditAddress', { address });
  };

  const handleAddNew = () => {
    navigation.navigate('AddAddress');
  };

  const renderAddressCard = ({ item }: { item: Address }) => (
    <View style={styles.addressCard}>
      {item.isDefault && (
        <View style={styles.defaultBadge}>
          <Text style={styles.defaultBadgeText}>DEFAULT</Text>
        </View>
      )}

      <View style={styles.addressInfo}>
        <Text style={styles.recipientName}>{item.recipient}</Text>
        <Text style={styles.phone}>{item.phone}</Text>
        <Text style={styles.address}>
          {item.addressLine1}
          {item.addressLine2 ? `, ${item.addressLine2}` : ''}
        </Text>
        <Text style={styles.address}>
          {item.city}, {item.region}
        </Text>
        <Text style={styles.address}>{item.country}</Text>
        {item.postalCode && (
          <Text style={styles.address}>{item.postalCode}</Text>
        )}
      </View>

      <View style={styles.actionButtons}>
        {!item.isDefault && (
          <TouchableOpacity
            style={[styles.actionButton, styles.defaultButton]}
            onPress={() => handleSetDefault(item.id)}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#4CAF50" />
            <Text style={styles.defaultButtonText}>Set Default</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEdit(item)}
        >
          <Ionicons name="pencil-outline" size={18} color="#2196F3" />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item.id, item.isDefault)}
        >
          <Ionicons name="trash-outline" size={18} color="#F44336" />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <ScrollView
      contentContainerStyle={styles.emptyContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Ionicons name="location-outline" size={80} color="#BDBDBD" />
      <Text style={styles.emptyTitle}>No Addresses Found</Text>
      <Text style={styles.emptySubtitle}>
        Add your first delivery address to get started
      </Text>
      <TouchableOpacity style={styles.addButton} onPress={handleAddNew}>
        <Ionicons name="add-circle-outline" size={24} color="#FFF" />
        <Text style={styles.addButtonText}>Add New Address</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (loading && addresses.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading addresses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {addresses.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          <FlatList
            data={addresses}
            keyExtractor={(item) => item.id}
            renderItem={renderAddressCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListFooterComponent={
              <TouchableOpacity
                style={styles.addNewButton}
                onPress={handleAddNew}
              >
                <Ionicons name="add-circle" size={24} color="#FF6B35" />
                <Text style={styles.addNewButtonText}>Add New Address</Text>
              </TouchableOpacity>
            }
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
  },
  listContent: {
    padding: 16,
  },
  addressCard: {
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
  defaultBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  defaultBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  addressInfo: {
    marginBottom: 16,
  },
  recipientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 8,
  },
  address: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  defaultButton: {
    backgroundColor: '#E8F5E9',
  },
  defaultButtonText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#E3F2FD',
  },
  editButtonText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  deleteButtonText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: '600',
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#FF6B35',
    borderStyle: 'dashed',
  },
  addNewButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 32,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ManageAddressesScreen;