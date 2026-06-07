import React, { useEffect, useState, useRef } from 'react';
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
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { SellerStackParamList } from '../../types/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { useSellerDashboard } from '../../hooks/useSellerDashboard';
import { useStore } from '../../context/StoreContext';
import { Colors } from '../../constants/colors';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 64;
const CHART_HEIGHT = 120;

const MiniBarChart = ({
  data,
  color,
}: {
  data: { value: number; label?: string }[];
  color: string;
}) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = (CHART_WIDTH - (data.length - 1) * 4) / data.length;

  return (
    <View style={{ width: CHART_WIDTH, height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * CHART_HEIGHT, 4);
        return (
          <View key={i} style={{ width: barWidth, height: barH, borderRadius: 4, backgroundColor: color, opacity: 0.85 }} />
        );
      })}
    </View>
  );
};

const MiniSparkline = ({
  data,
  color,
}: {
  data: number[];
  color: string;
}) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const segW = CHART_WIDTH / (data.length - 1);

  const points = data.map((v, i) => ({
    x: i * segW,
    y: CHART_HEIGHT - ((v - min) / range) * CHART_HEIGHT,
  }));

  return (
    <View style={{ width: CHART_WIDTH, height: CHART_HEIGHT, overflow: 'hidden' }}>
      {points.slice(0, -1).map((pt, i) => {
        const next = points[i + 1];
        const dx = next.x - pt.x;
        const dy = next.y - pt.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: pt.x,
              top: pt.y,
              width: length,
              height: 2.5,
              backgroundColor: color,
              borderRadius: 2,
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: '0 50%',
            }}
          />
        );
      })}
      {points.map((pt, i) => (
        <View
          key={`dot-${i}`}
          style={{
            position: 'absolute',
            left: pt.x - 3,
            top: pt.y - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
};


const DonutSlice = ({ data, size = 80 }: { data: { value: number; color: string; label: string }[]; size?: number }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = size / 2;

  return (
    <View style={{ width: size, height: size, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
      {data.map((d, i) => {
        const pct = d.value / total;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: radius,
              borderWidth: 10,
              borderColor: d.color,
              opacity: pct > 0 ? 0.9 : 0,
            }}
          />
        );
      })}
      <View style={{ width: size - 28, height: size - 28, borderRadius: (size - 28) / 2, backgroundColor: Colors.white }} />
    </View>
  );
};

const SectionHeader = ({
  icon,
  iconSet = 'ionicons',
  title,
  linkLabel,
  onPress,
}: {
  icon: string;
  iconSet?: 'ionicons' | 'mci';
  title: string;
  linkLabel?: string;
  onPress?: () => void;
}) => (
  <View style={sectionHeaderStyle.row}>
    <View style={sectionHeaderStyle.left}>
      {iconSet === 'mci' ? (
        <MaterialCommunityIcons name={icon as any} size={18} color={Colors.primary} />
      ) : (
        <Ionicons name={icon as any} size={18} color={Colors.primary} />
      )}
      <Text style={sectionHeaderStyle.title}>{title}</Text>
    </View>
    {linkLabel && onPress && (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={sectionHeaderStyle.link}>
        <Text style={sectionHeaderStyle.linkText}>{linkLabel}</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
      </TouchableOpacity>
    )}
  </View>
);

const sectionHeaderStyle = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
});

// ─── Stat Pill ────────────────────────────────────────────────────────────────

const StatPill = ({
  label,
  value,
  color,
  icon,
  iconSet = 'ionicons',
}: {
  label: string;
  value: string | number;
  color: string;
  icon: string;
  iconSet?: 'ionicons' | 'mci';
}) => (
  <View style={pillStyle.pill}>
    <View style={[pillStyle.iconWrap, { backgroundColor: color + '18' }]}>
      {iconSet === 'mci' ? (
        <MaterialCommunityIcons name={icon as any} size={16} color={color} />
      ) : (
        <Ionicons name={icon as any} size={16} color={color} />
      )}
    </View>
    <Text style={pillStyle.value}>{value}</Text>
    <Text style={pillStyle.label}>{label}</Text>
  </View>
);

const pillStyle = StyleSheet.create({
  pill: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  label: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', fontWeight: '500' },
});

// ─── Card wrapper ─────────────────────────────────────────────────────────────

const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[cardStyle.card, style]}>{children}</View>
);

