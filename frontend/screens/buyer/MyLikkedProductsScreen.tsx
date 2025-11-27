// screens/buyer/MyLikedProductsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useProductLike } from '../../hooks/useProductLikes';
import { useCart } from '../../context/CartContext';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images: string[];
  category?: string;
  url: string;
  isActive: boolean;
  store?: {
    id: string;
    name: string;
    url: string;
  };
}

const MyLikedProductsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { getMyLikedProducts, unlikeProduct, loading: likeLoading } = useProductLike();
  const { addItem, loading: cartLoading } = useCart();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  const fetchLikedProducts = useCallback(async () => {
    try {
      setLoading(true);
      const likedProducts = await getMyLikedProducts();
      setProducts(likedProducts);
    } catch (error) {
      console.error('Error fetching liked products:', error);
      Alert.alert('Error', 'Failed to load your liked products');
    } finally {
      setLoading(false);
    }
  }, [getMyLikedProducts]);

  useEffect(() => {
    fetchLikedProducts();
  }, [fetchLikedProducts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLikedProducts();
    setRefreshing(false);
  }, [fetchLikedProducts]);

  const handleUnlike = async (productId: string) => {
    try {
      await unlikeProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      Alert.alert('Success', 'Product removed from favorites');
    } catch (error) {
      Alert.alert('Error', 'Failed to remove product from favorites');
    }
  };

  const handleAddToCart = async (productId: string, productName: string) => {
    try {
      setAddingToCart(productId);
      await addItem(productId, 1);
      Alert.alert('Success', `${productName} added to cart!`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add item to cart');
    } finally {
      setAddingToCart(null);
    }
  };

  const handleViewDetails = (product: Product) => {
    navigation.navigate('SellerPublicProductDetails', {
      productUrl: product.url,
      storeUrl: product.store?.url || '',
    });
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="heart-outline" size={80} color={Colors.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>No Liked Products Yet</Text>
      <Text style={styles.emptySubtitle}>
        Start exploring and save your favorite products here
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.navigate('BuyerHome')}
        activeOpacity={0.8}
      >
        <Text style={styles.exploreButtonText}>Explore Products</Text>
        <Ionicons name="arrow-forward" size={20} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );

  const renderProduct = ({ item }: { item: Product }) => {
    const isAddingThisProduct = addingToCart === item.id;
    const productImage = item.images && item.images.length > 0 
      ? item.images[0] 
      : 'https://via.placeholder.com/300';

    return (
      <View style={styles.productCard}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: productImage }}
            style={styles.productImage}
            resizeMode="cover"
          />
          
          {/* Unlike Button */}
          <TouchableOpacity
            style={styles.unlikeButton}
            onPress={() => handleUnlike(item.id)}
            activeOpacity={0.8}
          >
            <Ionicons name="heart" size={24} color={Colors.accent} />
          </TouchableOpacity>

          {/* Stock Badge */}
          {item.stock < 10 && (
            <View style={styles.stockBadge}>
              <Text style={styles.stockBadgeText}>
                {item.stock === 0 ? 'Out of Stock' : `Only ${item.stock} left`}
              </Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>
          
          {item.store && (
            <View style={styles.storeInfo}>
              <Ionicons name="storefront-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.storeName} numberOfLines={1}>
                {item.store.name}
              </Text>
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price}>GH₵ {item.price.toFixed(2)}</Text>
            {item.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.viewDetailsButton}
              onPress={() => handleViewDetails(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="eye-outline" size={18} color={Colors.primary} />
              <Text style={styles.viewDetailsText}>View Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.addToCartButton,
                (item.stock === 0 || isAddingThisProduct) && styles.addToCartButtonDisabled,
              ]}
              onPress={() => handleAddToCart(item.id, item.name)}
              disabled={item.stock === 0 || isAddingThisProduct}
              activeOpacity={0.8}
            >
              {isAddingThisProduct ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="cart-outline" size={18} color={Colors.white} />
                  <Text style={styles.addToCartText}>Add to Cart</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your favorites...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Favorites</Text>
        <View style={styles.headerRight}>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{products.length}</Text>
          </View>
        </View>
      </View>

      {/* Products List */}
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.listContent,
          products.length === 0 && styles.emptyListContent,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      />
    </View>
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
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  countBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flex: 1,
  },
  row: {
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exploreButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  productCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 6,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  unlikeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  stockBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
    lineHeight: 20,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  storeName: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  categoryBadge: {
    backgroundColor: Colors.primaryLight + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  viewDetailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addToCartButtonDisabled: {
    opacity: 0.5,
  },
  addToCartText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
});

export default MyLikedProductsScreen;