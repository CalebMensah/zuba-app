import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { usePoints, Product, PointsBalance } from '../../hooks/usePoints';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const RedeemPointsScreen = () => {
  const navigation = useNavigation();
  const { 
    getPointsBalance, 
    getRedeemableProducts, 
    loading, 
    error, 
    clearError 
  } = usePoints();

  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const loadData = async () => {
    const [balanceData, productsData] = await Promise.all([
      getPointsBalance(),
      getRedeemableProducts(50),
    ]);

    if (balanceData) {
      setBalance(balanceData);
    }

    if (productsData) {
      setProducts(productsData.products);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleProductPress = (product: Product) => {
    const requiredPoints = Math.ceil(product.price / (balance?.conversionRate || 1));
    
    if (!balance || balance.points < requiredPoints) {
      Alert.alert(
        'Insufficient Points',
        `You need ${requiredPoints} points to redeem this product. You currently have ${balance?.points || 0} points.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setSelectedProduct(product);
    (navigation as any).navigate('RedeemCheckout', { 
      product, 
      requiredPoints,
      currentBalance: balance.points 
    });
  };

  const renderPointsCard = () => (
    <View style={styles.pointsCard}>
      <View style={styles.pointsHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="gift" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.pointsTitle}>Your Points Balance</Text>
      </View>

      <View style={styles.pointsContent}>
        <View style={styles.pointsRow}>
          <Text style={styles.pointsLabel}>Available Points</Text>
          <Text style={styles.pointsValue}>
            {balance?.points.toLocaleString() || '0'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.pointsRow}>
          <Text style={styles.pointsLabel}>Cash Equivalent</Text>
          <Text style={styles.cedisValue}>
            GHS {balance?.cedisEquivalent.toFixed(2) || '0.00'}
          </Text>
        </View>

        <View style={styles.conversionNote}>
          <Ionicons name="information-circle" size={16} color={Colors.info} />
          <Text style={styles.conversionText}>
            1 Point = GHS {balance?.conversionRate.toFixed(2) || '1.00'}
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.historyButton}
        onPress={() => (navigation as any).navigate('PointsHistory')}
      >
        <Text style={styles.historyButtonText}>View Redemption History</Text>
        <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderProductCard = ({ item }: { item: Product }) => {
    const requiredPoints = Math.ceil(item.price / (balance?.conversionRate || 1));
    const canAfford = balance && balance.points >= requiredPoints;
    const imageUri = Array.isArray(item.images) && item.images.length > 0 
      ? item.images[0] 
      : 'https://via.placeholder.com/200';

    return (
      <TouchableOpacity
        style={[
          styles.productCard,
          !canAfford && styles.productCardDisabled
        ]}
        onPress={() => handleProductPress(item)}
        disabled={!canAfford}
      >
        <View style={styles.productImageContainer}>
          <Image 
            source={{ uri: imageUri }} 
            style={styles.productImage}
            resizeMode="cover"
          />
          {!canAfford && (
            <View style={styles.insufficientBadge}>
              <Ionicons name="lock-closed" size={12} color={Colors.white} />
              <Text style={styles.insufficientText}>Insufficient</Text>
            </View>
          )}
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.priceContainer}>
            <View style={styles.pointsTag}>
              <Ionicons name="gift" size={14} color={Colors.primary} />
              <Text style={styles.pointsPrice}>
                {requiredPoints.toLocaleString()}
              </Text>
            </View>
            <Text style={styles.cedisPrice}>
              GHS {item.price.toFixed(2)}
            </Text>
          </View>

          {item.stock > 0 && item.stock <= 5 && (
            <View style={styles.stockWarning}>
              <Text style={styles.stockWarningText}>
                Only {item.stock} left!
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="gift-outline" size={64} color={Colors.gray300} />
      <Text style={styles.emptyTitle}>No Products Available</Text>
      <Text style={styles.emptyText}>
        {balance && balance.points === 0
          ? 'You don\'t have any points yet. Make purchases to earn points!'
          : 'Check back later for more redeemable products.'}
      </Text>
    </View>
  );

  if (loading && !refreshing && !balance) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your points...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        renderItem={renderProductCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={
          <>
            {renderPointsCard()}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Redeemable Products</Text>
              <Text style={styles.sectionSubtitle}>
                {products.length} {products.length === 1 ? 'item' : 'items'} available
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={products.length > 0 ? styles.columnWrapper : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  pointsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.infoLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  pointsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  pointsContent: {
    marginBottom: 16,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pointsLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  pointsValue: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  cedisValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.success,
  },
  conversionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.infoLight,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  conversionText: {
    fontSize: 13,
    color: Colors.info,
    marginLeft: 8,
    fontWeight: '500',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
  },
  historyButtonText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600',
    marginRight: 4,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  productCardDisabled: {
    opacity: 0.6,
  },
  productImageContainer: {
    width: '100%',
    height: CARD_WIDTH * 0.9,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: Colors.gray100,
  },
  insufficientBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  insufficientText: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '600',
    marginLeft: 4,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
    height: 36,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pointsPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 4,
  },
  cedisPrice: {
    fontSize: 12,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  stockWarning: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: Colors.warningLight,
    borderRadius: 4,
  },
  stockWarningText: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});

export default RedeemPointsScreen;