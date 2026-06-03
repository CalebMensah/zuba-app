import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  RefreshControl,
  TextInput,
  StyleSheet,
  Dimensions,
  FlatList,
  Modal,
  StatusBar,
} from 'react-native';
import { useAllProducts } from '../../hooks/useProducts';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Colors, Typography } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { LoadingSpinner } from '../../components/LoadingSpinner';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const CATEGORY_CHIP_WIDTH = 110;
const CATEGORY_CHIP_HEIGHT = 88;
const BANNER_WIDTH = width - 40;

const CATEGORIES = [
  { name: 'Phones & Electronics', image: require('../../assets/categories/electronics.webp') },
  { name: 'Fashion', image: require('../../assets/categories/fashion.jpg') },
  { name: 'Beauty', image: require('../../assets/categories/beauty.jpg') },
  { name: 'Home & Furniture', image: require('../../assets/categories/home.jpg') },
  { name: 'Shoes & Bags', image: require('../../assets/categories/shoes.jpeg') },
  { name: 'Health & Fitness', image: require('../../assets/categories/health.jpg') },
  { name: 'Food & Groceries', image: require('../../assets/categories/food.jpg') },
  { name: 'Baby & Kids', image: require('../../assets/categories/baby.webp') },
  { name: 'Automobiles', image: require('../../assets/categories/automobile.jpg') },
  { name: 'Sports', image: require('../../assets/categories/sports.jpg') },
  { name: 'Jewelry & Watches', image: require('../../assets/categories/jeweries.jpg') },
  { name: 'Services', image: require('../../assets/categories/services.jpg') },
];

const BANNERS = [
  require('../../assets/banners/banner1.png'),
  require('../../assets/banners/banner2.png'),
  require('../../assets/banners/banner3.png'),
];

interface MarketplaceScreenProps {
  navigation: any;
}

