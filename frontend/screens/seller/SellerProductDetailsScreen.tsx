// screens/SellerProductDetailsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProduct } from '../../hooks/useProducts';
import { Colors } from '../../constants/colors';
import { SellerStackParamList } from '../../types/navigation';

const { width } = Dimensions.get('window');

type SellerProductDetailsScreenRouteProp = RouteProp<SellerStackParamList, 'SellerProductDetails'>;
type SellerProductDetailsScreenNavigationProp = NativeStackNavigationProp<SellerStackParamList>;

interface SellerProductDetailsScreenProps {
  route: SellerProductDetailsScreenRouteProp;
  navigation: SellerProductDetailsScreenNavigationProp;
}

const SellerProductDetailsScreen: React.FC<SellerProductDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const { productUrl } = route.params;
  const { product, loading, error, getProductByUrl, deleteProduct, clearProduct } = useProduct();
  const [deleting, setDeleting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    fetchProductDetails();

    return () => {
      clearProduct();
    };
  }, [productUrl]);

  const fetchProductDetails = async () => {
    await getProductByUrl(productUrl);
  };

  const handleEdit = () => {
    if (product) {
      navigation.navigate('EditProduct', {
        productId: product.id,
        initialProduct: product,
      });
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    if (!product) return;

    setDeleting(true);
    const success = await deleteProduct(product.id);
    setDeleting(false);

    if (success) {
      Alert.alert('Success', 'Product deleted successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } else {
      Alert.alert('Error', 'Failed to delete product. Please try again.');
    }
  };

  if (loading && !product) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading product details...</Text>
      </View>
    );
  }

  if (error && !product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProductDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Product not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Image Carousel */}
        {product.images && product.images.length > 0 && (
          <View style={styles.imageSection}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(event) => {
                const index = Math.round(
                  event.nativeEvent.contentOffset.x / width
                );
                setCurrentImageIndex(index);
              }}
              scrollEventThrottle={16}
            >
              {product.images.map((uri, index) => (
                <Image
                  key={index}
                  source={{ uri }}
                  style={styles.productImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>

            {/* Image Indicator */}
            {product.images.length > 1 && (
              <View style={styles.imageIndicator}>
                {product.images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.indicatorDot,
                      currentImageIndex === index && styles.indicatorDotActive,
                    ]}
                  />
                ))}
              </View>
            )}

            {/* Status Badge */}
            <View
              style={[
                styles.statusBadge,
                product.isActive ? styles.statusBadgeActive : styles.statusBadgeInactive,
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {product.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        )}

        {/* Product Info */}
        <View style={styles.content}>
          {/* Title and Price */}
          <View style={styles.header}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.price}>${product.price.toFixed(2)}</Text>
          </View>

          {/* Stock Info */}
          <View style={styles.stockSection}>
            <View style={styles.stockItem}>
              <Text style={styles.stockLabel}>Stock</Text>
              <Text style={[styles.stockValue, product.stock < 10 && styles.stockLow]}>
                {product.stock} units
              </Text>
            </View>
            {product.moq && (
              <View style={styles.stockItem}>
                <Text style={styles.stockLabel}>MOQ</Text>
                <Text style={styles.stockValue}>{product.moq} units</Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{product.quantityBought}</Text>
              <Text style={styles.statLabel}>Sold</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{product.viewCount}</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
          </View>

          {/* Description */}
          {product.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          )}

          {/* Category */}
          {product.category && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category</Text>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{product.category}</Text>
              </View>
            </View>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.chipContainer}>
                {product.tags.map((tag, index) => (
                  <View key={index} style={styles.chip}>
                    <Text style={styles.chipText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Sizes */}
          {product.sizes && product.sizes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Available Sizes</Text>
              <View style={styles.chipContainer}>
                {product.sizes.map((size, index) => (
                  <View key={index} style={styles.chip}>
                    <Text style={styles.chipText}>{size}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Colors */}
          {product.color && product.color.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Available Colors</Text>
              <View style={styles.chipContainer}>
                {product.color.map((color, index) => (
                  <View key={index} style={styles.chip}>
                    <Text style={styles.chipText}>{color}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Weight */}
          {product.weight && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Weight</Text>
              <Text style={styles.infoText}>{product.weight} kg</Text>
            </View>
          )}

          {/* Seller Note */}
          {product.sellerNote && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Seller Note</Text>
              <View style={styles.noteContainer}>
                <Text style={styles.noteText}>{product.sellerNote}</Text>
              </View>
            </View>
          )}

          {/* Metadata */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Information</Text>
            <View style={styles.metadataContainer}>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Product URL:</Text>
                <Text style={styles.metadataValue}>{product.url}</Text>
              </View>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Created:</Text>
                <Text style={styles.metadataValue}>
                  {new Date(product.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Last Updated:</Text>
                <Text style={styles.metadataValue}>
                  {new Date(product.updatedAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={handleEdit}
          disabled={deleting}
        >
          <Text style={styles.actionButtonText}>✏️ Edit Product</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.actionButtonText}>🗑️ Delete</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  imageSection: {
    position: 'relative',
  },
  productImage: {
    width: width,
    height: width,
    backgroundColor: Colors.gray200,
  },
  imageIndicator: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white,
    opacity: 0.5,
  },
  indicatorDotActive: {
    opacity: 1,
    width: 24,
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeActive: {
    backgroundColor: Colors.success,
  },
  statusBadgeInactive: {
    backgroundColor: Colors.error,
  },
  statusBadgeText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 12,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  stockSection: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
  },
  stockItem: {
    flex: 1,
  },
  stockLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  stockValue: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  stockLow: {
    color: Colors.error,
  },
  statsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
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
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textSecondary,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  infoText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  noteContainer: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  noteText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  metadataContainer: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  metadataLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
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
  bottomSpacer: {
    height: 100,
  },
  actionBar: {
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
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: Colors.primary,
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SellerProductDetailsScreen;