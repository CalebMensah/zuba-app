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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useSellerDashboard } from '../../hooks/useSellerDashboard';
import useDisputes from '../../hooks/useDisputes';
import { useStoreFollowing } from '../../hooks/useStoreFollowings';
import useReviews from '../../hooks/useReview';

const { width } = Dimensions.get('window');

const SellerProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const {
    summary,
    fetchSummary,
    loading: dashboardLoading,
  } = useSellerDashboard();
  const {
    getUserDisputes,
    loading: disputesLoading,
  } = useDisputes();
  const {
    getStoreFollowerCount,
  } = useStoreFollowing();
  const {
    getSellerStoreReviews,
  } = useReviews();

  const [disputesCount, setDisputesCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
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

      // Fetch seller dashboard summary
      await fetchSummary();

      // Fetch disputes count
      const disputesData = await getUserDisputes(1, 1);
      setDisputesCount(disputesData?.pagination.total || 0);

      // Fetch followers count
      if ((user as any)?.storeUrl) {
        const followerCount = await getStoreFollowerCount((user as any).storeUrl);
        setFollowersCount(followerCount);
      }

      // Fetch reviews count
      const reviewsData = await getSellerStoreReviews({ page: 1, limit: 1 });
      setReviewsCount(reviewsData?.pagination.total || 0);
    } catch (error) {
      console.error('Error loading seller profile data:', error);
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
    <TouchableOpacity style={styles.quickActionCard} onPress={onPress} disabled={!onPress}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.quickActionCount}>{count}</Text>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const OrderStatusCard = ({ icon, label, count, color, onPress }: any) => (
    <TouchableOpacity style={styles.orderStatusCard} onPress={onPress}>
      <View style={[styles.orderIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.orderCount}>{count}</Text>
      <Text style={styles.orderLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const SettingsMenuItem = ({ icon, label, onPress, color = '#007AFF' }: any) => (
    <TouchableOpacity style={styles.settingsMenuItem} onPress={onPress}>
      <View style={styles.settingsMenuItemLeft}>
        <View style={[styles.settingsMenuIcon, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <Text style={styles.settingsMenuLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );

  if (loading || dashboardLoading || disputesLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <>
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
            icon="notifications-outline"
            label="Notifications"
            count={0 /* Could add notifications count here */}
            color="#FF9500"
            onPress={() => (navigation as any).navigate('Notifications')}
          />
          <QuickActionCard
            icon="star-outline"
            label="Reviews"
            count={reviewsCount}
            color="#FFD700"
            onPress={() => (navigation as any).navigate('MyStoreReviews')}
          />
          <QuickActionCard
            icon="people-outline"
            label="Followers"
            count={followersCount}
            color="#007AFF"
            onPress={undefined} // No action
          />
          <QuickActionCard
            icon="shield-checkmark-outline"
            label="Disputes"
            count={disputesCount}
            color="#5856D6"
            onPress={() => (navigation as any).navigate('SellerDisputeManagement')}
          />
        </View>

        {/* Orders Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Orders</Text>
            <TouchableOpacity onPress={() => (navigation as any).navigate('Orders')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.orderStatusContainer}>
            <OrderStatusCard
              icon="time-outline"
              label="Pending"
              count={summary?.pendingOrders || 0}
              color="#FF9500"
              onPress={() => (navigation as any).navigate('Orders', { status: 'PENDING' })}
            />
            <OrderStatusCard
              icon="checkmark-done-outline"
              label="Confirmed"
              count={summary?.confirmedOrders || 0}
              color="#34C759"
              onPress={() => (navigation as any).navigate('Orders', { status: 'CONFIRMED' })}
            />
            <OrderStatusCard
              icon="car-outline"
              label="Shipped"
              count={summary?.shippedOrders || 0}
              color="#007AFF"
              onPress={() => (navigation as any).navigate('Orders', { status: 'SHIPPED' })}
            />
            <OrderStatusCard
              icon="checkmark-circle-outline"
              label="Completed"
              count={summary?.deliveredOrders || 0}
              color="#5856D6"
              onPress={() => (navigation as any).navigate('Orders', { status: 'COMPLETED' })}
            />
          </View>
        </View>

        {/* My Followers and My Products Section */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.followLikeCard} disabled>
            <View style={styles.followLikeIconContainer}>
              <Ionicons name="people" size={24} color="#007AFF" />
            </View>
            <View style={styles.followLikeInfo}>
              <Text style={styles.followLikeCount}>{followersCount}</Text>
              <Text style={styles.followLikeLabel}>My Followers</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.followLikeCard}
            onPress={() => (navigation as any).navigate('ManageProducts')}
          >
            <View style={styles.followLikeIconContainer}>
              <Ionicons name="pricetags" size={24} color="#34C759" />
            </View>
            <View style={styles.followLikeInfo}>
              <Text style={styles.followLikeCount}>{summary?.totalProducts || 0}</Text>
              <Text style={styles.followLikeLabel}>My Products</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

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
        transparent
        animationType="none"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSettingsVisible(false)}
          />
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              <SettingsMenuItem
                icon="card-outline"
                label="Payout Account"
                color="#34C759"
                onPress={() => handleSettingsItemPress('ManagePayoutAccount')}
              />
              <SettingsMenuItem
                icon="star-outline"
                label="Reviews"
                color="#FFD700"
                onPress={() => handleSettingsItemPress('MyStoreReviews')}
              />
              <SettingsMenuItem
                icon="storefront-outline"
                label="My Store"
                color="#007AFF"
                onPress={() => handleSettingsItemPress('MyStore')}
              />
              <SettingsMenuItem
                icon="person-outline"
                label="Edit Account"
                color="#5856D6"
                onPress={() => handleSettingsItemPress('EditProfile')}
              />
              <SettingsMenuItem
                icon="document-text-outline"
                label="Terms and Conditions"
                color="#8E8E93"
                onPress={() => handleSettingsItemPress('Terms')}
              />
              <SettingsMenuItem
                icon="shield-checkmark-outline"
                label="Privacy Policy"
                color="#8E8E93"
                onPress={() => handleSettingsItemPress('Policy')}
              />
              <SettingsMenuItem
                icon="information-circle-outline"
                label="About Us"
                color="#8E8E93"
                onPress={() => handleSettingsItemPress('About')}
              />
              <SettingsMenuItem
                icon="chatbubble-ellipses-outline"
                label="Contact Support"
                color="#FF9500"
                onPress={() => handleSettingsItemPress('Support')}
              />
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
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
  followLikeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
  },
  followLikeLabel: {
    fontSize: 14,
    color: '#8E8E93',
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
  modalContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    height: '100%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  modalScrollView: {
    flex: 1,
  },
  settingsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  settingsMenuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsMenuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsMenuLabel: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
});

export default SellerProfileScreen;