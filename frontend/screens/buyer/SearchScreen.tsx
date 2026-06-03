
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUnifiedSearch, SearchResult, SearchType } from '../../hooks/useSearch';
import { Colors, Typography } from '../../constants/colors';

const { width } = Dimensions.get('window');
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';


const SearchScreen = () => {
  const navigation = useNavigation<any>();
  const [searchText, setSearchText] = useState('');
  const {
    data,
    isLoading,
    isError,
    error,
    search,
    loadMore,
    setType,
    clear,
    hasMore
  } = useUnifiedSearch('', {
    baseUrl: `${BASE_URL}`,
    limit: 20,
    debounceMs: 400
  });

  const [activeFilter, setActiveFilter] = useState<SearchType>('all');

  const handleSearch = (text: string) => {
    setSearchText(text);
    search(text);
  };

  const handleFilterChange = (filter: SearchType) => {
    setActiveFilter(filter);
    setType(filter);
  };


  const handleClear = () => {
    setSearchText('');
    clear();
  };

  const handleProductPress = (item: SearchResult) => {
    if (item.type !== 'product') return;
    
    navigation.navigate('SellerPublicProductDetails', {
      productUrl: item.url,
      storeUrl: item.store?.url || ''
    });
  };

  const handleStorePress = (item: SearchResult) => {
    if (item.type !== 'store') return;
    
    navigation.navigate('SellerPublicStore', {
      storeId: item.id
    });
  };

  const renderSearchFilters = () => (
    <View style={styles.filterContainer}>
      {(['all', 'product', 'store'] as SearchType[]).map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[
            styles.filterButton,
            activeFilter === filter && styles.filterButtonActive
          ]}
          onPress={() => handleFilterChange(filter)}
        >
          <Text
            style={[
              styles.filterText,
              activeFilter === filter && styles.filterTextActive
            ]}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );


  const renderProductItem = (item: SearchResult) => {
    if (item.type !== 'product') return null;

    return (
      <TouchableOpacity style={styles.productCard} onPress={() => handleProductPress(item)}>
        <Image
          source={{ uri: item.images[0] || 'https://via.placeholder.com/100' }}
          style={styles.productImage}
          resizeMode="cover"
        />
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>
          {item.description && (
            <Text style={styles.productDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={styles.productFooter}>
            <Text style={styles.productPrice}>
              ${item.price.toFixed(2)}
            </Text>
            {item.store && (
              <Text style={styles.storeName} numberOfLines={1}>
                {item.store.name}
              </Text>
            )}
          </View>
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {item.tags.slice(0, 3).map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };


  const renderStoreItem = (item: SearchResult) => {
    if (item.type !== 'store') return null;

    return (
      <TouchableOpacity style={styles.storeCard} onPress={() => handleStorePress(item)}>
        {item.logo && (
          <Image
            source={{ uri: item.logo }}
            style={styles.storeLogo}
            resizeMode="contain"
          />
        )}
        <View style={styles.storeInfo}>
          <Text style={styles.storeTitleText} numberOfLines={1}>
            {item.name}
          </Text>
          {item.description && (
            <Text style={styles.storeDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={styles.storeMetaContainer}>
            {item.rating !== null && (
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingText}>⭐ {item.rating.toFixed(1)}</Text>
                <Text style={styles.reviewsText}>
                  ({item.totalReviews} reviews)
                </Text>
              </View>
            )}
            {item.location && (
              <Text style={styles.locationText} numberOfLines={1}>
                📍 {item.location}
              </Text>
            )}
          </View>
          {item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: SearchResult }) => {
    if (item.type === 'product') {
      return renderProductItem(item);
    }
    return renderStoreItem(item);
  };

  const renderEmptyState = () => {
    if (isLoading) return null;

    if (!searchText) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🔍</Text>
          <Text style={styles.emptyStateTitle}>Start Searching</Text>
          <Text style={styles.emptyStateText}>
            Search for products, stores, or anything else
          </Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>⚠️</Text>
          <Text style={styles.emptyStateTitle}>Search Error</Text>
          <Text style={styles.emptyStateText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => search(searchText)}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (data && data.results.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>😔</Text>
          <Text style={styles.emptyStateTitle}>No Results Found</Text>
          <Text style={styles.emptyStateText}>
            Try different keywords or filters
          </Text>
        </View>
      );
    }

    return null;
  };

  const renderFooter = () => {
    if (!isLoading) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products, stores..."
            placeholderTextColor={Colors.textTertiary}
            value={searchText}
            onChangeText={handleSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {renderSearchFilters()}

        {data && data.results.length > 0 && (
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              {data.pagination.total} result{data.pagination.total !== 1 ? 's' : ''}
            </Text>
            {data.cached && (
              <View style={styles.cachedBadge}>
                <Text style={styles.cachedText}>Cached</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <FlatList
        data={data?.results || []}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        onEndReached={() => {
          if (hasMore && !isLoading) {
            loadMore();
          }
        }}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    marginTop: 40
  },
  header: {
    backgroundColor: Colors.white,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.base,
    fontFamily: Typography.regular,
    color: Colors.textPrimary,
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  clearIcon: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: Typography.sm,
    fontFamily: Typography.medium,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.white,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  resultsCount: {
    fontSize: Typography.sm,
    fontFamily: Typography.medium,
    color: Colors.textSecondary,
  },
  cachedBadge: {
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cachedText: {
    fontSize: Typography.xs,
    fontFamily: Typography.medium,
    color: Colors.info,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: Colors.gray100,
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  productDescription: {
    fontSize: Typography.sm,
    fontFamily: Typography.regular,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: Typography.lg,
    fontFamily: Typography.bold,
    color: Colors.primary,
  },
  storeName: {
    fontSize: Typography.xs,
    fontFamily: Typography.medium,
    color: Colors.textTertiary,
    flex: 1,
    marginLeft: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: Typography.xs,
    fontFamily: Typography.medium,
    color: Colors.textSecondary,
  },
  storeCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  storeLogo: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.gray100,
  },
  storeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  storeTitleText: {
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  storeDescription: {
    fontSize: Typography.sm,
    fontFamily: Typography.regular,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  storeMetaContainer: {
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: Typography.sm,
    fontFamily: Typography.medium,
    color: Colors.textPrimary,
    marginRight: 4,
  },
  reviewsText: {
    fontSize: Typography.xs,
    fontFamily: Typography.regular,
    color: Colors.textTertiary,
  },
  locationText: {
    fontSize: Typography.xs,
    fontFamily: Typography.regular,
    color: Colors.textSecondary,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: Typography.xs,
    fontFamily: Typography.medium,
    color: Colors.white,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: Typography.xl,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: Typography.base,
    fontFamily: Typography.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
    color: Colors.white,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default SearchScreen;