const MarketplaceScreen: React.FC<MarketplaceScreenProps> = ({ navigation }) => {
  const { addItem } = useCart();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'createdAt' | 'price' | 'name' | 'quantityBought' | 'viewCount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [activeBanner, setActiveBanner] = useState(0);

  // FIX: Use FlatList ref instead of ScrollView ref
  const bannerFlatListRef = useRef<FlatList>(null);
  const bannerTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const filters: any = {
    page,
    limit: 10,
    search: searchQuery || undefined,
    category: selectedCategory !== 'All' ? selectedCategory : undefined,
    sortBy,
    sortOrder,
  };

  if (minPrice) filters.minPrice = parseFloat(minPrice);
  if (maxPrice) filters.maxPrice = parseFloat(maxPrice);

  const {
    data: productData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useAllProducts(filters);

  const products = productData?.products || [];
  const pagination = productData?.pagination;

  // FIX: Use scrollToIndex instead of scrollTo — works cleanly with FlatList pagingEnabled
  useEffect(() => {
    bannerTimer.current = setInterval(() => {
      setActiveBanner(prev => {
        const next = (prev + 1) % BANNERS.length;
        bannerFlatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5000);

    return () => {
      if (bannerTimer.current) clearInterval(bannerTimer.current);
    };
  }, []);

  const handleSearch = useCallback(() => {
    navigation.navigate('SearchScreen');
  }, [navigation]);

  const handleCategorySelect = useCallback((category: string) => {
    setSelectedCategory(category);
    setPage(1);
  }, []);

  const toggleSort = useCallback(() => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    setPage(1);
  }, []);

  const changeSortBy = useCallback((newSortBy: typeof sortBy) => {
    setSortBy(newSortBy);
    setPage(1);
  }, []);

  const handleProductPress = useCallback((product: any) => {
    navigation.navigate('SellerPublicProductDetails', {
      productUrl: product.url,
      storeUrl: product.store?.url,
    });
  }, [navigation]);

  const applyFilters = useCallback(() => {
    setShowFilters(false);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setMinPrice('');
    setMaxPrice('');
    setShowFilters(false);
    setPage(1);
  }, []);

  const loadMore = useCallback(() => {
    if (pagination && page < pagination.pages && !isFetching) {
      setPage(prev => prev + 1);
    }
  }, [pagination, page, isFetching]);

  const renderProductCard = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => handleProductPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {item.images && item.images.length > 0 ? (
          <Image
            source={{ uri: item.images[0] }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={40} color={Colors.gray400} />
          </View>
        )}

        {item.stock === 0 && (
          <View style={styles.outOfStockBadge}>
            <Text style={styles.badgeText}>Out of Stock</Text>
          </View>
        )}

        {item.stock > 0 && item.stock <= 10 && (
          <View style={styles.lowStockBadge}>
            <Text style={styles.badgeText}>{item.stock} left</Text>
          </View>
        )}
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>

        {item.store && (
          <View style={styles.storeRow}>
            <Ionicons name="storefront-outline" size={12} color={Colors.gray500} />
            <Text style={styles.storeName} numberOfLines={1}>
              {item.store.name}
            </Text>
          </View>
        )}

        <View style={styles.bottomRow}>
          <Text style={styles.priceText}>GH₵{item.price.toFixed(2)}</Text>
          {item.quantityBought > 0 && (
            <Text style={styles.soldText}>{item.quantityBought} sold</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  ), [handleProductPress]);

  const renderCategoryChip = useCallback((category: typeof CATEGORIES[0]) => {
    const isActive = selectedCategory === category.name;

    return (
      <TouchableOpacity
        key={category.name}
        style={styles.categoryChipWrapper}
        onPress={() => handleCategorySelect(category.name)}
        activeOpacity={0.85}
      >
        <ImageBackground
          source={category.image}
          style={styles.categoryChip}
          imageStyle={styles.categoryChipImage}
          resizeMode="cover"
        >
          <View style={[styles.categoryOverlay, isActive && styles.categoryOverlayActive]} />
          {isActive && <View style={styles.categoryActiveBorder} />}
          <Text style={styles.categoryChipText} numberOfLines={2}>
            {category.name}
          </Text>
        </ImageBackground>
      </TouchableOpacity>
    );
  }, [selectedCategory, handleCategorySelect]);

  // FIX: Banner rendered via FlatList — no pagingEnabled + scrollTo conflict
  const renderBannerItem = useCallback(({ item }: { item: any }) => (
    <Image
      source={item}
      style={styles.bannerImage}
      resizeMode="cover"
    />
  ), []);

  const bannerKeyExtractor = useCallback((_: any, index: number) => String(index), []);

  // FIX: getItemLayout is required for scrollToIndex to work reliably
  const getBannerItemLayout = useCallback((_: any, index: number) => ({
    length: BANNER_WIDTH,
    offset: BANNER_WIDTH * index,
    index,
  }), []);

  // FIX: useCallback with all dependencies so FlatList gets a stable header reference
  // This prevents the header from unmounting/remounting on every activeBanner tick,
  // which is what was causing the category ScrollView to reset its scroll position.
  const renderHeader = useCallback(() => (
    <View style={styles.headerContainer}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Search */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={20} color={Colors.gray400} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={Colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => navigation.navigate('SearchScreen')}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={Colors.gray400} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.goButton} onPress={handleSearch}>
            <Text style={styles.goButtonText}>Go</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.notificationBtn}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* FIX: Banner now uses FlatList instead of ScrollView
          - No pagingEnabled conflict with manual scrollTo
          - scrollToIndex is purpose-built for FlatList
          - scrollEnabled={false} prevents user swipe from fighting the timer */}
      <View style={styles.bannerContainer}>
        <FlatList
          ref={bannerFlatListRef}
          data={BANNERS}
          renderItem={renderBannerItem}
          keyExtractor={bannerKeyExtractor}
          getItemLayout={getBannerItemLayout}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={0}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / BANNER_WIDTH);
            setActiveBanner(index);
          }}
        />

        {/* Dot indicators */}
        <View style={styles.bannerDots}>
          {BANNERS.map((_, index) => (
            <View
              key={index}
              style={[styles.bannerDot, activeBanner === index && styles.bannerDotActive]}
            />
          ))}
        </View>
      </View>

      {/* Categories */}
      <View style={styles.categoriesSection}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          <TouchableOpacity
            style={[styles.allChip, selectedCategory === 'All' && styles.allChipActive]}
            onPress={() => handleCategorySelect('All')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="grid-outline"
              size={20}
              color={selectedCategory === 'All' ? Colors.white : Colors.primary}
            />
            <Text style={[styles.allChipText, selectedCategory === 'All' && styles.allChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          {CATEGORIES.map(category => renderCategoryChip(category))}
        </ScrollView>
      </View>

      {/* Sort & Filters */}
      <View style={styles.filtersSection}>
        <Text style={styles.sectionTitle}>Sort & Filter</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          <TouchableOpacity
            style={[styles.filterChip, sortBy === 'createdAt' && styles.filterChipActive]}
            onPress={() => changeSortBy('createdAt')}
          >
            <Ionicons
              name="time-outline"
              size={16}
              color={sortBy === 'createdAt' ? Colors.white : Colors.textSecondary}
            />
            <Text style={[styles.filterChipText, sortBy === 'createdAt' && styles.filterChipTextActive]}>
              Latest
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, sortBy === 'price' && styles.filterChipActive]}
            onPress={() => changeSortBy('price')}
          >
            <Ionicons
              name="pricetag-outline"
              size={16}
              color={sortBy === 'price' ? Colors.white : Colors.textSecondary}
            />
            <Text style={[styles.filterChipText, sortBy === 'price' && styles.filterChipTextActive]}>
              Price
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, sortBy === 'quantityBought' && styles.filterChipActive]}
            onPress={() => changeSortBy('quantityBought')}
          >
            <Ionicons
              name="trending-up-outline"
              size={16}
              color={sortBy === 'quantityBought' ? Colors.white : Colors.textSecondary}
            />
            <Text style={[styles.filterChipText, sortBy === 'quantityBought' && styles.filterChipTextActive]}>
              Popular
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, sortBy === 'viewCount' && styles.filterChipActive]}
            onPress={() => changeSortBy('viewCount')}
          >
            <Ionicons
              name="eye-outline"
              size={16}
              color={sortBy === 'viewCount' ? Colors.white : Colors.textSecondary}
            />
            <Text style={[styles.filterChipText, sortBy === 'viewCount' && styles.filterChipTextActive]}>
              Views
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sortOrderChip} onPress={toggleSort}>
            <Ionicons
              name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
              size={16}
              color={Colors.textPrimary}
            />
            <Text style={styles.sortOrderText}>
              {sortOrder === 'asc' ? 'Low-High' : 'High-Low'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.priceFilterBtn}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="options-outline" size={16} color={Colors.primary} />
            <Text style={styles.priceFilterText}>Price Range</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Results count */}
      {pagination && (
        <View style={styles.resultsSection}>
          <Text style={styles.resultsText}>
            {pagination.total} {pagination.total === 1 ? 'Product' : 'Products'} Found
          </Text>
        </View>
      )}
    </View>
  ), [
    searchQuery,
    selectedCategory,
    sortBy,
    sortOrder,
    activeBanner,
    pagination,
    minPrice,
    maxPrice,
    handleSearch,
    handleCategorySelect,
    changeSortBy,
    toggleSort,
    renderCategoryChip,
    renderBannerItem,
    bannerKeyExtractor,
    getBannerItemLayout,
    navigation,
  ]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={80} color={Colors.gray300} />
      <Text style={styles.emptyTitle}>No Products Found</Text>
      <Text style={styles.emptyText}>
        {searchQuery
          ? 'Try different keywords or adjust your filters'
          : 'Check back soon for new arrivals'}
      </Text>
      {searchQuery && (
        <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearchQuery('')}>
          <Text style={styles.clearSearchText}>Clear Search</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [searchQuery]);

  const renderFooter = useCallback(() => {
    if (!isFetching || page === 1) return null;
    return (
      <View style={styles.footerLoader}>
        <LoadingSpinner size={20} color={Colors.primary} />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  }, [isFetching, page]);

  const renderFiltersModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Price Range</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.priceInputRow}>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.currencyLabel}>GH₵</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Min"
                  placeholderTextColor={Colors.gray400}
                  value={minPrice}
                  onChangeText={setMinPrice}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.priceSeparator}>
                <View style={styles.separatorLine} />
              </View>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.currencyLabel}>GH₵</Text>
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
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters}>
              <Text style={styles.clearFiltersBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyFiltersBtn} onPress={applyFilters}>
              <Text style={styles.applyFiltersBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (isLoading && !productData) {
    return (
      <View style={styles.centerContainer}>
        <LoadingSpinner size={40} color={Colors.primary} />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
        <Text style={styles.errorText}>{error.message}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Ionicons name="refresh" size={20} color={Colors.white} />
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        renderItem={renderProductCard}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !!productData}
            onRefresh={refetch}
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
    backgroundColor: Colors.background,
    marginTop: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
    fontFamily: Typography.regular,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Typography.semiBold,
  },
  listContent: {
    paddingBottom: 20,
  },
  headerContainer: {
    backgroundColor: Colors.background,
    paddingTop: 12,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    fontFamily: Typography.regular,
  },
  goButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  goButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Typography.semiBold,
  },
  notificationBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Banner ──────────────────────────────────────────────────────────────────
  bannerContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  bannerImage: {
    width: BANNER_WIDTH,
    height: 160,
  },
  bannerDots: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  bannerDotActive: {
    width: 18,
    backgroundColor: Colors.white,
  },

  // ── Categories ──────────────────────────────────────────────────────────────
  categoriesSection: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 10,
    alignItems: 'center',
  },
  allChip: {
    width: CATEGORY_CHIP_WIDTH,
    height: CATEGORY_CHIP_HEIGHT,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  allChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  allChipText: {
    fontSize: 12,
    fontFamily: Typography.semiBold,
    color: Colors.primary,
  },
  allChipTextActive: {
    color: Colors.white,
  },
  categoryChipWrapper: {
    width: CATEGORY_CHIP_WIDTH,
    height: CATEGORY_CHIP_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  categoryChip: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    padding: 8,
  },
  categoryChipImage: {
    borderRadius: 16,
  },
  categoryOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    borderRadius: 16,
  },
  categoryOverlayActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  categoryActiveBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: 11,
    fontFamily: Typography.semiBold,
    color: Colors.white,
    lineHeight: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ── Sort / Filters ──────────────────────────────────────────────────────────
  filtersSection: {
    paddingBottom: 16,
  },
  filtersScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: Typography.medium,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  sortOrderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortOrderText: {
    fontSize: 13,
    fontFamily: Typography.medium,
    color: Colors.textPrimary,
  },
  priceFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  priceFilterText: {
    fontSize: 13,
    fontFamily: Typography.medium,
    color: Colors.primary,
  },
  resultsSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  resultsText: {
    fontSize: 14,
    fontFamily: Typography.medium,
    color: Colors.textSecondary,
  },

  // ── Product Cards ───────────────────────────────────────────────────────────
  row: {
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.gray50,
  },
  productImage: {
    width: '100%',
    height: '100%',
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
    top: 10,
    left: 10,
    backgroundColor: Colors.error,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lowStockBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Typography.bold,
    color: Colors.white,
    textTransform: 'uppercase',
  },
  productInfo: {
    padding: 14,
  },
  productName: {
    fontSize: 14,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
    marginBottom: 6,
    lineHeight: 20,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  storeName: {
    fontSize: 11,
    color: Colors.gray500,
    fontFamily: Typography.medium,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 16,
    fontFamily: Typography.bold,
    color: Colors.primary,
  },
  soldText: {
    fontSize: 11,
    color: Colors.gray500,
    fontFamily: Typography.medium,
  },

  // ── Empty / Footer ──────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: Typography.regular,
  },
  clearSearchBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  clearSearchText: {
    fontSize: 14,
    fontFamily: Typography.semiBold,
    color: Colors.white,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  loadingMoreText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
  },

  // ── Modal ───────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '50%',
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
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
  },
  modalBody: {
    padding: 20,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  currencyLabel: {
    fontSize: 16,
    fontFamily: Typography.semiBold,
    color: Colors.textSecondary,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    fontFamily: Typography.semiBold,
  },
  priceSeparator: {
    width: 24,
    alignItems: 'center',
  },
  separatorLine: {
    width: 16,
    height: 2,
    backgroundColor: Colors.gray300,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
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
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
  },
  applyFiltersBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyFiltersBtnText: {
    fontSize: 16,
    fontFamily: Typography.semiBold,
    color: Colors.white,
  },
});

export default MarketplaceScreen;