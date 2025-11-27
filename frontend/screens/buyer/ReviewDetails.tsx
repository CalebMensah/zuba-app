import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../../constants/colors';
import useReviews, { Review } from '../../hooks/useReview';

const { width } = Dimensions.get('window');

type RootStackParamList = {
  ReviewDetails: { reviewId: string };
  ProductDetails: { productId: string };
  UserProfile: { userId: string };
};

type ReviewDetailsRouteProp = RouteProp<RootStackParamList, 'ReviewDetails'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ReviewDetails: React.FC = () => {
  const route = useRoute<ReviewDetailsRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { reviewId } = route.params;

  const { getReviewById, likeReview, unlikeReview, reportReview, loading } = useReviews();
  
  const [review, setReview] = useState<Review | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isLikeLoading, setIsLikeLoading] = useState(false);

  useEffect(() => {
    fetchReviewDetails();
  }, [reviewId]);

  const fetchReviewDetails = async () => {
    try {
      const data = await getReviewById(reviewId);
      setReview(data);
      setLikeCount(data._count?.likes || 0);
      // Check if current user has liked (you might need to implement this based on your auth)
      // setIsLiked(data.likes?.some(like => like.userId === currentUserId));
    } catch (error) {
      Alert.alert('Error', 'Failed to load review details');
      navigation.goBack();
    }
  };

  const handleLikeToggle = async () => {
    if (isLikeLoading) return;
    
    setIsLikeLoading(true);
    try {
      if (isLiked) {
        const result = await unlikeReview(reviewId);
        setLikeCount(result.likeCount);
        setIsLiked(false);
      } else {
        const result = await likeReview(reviewId);
        setLikeCount(result.likeCount);
        setIsLiked(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update like status');
    } finally {
      setIsLikeLoading(false);
    }
  };

  const handleReport = () => {
    Alert.alert(
      'Report Review',
      'Why are you reporting this review?',
      [
        {
          text: 'Spam',
          onPress: () => submitReport('SPAM'),
        },
        {
          text: 'Inappropriate Content',
          onPress: () => submitReport('INAPPROPRIATE'),
        },
        {
          text: 'Fake Review',
          onPress: () => submitReport('FAKE'),
        },
        {
          text: 'Other',
          onPress: () => submitReport('OTHER'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const submitReport = async (reason: string) => {
    try {
      await reportReview(reviewId, { reason });
      Alert.alert('Success', 'Thank you for reporting. We will review this.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to report review');
    }
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={20}
            color={star <= rating ? Colors.warning : Colors.gray300}
          />
        ))}
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  if (loading || !review) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading review...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Details</Text>
          <TouchableOpacity onPress={handleReport} style={styles.reportButton}>
            <Ionicons name="flag-outline" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Product Info */}
        {review.product && (
          <TouchableOpacity
            style={styles.productCard}
            onPress={() => navigation.navigate('ProductDetails', { productId: review.productId })}
          >
            <Image
              source={{ uri: review.product.images[0] }}
              style={styles.productImage}
            />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {review.product.name}
              </Text>
              <View style={styles.productMeta}>
                <Ionicons name="cube-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.productMetaText}>View Product</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Review Content */}
        <View style={styles.reviewCard}>
          {/* Reviewer Info */}
          <View style={styles.reviewerSection}>
            <TouchableOpacity
              style={styles.reviewerInfo}
              onPress={() => navigation.navigate('UserProfile', { userId: review.userId })}
            >
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
                <View style={styles.reviewerNameRow}>
                  <Text style={styles.reviewerName}>
                    {review.user.firstName} {review.user.lastName}
                  </Text>
                  {review.isVerified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={styles.verifiedText}>Verified Purchase</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Rating */}
          <View style={styles.ratingSection}>
            {renderStars(review.rating)}
            <Text style={styles.ratingText}>{review.rating}.0 out of 5</Text>
          </View>

          {/* Title */}
          {review.title && (
            <Text style={styles.reviewTitle}>{review.title}</Text>
          )}

          {/* Comment */}
          {review.comment && (
            <Text style={styles.reviewComment}>{review.comment}</Text>
          )}

          {/* Media Gallery */}
          {review.media && review.media.length > 0 && (
            <View style={styles.mediaSection}>
              <Text style={styles.mediaSectionTitle}>Photos</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.mediaGallery}
              >
                {review.media.map((mediaUrl, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedImageIndex(index)}
                    style={styles.mediaItem}
                  >
                    <Image source={{ uri: mediaUrl }} style={styles.mediaImage} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Seller Response */}
          {review.sellerResponse && (
            <View style={styles.sellerResponseSection}>
              <View style={styles.sellerResponseHeader}>
                <Ionicons name="storefront" size={18} color={Colors.primary} />
                <Text style={styles.sellerResponseTitle}>Seller Response</Text>
              </View>
              <Text style={styles.sellerResponseText}>
                {review.sellerResponse.response}
              </Text>
              <Text style={styles.sellerResponseDate}>
                {formatDate(review.sellerResponse.createdAt)}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleLikeToggle}
              disabled={isLikeLoading}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={24}
                color={isLiked ? Colors.accent : Colors.textSecondary}
              />
              <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
                {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
              </Text>
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="share-social-outline" size={24} color={Colors.textSecondary} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Order Info */}
        {review.order && (
          <View style={styles.orderInfoCard}>
            <Text style={styles.orderInfoTitle}>Order Information</Text>
            <View style={styles.orderInfoRow}>
              <Text style={styles.orderInfoLabel}>Order ID:</Text>
              <Text style={styles.orderInfoValue}>{review.orderId}</Text>
            </View>
            <View style={styles.orderInfoRow}>
              <Text style={styles.orderInfoLabel}>Purchase Date:</Text>
              <Text style={styles.orderInfoValue}>
                {new Date(review.order.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Full Screen Image Modal */}
      {selectedImageIndex !== null && review.media && (
        <View style={styles.fullScreenModal}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedImageIndex(null)}
          >
            <Ionicons name="close" size={32} color={Colors.white} />
          </TouchableOpacity>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: selectedImageIndex * width, y: 0 }}
          >
            {review.media.map((mediaUrl, index) => (
              <Image
                key={index}
                source={{ uri: mediaUrl }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            ))}
          </ScrollView>
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {selectedImageIndex + 1} / {review.media.length}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  scrollView: {
    flex: 1,
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  reportButton: {
    padding: 8,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.white,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  productImage: {
    width: 60,
    height: 60,
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
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  reviewCard: {
    backgroundColor: Colors.white,
    marginTop: 8,
    padding: 16,
  },
  reviewerSection: {
    marginBottom: 16,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.gray200,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
  },
  reviewerDetails: {
    flex: 1,
    marginLeft: 12,
  },
  reviewerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginRight: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 11,
    color: Colors.successDark,
    marginLeft: 4,
    fontWeight: '500',
  },
  reviewDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
    marginBottom: 16,
  },
  mediaSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  mediaSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  mediaGallery: {
    flexDirection: 'row',
  },
  mediaItem: {
    marginRight: 12,
  },
  mediaImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: Colors.gray100,
  },
  sellerResponseSection: {
    backgroundColor: Colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  sellerResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sellerResponseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 6,
  },
  sellerResponseText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 6,
  },
  sellerResponseDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 6,
  },
  actionTextActive: {
    color: Colors.accent,
    fontWeight: '500',
  },
  actionDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  orderInfoCard: {
    backgroundColor: Colors.white,
    marginTop: 8,
    padding: 16,
    marginBottom: 24,
  },
  orderInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  orderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  orderInfoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  orderInfoValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  fullScreenModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: Colors.overlay,
    borderRadius: 20,
    padding: 8,
  },
  fullScreenImage: {
    width,
    height: '100%',
  },
  imageCounter: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: Colors.overlay,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageCounterText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ReviewDetails;