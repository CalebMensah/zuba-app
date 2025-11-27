import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../hooks/useOrder';
import { useProduct } from '../../hooks/useProducts';
import { useProductLike } from '../../hooks/useProductLikes';
import { useNotifications } from '../../hooks/useNotifications';
import { useStoreFollowing } from '../../hooks/useStoreFollowings';
import { usePoints } from '../../hooks/usePoints';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

const BuyerProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { getUnpaidOrdersSummary, getBuyerOrders } = useOrders();
//  const { getProductsYouMayLike, youMayLikeProducts, loading: productsLoading } = useProduct();
  const { getMyLikedProducts } = useProductLike();
  const { getMyFollowing } = useStoreFollowing();
  const { unreadCount } = useNotifications();
  const { getPointsBalance } = usePoints();

  const [unpaidCount, setUnpaidCount] = useState(0);
  const [unpaidAmount, setUnpaidAmount] = useState(0);
  const [orderCounts, setOrderCounts] = useState({
    pending: 0,
    shipped: 0,
    review: 0,
  });
  const [likedCount, setLikedCount] = useState(0);
  const [followedStoresCount, setFollowedStoresCount] = useState(0);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(width));

  useEffect(() => {
    loadProfileData();
  }, []);

  useEffect(() => {
    if (settingsVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: width,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [settingsVisible]);

  const loadProfileData = async () => {
    try {
      setLoading(true);

      // Load unpaid orders summary
      const unpaidSummary = await getUnpaidOrdersSummary();
      if (unpaidSummary) {
        setUnpaidCount(unpaidSummary.totalUnpaidOrders);
        setUnpaidAmount(unpaidSummary.totalAmount);
      }

      // Load orders by status
      const pendingOrders = await getBuyerOrders(1, 1, 'PENDING');
      const shippedOrders = await getBuyerOrders(1, 1, 'SHIPPED');
      const deliveredOrders = await getBuyerOrders(1, 1, 'DELIVERED');

      setOrderCounts({
        pending: pendingOrders?.pagination.total || 0,
        shipped: shippedOrders?.pagination.total || 0,
        review: deliveredOrders?.pagination.total || 0,
      });

      // Load liked products count
      const likedProducts = await getMyLikedProducts();
      setLikedCount(likedProducts?.length || 0);

      // Load followed stores count
       const followedStores = await getMyFollowing();
       setFollowedStoresCount(followedStores?.length || 0);

       const pointBalance = await getPointsBalance();
       setPointsBalance(pointBalance?.points || 0);
      
       //load unread notifications count
      setNotificationsCount(unreadCount);

      // Load recommended products
      //await getProductsYouMayLike();
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleSettingsItemPress = (screen: string) => {
    setSettingsVisible(false);
    setTimeout(() => {
      (navigation as any).navigate(screen);
    }, 300);
  };

  const QuickActionCard = ({ icon, label, count, color, onPress }: any) => (
    <TouchableOpacity style={styles.quickActionCard} onPress={onPress}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.quickActionCount}>{count}</Text>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const OrderStatusCard = ({ icon, label, count, color, onPress }: any) => (
    <TouchableOpacity style={styles.orderStatusCard} onPress={onPress}>
      <View style={[styles.orderIconContainer, { backgroundColor: color + '15' }]}>
        <MaterialIcons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.orderCount}>{count}</Text>
      <Text style={styles.orderLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const ProductCard = ({ product }: any) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => (navigation as any).navigate('SellerPublicProductDetails', { productUrl: product.url })}
    >
      <Image
        source={{ uri: product.images[0] || 'https://via.placeholder.com/150' }}
        style={styles.productImage}
      />
      <Text style={styles.productName} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={styles.productPrice}>GHS {product.price.toFixed(2)}</Text>
    </TouchableOpacity>
  );

  const SettingsMenuItem = ({ icon, label, onPress, color = '#000' }: any) => (
    <TouchableOpacity style={styles.settingsMenuItem} onPress={onPress}>
      <View style={styles.settingsMenuIconContainer}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.settingsMenuLabel, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.editIcon}
              onPress={() => (navigation as any).navigate('EditProfile')}
            >
              <Ionicons name="pencil" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={styles.email}>{user?.email}</Text>
            {user?.phone && <Text style={styles.phone}>{user.phone}</Text>}
          </View>
          {/* Settings Icon */}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setSettingsVisible(true)}
          >
            <Ionicons name="settings-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <QuickActionCard
            icon="bell"
            label="Notifications"
            count={notificationsCount}
            color="#FF9500"
            onPress={() => (navigation as any).navigate('Notifications')}
          />
          <QuickActionCard
            icon="gift-outline"
            label="Points"
            count={pointsBalance}
            color="#34C759"
            onPress={() => (navigation as any).navigate('Points')}
          />
          <QuickActionCard
            icon="heart-outline"
            label="Following"
            count={followedStoresCount}
            color="#FF2D55"
            onPress={() => (navigation as any).navigate('MyFollowedStores')}
          />
          <QuickActionCard
            icon="scale-balance"
            label="Disputes"
            count="0"
            color="#5856D6"
            onPress={() => (navigation as any).navigate('Disputes')}
          />
        </View>

        {/* My Orders Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Orders</Text>
            <TouchableOpacity onPress={() => (navigation as any).navigate('BuyerOrders')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.orderStatusContainer}>
            <OrderStatusCard
              icon="pending-actions"
              label="Unpaid"
              count={unpaidCount}
              color="#FF3B30"
              onPress={() => (navigation as any).navigate('UnpaidOrders')}
            />
            <OrderStatusCard
              icon="schedule"
              label="Pending"
              count={orderCounts.pending}
              color="#FF9500"
              onPress={() => (navigation as any).navigate('BuyerOrders', { status: 'PENDING' })}
            />
            <OrderStatusCard
              icon="local-shipping"
              label="Shipped"
              count={orderCounts.shipped}
              color="#007AFF"
              onPress={() => (navigation as any).navigate('BuyerOrders', { status: 'SHIPPED' })}
            />
            <OrderStatusCard
              icon="rate-review"
              label="Review"
              count={orderCounts.review}
              color="#34C759"
              onPress={() => (navigation as any).navigate('BuyerOrders', { status: 'DELIVERED' })}
            />
          </View>

          {/* Unpaid Orders Alert */}
          {unpaidCount > 0 && (
            <TouchableOpacity
              style={styles.unpaidAlert}
              onPress={() => (navigation as any).navigate('UnpaidOrders')}
            >
              <Ionicons name="warning" size={20} color="#FF3B30" />
              <Text style={styles.unpaidAlertText}>
                You have {unpaidCount} unpaid order{unpaidCount > 1 ? 's' : ''} (GHS{' '}
                {unpaidAmount.toFixed(2)})
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>

        {/* Following & Likes Section */}
        <View style={styles.section}>
          <View style={styles.followLikeContainer}>
            <TouchableOpacity
              style={styles.followLikeCard}
              onPress={() => (navigation as any).navigate('MyFollowedStores')}
            >
              <View style={styles.followLikeIconContainer}>
                <FontAwesome5 name="store" size={24} color="#007AFF" />
              </View>
              <View style={styles.followLikeInfo}>
                <Text style={styles.followLikeCount}>{followedStoresCount}</Text>
                <Text style={styles.followLikeLabel}>Following Stores</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.followLikeCard}
              onPress={() => (navigation as any).navigate('LikedProducts')}
            >
              <View style={styles.followLikeIconContainer}>
                <Ionicons name="heart" size={24} color="#FF2D55" />
              </View>
              <View style={styles.followLikeInfo}>
                <Text style={styles.followLikeCount}>{likedCount}</Text>
                <Text style={styles.followLikeLabel}>Liked Products</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        </View>

       
        {/* Products You May Like Section */}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Settings Modal */}
      <Modal
        visible={settingsVisible}
        transparent={true}
        animationType="none"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSettingsVisible(false)}
          />
          <Animated.View
            style={[
              styles.settingsModal,
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Settings</Text>
              <TouchableOpacity
                onPress={() => setSettingsVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.settingsContent} showsVerticalScrollIndicator={false}>
              <SettingsMenuItem
                icon="gift-outline"
                label="Redeem Points"
                onPress={() => handleSettingsItemPress('Points')}
              />
              <SettingsMenuItem
                icon="list-outline"
                label="Points History"
                onPress={() => handleSettingsItemPress('PointsHistory')}
              />
              <SettingsMenuItem
                icon="location-outline"
                label="Manage Address"
                onPress={() => handleSettingsItemPress('ManageAddresses')}
              />
              <SettingsMenuItem
                icon="person-outline"
                label="Edit Account"
                onPress={() => handleSettingsItemPress('EditProfile')}
              />
              <View style={styles.settingsDivider} />
              <SettingsMenuItem
                icon="document-text-outline"
                label="Terms and Conditions"
                onPress={() => handleSettingsItemPress('terms')}
              />
              <SettingsMenuItem
                icon="shield-checkmark-outline"
                label="Privacy and Policy"
                onPress={() => handleSettingsItemPress('Ploicy')}
              />
              <SettingsMenuItem
                icon="information-circle-outline"
                label="About Us"
                onPress={() => handleSettingsItemPress('About')}
              />
              <SettingsMenuItem
                icon="mail-outline"
                label="Contact Support"
                onPress={() => handleSettingsItemPress('Support')}
              />
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  profileHeader: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E5E5EA',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  phone: {
    fontSize: 14,
    color: '#8E8E93',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  quickActionCard: {
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  viewAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  orderStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  orderStatusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  orderLabel: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
  },
  unpaidAlert: {
    backgroundColor: '#FFF3F2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  unpaidAlertText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '500',
  },
  followLikeContainer: {
    gap: 12,
  },
  followLikeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  followLikeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  followLikeInfo: {
    flex: 1,
    marginLeft: 16,
  },
  followLikeCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
  },
  followLikeLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginRight: 12,
    width: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  productName: {
    fontSize: 13,
    color: '#000',
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#007AFF',
    marginHorizontal: 8,
    marginBottom: 12,
  },
  loader: {
    marginVertical: 20,
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 40,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  settingsModal: {
    width: '80%',
    height: '100%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsContent: {
    flex: 1,
  },
  settingsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  settingsMenuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingsMenuLabel: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  settingsDivider: {
    height: 8,
    backgroundColor: '#F2F2F7',
    marginVertical: 8,
  },
});

export default BuyerProfileScreen;