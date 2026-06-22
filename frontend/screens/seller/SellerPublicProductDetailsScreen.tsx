import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Share,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProduct } from '../../hooks/useProducts';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useProductLike } from '../../hooks/useProductLikes';
import { useCart } from '../../context/CartContext';
import { useProductRecommendations } from '../../hooks/useProductRecommendations';
import { useReviews } from '../../hooks/useReview';
import { Colors, Typography } from '../../constants/colors';
import ProductReviewCard from '../../components/ProductReviewCard';
import ProductCard from '../../components/ProductCard';
import { useChatContext } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');


interface SellerPublicProductDetailsScreenProps {
  route: {
    params: {
      productUrl: string;
      storeUrl: string;
    };
  };
  navigation: any;
}

const SellerPublicProductDetailsScreen: React.FC<SellerPublicProductDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const { productUrl, storeUrl } = route.params;
  const { isGuest } = useAuth();
  const { data: product, isLoading, error, refetch } = useProduct(productUrl);
  const {
    loading: likeLoading,
    likeProduct,
    unlikeProduct,
    checkIfLiked,
    getProductLikeCount,
  } = useProductLike();
  const { addItem } = useCart();
  const {
    getProductsYouMayLike,
    youMayLikeProducts,
    loading: recommendationsLoading
  } = useProductRecommendations();
  const {
    getProductReviews,
    getProductReviewSummary,
    loading: reviewsLoading
  } = useReviews();

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [productReviews, setProductReviews] = useState<any[]>([]);
  const [reviewSummary, setReviewSummary] = useState<any>(null);

  const { startDirectChat } = useChatContext();

  // Modal states
  const [showCartModal, setShowCartModal] = useState(false);
  const [modalAnimation] = useState(new Animated.Value(0));
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    if (product?.id) {
      fetchLikeStatus();
      fetchLikeCount();
      fetchRecommendations();
      fetchProductReviews();
      fetchReviewSummary();
    }
  }, [product?.id]);

  const fetchLikeStatus = async () => {
    if (!product?.id) return;
    try {
      const liked = await checkIfLiked(product.id);
      setIsLiked(liked);
    } catch (err) {
      console.error('Error checking like status:', err);
    }
  };

  const fetchLikeCount = async () => {
    if (!product?.id) return;
    try {
      const count = await getProductLikeCount(product.id);
      setLikeCount(count);
    } catch (err) {
      console.error('Error fetching like count:', err);
    }
  };

  const fetchRecommendations = async () => {
    if (!productUrl) return;
    try {
      await getProductsYouMayLike({ limit: 10 });
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    }
  };

  const fetchProductReviews = async () => {
    if (!product?.id) return;
    try {
      const result = await getProductReviews(product.id, {
        page: 1,
        limit: 5,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      if (result?.reviews) {
        setProductReviews(result.reviews);
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    }
  };

  const fetchReviewSummary = async () => {
    if (!product?.id) return;
    try {
      const summary = await getProductReviewSummary(product.id);
      setReviewSummary(summary);
    } catch (err) {
      console.error('Error fetching review summary:', err);
    }
  };

  const handleLikeToggle = async () => {
    if (!product || likeLoading) return;

    try {
      if (isLiked) {
        await unlikeProduct(product.id);
        setIsLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
      } else {
        await likeProduct(product.id);
        setIsLiked(true);
        setLikeCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      Alert.alert('Error', 'Failed to update like status. Please try again.');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${product?.name} for GH₵${product?.price}!`,
        title: product?.name,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const openCartModal = () => {
    if (!product) return;
    
    // Reset selections
    setSelectedSize(undefined);
    setSelectedColor(undefined);
    setQuantity(1);
    
    setShowCartModal(true);
    Animated.spring(modalAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  };

  const closeCartModal = () => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowCartModal(false);
      setSelectedSize(undefined);
      setSelectedColor(undefined);
      setQuantity(1);
    });
  };

  const handleAddToCart = async () => {
    if (!product) return;

    // Validate size selection if sizes exist
    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      Alert.alert('Select Size', 'Please select a size before adding to cart.');
      return;
    }

    // Validate color selection if colors exist
    if (product.color && product.color.length > 0 && !selectedColor) {
      Alert.alert('Select Color', 'Please select a color before adding to cart.');
      return;
    }
    
    if (isGuest) {
      Alert.alert(
        'Sign In Required',
        'You need to sign in to add items to your cart.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In',
            onPress: () => navigation.navigate('Login'),
            style: 'default'
          },
        ]
      );
      return;
    }

    setAddingToCart(true);
    try {
      await addItem(product.id, quantity, selectedColor, selectedSize);
      
      // Close modal first
      closeCartModal();
      
      // Show success alert after modal closes
      setTimeout(() => {
        Alert.alert(
          'Added to Cart Successfully',
          `${product.name} has been added to your cart.`,
          [
            { 
              text: 'Continue Shopping', 
              style: 'cancel',
              onPress: () => console.log('Continue shopping')
            },
            {
              text: 'View Cart',
              onPress: () => navigation.navigate('CartScreen'),
              style: 'default'
            },
          ]
        );
      }, 300);
    } catch (err) {
      console.error('Error adding to cart:', err);
      Alert.alert(
        'Error', 
        'Failed to add item to cart. Please try again.',
        [{ text: 'OK', style: 'cancel' }]
      );
    } finally {
      setAddingToCart(false);
    }
  };

  const incrementQuantity = () => {
    if (product && quantity < product.stock) {
      setQuantity(quantity + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleStorePress = () => {
    navigation.navigate('SellerPublicStore', {
      storeId: product?.store?.id,
    });
  };

const handleChatPress = async () => {
  if (!product || !product.store) {
    Alert.alert('Error', 'Product information is missing.');
    return;
  }

  if (!product.store.userId) {
    Alert.alert('Error', 'Cannot start chat: store user information missing.');
    return;
  }

  try {
    const chatRoom = await startDirectChat(product.store.userId);

    if (!chatRoom?.id) {
      Alert.alert('Error', 'Failed to open chat room.');
      return;
    }

    navigation.navigate('Chat', {
      chatRoomId: chatRoom.id,
      otherUserName: product.store.name,
      otherUserAvatar: product.store.logo || null,
      otherUserType: 'seller',
      storeName: product.store.name,
      storeLogo: product.store.logo || null,
    });
  } catch (error) {
    console.error('Error opening chat room:', error);
    Alert.alert('Error', 'Failed to start chat. Please try again later.');
  }
};

  const renderStarRating = (rating: number, size: number = 14) => {
    return (
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : star - 0.5 <= rating ? 'star-half' : 'star-outline'}
            size={size}
            color="#FFA500"
          />
        ))}
      </View>
    );
  };

  const modalTranslateY = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <LoadingSpinner size={40} color={Colors.primary} />
        <Text style={styles.loadingText}>Loading product...</Text>
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorTitle}>Product Not Found</Text>
        <Text style={styles.errorText}>
          {error?.message || 'This product may have been removed or is unavailable.'}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View style={styles.imageGallery}>
          {product.images && product.images.length > 0 ? (
            <>
              <Image
                source={{ uri: product.images[selectedImageIndex] }}
                style={styles.mainImage}
                resizeMode="cover"
              />
              {product.images.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.thumbnailContainer}
                >
                  {product.images.map((img, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setSelectedImageIndex(index)}
                      style={[
                        styles.thumbnail,
                        selectedImageIndex === index && styles.thumbnailActive,
                      ]}
                    >
                      <Image source={{ uri: img }} style={styles.thumbnailImage} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </>
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="image-outline" size={64} color={Colors.gray400} />
              <Text style={styles.placeholderText}>No Image Available</Text>
            </View>
          )}

          {/* Top Action Buttons */}
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.topActionsRight}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleLikeToggle}
                disabled={likeLoading}
              >
                {likeLoading ? (
                  <LoadingSpinner size={20} color={Colors.error} />
                ) : (
                  <Ionicons
                    name={isLiked ? "heart" : "heart-outline"}
                    size={20}
                    color={isLiked ? Colors.error : Colors.textPrimary}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Stock Badge */}
          {product.stock > 0 && (
            <View style={styles.stockBadge}>
              <Text style={styles.stockText}>In Stock</Text>
            </View>
          )}
        </View>

        <View style={styles.productContent}>
          {/* Title and Price */}
          <View style={styles.titleSection}>
            <Text style={styles.productName}>{product.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.productPrice}>GH₵ {parseFloat(product.price.toString()).toFixed()}</Text>
              {product.moq && (
                <Text style={styles.moqText}>MOQ: {product.moq} units</Text>
              )}
            </View>
          </View>

          {/* Rating and Sales Info */}
          <View style={styles.statsRow}>
            {reviewSummary && reviewSummary.reviewCount > 0 && (
              <TouchableOpacity
                style={styles.statItem}
                onPress={() => navigation.navigate('ProductReviews', { productId: product.id })}
              >
                {renderStarRating(reviewSummary.averageRating, 14)}
                <Text style={styles.statText}>
                  {reviewSummary.averageRating.toFixed(1)} ({reviewSummary.reviewCount})
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.statItem}>
              <Ionicons name="cube-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.statText}>{product.quantityBought || 0} sold</Text>
            </View>

            <View style={styles.statItem}>
              <Ionicons name="eye-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.statText}>{product.viewCount || 0} views</Text>
            </View>

            <View style={styles.statItem}>
              <Ionicons name="heart" size={16} color={Colors.error} />
              <Text style={styles.statText}>{likeCount}</Text>
            </View>
          </View>

          {/* Category and Tags */}
          <View style={styles.metaRow}>
            {product.category && (
              <View style={styles.categoryBadge}>
                <Ionicons name="pricetag" size={14} color={Colors.white} />
                <Text style={styles.categoryBadgeText}>{product.category}</Text>
              </View>
            )}

            {product.tags?.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>#{tag}</Text>
              </View>
            ))}
          </View>

          {/* Low Stock Warning */}
          {product.stock > 0 && product.stock <= 10 && (
            <View style={styles.warningContainer}>
              <Ionicons name="warning" size={16} color={Colors.warning} />
              <Text style={styles.warningText}>
                Only {product.stock} left in stock - Order soon!
              </Text>
            </View>
          )}

          {/* Store Section */}
          {product.store && (
            <TouchableOpacity style={styles.storeSection} onPress={handleStorePress}>
              <View style={styles.storeInfo}>
                {product.store.logo ? (
                  <Image
                    source={{ uri: product.store.logo }}
                    style={styles.storeLogo}
                  />
                ) : (
                  <View style={styles.storeLogoPlaceholder}>
                    <Text style={styles.storeLogoText}>
                      {product.store.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.storeDetails}>
                  <Text style={styles.storeLabel}>Sold by</Text>
                  <Text style={styles.storeName}>{product.store.name}</Text>
                  {product.store.location && (
                    <View style={styles.locationRow}>
                      <Ionicons name="location" size={12} color={Colors.textSecondary} />
                      <Text style={styles.storeLocation}>{product.store.location}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.storeActions}>
                <TouchableOpacity
                  style={styles.chatStoreBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleChatPress();
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Description */}
          {product.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.descriptionText}>{product.description}</Text>
            </View>
          )}

          {/* Product Specifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specifications</Text>
            <View style={styles.specsGrid}>
              <View style={styles.specItem}>
                <Ionicons name="cube-outline" size={20} color={Colors.primary} />
                <View style={styles.specInfo}>
                  <Text style={styles.specLabel}>Stock</Text>
                  <Text style={styles.specValue}>{product.stock} units</Text>
                </View>
              </View>
              {product.moq && (
                <View style={styles.specItem}>
                  <Ionicons name="cart-outline" size={20} color={Colors.primary} />
                  <View style={styles.specInfo}>
                    <Text style={styles.specLabel}>Min. Order</Text>
                    <Text style={styles.specValue}>{product.moq} units</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Product Reviews Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Customer Reviews</Text>
              {productReviews.length > 0 && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('ProductReviews', { productId: product.id })}
                >
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              )}
            </View>

            {reviewSummary && reviewSummary.reviewCount > 0 && (
              <View style={styles.reviewSummary}>
                <Text style={styles.averageRating}>
                  {reviewSummary.averageRating.toFixed(1)}
                </Text>
                {renderStarRating(reviewSummary.averageRating, 16)}
                <Text style={styles.reviewCount}>
                  Based on {reviewSummary.reviewCount} reviews
                </Text>
              </View>
            )}

            {productReviews.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.reviewsList}
              >
                {productReviews.map((review) => (
                  <ProductReviewCard
                    key={review.id}
                    review={review}
                    onPress={() => navigation.navigate('ProductReviews', { productId: product.id })}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyReviewsContainer}>
                <Ionicons name="chatbox-outline" size={48} color={Colors.gray400} />
                <Text style={styles.emptyReviewsTitle}>No Reviews Yet</Text>
                <Text style={styles.emptyReviewsText}>
                  Be the first to review this product
                </Text>
              </View>
            )}
          </View>

          {/* Recommended Products */}
          {youMayLikeProducts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>You May Also Like</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.recommendationsList}
              >
                {youMayLikeProducts.map((item) => (
                  <ProductCard
                    key={item.id}
                    product={item}
                    onPress={() => navigation.push('SellerPublicProductDetails', {
                      productUrl: item.url,
                      storeUrl: item.store?.url,
                    })}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.stickyBar}>
        <View style={styles.stickyPriceSection}>
          <Text style={styles.stickyPriceLabel}>Price</Text>
          <Text style={styles.stickyPrice}>GH₵ {parseFloat(product.price.toString()).toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.addToCartBtn,
            product.stock === 0 && styles.addToCartBtnDisabled,
          ]}
          onPress={openCartModal}
          disabled={product.stock === 0}
        >
          <Ionicons name="cart-outline" size={20} color={Colors.white} />
          <Text style={styles.addToCartBtnText}>
            {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add to Cart Modal */}
      <Modal
        visible={showCartModal}
        transparent
        animationType="none"
        onRequestClose={closeCartModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeCartModal}
          />
          <Animated.View
            style={[
              styles.modalContent,
              { transform: [{ translateY: modalTranslateY }] },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Select Options</Text>
              <TouchableOpacity onPress={closeCartModal} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Product Preview */}
              <View style={styles.modalProductPreview}>
                {product.images && product.images.length > 0 ? (
                  <Image
                    source={{ uri: product.images[0] }}
                    style={styles.modalProductImage}
                  />
                ) : (
                  <View style={styles.modalProductImagePlaceholder}>
                    <Ionicons name="image-outline" size={32} color={Colors.gray400} />
                  </View>
                )}
                <View style={styles.modalProductInfo}>
                  <Text style={styles.modalProductName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={styles.modalProductPrice}>
                    GH₵ {parseFloat(product.price.toString()).toFixed(2)}
                  </Text>
                  <Text style={styles.modalProductStock}>
                    {product.stock} units available
                  </Text>
                </View>
              </View>

              {/* Size Selection */}
              {product.sizes && product.sizes.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    Select Size <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  <View style={styles.optionsContainer}>
                    {product.sizes.map((size, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.optionBadge,
                          selectedSize === size && styles.optionBadgeSelected,
                        ]}
                        onPress={() => setSelectedSize(size)}
                      >
                        <Text
                          style={[
                            styles.optionBadgeText,
                            selectedSize === size && styles.optionBadgeTextSelected,
                          ]}
                        >
                          {size}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Color Selection */}
              {product.color && product.color.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    Select Color <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  <View style={styles.optionsContainer}>
                    {product.color.map((color, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.optionBadge,
                          selectedColor === color && styles.optionBadgeSelected,
                        ]}
                        onPress={() => setSelectedColor(color)}
                      >
                        <Text
                          style={[
                            styles.optionBadgeText,
                            selectedColor === color && styles.optionBadgeTextSelected,
                          ]}
                        >
                          {color}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Quantity Selector */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Quantity</Text>
                <View style={styles.quantityRow}>
                  <View style={styles.quantitySelector}>
                    <TouchableOpacity
                      style={[
                        styles.quantityBtn,
                        quantity <= 1 && styles.quantityBtnDisabled,
                      ]}
                      onPress={decrementQuantity}
                      disabled={quantity <= 1}
                    >
                      <Ionicons
                        name="remove"
                        size={20}
                        color={quantity <= 1 ? Colors.gray400 : Colors.white}
                      />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{quantity}</Text>
                    <TouchableOpacity
                      style={[
                        styles.quantityBtn,
                        quantity >= product.stock && styles.quantityBtnDisabled,
                      ]}
                      onPress={incrementQuantity}
                      disabled={quantity >= product.stock}
                    >
                      <Ionicons
                        name="add"
                        size={20}
                        color={quantity >= product.stock ? Colors.gray400 : Colors.white}
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.quantityStockText}>
                    Max: {product.stock}
                  </Text>
                </View>
              </View>

              {/* Total Price */}
              <View style={styles.modalTotalSection}>
                <Text style={styles.modalTotalLabel}>Total Price</Text>
                <Text style={styles.modalTotalPrice}>
                  GH₵ {parseFloat((product.price * quantity).toString()).toFixed(2)}
                </Text>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalAddToCartBtn}
                onPress={handleAddToCart}
                disabled={addingToCart}
              >
                {addingToCart ? (
                  <LoadingSpinner size={20} color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="cart" size={20} color={Colors.white} />
                    <Text style={styles.modalAddToCartBtnText}>
                      Add to Cart
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    marginTop: 30,
    marginBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.backgroundSecondary,
  },
  loadingText: {
    marginTop: 12,
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
  },
  errorTitle: {
    fontSize: Typography.xl,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: Typography.regular,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
  },
  scrollView: {
    flex: 1,
  },
  imageGallery: {
    backgroundColor: Colors.white,
    position: 'relative',
  },
  mainImage: {
    width: width,
    height: width,
    backgroundColor: Colors.gray100,
  },
  placeholderImage: {
    width: width,
    height: width,
    backgroundColor: Colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: Typography.base,
    color: Colors.gray500,
    marginTop: 8,
    fontFamily: Typography.medium,
  },
  topActions: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topActionsRight: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  stockBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: Colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stockText: {
    color: Colors.white,
    fontSize: Typography.xs,
    fontFamily: Typography.bold,
  },
  thumbnailContainer: {
    padding: 12,
  },
  thumbnail: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: Colors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: Colors.gray100,
  },
  productContent: {
    backgroundColor: Colors.white,
    marginTop: 8,
    padding: 20,
  },
  titleSection: {
    marginBottom: 12,
  },
  productName: {
    fontSize: Typography['2xl'],
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
    lineHeight: 30,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    fontSize: 28,
    fontFamily: Typography.bold,
    color: Colors.primary,
  },
  moqText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontFamily: Typography.medium,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
  },
  starContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  categoryBadgeText: {
    color: Colors.white,
    fontSize: Typography.xs,
    fontFamily: Typography.semiBold,
  },
  tagBadge: {
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagBadgeText: {
    color: Colors.primary,
    fontSize: Typography.xs,
    fontFamily: Typography.semiBold,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningLight,
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  warningText: {
    fontSize: Typography.sm,
    color: Colors.warning,
    fontFamily: Typography.semiBold,
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
  },
  seeAllText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontFamily: Typography.semiBold,
  },
  storeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storeLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.gray200,
  },
  storeLogoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeLogoText: {
    fontSize: Typography['2xl'],
    fontFamily: Typography.bold,
    color: Colors.white,
  },
  storeDetails: {
    marginLeft: 12,
    flex: 1,
  },
  storeLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontFamily: Typography.regular,
  },
  storeName: {
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storeLocation: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontFamily: Typography.regular,
  },
  storeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatStoreBtn: {
    width: 40,
    height: 40,
    backgroundColor: Colors.white,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  descriptionText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    lineHeight: 24,
    fontFamily: Typography.regular,
  },
  specsGrid: {
    gap: 12,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  specInfo: {
    flex: 1,
  },
  specLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontFamily: Typography.regular,
  },
  specValue: {
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
  },
  noteContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.infoLight,
    padding: 14,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
    gap: 10,
    marginBottom: 24,
  },
  noteText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    flex: 1,
    fontFamily: Typography.regular,
  },
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  averageRating: {
    fontSize: 36,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
  },
  reviewCount: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginLeft: 'auto',
    fontFamily: Typography.regular,
  },
  reviewsList: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  recommendationsList: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  emptyReviewsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderStyle: 'dashed',
  },
  emptyReviewsTitle: {
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyReviewsText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontFamily: Typography.regular,
  },
  bottomSpacer: {
    height: 100,
  },
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: Colors.white,
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
    alignItems: 'center',
  },
  stickyPriceSection: {
    flex: 1,
  },
  stickyPriceLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontFamily: Typography.regular,
  },
  stickyPrice: {
    fontSize: Typography.xl,
    fontFamily: Typography.bold,
    color: Colors.primary,
  },
  addToCartBtn: {
    flex: 1.5,
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addToCartBtnDisabled: {
    backgroundColor: Colors.gray300,
  },
  addToCartBtnText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontFamily: Typography.bold,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.gray300,
    borderRadius: 2,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalProductPreview: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  modalProductImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.gray100,
  },
  modalProductImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalProductInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  modalProductName: {
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalProductPrice: {
    fontSize: Typography.lg,
    fontFamily: Typography.bold,
    color: Colors.primary,
    marginBottom: 4,
  },
  modalProductStock: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontFamily: Typography.regular,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  requiredMark: {
    color: Colors.error,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionBadge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  optionBadgeSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  optionBadgeText: {
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    fontFamily: Typography.medium,
  },
  optionBadgeTextSelected: {
    color: Colors.primary,
    fontFamily: Typography.bold,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.backgroundSecondary,
    padding: 8,
    borderRadius: 12,
  },
  quantityBtn: {
    width: 36,
    height: 36,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityBtnDisabled: {
    backgroundColor: Colors.gray300,
  },
  quantityText: {
    fontSize: Typography.lg,
    fontFamily: Typography.bold,
    color: Colors.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },
  quantityStockText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.medium,
  },
  modalTotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  modalTotalLabel: {
    fontSize: Typography.base,
    fontFamily: Typography.semiBold,
    color: Colors.textPrimary,
  },
  modalTotalPrice: {
    fontSize: Typography['2xl'],
    fontFamily: Typography.bold,
    color: Colors.primary,
  },
  modalFooter: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  modalAddToCartBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  modalAddToCartBtnText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontFamily: Typography.bold,
  },
});

export default SellerPublicProductDetailsScreen;