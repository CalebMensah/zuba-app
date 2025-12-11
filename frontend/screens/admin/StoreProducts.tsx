// screens/AdminStoreProductsScreen.tsx
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
import { useProduct } from '../../hooks/useProducts';
import { Colors } from '../../constants/colors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

interface AdminStoreProductsScreenProps {
  route: {
    params: {
      storeUrl: string;
      storeName?: string;
    };
  };
  navigation: any;
}

const AdminStoreProductsScreen: React.FC<AdminStoreProductsScreenProps> = ({
  route,
  navigation,
}) => {
  const { storeUrl, storeName } = route.params;
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
    navigation.navigate('AdminProductDetails', {
      productUrl: product.url,
      storeUrl: storeUrl,
    });
  };

  const renderProductCard = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => handleProductPress(item)}
        activeOpacity={0.7}
      >
        {/* Product Image */}
        <View style={styles.imageContainer}>
          {item.images && item.images.length > 0 ? (
            <Image source={{ uri: item.images[0] }} style={styles.productImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
          {item.stock === 0 && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Out of Stock</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>

          {item.category && (
            <Text style={styles.categoryText} numberOfLines={1}>
              {item.category}
            </Text>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.priceText}>GH₵ {item.price.toFixed(2)}</Text>
            {item.stock > 0 && item.stock <= 10 && (
              <Text style={styles.lowStockText}>Only {item.stock} left</Text>
            )}
          </View>

          {/* Stock Status */}
          <View style={styles.stockInfoContainer}>
            <Text style={styles.stockLabel}>Stock:</Text>
            <Text style={[
              styles.stockValue,
              item.stock === 0 && styles.stockValueZero,
              item.stock > 0 && item.stock <= 10 && styles.stockValueLow,
            ]}>
              {item.stock} units
            </Text>
          </View>

          {/* Sales Info */}
          {item.quantityBought > 0 && (
            <View style={styles.salesContainer}>
              <Text style={styles.salesIcon}>📊</Text>
              <Text style={styles.salesText}>
                {item.quantityBought} sold
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Store Info */}
      <View style={styles.storeHeader}>
        <Text style={styles.storeTitle}>{storeName || 'Store Products'}</Text>
        {pagination && (
          <Text style={styles.productCount}>
            {pagination.total} {pagination.total === 1 ? 'Product' : 'Products'}
          </Text>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={Colors.gray400}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sort Options */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sortContainer}
      >
        <TouchableOpacity
          style={[styles.sortBtn, sortBy === 'createdAt' && styles.sortBtnActive]}
          onPress={() => changeSortBy('createdAt')}
        >
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
        >
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
        >
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
        >
          <Text
            style={[
              styles.sortBtnText,
              sortBy === 'quantityBought' && styles.sortBtnTextActive,
            ]}
          >
            Popular
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sortOrderBtn} onPress={toggleSort}>
          <Text style={styles.sortOrderText}>
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📦</Text>
      <Text style={styles.emptyTitle}>No Products Found</Text>
      <Text style={styles.emptyText}>
        {searchQuery
          ? 'Try adjusting your search'
          : 'This store has no products yet'}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

  if (loading && !refreshing && page === 1) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  if (error && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Error Loading Products</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
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
    marginBottom: 8,
  },
  storeHeader: {
    marginBottom: 16,
  },
  storeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  productCount: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  clearIcon: {
    fontSize: 20,
    color: Colors.gray500,
    padding: 4,
  },
  sortContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  sortBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    marginRight: 8,
  },
  sortBtnActive: {
    backgroundColor: Colors.primary,
  },
  sortBtnText: {
    fontSize: 14,
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
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortOrderText: {
    fontSize: 18,
    color: Colors.textPrimary,
  },
  row: {
    paddingHorizontal: 16,
    justifyContent: 'space-between',
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
    backgroundColor: Colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: Colors.gray500,
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
    fontWeight: 'bold',
    color: Colors.white,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
    lineHeight: 18,
  },
  categoryText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  lowStockText: {
    fontSize: 10,
    color: Colors.accent,
    fontWeight: '600',
  },
  stockInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stockLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginRight: 6,
  },
  stockValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  stockValueZero: {
    color: Colors.error,
  },
  stockValueLow: {
    color: Colors.accent,
  },
  salesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
  },
  salesIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  salesText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default AdminStoreProductsScreen;