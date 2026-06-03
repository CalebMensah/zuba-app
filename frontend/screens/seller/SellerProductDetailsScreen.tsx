// screens/SellerProductDetailsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StyleSheet,
  Dimensions,
  Share,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useProduct, useSoftDeleteProduct } from '../../hooks/useProducts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
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
  
  // TanStack Query hooks
  const { data: product, isLoading, error, refetch } = useProduct(productUrl);
  console.log('productUrl:', productUrl);
  
  // Log product data when it's available
  useEffect(() => {
    if (product) {
      console.log('product details:', product);
    }
  }, [product]);
  
  const deleteMutation = useSoftDeleteProduct();
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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
      'Are you sure you want to delete this product? This product will be moved to trash.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Move to Trash',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };


  const confirmDelete = () => {
    if (!product) return;

    deleteMutation.mutate(product.id, {
      onSuccess: () => {
        Alert.alert('Success', 'Product moved to trash successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      },
      onError: (error) => {
        Alert.alert('Error', error.message || 'Failed to delete product. Please try again.');
      },
    });
  };

  const handleCopyUrl = async () => {
    if (product?.url) {
      const productUrl = `https://zuba-web.vercel.app/product/${product.url}`;
      await Clipboard.setStringAsync(productUrl);
      Alert.alert('Success', 'Product URL copied to clipboard!');
    }
  };

  const handleShareUrl = async () => {
    if (product?.url) {
      const productUrl = `https://zuba-web.vercel.app/product/${product.url}`;
      try {
        await Share.share({
          message: `Check out this product: ${product.name}\n${productUrl}`,
          title: product.name,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  // Loading state with LoadingSpinner
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <LoadingSpinner size={40} color={Colors.primary} />
        <Text style={styles.loadingText}>Loading product details...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorText}>{error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Ionicons name="refresh" size={20} color={Colors.white} />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Not found state
  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="search-outline" size={64} color={Colors.gray400} />
        <Text style={styles.errorText}>Product not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.navigationHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Details</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleCopyUrl} style={styles.headerIconButton}>
            <Ionicons name="copy-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShareUrl} style={styles.headerIconButton}>
            <Ionicons name="share-social-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

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
            <Text style={styles.price}>GH₵{product.price.toFixed(2)}</Text>
          </View>

          {/* Stock Info */}
          <View style={styles.stockSection}>
            <View style={styles.stockItem}>
              <Ionicons name="cube-outline" size={20} color={Colors.textSecondary} />
              <View style={styles.stockInfo}>
                <Text style={styles.stockLabel}>Stock</Text>
                <Text style={[styles.stockValue, product.stock < 10 && styles.stockLow]}>
                  {product.stock} units
                </Text>
              </View>
            </View>
            {product.moq && (
              <View style={styles.stockItem}>
                <Ionicons name="layers-outline" size={20} color={Colors.textSecondary} />
                <View style={styles.stockInfo}>
                  <Text style={styles.stockLabel}>MOQ</Text>
                  <Text style={styles.stockValue}>{product.moq} units</Text>
                </View>
              </View>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <Ionicons name="cart-outline" size={24} color={Colors.primary} />
              <Text style={styles.statValue}>{product.quantityBought}</Text>
              <Text style={styles.statLabel}>Sold</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="eye-outline" size={24} color={Colors.primary} />
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
                <Ionicons name="pricetag" size={14} color={Colors.white} />
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
                  <View key={index} style={styles.sizeChip}>
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

          {/* Metadata */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Information</Text>
            <View style={styles.metadataContainer}>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Product URL:</Text>
                <Text style={styles.metadataValue} numberOfLines={1}>
                  {product.url}
                </Text>
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

      {/* Action Buttons - WITH LoadingSpinner */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={handleEdit}
          disabled={deleteMutation.isPending}
        >
          <Ionicons name="create-outline" size={20} color={Colors.white} />
          <Text style={styles.actionButtonText}>Edit Product</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.deleteButton,
            deleteMutation.isPending && styles.actionButtonDisabled
          ]}
          onPress={handleDelete}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? (
            <LoadingSpinner size={20} color={Colors.white} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={20} color={Colors.white} />
              <Text style={styles.actionButtonText}>Delete</Text>
            </>
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
  navigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stockInfo: {
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
    padding: 20,
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 60,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sizeChip: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 50,
    alignItems: 'center',
  },
  chipText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoText: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  noteText: {
    flex: 1,
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
    gap: 8,
  },
  metadataLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  editButton: {
    backgroundColor: Colors.primary,
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SellerProductDetailsScreen;