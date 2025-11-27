// screens/ChatSettingsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/colors';
import ChatApiService from '../../services/chatApiServices';

interface RouteParams {
  chatRoomId: string;
  otherUserId: string;
  otherUserName: string;
}

const ChatSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { chatRoomId, otherUserId, otherUserName } = route.params as RouteParams;

  const [isLoading, setIsLoading] = useState(false);
  
  // Chat preferences
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [muteUntil, setMuteUntil] = useState<Date | null>(null);
  const [wallpaper, setWallpaper] = useState<string>('default');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  
  // User preferences
  const [isBlocked, setIsBlocked] = useState(false);
  const [mediaAutoDownload, setMediaAutoDownload] = useState(true);
  const [showReadReceipts, setShowReadReceipts] = useState(true);

  const apiService = new ChatApiService(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await AsyncStorage.getItem(`chat_prefs_${chatRoomId}`);
      if (prefs) {
        const parsed = JSON.parse(prefs);
        setNotificationsEnabled(parsed.notificationsEnabled ?? true);
        setMuteUntil(parsed.muteUntil ? new Date(parsed.muteUntil) : null);
        setWallpaper(parsed.wallpaper ?? 'default');
        setFontSize(parsed.fontSize ?? 'medium');
        setMediaAutoDownload(parsed.mediaAutoDownload ?? true);
        setShowReadReceipts(parsed.showReadReceipts ?? true);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const savePreferences = async (prefs: any) => {
    try {
      await AsyncStorage.setItem(`chat_prefs_${chatRoomId}`, JSON.stringify(prefs));
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  /**
   * Toggle notifications
   */
  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    const prefs = {
      notificationsEnabled: value,
      muteUntil,
      wallpaper,
      fontSize,
      mediaAutoDownload,
      showReadReceipts
    };
    await savePreferences(prefs);

    try {
      await apiService.updateChatPreferences({
        notifyOnNewMessage: value
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
    }
  };

  /**
   * Mute chat for duration
   */
  const handleMuteChat = (hours: number) => {
    const muteUntilDate = new Date();
    muteUntilDate.setHours(muteUntilDate.getHours() + hours);
    
    Alert.alert(
      'Mute Chat',
      `Mute notifications for ${hours} hour${hours > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mute',
          onPress: async () => {
            setMuteUntil(muteUntilDate);
            const prefs = {
              notificationsEnabled,
              muteUntil: muteUntilDate,
              wallpaper,
              fontSize,
              mediaAutoDownload,
              showReadReceipts
            };
            await savePreferences(prefs);

            try {
              await apiService.updateChatPreferences({
                muteNotificationsUntil: muteUntilDate
              });
              Alert.alert('Success', `Chat muted until ${muteUntilDate.toLocaleTimeString()}`);
            } catch (error) {
              Alert.alert('Error', 'Failed to mute chat');
            }
          }
        }
      ]
    );
  };

  /**
   * Unmute chat
   */
  const handleUnmuteChat = async () => {
    setMuteUntil(null);
    const prefs = {
      notificationsEnabled,
      muteUntil: null,
      wallpaper,
      fontSize,
      mediaAutoDownload,
      showReadReceipts
    };
    await savePreferences(prefs);

    try {
      await apiService.updateChatPreferences({
        muteNotificationsUntil: undefined
      });
      Alert.alert('Success', 'Chat unmuted');
    } catch (error) {
      Alert.alert('Error', 'Failed to unmute chat');
    }
  };

  /**
   * Change wallpaper
   */
  const handleChangeWallpaper = () => {
    Alert.alert(
      'Choose Wallpaper',
      'Select a chat background',
      [
        { text: 'Default', onPress: () => changeWallpaper('default') },
        { text: 'Light', onPress: () => changeWallpaper('light') },
        { text: 'Dark', onPress: () => changeWallpaper('dark') },
        { text: 'Blue', onPress: () => changeWallpaper('blue') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const changeWallpaper = async (newWallpaper: string) => {
    setWallpaper(newWallpaper);
    const prefs = {
      notificationsEnabled,
      muteUntil,
      wallpaper: newWallpaper,
      fontSize,
      mediaAutoDownload,
      showReadReceipts
    };
    await savePreferences(prefs);
  };

  /**
   * Change font size
   */
  const handleChangeFontSize = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
    const prefs = {
      notificationsEnabled,
      muteUntil,
      wallpaper,
      fontSize: size,
      mediaAutoDownload,
      showReadReceipts
    };
    savePreferences(prefs);
  };

  /**
   * Clear chat history
   */
  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to delete all messages in this chat? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            // Implement clear chat logic here
            setTimeout(() => {
              setIsLoading(false);
              Alert.alert('Success', 'Chat history cleared');
              navigation.goBack();
            }, 1000);
          }
        }
      ]
    );
  };

  /**
   * Block user
   */
  const handleBlockUser = () => {
    Alert.alert(
      `Block ${otherUserName}`,
      'Blocked contacts will no longer be able to send you messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setIsBlocked(true);
            // Implement block user logic here
            Alert.alert('Success', `${otherUserName} has been blocked`);
          }
        }
      ]
    );
  };

  /**
   * Unblock user
   */
  const handleUnblockUser = () => {
    Alert.alert(
      `Unblock ${otherUserName}`,
      'You will be able to receive messages from this contact again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setIsBlocked(false);
            Alert.alert('Success', `${otherUserName} has been unblocked`);
          }
        }
      ]
    );
  };

  /**
   * Export chat
   */
  const handleExportChat = () => {
    Alert.alert(
      'Export Chat',
      'Choose export format',
      [
        { text: 'Text File', onPress: () => exportChat('txt') },
        { text: 'PDF', onPress: () => exportChat('pdf') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const exportChat = async (format: 'txt' | 'pdf') => {
    setIsLoading(true);
    // Implement export logic here
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert('Success', `Chat exported as ${format.toUpperCase()}`);
    }, 2000);
  };

  /**
   * Archive chat
   */
  const handleArchiveChat = async () => {
    Alert.alert(
      'Archive Chat',
      'This chat will be moved to archived chats.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await apiService.archiveChatRoom(chatRoomId);
              Alert.alert('Success', 'Chat archived');
              navigation.navigate('ChatList' as never);
            } catch (error) {
              Alert.alert('Error', 'Failed to archive chat');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive notifications for new messages
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: Colors.gray300, true: Colors.primaryLight }}
              thumbColor={notificationsEnabled ? Colors.primary : Colors.gray400}
            />
          </View>

          {muteUntil ? (
            <TouchableOpacity
              style={styles.settingButton}
              onPress={handleUnmuteChat}
            >
              <Text style={styles.settingButtonIcon}>🔕</Text>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Unmute Chat</Text>
                <Text style={styles.settingDescription}>
                  Muted until {muteUntil.toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View>
              <TouchableOpacity
                style={styles.settingButton}
                onPress={() => handleMuteChat(1)}
              >
                <Text style={styles.settingButtonIcon}>🔕</Text>
                <Text style={styles.settingLabel}>Mute for 1 hour</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingButton}
                onPress={() => handleMuteChat(8)}
              >
                <Text style={styles.settingButtonIcon}>🔕</Text>
                <Text style={styles.settingLabel}>Mute for 8 hours</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingButton}
                onPress={() => handleMuteChat(24)}
              >
                <Text style={styles.settingButtonIcon}>🔕</Text>
                <Text style={styles.settingLabel}>Mute for 24 hours</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          
          <TouchableOpacity
            style={styles.settingButton}
            onPress={handleChangeWallpaper}
          >
            <Text style={styles.settingButtonIcon}>🎨</Text>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Wallpaper</Text>
              <Text style={styles.settingDescription}>
                Current: {wallpaper}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Font Size</Text>
          </View>
          <View style={styles.fontSizeButtons}>
            <TouchableOpacity
              style={[
                styles.fontSizeButton,
                fontSize === 'small' && styles.fontSizeButtonActive
              ]}
              onPress={() => handleChangeFontSize('small')}
            >
              <Text style={[
                styles.fontSizeButtonText,
                fontSize === 'small' && styles.fontSizeButtonTextActive
              ]}>
                Small
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.fontSizeButton,
                fontSize === 'medium' && styles.fontSizeButtonActive
              ]}
              onPress={() => handleChangeFontSize('medium')}
            >
              <Text style={[
                styles.fontSizeButtonText,
                fontSize === 'medium' && styles.fontSizeButtonTextActive
              ]}>
                Medium
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.fontSizeButton,
                fontSize === 'large' && styles.fontSizeButtonActive
              ]}
              onPress={() => handleChangeFontSize('large')}
            >
              <Text style={[
                styles.fontSizeButtonText,
                fontSize === 'large' && styles.fontSizeButtonTextActive
              ]}>
                Large
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Media Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Media & Storage</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-download Media</Text>
              <Text style={styles.settingDescription}>
                Automatically download photos and videos
              </Text>
            </View>
            <Switch
              value={mediaAutoDownload}
              onValueChange={(value) => {
                setMediaAutoDownload(value);
                savePreferences({
                  notificationsEnabled,
                  muteUntil,
                  wallpaper,
                  fontSize,
                  mediaAutoDownload: value,
                  showReadReceipts
                });
              }}
              trackColor={{ false: Colors.gray300, true: Colors.primaryLight }}
              thumbColor={mediaAutoDownload ? Colors.primary : Colors.gray400}
            />
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Read Receipts</Text>
              <Text style={styles.settingDescription}>
                Show when you've read messages
              </Text>
            </View>
            <Switch
              value={showReadReceipts}
              onValueChange={(value) => {
                setShowReadReceipts(value);
                savePreferences({
                  notificationsEnabled,
                  muteUntil,
                  wallpaper,
                  fontSize,
                  mediaAutoDownload,
                  showReadReceipts: value
                });
              }}
              trackColor={{ false: Colors.gray300, true: Colors.primaryLight }}
              thumbColor={showReadReceipts ? Colors.primary : Colors.gray400}
            />
          </View>

          {isBlocked ? (
            <TouchableOpacity
              style={[styles.settingButton, styles.dangerButton]}
              onPress={handleUnblockUser}
            >
              <Text style={styles.settingButtonIcon}>🔓</Text>
              <Text style={[styles.settingLabel, styles.dangerText]}>
                Unblock {otherUserName}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.settingButton, styles.dangerButton]}
              onPress={handleBlockUser}
            >
              <Text style={styles.settingButtonIcon}>🚫</Text>
              <Text style={[styles.settingLabel, styles.dangerText]}>
                Block {otherUserName}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Chat Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chat Actions</Text>
          
          <TouchableOpacity
            style={styles.settingButton}
            onPress={handleExportChat}
          >
            <Text style={styles.settingButtonIcon}>📤</Text>
            <Text style={styles.settingLabel}>Export Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={handleArchiveChat}
          >
            <Text style={styles.settingButtonIcon}>📦</Text>
            <Text style={styles.settingLabel}>Archive Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingButton, styles.dangerButton]}
            onPress={handleClearChat}
          >
            <Text style={styles.settingButtonIcon}>🗑️</Text>
            <Text style={[styles.settingLabel, styles.dangerText]}>
              Clear Chat History
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    paddingBottom: 12,
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
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  backButtonText: {
    fontSize: 32,
    color: Colors.primary,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.white,
    marginTop: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  settingDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  fontSizeButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  fontSizeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
  },
  fontSizeButtonActive: {
    backgroundColor: Colors.primary,
  },
  fontSizeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  fontSizeButtonTextActive: {
    color: Colors.white,
  },
  dangerButton: {
    backgroundColor: Colors.errorLight,
  },
  dangerText: {
    color: Colors.error,
  },
  bottomSpacing: {
    height: 40,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatSettingsScreen;