import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Animated,
  Image,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SellerStackParamList } from '../../types/navigation';
import { useSellerDashboard } from '../../hooks/useSellerDashboard';
import { Colors } from '../../constants/colors';

const { width } = Dimensions.get('window');
const CHART_W = width - 64;
const CHART_H = 130;

type Period = '7d' | '30d' | '90d' | '1y';
type SortBy = 'revenue' | 'unitsSold' | 'conversionRate' | 'viewCount' | 'stock';

const PERIOD_OPTIONS: Period[] = ['7d', '30d', '90d', '1y'];
const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'unitsSold', label: 'Units Sold' },
  { key: 'conversionRate', label: 'Conversion' },
  { key: 'stock', label: 'Stock' },
  { key: 'viewCount', label: 'Views' },
];

// ─── Charts ───────────────────────────────────────────────────────────────────

const BarChart = ({
  data,
  color,
  height = CHART_H,
  showLabels = false,
}: {
  data: { value: number; label?: string }[];
  color: string;
  height?: number;
  showLabels?: boolean;
}) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.max((CHART_W - (data.length - 1) * 3) / data.length, 4);
  return (
    <View>
      <View style={{ width: CHART_W, height, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
        {data.map((d, i) => (
          <View
            key={i}
            style={{
              width: barW,
              height: Math.max((d.value / max) * height, 3),
              borderRadius: 4,
              backgroundColor: color,
              opacity: 0.85,
            }}
          />
        ))}
      </View>
      {showLabels && (
        <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
          {data.map((d, i) => (
            <Text
              key={i}
              style={{ width: barW, fontSize: 8, color: Colors.textSecondary, textAlign: 'center' }}
              numberOfLines={1}
            >
              {d.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const Sparkline = ({
  data,
  color,
  height = CHART_H,
}: {
  data: number[];
  color: string;
  height?: number;
}) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const segW = CHART_W / (data.length - 1);
  const points = data.map((v, i) => ({
    x: i * segW,
    y: height - ((v - min) / range) * height,
  }));
  return (
    <View style={{ width: CHART_W, height, overflow: 'hidden' }}>
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

const HorizBar = ({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  color: string;
}) => {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <View style={{ height: 6, backgroundColor: Colors.gray100, borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <View style={{ height: 6, width: `${pct}%`, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
};

// ─── Shared UI ────────────────────────────────────────────────────────────────

const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[cardSt.card, style]}>{children}</View>
);
const cardSt = StyleSheet.create({
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

const SectionTitle = ({ icon, title, iconSet = 'ionicons' }: { icon: string; title: string; iconSet?: 'ionicons' | 'mci' }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
    {iconSet === 'mci' ? (
      <MaterialCommunityIcons name={icon as any} size={17} color={Colors.primary} />
    ) : (
      <Ionicons name={icon as any} size={17} color={Colors.primary} />
    )}
    <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3 }}>
      {title}
    </Text>
  </View>
);

const Row = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, style]}>
    {children}
  </View>
);

const formatCurrency = (n: number) =>
  `GH₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StockAnalyticsScreen() {
  const navigation = useNavigation<NavigationProp<SellerStackParamList>>();
  const [period, setPeriod] = useState<Period>('30d');
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deadStockDays, setDeadStockDays] = useState(30);
  const [perfPage, setPerfPage] = useState(1);
  const [deadPage, setDeadPage] = useState(1);
  const [alertThreshold, setAlertThreshold] = useState(5);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const {
    productSnapshot,
    productPerformance,
    stockAlerts,
    deadStock,
    stockMovement,
    revenuePerProduct,
    loading,
    fetchProductSnapshot,
    fetchProductPerformance,
    fetchStockAlerts,
    fetchDeadStock,
    fetchStockMovement,
    fetchRevenuePerProduct,
  } = useSellerDashboard();

  useEffect(() => {
    loadAll();
  }, [period]);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }
  }, [loading]);

  const loadAll = async () => {
    await Promise.all([
      fetchProductSnapshot(),
      fetchStockAlerts(alertThreshold),
      fetchDeadStock(deadStockDays, deadPage),
      fetchStockMovement(period),
      fetchProductPerformance(perfPage, 20, sortBy, sortOrder),
      fetchRevenuePerProduct(period, 10),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleSortChange = async (key: SortBy) => {
    const newOrder = sortBy === key && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(key);
    setSortOrder(newOrder);
    setPerfPage(1);
    await fetchProductPerformance(1, 20, key, newOrder);
  };

  const loadMorePerf = async () => {
    const next = perfPage + 1;
    setPerfPage(next);
    await fetchProductPerformance(next, 20, sortBy, sortOrder);
  };

  const loadMoreDead = async () => {
    const next = deadPage + 1;
    setDeadPage(next);
    await fetchDeadStock(deadStockDays, next);
  };

  // Chart data
  const movementData = (stockMovement?.timeline || []).map((d) => ({ value: d.unitsSold, label: d.date?.slice(5) }));
  const revenueSparkData = (stockMovement?.timeline || []).map((d) => d.revenue);
  const revenuePerProdData = (revenuePerProduct?.products || []).slice(0, 8);

  const totalProducts = productSnapshot?.total || 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Navbar ── */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Stock Analytics</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* ── Period Selector ── */}
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodChip, period === p && styles.periodChipActive]}
            onPress={() => { fadeAnim.setValue(0); setPeriod(p); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodChipText, period === p && styles.periodChipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {loading && !refreshing ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* ── 1. Snapshot Hero ── */}
            <View style={styles.section}>
              <LinearGradient
                colors={['#0ea5e9', '#0284c7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <Row>
                  <View>
                    <Text style={styles.heroLabel}>Total Products</Text>
                    <Text style={styles.heroValue}>{productSnapshot?.total ?? 0}</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <MaterialCommunityIcons name="package-variant-closed" size={28} color="rgba(255,255,255,0.6)" />
                  </View>
                </Row>

                <View style={styles.heroStatsRow}>
                  {[
                    { label: 'Active', value: productSnapshot?.active ?? 0, color: '#86efac' },
                    { label: 'Inactive', value: productSnapshot?.inactive ?? 0, color: 'rgba(255,255,255,0.5)' },
                    { label: 'Out of Stock', value: productSnapshot?.outOfStock ?? 0, color: '#fca5a5' },
                    { label: 'Low Stock', value: productSnapshot?.lowStock ?? 0, color: '#fcd34d' },
                  ].map((item, i) => (
                    <React.Fragment key={i}>
                      <View style={styles.heroStatItem}>
                        <Text style={[styles.heroStatVal, { color: item.color }]}>{item.value}</Text>
                        <Text style={styles.heroStatLabel}>{item.label}</Text>
                      </View>
                      {i < 3 && <View style={styles.heroDiv} />}
                    </React.Fragment>
                  ))}
                </View>

                {/* Active vs inactive visual split bar */}
                <View style={styles.splitBarWrap}>
                  <View style={[styles.splitFill, { flex: productSnapshot?.active ?? 0, backgroundColor: '#86efac' }]} />
                  <View style={[styles.splitFill, { flex: productSnapshot?.outOfStock ?? 0, backgroundColor: '#fca5a5' }]} />
                  <View style={[styles.splitFill, { flex: productSnapshot?.lowStock ?? 0, backgroundColor: '#fcd34d' }]} />
                  <View style={[styles.splitFill, { flex: productSnapshot?.inactive ?? 0, backgroundColor: 'rgba(255,255,255,0.25)' }]} />
                </View>
                <View style={styles.splitLegend}>
                  {[
                    { label: 'Active', color: '#86efac' },
                    { label: 'OOS', color: '#fca5a5' },
                    { label: 'Low', color: '#fcd34d' },
                    { label: 'Inactive', color: 'rgba(255,255,255,0.4)' },
                  ].map((l, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: l.color }} />
                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: '500' }}>{l.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Never sold + deleted */}
                <View style={styles.heroBottomRow}>
                  <View style={styles.heroBottomItem}>
                    <MaterialCommunityIcons name="cart-off" size={14} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.heroBottomText}>{productSnapshot?.neverSold ?? 0} never sold</Text>
                  </View>
                  <View style={styles.heroBottomItem}>
                    <Ionicons name="trash-outline" size={14} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.heroBottomText}>{productSnapshot?.deleted ?? 0} deleted</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* ── 2. Stock Alerts ── */}
            <View style={styles.section}>
              <SectionTitle icon="warning-outline" title="Stock Alerts" />

              {/* Threshold selector */}
              <View style={styles.thresholdRow}>
                <Text style={styles.microLabel}>Low stock threshold:</Text>
                {[3, 5, 10, 20].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.thresholdChip, alertThreshold === t && styles.thresholdChipActive]}
                    onPress={async () => { setAlertThreshold(t); await fetchStockAlerts(t); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.thresholdChipText, alertThreshold === t && styles.thresholdChipTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Summary cards */}
              <View style={styles.twoColRow}>
                <View style={[styles.alertSummaryCard, { borderColor: Colors.error + '40', backgroundColor: Colors.error + '08' }]}>
                  <Ionicons name="close-circle-outline" size={22} color={Colors.error} />
                  <Text style={[styles.alertSummaryVal, { color: Colors.error }]}>
                    {stockAlerts?.outOfStock?.count ?? 0}
                  </Text>
                  <Text style={styles.microLabel}>Out of Stock</Text>
                </View>
                <View style={[styles.alertSummaryCard, { borderColor: Colors.warning + '40', backgroundColor: Colors.warning + '08' }]}>
                  <Ionicons name="alert-circle-outline" size={22} color={Colors.warning} />
                  <Text style={[styles.alertSummaryVal, { color: Colors.warning }]}>
                    {stockAlerts?.lowStock?.count ?? 0}
                  </Text>
                  <Text style={styles.microLabel}>Low Stock</Text>
                </View>
              </View>

              {/* Out of stock list */}
              {(stockAlerts?.outOfStock?.products || []).length > 0 && (
                <Card style={{ marginTop: 12 }}>
                  <Row style={{ marginBottom: 14 }}>
                    <Text style={styles.microLabel}>Out of Stock</Text>
                    <View style={[styles.urgencyBadge, { backgroundColor: Colors.error + '15' }]}>
                      <Text style={[styles.urgencyText, { color: Colors.error }]}>Restock urgently</Text>
                    </View>
                  </Row>
                  {stockAlerts!.outOfStock.products.map((p, i) => (
                    <View
                      key={p.id}
                      style={[
                        styles.productRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 12, paddingTop: 12 },
                      ]}
                    >
                      {p.images?.[0] ? (
                        <Image source={{ uri: p.images[0] }} style={styles.productThumb} />
                      ) : (
                        <View style={styles.productThumbPlaceholder}>
                          <MaterialCommunityIcons name="image-outline" size={18} color={Colors.gray400} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemLabel} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.microLabel}>{p.category}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <View style={[styles.stockBadge, { backgroundColor: Colors.error + '15' }]}>
                            <Text style={[styles.stockBadgeText, { color: Colors.error }]}>0 in stock</Text>
                          </View>
                          <Text style={styles.microLabel}>{p.quantityBought} sold ever</Text>
                        </View>
                      </View>
                      <Text style={styles.itemValue}>{formatCurrency(p.price)}</Text>
                    </View>
                  ))}
                </Card>
              )}

              {/* Low stock list */}
              {(stockAlerts?.lowStock?.products || []).length > 0 && (
                <Card style={{ marginTop: 12 }}>
                  <Row style={{ marginBottom: 14 }}>
                    <Text style={styles.microLabel}>Low Stock (≤ {alertThreshold})</Text>
                    <View style={[styles.urgencyBadge, { backgroundColor: Colors.warning + '15' }]}>
                      <Text style={[styles.urgencyText, { color: Colors.warning }]}>Restock soon</Text>
                    </View>
                  </Row>
                  {stockAlerts!.lowStock.products.map((p, i) => (
                    <View
                      key={p.id}
                      style={[
                        styles.productRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 12, paddingTop: 12 },
                      ]}
                    >
                      {p.images?.[0] ? (
                        <Image source={{ uri: p.images[0] }} style={styles.productThumb} />
                      ) : (
                        <View style={styles.productThumbPlaceholder}>
                          <MaterialCommunityIcons name="image-outline" size={18} color={Colors.gray400} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemLabel} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.microLabel}>{p.category}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <View style={[styles.stockBadge, { backgroundColor: Colors.warning + '15' }]}>
                            <Text style={[styles.stockBadgeText, { color: Colors.warning }]}>{p.stock} left</Text>
                          </View>
                          <Text style={styles.microLabel}>{p.quantityBought} sold ever</Text>
                        </View>
                        <HorizBar value={p.stock} total={alertThreshold} color={Colors.warning} />
                      </View>
                      <Text style={styles.itemValue}>{formatCurrency(p.price)}</Text>
                    </View>
                  ))}
                </Card>
              )}

              {(stockAlerts?.totalAlerts ?? 0) === 0 && (
                <Card style={styles.emptyCard}>
                  <Ionicons name="checkmark-circle-outline" size={40} color={Colors.success} />
                  <Text style={[styles.itemLabel, { color: Colors.success, marginTop: 8 }]}>All stocked up</Text>
                  <Text style={styles.microLabel}>No stock alerts at this threshold</Text>
                </Card>
              )}
            </View>

            {/* ── 3. Stock Movement Chart ── */}
            <View style={styles.section}>
              <SectionTitle icon="analytics-outline" title="Stock Movement" />

              <Card>
                <Row style={{ marginBottom: 16 }}>
                  <View>
                    <Text style={styles.microLabel}>Total Units Sold</Text>
                    <Text style={styles.bigNum}>{stockMovement?.summary?.totalUnitsSold ?? 0}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.microLabel}>Avg Daily Sales</Text>
                    <Text style={styles.bigNum}>{stockMovement?.summary?.averageDailySales ?? 0}</Text>
                  </View>
                </Row>

                {movementData.length > 1 ? (
                  <>
                    <Text style={[styles.microLabel, { marginBottom: 10 }]}>Units sold per day</Text>
                    <BarChart data={movementData} color={Colors.primary} height={CHART_H} showLabels />
                  </>
                ) : (
                  <View style={styles.emptyInCard}>
                    <MaterialCommunityIcons name="chart-bar" size={32} color={Colors.gray300} />
                    <Text style={styles.emptyText}>No movement data for this period</Text>
                  </View>
                )}
              </Card>

              {/* Revenue from movement */}
              {revenueSparkData.length > 1 && (
                <Card style={{ marginTop: 12 }}>
                  <Row style={{ marginBottom: 12 }}>
                    <Text style={styles.microLabel}>Revenue from sales</Text>
                    <Text style={styles.itemValue}>{formatCurrency(stockMovement?.summary?.totalRevenue ?? 0)}</Text>
                  </Row>
                  <Sparkline data={revenueSparkData} color={Colors.success} height={CHART_H} />
                </Card>
              )}
            </View>

            {/* ── 4. Revenue Per Product ── */}
            {revenuePerProdData.length > 0 && (
              <View style={styles.section}>
                <SectionTitle icon="trophy-outline" title={`Top Revenue Products (${period})`} />
                <Card>
                  {revenuePerProdData.map((p, i) => (
                    <View
                      key={p.productId}
                      style={[
                        styles.productRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 12, paddingTop: 12 },
                      ]}
                    >
                      <Text style={styles.rankText}>#{i + 1}</Text>
                      {p.images?.[0] ? (
                        <Image source={{ uri: p.images[0] }} style={styles.productThumb} />
                      ) : (
                        <View style={styles.productThumbPlaceholder}>
                          <MaterialCommunityIcons name="image-outline" size={18} color={Colors.gray400} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemLabel} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.microLabel}>{p.category}</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                          <Text style={styles.microLabel}>{p.unitsSold} units</Text>
                          <Text style={styles.microLabel}>{p.orderCount} orders</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.itemValue, { color: Colors.primary }]}>{formatCurrency(p.revenue)}</Text>
                        <Text style={styles.microLabel}>{formatCurrency(p.price)} each</Text>
                      </View>
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {/* ── 5. Dead Stock ── */}
            <View style={styles.section}>
              <SectionTitle icon="sleep-outline" iconSet="mci" title="Dead Stock" />

              {/* Days filter */}
              <View style={styles.thresholdRow}>
                <Text style={styles.microLabel}>No sales in:</Text>
                {[14, 30, 60, 90].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.thresholdChip, deadStockDays === d && styles.thresholdChipActive]}
                    onPress={async () => { setDeadStockDays(d); setDeadPage(1); await fetchDeadStock(d, 1); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.thresholdChipText, deadStockDays === d && styles.thresholdChipTextActive]}>
                      {d}d
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Summary */}
              <View style={styles.twoColRow}>
                <Card style={styles.twoCard}>
                  <Text style={styles.microLabel}>Dead Stock Items</Text>
                  <Text style={[styles.bigNum, { color: Colors.warning }]}>
                    {deadStock?.summary?.totalDeadStockProducts ?? 0}
                  </Text>
                  <Text style={styles.microLabel}>
                    {deadStock?.summary?.neverSoldCount ?? 0} never sold
                  </Text>
                </Card>
                <Card style={styles.twoCard}>
                  <Text style={styles.microLabel}>Capital Tied Up</Text>
                  <Text style={[styles.bigNum, { color: Colors.error, fontSize: 18 }]}>
                    {formatCurrency(deadStock?.summary?.estimatedCapitalTied ?? 0)}
                  </Text>
                  <Text style={styles.microLabel}>est. inventory value</Text>
                </Card>
              </View>

              {(deadStock?.deadStock || []).length > 0 ? (
                <Card style={{ marginTop: 12 }}>
                  <Text style={[styles.microLabel, { marginBottom: 14 }]}>
                    Products with no sales in {deadStockDays} days
                  </Text>
                  {deadStock!.deadStock.map((p, i) => (
                    <View
                      key={p.id}
                      style={[
                        styles.productRow,
                        { alignItems: 'flex-start' },
                        i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 12, paddingTop: 12 },
                      ]}
                    >
                      {p.images?.[0] ? (
                        <Image source={{ uri: p.images[0] }} style={styles.productThumb} />
                      ) : (
                        <View style={styles.productThumbPlaceholder}>
                          <MaterialCommunityIcons name="image-outline" size={18} color={Colors.gray400} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Row>
                          <Text style={styles.itemLabel} numberOfLines={1}>{p.name}</Text>
                          {p.neverSold && (
                            <View style={[styles.urgencyBadge, { backgroundColor: Colors.error + '15' }]}>
                              <Text style={[styles.urgencyText, { color: Colors.error }]}>Never sold</Text>
                            </View>
                          )}
                        </Row>
                        <Text style={styles.microLabel}>{p.category}</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                          <View style={styles.metaChip}>
                            <MaterialCommunityIcons name="package-variant" size={11} color={Colors.textSecondary} />
                            <Text style={styles.metaChipText}>{p.stock} in stock</Text>
                          </View>
                          <View style={styles.metaChip}>
                            <Ionicons name="cart-outline" size={11} color={Colors.textSecondary} />
                            <Text style={styles.metaChipText}>{p.totalEverSold} sold ever</Text>
                          </View>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.itemValue}>{formatCurrency(p.price)}</Text>
                        <Text style={[styles.microLabel, { color: Colors.warning, fontWeight: '600' }]}>
                          {formatCurrency(p.capitalTied)} tied
                        </Text>
                      </View>
                    </View>
                  ))}

                  {deadStock?.pagination && deadPage < deadStock.pagination.totalPages && (
                    <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMoreDead} activeOpacity={0.7}>
                      <Text style={styles.loadMoreText}>Load More</Text>
                    </TouchableOpacity>
                  )}
                </Card>
              ) : (
                <Card style={[styles.emptyCard, { marginTop: 12 }]}>
                  <MaterialCommunityIcons name="check-circle-outline" size={40} color={Colors.success} />
                  <Text style={[styles.itemLabel, { color: Colors.success, marginTop: 8 }]}>No dead stock</Text>
                  <Text style={styles.microLabel}>All products have recent sales</Text>
                </Card>
              )}
            </View>

            {/* ── 6. Product Performance Table ── */}
            <View style={styles.section}>
              <SectionTitle icon="bar-chart-outline" title="Product Performance" />

              {/* Sort selector */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {SORT_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
                      onPress={() => handleSortChange(opt.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.sortChipText, sortBy === opt.key && styles.sortChipTextActive]}>
                        {opt.label}
                      </Text>
                      {sortBy === opt.key && (
                        <Ionicons
                          name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
                          size={11}
                          color="#fff"
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {(productPerformance?.products || []).length > 0 ? (
                <Card>
                  {/* Table header */}
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, { flex: 2 }]}>Product</Text>
                    <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Revenue</Text>
                    <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Sold</Text>
                    <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>CVR</Text>
                  </View>

                  {productPerformance!.products.map((p, i) => (
                    <View
                      key={p.id}
                      style={[
                        styles.tableRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border },
                      ]}
                    >
                      <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {p.images?.[0] ? (
                          <Image source={{ uri: p.images[0] }} style={styles.tableThumb} />
                        ) : (
                          <View style={styles.tableThumbPlaceholder}>
                            <MaterialCommunityIcons name="image-outline" size={14} color={Colors.gray400} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tableProductName} numberOfLines={2}>{p.name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <View style={[
                              styles.activeDot,
                              { backgroundColor: p.isActive ? Colors.success : Colors.gray400 },
                            ]} />
                            <Text style={styles.microLabel}>{p.stock} stk</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{formatCurrency(p.revenue)}</Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{p.unitsSold}</Text>
                      <Text style={[styles.tableCell, { flex: 1, color: p.conversionRate > 5 ? Colors.success : Colors.textPrimary }]}>
                        {p.conversionRate}%
                      </Text>
                    </View>
                  ))}

                  {productPerformance?.pagination && perfPage < productPerformance.pagination.totalPages && (
                    <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMorePerf} activeOpacity={0.7}>
                      <Text style={styles.loadMoreText}>Load More</Text>
                    </TouchableOpacity>
                  )}
                </Card>
              ) : (
                <Card style={styles.emptyCard}>
                  <MaterialCommunityIcons name="chart-bar" size={40} color={Colors.gray300} />
                  <Text style={styles.emptyText}>No performance data yet</Text>
                </Card>
              )}
            </View>

          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6fb' },

  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },

  periodRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  periodChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.gray100 },
  periodChipActive: { backgroundColor: '#0ea5e9' },
  periodChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  periodChipTextActive: { color: '#fff' },

  section: { paddingHorizontal: 16, marginTop: 20 },
  twoColRow: { flexDirection: 'row', gap: 10 },
  twoCard: { flex: 1 },

  // Hero
  heroCard: { borderRadius: 20, padding: 20 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 2 },
  heroValue: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -1.5 },
  heroBadge: { opacity: 0.5 },
  heroStatsRow: {
    flexDirection: 'row', marginTop: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 16,
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  heroStatLabel: { fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 2, textAlign: 'center' },
  heroDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  splitBarWrap: {
    flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 16,
  },
  splitFill: { minWidth: 4 },
  splitLegend: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  heroBottomRow: {
    flexDirection: 'row', gap: 16, marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 10,
  },
  heroBottomItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroBottomText: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  // Threshold / sort chips
  thresholdRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  thresholdChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.gray100 },
  thresholdChipActive: { backgroundColor: Colors.primary },
  thresholdChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  thresholdChipTextActive: { color: '#fff' },

  sortChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.gray100,
  },
  sortChipActive: { backgroundColor: Colors.primary },
  sortChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  sortChipTextActive: { color: '#fff' },

  // Alert summary cards
  alertSummaryCard: {
    flex: 1, borderRadius: 14, borderWidth: 1, padding: 16,
    alignItems: 'center', gap: 4,
  },
  alertSummaryVal: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  urgencyBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  urgencyText: { fontSize: 10, fontWeight: '700' },

  // Product rows
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productThumb: { width: 46, height: 46, borderRadius: 10 },
  productThumbPlaceholder: {
    width: 46, height: 46, borderRadius: 10,
    backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center',
  },
  stockBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  stockBadgeText: { fontSize: 10, fontWeight: '700' },

  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.gray100, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  metaChipText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },

  // Performance table
  tableHeader: {
    flexDirection: 'row', paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: 4,
  },
  tableHeaderText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  tableThumb: { width: 32, height: 32, borderRadius: 8 },
  tableThumbPlaceholder: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center',
  },
  tableProductName: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, lineHeight: 16 },
  tableCell: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  rankText: { fontSize: 13, fontWeight: '800', color: Colors.primary, width: 26 },

  // Typography
  microLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  itemLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  itemValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  bigNum: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.6, marginVertical: 4 },

  // Empty states
  emptyInCard: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyCard: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  loadMoreBtn: {
    marginTop: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.gray100, alignItems: 'center',
  },
  loadMoreText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  loadingWrap: { flex: 1, paddingTop: 80, alignItems: 'center' },
});