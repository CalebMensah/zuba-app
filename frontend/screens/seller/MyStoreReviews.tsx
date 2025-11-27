import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import useReviews, { Review } from '../../hooks/useReview';

type SellerStackParamList = {
  MyStoreReviews: undefined;
  ReviewDetails: { reviewId: string };
  ProductDetails: { productId: string };
};

type NavigationProp = NativeStackNavigationProp<SellerStackParamList>;

const MyStoreReviews = () => {
  const navigation = useNavigation<NavigationProp>();
  const {
    getSellerStoreReviews,
    addReviewResponse,
    updateReviewResponse,
    deleteReviewResponse,
    loading,
    error,
  } = useReviews();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterProductId, setFilterProductId] = useState<string | undefined>();

  // Response Modal State
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState('');
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const [submittingResponse, setSubmittingResponse] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async (page = 1) => {
    try {
      const data = await getSellerStoreReviews({
        page,
        limit: 20,
        productId: filterProductId,
      });

      if (page === 1) {
        setReviews(data.reviews);
      } else {
        setReviews((prev) => [...prev, ...data.reviews]);
      }

      setPagination(data.pagination);
    } catch (err) {
      Alert.alert('Error', 'Failed to load reviews');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReviews(1);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || pagination.page >= pagination.pages) return;

    setLoadingMore(true);
    await fetchReviews(pagination.page + 1);
    setLoadingMore(false);
  };

  const openResponseModal = (review: Review, isEdit: boolean = false) => {
    setSelectedReview(review);
    setIsEditingResponse(isEdit);
    setResponseText(isEdit && review.sellerResponse ? review.sellerResponse.response : '');
    setResponseModalVisible(true);
  };

  const closeResponseModal = () => {
    setResponseModalVisible(false);
    setSelectedReview(null);
    setResponseText('');
    setIsEditingResponse(false);
  };

  const handleSubmitResponse = async () => {
    if (!selectedReview || !responseText.trim()) {
      Alert.alert('Error', 'Please enter a response');
      return;
    }

    setSubmittingResponse(true);
    try {
      if (isEditingResponse) {
        await updateReviewResponse(selectedReview.id, responseText.trim());
        Alert.alert('Success', 'Response updated successfully');
      } else {
        await addReviewResponse(selectedReview.id, responseText.trim());
        Alert.alert('Success', 'Response added successfully');
      }

      closeResponseModal();
      await fetchReviews(1);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleDeleteResponse = (review: Review) => {
    Alert.alert(
      'Delete Response',
      'Are you sure you want to delete your response?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReviewResponse(review.id);
              Alert.alert('Success', 'Response deleted successfully');
              await fetchReviews(1);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete response');
            }
          },
        },
      ]
    );
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={16}
            color={star <= rating ? Colors.warning : Colors.gray300}
          />
        ))}
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return Colors.success;
    if (rating >= 3) return Colors.warning;
    return Colors.error;
  };

  const renderReviewCard = (review: Review) => {
    const hasResponse = !!review.sellerResponse;

    return (
      <View key={review.id} style={styles.reviewCard}>
        {/* Product Info */}
        <TouchableOpacity
          style={styles.productSection}
          onPress={() => navigation.navigate('ProductDetails', { productId: review.productId })}
        >
          {review.product && (
            <>
              <Image
                source={{ uri: review.product.images[0] }}
                style={styles.productImage}
              />
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {review.product.name}
                </Text>
                <View style={styles.productMeta}>
                  <Ionicons name="cube-outline" size={12} color={Colors.textSecondary} />
                  <Text style={styles.productMetaText}>View Product</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Review Content */}
        <TouchableOpacity
          onPress={() => navigation.navigate('ReviewDetails', { reviewId: review.id })}
          activeOpacity={0.7}
        >
          {/* Reviewer Info */}
          <View style={styles.reviewerSection}>
            <View style={styles.reviewerInfo}>
              {review.user.avatar ? (
                <Image source={{ uri: review.user.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>
                    {review.user.firstName[0]}{review.user.lastName[0]}
                  </Text>
                </View>
              )}
              <View style={styles.reviewerDetails}>
                <Text style={styles.reviewerName}>
                  {review.user.firstName} {review.user.lastName}
                </Text>
                <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
              </View>
            </View>

            {/* Rating Badge */}
            <View
              style={[
                styles.ratingBadge,
                { backgroundColor: getRatingColor(review.rating) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.ratingBadgeText,
                  { color: getRatingColor(review.rating) },
                ]}
              >
                {review.rating}.0
              </Text>
              <Ionicons
                name="star"
                size={14}
                color={getRatingColor(review.rating)}
              />
            </View>
          </View>

          {/* Rating Stars */}
          <View style={styles.ratingSection}>
            {renderStars(review.rating)}
            {review.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>

          {/* Title */}
          {review.title && (
            <Text style={styles.reviewTitle} numberOfLines={2}>
              {review.title}
            </Text>
          )}

          {/* Comment */}
          {review.comment && (
            <Text style={styles.reviewComment} numberOfLines={3}>
              {review.comment}
            </Text>
          )}

          {/* Media Preview */}
          {review.media && review.media.length > 0 && (
            <View style={styles.mediaPreview}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {review.media.slice(0, 3).map((mediaUrl, index) => (
                  <Image
                    key={index}
                    source={{ uri: mediaUrl }}
                    style={styles.mediaThumb}
                  />
                ))}
                {review.media.length > 3 && (
                  <View style={styles.moreMedia}>
                    <Text style={styles.moreMediaText}>
                      +{review.media.length - 3}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </TouchableOpacity>

        {/* Seller Response Section */}
        {hasResponse ? (
          <View style={styles.responseSection}>
            <View style={styles.responseHeader}>
              <View style={styles.responseHeaderLeft}>
                <Ionicons name="chatbubble-ellipses" size={16} color={Colors.primary} />
                <Text style={styles.responseHeaderText}>Your Response</Text>
              </View>
              <View style={styles.responseActions}>
                <TouchableOpacity
                  onPress={() => openResponseModal(review, true)}
                  style={styles.responseActionButton}
                >
                  <Ionicons name="create-outline" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteResponse(review)}
                  style={styles.responseActionButton}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.responseText}>{review.sellerResponse!.response}</Text>
            <Text style={styles.responseDate}>
              {formatDate(review.sellerResponse!.createdAt)}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addResponseButton}
            onPress={() => openResponseModal(review, false)}
          >
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.addResponseText}>Add Response</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading && !refreshing && reviews.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading reviews...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsHeader}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{pagination.total}</Text>
          <Text style={styles.statLabel}>Total Reviews</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {reviews.filter((r) => r.sellerResponse).length}
          </Text>
          <Text style={styles.statLabel}>Responded</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {reviews.filter((r) => !r.sellerResponse).length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Reviews List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
          if (isCloseToBottom) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={80} color={Colors.gray300} />
            <Text style={styles.emptyTitle}>No Reviews Yet</Text>
            <Text style={styles.emptyDescription}>
              Your store hasn't received any reviews yet. Reviews will appear here once
              customers start rating your products.
            </Text>
          </View>
        ) : (
          <>
            {reviews.map(renderReviewCard)}

            {loadingMore && (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingMoreText}>Loading more...</Text>
              </View>
            )}

            {pagination.page >= pagination.pages && reviews.length > 0 && (
              <Text style={styles.endText}>No more reviews</Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Response Modal */}
      <Modal
        visible={responseModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeResponseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={closeResponseModal}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditingResponse ? 'Edit Response' : 'Add Response'}
              </Text>
              <TouchableOpacity onPress={closeResponseModal}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedReview && (
              <View style={styles.modalReviewInfo}>
                <View style={styles.modalReviewHeader}>
                  {renderStars(selectedReview.rating)}
                  <Text style={styles.modalReviewerName}>
                    {selectedReview.user.firstName} {selectedReview.user.lastName}
                  </Text>
                </View>
                {selectedReview.comment && (
                  <Text style={styles.modalReviewComment} numberOfLines={3}>
                    {selectedReview.comment}
                  </Text>
                )}
              </View>
            )}

            <TextInput
              style={styles.responseInput}
              placeholder="Write your response here..."
              placeholderTextColor={Colors.gray400}
              multiline
              numberOfLines={6}
              value={responseText}
              onChangeText={setResponseText}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeResponseModal}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  (!responseText.trim() || submittingResponse) &&
                    styles.modalSubmitButtonDisabled,
                ]}
                onPress={handleSubmitResponse}
                disabled={!responseText.trim() || submittingResponse}
              >
                {submittingResponse ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {isEditingResponse ? 'Update' : 'Submit'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    marginTop: 50,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  statsHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  reviewCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: Colors.gray100,
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productMetaText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  reviewerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray200,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  reviewerDetails: {
    marginLeft: 10,
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: Colors.successLight + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  verifiedText: {
    fontSize: 11,
    color: Colors.successDark,
    fontWeight: '500',
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  reviewComment: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 12,
  },
  mediaPreview: {
    marginBottom: 12,
  },
  mediaThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: Colors.gray100,
  },
  moreMedia: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreMediaText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  responseSection: {
    backgroundColor: Colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  responseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  responseHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  responseActions: {
    flexDirection: 'row',
    gap: 12,
  },
  responseActionButton: {
    padding: 4,
  },
  responseText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 6,
  },
  responseDate: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  addResponseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  addResponseText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  endText: {
    textAlign: 'center',
    fontSize: 14,
    color: Colors.textSecondary,
    paddingVertical: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  modalReviewInfo: {
    backgroundColor: Colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalReviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginLeft: 12,
  },
  modalReviewComment: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  responseInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 120,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalSubmitButtonDisabled: {
    backgroundColor: Colors.disabled,
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default MyStoreReviews;