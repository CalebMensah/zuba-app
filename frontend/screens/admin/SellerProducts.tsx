// screens/admin/AdminSellerProductsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  StyleSheet,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useProduct } from '../../hooks/useProducts';
import { Colors } from '../../constants/colors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

interface AdminSellerProductsScreenProps {
  route: {
    params: {
      storeUrl: string;
      storeName?: string;
      storeId?: string;
    };
  };
  navigation: any;
}

const AdminSellerProductsScreen: React.FC<AdminSellerProductsScreenProps> = ({
  route,
  navigation,
}) => {
  const { storeUrl, storeName, storeId } = route.params;
  const { getStoreProducts, products, pagination, loading, error } = useProduct();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'price' | 'name' | 'quantityBought'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [storeUrl, searchQuery, selectedCategory, sortBy, sortOrder, page]);

  const fetchProducts = async () => {
    const filters = {
      page,
      limit: 10,
      search: searchQuery,
      category: selectedCategory,
      sortBy,
      sortOrder,
    };

    await getStoreProducts(storeUrl, filters);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await fetchProducts();
    setRefreshing(false);
  }, [storeUrl, searchQuery, selectedCategory, sortBy, sortOrder]);

  const loadMore = () => {
    if (pagination && page < pagination.pages && !loadingMore) {
      setLoadingMore(true);
      setPage(page + 1);
      setLoadingMore(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setPage(1);
  };

  const toggleSort = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    setPage(1);
  };

  const changeSortBy = (newSortBy: typeof sortBy) => {
    setSortBy(newSortBy);
    setPage(1);
  };

  const handleProductPress = (product: any) => {
    navigation.navigate('ProductDetails', {
      productUrl: product.url,
    });
  };

  const renderProductCard = ({ item }: { item: any }) => {
    return (
      <View style={styles.productCard}>
        {/* Product Image */}
        <TouchableOpacity
          style={styles.imageContainer}
          onPress={() => handleProductPress(item)}
          activeOpacity={0.8}
        >
          {item.images && item.images.length > 0 ? (
            <Image source={{ uri: item.images[0] }} style={styles.productImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="cube-outline" size={48} color={Colors.gray400} />
            </View>
          )}
          
          {/* Stock Badge */}
          {item.stock === 0 ? (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Out of Stock</Text>
            </View>
          ) : item.stock <= 10 && (
            <View style={styles.lowStockBadge}>
              <Text style={styles.lowStockText}>Low Stock</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>

          {item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText} numberOfLines={1}>
                {item.category}
              </Text>
            </View>
          )}

          <View style={styles.priceStockRow}>
            <Text style={styles.priceText}>GH₵ {item.price.toFixed(2)}</Text>
            <View style={styles.stockInfo}>
              <Ionicons name="cube" size={12} color={Colors.textSecondary} />
              <Text style={styles.stockText}>{item.stock}</Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="eye" size={12} color={Colors.textSecondary} />
              <Text style={styles.statText}>{item.viewCount || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="cart" size={12} color={Colors.textSecondary} />
              <Text style={styles.statText}>{item.quantityBought || 0}</Text>
            </View>
          </View>

          {/* View Details Button */}
          <TouchableOpacity
            style={styles.viewDetailsBtn}
            onPress={() => handleProductPress(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="eye" size={16} color={Colors.white} />
            <Text style={styles.viewDetailsText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Store Info */}
      <View style={styles.storeHeader}>
        <View style={styles.storeTitleRow}>
          <Ionicons name="storefront" size={24} color={Colors.primary} />
          <Text style={styles.storeTitle}>{storeName || 'Store Products'}</Text>
        </View>
        {pagination && (
          <View style={styles.productCountBadge}>
            <Ionicons name="cube" size={14} color={Colors.primary} />
            <Text style={styles.productCount}>
              {pagination.total} {pagination.total === 1 ? 'Product' : 'Products'}
            </Text>
          </View>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={Colors.gray400}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={20} color={Colors.gray500} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sort Options */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sortContainer}
        contentContainerStyle={styles.sortContent}
      >
        <TouchableOpacity
          style={[styles.sortBtn, sortBy === 'createdAt' && styles.sortBtnActive]}
          onPress={() => changeSortBy('createdAt')}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="time" 
            size={16} 
            color={sortBy === 'createdAt' ? Colors.white : Colors.textSecondary} 
          />
          <Text
            style={[
              styles.sortBtnText,
              sortBy === 'createdAt' && styles.sortBtnTextActive,
            ]}
          >
            Latest
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sortBtn, sortBy === 'price' && styles.sortBtnActive]}
          onPress={() => changeSortBy('price')}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="cash" 
            size={16} 
            color={sortBy === 'price' ? Colors.white : Colors.textSecondary} 
          />
          <Text
            style={[
              styles.sortBtnText,
              sortBy === 'price' && styles.sortBtnTextActive,
            ]}
          >
            Price
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sortBtn, sortBy === 'name' && styles.sortBtnActive]}
          onPress={() => changeSortBy('name')}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="text" 
            size={16} 
            color={sortBy === 'name' ? Colors.white : Colors.textSecondary} 
          />
          <Text
            style={[
              styles.sortBtnText,
              sortBy === 'name' && styles.sortBtnTextActive,
            ]}
          >
            Name
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sortBtn, sortBy === 'quantityBought' && styles.sortBtnActive]}
          onPress={() => changeSortBy('quantityBought')}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="trending-up" 
            size={16} 
            color={sortBy === 'quantityBought' ? Colors.white : Colors.textSecondary} 
          />
          <Text
            style={[
              styles.sortBtnText,
              sortBy === 'quantityBought' && styles.sortBtnTextActive,
            ]}
          >
            Popular
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.sortOrderBtn} 
          onPress={toggleSort}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
            size={20} 
            color={Colors.primary} 
          />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cube-outline" size={64} color={Colors.gray300} />
      <Text style={styles.emptyTitle}>No Products Found</Text>
      <Text style={styles.emptyText}>
        {searchQuery
          ? 'Try adjusting your search filters'
          : 'This store has no products yet'}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.footerLoaderText}>Loading more...</Text>
      </View>
    );
  };

  if (loading && !refreshing && page === 1) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Store Products</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Store Products</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={styles.errorTitle}>Error Loading Products</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={20} color={Colors.white} />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Store Products</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <FlatList
        data={products}
        renderItem={renderProductCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerPlaceholder: {
    width: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  headerContainer: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    marginBottom: 12,
  },
  storeHeader: {
    marginBottom: 16,
  },
  storeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  storeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  productCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  productCount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  sortContainer: {
    flexDirection: 'row',
  },
  sortContent: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    marginRight: 8,
  },
  sortBtnActive: {
    backgroundColor: Colors.primary,
  },
  sortBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  sortBtnTextActive: {
    color: Colors.white,
  },
  sortOrderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.infoLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.gray100,
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  outOfStockText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  lowStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  lowStockText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
    lineHeight: 18,
    minHeight: 36,
  },
  categoryBadge: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  priceStockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
  },
  viewDetailsText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  footerLoaderText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});

export default AdminSellerProductsScreen;