//The ChatModal.tsx file

import React, { useState, useEffect, useRef } from 'react';
import {
  Image,
  View,
  Text,
  FlatList,
  Alert,
  Platform,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Modal,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';

import { api, getMediaUrl } from '../../services/api';

import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { colors } from '../../theme/colors';
import { RootStackParamList } from '../../navigation/types';
import { Message } from '../../types/models';
import { fetchMessages, markConversationRead, normalizeMessage } from '../../services/message.service';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

type ChatModalRouteProp = RouteProp<RootStackParamList, 'ChatModal'>;
type NavProp = NativeStackNavigationProp<RootStackParamList, 'ChatModal'>;

const TYPING_STOP_DELAY_MS = 2000;

function useGradualKeyboardHeight() {
  const height = useSharedValue(0);

  useKeyboardHandler(
    {
      onMove: (e) => {
        'worklet';
        height.value = e.height;
      },
      onEnd: (e) => {
        'worklet';
        height.value = e.height;
      },
    },
    []
  );

  return height;
}

export default function ChatModal() {
  const route = useRoute<ChatModalRouteProp>();
  const navigation = useNavigation<NavProp>();
  const { conversationName } = route.params;
  const initialParamId = route.params.conversationId;

  const [activeConversationId, setActiveConversationId] = useState<string>(initialParamId);

  // Image Preview Modal States
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const openImagePreview = (url: string) => {
    setPreviewImageUrl(url);
    setIsPreviewVisible(true);
  };

  const closeImagePreview = () => {
    setIsPreviewVisible(false);
    setPreviewImageUrl(null);
  };

  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useGradualKeyboardHeight();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  // Custom Options Modal States
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);

  // Pinned Message States
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
  const [isPinModalVisible, setIsPinModalVisible] = useState(false);

  // File & Recording States
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [meterLevel, setMeterLevel] = useState<number>(-160);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboardHeight.value - insets.bottom, 0),
  }));

  useEffect(() => {
    navigation.setOptions({ title: conversationName });
  }, [conversationName, navigation]);

  // Robust conversation ID resolution supporting both MongoDB ObjectIds and direct user/consultant IDs
  useEffect(() => {
    async function resolveConversation() {
      setIsLoading(true);
      try {
                let resolvedId = initialParamId;
        
        // Check if initialParamId looks like a MongoDB ObjectId (24 hex chars)
        const isMongoId = /^[0-9a-fA-F]{24}$/.test(initialParamId);

        if (!isMongoId) {
          let res;
          // Determine if it's a username (starts with @) or a name/string identifier
          const payloadKey = initialParamId.startsWith('@') ? 'username' : 'participantId';

          try {
            res = await api.post('/conversations', { [payloadKey]: initialParamId });
          } catch (e1) {
            try {
              res = await api.post('/conversations', { participantId: initialParamId });
            } catch (e2) {
              res = await api.post('/conversations', { recipientId: initialParamId });
            }
          }

          const serverId = 
            res?.data?.conversation?._id || 
            res?.data?._id || 
            res?.data?.id || 
            res?.data?.conversationId;

          if (serverId) {
            resolvedId = serverId;
          } else {
            throw new Error('Server did not return a valid conversation ID');
          }
        }


        setActiveConversationId(resolvedId);
        const data = await fetchMessages(resolvedId);
        setMessages(data || []);
        await markConversationRead(resolvedId);
      } catch (error: any) {
        console.warn('[Chat] Failed to resolve conversation and load messages:', error?.response?.data || error);
        Alert.alert('Error', 'Could not open or create conversation thread.');
      } finally {
        setIsLoading(false);
      }
    }

    if (initialParamId) {
      resolveConversation();
    }
  }, [initialParamId]);

  useEffect(() => {
    if (!socket || !activeConversationId || activeConversationId.length !== 24) return;
    socket.emit('conversation:join', activeConversationId);
    return () => {
      socket.emit('conversation:leave', activeConversationId);
    };
  }, [socket, activeConversationId]);

  useEffect(() => {
    if (!socket || !activeConversationId) return;

    function handleNewMessage(payload: { message: any }) {
      if (payload.message.conversation !== activeConversationId) return;
      const normalized = normalizeMessage(payload.message);
      
      setMessages((prev) => {
        // Prevent adding duplicate entries if already present
        if (normalized._id && prev.some((m) => m._id === normalized._id)) {
          return prev;
        }
        return [...prev, normalized];
      });
      markConversationRead(activeConversationId).catch(() => {});
    }

    function handleTypingUpdate(payload: {
      userId: string;
      conversationId: string;
      isTyping: boolean;
    }) {
      if (payload.conversationId !== activeConversationId) return;
      if (payload.userId === user?.id) return;
      setOtherUserTyping(payload.isTyping);
    }

    socket.on('message:new', handleNewMessage);
    socket.on('typing:update', handleTypingUpdate);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('typing:update', handleTypingUpdate);
    };
  }, [socket, activeConversationId, user?.id]);

  function handleInputChange(text: string) {
    setInputText(text);
    if (!socket || !activeConversationId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing:start', { conversationId: activeConversationId });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing:stop', { conversationId: activeConversationId });
    }, TYPING_STOP_DELAY_MS);
  }

  function handleSend() {
    const trimmed = inputText.trim();
    if (!trimmed || isSending || !socket || !activeConversationId) return;

    setIsSending(true);

    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit('typing:stop', { conversationId: activeConversationId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    socket.emit(
      'message:send',
      { conversationId: activeConversationId, content: trimmed },
      (ack: { success?: boolean; error?: string; message?: Message }) => {
        setIsSending(false);
        if (ack?.error) {
          console.warn('[Chat] Send failed:', ack.error);
          Alert.alert('Send Failed', ack.error);
        } else if (ack?.message) {
          const normalized = normalizeMessage(ack.message);
          setMessages((prev) => {
            if (normalized._id && prev.some((m) => m._id === normalized._id)) {
              return prev;
            }
            return [...prev, normalized];
          });
        }
      }
    );

    setInputText('');
  }

  // --- Document Picker & File Upload ---
  async function handlePickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        await uploadMediaFile({
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        });
      }
    } catch (error) {
      console.error('[DocumentPicker] Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file.');
    }
  }

  // --- Voice Note Recording ---
  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone permission is required to record voice notes.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (status.metering !== undefined) {
            setMeterLevel(status.metering);
          }
        },
        100
      );

      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Could not access microphone.');
    }
  }

  async function stopAndUploadRecording() {
    if (!recording) return;

    try {
      setIsUploading(true);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);

      if (uri) {
        await uploadMediaFile({
          uri,
          name: `voicenote_${Date.now()}.m4a`,
          type: 'audio/m4a',
        });
      }
    } catch (error) {
      console.error('Failed to stop/upload recording', error);
      Alert.alert('Error', 'Failed to save voice note.');
    } finally {
      setIsUploading(false);
    }
  }

  // --- Generic Media Upload ---
  const uploadMediaFile = async (file: { uri: string; name?: string; type?: string }) => {
    if (!activeConversationId) {
      Alert.alert('Error', 'Active conversation not ready.');
      return;
    }

    setIsUploading(true);
    try {
      let cleanUri = file.uri;
      if (Platform.OS === 'android' && cleanUri.startsWith('file://')) {
        cleanUri = cleanUri.replace('file://', '');
      }

      const fileName = file.name || cleanUri.split('/').pop() || `upload_${Date.now()}.jpg`;

      let fileType = file.type;
      if (!fileType || fileType === 'image') {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (ext === 'png') fileType = 'image/png';
        else if (ext === 'webp') fileType = 'image/webp';
        else if (ext === 'pdf') fileType = 'application/pdf';
        else if (ext === 'm4a') fileType = 'audio/m4a';
        else fileType = 'image/jpeg';
      }

      const formData = new FormData();
      // @ts-ignore: React Native FormData file shape
      formData.append('file', {
        uri: Platform.OS === 'android' ? file.uri : cleanUri,
        name: fileName,
        type: fileType,
      });

      formData.append('conversationId', activeConversationId);

      const uploadRes = await api.post('/messages/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      const uploadedPath =
        uploadRes.data.url ||
        uploadRes.data.mediaUrl ||
        uploadRes.data.filePath ||
        uploadRes.data.path ||
        uploadRes.data.filename;

      if (!uploadedPath) {
        throw new Error('Upload succeeded, but no valid file path was returned by server.');
      }

      const detectedType =
        uploadRes.data.type || (fileType.startsWith('image/') ? 'image' : fileType.startsWith('audio/') ? 'audio' : 'file');

      const messageRes = await api.post('/messages', {
        conversationId: activeConversationId,
        content: '',
        attachmentUrl: uploadedPath,
        attachmentType: detectedType,
      });

      const newMsg = normalizeMessage(messageRes.data.message);
      setMessages((prev) => {
        if (newMsg._id && prev.some((m) => m._id === newMsg._id)) {
          return prev;
        }
        return [...prev, newMsg];
      });
    } catch (error: any) {
      console.error('[Upload Failed]:', error?.response?.data || error);
      Alert.alert(
        'Upload Failed',
        error?.response?.data?.message || 'Could not send attachment.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  // --- Custom Context Menu Actions ---
  const handleCopyMessage = () => {
    if (selectedMessage?.content) {
      Clipboard.setString(selectedMessage.content);
    }
    setIsActionModalVisible(false);
    setSelectedMessage(null);
  };

  const handlePinMessage = () => {
    if (selectedMessage) {
      setPinnedMessage(selectedMessage);
    }
    setIsActionModalVisible(false);
    setSelectedMessage(null);
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    try {
      await api.delete(`/messages/${selectedMessage._id}`);
      setMessages((prevMessages) => prevMessages.filter((message) => message._id !== selectedMessage._id));
      if (pinnedMessage?._id === selectedMessage._id) {
        setPinnedMessage(null);
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
    setIsActionModalVisible(false);
    setSelectedMessage(null);
  };

  const handleScrollToMessage = (messageId: string) => {
    const index = messages.findIndex((m) => m._id === messageId);
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }
    setIsPinModalVisible(false);
  };

  function renderItem({ item }: { item: Message }) {
    const isOwnMessage = item.sender?.id === user?.id;
    const rawUrl = item.attachmentUrl || item.mediaUrl;
    const fullAttachmentUrl = getMediaUrl(rawUrl);
    const isImage = item.attachmentType === 'image' || (rawUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(rawUrl));

    return (
      <View
        style={[
          styles.messageBubbleContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
            fullAttachmentUrl && isImage && styles.imageBubbleOverride,
          ]}
          onLongPress={() => {
            setSelectedMessage(item);
            setIsActionModalVisible(true);
          }}
        >
          {fullAttachmentUrl && isImage && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => openImagePreview(fullAttachmentUrl)}
            >
              <Image
                source={{ uri: fullAttachmentUrl }}
                style={styles.attachmentImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}

          {fullAttachmentUrl && !isImage && (
            <TouchableOpacity
              style={styles.attachmentFileContainer}
              onPress={() => Linking.openURL(fullAttachmentUrl)}
            >
              <Ionicons
                name={item.attachmentType === 'audio' ? 'musical-notes' : 'document-attach'}
                size={20}
                color={isOwnMessage ? colors.white : colors.primary}
              />
              <Text
                style={[
                  styles.attachmentFileName,
                  isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
                ]}
                numberOfLines={1}
              >
                {item.attachmentType === 'audio' ? 'Voice Note' : 'Attachment'}
              </Text>
            </TouchableOpacity>
          )}

          {item.isDeleted ? (
            <Text style={styles.deletedText}>This message was deleted</Text>
          ) : (
            !!item.content && (
              <Text
                style={[
                  styles.messageText,
                  isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
                ]}
              >
                {item.content}
              </Text>
            )
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const normalizedLevel = Math.max(0, (meterLevel + 160) / 160);
  const waveHeight1 = Math.max(12, normalizedLevel * 30);
  const waveHeight2 = Math.max(18, normalizedLevel * 45);
  const waveHeight3 = Math.max(10, normalizedLevel * 25);

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      {!isConnected && (
        <View style={styles.connectionBanner}>
          <Text style={styles.connectionBannerText}>Reconnecting...</Text>
        </View>
      )}

      {/* Pinned Message Top Bar */}
      {pinnedMessage && (
        <TouchableOpacity
          style={styles.pinnedBarContainer}
          activeOpacity={0.9}
          onPress={() => setIsPinModalVisible(true)}
        >
          <View style={styles.pinnedAccentBar} />
          <Ionicons name="pin" size={14} color={colors.primary} style={styles.pinIcon} />
          <View style={styles.pinnedContentContainer}>
            <Text style={styles.pinnedTitle}>Pinned Message</Text>
            <Text style={styles.pinnedTextSnippet} numberOfLines={1}>
              {pinnedMessage.content || (pinnedMessage.attachmentType ? `[${pinnedMessage.attachmentType}]` : 'Attachment')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setPinnedMessage(null)} style={styles.unpinIconButton}>
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => {
          const uniqueId = item._id || item.id;
          return uniqueId ? String(uniqueId) : `fallback-msg-${index}`;
        }}
        renderItem={renderItem}
        style={styles.messagesFlatList}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {otherUserTyping && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>{conversationName} is typing...</Text>
        </View>
      )}

      {/* Floating Voice Recording Widget */}
      {isRecording && (
        <View style={styles.recordingOverlay}>
          <View style={styles.recordingCard}>
            <Ionicons name="mic" size={24} color={colors.danger} />
            <View style={styles.waveformContainer}>
              <View style={[styles.waveBar, { height: waveHeight1 }]} />
              <View style={[styles.waveBar, { height: waveHeight2 }]} />
              <View style={[styles.waveBar, { height: waveHeight3 }]} />
            </View>

            <TouchableOpacity style={styles.doneButton} onPress={stopAndUploadRecording}>
              <Ionicons name="checkmark" size={18} color={colors.white} />
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input Bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.inlineIconButton}
            onPress={handlePickDocument}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="attach-outline" size={29} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            editable={!isRecording}
          />

          <TouchableOpacity
            style={styles.inlineIconButton}
            onPress={startRecording}
            disabled={isRecording}
          >
            <Ionicons name="mic-outline" size={27} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isSending}
        >
          <Ionicons name="send" size={18} color={colors.white} style={styles.sendIcon} />
        </TouchableOpacity>
      </View>

      {/* Custom Options Modal */}
      <Modal
        visible={isActionModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsActionModalVisible(false)}
      >
        <View style={styles.customModalOverlay}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setIsActionModalVisible(false)}
          >
            <View style={styles.customPopupCard}>
              <Text style={styles.popupHeaderTitle}>Message Options</Text>
              
              <TouchableOpacity style={styles.popupActionRow} onPress={handleCopyMessage}>
                <Ionicons name="copy-outline" size={20} color={colors.primary} />
                <Text style={styles.popupActionText}>Copy</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.popupActionRow} onPress={handlePinMessage}>
                <Ionicons name="pin-outline" size={20} color={colors.primary} />
                <Text style={styles.popupActionText}>Pin</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.popupActionRow} onPress={handleDeleteMessage}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <Text style={[styles.popupActionText, { color: colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Pinned Message Modal Menu */}
      <Modal
        visible={isPinModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPinModalVisible(false)}
      >
        <View style={styles.customModalOverlay}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setIsPinModalVisible(false)}
          >
            <View style={styles.customPopupCard}>
              <Text style={styles.popupHeaderTitle}>Pinned Message Options</Text>

              <TouchableOpacity
                style={styles.popupActionRow}
                onPress={() => {
                  if (pinnedMessage) handleScrollToMessage(pinnedMessage.id);
                }}
              >
                <Ionicons name="eye-outline" size={20} color={colors.primary} />
                <Text style={styles.popupActionText}>Show message</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.popupActionRow}
                onPress={() => {
                  setPinnedMessage(null);
                  setIsPinModalVisible(false);
                }}
              >
                <Ionicons name="pin" size={20} color={colors.danger} />
                <Text style={[styles.popupActionText, { color: colors.danger }]}>Unpin</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Full-Screen Image Preview Modal */}
      <Modal
        visible={isPreviewVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImagePreview}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseArea}
            activeOpacity={1}
            onPress={closeImagePreview}
          >
            <TouchableOpacity style={styles.closeButton} onPress={closeImagePreview}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>

            {previewImageUrl && (
              <Image
                source={{ uri: previewImageUrl }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  connectionBanner: { backgroundColor: colors.danger, paddingVertical: 6, alignItems: 'center' },
  connectionBannerText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  
  pinnedBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pinnedAccentBar: {
    width: 3,
    height: 28,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  pinIcon: { marginRight: 6 },
  pinnedContentContainer: { flex: 1 },
  pinnedTitle: { fontSize: 11, fontWeight: '700', color: colors.primary },
  pinnedTextSnippet: { fontSize: 13, color: colors.textPrimary },
  unpinIconButton: { padding: 4 },

  messagesFlatList: { flex: 1 },
  messagesList: { padding: 12, flexGrow: 1, justifyContent: 'flex-end' },
  messageBubbleContainer: { marginVertical: 4, flexDirection: 'row' },
  ownMessageContainer: { justifyContent: 'flex-end' },
  otherMessageContainer: { justifyContent: 'flex-start' },
  messageBubble: { 
    maxWidth: '78%', 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageBubbleOverride: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  ownBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: colors.surfaceLight, borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 20 },
  ownMessageText: { color: colors.white },
  otherMessageText: { color: colors.textPrimary },
  deletedText: { fontStyle: 'italic', color: colors.textSecondary },

  attachmentImage: {
    width: 240,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#E1E4E8',
  },
  attachmentFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  attachmentFileName: {
    marginLeft: 6,
    fontSize: 14,
    textDecorationLine: 'underline',
  },

  typingIndicator: { paddingHorizontal: 16, paddingVertical: 4 },
  typingText: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic' },

  recordingOverlay: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  recordingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 30,
    marginHorizontal: 12,
  },
  waveBar: {
    width: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginHorizontal: 3,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  doneButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginRight: 8,
    minHeight: 44,
  },
  inlineIconButton: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendIcon: { marginLeft: 2 },

  customModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDismissArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customPopupCard: {
    width: '80%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  popupHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  popupActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  popupActionText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginLeft: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  fullScreenImage: {
    width: '100%',
    height: '85%',
  },
});
