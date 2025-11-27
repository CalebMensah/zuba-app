import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useReviews, Review } from '../../hooks/useReview';

interface RouteParams {
  orderId: string;
  productId: string;
  productName: string;
  productImage: string;
}

interface MediaItem {
  uri: string;
  type: 'image' | 'video';
  name: string;
  isExisting?: boolean; // To track if it's from an existing review
}

export default function ManageReviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId, productId, productName, productImage } = route.params as RouteParams;
  
  const {
    createReview,
    getMyReviews,
    updateReview,
    deleteReview,
    loading
  } = useReviews();
  
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingReview, setLoadingReview] = useState(true);

  useEffect(() => {
    checkExistingReview();
  }, []);

  const checkExistingReview = async () => {
    try {
      setLoadingReview(true);
      const reviews = await getMyReviews();
      
      // Find review for this product and order
      const review = reviews.find(
        (r) => r.productId === productId && r.orderId === orderId
      );

      if (review) {
        setExistingReview(review);
        setRating(review.rating);
        setTitle(review.title || '');
        setComment(review.comment || '');
        
        // Convert existing media URLs to MediaItem format
        if (review.media && review.media.length > 0) {
          const existingMedia: MediaItem[] = review.media.map((url, index) => ({
            uri: url,
            type: 'image',
            name: `existing-${index}`,
            isExisting: true,
          }));
          setMedia(existingMedia);
        }
        
        setIsEditMode(true);
      }
    } catch (error: any) {
      console.error('Error checking existing review:', error);
    } finally {
      setLoadingReview(false);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photos to upload review images.'
        );
        return false;
      }
    }
    return true;
  };

  const pickMedia = async () => {
    if (media.length >= 5) {
      Alert.alert('Limit Reached', 'You can only upload up to 5 images/videos.');
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets) {
      const newMedia: MediaItem[] = result.assets
        .slice(0, 5 - media.length)
        .map((asset) => {
          const assetType = asset.type === 'video' || asset.type === 'pairedVideo' ? 'video' : 'image';
          return {
            uri: asset.uri,
            type: assetType,
            name: asset.uri.split('/').pop() || 'media',
            isExisting: false,
          } as MediaItem;
        });
      
      setMedia([...media, ...newMedia]);
    }
  };

  const removeMedia = (index: number) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating.');
      return;
    }

    if (!comment.trim()) {
      Alert.alert('Comment Required', 'Please write a comment about the product.');
      return;
    }

    try {
      setSubmitting(true);

      if (isEditMode && existingReview) {
        // Update existing review
        await updateReview(existingReview.id, {
          rating,
          title: title.trim() || undefined,
          comment: comment.trim(),
        });

        Alert.alert(
          'Success!',
          'Review updated successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        // Create new review
        const mediaFiles = media
          .filter(item => !item.isExisting)
          .map((item) => ({
            uri: item.uri,
            type: item.type === 'video' ? 'video/mp4' : 'image/jpeg', // Adjust MIME types as needed
            name: item.name,
          }));

        const result = await createReview({
          orderId,
          productId,
          rating,
          title: title.trim() || undefined,
          comment: comment.trim(),
          media: mediaFiles.length > 0 ? mediaFiles : undefined,
        });

        Alert.alert(
          'Success!',
          `Review submitted successfully! You earned ${result.awardedPoints} points.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!existingReview) return;

    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete this review? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              await deleteReview(existingReview.id);
              
              Alert.alert(
                'Deleted',
                'Your review has been deleted successfully.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete review.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
            disabled={submitting}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={40}
              color={star <= rating ? '#FFD700' : '#D1D5DB'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loadingReview) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading review...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          disabled={submitting}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Edit Review' : 'Write a Review'}
        </Text>
        {isEditMode && (
          <TouchableOpacity
            onPress={handleDelete}
            style={styles.deleteButton}
            disabled={submitting}
          >
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        )}
        {!isEditMode && <View style={styles.placeholder} />}
      </View>

      {/* Product Info */}
      <View style={styles.productCard}>
        <Image source={{ uri: productImage }} style={styles.productImage} />
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {productName}
          </Text>
          <Text style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            {' '}Verified Purchase
          </Text>
        </View>
      </View>

      {/* Edit Mode Badge */}
      {isEditMode && (
        <View style={styles.editModeBadge}>
          <Ionicons name="create-outline" size={18} color="#3B82F6" />
          <Text style={styles.editModeText}>
            You're editing your existing review
          </Text>
        </View>
      )}

      {/* Rating Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Your Rating <Text style={styles.required}>*</Text>
        </Text>
        {renderStars()}
        {rating > 0 && (
          <Text style={styles.ratingText}>
            {rating === 1 && 'Poor'}
            {rating === 2 && 'Fair'}
            {rating === 3 && 'Good'}
            {rating === 4 && 'Very Good'}
            {rating === 5 && 'Excellent'}
          </Text>
        )}
      </View>

      {/* Title Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Review Title (Optional)</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="Summarize your experience"
          placeholderTextColor="#9CA3AF"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          editable={!submitting}
        />
        <Text style={styles.charCount}>{title.length}/100</Text>
      </View>

      {/* Comment Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Your Review <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.commentInput}
          placeholder="Share your thoughts about this product..."
          placeholderTextColor="#9CA3AF"
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={1000}
          editable={!submitting}
        />
        <Text style={styles.charCount}>{comment.length}/1000</Text>
      </View>

      {/* Media Upload Section */}
      {!isEditMode && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Photos/Videos (Optional)</Text>
          <Text style={styles.sectionSubtitle}>
            Help others by sharing images or videos
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mediaScroll}
          >
            {media.map((item, index) => (
              <View key={index} style={styles.mediaItem}>
                <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
                {!item.isExisting && (
                  <TouchableOpacity
                    style={styles.removeMediaButton}
                    onPress={() => removeMedia(index)}
                    disabled={submitting}
                  >
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {media.length < 5 && (
              <TouchableOpacity
                style={styles.addMediaButton}
                onPress={pickMedia}
                disabled={submitting}
              >
                <Ionicons name="camera" size={32} color="#6B7280" />
                <Text style={styles.addMediaText}>Add Media</Text>
                <Text style={styles.mediaLimit}>{media.length}/5</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {/* Existing Media Display (Edit Mode) */}
      {isEditMode && media.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attached Media</Text>
          <Text style={styles.sectionSubtitle}>
            Media cannot be edited. Delete and create a new review to change images.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mediaScroll}
          >
            {media.map((item, index) => (
              <View key={index} style={styles.mediaItem}>
                <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
                <View style={styles.existingMediaBadge}>
                  <Ionicons name="lock-closed" size={12} color="#FFF" />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Points Info */}
      {!isEditMode && (
        <View style={styles.pointsCard}>
          <Ionicons name="gift" size={24} color="#F59E0B" />
          <Text style={styles.pointsText}>
            You'll earn <Text style={styles.pointsBold}>50 points</Text> for this review!
          </Text>
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (submitting || rating === 0 || !comment.trim()) && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={submitting || rating === 0 || !comment.trim()}
      >
        {submitting ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.submitButtonText}>
            {isEditMode ? 'Update Review' : 'Submit Review'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  deleteButton: {
    padding: 4,
  },
  placeholder: {
    width: 32,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    margin: 16,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  verifiedBadge: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  editModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editModeText: {
    fontSize: 13,
    color: '#1E40AF',
    marginLeft: 8,
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  required: {
    color: '#EF4444',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 8,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  mediaScroll: {
    marginTop: 8,
  },
  mediaItem: {
    marginRight: 12,
    position: 'relative',
  },
  mediaPreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  removeMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  existingMediaBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  addMediaButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  addMediaText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  mediaLimit: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  pointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pointsText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
  },
  pointsBold: {
    fontWeight: '700',
    color: '#78350F',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 32,
  },
});