import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../../constants/colors';
import { useProduct } from '../../hooks/useProducts';
import { LoadingSpinner } from '../../components/LoadingSpinner';

interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  deletedAt?: string;
  createdAt: string;
}

interface DeletedProductsScreenProps {
  navigation: any;
}

const ListDeletedProductsScreen: React.FC<DeletedProductsScreenProps> = ({ navigation }) => {
  const {
    deletedProducts,
    loading,
    error,
    getDeletedProducts,
    restoreProduct,
    deleteProduct,
    clearError,
  } = useProduct();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    loadDeletedProducts();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const loadDeletedProducts = async () => {
    await getDeletedProducts();
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDeletedProducts();
    setRefreshing(false);
  }, []);

  const handleRestore = async (product: Product) => {
    Alert.alert(
      'Restore Product',
      `Are you sure you want to restore "${product.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            const success = await restoreProduct(product.id);
            
            if (success) {
              await loadDeletedProducts();
              Alert.alert('Success', 'Product restored successfully');
            }
          },
        },
      ]
    );
  };

  const handlePermanentDelete = (product: Product) => {
    setSelectedProduct(product);
    setShowDeleteModal(true);
  };

  const confirmPermanentDelete = async () => {
    if (!selectedProduct) return;

    setShowDeleteModal(false);
    
    const success = await deleteProduct(selectedProduct.id);

    if (success) {
      await loadDeletedProducts();
      Alert.alert('Success', 'Product permanently deleted');
    }
    setSelectedProduct(null);
  };

  const handleEditProduct = (product: Product) => {
    navigation.navigate('EditProduct', {
      productId: product.id,
      initialProduct: product,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return `GH₵${price.toFixed(2)}`;
  };

  const getDaysUntilPermanentDeletion = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt);
    const thirtyDaysLater = new Date(deletedDate);
    thirtyDaysLater.setDate(deletedDate.getDate() + 30);
    
    const today = new Date();
    const daysLeft = Math.ceil((thirtyDaysLater.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysLeft > 0 ? daysLeft : 0;
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    const daysLeft = getDaysUntilPermanentDeletion(item.deletedAt? item.deletedAt : '');
    const isUrgent = daysLeft <= 7;

    return (
      <View style={styles.productCard}>
        <View style={styles.productContent}>
          {/* Product Image */}
          <View style={styles.imageContainer}>
            {item.images && item.images.length > 0 ? (
              <Image
                source={{ uri: item.images[0] }}
                style={styles.productImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.productImage, styles.placeholderImage]}>
                <Ionicons name="image-outline" size={32} color={Colors.gray400} />
              </View>
            )}
          </View>

          {/* Product Info */}
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
            
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Deleted: </Text>
              <Text style={styles.dateValue}>{formatDate(item.deletedAt || '')}</Text>
            </View>

            <View style={[styles.warningBadge, isUrgent && styles.urgentBadge]}>
              <Ionicons 
                name={isUrgent ? "warning" : "time-outline"} 
                size={14} 
                color={isUrgent ? Colors.error : Colors.warning} 
              />
              <Text style={[styles.warningText, isUrgent && styles.urgentText]}>
                {daysLeft === 0 
                  ? 'Deletes today' 
                  : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEditProduct(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.restoreButton]}
            onPress={() => handleRestore(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="reload-outline" size={18} color={Colors.success} />
            <Text style={styles.restoreButtonText}>Restore</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handlePermanentDelete(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="trash-outline" size={80} color={Colors.gray300} />
      <Text style={styles.emptyTitle}>No Deleted Products</Text>
      <Text style={styles.emptySubtitle}>
        Products you delete will appear here for 30 days before being permanently removed.
      </Text>
    </View>
  );

  if (loading && !refreshing && deletedProducts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Deleted Products</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size={40} color={Colors.primary} />
          <Text style={styles.loadingText}>Loading deleted products...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Deleted Products</Text>
        <View style={styles.headerRight}>
          {deletedProducts.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{deletedProducts.length}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Info Banner */}
      {deletedProducts.length > 0 && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.info} />
          <Text style={styles.infoText}>
            Deleted products are permanently removed after 30 days
          </Text>
        </View>
      )}

      {/* Product List */}
      <FlatList
        data={deletedProducts}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContainer,
          deletedProducts.length === 0 && styles.emptyListContainer,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Permanent Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="warning" size={40} color={Colors.error} />
              </View>
              <Text style={styles.modalTitle}>Permanent Delete</Text>
              <Text style={styles.modalSubtitle}>
                This action cannot be undone
              </Text>
            </View>

            {selectedProduct && (
              <View style={styles.modalBody}>
                <Text style={styles.modalText}>
                  Are you sure you want to permanently delete:
                </Text>
                <Text style={styles.modalProductName}>"{selectedProduct.name}"</Text>
                <Text style={styles.modalWarning}>
                  This product will be immediately and permanently removed from your store.
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setSelectedProduct(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmPermanentDelete}
                activeOpacity={0.7}
              >
                <Text style={styles.modalDeleteText}>Delete Forever</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Action Loading Overlay */}
      {loading && deletedProducts.length > 0 && (
        <View style={styles.actionLoadingOverlay}>
          <View style={styles.actionLoadingContent}>
            <LoadingSpinner size={40} color={Colors.primary} />
            <Text style={styles.actionLoadingText}>Processing...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: Typography.xl,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  countBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: Typography.xs,
    fontFamily: Typography.bold,
    color: Colors.white,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  infoText: {
    fontSize: Typography.sm,
    fontFamily: Typography.medium,
    color: Colors.info,
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  productCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productContent: {
    flexDirection: 'row',
    padding: 12,
  },
  imageContainer: {
    marginRight: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.gray100,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: Typography.lg,
    fontFamily: Typography.bold,
    color: Colors.primary,
    marginBottom: 4,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dateLabel: {
    fontSize: Typography.xs,
    fontFamily: Typography.regular,
    color: Colors.textSecondary,
  },
  dateValue: {
    fontSize: Typography.xs,
    fontFamily: Typography.medium,
    color: Colors.textPrimary,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  urgentBadge: {
    backgroundColor: Colors.errorLight,
  },
  warningText: {
    fontSize: Typography.xs,
    fontFamily: Typography.semiBold,
    color: Colors.warning,
  },
  urgentText: {
    color: Colors.error,
  },
  actionButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  editButton: {
    backgroundColor: Colors.backgroundSecondary,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  editButtonText: {
    fontSize: Typography.sm,
    fontFamily: Typography.semiBold,
    color: Colors.primary,
  },
  restoreButton: {
    backgroundColor: Colors.backgroundSecondary,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  restoreButtonText: {
    fontSize: Typography.sm,
    fontFamily: Typography.semiBold,
    color: Colors.success,
  },
  deleteButton: {
    backgroundColor: Colors.backgroundSecondary,
  },
  deleteButtonText: {
    fontSize: Typography.sm,
    fontFamily: Typography.semiBold,
    color: Colors.error,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: Typography['2xl'],
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: Typography.base,
    fontFamily: Typography.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: Typography.base,
    fontFamily: Typography.medium,
    color: Colors.textSecondary,
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
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: Typography['2xl'],
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.regular,
    color: Colors.textSecondary,
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  modalText: {
    fontSize: Typography.base,
    fontFamily: Typography.regular,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalProductName: {
    fontSize: Typography.lg,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalWarning: {
    fontSize: Typography.sm,
    fontFamily: Typography.medium,
    color: Colors.error,
    textAlign: 'center',
    backgroundColor: Colors.errorLight,
    padding: 12,
    borderRadius: 8,
  },
  modalActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: Colors.backgroundSecondary,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  modalCancelText: {
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
  },
  modalDeleteButton: {
    backgroundColor: Colors.error,
  },
  modalDeleteText: {
    fontSize: Typography.base,
    fontFamily: Typography.bold,
    color: Colors.white,
  },
  actionLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLoadingContent: {
    backgroundColor: Colors.white,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 150,
  },
  actionLoadingText: {
    fontSize: Typography.base,
    fontFamily: Typography.medium,
    color: Colors.textPrimary,
    marginTop: 12,
  },
});

export default ListDeletedProductsScreen;