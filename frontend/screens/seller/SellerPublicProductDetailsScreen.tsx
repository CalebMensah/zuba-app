import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Share,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useProduct } from '../../hooks/useProducts';
import { useProductLike } from '../../hooks/useProductLikes';
import { useCart } from '../../context/CartContext';
import { useProductRecommendations } from '../../hooks/useProductRecommendations';
import { useReviews } from '../../hooks/useReview';
import { Colors } from '../../constants/colors';
import ProductReviewCard from '../../components/ProductReviewCard';
import ProductCard from '../../components/ProductCard';
import ChatApiService from '../../services/chatApiServices';

const { width } = Dimensions.get('window');

const chatApiService = new ChatApiService(process.env.EXPO_PUBLIC_API_URL); 

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
  const { getProductByUrl, product, loading, error } = useProduct();
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
  const [quantity, setQuantity] = useState(1);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [productReviews, setProductReviews] = useState<any[]>([]);
  const [reviewSummary, setReviewSummary] = useState<any>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  useEffect(() => {
    if (productUrl) {
      fetchProduct();
    }
  }, [productUrl]);

  useEffect(() => {
    if (product?.id) {
      fetchLikeStatus();
      fetchLikeCount();
      fetchRecommendations();
      fetchProductReviews();
      fetchReviewSummary();
    }
  }, [product?.id]);

  const fetchProduct = async () => {
    await getProductByUrl(productUrl);
  };

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

    setAddingToCart(true);
    try {
      await addItem(product.id, quantity);
      Alert.alert(
        'Success',
        `${product.name} has been added to your cart!`,
        [
          { text: 'Continue Shopping', style: 'cancel' },
          {
            text: 'View Cart',
            onPress: () => navigation.navigate('CartScreen'),
          },
        ]
      );
    } catch (err) {
      console.error('Error adding to cart:', err);
      Alert.alert('Error', 'Failed to add item to cart. Please try again.');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleStorePress = () => {
    navigation.navigate('SellerPublicStore', {
      storeId: product?.store?.id,
    });
  };

  const handleReviewwsPress = () => {
    navigation.navigate('ProductReviews', { productId: product?.id
    });
  }

  const handleChatPress = async () => {
    if (!product?.id || !product.store) {
      Alert.alert('Error', 'Cannot start chat: product or store information missing.');
      return;
    }
    try {
      const response = await chatApiService.getOrCreateProductChatRoom(product.id);
      const chatRoom = response?.data;
      if (!chatRoom || !chatRoom.id) {
        Alert.alert('Error', 'Failed to open chat room.');
        return;
      }
      navigation.navigate('Chat', {
        chatRoomId: chatRoom.id,
        otherUserName: product.store.name,
        otherUserAvatar: product.store.logo || null,
      });
    } catch (error) {
      console.error('Error opening chat room:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again later.');
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

  const renderStarRating = (rating: number) => {
    return (
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : star - 0.5 <= rating ? 'star-half' : 'star-outline'}
            size={16}
            color={Colors.warning}
          />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
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
          {error || 'This product may have been removed or is unavailable.'}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchProduct}>
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
                  <ActivityIndicator size="small" color={Colors.error} />
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

          {/* Discount Badge (if applicable) */}
          {product.stock > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>In Stock</Text>
            </View>
          )}
        </View>

        <View style={styles.productContent}>
          {/* Title and Price */}
          <View style={styles.titleSection}>
            <Text style={styles.productName}>{product.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.productPrice}>GH₵ {product.price.toFixed(2)}</Text>
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
                {renderStarRating(reviewSummary.averageRating)}
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

          {/* Size Selection */}
          {product.sizes && product.sizes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Size</Text>
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
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Color</Text>
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

          {/* Quantity Selector - Inline with description */}
          {product.stock > 0 && (
            <View style={styles.quantitySection}>
              <Text style={styles.sectionTitle}>Quantity</Text>
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
              {product.weight && (
                <View style={styles.specItem}>
                  <Ionicons name="scale-outline" size={20} color={Colors.primary} />
                  <View style={styles.specInfo}>
                    <Text style={styles.specLabel}>Weight</Text>
                    <Text style={styles.specValue}>{product.weight} kg</Text>
                  </View>
                </View>
              )}
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

          {/* Seller Note */}
          {product.sellerNote && (
            <View style={styles.noteContainer}>
              <Ionicons name="information-circle" size={20} color={Colors.info} />
              <Text style={styles.noteText}>{product.sellerNote}</Text>
            </View>
          )}

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
      {renderStarRating(reviewSummary.averageRating)}
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
          <Text style={styles.stickyPriceLabel}>Total Price</Text>
          <Text style={styles.stickyPrice}>
            GH₵ {(product.price * quantity).toFixed(2)}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.addToCartBtn,
            (product.stock === 0 || addingToCart) && styles.addToCartBtnDisabled,
          ]}
          onPress={handleAddToCart}
          disabled={product.stock === 0 || addingToCart}
        >
          {addingToCart ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Ionicons name="cart-outline" size={20} color={Colors.white} />
              <Text style={styles.addToCartBtnText}>
                {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    marginTop: 30,
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
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 16,
    color: Colors.gray500,
    marginTop: 8,
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
  discountBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: Colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  discountText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: 'bold',
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
    fontSize: 22,
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    color: Colors.primary,
  },
  moqText: {
    fontSize: 13,
    color: Colors.textSecondary,
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
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
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
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
    fontSize: 12,
    fontWeight: '600',
  },
  tagBadge: {
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagBadgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 13,
    color: Colors.warning,
    fontWeight: '600',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
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
    backgroundColor: Colors.primaryLight,
  },
  optionBadgeText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  optionBadgeTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  quantitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginBottom: 16,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    minWidth: 30,
    textAlign: 'center',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
  storeDetails: {
    marginLeft: 12,
    flex: 1,
  },
  storeLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storeLocation: {
    fontSize: 12,
    color: Colors.textSecondary,
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
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
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
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  specValue: {
    fontSize: 15,
    fontWeight: '600',
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
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    flex: 1,
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
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  reviewCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 'auto',
  },
  reviewsList: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  recommendationsList: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
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
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  stickyPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  addToCartBtn: {
    flex: 1.5,
    flexDirection: 'row',
    backgroundColor: Colors.success,
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
    fontSize: 16,
    fontWeight: 'bold',
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
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyReviewsText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  viewAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.white,
    borderRadius: 8,
    color: Colors.primary,
  },
  viewAll: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default SellerPublicProductDetailsScreen;