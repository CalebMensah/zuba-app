// screens/MainChatScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  StyleSheet,
  StatusBar,
  Alert,
  Modal,
  Clipboard,
  Dimensions,
  ScrollView
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useChatRoom } from '../../hooks/useChatRoom';
import { ChatMessage as ChatMessageType } from '../../types/chat';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { Colors } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RouteParams {
  chatRoomId: string;
  otherUserName?: string;
  otherUserAvatar?: string;
  otherUserType?: 'buyer' | 'seller';
  storeName?: string;
  storeLogo?: string;
}

const ChatScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { 
    chatRoomId, 
    otherUserName, 
    otherUserAvatar, 
    otherUserType,
    storeName,
    storeLogo 
  } = route.params as RouteParams;
  
  const {
    messages,
    typingUsers,
    isLoading,
    error,
    sendMessage,
    replyToMessage,
    editMessage,
    deleteMessage,
    startTyping,
    stopTyping,
    loadMoreMessages,
    hasMoreMessages
  } = useChatRoom({
    chatRoomId,
    autoJoin: true,
    autoMarkAsRead: true
  });

  const [inputText, setInputText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<Array<{
    uri: string;
    type: string;
    name: string;
  }>>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessageType | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessageType | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessageType | null>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  
  const { user } = useAuth();
  const currentUserId = user?.id || '';
  const currentUserType = user?.role || 'buyer';

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadMoreMessages();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to send images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
      allowsEditing: false
    });

    if (!result.canceled && result.assets) {
      const media = result.assets.map(asset => ({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        name: `media_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`
      }));
      
      setSelectedMedia(prev => [...prev, ...media]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false
    });

    if (!result.canceled && result.assets[0]) {
      const media = {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: `photo_${Date.now()}.jpg`
      };
      
      setSelectedMedia(prev => [...prev, media]);
    }
  };

  const showMediaOptions = () => {
    Alert.alert(
      'Send Media',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickMedia },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleSend = async () => {
    if (!inputText.trim() && selectedMedia.length === 0) return;

    const tempMessage: ChatMessageType = {
      id: `temp-${Date.now()}`,
      chatRoomId: chatRoomId,
      senderId: currentUserId,
      content: inputText,
      media: selectedMedia.map(m => m.uri),
      createdAt: new Date(),
      updatedAt: new Date(),
      isRead: false,
      sender: {
        id: currentUserId,
        name: user?.firstName || 'You',
        avatar: user?.avatar,
        email: user?.email || ''
      }
    };

    stopTyping();

    try {
      if (editingMessage) {
        await editMessage(editingMessage.id, inputText);
        setEditingMessage(null);
      } else if (replyingTo) {
        await replyToMessage(replyingTo.id, inputText);
        setReplyingTo(null);
      } else {
        await sendMessage(
          inputText,
          selectedMedia.length > 0 ? selectedMedia : undefined
        );
      }

      setInputText('');
      setSelectedMedia([]);
      
      setTimeout(async () => {
        await loadMoreMessages();
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }, 300);
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const handleLongPress = (message: ChatMessageType) => {
    setSelectedMessage(message);
    setShowMessageActions(true);
  };

  const copyMessage = () => {
    if (selectedMessage?.content) {
      Clipboard.setString(selectedMessage.content);
      setShowMessageActions(false);
      Alert.alert('Copied', 'Message copied to clipboard');
    }
  };

  const handleReply = () => {
    setReplyingTo(selectedMessage);
    setShowMessageActions(false);
    inputRef.current?.focus();
  };

  const handleForward = () => {
    setShowMessageActions(false);
    Alert.alert('Forward', 'Forward functionality - Navigate to contact selection');
  };

  const handleDelete = () => {
    setShowMessageActions(false);
    
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (selectedMessage) {
              try {
                await deleteMessage(selectedMessage.id);
              } catch (error) {
                Alert.alert('Error', 'Failed to delete message.');
              }
            }
          }
        }
      ]
    );
  };

  const cancelReplyOrEdit = () => {
    setReplyingTo(null);
    setEditingMessage(null);
    setInputText('');
  };

  const formatMessageTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMessage = ({ item, index }: { item: ChatMessageType; index: number }) => {
    const isOwnMessage = item.senderId === currentUserId || item.senderId === user?.id;
    const showDateSeparator = index === 0 || !isSameDay(
      new Date(item.createdAt),
      new Date(messages[index - 1]?.createdAt)
    );

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {formatDateSeparator(new Date(item.createdAt))}
            </Text>
          </View>
        )}
        
        <TouchableOpacity
          onLongPress={() => handleLongPress(item)}
          activeOpacity={0.9}
          style={[
            styles.messageContainer,
            isOwnMessage ? styles.ownMessage : styles.otherMessage
          ]}
        >
          {item.repliedTo && (
            <View style={[
              styles.repliedToContainer,
              isOwnMessage ? styles.repliedToOwn : styles.repliedToOther
            ]}>
              <View style={styles.replyContent}>
                <Text style={[
                  styles.repliedToName,
                  isOwnMessage && styles.repliedToNameOwn
                ]}>
                  {item.repliedTo.sender.name}
                </Text>
                <Text style={[
                  styles.repliedToText,
                  isOwnMessage && styles.repliedToTextOwn
                ]} numberOfLines={1}>
                  {item.repliedTo.content || '📎 Media'}
                </Text>
              </View>
            </View>
          )}
          
          {item.media && item.media.length > 0 && (
            <View style={styles.mediaContainer}>
              {item.media.map((mediaUrl, idx) => {
                const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('.mov');
                
                return (
                  <View key={idx} style={styles.mediaWrapper}>
                    {isVideo ? (
                      <Video
                        source={{ uri: mediaUrl }}
                        style={styles.mediaImage}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                      />
                    ) : (
                      <Image
                        source={{ uri: mediaUrl }}
                        style={styles.mediaImage}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}
          
          {item.content && (
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {item.content}
            </Text>
          )}
          
          <View style={styles.messageFooter}>
            <Text style={[
              styles.timestamp,
              isOwnMessage ? styles.timestampOwn : styles.timestampOther
            ]}>
              {formatMessageTime(item.createdAt)}
              {item.updatedAt !== item.createdAt && ' (edited)'}
            </Text>
            
            {isOwnMessage && (
              <Text style={styles.readReceipt}>
                {item.isRead ? '✓✓' : '✓'}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const formatDateSeparator = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(date, today)) {
      return 'Today';
    } else if (isSameDay(date, yesterday)) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const renderTypingIndicator = () => {
    if (typingUsers.size === 0) return null;

    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <View style={styles.typingDotsContainer}>
            <View style={[styles.typingDot, styles.typingDot1]} />
            <View style={[styles.typingDot, styles.typingDot2]} />
            <View style={[styles.typingDot, styles.typingDot3]} />
          </View>
        </View>
      </View>
    );
  };

  const renderInputHeader = () => {
    if (!replyingTo && !editingMessage) return null;

    const message = editingMessage || replyingTo;

    return (
      <View style={styles.inputHeader}>
        <View style={styles.inputHeaderIndicator} />
        <View style={styles.inputHeaderContent}>
          <Text style={styles.inputHeaderLabel}>
            {editingMessage ? 'Edit message' : 'Reply to ' + message?.sender.name}
          </Text>
          <Text style={styles.inputHeaderText} numberOfLines={1}>
            {message?.content || '📎 Media'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={cancelReplyOrEdit}
          style={styles.inputHeaderClose}
        >
          <Text style={styles.inputHeaderCloseText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSelectedMedia = () => {
    if (selectedMedia.length === 0) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.selectedMediaContainer}
        contentContainerStyle={styles.selectedMediaContent}
      >
        {selectedMedia.map((media, index) => (
          <View key={index} style={styles.selectedMediaItem}>
            <Image
              source={{ uri: media.uri }}
              style={styles.selectedMediaThumbnail}
            />
            <TouchableOpacity
              onPress={() => setSelectedMedia(prev => prev.filter((_, i) => i !== index))}
              style={styles.removeMediaButton}
            >
              <Text style={styles.removeMediaText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderMessageActionsModal = () => {
    const isOwnMessage = selectedMessage?.senderId === currentUserId || selectedMessage?.senderId === user?.id;

    return (
      <Modal
        visible={showMessageActions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMessageActions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMessageActions(false)}
        >
          <View style={styles.actionsModal}>
            <View style={styles.actionsModalHandle} />
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleReply}
            >
              <View style={styles.actionIconContainer}>
                <Text style={styles.actionButtonIcon}>↩️</Text>
              </View>
              <Text style={styles.actionButtonText}>Reply</Text>
            </TouchableOpacity>

            {selectedMessage?.content && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={copyMessage}
              >
                <View style={styles.actionIconContainer}>
                  <Text style={styles.actionButtonIcon}>📋</Text>
                </View>
                <Text style={styles.actionButtonText}>Copy</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleForward}
            >
              <View style={styles.actionIconContainer}>
                <Text style={styles.actionButtonIcon}>➡️</Text>
              </View>
              <Text style={styles.actionButtonText}>Forward</Text>
            </TouchableOpacity>

            {isOwnMessage && (
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={handleDelete}
              >
                <View style={styles.actionIconContainer}>
                  <Text style={styles.actionButtonIcon}>🗑️</Text>
                </View>
                <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                  Delete
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowMessageActions(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderHeaderInfo = () => {
    if (currentUserType === 'buyer' && storeName) {
      return (
        <View style={styles.headerInfo}>
          {storeLogo ? (
            <Image source={{ uri: storeLogo }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
              <Text style={styles.headerAvatarText}>
                {storeName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{storeName}</Text>
            <Text style={styles.headerSubtitle}>Store</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.headerInfo}>
        {otherUserAvatar ? (
          <Image source={{ uri: otherUserAvatar }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
            <Text style={styles.headerAvatarText}>
              {otherUserName?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>{otherUserName || 'User'}</Text>
          {typingUsers.size > 0 && (
            <Text style={styles.headerTyping}>typing...</Text>
          )}
        </View>
      </View>
    );
  };

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        {renderHeaderInfo()}

        <TouchableOpacity style={styles.moreButton}>
          <Text style={styles.moreButtonText}>⋮</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.messagesContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={() => {
            if (hasMoreMessages && !isLoading) {
              loadMoreMessages();
            }
          }}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            isLoading ? (
              <ActivityIndicator size="small" style={styles.loader} color={Colors.primary} />
            ) : null
          }
          ListFooterComponent={renderTypingIndicator()}
          inverted={false}
        />

        <View style={styles.inputWrapper}>
          {renderInputHeader()}
          {renderSelectedMedia()}
          
          <View style={styles.inputContainer}>
            <TouchableOpacity onPress={showMediaOptions} style={styles.attachButton}>
              <Text style={styles.attachButtonText}>+</Text>
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={inputText}
              onChangeText={handleTextChange}
              placeholder="Type a message..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              maxLength={1000}
            />

            <TouchableOpacity
              onPress={handleSend}
              style={[
                styles.sendButton,
                (!inputText.trim() && selectedMedia.length === 0) && styles.sendButtonDisabled
              ]}
              disabled={!inputText.trim() && selectedMedia.length === 0}
            >
              <Text style={styles.sendButtonText}>
                {editingMessage ? '✓' : '➤'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {renderMessageActionsModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF2',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  backButtonText: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: '400',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
  },
  headerAvatarPlaceholder: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerTyping: {
    fontSize: 13,
    color: Colors.primary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  moreButton: {
    padding: 8,
  },
  moreButtonText: {
    fontSize: 24,
    color: Colors.textSecondary,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: Colors.textTertiary,
    backgroundColor: '#E8EDF2',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    fontWeight: '500',
  },
  messageContainer: {
    maxWidth: SCREEN_WIDTH * 0.75,
    marginVertical: 3,
    padding: 12,
    borderRadius: 16,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#E8F5E9',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  repliedToContainer: {
    marginBottom: 8,
    paddingLeft: 12,
    borderLeftWidth: 3,
  },
  repliedToOwn: {
    borderLeftColor: '#4CAF50',
  },
  repliedToOther: {
    borderLeftColor: Colors.primary,
  },
  replyContent: {
    paddingLeft: 8,
  },
  repliedToName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 2,
  },
  repliedToNameOwn: {
    color: '#2E7D32',
  },
  repliedToText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  repliedToTextOwn: {
    color: '#4CAF50',
  },
  mediaContainer: {
    marginBottom: 8,
  },
  mediaWrapper: {
    marginBottom: 4,
  },
  mediaImage: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
    borderRadius: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  ownMessageText: {
    color: '#1B5E20',
  },
  otherMessageText: {
    color: Colors.textPrimary,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
    marginRight: 4,
  },
  timestampOwn: {
    color: '#4CAF50',
  },
  timestampOther: {
    color: Colors.textTertiary,
  },
  readReceipt: {
    fontSize: 12,
    color: '#4CAF50',
  },
  typingContainer: {
    padding: 8,
    paddingLeft: 16,
  },
  typingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  typingDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textTertiary,
    marginHorizontal: 2,
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  inputWrapper: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: '#E8EDF2',
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8EDF2',
  },
  inputHeaderIndicator: {
    width: 3,
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
    marginRight: 12,
  },
  inputHeaderContent: {
    flex: 1,
  },
  inputHeaderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 2,
  },
  inputHeaderText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  inputHeaderClose: {
    padding: 8,
  },
  inputHeaderCloseText: {
    fontSize: 20,
    color: Colors.textSecondary,
  },
  selectedMediaContainer: {
    maxHeight: 100,
    borderTopWidth: 1,
    borderTopColor: '#E8EDF2',
  },
  selectedMediaContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectedMediaItem: {
    position: 'relative',
    marginRight: 8,
  },
  selectedMediaThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F5F7FA',
  },
  removeMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.error,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  removeMediaText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
  },
  attachButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 20,
    marginRight: 8,
  },
  attachButtonText: {
    fontSize: 24,
    color: Colors.primary,
    fontWeight: '300',
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    backgroundColor: '#F5F7FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.textPrimary,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#C7CDD6',
  },
  sendButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionsModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 20,
  },
  actionsModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E8EDF2',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    marginBottom: 8,
  },
  actionIconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionButtonIcon: {
    fontSize: 20,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  deleteButton: {
    backgroundColor: '#FEE',
  },
  deleteButtonText: {
    color: Colors.error,
  },
  cancelButton: {
    paddingVertical: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  loader: {
    marginVertical: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: Colors.error,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default ChatScreen;