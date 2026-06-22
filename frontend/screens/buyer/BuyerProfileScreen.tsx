import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  Modal,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  useBuyerOrders,
} from '../../hooks/useOrder';
import { useProductLike } from '../../hooks/useProductLikes';
import { useNotifications } from '../../hooks/useNotifications';
import { useStoreFollowing } from '../../hooks/useStoreFollowings';
import { usePoints } from '../../hooks/usePoints';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Colors } from '../../constants/colors';

const { width } = Dimensions.get('window');

const BuyerProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const unpaidOrdersQuery = useBuyerOrders({ page: 1, limit: 10, status: 'PENDING_PAYMENT' });
  const pendingOrdersQuery = useBuyerOrders({ page: 1, limit: 1, status: 'PENDING' });
  const shippedOrdersQuery = useBuyerOrders({ page: 1, limit: 1, status: 'SHIPPED' });
  const deliveredOrdersQuery = useBuyerOrders({ page: 1, limit: 1, status: 'DELIVERED' });

  const { getMyLikedProducts } = useProductLike();
  const { getMyFollowing } = useStoreFollowing();
  const { unreadCount } = useNotifications();
  const { getPointsBalance } = usePoints();

  const [likedCount, setLikedCount] = useState(0);
  const [followedStoresCount, setFollowedStoresCount] = useState(0);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [loadingLegacyData, setLoadingLegacyData] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(width));

  const isLoadingQueries =
    unpaidOrdersQuery.isLoading ||
    pendingOrdersQuery.isLoading ||
    shippedOrdersQuery.isLoading ||
    deliveredOrdersQuery.isLoading;

  const isLoading = isLoadingQueries || loadingLegacyData;
  const hasData =
    unpaidOrdersQuery.data ||
    pendingOrdersQuery.data ||
    shippedOrdersQuery.data ||
    deliveredOrdersQuery.data;

  // Derive data from queries
  const unpaidCount = unpaidOrdersQuery.data?.pagination?.total || 0;
  const unpaidAmount =
    unpaidOrdersQuery.data?.orders?.reduce((sum: number, o: any) => sum + (o.buyerTotalAmount ?? o.totalAmount ?? 0), 0) ||
    0;

  const orderCounts = {
    pending: pendingOrdersQuery.data?.pagination.total || 0,
    shipped: shippedOrdersQuery.data?.pagination.total || 0,
    review: deliveredOrdersQuery.data?.pagination.total || 0,
  };

  useEffect(() => {
    loadLegacyData();
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

  const loadLegacyData = async () => {
    try {
      setLoadingLegacyData(true);
      const likedProducts = await getMyLikedProducts();
      setLikedCount(likedProducts?.length || 0);
      const followedStores = await getMyFollowing();
      setFollowedStoresCount(followedStores?.count || 0);
      const pointBalance = await getPointsBalance();
      setPointsBalance(pointBalance?.points || 0);
      setNotificationsCount(unreadCount);
    } catch (error) {
      console.error('Error loading legacy data:', error);
    } finally {
      setLoadingLegacyData(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([
      unpaidOrdersQuery.refetch(),
      pendingOrdersQuery.refetch(),
      shippedOrdersQuery.refetch(),
      deliveredOrdersQuery.refetch(),
    ]);
    await loadLegacyData();
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

  const QuickActionCard = ({ icon, label, count, onPress }: any) => (
    <TouchableOpacity style={styles.quickActionCard} onPress={onPress}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name={icon} size={24} color="#000" />
        {count != null && count > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count > 99 ? '99+' : String(count)}</Text>
          </View>
        )}
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const OrderStatusCard = ({ icon, label, count, onPress }: any) => (
    <TouchableOpacity style={styles.orderStatusCard} onPress={onPress}>
      <View style={styles.orderIconContainer}>
        <MaterialIcons name={icon} size={28} color="#000" />
        {count != null && count > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count > 99 ? '99+' : String(count)}</Text>
          </View>
        )}
      </View>
      <Text style={styles.orderLabel}>{label}</Text>
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

  if (isLoading && !hasData) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size={40} color="#007AFF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }
  const isRefreshing =
    (unpaidOrdersQuery.isFetching && !!unpaidOrdersQuery.data) ||
    (pendingOrdersQuery.isFetching && !!pendingOrdersQuery.data) ||
    (shippedOrdersQuery.isFetching && !!shippedOrdersQuery.data) ||
    (deliveredOrdersQuery.isFetching && !!deliveredOrdersQuery.data);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
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
            icon="credit-card-check-outline"
            label="Payments"
            onPress={() => (navigation as any).navigate('PaymentsScreen')}
          />
          <QuickActionCard
            icon="gift-outline"
            label="Points"
            count={pointsBalance}
            onPress={() => (navigation as any).navigate('Points')}
          />
          <QuickActionCard
            icon="heart-outline"
            label="Following"
            count={followedStoresCount}
            onPress={() => (navigation as any).navigate('MyFollowedStores')}
          />
          <QuickActionCard
            icon="scale-balance"
            label="Disputes"
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
              onPress={() => (navigation as any).navigate('BuyerOrders', { status: 'PENDING_PAYMENT' })}
            />

            <OrderStatusCard
              icon="schedule"
              label="Pending"
              count={orderCounts.pending}
              onPress={() =>
                (navigation as any).navigate('BuyerOrders', { status: 'PENDING' })
              }
            />
            <OrderStatusCard
              icon="local-shipping"
              label="Shipped"
              count={orderCounts.shipped}
              onPress={() =>
                (navigation as any).navigate('BuyerOrders', { status: 'SHIPPED' })
              }
            />
            <OrderStatusCard
              icon="rate-review"
              label="Review"
              count={orderCounts.review}
              onPress={() =>
                (navigation as any).navigate('BuyerOrders', { status: 'DELIVERED' })
              }
            />
          </View>

          {/* Unpaid Orders Alert */}
          {unpaidCount > 0 && (
            <TouchableOpacity
              style={styles.unpaidAlert}
              onPress={() => (navigation as any).navigate('BuyerOrders', { status: 'PENDING_PAYMENT' })}
            >

              <Ionicons name="warning" size={20} color="#FF3B30" />
              <Text style={styles.unpaidAlertText}>
                {`You have ${unpaidCount} unpaid order${
                  unpaidCount > 1 ? 's' : ''
                } (GHS ${unpaidAmount.toFixed(2)})`}
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
                <FontAwesome5 name="store" size={24} color="#000" />
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
                <Ionicons name="heart" size={24} color="#000" />
              </View>
              <View style={styles.followLikeInfo}>
                <Text style={styles.followLikeCount}>{likedCount}</Text>
                <Text style={styles.followLikeLabel}>Liked Products</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        </View>

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
                onPress={() => handleSettingsItemPress('Terms')}
              />
              <SettingsMenuItem
                icon="shield-checkmark-outline"
                label="Privacy and Policy"
                onPress={() => handleSettingsItemPress('Policy')}
              />
              <SettingsMenuItem
                icon="information-circle-outline"
                label="About Us"
                onPress={() => handleSettingsItemPress('About')}
              />

              <SettingsMenuItem
                icon="mail-outline"
                label="Contact Support"
                onPress={() => handleSettingsItemPress('ContactUs')}
              />
              <View style={styles.settingsDivider} />
              <SettingsMenuItem
                icon="log-out-outline"
                label="Logout"
                onPress={handleLogout}
                color="#FF3B30"
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
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
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
    color: Colors.primary,
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
    position: 'relative',
  },
  countBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
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
    color: Colors.primary,
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
    position: 'relative',
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