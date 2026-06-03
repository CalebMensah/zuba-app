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
const CHART_H = 110;
const CHART_H_TALL = 150;

// ─── Types ──

type Period = '7d' | '30d' | '90d' | '1y';

// ─── Mini Bar Chart ──

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
        {data.map((d, i) => {
          const barH = Math.max((d.value / max) * height, 3);
          return (
            <View
              key={i}
              style={{ width: barW, height: barH, borderRadius: 4, backgroundColor: color, opacity: 0.85 }}
            />
          );
        })}
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

// ─── Grouped Bar Chart (success vs failed) ────────────────────────────────────

const GroupedBarChart = ({
  data,
}: {
  data: { label: string; success: number; failed: number }[];
}) => {
  const max = Math.max(...data.flatMap((d) => [d.success, d.failed]), 1);
  const groupW = Math.max((CHART_W - (data.length - 1) * 4) / data.length, 8);
  const barW = (groupW - 2) / 2;

  return (
    <View>
      <View style={{ width: CHART_W, height: CHART_H_TALL, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        {data.map((d, i) => (
          <View key={i} style={{ width: groupW, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
            <View
              style={{
                width: barW,
                height: Math.max((d.success / max) * CHART_H_TALL, 3),
                borderRadius: 3,
                backgroundColor: Colors.success,
                opacity: 0.85,
              }}
            />
            <View
              style={{
                width: barW,
                height: Math.max((d.failed / max) * CHART_H_TALL, 3),
                borderRadius: 3,
                backgroundColor: Colors.error,
                opacity: 0.75,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
        {data.map((d, i) => (
          <Text
            key={i}
            style={{ width: groupW, fontSize: 8, color: Colors.textSecondary, textAlign: 'center' }}
            numberOfLines={1}
          >
            {d.label?.slice(5)}
          </Text>
        ))}
      </View>
    </View>
  );
};

// ─── Sparkline ────────────────────────────────────────────────────────────────

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

// ─── Horizontal Bar ───────────────────────────────────────────────────────────

const HorizBar = ({ value, total, color }: { value: number; total: number; color: string }) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <View style={hbStyle.bg}>
      <View style={[hbStyle.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
};
const hbStyle = StyleSheet.create({
  bg: { height: 6, backgroundColor: Colors.gray100, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  fill: { height: 6, borderRadius: 3 },
});

// ─── Shared Components ────────────────────────────────────────────────────────

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

const SectionTitle = ({ icon, title }: { icon: string; title: string }) => (
  <View style={stSt.row}>
    <Ionicons name={icon as any} size={17} color={Colors.primary} />
    <Text style={stSt.text}>{title}</Text>
  </View>
);
const stSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  text: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3 },
});

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

const Divider = () => <View style={{ width: 1, height: 36, backgroundColor: Colors.border }} />;

const formatCurrency = (n: number) =>
  `GH₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PERIOD_OPTIONS: Period[] = ['7d', '30d', '90d', '1y'];
const CATEGORY_COLORS = [Colors.primary, Colors.success, Colors.warning, Colors.error, '#8b5cf6', '#06b6d4'];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PaymentAnalyticsScreen() {
  const navigation = useNavigation<NavigationProp<SellerStackParamList>>();
  const [period, setPeriod] = useState<Period>('30d');
  const [refreshing, setRefreshing] = useState(false);
  const [failedPage, setFailedPage] = useState(1);
  const [payoutPage, setPayoutPage] = useState(1);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const {
    paymentSummary,
    methodBreakdown,
    payoutHistory,
    transactionRate,
    failedTransactions,
    escrowOverview,
    loading,
    fetchPaymentSummary,
    fetchMethodBreakdown,
    fetchPayoutHistory,
    fetchTransactionRate,
    fetchFailedTransactions,
    fetchEscrowOverview,
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
      fetchPaymentSummary(),
      fetchMethodBreakdown(),
      fetchPayoutHistory(period, payoutPage),
      fetchTransactionRate(period),
      fetchFailedTransactions(period, failedPage),
      fetchEscrowOverview(),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const loadMoreFailed = async () => {
    const next = failedPage + 1;
    setFailedPage(next);
    await fetchFailedTransactions(period, next);
  };

  const loadMorePayouts = async () => {
    const next = payoutPage + 1;
    setPayoutPage(next);
    await fetchPayoutHistory(period, next);
  };

  // Chart data
  const txRateDays = (transactionRate?.dailyRates || []).slice(-14);
  const groupedTxData = txRateDays.map((d) => ({ label: d.date, success: d.success, failed: d.failed }));
  const successSparkData = txRateDays.map((d) => d.successRate);
  const payoutTimelineData = (payoutHistory?.timeline || []).map((d) => ({ value: d.amount, label: d.date }));

  const totalByStatus = (methodBreakdown?.byStatus || []).reduce((s, b) => s + b.count, 0) || 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Navbar ── */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Payment Analytics</Text>
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

            {/* ── 1. Summary Hero ── */}
            <View style={styles.section}>
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <Text style={styles.heroLabel}>Total Collected</Text>
                <Text style={styles.heroValue}>{formatCurrency(paymentSummary?.totalCollected ?? 0)}</Text>

                <View style={styles.heroRow}>
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatVal}>{formatCurrency(paymentSummary?.totalNetRevenue ?? 0)}</Text>
                    <Text style={styles.heroStatLabel}>Net Revenue</Text>
                  </View>
                  <View style={styles.heroDiv} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatVal}>{formatCurrency(paymentSummary?.refundedAmount ?? 0)}</Text>
                    <Text style={styles.heroStatLabel}>Refunded</Text>
                  </View>
                  <View style={styles.heroDiv} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatVal}>{paymentSummary?.successfulTransactions ?? 0}</Text>
                    <Text style={styles.heroStatLabel}>Txns</Text>
                  </View>
                </View>

                <View style={[styles.heroRow, { marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 14 }]}>
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatVal}>{paymentSummary?.transactionSuccessRate ?? 0}%</Text>
                    <Text style={styles.heroStatLabel}>Success Rate</Text>
                  </View>
                  <View style={styles.heroDiv} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatVal}>{paymentSummary?.failedTransactions ?? 0}</Text>
                    <Text style={styles.heroStatLabel}>Failed Txns</Text>
                  </View>
                  <View style={styles.heroDiv} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatVal}>{paymentSummary?.pendingTransactions ?? 0}</Text>
                    <Text style={styles.heroStatLabel}>Pending</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* ── 2. Transaction Success Rate ── */}
            <View style={styles.section}>
              <SectionTitle icon="pulse-outline" title="Transaction Success Rate" />

              <Card>
                <Row>
                  <View>
                    <Text style={styles.microLabel}>Overall Success Rate</Text>
                    <Text style={styles.bigNum}>{transactionRate?.overall?.successRate ?? 0}%</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.microLabel}>Failure Rate</Text>
                    <Text style={[styles.bigNum, { color: Colors.error }]}>
                      {transactionRate?.overall?.failureRate ?? 0}%
                    </Text>
                  </View>
                </Row>

                <View style={styles.legendRow}>
                  <Chip color={Colors.success} label={`${transactionRate?.overall?.successCount ?? 0} successful`} />
                  <Chip color={Colors.error} label={`${transactionRate?.overall?.failedCount ?? 0} failed`} />
                  <Chip color={Colors.gray400} label={`${transactionRate?.overall?.totalTransactions ?? 0} total`} />
                </View>

                {groupedTxData.length > 1 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={[styles.microLabel, { marginBottom: 10 }]}>Daily Breakdown (last 14 days)</Text>
                    <GroupedBarChart data={groupedTxData} />
                    <View style={[styles.legendRow, { marginTop: 8 }]}>
                      <Chip color={Colors.success} label="Success" />
                      <Chip color={Colors.error} label="Failed" />
                    </View>
                  </View>
                )}

                {successSparkData.length > 1 && (
                  <View style={{ marginTop: 18 }}>
                    <Text style={[styles.microLabel, { marginBottom: 10 }]}>Success Rate Trend</Text>
                    <Sparkline data={successSparkData} color={Colors.success} />
                  </View>
                )}
              </Card>
            </View>

            {/* ── 3. Payment Method Breakdown ── */}
            <View style={styles.section}>
              <SectionTitle icon="card-outline" title="Payment Breakdown" />

              {/* By gateway */}
              <Card>
                <Text style={[styles.microLabel, { marginBottom: 14 }]}>By Gateway</Text>
                {(methodBreakdown?.byGateway || []).length === 0 ? (
                  <Text style={styles.emptyText}>No data</Text>
                ) : (
                  methodBreakdown!.byGateway.map((g, i) => (
                    <View key={i} style={{ marginBottom: 14 }}>
                      <Row>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[i % 6] }]} />
                          <Text style={styles.itemLabel}>{g.gateway}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.itemValue}>{formatCurrency(g.totalAmount)}</Text>
                          <Text style={styles.microLabel}>{g.count} txns · {g.percentage}%</Text>
                        </View>
                      </Row>
                      <HorizBar value={g.count} total={methodBreakdown!.totalTransactions} color={CATEGORY_COLORS[i % 6]} />
                    </View>
                  ))
                )}
              </Card>

              {/* By status */}
              <Card style={{ marginTop: 12 }}>
                <Text style={[styles.microLabel, { marginBottom: 14 }]}>By Status</Text>
                {(methodBreakdown?.byStatus || []).map((s, i) => {
                  const color = { SUCCESS: Colors.success, FAILED: Colors.error, PENDING: Colors.warning, REFUNDED: Colors.info }[s.status] || Colors.gray400;
                  return (
                    <View key={i} style={{ marginBottom: 14 }}>
                      <Row>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.dot, { backgroundColor: color }]} />
                          <Text style={styles.itemLabel}>{s.status}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.itemValue}>{formatCurrency(s.totalAmount)}</Text>
                          <Text style={styles.microLabel}>{s.count} txns · {s.percentage}%</Text>
                        </View>
                      </Row>
                      <HorizBar value={s.count} total={totalByStatus} color={color} />
                    </View>
                  );
                })}

                {/* Bar chart of count by status */}
                {(methodBreakdown?.byStatus || []).length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <BarChart
                      data={(methodBreakdown?.byStatus || []).map((s) => ({ value: s.count, label: s.status }))}
                      color={Colors.primary}
                      showLabels
                    />
                  </View>
                )}
              </Card>

              {/* By currency */}
              {(methodBreakdown?.byCurrency || []).length > 0 && (
                <Card style={{ marginTop: 12 }}>
                  <Text style={[styles.microLabel, { marginBottom: 14 }]}>By Currency</Text>
                  {methodBreakdown!.byCurrency.map((c, i) => (
                    <Row key={i} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[i % 6] }]} />
                        <Text style={styles.itemLabel}>{c.currency}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.itemValue}>{formatCurrency(c.totalAmount)}</Text>
                        <Text style={styles.microLabel}>{c.count} txns</Text>
                      </View>
                    </Row>
                  ))}
                </Card>
              )}
            </View>

            {/* ── 4. Escrow Overview ── */}
            <View style={styles.section}>
              <SectionTitle icon="lock-closed-outline" title="Escrow Overview" />

              <View style={styles.threeColRow}>
                <Card style={styles.threeCard}>
                  <Text style={styles.microLabel}>Held</Text>
                  <Text style={styles.medNum}>{formatCurrency(escrowOverview?.held?.amount ?? 0)}</Text>
                  <Text style={styles.microLabel}>{escrowOverview?.held?.count ?? 0} orders</Text>
                </Card>
                <Card style={styles.threeCard}>
                  <Text style={styles.microLabel}>Releasing (48h)</Text>
                  <Text style={[styles.medNum, { color: Colors.warning }]}>
                    {formatCurrency(escrowOverview?.releasingSoon?.amount ?? 0)}
                  </Text>
                  <Text style={styles.microLabel}>{escrowOverview?.releasingSoon?.count ?? 0} orders</Text>
                </Card>
                <Card style={styles.threeCard}>
                  <Text style={styles.microLabel}>Released</Text>
                  <Text style={[styles.medNum, { color: Colors.success }]}>
                    {formatCurrency(escrowOverview?.released?.amount ?? 0)}
                  </Text>
                  <Text style={styles.microLabel}>{escrowOverview?.released?.count ?? 0} orders</Text>
                </Card>
              </View>

              {/* Escrow bar chart: held vs releasing vs released */}
              <Card style={{ marginTop: 12 }}>
                <Text style={[styles.microLabel, { marginBottom: 14 }]}>Escrow Distribution</Text>
                <BarChart
                  data={[
                    { value: escrowOverview?.held?.amount ?? 0, label: 'Held' },
                    { value: escrowOverview?.releasingSoon?.amount ?? 0, label: 'Soon' },
                    { value: escrowOverview?.released?.amount ?? 0, label: 'Released' },
                  ]}
                  color={Colors.primary}
                  height={80}
                  showLabels
                />
                <View style={[styles.legendRow, { marginTop: 10 }]}>
                  <Chip color={Colors.primary} label="Held" />
                  <Chip color={Colors.warning} label="Releasing soon" />
                  <Chip color={Colors.success} label="Released" />
                </View>
              </Card>

              {/* Recent releases */}
              {(escrowOverview?.recentReleases || []).length > 0 && (
                <Card style={{ marginTop: 12 }}>
                  <Text style={[styles.microLabel, { marginBottom: 14 }]}>Recent Releases</Text>
                  {escrowOverview!.recentReleases.map((r, i) => (
                    <View
                      key={r.escrowId}
                      style={[styles.listRow, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 10, paddingTop: 10 }]}
                    >
                      <View style={styles.listIconWrap}>
                        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemLabel} numberOfLines={1}>Order #{r.orderId.slice(-8)}</Text>
                        <Text style={styles.microLabel}>{r.releasedAt ? new Date(r.releasedAt).toLocaleDateString() : '—'}</Text>
                      </View>
                      <Text style={styles.itemValue}>{formatCurrency(r.amountReleased)}</Text>
                    </View>
                  ))}
                </Card>
              )}
            </View>

            {/* ── 5. Payout History ── */}
            <View style={styles.section}>
              <SectionTitle icon="arrow-up-circle-outline" title="Payout History" />

              <View style={styles.twoColRow}>
                <Card style={styles.twoCard}>
                  <Text style={styles.microLabel}>Total Paid Out</Text>
                  <Text style={styles.medNum}>{formatCurrency(payoutHistory?.summary?.totalPaidOut ?? 0)}</Text>
                  <Text style={styles.microLabel}>{payoutHistory?.summary?.completedPayoutCount ?? 0} payouts</Text>
                </Card>
                <Card style={styles.twoCard}>
                  <Text style={styles.microLabel}>Pending Payouts</Text>
                  <Text style={[styles.medNum, { color: Colors.warning }]}>
                    {formatCurrency(paymentSummary?.pendingPayoutAmount ?? 0)}
                  </Text>
                  <Text style={styles.microLabel}>{paymentSummary?.pendingPayoutCount ?? 0} orders</Text>
                </Card>
              </View>

              {/* Payout timeline bar chart */}
              {payoutTimelineData.length > 1 && (
                <Card style={{ marginTop: 12 }}>
                  <Text style={[styles.microLabel, { marginBottom: 12 }]}>Payout Timeline</Text>
                  <BarChart data={payoutTimelineData} color={Colors.primary} height={CHART_H_TALL} />
                </Card>
              )}

              {/* Payout list */}
              {(payoutHistory?.payouts || []).length > 0 && (
                <Card style={{ marginTop: 12 }}>
                  <Text style={[styles.microLabel, { marginBottom: 14 }]}>Payout Records</Text>
                  {payoutHistory!.payouts.map((p, i) => {
                    const statusColor = p.status === 'COMPLETED' ? Colors.success : p.status === 'FAILED' ? Colors.error : Colors.warning;
                    return (
                      <View
                        key={p.id}
                        style={[styles.listRow, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 10, paddingTop: 10 }]}
                      >
                        <View style={[styles.listIconWrap, { backgroundColor: statusColor + '18' }]}>
                          <Ionicons
                            name={p.status === 'COMPLETED' ? 'checkmark-circle' : p.status === 'FAILED' ? 'close-circle' : 'time'}
                            size={20}
                            color={statusColor}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemLabel}>Order #{p.order?.id?.slice(-8) ?? '—'}</Text>
                          <Text style={styles.microLabel}>{new Date(p.createdAt).toLocaleDateString()}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.itemValue}>{formatCurrency(p.amount)}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
                            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{p.status}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  {payoutHistory?.pagination && payoutPage < payoutHistory.pagination.totalPages && (
                    <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMorePayouts} activeOpacity={0.7}>
                      <Text style={styles.loadMoreText}>Load More</Text>
                    </TouchableOpacity>
                  )}
                </Card>
              )}
            </View>

            {/* ── 6. Failed Transactions ── */}
            <View style={styles.section}>
              <SectionTitle icon="close-circle-outline" title="Failed Transactions" />

              <Card>
                <Row>
                  <View>
                    <Text style={styles.microLabel}>Total Failed</Text>
                    <Text style={[styles.bigNum, { color: Colors.error }]}>
                      {failedTransactions?.summary?.totalFailed ?? 0}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.microLabel}>Est. Lost Revenue</Text>
                    <Text style={[styles.bigNum, { color: Colors.error }]}>
                      {formatCurrency(failedTransactions?.summary?.estimatedLostRevenue ?? 0)}
                    </Text>
                  </View>
                </Row>
              </Card>

              {(failedTransactions?.failedTransactions || []).length > 0 ? (
                <Card style={{ marginTop: 12 }}>
                  <Text style={[styles.microLabel, { marginBottom: 14 }]}>Failed Payment Records</Text>
                  {failedTransactions!.failedTransactions.map((f, i) => (
                    <View
                      key={f.id}
                      style={[styles.listRow, { alignItems: 'flex-start' }, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 10, paddingTop: 10 }]}
                    >
                      <View style={[styles.listIconWrap, { backgroundColor: Colors.error + '12' }]}>
                        <Ionicons name="close-circle" size={20} color={Colors.error} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemLabel}>Order #{f.orderId?.slice(-8) ?? '—'}</Text>
                        <Text style={styles.microLabel}>
                          {f.buyer?.firstName ?? 'Unknown'} · {f.buyer?.email ?? '—'}
                        </Text>
                        <View style={[styles.reasonBadge, { marginTop: 6 }]}>
                          <Text style={styles.reasonText} numberOfLines={2}>{f.failureReason}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', minWidth: 80 }}>
                        <Text style={[styles.itemValue, { color: Colors.error }]}>{formatCurrency(f.amount)}</Text>
                        <Text style={styles.microLabel}>{new Date(f.createdAt).toLocaleDateString()}</Text>
                        <Text style={styles.microLabel}>{f.gateway}</Text>
                      </View>
                    </View>
                  ))}

                  {failedTransactions?.pagination && failedPage < failedTransactions.pagination.totalPages && (
                    <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMoreFailed} activeOpacity={0.7}>
                      <Text style={styles.loadMoreText}>Load More</Text>
                    </TouchableOpacity>
                  )}
                </Card>
              ) : (
                <Card style={{ marginTop: 12, alignItems: 'center', paddingVertical: 32 }}>
                  <Ionicons name="checkmark-circle-outline" size={40} color={Colors.success} />
                  <Text style={[styles.itemLabel, { marginTop: 10, color: Colors.success }]}>No failed transactions</Text>
                  <Text style={styles.microLabel}>for this period</Text>
                </Card>
              )}
            </View>

          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6fb' },

  // Navbar
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

  // Period
  periodRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  periodChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.gray100,
  },
  periodChipActive: { backgroundColor: Colors.primary },
  periodChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  periodChipTextActive: { color: '#fff' },

  // Layout
  section: { paddingHorizontal: 16, marginTop: 20 },
  twoColRow: { flexDirection: 'row', gap: 10 },
  twoCard: { flex: 1 },
  threeColRow: { flexDirection: 'row', gap: 8 },
  threeCard: { flex: 1, padding: 12 },
  legendRow: { flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' },

  // Hero
  heroCard: { borderRadius: 20, padding: 20 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 4 },
  heroValue: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -1, marginBottom: 16 },
  heroRow: { flexDirection: 'row' },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  heroDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Typography
  microLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  itemLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  itemValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  bigNum: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.6, marginVertical: 4 },
  medNum: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4, marginVertical: 4 },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 12 },

  // List rows
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center',
  },

  // Badges
  statusBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginTop: 4 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  reasonBadge: {
    backgroundColor: '#fff5f5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: '#fde8e8',
  },
  reasonText: { fontSize: 11, color: Colors.error, fontWeight: '500' },

  // Misc
  dot: { width: 10, height: 10, borderRadius: 5 },
  loadingWrap: { flex: 1, paddingTop: 80, alignItems: 'center' },
  loadMoreBtn: {
    marginTop: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.gray100, alignItems: 'center',
  },
  loadMoreText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});