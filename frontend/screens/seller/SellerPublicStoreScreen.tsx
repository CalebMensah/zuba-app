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
import { useStore } from '../../hooks/useStore';
import { useProduct } from '../../hooks/useProducts';
import { useStoreFollowing } from '../../hooks/useStoreFollowings';
import { useReviews } from '../../hooks/useReview';
import { Colors } from '../../constants/colors';
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
  const { products, loading: productsLoading, getStoreProducts } = useProduct();
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
          fetchProducts(storeData.url),
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

  const fetchProducts = async (storeUrl: string) => {
    try {
      await getStoreProducts(storeUrl, { page: 1, limit: 10 });
    } catch (err) {
      console.error('Error fetching products:', err);
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

  const renderStarRating = (rating: number, size: number = 20) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Text key={i} style={[styles.star, { fontSize: size }]}>
            ★
          </Text>
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Text key={i} style={[styles.star, { fontSize: size }]}>
            ★
          </Text>
        );
      } else {
        stars.push(
          <Text key={i} style={[styles.starEmpty, { fontSize: size }]}>
            ★
          </Text>
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
            <Text style={styles.productImagePlaceholderText}>📦</Text>
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.productPrice}>GH₵ {item.price.toFixed(2)}</Text>
        {item.stock > 0 ? (
          <View style={styles.stockBadge}>
            <Text style={styles.stockBadgeText}>In Stock</Text>
          </View>
        ) : (
          <View style={[styles.stockBadge, styles.outOfStockBadge]}>
            <Text style={[styles.stockBadgeText, styles.outOfStockText]}>Out of Stock</Text>
          </View>
        )}
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
              <View style={styles.verifiedPurchaseBadge}>
                <Text style={styles.verifiedPurchaseText}>✓ Verified</Text>
              </View>
            )}
          </View>
          <View style={styles.reviewStars}>
            {renderStarRating(item.rating, 14)}
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
          <Text style={styles.reviewProductName} numberOfLines={1}>
            Product: {item.product.name}
          </Text>
        </View>
      )}
      
      <View style={styles.reviewFooter}>
        <Text style={styles.reviewDate}>
          {new Date(item.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
        {item._count?.likes > 0 && (
          <Text style={styles.reviewLikes}>
            👍 {item._count.likes}
          </Text>
        )}
      </View>
    </View>
  );

  if (loading && !store) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Store Not Found</Text>
          <Text style={styles.errorMessage}>
            {error || 'This store could not be found or is no longer available.'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchStoreData}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!store) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>🏪</Text>
          <Text style={styles.errorTitle}>No Store Data</Text>
          <Text style={styles.errorMessage}>
            Unable to load store information.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}><Ionicons name="arrow-back-outline" size={24} color="#1E3A8A" /></Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare}>
          <Text style={styles.shareButton}>Share <Ionicons name="share-sharp" size={24} color="#1E3A8A" /></Text>
        </TouchableOpacity>
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
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroBackground} />
          <View style={styles.heroContent}>
            <View style={styles.logoWrapper}>
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
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>✓</Text>
                </View>
              )}
            </View>

            <Text style={styles.storeName}>{store.name}</Text>
            
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{store.category}</Text>
            </View>

            <View style={styles.ratingContainer}>
              <View style={styles.stars}>
                {renderStarRating(store.rating, 18)}
              </View>
              <Text style={styles.ratingText}>
                {store.rating.toFixed(1)} ({store.totalReviews} reviews)
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{followerCount}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{products.length}+</Text>
                <Text style={styles.statLabel}>Products</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{store.viewCount || 0}</Text>
                <Text style={styles.statLabel}>Views</Text>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[
                  styles.followButton,
                  isFollowing && styles.followingButton,
                ]}
                onPress={handleFollowToggle}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color={isFollowing ? Colors.primary : Colors.white} />
                ) : (
                  <>
                    <Text style={[styles.followButtonIcon, isFollowing && styles.followingIcon]}>
                      {isFollowing ? '✓' : '+'}
                    </Text>
                    <Text
                      style={[
                        styles.followButtonText,
                        isFollowing && styles.followingButtonText,
                      ]}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.contactButton}
                onPress={handleContactSeller}
              >
                <Text style={styles.contactButtonIcon}><Ionicons name="chatbubble" size={24} color="#1E3A8A" /></Text>
                <Text style={styles.contactButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* About Section */}
        {store.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{store.description}</Text>
          </View>
        )}

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.locationCard}>
            <Text style={styles.locationIcon}><Ionicons name="location" size={24} color="#1E3A8A" /></Text>
            <View style={styles.locationInfo}>
              <Text style={styles.locationText}>{store.location}</Text>
              {store.region && (
                <Text style={styles.regionText}>{store.region}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Products Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Products</Text>
            {products.length > 0 && (
              <TouchableOpacity onPress={handleViewAllProducts}>
                <Text style={styles.viewAllLink}>View All <Ionicons name="arrow-forward" size={24} color={Colors.primary} /></Text>
              </TouchableOpacity>
            )}
          </View>

          {productsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : products.length > 0 ? (
            <FlatList
              data={products}
              renderItem={renderProductCard}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.productRow}
              contentContainerStyle={styles.productsGrid}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📦</Text>
              <Text style={styles.emptyStateText}>No products yet</Text>
            </View>
          )}
        </View>

        {/* Store Reviews Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Customer Reviews {reviewCount > 0 && `(${reviewCount})`}
            </Text>
            {storeReviews.length > 0 && (
              <TouchableOpacity onPress={handleViewAllReviews}>
                <Text style={styles.viewAllLink}>View All <Text style={styles.buttonArrow}><Ionicons name="arrow-forward" size={24} color={Colors.primary} /></Text></Text>
              </TouchableOpacity>
            )}
          </View>

          {reviewsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : storeReviews.length > 0 ? (
            <FlatList
              data={storeReviews}
              renderItem={renderReviewCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.reviewSeparator} />}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>⭐</Text>
              <Text style={styles.emptyStateText}>No reviews yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Be the first to review products from this store
              </Text>
            </View>
          )}
        </View>

        {/* Store Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Information</Text>
          
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Seller</Text>
              <Text style={styles.infoValue}>
                {store.user?.firstName || 'Store Owner'}
              </Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>
                {new Date(store.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* Report Button */}
        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => console.log('Report store')}
        >
          <Text style={styles.reportButtonText}>🚩 Report this store</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  shareButton: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  heroSection: {
    position: 'relative',
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  heroBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: Colors.primary,
    opacity: 0.1,
  },
  heroContent: {
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logoWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.gray100,
    borderWidth: 4,
    borderColor: Colors.white,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: Colors.white,
  },
  logoPlaceholderText: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.white,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.success,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
  },
  verifiedBadgeText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  storeName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  categoryBadgeText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  stars: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  star: {
    color: '#FFA500',
    marginHorizontal: 1,
  },
  starEmpty: {
    color: Colors.gray300,
    marginHorizontal: 1,
  },
  ratingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
    buttonArrow: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
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
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  followButtonIcon: {
    fontSize: 18,
    color: Colors.white,
    fontWeight: '700',
  },
  followingIcon: {
    color: Colors.primary,
  },
  followButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  followingButtonText: {
    color: Colors.primary,
  },
  contactButton: {
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
  contactButtonIcon: {
    fontSize: 18,
  },
  contactButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  viewAllLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
  },
  locationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  regionText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  productsGrid: {
    paddingBottom: 8,
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
    borderColor: Colors.border,
  },
  productImageContainer: {
    width: '100%',
    height: PRODUCT_CARD_WIDTH,
    backgroundColor: Colors.gray100,
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
  productImagePlaceholderText: {
    fontSize: 40,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
    height: 36,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 6,
  },
  stockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  stockBadgeText: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '600',
  },
  outOfStockBadge: {
    backgroundColor: Colors.error + '20',
  },
  outOfStockText: {
    color: Colors.error,
  },
  reviewCard: {
    backgroundColor: Colors.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  reviewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewerAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginRight: 8,
  },
  verifiedPurchaseBadge: {
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedPurchaseText: {
    fontSize: 10,
    color: Colors.success,
    fontWeight: '600',
  },
  reviewStars: {
    flexDirection: 'row',
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  reviewComment: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  reviewProductTag: {
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  reviewProductName: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  reviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  reviewLikes: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  reviewSeparator: {
    height: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  infoItem: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    padding: 14,
    borderRadius: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  reportButton: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  reportButtonText: {
    fontSize: 14,
    color: Colors.error,
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 40,
  },
});

