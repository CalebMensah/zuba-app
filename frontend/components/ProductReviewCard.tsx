import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;

interface ProductReviewCardProps {
  review: {
    id: string;
    rating: number;
    title?: string;
    comment?: string;
    media: string[];
    isVerified: boolean;
    createdAt: string;
    user: {
      firstName: string;
      lastName: string;
      avatar?: string;
    };
    _count?: {
      likes: number;
    };
  };
  onPress?: () => void;
}

const ProductReviewCard: React.FC<ProductReviewCardProps> = ({ review, onPress }) => {
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

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={14}
            color={Colors.warning}
          />
        ))}
      </View>
    );
  };

  const getUserInitials = () => {
    return `${review.user.firstName.charAt(0)}${review.user.lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {review.user.avatar ? (
            <Image source={{ uri: review.user.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{getUserInitials()}</Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>
                {review.user.firstName} {review.user.lastName}
              </Text>
              {review.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>
            <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
          </View>
        </View>
        {renderStars(review.rating)}
      </View>

      {/* Title */}
      {review.title && (
        <Text style={styles.reviewTitle} numberOfLines={1}>
          {review.title}
        </Text>
      )}

      {/* Comment */}
      {review.comment && (
        <Text style={styles.reviewComment} numberOfLines={3}>
          {review.comment}
        </Text>
      )}

      {/* Media Gallery */}
      {review.media && review.media.length > 0 && (
        <View style={styles.mediaContainer}>
          {review.media.slice(0, 3).map((mediaUrl, index) => (
            <Image
              key={index}
              source={{ uri: mediaUrl }}
              style={styles.mediaImage}
            />
          ))}
          {review.media.length > 3 && (
            <View style={styles.moreMediaOverlay}>
              <Text style={styles.moreMediaText}>+{review.media.length - 3}</Text>
            </View>
          )}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.likesContainer}>
          <Ionicons name="heart-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.likesText}>
            {review._count?.likes || 0} {review._count?.likes === 1 ? 'like' : 'likes'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  userDetails: {
    marginLeft: 10,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  verifiedText: {
    fontSize: 10,
    color: Colors.success,
    fontWeight: '600',
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  starsContainer: {
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
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  mediaContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    position: 'relative',
  },
  mediaImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: Colors.gray200,
  },
  moreMediaOverlay: {
    position: 'absolute',
    right: 0,
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreMediaText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likesText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});

export default ProductReviewCard;