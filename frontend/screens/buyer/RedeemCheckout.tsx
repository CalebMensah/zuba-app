import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { usePoints, Product, DeliveryInfo } from '../../hooks/usePoints';
import { useAddress } from '../../hooks/useAddress';

interface RouteParams {
  product: Product;
  requiredPoints: number;
  currentBalance: number;
  selectedAddressId?: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  // Palette
  ink:        '#0F172A',
  inkMuted:   '#475569',
  inkFaint:   '#94A3B8',
  surface:    '#FFFFFF',
  canvas:     '#F1F5F9',
  border:     '#E2E8F0',
  accent:     '#6366F1',   // indigo
  accentSoft: '#EEF2FF',
  success:    '#10B981',
  successSoft:'#ECFDF5',
  danger:     '#EF4444',
  dangerSoft: '#FEF2F2',
  // Type scale
  size: { xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 28, hero: 38 },
  weight: { regular: '400' as const, medium: '500' as const, semibold: '600' as const, bold: '700' as const, heavy: '800' as const },
  radius: { sm: 8, md: 14, lg: 20, pill: 999 },
};

const RedeemCheckoutScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { product, requiredPoints, currentBalance, selectedAddressId } = route.params as RouteParams;
  const { redeemPoints, loading: redeemLoading, error, clearError } = usePoints();
  const { getUserAddresses, getUserAddressById, loading: addressLoading } = useAddress();

  const [quantity, setQuantity] = useState(1);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [hasCheckedAddresses, setHasCheckedAddresses] = useState(false);

  const totalPoints = requiredPoints * quantity;
  const remaining  = currentBalance - totalPoints;
  const canAfford  = remaining >= 0;

  const imageUri = Array.isArray(product.images) && product.images.length > 0
    ? product.images[0]
    : 'https://via.placeholder.com/400';

  useEffect(() => { loadAddresses(); }, [selectedAddressId]);

  useEffect(() => {
    if (error) Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
  }, [error]);

  const loadAddresses = async () => {
    try {
      if (selectedAddressId) {
        const address = await getUserAddressById(selectedAddressId);
        if (address) setSelectedAddress(address);
      } else {
        const addresses = await getUserAddresses();
        if (addresses?.length) {
          const def = addresses.find((a: any) => a.isDefault);
          setSelectedAddress(def || addresses[0]);
        }
      }
    } catch (err) {
      console.error('Error loading addresses:', err);
    } finally {
      setHasCheckedAddresses(true);
    }
  };

  const handleQuantityChange = (next: number) => {
    if (next < 1) return;
    if (next > product.stock) {
      Alert.alert('Stock limit', `Only ${product.stock} in stock.`);
      return;
    }
    if (requiredPoints * next > currentBalance) {
      Alert.alert('Not enough points', `You need ${(requiredPoints * next).toLocaleString()} points but have ${currentBalance.toLocaleString()}.`);
      return;
    }
    setQuantity(next);
  };

  const handleRedeem = async () => {
    if (!selectedAddress) {
      Alert.alert('Add an address', 'A delivery address is required to complete your order.');
      return;
    }
    Alert.alert(
      'Confirm order',
      `Spend ${totalPoints.toLocaleString()} points for ${quantity}× ${product.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const deliveryInfo: DeliveryInfo = {
              recipient: selectedAddress.recipient,
              phone: selectedAddress.phone,
              email: '',
              address: selectedAddress.addressLine1,
              city: selectedAddress.city,
              region: selectedAddress.region,
              country: selectedAddress.country,
              postalCode: selectedAddress.postalCode || '',
              deliveryType: 'STANDARD',
              deliveryInstructions: selectedAddress.addressLine2 || '',
            };
            const result = await redeemPoints(product.id, quantity, deliveryInfo);
            if (result) {
              Alert.alert(
                '🎉 Order placed!',
                `${result.redeemedPoints.toLocaleString()} points redeemed. We'll process your order shortly.`,
                [{
                  text: 'View order',
                  onPress: () => (navigation as any).reset({
                    index: 0,
                    routes: [{ name: 'Home' }, { name: 'OrderDetails', params: { orderId: result.order.id } }],
                  }),
                }]
              );
            }
          },
        },
      ]
    );
  };

  const navigateToAddAddress = () =>
    (navigation as any).navigate('AddAddress', {
      returnScreen: 'RedeemCheckout',
      returnParams: { product, requiredPoints, currentBalance },
    });

  const navigateToManageAddresses = () =>
    (navigation as any).navigate('ManageAddresses', {
      selectionMode: true,
      returnScreen: 'RedeemCheckout',
      returnParams: { product, requiredPoints, currentBalance },
    });

  // ─── Sub-renders ─────────────────────────────────────────────────────────────

  const ProductHero = () => (
    <View style={s.heroWrap}>
      <Image source={{ uri: imageUri }} style={s.heroImage} resizeMode="cover" />
      {/* Gradient-style overlay via a dark-to-transparent View */}
      <View style={s.heroOverlay} />
      <View style={s.heroBadge}>
        <Ionicons name="star" size={12} color={T.accent} />
        <Text style={s.heroBadgeText}>Points Exclusive</Text>
      </View>
    </View>
  );

  const ProductInfo = () => (
    <View style={s.section}>
      <Text style={s.productName}>{product.name}</Text>
      <View style={s.pointsRow}>
        <View style={s.pointsPill}>
          <Ionicons name="diamond-outline" size={14} color={T.accent} />
          <Text style={s.pointsPillText}>{requiredPoints.toLocaleString()} pts each</Text>
        </View>
        <Text style={s.stockLabel}>{product.stock} left in stock</Text>
      </View>
    </View>
  );

  const QuantityRow = () => (
    <View style={s.section}>
      <View style={s.rowBetween}>
        <Text style={s.label}>Quantity</Text>
        <View style={s.qtyGroup}>
          <TouchableOpacity
            style={[s.qtyBtn, quantity <= 1 && s.qtyBtnDisabled]}
            onPress={() => handleQuantityChange(quantity - 1)}
            disabled={quantity <= 1}
          >
            <Ionicons name="remove" size={18} color={quantity <= 1 ? T.inkFaint : T.accent} />
          </TouchableOpacity>
          <Text style={s.qtyValue}>{quantity}</Text>
          <TouchableOpacity
            style={[s.qtyBtn, quantity >= product.stock && s.qtyBtnDisabled]}
            onPress={() => handleQuantityChange(quantity + 1)}
            disabled={quantity >= product.stock}
          >
            <Ionicons name="add" size={18} color={quantity >= product.stock ? T.inkFaint : T.accent} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const PointsSummary = () => (
    <View style={s.summaryBox}>
      <SummaryLine label="Item subtotal" value={`${(requiredPoints * quantity).toLocaleString()} pts`} />
      <View style={s.summaryDivider} />
      <SummaryLine label="Your balance" value={`${currentBalance.toLocaleString()} pts`} muted />
      <SummaryLine
        label="Balance after"
        value={`${remaining.toLocaleString()} pts`}
        highlight={canAfford ? 'success' : 'danger'}
      />
    </View>
  );

  const SummaryLine = ({ label, value, muted, highlight }: {
    label: string; value: string; muted?: boolean; highlight?: 'success' | 'danger';
  }) => (
    <View style={s.summaryLine}>
      <Text style={[s.summaryLabel, muted && { color: T.inkFaint }]}>{label}</Text>
      <Text style={[
        s.summaryValue,
        highlight === 'success' && { color: T.success },
        highlight === 'danger'  && { color: T.danger },
      ]}>
        {value}
      </Text>
    </View>
  );

  const DeliverySection = () => {
    if (addressLoading && !hasCheckedAddresses) {
      return (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Delivery</Text>
          <View style={s.loadingRow}>
            <ActivityIndicator size="small" color={T.accent} />
            <Text style={s.loadingText}>Loading addresses…</Text>
          </View>
        </View>
      );
    }

    if (!selectedAddress) {
      return (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Delivery</Text>
          <TouchableOpacity style={s.addAddressCard} onPress={navigateToAddAddress} activeOpacity={0.7}>
            <View style={s.addAddressIcon}>
              <Ionicons name="add" size={22} color={T.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.addAddressTitle}>Add a delivery address</Text>
              <Text style={s.addAddressHint}>Required to complete your order</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.inkFaint} />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={s.section}>
        <View style={s.rowBetween}>
          <Text style={s.sectionTitle}>Delivery</Text>
          <TouchableOpacity style={s.changeLink} onPress={navigateToManageAddresses}>
            <Text style={s.changeLinkText}>Change</Text>
          </TouchableOpacity>
        </View>
        <View style={s.addressCard}>
          <View style={s.addressIconWrap}>
            <Ionicons name="location" size={18} color={T.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={s.rowBetween}>
              <Text style={s.recipientName}>{selectedAddress.recipient}</Text>
              {selectedAddress.isDefault && (
                <View style={s.defaultChip}>
                  <Text style={s.defaultChipText}>Default</Text>
                </View>
              )}
            </View>
            <Text style={s.addressPhone}>{selectedAddress.phone}</Text>
            <Text style={s.addressLine}>
              {selectedAddress.addressLine1}
              {selectedAddress.addressLine2 ? `, ${selectedAddress.addressLine2}` : ''}
            </Text>
            <Text style={s.addressLine}>
              {selectedAddress.city}, {selectedAddress.region}{selectedAddress.postalCode ? ` ${selectedAddress.postalCode}` : ''}
            </Text>
            <Text style={s.addressLine}>{selectedAddress.country}</Text>
          </View>
        </View>
      </View>
    );
  };

  // ─── Main render ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ProductHero />

        <View style={s.card}>
          <ProductInfo />
          <View style={s.divider} />
          <QuantityRow />
          <View style={s.divider} />
          <View style={s.section}>
            <Text style={s.sectionTitle}>Points summary</Text>
            <PointsSummary />
          </View>
          <View style={s.divider} />
          <DeliverySection />
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Sticky checkout footer ── */}
      <View style={s.footer}>
        <View style={s.footerInner}>
          <View>
            <Text style={s.footerLabel}>You spend</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
              <Text style={s.footerPoints}>{totalPoints.toLocaleString()}</Text>
              <Text style={s.footerPtLabel}>pts</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              s.redeemBtn,
              (!selectedAddress || redeemLoading || !canAfford) && s.redeemBtnDisabled,
            ]}
            onPress={handleRedeem}
            disabled={!selectedAddress || redeemLoading || !canAfford}
            activeOpacity={0.85}
          >
            {redeemLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="bag-check-outline" size={20} color="#fff" />
                <Text style={s.redeemBtnText}>
                  {!canAfford
                    ? 'Not enough points'
                    : !selectedAddress
                    ? 'Add address'
                    : 'Place order'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.canvas },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // Hero
  heroWrap: { width: '100%', height: 260, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
  heroBadge: {
    position: 'absolute', top: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: T.radius.pill,
  },
  heroBadgeText: { fontSize: T.size.xs, fontWeight: T.weight.bold, color: T.accent, letterSpacing: 0.3 },

  // Card
  card: {
    backgroundColor: T.surface,
    borderTopLeftRadius: T.radius.lg,
    borderTopRightRadius: T.radius.lg,
    marginTop: -T.radius.lg,
    overflow: 'hidden',
  },

  // Section
  section: { paddingHorizontal: 20, paddingVertical: 18 },
  divider: { height: 1, backgroundColor: T.border, marginHorizontal: 20 },
  sectionTitle: {
    fontSize: T.size.sm,
    fontWeight: T.weight.bold,
    color: T.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  label: { fontSize: T.size.base, fontWeight: T.weight.semibold, color: T.ink },

  // Product
  productName: {
    fontSize: T.size.lg,
    fontWeight: T.weight.heavy,
    color: T.ink,
    lineHeight: 26,
    marginBottom: 10,
  },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.accentSoft,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: T.radius.pill,
  },
  pointsPillText: { fontSize: T.size.sm, fontWeight: T.weight.bold, color: T.accent },
  stockLabel: { fontSize: T.size.sm, color: T.inkFaint, fontWeight: T.weight.medium },

  // Quantity
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyGroup: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  qtyBtn: {
    width: 38, height: 38,
    borderWidth: 1.5, borderColor: T.border,
    borderRadius: T.radius.sm,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: T.surface,
  },
  qtyBtnDisabled: { borderColor: T.border, backgroundColor: T.canvas },
  qtyValue: {
    minWidth: 48,
    textAlign: 'center',
    fontSize: T.size.md,
    fontWeight: T.weight.bold,
    color: T.ink,
  },

  // Points summary box
  summaryBox: {
    backgroundColor: T.canvas,
    borderRadius: T.radius.md,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  summaryLine: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 12,
  },
  summaryDivider: { height: 1, backgroundColor: T.border },
  summaryLabel: { fontSize: T.size.base, color: T.inkMuted, fontWeight: T.weight.medium },
  summaryValue: { fontSize: T.size.base, fontWeight: T.weight.bold, color: T.ink },

  // Address
  addAddressCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1.5, borderColor: T.accent, borderStyle: 'dashed',
    borderRadius: T.radius.md,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: T.accentSoft,
  },
  addAddressIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  addAddressTitle: { fontSize: T.size.base, fontWeight: T.weight.semibold, color: T.accent },
  addAddressHint: { fontSize: T.size.sm, color: T.inkFaint, marginTop: 2 },

  addressCard: {
    flexDirection: 'row', gap: 14,
    borderWidth: 1, borderColor: T.border,
    borderRadius: T.radius.md,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  addressIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: T.accentSoft,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 2,
  },
  recipientName: { fontSize: T.size.base, fontWeight: T.weight.bold, color: T.ink },
  addressPhone: { fontSize: T.size.sm, color: T.inkMuted, fontWeight: T.weight.medium, marginBottom: 4 },
  addressLine: { fontSize: T.size.sm, color: T.inkMuted, lineHeight: 19 },
  changeLink: { paddingVertical: 4, paddingLeft: 8 },
  changeLinkText: { fontSize: T.size.sm, fontWeight: T.weight.bold, color: T.accent },
  defaultChip: {
    backgroundColor: T.accentSoft, borderRadius: T.radius.pill,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  defaultChipText: { fontSize: T.size.xs, fontWeight: T.weight.bold, color: T.accent },

  // Loading
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  loadingText: { fontSize: T.size.base, color: T.inkFaint },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: T.ink,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 16,
  },
  footerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerLabel: { fontSize: T.size.xs, color: T.inkFaint, fontWeight: T.weight.medium, marginBottom: 2 },
  footerPoints: { fontSize: T.size.xl, fontWeight: T.weight.heavy, color: T.surface, letterSpacing: -0.5 },
  footerPtLabel: { fontSize: T.size.sm, fontWeight: T.weight.medium, color: T.inkFaint, marginBottom: 3 },
  redeemBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.accent,
    paddingHorizontal: 22, paddingVertical: 14,
    borderRadius: T.radius.md,
    minWidth: 150, justifyContent: 'center',
  },
  redeemBtnDisabled: { backgroundColor: '#334155' },
  redeemBtnText: { fontSize: T.size.base, fontWeight: T.weight.bold, color: '#fff' },
});

export default RedeemCheckoutScreen;