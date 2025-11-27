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
const CARD_WIDTH = width * 0.45;

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    images: string[];
    stock: number;
    category?: string;
    quantityBought?: number;
    viewCount?: number;
    store?: {
      id: string;
      name: string;
      url: string;
      logo?: string;
      location?: string;
    };
  };
  onPress?: () => void;
  showStore?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onPress,
  showStore = true 
}) => {
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {product.images && product.images.length > 0 ? (
          <Image
            source={{ uri: product.images[0] }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={40} color={Colors.gray400} />
          </View>
        )}

        {/* Stock Badge */}
        {product.stock <= 10 && product.stock > 0 && (
          <View style={styles.stockBadge}>
            <Text style={styles.stockBadgeText}>Only {product.stock} left</Text>
          </View>
        )}

        {product.stock === 0 && (
          <View style={styles.outOfStockBadge}>
            <Text style={styles.outOfStockText}>Out of Stock</Text>
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.infoContainer}>
        {/* Category */}
        {product.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{product.category}</Text>
          </View>
        )}

        {/* Product Name */}
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Price */}
        <Text style={styles.productPrice}>GH₵ {product.price.toFixed(2)}</Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {product.quantityBought !== undefined && (
            <View style={styles.statItem}>
              <Ionicons name="cart-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.statText}>{product.quantityBought}</Text>
            </View>
          )}
          {product.viewCount !== undefined && (
            <View style={styles.statItem}>
              <Ionicons name="eye-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.statText}>{product.viewCount}</Text>
            </View>
          )}
        </View>

        {/* Store Info */}
        {showStore && product.store && (
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
            <Text style={styles.storeName} numberOfLines={1}>
              {truncateText(product.store.name, 20)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH,
    backgroundColor: Colors.gray100,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray200,
  },
  stockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  outOfStockText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  infoContainer: {
    padding: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  categoryText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
    lineHeight: 18,
    minHeight: 36,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  storeLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.gray200,
  },
  storeLogoPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeLogoText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  storeName: {
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },
});

export default ProductCard;