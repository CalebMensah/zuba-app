// screens/ChatListScreen.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useChat } from '../../hooks/useChat';
import { ChatRoom } from '../../types/chat';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';

const ChatListScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  const {
    chatRooms,
    isLoading,
    error,
    fetchChatRooms,
    onlineUsers
  } = useChat({
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000',
    autoConnect: true
  });

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    fetchChatRooms();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchChatRooms();
    setRefreshing(false);
  };

  const navigateToChatRoom = (chatRoomId: string) => {
    (navigation as any).navigate('Chat' as never, { chatRoomId } as never);
  };

  const getOtherParticipant = (room: ChatRoom) => {
    // Get the other participant (not current user)
    if (!user?.id) return null;
    
    const otherParticipant = room.participants.find(
      p => p.userId !== user.id
    );
    return otherParticipant?.user;
  };

  const isUserOnline = (userId: string) => {
    return onlineUsers.has(userId);
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else if (diffInHours < 168) {
      return messageDate.toLocaleDateString([], { weekday: 'short' });
    } else {
      return messageDate.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const renderChatRoom = ({ item }: { item: ChatRoom }) => {
    const otherUser = getOtherParticipant(item);
    const lastMessage = item.lastMessage;
    const unreadCount = item.unreadCount || 0;

    return (
      <TouchableOpacity
        style={styles.chatRoomContainer}
        onPress={() => navigateToChatRoom(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {otherUser?.avatar ? (
            <Image
              source={{ uri: otherUser.avatar }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {otherUser?.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          
          {otherUser && isUserOnline(otherUser.id) && (
            <View style={styles.onlineIndicator} />
          )}
        </View>

        <View style={styles.chatRoomInfo}>
          <View style={styles.chatRoomHeader}>
            <Text style={styles.chatRoomName} numberOfLines={1}>
              {item.name || otherUser?.name || 'Unknown User'}
            </Text>
            
            {lastMessage && (
              <Text style={styles.timestamp}>
                {formatTimestamp(lastMessage.createdAt)}
              </Text>
            )}
          </View>

          <View style={styles.chatRoomFooter}>
            {lastMessage ? (
              <Text
                style={[
                  styles.lastMessage,
                  unreadCount > 0 && styles.unreadMessage
                ]}
                numberOfLines={2}
              >
                {lastMessage.senderId === 'current-user-id' && 'You: '}
                {lastMessage.content || '📎 Media'}
              </Text>
            ) : (
              <Text style={styles.noMessages}>No messages yet</Text>
            )}

            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>

          {item.type === 'ORDER' && item.order && (
            <Text style={[styles.chatRoomType, styles.chatRoomTypeOrder]}>
              📦 Order #{item.order.id.slice(-8)}
            </Text>
          )}

          {item.type === 'PRODUCT_INQUIRY' && item.product && (
            <Text style={styles.chatRoomType}>
              🛍️ {item.product.name}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => fetchChatRooms()}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading && chatRooms.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={Colors.white}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        {chatRooms.length > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {chatRooms.reduce((sum, room) => sum + (room.unreadCount || 0), 0)}
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={chatRooms}
        keyExtractor={(item) => item.id}
        renderItem={renderChatRoom}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>
              Start a conversation by browsing products or checking your orders
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    marginTop: Platform.OS === 'ios' ? 60 : 30,
    paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  headerBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    minWidth: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  headerBadgeText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  listContainer: {
    flexGrow: 1,
    paddingTop: 8,
  },
  chatRoomContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.white,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: Colors.gray100,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.success,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  chatRoomInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatRoomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  chatRoomName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginRight: 8,
    letterSpacing: -0.2,
  },
  timestamp: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  chatRoomFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 15,
    color: Colors.textSecondary,
    marginRight: 8,
    lineHeight: 20,
  },
  unreadMessage: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  noMessages: {
    fontSize: 15,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 9,
  },
  unreadBadgeText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  chatRoomType: {
    fontSize: 13,
    color: Colors.primary,
    marginTop: 4,
    fontWeight: '500',
  },
  chatRoomTypeOrder: {
    color: Colors.accent,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 24,
    opacity: 0.3,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  errorText: {
    color: Colors.error,
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loader: {
    marginTop: 40,
  },
});

export default ChatListScreen;