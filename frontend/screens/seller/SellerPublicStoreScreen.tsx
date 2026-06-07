import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Share,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../context/StoreContext';
import { useStoreProducts } from '../../hooks/useProducts';

import { useStoreFollowing } from '../../hooks/useStoreFollowings';
import { useReviews } from '../../hooks/useReview';
import { Colors, Typography } from '../../constants/colors';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width } = Dimensions.get('window');
const PRODUCT_CARD_WIDTH = (width - 48) / 2;

interface SellerPublicStoreProps {
  navigation: any;
  route: any;
}

export default function SellerPublicStoreScreen({
  navigation,
  route,
}: SellerPublicStoreProps) {
  const { storeId } = route.params || {};
  const { store, loading, error, getStoreById, clearStore } = useStore();

  const {
    data: storeProductsResponse,
    isLoading: productsLoading,
    error: productsError,
  } = useStoreProducts(store?.url ?? '', { page: 1, limit: 10 });

  const products = storeProductsResponse?.products ?? [];

  const {
    loading: followLoading,
    followStore,
    unfollowStore,
    checkIfFollowing,
    getStoreFollowerCount,
  } = useStoreFollowing();
  const { loading: reviewsLoading, getPublicStoreReviews } = useReviews();

  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [storeReviews, setStoreReviews] = useState<any[]>([]);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (storeId) {
      fetchStoreData();
    }

    return () => {
      clearStore();
    };
  }, [storeId]);

  const fetchStoreData = async () => {
    if (storeId) {
      const storeData = await getStoreById(storeId);
      if (storeData?.url) {
          await Promise.all([
          fetchFollowStatus(storeData.url),
          fetchFollowerCount(storeData.url),
          fetchStoreReviews(),
        ]);

      }
    }
  };

  const fetchFollowStatus = async (storeUrl: string) => {
    try {
      const status = await checkIfFollowing(storeUrl);
      setIsFollowing(status);
    } catch (err) {
      console.error('Error checking follow status:', err);
    }
  };

  const fetchFollowerCount = async (storeUrl: string) => {
    try {
      const count = await getStoreFollowerCount(storeUrl);
      setFollowerCount(count);
    } catch (err) {
      console.error('Error fetching follower count:', err);
    }
  };


  const fetchStoreReviews = async () => {
    try {
      const response = await getPublicStoreReviews(storeId, { page: 1, limit: 10 });
      if (response) {
        setStoreReviews(response.reviews);
        setReviewCount(response.pagination.total);
      }
    } catch (err) {
      console.error('Error fetching store reviews:', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStoreData();
    setRefreshing(false);
  }, [storeId]);

  const handleFollowToggle = async () => {
    if (!store || followLoading) return;

    try {
      if (isFollowing) {
        await unfollowStore(storeId);
        setIsFollowing(false);
        setFollowerCount((prev) => Math.max(0, prev - 1));
      } else {
        await followStore(storeId);
        setIsFollowing(true);
        setFollowerCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    }
  };

  const handleShare = async () => {
    if (!store) return;

    try {
      await Share.share({
        message: `Check out ${store.name} on our platform!\n${store.description || ''}`,
        title: store.name,
      });
    } catch (error) {
      console.error('Error sharing store:', error);
    }
  };

  const handleContactSeller = () => {
    if (!store?.user) return;
    console.log('Contact seller:', store.user.firstName);
  };

  const handleProductPress = (product: any) => {
    navigation.navigate('ProductDetails', { productUrl: product.url });
  };

  const handleViewAllProducts = () => {
    navigation.navigate('SellerPublicProductsScreen', { 
      storeUrl: store?.url, 
      storeName: store?.name 
    });
  };

  const handleViewAllReviews = () => {
    navigation.navigate('SellerStoreReviews', { 
      storeId: store?.id,
      storeName: store?.name 
    });
  };

  const renderStarRating = (rating: number, size: number = 16) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Ionicons key={i} name="star" size={size} color="#FFA500" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Ionicons key={i} name="star-half" size={size} color="#FFA500" />
        );
      } else {
        stars.push(
          <Ionicons key={i} name="star-outline" size={size} color={Colors.gray300} />
        );
      }
    }
    return stars;
  };

  const renderProductCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => handleProductPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.productImageContainer}>
        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.productImage} />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="cube-outline" size={40} color={Colors.gray400} />
          </View>
        )}
        {item.stock > 0 && (
          <View style={styles.inStockBadge}>
            <View style={styles.inStockDot} />
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.productPrice}>GH₵ {(item.price || 0).toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderReviewCard = ({ item }: { item: any }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerAvatar}>
          <Text style={styles.reviewerAvatarText}>
            {item.user?.firstName?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.reviewerInfo}>
          <View style={styles.reviewerNameRow}>
            <Text style={styles.reviewerName}>
              {item.user?.firstName || 'User'}
            </Text>
            {item.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              </View>
            )}
          </View>
          <View style={styles.reviewStarsRow}>
            <View style={styles.reviewStars}>
              {renderStarRating(item.rating, 12)}
            </View>
            <Text style={styles.reviewDate}>
              {new Date(item.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
        </View>
      </View>
      
      {item.title && (
        <Text style={styles.reviewTitle} numberOfLines={2}>
          {item.title}
        </Text>
      )}
      
      {item.comment && (
        <Text style={styles.reviewComment} numberOfLines={3}>
          {item.comment}
        </Text>
      )}
      
      {item.product && (
        <View style={styles.reviewProductTag}>
          <Ionicons name="pricetag-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.reviewProductName} numberOfLines={1}>
            {item.product.name}
          </Text>
        </View>
      )}
      
      {item._count?.likes > 0 && (
        <View style={styles.reviewLikesRow}>
          <Ionicons name="thumbs-up-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.reviewLikes}>{item._count.likes}</Text>
        </View>
      )}
    </View>
  );

  if (loading && !store) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading store...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !store) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          </View>
          <Text style={styles.errorTitle}>Store Not Found</Text>
          <Text style={styles.errorMessage}>
            {error || 'This store could not be found or is no longer available.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStoreData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!store) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="storefront-outline" size={64} color={Colors.gray400} />
          </View>
          <Text style={styles.errorTitle}>No Store Data</Text>
          <Text style={styles.errorMessage}>Unable to load store information.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
            <Ionicons name="share-social-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Store Header Card */}
        <View style={styles.storeHeaderCard}>
          <View style={styles.storeMainInfo}>
            <View style={styles.logoContainer}>
              {store.logo ? (
                <Image source={{ uri: store.logo }} style={styles.logoImage} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoPlaceholderText}>
                    {store.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {store.verification?.status === 'verified' && (
                <View style={styles.verifiedBadgeIcon}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                </View>
              )}
            </View>

            <View style={styles.storeDetails}>
              <View style={styles.storeNameRow}>
                <Text style={styles.storeName} numberOfLines={2}>
                  {store.name}
                </Text>
              </View>
              
              <View style={styles.categoryLocationRow}>
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryText}>{store.category}</Text>
                </View>
                <View style={styles.locationPill}>
                  <Ionicons name="location-sharp" size={12} color={Colors.textSecondary} />
                  <Text style={styles.locationText}>{store.location}</Text>
                </View>
              </View>

              <View style={styles.ratingRow}>
                <View style={styles.stars}>
                  {renderStarRating(store.rating || 0, 14)}
                </View>
                <Text style={styles.ratingText}>
                  {(store.rating || 0).toFixed(1)} ({store.totalReviews || 0})
                </Text>
              </View>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{followerCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{(products ?? []).length}+</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>

            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{store.viewCount || 0}</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleFollowToggle}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? Colors.primary : Colors.white} />
              ) : (
                <>
                  <Ionicons 
                    name={isFollowing ? "checkmark" : "add"} 
                    size={18} 
                    color={isFollowing ? Colors.primary : Colors.white} 
                  />
                  <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.messageButton} onPress={handleContactSeller}>
              <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* About Section */}
        {store.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Store</Text>
            <Text style={styles.description}>{store.description}</Text>
          </View>
        )}

        {/* Products Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Products</Text>
            {products.length > 0 && (
              <TouchableOpacity onPress={handleViewAllProducts} style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>View All</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {productsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : products.length > 0 ? (
            <FlatList
              data={products.slice(0, 6)}
              renderItem={renderProductCard}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.productRow}
              contentContainerStyle={styles.productsGrid}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color={Colors.gray300} />
              <Text style={styles.emptyStateText}>No products available</Text>
            </View>
          )}
        </View>

        {/* Reviews Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Reviews {reviewCount > 0 && `(${reviewCount})`}
            </Text>
            {storeReviews.length > 0 && (
              <TouchableOpacity onPress={handleViewAllReviews} style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>View All</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {reviewsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : storeReviews.length > 0 ? (
            <FlatList
              data={storeReviews.slice(0, 3)}
              renderItem={renderReviewCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.reviewSeparator} />}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={48} color={Colors.gray300} />
              <Text style={styles.emptyStateText}>No reviews yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Be the first to review products from this store
              </Text>
            </View>
          )}
        </View>

        {/* Store Info Footer */}
        <View style={styles.footerSection}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Seller</Text>
              <Text style={styles.infoValue}>
                {store.user?.firstName || 'Store Owner'}
              </Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Joined</Text>
              <Text style={styles.infoValue}>
                {new Date(store.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => console.log('Report store')}
          >
            <Ionicons name="flag-outline" size={14} color={Colors.error} />
            <Text style={styles.reportButtonText}>Report Store</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
  headerButton: {
    padding: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorIconContainer: {
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: Typography.xl,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    fontFamily: Typography.regular,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
  },
  storeHeaderCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  storeMainInfo: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  logoContainer: {
    position: 'relative',
    marginRight: 16,
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: Colors.gray100,
  },
  logoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholderText: {
    fontSize: 32,
    fontFamily: Typography.bold,
    color: Colors.white,
  },
  verifiedBadgeIcon: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: Colors.white,
    borderRadius: 12,
  },
  storeDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  storeNameRow: {
    marginBottom: 6,
  },
  storeName: {
    fontSize: Typography['2xl'],
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  categoryLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryPill: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: Typography.xs,
    color: Colors.primary,
    fontFamily: Typography.semiBold,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.xl,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  followButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  followingButton: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  followButtonText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
  },
  followingButtonText: {
    color: Colors.primary,
  },
  messageButton: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageButtonText: {
    color: Colors.primary,
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
  },
  section: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontFamily: Typography.semiBold,
  },
  description: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    lineHeight: 24,
    fontFamily: Typography.regular,
  },
  productsGrid: {
    paddingBottom: 4,
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productCard: {
    width: PRODUCT_CARD_WIDTH,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  productImageContainer: {
    width: '100%',
    height: PRODUCT_CARD_WIDTH * 0.9,
    backgroundColor: Colors.gray100,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray200,
  },
  inStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inStockDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.white,
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: Typography.sm,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
    lineHeight: 20,
  },
  productPrice: {
    fontSize: Typography.base,
    fontFamily: Typography.bold,
    color: Colors.primary,
  },
  reviewCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewerAvatarText: {
    fontSize: Typography.lg,
    fontFamily: Typography.bold,
    color: Colors.white,
  },
  reviewerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  reviewerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  reviewerName: {
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
  },
  verifiedBadge: {
    backgroundColor: Colors.success + '20',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
  },
  reviewTitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
    lineHeight: 20,
  },
  reviewComment: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
    fontFamily: Typography.regular,
  },
  reviewProductTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundTertiary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  reviewProductName: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
    maxWidth: PRODUCT_CARD_WIDTH - 40,
  },
  reviewLikesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewLikes: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
  },
  reviewSeparator: {
    height: 12,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
  },
  emptyStateSubtext: {
    marginTop: 4,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerSection: {
    backgroundColor: Colors.white, 
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
  }, 
  infoLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
    marginBottom: 4,
  }, 
  infoValue: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontFamily: Typography.semiBold,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  reportButtonText: {
    fontSize: Typography.sm,
    color: Colors.error,
    fontFamily: Typography.semiBold,
  },
  bottomSpacer: {
    height: 24,
  },
});
