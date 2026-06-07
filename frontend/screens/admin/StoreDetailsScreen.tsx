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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useStore } from '../../context/StoreContext';
import { useStoreProducts } from '../../hooks/useProducts';
import { useStoreFollowing } from '../../hooks/useStoreFollowings';
import { useReviews } from '../../hooks/useReview';
import { useAdmin } from '../../hooks/useAdmin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/colors';

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

  const storeUrl = route?.params?.storeUrl ?? store?.url;
  const storeProductsQuery = useStoreProducts(storeUrl, { page: 1, limit: 10 });
  const products = storeProductsQuery.data?.products ?? [];
  const productsLoading = storeProductsQuery.isLoading || storeProductsQuery.isFetching;
  const {
    loading: followLoading,
    followStore,
    unfollowStore,
    checkIfFollowing,
    getStoreFollowerCount,
  } = useStoreFollowing();
  const { loading: reviewsLoading, getPublicStoreReviews } = useReviews();
  const { suspendStore, reactivateStore, deleteStore } = useAdmin();

  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [storeReviews, setStoreReviews] = useState<any[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    checkAdminStatus();
    if (storeId) {
      fetchStoreData();
    }

    return () => {
      clearStore();
    };
  }, [storeId]);

  const checkAdminStatus = async () => {
    try {
      const userRole = await AsyncStorage.getItem('userRole');
      setIsAdmin(userRole === 'ADMIN');
    } catch (err) {
      console.error('Error checking admin status:', err);
    }
  };

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

  // Products are fetched via useStoreProducts (TanStack Query)
  const fetchProducts = async (_storeUrl: string) => {
    // no-op (kept to avoid touching other refresh logic too much)
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
        message: `Check out ${store.name} on Zuba!\n${store.description || ''}`,
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
    navigation.navigate('SellerPublicProducts', { 
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

  // Admin Actions
  const handleSuspendStore = () => {
    if (!store) return;

    Alert.alert(
      'Suspend Store',
      `Are you sure you want to suspend "${store.name}"? This will hide the store from public view.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const success = await suspendStore(storeId);
            setActionLoading(false);

            if (success) {
              Alert.alert('Success', 'Store suspended successfully');
              fetchStoreData();
            }
          },
        },
      ]
    );
  };

  const handleReactivateStore = () => {
    if (!store) return;

    Alert.alert(
      'Reactivate Store',
      `Are you sure you want to reactivate "${store.name}"? This will make the store publicly visible again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: async () => {
            setActionLoading(true);
            const success = await reactivateStore(storeId);
            setActionLoading(false);

            if (success) {
              Alert.alert('Success', 'Store reactivated successfully');
              fetchStoreData();
            }
          },
        },
      ]
    );
  };

  const handleDeleteStore = () => {
    if (!store) return;

    Alert.alert(
      'Delete Store',
      `Are you sure you want to permanently delete "${store.name}"? This will delete all store data including products, logo, and verification records. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const success = await deleteStore(storeId);
            setActionLoading(false);

            if (success) {
              Alert.alert('Success', 'Store deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            }
          },
        },
      ]
    );
  };

  const renderStarRating = (rating: number, size: number = 20) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Ionicons key={i} name="star" size={size} color={Colors.warning} />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Ionicons key={i} name="star-half" size={size} color={Colors.warning} />
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
            <Ionicons name="cube-outline" size={48} color={Colors.gray400} />
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
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                <Text style={styles.verifiedPurchaseText}>Verified</Text>
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
          <Ionicons name="pricetag-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.reviewProductName} numberOfLines={1}>
            {item.product.name}
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
          <View style={styles.reviewLikesContainer}>
            <Ionicons name="thumbs-up" size={12} color={Colors.primary} />
            <Text style={styles.reviewLikes}>{item._count.likes}</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (loading && !store) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
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
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="storefront-outline" size={64} color={Colors.gray400} />
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
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={handleShare}
        >
          <Ionicons name="share-social-outline" size={24} color={Colors.textPrimary} />
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
                  <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                </View>
              )}
            </View>

            <Text style={styles.storeName}>{store.name}</Text>
            
            {/* Suspension Badge */}
            {store.isSuspended && (
              <View style={styles.suspendedStoreBadge}>
                <Ionicons name="ban" size={14} color={Colors.error} />
                <Text style={styles.suspendedStoreText}>Store Suspended</Text>
              </View>
            )}
            
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
                <Ionicons name="people" size={20} color={Colors.primary} />
                <Text style={styles.statValue}>{followerCount}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="cube" size={20} color={Colors.primary} />
                <Text style={styles.statValue}>{products.length}+</Text>
                <Text style={styles.statLabel}>Products</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="eye" size={20} color={Colors.primary} />
                <Text style={styles.statValue}>{store.viewCount || 0}</Text>
                <Text style={styles.statLabel}>Views</Text>
              </View>
            </View>

            {/* Admin Action Buttons */}
            {isAdmin && (
              <View style={styles.adminActionsContainer}>
                <View style={styles.adminActionsHeader}>
                  <Ionicons name="shield-checkmark" size={16} color={Colors.textSecondary} />
                  <Text style={styles.adminActionsTitle}>Admin Actions</Text>
                </View>
                <View style={styles.adminActionsRow}>
                  {store.isSuspended ? (
                    <TouchableOpacity
                      style={[styles.adminButton, styles.reactivateButton]}
                      onPress={handleReactivateStore}
                      disabled={actionLoading}
                      activeOpacity={0.8}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
                          <Text style={styles.adminButtonText}>Reactivate</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.adminButton, styles.suspendButton]}
                      onPress={handleSuspendStore}
                      disabled={actionLoading}
                      activeOpacity={0.8}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <>
                          <Ionicons name="ban" size={18} color={Colors.white} />
                          <Text style={styles.adminButtonText}>Suspend</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.adminButton, styles.deleteButton]}
                    onPress={handleDeleteStore}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <>
                        <Ionicons name="trash" size={18} color={Colors.white} />
                        <Text style={styles.adminButtonText}>Delete</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[
                  styles.followButton,
                  isFollowing && styles.followingButton,
                ]}
                onPress={handleFollowToggle}
                disabled={followLoading}
                activeOpacity={0.8}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color={isFollowing ? Colors.primary : Colors.white} />
                ) : (
                  <>
                    <Ionicons 
                      name={isFollowing ? "checkmark" : "add"} 
                      size={20} 
                      color={isFollowing ? Colors.primary : Colors.white} 
                    />
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
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color={Colors.primary} />
                <Text style={styles.contactButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* About Section */}
        {store.description && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="information-circle" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>About</Text>
            </View>
            <Text style={styles.description}>{store.description}</Text>
          </View>
        )}

        {/* Location Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="location" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Location</Text>
          </View>
          <View style={styles.locationCard}>
            <Ionicons name="navigate-circle" size={24} color={Colors.primary} />
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
            <View style={styles.sectionTitleRow}>
              <Ionicons name="grid" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Products</Text>
            </View>
            {products.length > 0 && (
              <TouchableOpacity onPress={handleViewAllProducts}>
                <View style={styles.viewAllButton}>
                  <Text style={styles.viewAllLink}>View All</Text>
                  <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
                </View>
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
              <Ionicons name="cube-outline" size={64} color={Colors.gray300} />
              <Text style={styles.emptyStateText}>No products yet</Text>
            </View>
          )}
        </View>

        {/* Store Reviews Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="star" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>
                Customer Reviews {reviewCount > 0 && `(${reviewCount})`}
              </Text>
            </View>
            {storeReviews.length > 0 && (
              <TouchableOpacity onPress={handleViewAllReviews}>
                <View style={styles.viewAllButton}>
                  <Text style={styles.viewAllLink}>View All</Text>
                  <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
                </View>
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
              <Ionicons name="star-outline" size={64} color={Colors.gray300} />
              <Text style={styles.emptyStateText}>No reviews yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Be the first to review products from this store
              </Text>
            </View>
          )}
        </View>

        {/* Store Details Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="document-text" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Store Information</Text>
          </View>
          
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="person" size={16} color={Colors.textSecondary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Seller</Text>
                <Text style={styles.infoValue}>
                  {store.user?.firstName || 'Store Owner'}
                </Text>
              </View>
            </View>
            
            <View style={styles.infoItem}>
              <Ionicons name="calendar" size={16} color={Colors.textSecondary} />
              <View style={styles.infoTextContainer}>
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
        </View>

        {/* Report Button */}
        {!isAdmin && (
          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => console.log('Report store')}
            activeOpacity={0.8}
          >
            <Ionicons name="flag" size={16} color={Colors.error} />
            <Text style={styles.reportButtonText}>Report this store</Text>
          </TouchableOpacity>
        )}

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
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
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
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
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
  storeName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  suspendedStoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  suspendedStoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.error,
  },
  adminActionsContainer: {
    width: '100%',
    backgroundColor: Colors.gray50,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adminActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    justifyContent: 'center',
  },
  adminActionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  adminActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  adminButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  suspendButton: {
    backgroundColor: Colors.warning,
  },
  reactivateButton: {
    backgroundColor: Colors.success,
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  adminButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  categoryBadge: {
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  categoryBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: Colors.backgroundTertiary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  followButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  followingButton: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  followButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  followingButtonText: {
    color: Colors.primary,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    gap: 8,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  section: {
    backgroundColor: Colors.white,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.textSecondary,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundTertiary,
    padding: 16,
    borderRadius: 12,
    gap: 12,
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
    marginBottom: 16,
  },
  productCard: {
    width: PRODUCT_CARD_WIDTH,
    backgroundColor: Colors.white,
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
    backgroundColor: Colors.gray100,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
    minHeight: 36,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 8,
  },
  stockBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.success,
  },
  outOfStockBadge: {
    backgroundColor: Colors.errorLight,
  },
  outOfStockText: {
    color: Colors.error,
  },
  reviewCard: {
    backgroundColor: Colors.backgroundTertiary,
    padding: 16,
    borderRadius: 12,
  },
  reviewSeparator: {
    height: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
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
    gap: 8,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  verifiedPurchaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  verifiedPurchaseText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.success,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  reviewProductTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewProductName: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  reviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  reviewLikesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewLikes: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  infoGrid: {
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.backgroundTertiary,
    padding: 12,
    borderRadius: 8,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
  bottomSpacer: {
    height: 32,
  },
});