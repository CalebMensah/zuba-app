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
const CHART_H = 120;
const CHART_H_TALL = 150;

type Period = '7d' | '30d' | '90d' | '1y';
const PERIOD_OPTIONS: Period[] = ['7d', '30d', '90d', '1y'];
const CATEGORY_COLORS = [Colors.primary, Colors.success, Colors.warning, Colors.error, '#8b5cf6', '#06b6d4'];

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
            style={{ width: barW, height: Math.max((d.value / max) * height, 3), borderRadius: 4, backgroundColor: color, opacity: 0.85 }}
          />
        ))}
      </View>
      {showLabels && (
        <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
          {data.map((d, i) => (
            <Text key={i} style={{ width: barW, fontSize: 9, color: Colors.textSecondary, textAlign: 'center' }} numberOfLines={1}>
              {d.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const GroupedBarChart = ({
  data,
  height = CHART_H_TALL,
}: {
  data: { label: string; new: number; returning: number }[];
  height?: number;
}) => {
  const max = Math.max(...data.flatMap((d) => [d.new, d.returning]), 1);
  const groupW = Math.max((CHART_W - (data.length - 1) * 4) / data.length, 8);
  const barW = (groupW - 2) / 2;
  return (
    <View>
      <View style={{ width: CHART_W, height, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        {data.map((d, i) => (
          <View key={i} style={{ width: groupW, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
            <View style={{ width: barW, height: Math.max((d.new / max) * height, 3), borderRadius: 3, backgroundColor: Colors.primary, opacity: 0.85 }} />
            <View style={{ width: barW, height: Math.max((d.returning / max) * height, 3), borderRadius: 3, backgroundColor: Colors.success, opacity: 0.75 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
        {data.map((d, i) => (
          <Text key={i} style={{ width: groupW, fontSize: 8, color: Colors.textSecondary, textAlign: 'center' }} numberOfLines={1}>
            {d.label?.slice(5)}
          </Text>
        ))}
      </View>
    </View>
  );
};

const Sparkline = ({ data, color, height = CHART_H }: { data: number[]; color: string; height?: number }) => {
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
              position: 'absolute', left: pt.x, top: pt.y,
              width: length, height: 2.5,
              backgroundColor: color, borderRadius: 2,
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: '0 50%',
            }}
          />
        );
      })}
      {points.map((pt, i) => (
        <View
          key={`dot-${i}`}
          style={{ position: 'absolute', left: pt.x - 3, top: pt.y - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: color }}
        />
      ))}
    </View>
  );
};

const HorizBar = ({ value, total, color }: { value: number; total: number; color: string }) => {
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
    backgroundColor: Colors.white, borderRadius: 18, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
});

const SectionTitle = ({ icon, title }: { icon: string; title: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
    <Ionicons name={icon as any} size={17} color={Colors.primary} />
    <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3 }}>{title}</Text>
  </View>
);

const Row = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, style]}>
    {children}
  </View>
);

const Chip = ({ color, label }: { color: string; label: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
    <Text style={{ fontSize: 11, color: Colors.textSecondary, fontWeight: '500' }}>{label}</Text>
  </View>
);

const formatCurrency = (n: number) =>
  `GH₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CustomerAnalyticsScreen() {
  const navigation = useNavigation<NavigationProp<SellerStackParamList>>();
  const [period, setPeriod] = useState<Period>('30d');
  const [refreshing, setRefreshing] = useState(false);
  const [inactivePage, setInactivePage] = useState(1);
  const [topLimit, setTopLimit] = useState(10);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const {
    customerSnapshot,
    customerTrend,
    topCustomers,
    customerLifetimeValue,
    inactiveCustomers,
    purchaseFrequency,
    aovTrend,
    loading,
    fetchCustomerSnapshot,
    fetchCustomerTrend,
    fetchTopCustomers,
    fetchCustomerLifetimeValue,
    fetchInactiveCustomers,
    fetchPurchaseFrequency,
    fetchAOVTrend,
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
      fetchCustomerSnapshot(),
      fetchCustomerTrend(period),
      fetchTopCustomers(topLimit, period === '7d' ? '7d' : period),
      fetchCustomerLifetimeValue(),
      fetchInactiveCustomers(60, inactivePage),
      fetchPurchaseFrequency(),
      fetchAOVTrend(period),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const loadMoreInactive = async () => {
    const next = inactivePage + 1;
    setInactivePage(next);
    await fetchInactiveCustomers(60, next);
  };

  const loadMoreTop = async () => {
    const next = topLimit + 10;
    setTopLimit(next);
    await fetchTopCustomers(next, period);
  };

  // Chart data
  const trendDays = (customerTrend?.timeline || []).slice(-14);
  const groupedTrend = trendDays.map((d) => ({ label: d.date, new: d.newCustomers, returning: d.returningCustomers }));
  const aovData = (aovTrend?.timeline || []).map((d) => d.aov);
  const freqData = purchaseFrequency?.distribution || [];
  const clvBuckets = customerLifetimeValue?.buckets || [];

  const totalCustomers = customerSnapshot?.totalCustomers ?? 0;
  const returningPct = totalCustomers > 0
    ? Math.round(((customerSnapshot?.returningCustomers ?? 0) / totalCustomers) * 100)
    : 0;
  const newPct = 100 - returningPct;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Navbar ── */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Customer Analytics</Text>
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

            {/* ── 1. Hero Summary ── */}
            <View style={styles.section}>
              <LinearGradient
                colors={['#6366f1', '#4f46e5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <Text style={styles.heroLabel}>Total Customers</Text>
                <Text style={styles.heroValue}>{customerSnapshot?.totalCustomers ?? 0}</Text>

                {/* New vs Returning visual bar */}
                <View style={styles.splitBarWrap}>
                  <View style={[styles.splitBarNew, { flex: newPct || 1 }]} />
                  <View style={[styles.splitBarRet, { flex: returningPct || 1 }]} />
                </View>
                <Row style={{ marginTop: 8 }}>
                  <Chip color="rgba(255,255,255,0.9)" label={`${newPct}% new`} />
                  <Chip color="rgba(99,255,180,0.9)" label={`${returningPct}% returning`} />
                </Row>

                <View style={[styles.heroStatsRow, { marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 16 }]}>
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatVal}>{customerSnapshot?.newCustomers ?? 0}</Text>
                    <Text style={styles.heroStatLabel}>New</Text>
                  </View>
                  <View style={styles.heroDiv} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatVal}>{customerSnapshot?.returningCustomers ?? 0}</Text>
                    <Text style={styles.heroStatLabel}>Returning</Text>
                  </View>
                  <View style={styles.heroDiv} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatVal}>{customerSnapshot?.repeatPurchaseRate ?? 0}%</Text>
                    <Text style={styles.heroStatLabel}>Repeat Rate</Text>
                  </View>
                  <View style={styles.heroDiv} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatVal}>{customerSnapshot?.averageOrdersPerCustomer ?? 0}</Text>
                    <Text style={styles.heroStatLabel}>Avg Orders</Text>
                  </View>
                </View>

                <View style={styles.heroLTVRow}>
                  <View style={styles.heroLTVItem}>
                    <Ionicons name="wallet-outline" size={14} color="rgba(255,255,255,0.75)" />
                    <Text style={styles.heroLTVLabel}>Avg. Lifetime Value</Text>
                  </View>
                  <Text style={styles.heroLTVValue}>{formatCurrency(customerSnapshot?.averageLifetimeValue ?? 0)}</Text>
                </View>
              </LinearGradient>
            </View>

            {/* ── 2. Customer Trend ── */}
            <View style={styles.section}>
              <SectionTitle icon="trending-up-outline" title="New vs Returning Trend" />
              <Card>
                {groupedTrend.length > 1 ? (
                  <>
                    <Text style={[styles.microLabel, { marginBottom: 12 }]}>Daily breakdown (last 14 days)</Text>
                    <GroupedBarChart data={groupedTrend} />
                    <View style={styles.legendRow}>
                      <Chip color={Colors.primary} label="New customers" />
                      <Chip color={Colors.success} label="Returning customers" />
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyInCard}>
                    <MaterialCommunityIcons name="chart-bar" size={32} color={Colors.gray300} />
                    <Text style={styles.emptyText}>Not enough data for this period</Text>
                  </View>
                )}
              </Card>
            </View>

            {/* ── 3. AOV Trend ── */}
            <View style={styles.section}>
              <SectionTitle icon="cash-outline" title="Average Order Value" />
              <View style={styles.twoColRow}>
                <Card style={styles.twoCard}>
                  <Text style={styles.microLabel}>Overall AOV</Text>
                  <Text style={styles.bigNum}>{formatCurrency(aovTrend?.overallAOV ?? 0)}</Text>
                </Card>
                <Card style={styles.twoCard}>
                  <Text style={styles.microLabel}>Total Orders</Text>
                  <Text style={styles.bigNum}>{aovTrend?.totalOrders ?? 0}</Text>
                  <Text style={styles.microLabel}>{formatCurrency(aovTrend?.totalRevenue ?? 0)} revenue</Text>
                </Card>
              </View>

              {aovData.length > 1 && (
                <Card style={{ marginTop: 12 }}>
                  <Text style={[styles.microLabel, { marginBottom: 12 }]}>AOV over time</Text>
                  <Sparkline data={aovData} color={Colors.primary} height={CHART_H} />
                  <View style={styles.legendRow}>
                    <Chip color={Colors.primary} label="Average order value" />
                  </View>
                </Card>
              )}

              {/* Daily AOV bar chart */}
              {(aovTrend?.timeline || []).length > 1 && (
                <Card style={{ marginTop: 12 }}>
                  <Text style={[styles.microLabel, { marginBottom: 12 }]}>Daily order count</Text>
                  <BarChart
                    data={(aovTrend?.timeline || []).map((d) => ({ value: d.orderCount, label: d.date?.slice(5) }))}
                    color={Colors.success}
                    height={CHART_H}
                    showLabels
                  />
                </Card>
              )}
            </View>

            {/* ── 4. Purchase Frequency ── */}
            <View style={styles.section}>
              <SectionTitle icon="repeat-outline" title="Purchase Frequency" />
              <Card>
                <Row style={{ marginBottom: 16 }}>
                  <View>
                    <Text style={styles.microLabel}>Total Customers</Text>
                    <Text style={styles.bigNum}>{purchaseFrequency?.totalCustomers ?? 0}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.microLabel}>Avg Orders / Customer</Text>
                    <Text style={styles.bigNum}>{purchaseFrequency?.averageOrdersPerCustomer ?? 0}</Text>
                  </View>
                </Row>

                {freqData.length > 0 ? (
                  <>
                    <BarChart
                      data={freqData.map((f) => ({ value: f.customers, label: `${f.orders}x` }))}
                      color={Colors.primary}
                      height={CHART_H}
                      showLabels
                    />
                    <View style={{ marginTop: 16, gap: 10 }}>
                      {freqData.map((f, i) => (
                        <View key={i}>
                          <Row>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[i % 6] }]} />
                              <Text style={styles.itemLabel}>{f.orders} order{f.orders === '1' ? '' : 's'}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={styles.itemValue}>{f.customers} customers</Text>
                              <Text style={styles.microLabel}>{f.percentage}%</Text>
                            </View>
                          </Row>
                          <HorizBar value={f.customers} total={purchaseFrequency?.totalCustomers ?? 1} color={CATEGORY_COLORS[i % 6]} />
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyInCard}>
                    <MaterialCommunityIcons name="chart-bar" size={32} color={Colors.gray300} />
                    <Text style={styles.emptyText}>No frequency data yet</Text>
                  </View>
                )}
              </Card>
            </View>

            {/* ── 5. Customer Lifetime Value ── */}
            <View style={styles.section}>
              <SectionTitle icon="diamond-outline" title="Customer Lifetime Value" />

              <View style={styles.twoColRow}>
                <Card style={styles.twoCard}>
                  <Text style={styles.microLabel}>Average CLV</Text>
                  <Text style={[styles.bigNum, { fontSize: 20 }]}>{formatCurrency(customerLifetimeValue?.averageCLV ?? 0)}</Text>
                </Card>
                <Card style={styles.twoCard}>
                  <Text style={styles.microLabel}>Median CLV</Text>
                  <Text style={[styles.bigNum, { fontSize: 20 }]}>{formatCurrency(customerLifetimeValue?.medianCLV ?? 0)}</Text>
                </Card>
              </View>

              {/* Segments */}
              {customerLifetimeValue && (
                <Card style={{ marginTop: 12 }}>
                  <Text style={[styles.microLabel, { marginBottom: 14 }]}>Value Segments</Text>
                  {[
                    {
                      label: 'High Value',
                      count: customerLifetimeValue.segments.highValue.count,
                      threshold: `≥ ${formatCurrency(customerLifetimeValue.segments.highValue.threshold)}`,
                      color: Colors.success,
                    },
                    {
                      label: 'Mid Value',
                      count: customerLifetimeValue.segments.midValue.count,
                      threshold: 'Average range',
                      color: Colors.primary,
                    },
                    {
                      label: 'Low Value',
                      count: customerLifetimeValue.segments.lowValue.count,
                      threshold: `< ${formatCurrency(customerLifetimeValue.segments.lowValue.threshold)}`,
                      color: Colors.warning,
                    },
                  ].map((seg, i) => (
                    <View key={i} style={{ marginBottom: i < 2 ? 14 : 0 }}>
                      <Row>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.dot, { backgroundColor: seg.color, width: 10, height: 10, borderRadius: 5 }]} />
                          <View>
                            <Text style={styles.itemLabel}>{seg.label}</Text>
                            <Text style={styles.microLabel}>{seg.threshold}</Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.itemValue, { color: seg.color }]}>{seg.count}</Text>
                          <Text style={styles.microLabel}>customers</Text>
                        </View>
                      </Row>
                      <HorizBar
                        value={seg.count}
                        total={customerLifetimeValue.totalCustomers}
                        color={seg.color}
                      />
                    </View>
                  ))}
                </Card>
              )}

              {/* CLV distribution buckets */}
              {clvBuckets.length > 0 && (
                <Card style={{ marginTop: 12 }}>
                  <Text style={[styles.microLabel, { marginBottom: 12 }]}>CLV Distribution</Text>
                  <BarChart
                    data={clvBuckets.map((b) => ({ value: b.count, label: b.range }))}
                    color="#8b5cf6"
                    height={CHART_H}
                    showLabels
                  />
                </Card>
              )}
            </View>

            {/* ── 6. Top Customers ── */}
            <View style={styles.section}>
              <SectionTitle icon="trophy-outline" title="Top Customers" />
              {(topCustomers?.customers || []).length > 0 ? (
                <Card>
                  {topCustomers!.customers.map((c, i) => (
                    <View
                      key={c.buyerId}
                      style={[
                        styles.customerRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 14, paddingTop: 14 },
                      ]}
                    >
                      {/* Rank + avatar */}
                      <View style={styles.rankWrap}>
                        <Text style={[
                          styles.rankText,
                          i === 0 && { color: '#f59e0b' },
                          i === 1 && { color: Colors.gray400 },
                          i === 2 && { color: '#cd7c2f' },
                        ]}>
                          #{i + 1}
                        </Text>
                      </View>
                      {c.avatar ? (
                        <Image source={{ uri: c.avatar }} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarInitial}>
                            {(c.firstName?.[0] ?? '?').toUpperCase()}
                          </Text>
                        </View>
                      )}

                      {/* Info */}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemLabel} numberOfLines={1}>
                          {c.firstName} {c.lastName}
                        </Text>
                        <Text style={styles.microLabel} numberOfLines={1}>{c.email}</Text>
                        <View style={styles.customerMeta}>
                          <View style={styles.metaChip}>
                            <Ionicons name="cart-outline" size={11} color={Colors.textSecondary} />
                            <Text style={styles.metaChipText}>{c.orderCount} orders</Text>
                          </View>
                          <View style={styles.metaChip}>
                            <Ionicons name="trending-up-outline" size={11} color={Colors.textSecondary} />
                            <Text style={styles.metaChipText}>{formatCurrency(c.averageOrderValue)} AOV</Text>
                          </View>
                        </View>
                        <View style={styles.customerMeta}>
                          <Text style={styles.microLabel}>First: {formatDate(c.firstOrderAt)}</Text>
                          <Text style={styles.microLabel}>Last: {formatDate(c.lastOrderAt)}</Text>
                        </View>
                      </View>

                      {/* Spend */}
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.itemValue, { color: Colors.primary }]}>
                          {formatCurrency(c.totalSpend)}
                        </Text>
                        {c.loyaltyPoints > 0 && (
                          <View style={styles.loyaltyBadge}>
                            <Ionicons name="star" size={10} color="#f59e0b" />
                            <Text style={styles.loyaltyText}>{c.loyaltyPoints} pts</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMoreTop} activeOpacity={0.7}>
                    <Text style={styles.loadMoreText}>Load More</Text>
                  </TouchableOpacity>
                </Card>
              ) : (
                <Card style={styles.emptyCard}>
                  <MaterialCommunityIcons name="account-group-outline" size={40} color={Colors.gray300} />
                  <Text style={styles.emptyText}>No customer data yet</Text>
                </Card>
              )}
            </View>

            {/* ── 7. Inactive Customers ── */}
            <View style={styles.section}>
              <SectionTitle icon="time-outline" title="Inactive Customers" />

              <View style={styles.twoColRow}>
                <Card style={styles.twoCard}>
                  <Text style={styles.microLabel}>Total Inactive</Text>
                  <Text style={[styles.bigNum, { color: Colors.warning }]}>
                    {inactiveCustomers?.summary?.totalInactive ?? 0}
                  </Text>
                  <Text style={styles.microLabel}>60+ days</Text>
                </Card>
                <Card style={styles.twoCard}>
                  <Text style={styles.microLabel}>Est. Lost Revenue</Text>
                  <Text style={[styles.bigNum, { color: Colors.error, fontSize: 18 }]}>
                    {formatCurrency(inactiveCustomers?.summary?.estimatedLostRevenue ?? 0)}
                  </Text>
                </Card>
              </View>

              {(inactiveCustomers?.customers || []).length > 0 ? (
                <Card style={{ marginTop: 12 }}>
                  <Text style={[styles.microLabel, { marginBottom: 14 }]}>Lapsed Buyers</Text>
                  {inactiveCustomers!.customers.map((c, i) => (
                    <View
                      key={c.buyerId}
                      style={[
                        styles.customerRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 14, paddingTop: 14 },
                      ]}
                    >
                      {c.avatar ? (
                        <Image source={{ uri: c.avatar }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: Colors.warning + '20' }]}>
                          <Text style={[styles.avatarInitial, { color: Colors.warning }]}>
                            {(c.firstName?.[0] ?? '?').toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemLabel} numberOfLines={1}>{c.firstName} {c.lastName}</Text>
                        <Text style={styles.microLabel} numberOfLines={1}>{c.email}</Text>
                        <View style={styles.customerMeta}>
                          <View style={[styles.metaChip, { backgroundColor: Colors.warning + '15' }]}>
                            <Ionicons name="time-outline" size={11} color={Colors.warning} />
                            <Text style={[styles.metaChipText, { color: Colors.warning }]}>
                              {c.daysSinceLastOrder}d ago
                            </Text>
                          </View>
                          <View style={styles.metaChip}>
                            <Ionicons name="cart-outline" size={11} color={Colors.textSecondary} />
                            <Text style={styles.metaChipText}>{c.orderCount} orders</Text>
                          </View>
                        </View>
                        <Text style={styles.microLabel}>Last order: {formatDate(c.lastOrderAt)}</Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.itemValue}>{formatCurrency(c.totalSpend)}</Text>
                        <Text style={styles.microLabel}>{formatCurrency(c.averageOrderValue)} AOV</Text>
                      </View>
                    </View>
                  ))}

                  {inactiveCustomers?.pagination &&
                    inactivePage < inactiveCustomers.pagination.totalPages && (
                      <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMoreInactive} activeOpacity={0.7}>
                        <Text style={styles.loadMoreText}>Load More</Text>
                      </TouchableOpacity>
                    )}
                </Card>
              ) : (
                <Card style={[styles.emptyCard, { marginTop: 12 }]}>
                  <Ionicons name="checkmark-circle-outline" size={40} color={Colors.success} />
                  <Text style={[styles.emptyText, { color: Colors.success }]}>No inactive customers</Text>
                  <Text style={styles.microLabel}>All buyers are active</Text>
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
  periodChipActive: { backgroundColor: '#6366f1' },
  periodChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  periodChipTextActive: { color: '#fff' },

  section: { paddingHorizontal: 16, marginTop: 20 },
  twoColRow: { flexDirection: 'row', gap: 10 },
  twoCard: { flex: 1 },
  legendRow: { flexDirection: 'row', gap: 14, marginTop: 12, flexWrap: 'wrap' },

  // Hero
  heroCard: { borderRadius: 20, padding: 20 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 4 },
  heroValue: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -1.5, marginBottom: 14 },
  splitBarWrap: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.2)' },
  splitBarNew: { backgroundColor: 'rgba(255,255,255,0.9)' },
  splitBarRet: { backgroundColor: 'rgba(99,255,180,0.8)' },
  heroStatsRow: { flexDirection: 'row' },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  heroDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroLTVRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 14, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12, padding: 12,
  },
  heroLTVItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLTVLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  heroLTVValue: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // Typography
  microLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  itemLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  itemValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  bigNum: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.6, marginVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Customers
  customerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rankWrap: { width: 24, alignItems: 'center', paddingTop: 2 },
  rankText: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#6366f1' + '20', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '800', color: '#6366f1' },
  customerMeta: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.gray100, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  metaChipText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  loyaltyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginTop: 4,
  },
  loyaltyText: { fontSize: 10, fontWeight: '700', color: '#d97706' },

  // Empty
  emptyInCard: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyCard: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  // Load more
  loadMoreBtn: {
    marginTop: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.gray100, alignItems: 'center',
  },
  loadMoreText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  loadingWrap: { flex: 1, paddingTop: 80, alignItems: 'center' },
});