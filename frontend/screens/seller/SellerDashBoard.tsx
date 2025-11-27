import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Share,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { SellerStackParamList } from '../../types/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { useSellerDashboard } from '../../hooks/useSellerDashboard';
import { useStore } from '../../hooks/useStore';
import { Colors } from '../../constants/colors';


const { width } = Dimensions.get('window');

export default function SellerDashboardScreen() {
  const navigation = useNavigation<NavigationProp<SellerStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  
  const {
    summary,
    salesAnalytics,
    topProducts,
    orderAnalytics,
    storePerformance,
    loading,
    error,
    fetchSummary,
    fetchSalesAnalytics,
    fetchTopProducts,
    fetchOrderAnalytics,
    fetchStorePerformance,
    refreshAll,
  } = useSellerDashboard();

  const { store, getUserStore } = useStore();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    await getUserStore();
    await fetchSummary();
    await fetchSalesAnalytics('7d');
    await fetchTopProducts(5);
    await fetchOrderAnalytics();
    await fetchStorePerformance();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleCopyUrl = async () => {
    if (store?.slug) {
      const storeUrl = `https://yourapp.com/store/${store.slug}`;
      await Clipboard.setStringAsync(storeUrl);
      Alert.alert('Success', 'Store URL copied to clipboard!');
    }
  };

  const handleShareUrl = async () => {
    if (store?.slug) {
      const storeUrl = `https://yourapp.com/store/${store.slug}`;
      try {
        await Share.share({
          message: `Check out my store: ${store.name}\n${storeUrl}`,
          title: store.name,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  const handleNotifications = () => {
    navigation.navigate('Notifications');
  };

  const formatCurrency = (amount: number) => {
    return `GH₵${amount.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Store Header */}
        <View style={styles.storeHeader}>
          <View style={styles.storeInfoContainer}>
            {store?.logo ? (
              <Image source={{ uri: store.logo }} style={styles.storeLogo} />
            ) : (
              <View style={[styles.storeLogo, styles.storeLogoPlaceholder]}>
                <MaterialCommunityIcons
                  name="store"
                  size={32}
                  color={Colors.gray400}
                />
              </View>
            )}
            
            <View style={styles.storeDetails}>
              <Text style={styles.storeName} numberOfLines={1}>
                {store?.name || 'My Store'}
              </Text>
              <Text style={styles.storeUrl} numberOfLines={1}>
                yourapp.com/s/{store?.slug || 'store'}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleNotifications}
            >
              <Ionicons name="notifications-outline" size={24} color={Colors.gray700} />
              <View style={styles.notificationBadge} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleCopyUrl}
            >
              <Ionicons name="copy-outline" size={24} color={Colors.gray700} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleShareUrl}
            >
              <Ionicons name="share-social-outline" size={24} color={Colors.gray700} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Stats Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={styles.statCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="cash-outline" size={28} color={Colors.white} />
              <Text style={styles.statValue}>
                {formatCurrency(summary?.totalRevenue || 0)}
              </Text>
              <Text style={styles.statLabel}>Total Revenue</Text>
            </LinearGradient>

            <LinearGradient
              colors={[Colors.success, Colors.successDark]}
              style={styles.statCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="cart-outline" size={28} color={Colors.white} />
              <Text style={styles.statValue}>{summary?.totalOrders || 0}</Text>
              <Text style={styles.statLabel}>Total Orders</Text>
            </LinearGradient>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCardSmall}>
              <MaterialCommunityIcons
                name="package-variant"
                size={24}
                color={Colors.primary}
              />
              <View style={styles.statSmallContent}>
                <Text style={styles.statValueSmall}>{summary?.totalProducts || 0}</Text>
                <Text style={styles.statLabelSmall}>Products</Text>
              </View>
            </View>

            <View style={styles.statCardSmall}>
              <Ionicons name="checkmark-circle-outline" size={24} color={Colors.success} />
              <View style={styles.statSmallContent}>
                <Text style={styles.statValueSmall}>{summary?.activeProducts || 0}</Text>
                <Text style={styles.statLabelSmall}>Active</Text>
              </View>
            </View>

            <View style={styles.statCardSmall}>
              <Ionicons name="time-outline" size={24} color={Colors.warning} />
              <View style={styles.statSmallContent}>
                <Text style={styles.statValueSmall}>{summary?.pendingOrders || 0}</Text>
                <Text style={styles.statLabelSmall}>Pending</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Store Performance */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up" size={24} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Store Performance</Text>
          </View>
          
          <View style={styles.performanceCard}>
            <View style={styles.performanceRow}>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceValue}>
                  {storePerformance?.totalViews || 0}
                </Text>
                <Text style={styles.performanceLabel}>Total Views</Text>
              </View>
              
              <View style={styles.performanceDivider} />
              
              <View style={styles.performanceItem}>
                <Text style={styles.performanceValue}>
                  {storePerformance?.conversionRate || 0}%
                </Text>
                <Text style={styles.performanceLabel}>Conversion Rate</Text>
              </View>
              
              <View style={styles.performanceDivider} />
              
              <View style={styles.performanceItem}>
                <Text style={styles.performanceValue}>
                  {summary?.deliveredOrders || 0}
                </Text>
                <Text style={styles.performanceLabel}>Delivered</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Top Selling Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="chart-line" size={24} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Top Selling Products</Text>
          </View>

          {topProducts?.topProducts && topProducts.topProducts.length > 0 ? (
            topProducts.topProducts.map((product, index) => (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productRank}>
                  <Text style={styles.productRankText}>#{index + 1}</Text>
                </View>
                
                {product.images && product.images.length > 0 ? (
                  <Image
                    source={{ uri: product.images[0] }}
                    style={styles.productImage}
                  />
                ) : (
                  <View style={[styles.productImage, styles.productImagePlaceholder]}>
                    <MaterialCommunityIcons
                      name="image-outline"
                      size={24}
                      color={Colors.gray400}
                    />
                  </View>
                )}

                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={styles.productPrice}>
                    {formatCurrency(product.price)}
                  </Text>
                </View>

                <View style={styles.productStats}>
                  <View style={styles.productStat}>
                    <Ionicons name="cart" size={16} color={Colors.success} />
                    <Text style={styles.productStatText}>{product.quantityBought}</Text>
                  </View>
                  <View style={styles.productStat}>
                    <MaterialCommunityIcons
                      name="package-variant"
                      size={16}
                      color={Colors.gray500}
                    />
                    <Text style={styles.productStatText}>{product.stock}</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="cart-off"
                size={48}
                color={Colors.gray400}
              />
              <Text style={styles.emptyStateText}>No sales data yet</Text>
            </View>
          )}
        </View>

        {/* Order Status Distribution */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-outline" size={24} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Order Status</Text>
            <TouchableOpacity
              style={styles.viewMoreButton}
              onPress={() => navigation.navigate('Orders')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewMoreText}>View More</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statusGrid}>
            {orderAnalytics?.statusDistribution.map((status) => (
              <View key={status.status} style={styles.statusCard}>
                <View style={styles.statusIconContainer}>
                  <Ionicons
                    name={getStatusIcon(status.status)}
                    size={24}
                    color={getStatusColor(status.status)}
                  />
                </View>
                <Text style={styles.statusCount}>{status.count}</Text>
                <Text style={styles.statusLabel}>{status.status}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusIcon = (status: string) => {
  const icons: { [key: string]: any } = {
    PENDING: 'time-outline',
    PROCESSING: 'hourglass-outline',
    SHIPPED: 'airplane-outline',
    DELIVERED: 'checkmark-circle-outline',
    CANCELLED: 'close-circle-outline',
  };
  return icons[status] || 'help-circle-outline';
};

const getStatusColor = (status: string) => {
  const colors: { [key: string]: string } = {
    PENDING: Colors.warning,
    PROCESSING: Colors.info,
    SHIPPED: Colors.primary,
    DELIVERED: Colors.success,
    CANCELLED: Colors.error,
  };
  return colors[status] || Colors.gray500;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  storeHeader: {
    backgroundColor: Colors.white,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  storeInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storeLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  storeLogoPlaceholder: {
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeDetails: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  storeUrl: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  statsContainer: {
    padding: 16,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.white,
    opacity: 0.9,
  },
  statCardSmall: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 1,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  statSmallContent: {
    flex: 1,
  },
  statValueSmall: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  statLabelSmall: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  viewMoreButton: {
    paddingHorizontal: 8,
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  performanceCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    elevation: 1,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  performanceItem: {
    alignItems: 'center',
    flex: 1,
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  performanceLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  performanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  productCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 1,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  productRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productRankText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  productImagePlaceholder: {
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  productStats: {
    gap: 8,
  },
  productStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  productStatText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    width: (width - 48) / 2,
    alignItems: 'center',
    elevation: 1,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusCount: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  emptyState: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  bottomPadding: {
    height: 24,
  },
});