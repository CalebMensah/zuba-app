import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useReviews, Review } from '../../hooks/useReview';
import { Colors } from '../../constants/colors';

// Navigation types
type RootStackParamList = {
  SellerStoreReviews: { storeId?: string };
  ReviewDetails: { reviewId: string };
};

type SellerStoreReviewsRouteProp = RouteProp<RootStackParamList, 'SellerStoreReviews'>;
type SellerStoreReviewsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SellerStoreReviews: React.FC = () => {
  const route = useRoute<SellerStoreReviewsRouteProp>();
  const navigation = useNavigation<SellerStoreReviewsNavigationProp>();

  const { getSellerStoreReviews, loading, error } = useReviews();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const [averageRating, setAverageRating] = useState(0);

  // Fetch reviews
  const fetchReviews = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      const result = await getSellerStoreReviews({
        page: pageNum,
        limit: 10,
      });

      if (result) {
        if (append) {
          setReviews((prev) => [...prev, ...result.reviews]);
        } else {
          setReviews(result.reviews);
        }
        setTotalPages(result.pagination.pages);
        setTotalReviews(result.pagination.total);
        
        // Calculate average rating
        if (result.reviews.length > 0) {
          const avg = result.reviews.reduce((sum, review) => sum + review.rating, 0) / result.reviews.length;
          setAverageRating(avg);
        }
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    }
  }, [getSellerStoreReviews]);

  useEffect(() => {
    fetchReviews(1);
  }, []);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await fetchReviews(1);
    setRefreshing(false);
  }, [fetchReviews]);

  // Load more handler
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;

    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchReviews(nextPage, true);
    setLoadingMore(false);
  }, [loadingMore, page, totalPages, fetchReviews]);

  // Navigate to review details
  const handleReviewPress = (reviewId: string) => {
    navigation.navigate('ReviewDetails', { reviewId });
  };

  // Render star rating
  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : star - 0.5 <= rating ? 'star-half' : 'star-outline'}
            size={16}
            color={star <= rating ? Colors.warning : Colors.gray300}
          />
        ))}
      </View>
    );
  };

  // Render review card
  const renderReviewCard = ({ item }: { item: Review }) => {
    const userInitials = `${item.user.firstName.charAt(0)}${item.user.lastName.charAt(0)}`;
    const reviewDate = new Date(item.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return (
      <TouchableOpacity
        style={styles.reviewCard}
        onPress={() => handleReviewPress(item.id)}
        activeOpacity={0.7}
      >
        {/* User Info */}
        <View style={styles.reviewHeader}>
          <View style={styles.userInfo}>
            {item.user.avatar ? (
              <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{userInitials}</Text>
              </View>
            )}
            <View style={styles.userDetails}>
              <View style={styles.nameRow}>
                <Text style={styles.userName}>
                  {item.user.firstName} {item.user.lastName}
                </Text>
                {item.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
              <Text style={styles.reviewDate}>{reviewDate}</Text>
            </View>
          </View>
        </View>

        {/* Rating */}
        <View style={styles.ratingContainer}>
          {renderStars(item.rating)}
          <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
        </View>

        {/* Product Info */}
        {item.product && (
          <View style={styles.productInfo}>
            <Text style={styles.productLabel}>Product:</Text>
            <Text style={styles.productName} numberOfLines={1}>
              {item.product.name}
            </Text>
          </View>
        )}

        {/* Review Title */}
        {item.title && (
          <Text style={styles.reviewTitle} numberOfLines={2}>
            {item.title}
          </Text>
        )}

        {/* Review Comment */}
        {item.comment && (
          <Text style={styles.reviewComment} numberOfLines={3}>
            {item.comment}
          </Text>
        )}

        {/* Review Media */}
        {item.media && item.media.length > 0 && (
          <View style={styles.mediaContainer}>
            {item.media.slice(0, 3).map((mediaUrl, index) => (
              <Image
                key={index}
                source={{ uri: mediaUrl }}
                style={styles.mediaImage}
              />
            ))}
            {item.media.length > 3 && (
              <View style={styles.mediaOverlay}>
                <Text style={styles.mediaOverlayText}>+{item.media.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {/* Review Stats */}
        <View style={styles.reviewFooter}>
          <View style={styles.likeContainer}>
            <Ionicons name="thumbs-up-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.likeText}>
              {item._count?.likes || 0} {item._count?.likes === 1 ? 'like' : 'likes'}
            </Text>
          </View>
          
          {item.sellerResponse && (
            <View style={styles.responseIndicator}>
              <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
              <Text style={styles.responseText}>Seller responded</Text>
            </View>
          )}
        </View>

        {/* View Details Arrow */}
        <View style={styles.viewDetailsContainer}>
          <Text style={styles.viewDetailsText}>View details</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  // Render header
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.summaryCard}>
        <View style={styles.averageRatingContainer}>
          <Text style={styles.averageRatingNumber}>
            {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
          </Text>
          {renderStars(Math.round(averageRating))}
          <Text style={styles.totalReviewsText}>
            Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>All Reviews</Text>
        <Text style={styles.sectionSubtitle}>
          {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
        </Text>
      </View>
    </View>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color={Colors.gray300} />
      <Text style={styles.emptyTitle}>No Reviews Yet</Text>
      <Text style={styles.emptyText}>
        Be the first to share your experience with this store's products!
      </Text>
    </View>
  );

  // Render footer loading
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

  if (loading && reviews.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading reviews...</Text>
      </View>
    );
  }

  if (error && reviews.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorTitle}>Error Loading Reviews</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchReviews(1)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        renderItem={renderReviewCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={reviews.length === 0 ? styles.emptyListContainer : undefined}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
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
    backgroundColor: Colors.backgroundSecondary,
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
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
  headerContainer: {
    backgroundColor: Colors.white,
    paddingBottom: 16,
    marginBottom: 8,
  },
  summaryCard: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  averageRatingContainer: {
    alignItems: 'center',
  },
  averageRatingNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  totalReviewsText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  reviewCard: {
    backgroundColor: Colors.white,
    padding: 16,
    marginBottom: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.gray200,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successLight + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.success,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  productLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    flex: 1,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  mediaContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  mediaImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.gray200,
  },
  mediaOverlay: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 8,
  },
  mediaOverlayText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  likeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  responseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  responseText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  viewDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
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
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default SellerStoreReviews;