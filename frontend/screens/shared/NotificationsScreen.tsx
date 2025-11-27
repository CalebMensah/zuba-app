import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNotifications } from '../../hooks/useNotifications';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  data?: any;
  read: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    pagination,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    refetch,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Handle pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch(1);
    setRefreshing(false);
  };

  // Load more notifications
  const loadMore = async () => {
    if (pagination && pagination.page < pagination.pages && !loadingMore) {
      setLoadingMore(true);
      await fetchNotifications(pagination.page + 1);
      setLoadingMore(false);
    }
  };

  // Navigate based on notification type
  const handleViewDetails = async (notification: Notification) => {
    // Mark as read first
    try {
      if (!notification.read) {
        await markAsRead(notification.id);
      }

      // Navigate based on type
      const { type, data } = notification;

      switch (type.toLowerCase()) {
        case 'order':
        case 'order_created':
        case 'order_updated':
        case 'order_cancelled':
        case 'order_completed':
          (navigation as any).navigate('OrderDetails', { orderId: data?.orderId });
          break;

        case 'dispute':
        case 'dispute_created':
        case 'dispute_updated':
        case 'dispute_resolved':
          (navigation as any).navigate('DisputeDetails', { disputeId: data?.disputeId });
          break;

        case 'payment':
        case 'payment_received':
        case 'payment_failed':
        case 'payment_refunded':
          (navigation as any).navigate('PaymentDetails', { paymentId: data?.paymentId });
          break;

        case 'escrow':
        case 'escrow_released':
        case 'escrow_held':
          (navigation as any).navigate('EscrowDetails', { escrowId: data?.escrowId });
          break;

        case 'review':
        case 'review_received':
          (navigation as any).navigate('ReviewDetails', { reviewId: data?.reviewId });
          break;

        case 'message':
        case 'new_message':
          (navigation as any).navigate('ChatDetails', { chatId: data?.chatId });
          break;

        case 'profile':
        case 'profile_updated':
          (navigation as any).navigate('Profile');
          break;

        case 'wallet':
        case 'wallet_updated':
          (navigation as any).navigate('Wallet');
          break;

        default:
          Alert.alert('Notification', notification.message);
          break;
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to process notification');
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    Alert.alert(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await markAllAsRead();
              Alert.alert('Success', 'All notifications marked as read');
            } catch (err) {
              Alert.alert('Error', 'Failed to mark all as read');
            }
          },
        },
      ]
    );
  };

  // Get icon based on notification type
  const getNotificationIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'order':
      case 'order_created':
      case 'order_updated':
      case 'order_cancelled':
      case 'order_completed':
        return 'package-variant';
      case 'dispute':
      case 'dispute_created':
      case 'dispute_updated':
      case 'dispute_resolved':
        return 'alert-circle';
      case 'payment':
      case 'payment_received':
      case 'payment_failed':
      case 'payment_refunded':
        return 'cash';
      case 'escrow':
      case 'escrow_released':
      case 'escrow_held':
        return 'shield-lock';
      case 'review':
      case 'review_received':
        return 'star';
      case 'message':
      case 'new_message':
        return 'message-text';
      case 'profile':
      case 'profile_updated':
        return 'account';
      case 'wallet':
      case 'wallet_updated':
        return 'wallet';
      default:
        return 'bell';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Render notification item
  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      onPress={() => handleViewDetails(item)}
    >
      <View style={styles.iconContainer}>
        <Icon
          name={getNotificationIcon(item.type)}
          size={24}
          color={item.read ? '#666' : '#007AFF'}
        />
        {!item.read && <View style={styles.unreadDot} />}
      </View>

      <View style={styles.contentContainer}>
        <Text style={[styles.title, !item.read && styles.unreadTitle]}>
          {item.title}
        </Text>
        <Text style={styles.message} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
      </View>

      <TouchableOpacity
        style={styles.detailsButton}
        onPress={() => handleViewDetails(item)}
      >
        <Text style={styles.detailsButtonText}>View</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="bell-off" size={64} color="#ccc" />
      <Text style={styles.emptyText}>No notifications yet</Text>
      <Text style={styles.emptySubtext}>
        You'll see updates about your orders and activities here
      </Text>
    </View>
  );

  // Render footer
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadCount}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
          >
            <Text style={styles.markAllButtonText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Error state */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => refetch(1)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading state */}
      {loading && notifications.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        /* Notifications list */
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={
            notifications.length === 0 ? styles.emptyList : styles.listContent
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  unreadCount: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 2,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  markAllButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadCard: {
    backgroundColor: '#F0F8FF',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#fff',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: 'bold',
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  detailsButton: {
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  detailsButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    flex: 1,
  },
  retryText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default NotificationsScreen;