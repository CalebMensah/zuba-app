// screens/MarketplaceScreen.tsx
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
  Modal,
  Alert,
} from 'react-native';
import { useProduct } from '../../hooks/useProducts';
import { useCart } from '../../context/CartContext';
import { Colors } from '../../constants/colors';
import Feather from '@expo/vector-icons/Feather';
import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import EvilIcons from '@expo/vector-icons/EvilIcons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const CATEGORIES = [
  'All',
  'Electronics',
  'Fashion & Clothing',
  'Home & Garden',
  'Health & Beauty',
  'Sports & Outdoors',
  'Toys & Games',
  'Books & Media',
  'Food & Beverages',
  'Automotive',
  'Jewelry & Accessories',
  'Art & Crafts',
  'Pet Supplies',
  'Office Supplies',
  'Baby & Kids',
  'Other',
];

interface MarketplaceScreenProps {
  navigation: any;
}

const MarketplaceScreen: React.FC<MarketplaceScreenProps> = ({ navigation }) => {
  const { getAllProducts, products, pagination, loading, error } = useProduct();
  const { addItem } = useCart();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'createdAt' | 'price' | 'name' | 'quantityBought' | 'viewCount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
   const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [addingToCart, setAddingToCart] = useState(false);
    const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchProducts();
  }, [searchQuery, selectedCategory, sortBy, sortOrder, page]);

  const fetchProducts = async () => {
    const filters: any = {
      page,
      limit: 10,
      search: searchQuery,
      category: selectedCategory !== 'All' ? selectedCategory : undefined,
      sortBy,
      sortOrder,
    };

    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
    if (selectedTags.length > 0) filters.tags = selectedTags;
    if (selectedSizes.length > 0) filters.sizes = selectedSizes;
    if (selectedColors.length > 0) filters.color = selectedColors;

    await getAllProducts(filters);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await fetchProducts();
    setRefreshing(false);
  }, [searchQuery, selectedCategory, sortBy, sortOrder, minPrice, maxPrice]);

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

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
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
    navigation.navigate('SellerPublicProductDetails', {
      productUrl: product.url,
      storeUrl: product.store?.url,
    });
  };

  const handleAddToCart = async (product: any) => {
    if (!product) return;

    // Validate size selection if sizes exist
    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      Alert.alert('Select Size', 'Please select a size before adding to cart.');
      return;
    }

    // Validate color selection if colors exist
    if (product.color && product.color.length > 0 && !selectedColor) {
      Alert.alert('Select Color', 'Please select a color before adding to cart.');
      return;
    }

    setAddingToCart(true);
    try {
      await addItem(product.id, quantity);
      Alert.alert(
        'Success',
        `${product.name} has been added to your cart!`,
        [
          { text: 'Continue Shopping', style: 'cancel' },
          {
            text: 'View Cart',
            onPress: () => navigation.navigate('CartScreen'),
          },
        ]
      );
    } catch (err) {
      console.error('Error adding to cart:', err);
      Alert.alert('Error', 'Failed to add item to cart. Please try again.');
    } finally {
      setAddingToCart(false);
    }
  };

  const applyFilters = () => {
    setShowFilters(false);
    setPage(1);
    fetchProducts();
  };

  const clearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setSelectedTags([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setShowFilters(false);
    setPage(1);
    fetchProducts();
  };

  const renderProductCard = ({ item }: { item: any }) => (
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

        {item.store && (
          <Text style={styles.storeName} numberOfLines={1}>
            By {item.store.name}
          </Text>
        )}

        {item.category && (
          <Text style={styles.categoryText} numberOfLines={1}>
            {item.category}
          </Text>
        )}

        <View style={styles.priceRow}>
          <Text style={styles.priceText}>GH₵ {item.price.toFixed(2)}</Text>
          {item.stock > 0 && item.stock <= 10 && (
            <Text style={styles.lowStockText}>{item.stock} left</Text>
          )}
        </View>

        {/* Add to Cart Button */}
        <TouchableOpacity
          style={[
            styles.addToCartBtn,
            item.stock === 0 && styles.addToCartBtnDisabled,
          ]}
          onPress={() => handleAddToCart(item)}
          disabled={item.stock === 0}
        >
          <Text style={styles.addToCartText}>
            {item.stock === 0 ? 'Out of Stock' : '🛒 Add'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
            {/* Title and Results Count */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>Marketplace</Text>
        {pagination && (
          <Text style={styles.resultCount}>
            {pagination.total} {pagination.total === 1 ? 'Product' : 'Products'}
          </Text>
        )}
      </View>

      {/* Top Bar with Search and Icons */}
      <View style={styles.topBar}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}><Feather name="search" size={24} color="black" /></Text>
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

        <View style={styles.iconRow}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('LikedProducts')}
          >
            <Text style={styles.iconText}><AntDesign name="heart" size={24} color="#EF4444" /></Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.iconText}><FontAwesome name="bell" size={24} color="#3B82F6" /></Text>
          </TouchableOpacity>
        </View>
      </View>



      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
      >
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryBtn,
              selectedCategory === category && styles.categoryBtnActive,
            ]}
            onPress={() => handleCategorySelect(category)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextActive,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort and Filter Bar */}
      <View style={styles.controlBar}>
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

          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'viewCount' && styles.sortBtnActive]}
            onPress={() => changeSortBy('viewCount')}
          >
            <Text
              style={[
                styles.sortBtnText,
                sortBy === 'viewCount' && styles.sortBtnTextActive,
              ]}
            >
              Most Viewed
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sortOrderBtn} onPress={toggleSort}>
            <Text style={styles.sortOrderText}>
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setShowFilters(true)}
        >
          <Text style={styles.filterBtnText}><EvilIcons name="gear" size={24} color="white" /> Filters</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🛍️</Text>
      <Text style={styles.emptyTitle}>No Products Found</Text>
      <Text style={styles.emptyText}>
        {searchQuery
          ? 'Try different keywords or filters'
          : 'Check back later for new products'}
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

  const renderFiltersModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            {/* Price Range */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Price Range</Text>
              <View style={styles.priceRow}>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Min"
                  placeholderTextColor={Colors.gray400}
                  value={minPrice}
                  onChangeText={setMinPrice}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.priceSeparator}>—</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Max"
                  placeholderTextColor={Colors.gray400}
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.clearFiltersBtn}
              onPress={clearFilters}
            >
              <Text style={styles.clearFiltersBtnText}>Clear All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.applyFiltersBtn}
              onPress={applyFilters}
            >
              <Text style={styles.applyFiltersBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading && !refreshing && page === 1) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading marketplace...</Text>
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

      {renderFiltersModal()}
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
    paddingBottom: 12,
    marginBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
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
  iconRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 32,
    marginBottom: 12,
    backgroundColor: Colors.white,
    padding:14,
    borderTopLeftRadius:6,
    borderTopRightRadius:6,
    height:80,
    shadowColor: Colors.black,
    borderColor: Colors.overlay,
    borderWidth: 0.1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  resultCount: {
    fontSize: 14,
    color: Colors.primaryLight,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    marginRight: 8,
  },
  categoryBtnActive: {
    backgroundColor: Colors.primary,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryTextActive: {
    color: Colors.white,
  },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  sortContainer: {
    flex: 1,
  },
  sortBtn: {
    paddingHorizontal: 12,
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
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sortOrderText: {
    fontSize: 18,
    color: Colors.textPrimary,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
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
    marginBottom: 2,
    lineHeight: 18,
  },
  storeName: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  lowStockText: {
    fontSize: 10,
    color: Colors.accent,
    fontWeight: '600',
  },
  addToCartBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  addToCartBtnDisabled: {
    backgroundColor: Colors.gray300,
  },
  addToCartText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
  modalClose: {
    fontSize: 28,
    color: Colors.gray500,
  },
  modalScroll: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  priceInput: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  priceSeparator: {
    marginHorizontal: 12,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  clearFiltersBtn: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearFiltersBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  applyFiltersBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyFiltersBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default MarketplaceScreen;