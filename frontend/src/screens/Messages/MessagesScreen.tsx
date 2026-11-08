// src/screens/Messages/MessagesScreen.tsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { RootStackParamList } from '../../navigation/types';
import { Conversation } from '../../types/models';
import { fetchMyConversations } from '../../services/conversation.service';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;
type TabType = 'individuals' | 'groups' | 'unread';

export default function MessagesScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('individuals');
  
  // Search state & animations
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const inputRef = useRef<TextInput>(null);
  
  const searchBarWidth = useSharedValue(0);
  const backButtonOpacity = useSharedValue(1);

  const loadConversations = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    try {
      const data = await fetchMyConversations();
      setConversations(data);
    } catch (error) {
      console.warn('[Messages] Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  useEffect(() => {
    if (!socket) return;

    function handleNewMessage() {
      loadConversations();
    }

    socket.on('message:new', handleNewMessage);
    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [socket, loadConversations]);

  const openSearch = () => {
    setIsSearchOpen(true);
    backButtonOpacity.value = withTiming(0, { duration: 150 });
    searchBarWidth.value = withTiming(1, { duration: 250 }, () => {
      runOnJS(focusInput)();
    });
  };

  const closeSearch = () => {
    Keyboard.dismiss();
    setSearchQuery('');
    setSubmittedQuery('');
    searchBarWidth.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(setIsSearchOpen)(false);
    });
    backButtonOpacity.value = withTiming(1, { duration: 250 });
  };

  const handleSearchSubmit = () => {
    Keyboard.dismiss();
    setSubmittedQuery(searchQuery);
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const animatedSearchStyle = useAnimatedStyle(() => {
    return {
      width: `${searchBarWidth.value * 100}%`,
      opacity: searchBarWidth.value,
      position: 'absolute',
      right: 0,
      zIndex: 10,
    };
  });

  const animatedBackButtonStyle = useAnimatedStyle(() => {
    return {
      opacity: backButtonOpacity.value,
      width: backButtonOpacity.value === 0 ? 0 : 34,
      marginRight: backButtonOpacity.value === 0 ? 0 : 8,
      overflow: 'hidden',
    };
  });

  function getOtherParticipant(conversation: Conversation) {
    if (conversation.isGroup) return null;
    return conversation.participants.find((p) => p.id !== user?.id);
  }

  function getDisplayName(conversation: Conversation): string {
    if (conversation.isGroup) return conversation.groupName || 'Group Chat';
    const other = getOtherParticipant(conversation);
    return other?.displayName || 'Unknown User';
  }

  function getLastMessagePreview(conversation: Conversation): string {
    if (!conversation.lastMessage) return 'No messages yet';
    if (conversation.lastMessage.isDeleted) return 'This message was deleted';
    return conversation.lastMessage.content || 'Sent an attachment';
  }

  function getTimestamp(conversation: Conversation): string {
    if (!conversation.lastMessage?.createdAt) return '';
    const date = new Date(conversation.lastMessage.createdAt);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString();
  }

  function getUnreadCount(conversation: Conversation): number {
    return (conversation as any).unreadCount || 0;
  }

  function openChat(conversation: Conversation) {
    navigation.navigate('ChatModal', {
      conversationId: conversation.id,
      conversationName: getDisplayName(conversation),
    });
  }

  // Filter conversations by Tab and Submitted Search Query
  const filteredConversations = conversations.filter((item) => {
    if (activeTab === 'individuals' && item.isGroup) return false;
    if (activeTab === 'groups' && !item.isGroup) return false;
    if (activeTab === 'unread' && getUnreadCount(item) === 0) return false;

    if (submittedQuery.trim() !== '') {
      const name = getDisplayName(item).toLowerCase();
      const preview = getLastMessagePreview(item).toLowerCase();
      const query = submittedQuery.toLowerCase();
      return name.includes(query) || preview.includes(query);
    }

    return true;
  });

  function renderItem({ item }: { item: Conversation }) {
    const other = getOtherParticipant(item);
    const isOnline = other?.status === 'online';
    const unreadCount = getUnreadCount(item);
    const timestamp = getTimestamp(item);

    return (
      <TouchableOpacity style={styles.row} onPress={() => openChat(item)}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {getDisplayName(item).charAt(0).toUpperCase()}
            </Text>
          </View>
          {isOnline && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.rowContent}>
          <Text style={styles.name} numberOfLines={1}>
            {getDisplayName(item)}
          </Text>
          <Text style={styles.preview} numberOfLines={1}>
            {getLastMessagePreview(item)}
          </Text>
        </View>

        <View style={styles.rightContainer}>
          {unreadCount > 0 ? (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          ) : (
            <View style={styles.badgePlaceholder} />
          )}
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={closeSearch}>
      <View style={styles.container}>
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Animated.View style={animatedBackButtonStyle}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.headerTitle}>Messages</Text>
          </View>

          <View style={styles.headerRightContainer}>
            <Animated.View style={[styles.searchBarContainer, animatedSearchStyle]}>
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder="Search messages..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  if (text.trim() === '') {
                    setSubmittedQuery('');
                  }
                }}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
              />
              <TouchableOpacity
                onPress={handleSearchSubmit}
                style={styles.searchActionButton}
              >
                <Ionicons name="search" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity 
              style={styles.searchIconButton} 
              onPress={openSearch}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs Section */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'individuals' && styles.activeTabButton]}
            onPress={() => setActiveTab('individuals')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'individuals' && { color: colors.primary, fontWeight: '700' },
              ]}
            >
              Individuals
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'groups' && styles.activeTabButton]}
            onPress={() => setActiveTab('groups')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'groups' && { color: colors.primary, fontWeight: '700' },
              ]}
            >
              Groups
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'unread' && styles.activeTabButton]}
            onPress={() => setActiveTab('unread')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'unread' && { color: colors.primary, fontWeight: '700' },
              ]}
            >
              Unread
            </Text>
          </TouchableOpacity>
        </View>

        {/* Messages List / Content */}
        {filteredConversations.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No conversations found</Text>
            <Text style={styles.emptySubtext}>
              {submittedQuery ? 'Try a different search term' : 'Head to Explore to find people to chat with'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => loadConversations(true)}
                tintColor={colors.primary}
              />
            }
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
    height: 60,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 4,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    height: 40,
    position: 'relative',
  },
  searchIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e5e5',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    paddingVertical: 0,
  },
  searchActionButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  tabButton: {
    backgroundColor: '#e5e5e5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  activeTabButton: {},
  tabText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtext: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colors.background,
  },
  rowContent: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  preview: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  rightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 60,
  },
  badgeContainer: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    marginBottom: 4,
  },
  badgePlaceholder: {
    height: 18,
    marginBottom: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  timestamp: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
