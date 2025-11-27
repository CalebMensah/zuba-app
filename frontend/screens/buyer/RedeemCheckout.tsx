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
  const imageUri = Array.isArray(product.images) && product.images.length > 0
    ? product.images[0]
    : 'https://via.placeholder.com/200';

  useEffect(() => {
    loadAddresses();
  }, [selectedAddressId]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const loadAddresses = async () => {
    try {
      if (selectedAddressId) {
        // Load specific address if one was selected
        const address = await getUserAddressById(selectedAddressId);
        if (address) {
          setSelectedAddress(address);
        }
      } else {
        // Load all addresses and use default or first one
        const addresses = await getUserAddresses();
        if (addresses && addresses.length > 0) {
          const defaultAddress = addresses.find((addr: any) => addr.isDefault);
          setSelectedAddress(defaultAddress || addresses[0]);
        }
      }
      setHasCheckedAddresses(true);
    } catch (err) {
      console.error('Error loading addresses:', err);
      setHasCheckedAddresses(true);
    }
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity < 1) return;
    if (newQuantity > product.stock) {
      Alert.alert('Stock Limit', `Only ${product.stock} items available in stock.`);
      return;
    }

    const newTotalPoints = requiredPoints * newQuantity;
    if (newTotalPoints > currentBalance) {
      Alert.alert(
        'Insufficient Points',
        `You need ${newTotalPoints} points but only have ${currentBalance} points.`
      );
      return;
    }

    setQuantity(newQuantity);
  };

  const handleRedeem = async () => {
    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please add a delivery address to continue.');
      return;
    }

    if (totalPoints > currentBalance) {
      Alert.alert('Insufficient Points', 'You do not have enough points for this redemption.');
      return;
    }

    Alert.alert(
      'Confirm Redemption',
      `Redeem ${totalPoints} points for ${quantity}x ${product.name}?\n\nNew balance: ${currentBalance - totalPoints} points`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          style: 'default',
          onPress: async () => {
            // Convert address to DeliveryInfo format
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
                'Success! 🎉',
                `You've successfully redeemed ${result.redeemedPoints} points!\n\nYour order has been confirmed and will be processed shortly.`,
                [
                  {
                    text: 'View Order',
                    onPress: () => {
                      (navigation as any).reset({
                        index: 0,
                        routes: [
                          { name: 'Home' },
                          { 
                            name: 'OrderDetails', 
                            params: { orderId: result.order.id } 
                          }
                        ],
                      });
                    },
                  },
                ]
              );
            }
          },
        },
      ]
    );
  };

  const navigateToAddAddress = () => {
    (navigation as any).navigate('AddAddress', {
      returnScreen: 'RedeemCheckout',
      returnParams: { product, requiredPoints, currentBalance },
    });
  };

  const navigateToManageAddresses = () => {
    (navigation as any).navigate('ManageAddresses', {
      selectionMode: true,
      returnScreen: 'RedeemCheckout',
      returnParams: { product, requiredPoints, currentBalance },
    });
  };

  const renderOrderSummary = () => (
    <View style={styles.summaryCard}>
      <Text style={styles.sectionTitle}>Order Summary</Text>

      <View style={styles.productRow}>
        <Image source={{ uri: imageUri }} style={styles.productImage} />
        <View style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={styles.productPrice}>
            {requiredPoints.toLocaleString()} points each
          </Text>
        </View>
      </View>

      <View style={styles.quantitySelector}>
        <Text style={styles.label}>Quantity</Text>
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(quantity - 1)}
            disabled={quantity <= 1}
          >
            <Ionicons
              name="remove"
              size={20}
              color={quantity <= 1 ? Colors.disabled : Colors.primary}
            />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(quantity + 1)}
            disabled={quantity >= product.stock}
          >
            <Ionicons
              name="add"
              size={20}
              color={quantity >= product.stock ? Colors.disabled : Colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Total Points</Text>
        <Text style={styles.summaryValue}>{totalPoints.toLocaleString()}</Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Current Balance</Text>
        <Text style={styles.balanceValue}>{currentBalance.toLocaleString()}</Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>New Balance</Text>
        <Text style={styles.newBalanceValue}>
          {(currentBalance - totalPoints).toLocaleString()}
        </Text>
      </View>
    </View>
  );

  const renderDeliveryAddress = () => {
    if (addressLoading && !hasCheckedAddresses) {
      return (
        <View style={styles.addressCard}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading addresses...</Text>
          </View>
        </View>
      );
    }

    if (!selectedAddress) {
      return (
        <View style={styles.addressCard}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.noAddressContainer}>
            <Ionicons name="location-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.noAddressTitle}>No delivery address</Text>
            <Text style={styles.noAddressSubtitle}>
              Please add a delivery address to continue with your order
            </Text>
            <TouchableOpacity
              style={styles.addAddressButton}
              onPress={navigateToAddAddress}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors.white} />
              <Text style={styles.addAddressButtonText}>Add Address</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.addressCard}>
        <View style={styles.addressHeader}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <TouchableOpacity
            style={styles.changeButton}
            onPress={navigateToManageAddresses}
          >
            <Text style={styles.changeButtonText}>Change</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.addressContent}>
          <View style={styles.addressIconContainer}>
            <Ionicons name="location" size={20} color={Colors.primary} />
          </View>
          <View style={styles.addressInfo}>
            <Text style={styles.recipientName}>{selectedAddress.recipient}</Text>
            <Text style={styles.recipientPhone}>{selectedAddress.phone}</Text>
            <Text style={styles.addressText}>
              {selectedAddress.addressLine1}
              {selectedAddress.addressLine2 ? `, ${selectedAddress.addressLine2}` : ''}
            </Text>
            <Text style={styles.addressText}>
              {selectedAddress.city}, {selectedAddress.region}
            </Text>
            <Text style={styles.addressText}>{selectedAddress.country}</Text>
            {selectedAddress.postalCode && (
              <Text style={styles.addressText}>{selectedAddress.postalCode}</Text>
            )}
            {selectedAddress.isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderOrderSummary()}
        {renderDeliveryAddress()}

        <View style={styles.spacing} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <View>
            <Text style={styles.footerLabel}>Total Points</Text>
            <Text style={styles.footerValue}>{totalPoints.toLocaleString()}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.redeemButton,
              (redeemLoading || !selectedAddress) && styles.redeemButtonDisabled
            ]}
            onPress={handleRedeem}
            disabled={redeemLoading || !selectedAddress}
          >
            {redeemLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="gift" size={20} color={Colors.white} />
                <Text style={styles.redeemButtonText}>
                  {selectedAddress ? 'Redeem Now' : 'Add Address First'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  addressCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  productRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.gray100,
  },
  productDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  quantitySelector: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  newBalanceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.success,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  noAddressContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noAddressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 8,
  },
  noAddressSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  addAddressButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  addAddressButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  addressContent: {
    flexDirection: 'row',
    gap: 12,
  },
  addressIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  recipientPhone: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.white,
    textTransform: 'uppercase',
  },
  spacing: {
    height: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  footerValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  redeemButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  redeemButtonDisabled: {
    backgroundColor: Colors.disabled,
  },
  redeemButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});

export default RedeemCheckoutScreen;