const cardStyle = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  `GH₵${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

const getStatusIcon = (status: string): any => ({
  PENDING: 'time-outline',
  PROCESSING: 'hourglass-outline',
  SHIPPED: 'airplane-outline',
  DELIVERED: 'checkmark-circle-outline',
  CANCELLED: 'close-circle-outline',
}[status] || 'help-circle-outline');

const getStatusColor = (status: string) => ({
  PENDING: Colors.warning,
  PROCESSING: Colors.info,
  SHIPPED: Colors.primary,
  DELIVERED: Colors.success,
  CANCELLED: Colors.error,
}[status] || Colors.gray500);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SellerDashboardScreen() {
  const navigation = useNavigation<NavigationProp<SellerStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const {
    summary,
    salesAnalytics,
    topProducts,
    orderAnalytics,
    storePerformance,
    paymentSummary,
    methodBreakdown,
    transactionRate,
    escrowOverview,
    feesAnalytics,
    productSnapshot,
    stockAlerts,
    categoryPerformance,
    customerSnapshot,
    aovTrend,
    purchaseFrequency,
    loading,
    error,
    fetchSummary,
    fetchSalesAnalytics,
    fetchTopProducts,
    fetchOrderAnalytics,
    fetchStorePerformance,
    fetchPaymentSummary,
    fetchMethodBreakdown,
    fetchTransactionRate,
    fetchEscrowOverview,
    fetchFeesAnalytics,
    fetchProductSnapshot,
    fetchStockAlerts,
    fetchCategoryPerformance,
    fetchCustomerSnapshot,
    fetchAOVTrend,
    fetchPurchaseFrequency,
  } = useSellerDashboard();

  const { store, getUserStore, loading: storeLoading } = useStore();

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [loading]);

  const loadDashboardData = async () => {
    await getUserStore();
    await Promise.all([
      fetchSummary(),
      fetchSalesAnalytics('7d'),
      fetchTopProducts(5),
      fetchOrderAnalytics(),
      fetchStorePerformance(),
      fetchPaymentSummary(),
      fetchMethodBreakdown(),
      fetchTransactionRate('30d'),
      fetchEscrowOverview(),
      fetchFeesAnalytics('30d'),
      fetchProductSnapshot(),
      fetchStockAlerts(),
      fetchCategoryPerformance('30d'),
      fetchCustomerSnapshot(),
      fetchAOVTrend('30d'),
      fetchPurchaseFrequency(),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  if (!store && !storeLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.noStoreContainer}>
          <LinearGradient colors={['#f0f4ff', '#e8efff']} style={styles.noStoreIconWrap}>
            <MaterialCommunityIcons name="store-off" size={48} color={Colors.primary} />
          </LinearGradient>
          <Text style={styles.noStoreTitle}>No store yet</Text>
          <Text style={styles.noStoreSubtitle}>Create your store to start listing products and accepting orders.</Text>
          <TouchableOpacity style={styles.createStoreButton} onPress={() => navigation.navigate('CreateStore')} activeOpacity={0.85}>
            <Text style={styles.createStoreButtonText}>Create Store</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (storeLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const handleCopyUrl = async () => {
    if (store?.url) {
      await Clipboard.setStringAsync(`https://zuba-web.vercel.app/store/${store.url}`);
      Alert.alert('Copied!', 'Store URL copied to clipboard.');
    }
  };

  const handleShareUrl = async () => {
    if (store?.url) {
      await Share.share({
        message: `Check out my store: ${store.name}\nhttps://zuba-web.vercel.app/store/${store.url}`,
        title: store.name,
      });
    }
  };

  // Chart data derived from API
  const salesChartData = (salesAnalytics?.salesData || []).map((d) => ({ value: d.revenue }));
  const aovChartData = (aovTrend?.timeline || []).map((d) => d.aov);
  const txRateData = (transactionRate?.dailyRates || []).map((d) => ({ value: d.success }));

  const topCategories = (categoryPerformance?.categories || []).slice(0, 4);
  const categoryColors = [Colors.primary, Colors.success, Colors.warning, Colors.error];

  const freqData = purchaseFrequency?.distribution || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Store Header ── */}
        <View style={styles.storeHeader}>
          <View style={styles.storeInfoRow}>
            {store?.logo ? (
              <Image source={{ uri: store.logo }} style={styles.storeLogo} />
            ) : (
              <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.storeLogo}>
                <MaterialCommunityIcons name="store" size={26} color="#fff" />
              </LinearGradient>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.storeName} numberOfLines={1}>{store?.name || 'My Store'}</Text>
              <View style={styles.storeUrlRow}>
                <Ionicons name="globe-outline" size={12} color={Colors.textSecondary} />
                <Text style={styles.storeUrl} numberOfLines={1}>zuba.app/s/{store?.slug || 'store'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={20} color={Colors.gray700} />
              <View style={styles.badge} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleCopyUrl} activeOpacity={0.7}>
              <Ionicons name="copy-outline" size={20} color={Colors.gray700} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleShareUrl} activeOpacity={0.7}>
              <Ionicons name="share-social-outline" size={20} color={Colors.gray700} />
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Hero Revenue Banner ── */}
          <View style={styles.heroBanner}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroLabel}>Total Revenue</Text>
                  <Text style={styles.heroValue}>{formatCurrency(summary?.totalRevenue || 0)}</Text>
                </View>
                <View style={styles.heroBadge}>
                  <Ionicons name="trending-up" size={16} color={Colors.primary} />
                  <Text style={styles.heroBadgeText}>{storePerformance?.conversionRate ?? 0}% CVR</Text>
                </View>
              </View>

              {salesChartData.length > 1 && (
                <View style={{ marginTop: 16, opacity: 0.7 }}>
                  <MiniBarChart data={salesChartData} color="#ffffff" />
                </View>
              )}

              <View style={styles.heroStats}>
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatValue}>{summary?.totalOrders ?? 0}</Text>
                  <Text style={styles.heroStatLabel}>Orders</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatValue}>{summary?.pendingOrders ?? 0}</Text>
                  <Text style={styles.heroStatLabel}>Pending</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatValue}>{summary?.deliveredOrders ?? 0}</Text>
                  <Text style={styles.heroStatLabel}>Delivered</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatValue}>{formatK(storePerformance?.totalViews ?? 0)}</Text>
                  <Text style={styles.heroStatLabel}>Views</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* ── Quick KPI Pills ── */}
          <View style={styles.section}>
            <View style={styles.pillRow}>
              <StatPill label="Active Products" value={summary?.activeProducts ?? 0} color={Colors.success} icon="checkmark-circle-outline" />
              <StatPill label="Total Products" value={summary?.totalProducts ?? 0} color={Colors.primary} icon="package-variant" iconSet="mci" />
            </View>
            <View style={[styles.pillRow, { marginTop: 10 }]}>
              <StatPill label="Net Revenue" value={formatCurrency(paymentSummary?.totalNetRevenue ?? 0)} color={Colors.info} icon="cash-outline" />
              <StatPill label="Success Rate" value={`${paymentSummary?.transactionSuccessRate ?? 0}%`} color={Colors.success} icon="pulse-outline" />
            </View>
          </View>

          {/* ── Payment Overview ── */}
          <View style={styles.section}>
            <SectionHeader
              icon="card-outline"
              title="Payment Overview"
              linkLabel="Details"
              onPress={() => navigation.navigate('PaymentAnalytics' as any)}
            />
            <View style={styles.cardRow}>
              <Card style={{ flex: 1 }}>
                <Text style={styles.cardMicroLabel}>Collected</Text>
                <Text style={styles.cardBigValue}>{formatCurrency(paymentSummary?.totalCollected ?? 0)}</Text>
                <View style={styles.cardChip}>
                  <View style={[styles.chipDot, { backgroundColor: Colors.success }]} />
                  <Text style={styles.chipText}>{paymentSummary?.successfulTransactions ?? 0} txns</Text>
                </View>
              </Card>
              <Card style={{ flex: 1 }}>
                <Text style={styles.cardMicroLabel}>In Escrow</Text>
                <Text style={styles.cardBigValue}>{formatCurrency(paymentSummary?.pendingEscrowAmount ?? 0)}</Text>
                <View style={styles.cardChip}>
                  <View style={[styles.chipDot, { backgroundColor: Colors.warning }]} />
                  <Text style={styles.chipText}>{paymentSummary?.pendingEscrowCount ?? 0} held</Text>
                </View>
              </Card>
            </View>

            <Card style={{ marginTop: 10 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardMicroLabel}>Transaction Success Rate (30d)</Text>
                <Text style={[styles.cardMicroLabel, { color: Colors.success, fontWeight: '700' }]}>
                  {transactionRate?.overall?.successRate ?? 0}%
                </Text>
              </View>
              {txRateData.length > 1 && (
                <View style={{ marginTop: 12 }}>
                  <MiniBarChart data={txRateData} color={Colors.success} />
                </View>
              )}
              <View style={[styles.rowBetween, { marginTop: 12 }]}>
                <View style={styles.cardChip}>
                  <View style={[styles.chipDot, { backgroundColor: Colors.success }]} />
                  <Text style={styles.chipText}>{transactionRate?.overall?.successCount ?? 0} success</Text>
                </View>
                <View style={styles.cardChip}>
                  <View style={[styles.chipDot, { backgroundColor: Colors.error }]} />
                  <Text style={styles.chipText}>{transactionRate?.overall?.failedCount ?? 0} failed</Text>
                </View>
                <View style={styles.cardChip}>
                  <View style={[styles.chipDot, { backgroundColor: Colors.warning }]} />
                  <Text style={styles.chipText}>{paymentSummary?.failedPayouts ?? 0} failed payouts</Text>
                </View>
              </View>
            </Card>

            <Card style={{ marginTop: 10 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardMicroLabel}>Escrow Releasing Soon</Text>
                <Text style={styles.cardSmallValue}>{escrowOverview?.releasingSoon?.within ?? '48h'}</Text>
              </View>
              <Text style={[styles.cardBigValue, { marginTop: 4 }]}>
                {formatCurrency(escrowOverview?.releasingSoon?.amount ?? 0)}
              </Text>
              <Text style={styles.cardMicroLabel}>{escrowOverview?.releasingSoon?.count ?? 0} orders</Text>
            </Card>

            {/* Payment method breakdown */}
            {(methodBreakdown?.byGateway?.length ?? 0) > 0 && (
              <Card style={{ marginTop: 10 }}>
                <Text style={[styles.cardMicroLabel, { marginBottom: 12 }]}>Payment Methods</Text>
                {methodBreakdown!.byGateway.map((g, i) => (
                  <View key={i} style={[styles.rowBetween, { marginBottom: 10 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.chipDot, { backgroundColor: categoryColors[i % 4], width: 10, height: 10, borderRadius: 5 }]} />
                      <Text style={styles.cardSmallLabel}>{g.gateway}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.cardSmallValue}>{formatCurrency(g.totalAmount)}</Text>
                      <Text style={styles.cardMicroLabel}>{g.percentage}%</Text>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            {/* Fees summary */}
            <Card style={{ marginTop: 10 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardMicroLabel}>Fees Paid (30d)</Text>
                <TouchableOpacity onPress={() => navigation.navigate('FeesAnalytics' as any)}>
                  <Text style={[styles.cardMicroLabel, { color: Colors.primary }]}>Details →</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.rowBetween, { marginTop: 12 }]}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={styles.cardSmallValue}>{formatCurrency(feesAnalytics?.summary?.totalPlatformFees ?? 0)}</Text>
                  <Text style={styles.cardMicroLabel}>Platform</Text>
                </View>
                <View style={styles.performanceDivider} />
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={styles.cardSmallValue}>{formatCurrency(feesAnalytics?.summary?.totalPaystackFees ?? 0)}</Text>
                  <Text style={styles.cardMicroLabel}>Paystack</Text>
                </View>
                <View style={styles.performanceDivider} />
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={styles.cardSmallValue}>{feesAnalytics?.summary?.effectiveFeeRate ?? 0}%</Text>
                  <Text style={styles.cardMicroLabel}>Eff. Rate</Text>
                </View>
              </View>
            </Card>
          </View>

          {/* ── Products ── */}
          <View style={styles.section}>
            <SectionHeader
              icon="cube-outline"
              title="Product Analytics"
              linkLabel="All Products"
              onPress={() => navigation.navigate('Products' as any)}
            />

            {/* Snapshot pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { label: 'Total', value: productSnapshot?.total ?? 0, color: Colors.primary },
                  { label: 'Active', value: productSnapshot?.active ?? 0, color: Colors.success },
                  { label: 'Inactive', value: productSnapshot?.inactive ?? 0, color: Colors.gray400 },
                  { label: 'Out of Stock', value: productSnapshot?.outOfStock ?? 0, color: Colors.error },
                  { label: 'Low Stock', value: productSnapshot?.lowStock ?? 0, color: Colors.warning },
                  { label: 'Never Sold', value: productSnapshot?.neverSold ?? 0, color: Colors.info },
                ].map((item, i) => (
                  <View key={i} style={styles.snapPill}>
                    <Text style={[styles.snapPillValue, { color: item.color }]}>{item.value}</Text>
                    <Text style={styles.snapPillLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Stock alerts */}
            {((stockAlerts?.outOfStock?.count ?? 0) > 0 || (stockAlerts?.lowStock?.count ?? 0) > 0) && (
              <TouchableOpacity
                onPress={() => navigation.navigate('StockAlerts' as any)}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#fff5f5', '#fff0f0']} style={styles.alertBanner}>
                  <View style={styles.alertLeft}>
                    <Ionicons name="warning-outline" size={20} color={Colors.error} />
                    <View>
                      <Text style={styles.alertTitle}>Stock Alerts</Text>
                      <Text style={styles.alertSub}>
                        {stockAlerts?.outOfStock?.count ?? 0} out of stock · {stockAlerts?.lowStock?.count ?? 0} low stock
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.error} />
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Category performance */}
            {topCategories.length > 0 && (
              <Card style={{ marginTop: 10 }}>
                <Text style={[styles.cardMicroLabel, { marginBottom: 12 }]}>Revenue by Category (30d)</Text>
                {topCategories.map((cat, i) => (
                  <View key={i} style={{ marginBottom: 12 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.cardSmallLabel}>{cat.category}</Text>
                      <Text style={styles.cardSmallValue}>{formatCurrency(cat.revenue)}</Text>
                    </View>
                    <View style={styles.progressBg}>
                      <View style={[styles.progressFill, { width: `${cat.revenueShare}%`, backgroundColor: categoryColors[i] }]} />
                    </View>
                    <Text style={[styles.cardMicroLabel, { marginTop: 2 }]}>{cat.revenueShare}% · {cat.unitsSold} units</Text>
                  </View>
                ))}
              </Card>
            )}

            {/* Top selling products */}
            <Card style={{ marginTop: 10 }}>
              <View style={[styles.rowBetween, { marginBottom: 14 }]}>
                <Text style={styles.cardMicroLabel}>Top Selling Products</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Products' as any)}>
                  <Text style={[styles.cardMicroLabel, { color: Colors.primary }]}>See all →</Text>
                </TouchableOpacity>
              </View>
              {(topProducts?.topProducts || []).length > 0 ? (
                (topProducts?.topProducts || []).map((product, index) => (
                  <View key={product.id} style={[styles.productRow, index > 0 && styles.productRowBorder]}>
                    <Text style={styles.productRank}>#{index + 1}</Text>
                    {product.images?.[0] ? (
                      <Image source={{ uri: product.images[0] }} style={styles.productThumb} />
                    ) : (
                      <View style={[styles.productThumb, styles.productThumbPlaceholder]}>
                        <MaterialCommunityIcons name="image-outline" size={18} color={Colors.gray400} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                      <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.cardSmallValue}>{product.quantityBought}</Text>
                      <Text style={styles.cardMicroLabel}>sold</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyInCard}>
                  <MaterialCommunityIcons name="cart-off" size={32} color={Colors.gray300} />
                  <Text style={styles.emptyText}>No sales data yet</Text>
                </View>
              )}
            </Card>
          </View>

          {/* ── Customer Analytics ── */}
          <View style={styles.section}>
            <SectionHeader
              icon="people-outline"
              title="Customer Analytics"
              linkLabel="Details"
              onPress={() => navigation.navigate('CustomerAnalytics' as any)}
            />

            <View style={styles.cardRow}>
              <Card style={{ flex: 1 }}>
                <Text style={styles.cardMicroLabel}>Total Customers</Text>
                <Text style={styles.cardBigValue}>{customerSnapshot?.totalCustomers ?? 0}</Text>
                <View style={styles.cardChip}>
                  <View style={[styles.chipDot, { backgroundColor: Colors.success }]} />
                  <Text style={styles.chipText}>{customerSnapshot?.newCustomers ?? 0} new</Text>
                </View>
              </Card>
              <Card style={{ flex: 1 }}>
                <Text style={styles.cardMicroLabel}>Repeat Rate</Text>
                <Text style={styles.cardBigValue}>{customerSnapshot?.repeatPurchaseRate ?? 0}%</Text>
                <View style={styles.cardChip}>
                  <View style={[styles.chipDot, { backgroundColor: Colors.primary }]} />
                  <Text style={styles.chipText}>{customerSnapshot?.returningCustomers ?? 0} returning</Text>
                </View>
              </Card>
            </View>

            <View style={[styles.cardRow, { marginTop: 10 }]}>
              <Card style={{ flex: 1 }}>
                <Text style={styles.cardMicroLabel}>Avg. Lifetime Value</Text>
                <Text style={styles.cardBigValue}>{formatCurrency(customerSnapshot?.averageLifetimeValue ?? 0)}</Text>
              </Card>
              <Card style={{ flex: 1 }}>
                <Text style={styles.cardMicroLabel}>Avg. Orders / Customer</Text>
                <Text style={styles.cardBigValue}>{customerSnapshot?.averageOrdersPerCustomer ?? 0}</Text>
              </Card>
            </View>

            {/* AOV trend sparkline */}
            {aovChartData.length > 1 && (
              <Card style={{ marginTop: 10 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardMicroLabel}>Avg. Order Value Trend (30d)</Text>
                  <Text style={styles.cardSmallValue}>{formatCurrency(aovTrend?.overallAOV ?? 0)}</Text>
                </View>
                <View style={{ marginTop: 14 }}>
                  <MiniSparkline data={aovChartData} color={Colors.primary} />
                </View>
              </Card>
            )}

            {/* Purchase frequency */}
            {freqData.length > 0 && (
              <Card style={{ marginTop: 10 }}>
                <Text style={[styles.cardMicroLabel, { marginBottom: 12 }]}>Purchase Frequency</Text>
                <MiniBarChart
                  data={freqData.map((f) => ({ value: f.customers, label: f.orders }))}
                  color={Colors.primary}
                />
                <View style={[styles.rowBetween, { marginTop: 10, flexWrap: 'wrap', gap: 6 }]}>
                  {freqData.map((f, i) => (
                    <View key={i} style={styles.freqLabel}>
                      <Text style={styles.freqOrders}>{f.orders}x</Text>
                      <Text style={styles.freqCustomers}>{f.customers}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            )}
          </View>

          {/* ── Order Status ── */}
          <View style={styles.section}>
            <SectionHeader
              icon="list-outline"
              title="Order Status"
              linkLabel="View Orders"
              onPress={() => navigation.navigate('Orders')}
            />
            <View style={styles.statusGrid}>
              {(orderAnalytics?.statusDistribution || []).map((s) => (
                <TouchableOpacity
                  key={s.status}
                  style={styles.statusCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('Orders')}
                >
                  <View style={[styles.statusIcon, { backgroundColor: getStatusColor(s.status) + '18' }]}>
                    <Ionicons name={getStatusIcon(s.status)} size={22} color={getStatusColor(s.status)} />
                  </View>
                  <Text style={styles.statusCount}>{s.count}</Text>
                  <Text style={styles.statusLabel}>{s.status}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6fb' },

  // Header
  storeHeader: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  storeInfoRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  storeLogo: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  storeName: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },
  storeUrlRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  storeUrl: { fontSize: 12, color: Colors.textSecondary },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.gray100, justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  badge: {
    position: 'absolute', top: 8, right: 8,
    width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.error,
  },

  // Hero
  heroBanner: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, overflow: 'hidden' },
  heroGradient: { padding: 20 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 4 },
  heroValue: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  heroBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  heroStats: { flexDirection: 'row', marginTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 16 },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Sections
  section: { paddingHorizontal: 16, marginTop: 20 },
  pillRow: { flexDirection: 'row', gap: 10 },
  cardRow: { flexDirection: 'row', gap: 10 },

  // Card internals
  cardMicroLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500', letterSpacing: 0.2 },
  cardSmallLabel: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  cardSmallValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  cardBigValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5, marginTop: 4 },
  cardChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  chipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  chipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  performanceDivider: { width: 1, height: 36, backgroundColor: Colors.border },

  // Progress bar
  progressBg: { height: 6, backgroundColor: Colors.gray100, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },

  // Alert banner
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#fde8e8',
  },
  alertLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: Colors.error },
  alertSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },

  // Snap pills (horizontal scroll)
  snapPill: {
    backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    alignItems: 'center', minWidth: 80,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  snapPillValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  snapPillLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },

  // Products
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  productRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  productRank: { fontSize: 13, fontWeight: '700', color: Colors.primary, width: 26 },
  productThumb: { width: 48, height: 48, borderRadius: 10 },
  productThumbPlaceholder: { backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  productPrice: { fontSize: 12, color: Colors.primary, fontWeight: '700', marginTop: 2 },
  emptyInCard: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, color: Colors.textSecondary },

  // Order status
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusCard: {
    width: (width - 52) / 2,
    backgroundColor: Colors.white, borderRadius: 16, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  statusIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statusCount: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  statusLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textTransform: 'capitalize', fontWeight: '500' },

  // Purchase frequency
  freqLabel: { alignItems: 'center', minWidth: 40 },
  freqOrders: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  freqCustomers: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },

  // No store / loading
  noStoreContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  noStoreIconWrap: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  noStoreTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },
  noStoreSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 },
  createStoreButton: { backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },
  createStoreButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});