import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useReviews, Review, ReviewSummary } from '../../hooks/useReview';
import { LinearGradient } from 'expo-linear-gradient';

interface RouteParams {
  productId: string;
  productName: string;
}

const { width } = Dimensions.get('window');

export default function ProductReviewsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { productId, productName } = route.params as RouteParams;

  const {
    getProductReviews,
    getProductReviewSummary,
    likeReview,
    unlikeReview,
    reportReview,
    loading,
  } = useReviews();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState<'createdAt' | 'rating'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [selectedReviewMedia, setSelectedReviewMedia] = useState<string[]>([]);
  const [likedReviews, setLikedReviews] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchReviews();
    fetchSummary();
  }, [sortBy, sortOrder, verifiedOnly]);

  const fetchSummary = async () => {
    try {
      const data = await getProductReviewSummary(productId);
      setSummary(data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const fetchReviews = async (pageNum = 1) => {
    try {
      const data = await getProductReviews(productId, {
        page: pageNum,
        limit: 10,
        sortBy,
        sortOrder,
        verifiedOnly,
      });

      if (pageNum === 1) {
        setReviews(data.reviews);
      } else {
        setReviews((prev) => [...prev, ...data.reviews]);
      }

      setPage(pageNum);
      setTotalPages(data.pagination.pages);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      Alert.alert('Error', 'Failed to load reviews');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchReviews(1), fetchSummary()]);
    setRefreshing(false);
  }, [sortBy, sortOrder, verifiedOnly]);

  const loadMore = async () => {
    if (!loadingMore && page < totalPages) {
      setLoadingMore(true);
      await fetchReviews(page + 1);
      setLoadingMore(false);
    }
  };

  const handleLikeReview = async (reviewId: string) => {
    try {
      const isLiked = likedReviews.has(reviewId);
      
      if (isLiked) {
        await unlikeReview(reviewId);
        setLikedReviews((prev) => {
          const newSet = new Set(prev);
          newSet.delete(reviewId);
          return newSet;
        });
      } else {
        await likeReview(reviewId);
        setLikedReviews((prev) => new Set(prev).add(reviewId));
      }

      // Update review in list
      setReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                _count: {
                  likes: (review._count?.likes || 0) + (isLiked ? -1 : 1),
                },
              }
            : review
        )
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update like');
    }
  };

  const handleReportReview = (reviewId: string) => {
    Alert.alert(
      'Report Review',
      'Why are you reporting this review?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Spam',
          onPress: () => submitReport(reviewId, 'Spam'),
        },
        {
          text: 'Inappropriate',
          onPress: () => submitReport(reviewId, 'Inappropriate content'),
        },
        {
          text: 'Fake',
          onPress: () => submitReport(reviewId, 'Fake review'),
        },
      ],
      { cancelable: true }
    );
  };

  const submitReport = async (reviewId: string, reason: string) => {
    try {
      await reportReview(reviewId, { reason });
      Alert.alert('Success', 'Review reported. Thank you for your feedback.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to report review');
    }
  };

  const openImageViewer = (media: string[], index: number) => {
    setSelectedReviewMedia(media);
    setSelectedImageIndex(index);
  };

  const closeImageViewer = () => {
    setSelectedImageIndex(null);
    setSelectedReviewMedia([]);
  };

  const renderRatingBar = (star: number, count: number, total: number) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;

    return (
      <View style={styles.ratingBarRow}>
        <Text style={styles.ratingBarLabel}>{star}</Text>
        <Ionicons name="star" size={12} color="#FFD700" />
        <View style={styles.ratingBarContainer}>
          <View style={[styles.ratingBarFill, { width: `${percentage}%` }]} />
        </View>
        <Text style={styles.ratingBarCount}>{count}</Text>
      </View>
    );
  };

  const renderStars = (rating: number, size = 16) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={size}
            color={star <= rating ? '#FFD700' : '#D1D5DB'}
          />
        ))}
      </View>
    );
  };

  const renderReviewItem = ({ item }: { item: Review }) => {
    const isLiked = likedReviews.has(item.id);

    return (
      <View style={styles.reviewCard}>
        {/* User Info */}
        <View style={styles.reviewHeader}>
          <View style={styles.userInfo}>
            <Image
              source={{
                uri: item.user.avatar || 'https://via.placeholder.com/40',
              }}
              style={styles.avatar}
            />
            <View style={styles.userDetails}>
              <Text style={styles.userName}>
                {item.user.firstName} {item.user.lastName}
              </Text>
              {item.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                  <Text style={styles.verifiedText}>Verified Purchase</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => handleReportReview(item.id)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Rating & Date */}
        <View style={styles.reviewMeta}>
          {renderStars(item.rating)}
          <Text style={styles.reviewDate}>
            {new Date(item.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* Title */}
        {item.title && <Text style={styles.reviewTitle}>{item.title}</Text>}

        {/* Comment */}
        <Text style={styles.reviewComment}>{item.comment}</Text>

        {/* Media */}
        {item.media && item.media.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mediaScroll}
          >
            {item.media.map((mediaUrl, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => openImageViewer(item.media, index)}
              >
                <Image
                  source={{ uri: mediaUrl }}
                  style={styles.reviewMedia}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Seller Response */}
        {item.sellerResponse && (
          <View style={styles.sellerResponse}>
            <View style={styles.sellerResponseHeader}>
              <Ionicons name="storefront" size={16} color="#3B82F6" />
              <Text style={styles.sellerResponseTitle}>Seller Response</Text>
            </View>
            <Text style={styles.sellerResponseText}>
              {item.sellerResponse.response}
            </Text>
            <Text style={styles.sellerResponseDate}>
              {new Date(item.sellerResponse.createdAt).toLocaleDateString()}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.reviewActions}>
          <TouchableOpacity
            style={styles.likeButton}
            onPress={() => handleLikeReview(item.id)}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={isLiked ? '#EF4444' : '#6B7280'}
            />
            <Text style={[styles.likeText, isLiked && styles.likedText]}>
              Helpful {item._count?.likes ? `(${item._count.likes})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <>
      {/* Summary Card */}
      {summary && (
        <LinearGradient
          colors={['#3B82F6', '#2563EB']}
          style={styles.summaryCard}
        >
          <View style={styles.summaryContent}>
            <Text style={styles.summaryRating}>
              {summary.averageRating.toFixed(1)}
            </Text>
            <View style={styles.summaryStars}>
              {renderStars(Math.round(summary.averageRating), 20)}
            </View>
            <Text style={styles.summaryCount}>
              Based on {summary.reviewCount} review{summary.reviewCount !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Rating Distribution */}
          <View style={styles.ratingDistribution}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter((r) => r.rating === star).length;
              return renderRatingBar(star, count, summary.reviewCount);
            })}
          </View>
        </LinearGradient>
      )}

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortModal(true)}
        >
          <Ionicons name="swap-vertical" size={18} color="#3B82F6" />
          <Text style={styles.sortButtonText}>Sort</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            verifiedOnly && styles.filterButtonActive,
          ]}
          onPress={() => setVerifiedOnly(!verifiedOnly)}
        >
          <Ionicons
            name={verifiedOnly ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={18}
            color={verifiedOnly ? '#10B981' : '#6B7280'}
          />
          <Text
            style={[
              styles.filterButtonText,
              verifiedOnly && styles.filterButtonTextActive,
            ]}
          >
            Verified Only
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.reviewsHeader}>
        <Text style={styles.reviewsTitle}>
          All Reviews ({summary?.reviewCount || 0})
        </Text>
      </View>
    </>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>No Reviews Yet</Text>
      <Text style={styles.emptyText}>
        Be the first to review this product!
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {productName}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Reviews List */}
      <FlatList
        data={reviews}
        renderItem={renderReviewItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!loading ? renderEmpty : null}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort Reviews</Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setSortBy('createdAt');
                setSortOrder('desc');
                setShowSortModal(false);
              }}
            >
              <Text style={styles.modalOptionText}>Most Recent</Text>
              {sortBy === 'createdAt' && sortOrder === 'desc' && (
                <Ionicons name="checkmark" size={24} color="#3B82F6" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setSortBy('rating');
                setSortOrder('desc');
                setShowSortModal(false);
              }}
            >
              <Text style={styles.modalOptionText}>Highest Rating</Text>
              {sortBy === 'rating' && sortOrder === 'desc' && (
                <Ionicons name="checkmark" size={24} color="#3B82F6" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setSortBy('rating');
                setSortOrder('asc');
                setShowSortModal(false);
              }}
            >
              <Text style={styles.modalOptionText}>Lowest Rating</Text>
              {sortBy === 'rating' && sortOrder === 'asc' && (
                <Ionicons name="checkmark" size={24} color="#3B82F6" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalOption, styles.modalCancel]}
              onPress={() => setShowSortModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal
        visible={selectedImageIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.closeImageButton}
            onPress={closeImageViewer}
          >
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>

          {selectedImageIndex !== null && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.imageViewer}
            >
              {selectedReviewMedia.map((uri, index) => (
                <Image
                  key={index}
                  source={{ uri }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {loading && reviews.length === 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    marginTop: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 32,
  },
  summaryCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  summaryContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryRating: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  summaryStars: {
    marginBottom: 8,
  },
  summaryCount: {
    fontSize: 14,
    color: '#E0E7FF',
  },
  ratingDistribution: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  ratingBarLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    width: 12,
    marginRight: 4,
  },
  ratingBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#FCD34D',
    borderRadius: 4,
  },
  ratingBarCount: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    width: 24,
    textAlign: 'right',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    marginRight: 8,
  },
  sortButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterButtonActive: {
    backgroundColor: '#D1FAE5',
  },
  filterButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#10B981',
  },
  reviewsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
  },
  reviewsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  reviewCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  userDetails: {
    marginLeft: 12,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedText: {
    fontSize: 12,
    color: '#10B981',
    marginLeft: 4,
    fontWeight: '500',
  },
  menuButton: {
    padding: 4,
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: 'row',
    marginRight: 12,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  mediaScroll: {
    marginVertical: 12,
  },
  reviewMedia: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
  },
  sellerResponse: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  sellerResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sellerResponseTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 6,
  },
  sellerResponseText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
    marginBottom: 4,
  },
  sellerResponseDate: {
    fontSize: 11,
    color: '#60A5FA',
  },
  reviewActions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  likedText: {
    color: '#EF4444',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  loadingMore: {
    paddingVertical: 20,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#111827',
  },
  modalCancel: {
    borderBottomWidth: 0,
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  closeImageButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  imageViewer: {
    flex: 1,
  },
  fullImage: {
    width,
    height: '100%',
  },
});