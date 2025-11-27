import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminAnalytics } from '../../hooks/useAdminDashboardSummary';
import { Colors } from '../../constants/colors';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;

interface AdminDashboardProps {
  navigation: any;
}

export default function AdminDashboardScreen({ navigation }: AdminDashboardProps) {
  const {
    dashboardSummary,
    salesAnalytics,
    topStores,
    pendingVerifications,
    pendingDisputes,
    loading,
    error,
    getDashboardSummary,
    getSalesAnalytics,
    getTopStores,
    getPendingVerifications,
    getPendingDisputes,
  } = useAdminAnalytics();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriod]);

  const fetchDashboardData = async () => {
    await Promise.all([
      getDashboardSummary(),
      getSalesAnalytics(selectedPeriod),
      getTopStores({ limit: 5, sortBy: 'revenue', period: selectedPeriod }),
      getPendingVerifications(1, 5),
      getPendingDisputes(1, 5),
    ]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [selectedPeriod]);

  const formatCurrency = (amount: number) => {
    return `GH₵ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const QuickActionCard = ({
    icon,
    label,
    color,
    onPress,
    badge,
  }: {
    icon: string;
    label: string;
    color: string;
    onPress: () => void;
    badge?: number;
  }) => (
    <TouchableOpacity
      style={[styles.quickActionCard, { borderColor: color }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={32} color={color} />
        {badge !== undefined && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: Colors.error }]}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const StatCard = ({
    title,
    value,
    subtitle,
    icon,
    trend,
    color,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
    trend?: number;
    color: string;
  }) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        {trend !== undefined && (
          <View style={[styles.trendBadge, { backgroundColor: trend >= 0 ? Colors.successLight : Colors.errorLight }]}>
            <Ionicons
              name={trend >= 0 ? 'trending-up' : 'trending-down'}
              size={12}
              color={trend >= 0 ? Colors.success : Colors.error}
            />
            <Text style={[styles.trendText, { color: trend >= 0 ? Colors.success : Colors.error }]}>
              {Math.abs(trend)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  if (loading && !dashboardSummary) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>Platform Overview</Text>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications" size={24} color={Colors.textPrimary} />
          {dashboardSummary && (dashboardSummary.pending.verifications + dashboardSummary.pending.disputes) > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {dashboardSummary.pending.verifications + dashboardSummary.pending.disputes}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickActionCard
              icon="receipt"
              label="Orders"
              color={Colors.primary}
              onPress={() => navigation.navigate('OrderManagement')}
            />
            <QuickActionCard
              icon="shield-checkmark"
              label="Disputes"
              color={Colors.error}
              onPress={() => navigation.navigate('Disputes')}
              badge={dashboardSummary?.pending.disputes}
            />
            <QuickActionCard
              icon="card"
              label="Payments"
              color={Colors.success}
              onPress={() => navigation.navigate('AdminPayments')}
            />
            <QuickActionCard
              icon="lock-closed"
              label="Escrow"
              color={Colors.warning}
              onPress={() => navigation.navigate('AdminEscrow')}
            />
          </View>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {(['7d', '30d', '90d'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period && styles.periodButtonTextActive,
                ]}
              >
                {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Key Metrics */}
        {dashboardSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Metrics</Text>
            <View style={styles.statsGrid}>
              <StatCard
                title="Total Revenue"
                value={formatCurrency(dashboardSummary.revenue.total)}
                subtitle={`${formatCurrency(dashboardSummary.revenue.last30Days)} this month`}
                icon="cash"
                color={Colors.success}
              />
              <StatCard
                title="Total Users"
                value={formatNumber(dashboardSummary.users.total)}
                subtitle={`+${dashboardSummary.users.last30Days} this month`}
                icon="people"
                trend={dashboardSummary.users.growth}
                color={Colors.primary}
              />
              <StatCard
                title="Active Stores"
                value={formatNumber(dashboardSummary.stores.active)}
                subtitle={`${dashboardSummary.stores.total} total stores`}
                icon="storefront"
                color={Colors.info}
              />
              <StatCard
                title="Total Orders"
                value={formatNumber(dashboardSummary.orders.total)}
                subtitle={`${dashboardSummary.orders.successRate}% success rate`}
                icon="receipt"
                color={Colors.warning}
              />
            </View>
          </View>
        )}

        {/* Revenue Overview */}
        {salesAnalytics && salesAnalytics.data.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Revenue Overview</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AdminAnalytics')}>
                <Text style={styles.viewAllLink}>View Details →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.revenueCard}>
              <View style={styles.revenueHeader}>
                <View>
                  <Text style={styles.revenueLabel}>Total Revenue</Text>
                  <Text style={styles.revenueValue}>
                    {formatCurrency(salesAnalytics.totals.totalRevenue)}
                  </Text>
                </View>
                <View style={styles.revenueStats}>
                  <View style={styles.revenueStatItem}>
                    <Text style={styles.revenueStatLabel}>Orders</Text>
                    <Text style={styles.revenueStatValue}>
                      {formatNumber(salesAnalytics.totals.totalOrders)}
                    </Text>
                  </View>
                  <View style={styles.revenueStatItem}>
                    <Text style={styles.revenueStatLabel}>Avg. Order</Text>
                    <Text style={styles.revenueStatValue}>
                      {formatCurrency(salesAnalytics.totals.averageOrderValue)}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.chartPlaceholder}>
                <Ionicons name="trending-up" size={48} color={Colors.success} />
                <Text style={styles.chartPlaceholderText}>
                  {salesAnalytics.totals.daysWithSales} days with sales
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Top Performing Stores */}
        {topStores && topStores.stores.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Performing Stores</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AdminStores')}>
                <Text style={styles.viewAllLink}>View All →</Text>
              </TouchableOpacity>
            </View>
            {topStores.stores.slice(0, 5).map((store, index) => (
              <TouchableOpacity
                key={store.id}
                style={styles.storeCard}
                onPress={() => navigation.navigate('StoreDetails', { storeId: store.id })}
                activeOpacity={0.7}
              >
                <View style={styles.storeRank}>
                  <Text style={styles.storeRankText}>#{index + 1}</Text>
                </View>
                <View style={styles.storeInfo}>
                  <Text style={styles.storeName}>{store.name}</Text>
                  <Text style={styles.storeCategory}>{store.category}</Text>
                </View>
                <View style={styles.storeStats}>
                  <Text style={styles.storeRevenue}>
                    {formatCurrency(store.performance.totalRevenue)}
                  </Text>
                  <Text style={styles.storeOrders}>
                    {store.performance.totalOrders} orders
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Pending Actions */}
        {dashboardSummary && (dashboardSummary.pending.verifications > 0 || dashboardSummary.pending.disputes > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Actions</Text>
            
            {dashboardSummary.pending.verifications > 0 && (
              <TouchableOpacity
                style={styles.pendingCard}
                onPress={() => navigation.navigate('PendingVerifications')}
                activeOpacity={0.7}
              >
                <View style={[styles.pendingIconContainer, { backgroundColor: Colors.warningLight }]}>
                  <Ionicons name="shield-checkmark" size={24} color={Colors.warning} />
                </View>
                <View style={styles.pendingInfo}>
                  <Text style={styles.pendingTitle}>Store Verifications</Text>
                  <Text style={styles.pendingSubtitle}>
                    {dashboardSummary.pending.verifications} pending verification
                    {dashboardSummary.pending.verifications !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>
                    {dashboardSummary.pending.verifications}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {dashboardSummary.pending.disputes > 0 && (
              <TouchableOpacity
                style={styles.pendingCard}
                onPress={() => navigation.navigate('AdminDisputes')}
                activeOpacity={0.7}
              >
                <View style={[styles.pendingIconContainer, { backgroundColor: Colors.errorLight }]}>
                  <Ionicons name="alert-circle" size={24} color={Colors.error} />
                </View>
                <View style={styles.pendingInfo}>
                  <Text style={styles.pendingTitle}>Disputes</Text>
                  <Text style={styles.pendingSubtitle}>
                    {dashboardSummary.pending.disputes} pending dispute
                    {dashboardSummary.pending.disputes !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>
                    {dashboardSummary.pending.disputes}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Additional Stats */}
        {dashboardSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Platform Statistics</Text>
            <View style={styles.additionalStatsContainer}>
              <View style={styles.additionalStatCard}>
                <Ionicons name="star" size={24} color={Colors.warning} />
                <Text style={styles.additionalStatValue}>
                  {dashboardSummary.reviews.averageRating.toFixed(1)}
                </Text>
                <Text style={styles.additionalStatLabel}>Avg. Rating</Text>
                <Text style={styles.additionalStatSubtext}>
                  {formatNumber(dashboardSummary.reviews.total)} reviews
                </Text>
              </View>

              <View style={styles.additionalStatCard}>
                <Ionicons name="cube" size={24} color={Colors.info} />
                <Text style={styles.additionalStatValue}>
                  {formatNumber(dashboardSummary.products.active)}
                </Text>
                <Text style={styles.additionalStatLabel}>Active Products</Text>
                <Text style={styles.additionalStatSubtext}>
                  {formatNumber(dashboardSummary.products.total)} total
                </Text>
              </View>

              <View style={styles.additionalStatCard}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                <Text style={styles.additionalStatValue}>
                  {dashboardSummary.orders.successRate}%
                </Text>
                <Text style={styles.additionalStatLabel}>Success Rate</Text>
                <Text style={styles.additionalStatSubtext}>
                  {formatNumber(dashboardSummary.orders.successful)} orders
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerGreeting: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.white,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  viewAllLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  quickActionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  quickActionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  periodButtonTextActive: {
    color: Colors.white,
  },
  statsGrid: {
    gap: 12,
  },
  statCard: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  revenueCard: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
  },
  revenueHeader: {
    marginBottom: 20,
  },
  revenueLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  revenueValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.success,
    marginBottom: 16,
  },
  revenueStats: {
    flexDirection: 'row',
    gap: 24,
  },
  revenueStatItem: {
    flex: 1,
  },
  revenueStatLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  revenueStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  chartPlaceholder: {
    height: 120,
    backgroundColor: Colors.white,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  storeRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storeRankText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  storeCategory: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  storeStats: {
    alignItems: 'flex-end',
  },
  storeRevenue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.success,
    marginBottom: 2,
  },
  storeOrders: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  pendingIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  pendingSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  pendingBadge: {
    backgroundColor: Colors.error,
    borderRadius: 16,
    minWidth: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  pendingBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  additionalStatsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  additionalStatCard: {
    flex: 1,
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  additionalStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
  },
  additionalStatLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  additionalStatSubtext: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 32,
  },
});