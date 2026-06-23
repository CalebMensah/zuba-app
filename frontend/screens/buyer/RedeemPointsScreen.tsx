import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  FlatList,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { usePoints, Product, PointsBalance } from '../../hooks/usePoints';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

// ─── Design tokens (shared with RedeemCheckoutScreen) ────────────────────────
const T = {
  ink:        '#0F172A',
  inkMuted:   '#475569',
  inkFaint:   '#94A3B8',
  surface:    '#FFFFFF',
  canvas:     '#F1F5F9',
  border:     '#E2E8F0',
  accent:     '#6366F1',
  accentSoft: '#EEF2FF',
  success:    '#10B981',
  successSoft:'#ECFDF5',
  warning:    '#F59E0B',
  warningSoft:'#FFFBEB',
  danger:     '#EF4444',
  headerBg:   '#0F172A',   // dark header
  size: { xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 28, hero: 40 },
  weight: { regular: '400' as const, medium: '500' as const, semibold: '600' as const, bold: '700' as const, heavy: '800' as const },
  radius: { sm: 8, md: 14, lg: 20, pill: 999 },
};

const RedeemPointsScreen = () => {
  const navigation = useNavigation();
  const { getPointsBalance, getRedeemableProducts, loading, error, clearError } = usePoints();

  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (error) Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
  }, [error]);

  const loadData = async () => {
    const [balanceData, productsData] = await Promise.all([
      getPointsBalance(),
      getRedeemableProducts(50),
    ]);
    if (balanceData) setBalance(balanceData);
    if (productsData) setProducts(productsData.products);
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
        'Not enough points',
        `You need ${requiredPoints.toLocaleString()} pts for this item. You have ${(balance?.points || 0).toLocaleString()} pts.`,
        [{ text: 'OK' }]
      );
      return;
    }
    (navigation as any).navigate('RedeemCheckout', {
      product,
      requiredPoints,
      currentBalance: balance.points,
    });
  };

  // ─── Header: dark balance card ──────────────────────────────────────────────
  const BalanceHeader = () => (
    <View style={s.header}>
      <StatusBar barStyle="light-content" />

      {/* Top row */}
      <View style={s.headerTop}>
        <View>
          <Text style={s.headerEyebrow}>Rewards wallet</Text>
          <Text style={s.headerTitle}>Your Points</Text>
        </View>
        <TouchableOpacity
          style={s.historyBtn}
          onPress={() => (navigation as any).navigate('PointsHistory')}
        >
          <Ionicons name="time-outline" size={16} color={T.inkFaint} />
          <Text style={s.historyBtnText}>History</Text>
        </TouchableOpacity>
      </View>

      {/* Big points number */}
      <View style={s.balanceRow}>
        <View style={s.diamondIcon}>
          <Ionicons name="diamond" size={18} color={T.accent} />
        </View>
        <Text style={s.balanceNumber}>{(balance?.points ?? 0).toLocaleString()}</Text>
        <Text style={s.balancePtLabel}>pts</Text>
      </View>

      {/* Stats strip */}
      <View style={s.statsStrip}>
        <View style={s.statItem}>
          <Text style={s.statLabel}>Cash value</Text>
          <Text style={s.statValue}>GHS {(balance?.cedisEquivalent ?? 0).toFixed(2)}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statLabel}>Rate</Text>
          <Text style={s.statValue}>1 pt = GHS {(balance?.conversionRate ?? 1).toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );

  // ─── Section header between balance card and grid ───────────────────────────
  const SectionHeader = () => (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>Redeem with points</Text>
      <View style={s.countChip}>
        <Text style={s.countChipText}>{products.length}</Text>
      </View>
    </View>
  );

  // ─── Product card ────────────────────────────────────────────────────────────
  const renderProductCard = ({ item, index }: { item: Product; index: number }) => {
    const requiredPoints = Math.ceil(item.price / (balance?.conversionRate || 1));
    const canAfford = !!(balance && balance.points >= requiredPoints);
    const imageUri = Array.isArray(item.images) && item.images.length > 0
      ? item.images[0]
      : 'https://via.placeholder.com/200';
    const lowStock = item.stock > 0 && item.stock <= 5;

    return (
      <TouchableOpacity
        style={[s.card, index % 2 === 0 ? s.cardLeft : s.cardRight, !canAfford && s.cardLocked]}
        onPress={() => handleProductPress(item)}
        activeOpacity={0.88}
      >
        {/* Image */}
        <View style={s.cardImgWrap}>
          <Image source={{ uri: imageUri }} style={s.cardImg} resizeMode="cover" />

          {/* Lock overlay */}
          {!canAfford && (
            <View style={s.lockOverlay}>
              <View style={s.lockPill}>
                <Ionicons name="lock-closed" size={11} color={T.surface} />
                <Text style={s.lockText}>Need more pts</Text>
              </View>
            </View>
          )}

          {/* Low stock badge */}
          {lowStock && canAfford && (
            <View style={s.stockBadge}>
              <Text style={s.stockBadgeText}>Only {item.stock} left</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={s.cardBody}>
          <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>

          <View style={s.cardFooter}>
            <View style={s.ptsPill}>
              <Ionicons name="diamond-outline" size={11} color={T.accent} />
              <Text style={s.ptsPillText}>{requiredPoints.toLocaleString()}</Text>
            </View>
            <Text style={s.retailPrice}>GHS {(item.price ?? 0).toFixed(2)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Empty state ─────────────────────────────────────────────────────────────
  const EmptyState = () => (
    <View style={s.empty}>
      <View style={s.emptyIconWrap}>
        <Ionicons name="storefront-outline" size={36} color={T.accent} />
      </View>
      <Text style={s.emptyTitle}>Nothing to redeem yet</Text>
      <Text style={s.emptyBody}>
        {balance?.points === 0
          ? 'Make purchases to start earning points, then come back to shop the rewards catalogue.'
          : 'New products are added regularly — check back soon.'}
      </Text>
    </View>
  );

  // ─── Full-screen loader ───────────────────────────────────────────────────────
  if (loading && !refreshing && !balance) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={T.accent} />
        <Text style={s.loaderText}>Loading your wallet…</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <FlatList
        data={products}
        renderItem={renderProductCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={
          <>
            <BalanceHeader />
            <View style={s.listPad}>
              <SectionHeader />
            </View>
          </>
        }
        ListEmptyComponent={<View style={s.listPad}><EmptyState /></View>}
        contentContainerStyle={s.listContent}
        columnWrapperStyle={products.length > 0 ? s.colWrapper : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.canvas },

  // Loader
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.canvas, gap: 14 },
  loaderText: { fontSize: T.size.base, color: T.inkFaint, fontWeight: T.weight.medium },

  // Header / balance card
  header: {
    backgroundColor: T.headerBg,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerEyebrow: {
    fontSize: T.size.xs,
    fontWeight: T.weight.bold,
    color: T.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: T.size.lg,
    fontWeight: T.weight.heavy,
    color: T.surface,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: T.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  historyBtnText: { fontSize: T.size.sm, color: T.inkFaint, fontWeight: T.weight.medium },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 24,
  },
  diamondIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: T.accentSoft,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  balanceNumber: {
    fontSize: T.size.hero,
    fontWeight: T.weight.heavy,
    color: T.surface,
    letterSpacing: -1,
    lineHeight: T.size.hero + 4,
  },
  balancePtLabel: {
    fontSize: T.size.md,
    fontWeight: T.weight.semibold,
    color: T.inkFaint,
    marginBottom: 6,
  },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: T.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  statItem: { flex: 1 },
  statLabel: { fontSize: T.size.xs, color: T.inkFaint, fontWeight: T.weight.medium, marginBottom: 4 },
  statValue: { fontSize: T.size.base, color: T.surface, fontWeight: T.weight.bold },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 18 },

  // List layout
  listContent: { paddingBottom: 40 },
  listPad: { paddingHorizontal: 16 },
  colWrapper: { paddingHorizontal: 16, justifyContent: 'space-between' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 24,
    paddingBottom: 16,
  },
  sectionTitle: { fontSize: T.size.md, fontWeight: T.weight.heavy, color: T.ink },
  countChip: {
    backgroundColor: T.accentSoft,
    borderRadius: T.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countChipText: { fontSize: T.size.xs, fontWeight: T.weight.bold, color: T.accent },

  // Product card
  card: {
    width: CARD_WIDTH,
    backgroundColor: T.surface,
    borderRadius: T.radius.md,
    marginBottom: 14,
    overflow: 'hidden',
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLeft: {},
  cardRight: {},
  cardLocked: { opacity: 0.72 },

  cardImgWrap: {
    width: '100%',
    height: CARD_WIDTH * 0.88,
    position: 'relative',
    backgroundColor: T.canvas,
  },
  cardImg: { width: '100%', height: '100%' },

  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.48)',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: 8,
  },
  lockPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: T.radius.pill,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  lockText: { fontSize: T.size.xs, color: T.surface, fontWeight: T.weight.semibold },

  stockBadge: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: T.warning,
    borderRadius: T.radius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  stockBadgeText: { fontSize: T.size.xs, color: T.surface, fontWeight: T.weight.bold },

  cardBody: { padding: 10 },
  cardName: {
    fontSize: T.size.sm,
    fontWeight: T.weight.semibold,
    color: T.ink,
    lineHeight: 18,
    marginBottom: 8,
    minHeight: 36,
  },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ptsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: T.accentSoft,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: T.radius.pill,
  },
  ptsPillText: { fontSize: T.size.xs, fontWeight: T.weight.bold, color: T.accent },
  retailPrice: {
    fontSize: T.size.xs,
    color: T.inkFaint,
    textDecorationLine: 'line-through',
    fontWeight: T.weight.medium,
  },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 24 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: T.accentSoft,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: T.size.md,
    fontWeight: T.weight.heavy,
    color: T.ink,
    marginBottom: 10,
  },
  emptyBody: {
    fontSize: T.size.sm,
    color: T.inkFaint,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default RedeemPointsScreen;