import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  PanResponder,
  Clipboard,
  Alert,
  Share,
  RefreshControl,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { colors } from '../theme/colors';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { initialEvents, EventItem, EventDetailModal } from './EventsScreen';
import { fetchAcademicProfile, updateActiveUnit } from '../services/academic-profile.service';
import { deleteUnitPost, fetchUnitPosts, createUnitPost, updateUnitPost } from '../services/posts.service';
import type { PostDto } from '../services/posts.service';
import { useAuth } from '../context/AuthContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface ReplyItem {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

interface CommentItemData {
  id: string;
  author: string;
  isAuthor: boolean;
  text: string;
  image?: string;
  replies: ReplyItem[];
}

interface Post {
  id: string;
  authorId: string;
  courseUnit: string;
  author: string;
  subtitle: string;
  text: string;
  mediaUri?: string;
  mediaType?: 'image' | 'video' | null;
  commentsCount: number;
  challengesCount: number;
}

function formatPostTimestamp(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Recently';
  const ageMs = Math.max(0, Date.now() - timestamp);
  if (ageMs < 60_000) return 'Just now';
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m ago`;
  if (ageMs < 86_400_000) return `${Math.floor(ageMs / 3_600_000)}h ago`;
  return new Date(value).toLocaleDateString();
}

function mapPostDto(post: PostDto): Post {
  return {
    id: post.id,
    authorId: post.author.id,
    courseUnit: post.courseUnit,
    author: post.author.displayName || post.author.username || 'Student',
    subtitle: formatPostTimestamp(post.createdAt),
    text: post.text,
    mediaUri: post.mediaUri || undefined,
    mediaType: post.mediaType,
    commentsCount: post.commentsCount,
    challengesCount: post.challengesCount,
  };
}

export interface HomeScreenRef {
  triggerRefresh: () => void;
  scrollToTop: () => void;
}

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

// ==========================================
// 1. CREATE / EDIT POST SCREEN COMPONENT
// ==========================================
export function CreatePostScreen({
  onClose,
  onSubmit,
  initialText = '',
  initialMediaUri = '',
  isEditing = false,
}: {
  onClose: () => void;
  onSubmit: (text: string, mediaUri?: string) => Promise<void>;
  initialText?: string;
  initialMediaUri?: string;
  isEditing?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initialText);
  const [mediaUri, setMediaUri] = useState<string | null>(initialMediaUri || null);
  const [captionText, setCaptionText] = useState(initialMediaUri ? initialText : '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setMediaUri(result.assets[0].uri);
    }
  };

  return (
    
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={styles.container}
>

      <View style={[styles.header, styles.createPostHeader]}>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Post' : 'Create Post'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {mediaUri ? (
          <View style={styles.previewContainer}>
            <View style={styles.mediaPreviewWrapper}>
              {/\.(mp4|mov|webm)(?:\?|$)/i.test(mediaUri) ? (
                <Video source={{ uri: mediaUri }} style={styles.mediaPreview} resizeMode={ResizeMode.COVER} useNativeControls />
              ) : (
                <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
              )}
              <TouchableOpacity style={styles.removeMedia} onPress={() => setMediaUri(null)}>
                <Ionicons name="close-circle" size={28} color="#d32f2f" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.captionInput}
              placeholder="Write a caption for this photo/video..."
              placeholderTextColor="#888"
              multiline
              value={captionText}
              onChangeText={setCaptionText}
            />
          </View>
        ) : (
          <TextInput
            style={styles.initialTextInput}
            placeholder="What's on your mind?"
            placeholderTextColor="#888"
            multiline
            value={text}
            onChangeText={setText}
          />
        )}
      </ScrollView>

      <TouchableOpacity style={styles.mediaPickerBar} onPress={pickImage}>
        <Ionicons name="image-outline" size={24} color="#2e7d32" />
        <Text style={styles.mediaPickerText}>Photos/videos</Text>
      </TouchableOpacity>

      <View style={styles.createPostActions}>
        <TouchableOpacity
          style={[styles.createPostActionButton, styles.discardActionButton]}
          onPress={onClose}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Discard post"
        >
          <Text style={styles.discardActionText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.createPostActionButton, styles.submitActionButton]}
          onPress={async () => {
            const postText = mediaUri ? captionText : text;
            if (!postText.trim() && !mediaUri) {
              Alert.alert('Post is empty', 'Write something or attach a photo or video.');
              return;
            }
            setIsSubmitting(true);
            try {
              await onSubmit(postText, mediaUri || undefined);
              if (isEditing) Alert.alert('Success', 'Post updated successfully');
              onClose();
            } catch (error: any) {
              const message = error?.response?.data?.message || error?.message || 'Please try again.';
              Alert.alert(isEditing ? 'Unable to update post' : 'Unable to publish post', message);
            } finally {
              setIsSubmitting(false);
            }
          }}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={isEditing ? 'Save post' : 'Publish post'}
        >
          <Text style={styles.addButtonText}>{isSubmitting ? 'Saving…' : isEditing ? 'Save' : 'Post'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ==========================================
// 2. COMMENTS / CHALLENGES MODAL COMPONENT
// ==========================================
export function CommentsModal({
  visible,
  onClose,
  title = "Comments",
  initialData = [],
  onDataChange,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  initialData?: CommentItemData[];
  onDataChange?: (updatedComments: CommentItemData[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useGradualKeyboardHeight();
  const [comments, setComments] = useState<CommentItemData[]>(initialData);

  useEffect(() => {
    setComments(initialData);
  }, [initialData]);

  const [modalHeightState, setModalHeightState] = useState<'threeQuarter' | 'full'>('threeQuarter');
  const [inputText, setInputText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

  const [activeItem, setActiveItem] = useState<CommentItemData | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<{ [key: string]: boolean }>({});
  
  const [viewingMediaUri, setViewingMediaUri] = useState<string | null>(null);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboardHeight.value - insets.bottom, 0),
  }));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 && modalHeightState === 'threeQuarter') {
          onClose();
        } else if (gestureState.dy < -100 && modalHeightState === 'threeQuarter') {
          setModalHeightState('full');
        }
      },
    })
  ).current;

  const pickCommentMedia = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedMedia(result.assets[0].uri);
    }
  };

  const handleDownloadMedia = async (uri: string) => {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission Denied',
        'Permission to access storage is required to download media.'
      );
      return;
    }

    const filename =
      uri.split('/').pop()?.split('?')[0] ||
      `media_${Date.now()}.jpg`;

    const destination = new File(Paths.cache, filename);

    const downloadedFile = await File.downloadFileAsync(
      uri,
      destination
    );

    await MediaLibrary.saveToLibraryAsync(downloadedFile.uri);

    Alert.alert(
      'Success',
      'Media downloaded successfully to your gallery!'
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to download media.';

    Alert.alert('Download Error', message);
  }
};


  const updateCommentsState = (newComments: CommentItemData[]) => {
    setComments(newComments);
    if (onDataChange) {
      onDataChange(newComments);
    }
  };

  const handleSend = () => {
    if (!inputText.trim() && !selectedMedia) return;

    if (editingItemId) {
      const updated = comments.map(c => c.id === editingItemId ? { ...c, text: inputText } : c);
      updateCommentsState(updated);
      setEditingItemId(null);
    } else if (replyingToId) {
      const updated = comments.map(c => {
        if (c.id === replyingToId) {
          return {
            ...c,
            replies: [...c.replies, { id: Date.now().toString(), author: 'You', text: inputText, timestamp: 'Just now' }]
          };
        }
        return c;
      });
      updateCommentsState(updated);
      setReplyingToId(null);
    } else {
      const newComment: CommentItemData = {
        id: Date.now().toString(),
        author: 'You',
        isAuthor: true,
        text: inputText,
        image: selectedMedia || undefined,
        replies: []
      };
      updateCommentsState([newComment, ...comments]);
    }

    setInputText('');
    setSelectedMedia(null);
  };

  const toggleRepliesExpansion = (id: string) => {
    setExpandedReplies(prev => ({ ...prev, [id]: !prev[id] }));
    setModalHeightState('full');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalRootContainer}>
        <Animated.View style={[styles.keyboardAvoidingContainer, animatedContainerStyle]}>
          <View
            style={[
              styles.modalContentContainer,
              { height: modalHeightState === 'full' ? SCREEN_HEIGHT : SCREEN_HEIGHT * 0.75 },
            ]}
          >
            <View {...panResponder.panHandlers} style={styles.grabberContainer}>
              <View style={styles.grabberHandle} />
            </View>

            <View style={styles.modalHeader}>
              {modalHeightState === 'full' ? (
                <TouchableOpacity onPress={() => setModalHeightState('threeQuarter')}>
                  <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
              ) : null}
              <Text style={styles.modalTitle}>{title} ({comments.length})</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.commentsList}>
              {comments.map((item) => {
                const isExpanded = expandedReplies[item.id];
                return (
                  <View key={item.id} style={styles.commentBlock}>
                    <View style={styles.commentRowContainer}>
                      <View style={styles.authorAvatarSmall}>
                        <Text style={styles.avatarInitials}>
                          {item.author.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onLongPress={() => {
                          setActiveItem(item);
                          setActionSheetVisible(true);
                        }}
                        style={styles.commentBubble}
                      >
                        <Text style={styles.commentAuthor}>{item.author}</Text>
                        <Text style={styles.commentText}>{item.text}</Text>
                        {item.image ? (
                          <TouchableOpacity onPress={() => setViewingMediaUri(item.image || null)}>
                            <Image source={{ uri: item.image }} style={styles.commentImagePreview} />
                          </TouchableOpacity>
                        ) : null}
                      </TouchableOpacity>
                    </View>

                    {item.replies.length > 0 && (
                      <View style={styles.repliesContainer}>
                        <TouchableOpacity onPress={() => toggleRepliesExpansion(item.id)}>
                          <Text style={styles.toggleRepliesText}>
                            {isExpanded ? 'Hide replies' : `View ${item.replies.length} replies`}
                          </Text>
                        </TouchableOpacity>

                        {isExpanded && item.replies.map(reply => (
                          <View key={reply.id} style={styles.replyItem}>
                            <Text style={styles.replyAuthor}>{reply.author}</Text>
                            <Text style={styles.replyText}>{reply.text}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {selectedMedia && (
              <View style={styles.inputMediaPreviewContainer}>
                <Image source={{ uri: selectedMedia }} style={styles.inputMediaThumb} />
                <TouchableOpacity onPress={() => setSelectedMedia(null)}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.inputBarContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              <TouchableOpacity onPress={pickCommentMedia} style={styles.inputIconBtn}>
                <Ionicons name="image-outline" size={22} color="#2e7d32" />
              </TouchableOpacity>
              <TextInput
                style={styles.commentTextInput}
                placeholder={replyingToId ? "Write a reply..." : editingItemId ? "Edit..." : `Write a ${title.toLowerCase().slice(0, -1)}...`}
                placeholderTextColor="#888"
                value={inputText}
                onChangeText={setInputText}
                multiline
              />
              <TouchableOpacity onPress={handleSend} style={styles.sendBtn}>
                <Ionicons name="send" size={18} color="#2e7d32" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>

      {viewingMediaUri && (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setViewingMediaUri(null)}>
          <View style={styles.mediaViewerOverlay}>
            <View style={styles.mediaViewerHeader}>
              <TouchableOpacity onPress={() => setViewingMediaUri(null)} style={styles.viewerCloseBtn}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDownloadMedia(viewingMediaUri)} style={styles.viewerDownloadBtn}>
                <Ionicons name="download-outline" size={24} color="#fff" />
                <Text style={styles.viewerDownloadText}>Download</Text>
              </TouchableOpacity>
            </View>
            <Image source={{ uri: viewingMediaUri }} style={styles.fullscreenMedia} />
          </View>
        </Modal>
      )}

      <Modal visible={actionSheetVisible} transparent={true} animationType="fade" onRequestClose={() => setActionSheetVisible(false)}>
        <TouchableOpacity style={styles.actionSheetOverlay} activeOpacity={1} onPress={() => setActionSheetVisible(false)}>
          <View style={styles.actionSheetContent}>
            <View style={styles.grabberHandle} />
            {activeItem?.isAuthor ? (
              <>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => {
                    setActionSheetVisible(false);
                    setEditingItemId(activeItem.id);
                    setInputText(activeItem.text);
                  }}
                >
                  <Ionicons name="pencil-outline" size={20} color="#333" />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => {
                    setActionSheetVisible(false);
                    setReplyingToId(activeItem.id);
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={20} color="#333" />
                  <Text style={styles.actionText}>Reply</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => {
                    setActionSheetVisible(false);
                    updateCommentsState(comments.filter(c => c.id !== activeItem.id));
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#d32f2f" />
                  <Text style={[styles.actionText, { color: '#d32f2f' }]}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => {
                    setActionSheetVisible(false);
                    setReplyingToId(activeItem?.id || null);
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={20} color="#333" />
                  <Text style={styles.actionText}>Reply</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => {
                    setActionSheetVisible(false);
                    if (activeItem) Clipboard.setString(activeItem.text);
                    Alert.alert("Copied", "Text copied to clipboard");
                  }}
                >
                  <Ionicons name="copy-outline" size={20} color="#333" />
                  <Text style={styles.actionText}>Copy</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

// ==========================================
// 3. FULL POST DETAIL MODAL COMPONENT
// ==========================================
export function PostDetailModal({
  visible,
  onClose,
  post,
  comments,
  challenges,
  onOpenComments,
  onOpenChallenges,
  onShare,
}: {
  visible: boolean;
  onClose: () => void;
  post: Post | null;
  comments: CommentItemData[];
  challenges: CommentItemData[];
  onOpenComments: () => void;
  onOpenChallenges: () => void;
  onShare: () => void;
}) {
  if (!post) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.postDetailRoot}>
        <View style={styles.postDetailHeader}>
          <Text style={styles.postDetailHeaderTitle}>Post Details</Text>
          <TouchableOpacity onPress={onClose} style={styles.postDetailCloseBtn}>
            <Ionicons name="close" size={24} color="#1b5e20" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.postDetailScroll}>
          <View style={styles.postHeaderRow}>
            <View style={styles.authorAvatarPlaceholder} />
            <View style={styles.postHeaderTextContainer}>
              <Text style={styles.postAuthor}>{post.author}</Text>
              <Text style={styles.postSubtitle}>{post.subtitle}</Text>
            </View>
          </View>

          {post.text ? <Text style={styles.postDetailText}>{post.text}</Text> : null}

          {post.mediaUri && (post.mediaType === 'video' ? (
            <Video source={{ uri: post.mediaUri }} style={styles.postDetailImage} resizeMode={ResizeMode.COVER} useNativeControls />
          ) : (
            <Image source={{ uri: post.mediaUri }} style={styles.postDetailImage} />
          ))}

          <View style={styles.postFooter}>
            <TouchableOpacity style={styles.footerActionButton} onPress={onOpenComments}>
              <Ionicons name="chatbubble-outline" size={18} color="#2e7d32" />
              <Text style={styles.footerActionLabel}>Comment</Text>
              {comments.length > 0 && <Text style={styles.badgeText}>{comments.length}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.footerActionButton} onPress={onShare}>
              <Ionicons name="share-social-outline" size={18} color="#2e7d32" />
              <Text style={styles.footerActionLabel}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.footerActionButton} onPress={onOpenChallenges}>
              <Ionicons name="help-circle-outline" size={18} color="#2e7d32" />
              <Text style={styles.footerActionLabel}>Challenge</Text>
              {challenges.length > 0 && <Text style={styles.badgeText}>{challenges.length}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ==========================================
// 4. MAIN HOMESCREEN COMPONENT (DEFAULT EXPORT)
// ==========================================
export default forwardRef<HomeScreenRef, { navigation: any }>(function HomeScreen({ navigation }, ref) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [postComments, setPostComments] = useState<{ [postId: string]: CommentItemData[] }>({});
  const [postChallenges, setPostChallenges] = useState<{ [postId: string]: CommentItemData[] }>({});

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [activeModal, setActiveModal] = useState<{ type: 'comments' | 'challenges'; postId: string } | null>(null);
  const [selectedPostDetail, setSelectedPostDetail] = useState<Post | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [feedError, setFeedError] = useState('');

  // Live Event modal state for slider
  const [selectedEventItem, setSelectedEventItem] = useState<EventItem | null>(null);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  
  // Post Options Action Sheet
  const [postActionSheetVisible, setPostActionSheetVisible] = useState(false);
  const [selectedPostForAction, setSelectedPostForAction] = useState<Post | null>(null);

  // Active Unit State
  const [currentUnit, setCurrentUnit] = useState('');
  const [availableUnits, setAvailableUnits] = useState<string[]>([]);
  const [courseShareCode, setCourseShareCode] = useState('');
  const [isUnitPickerVisible, setIsUnitPickerVisible] = useState(false);
  const [isChangingUnit, setIsChangingUnit] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const scrollViewRef = useRef<ScrollView>(null);
  const postsRequestId = useRef(0);
  const nextPostCursor = useRef<string | null>(null);
  const isLoadingMorePostsRef = useRef(false);

  const loadPosts = useCallback(async (unit: string, clearBeforeLoad = false) => {
    const requestId = ++postsRequestId.current;
    if (clearBeforeLoad) {
      setPosts([]);
      nextPostCursor.current = null;
    }
    if (!unit) {
      setPosts([]);
      nextPostCursor.current = null;
      setIsLoadingPosts(false);
      setFeedError('Add a course unit to load its posts.');
      return;
    }

    setIsLoadingPosts(true);
    setFeedError('');
    try {
      const page = await fetchUnitPosts(unit);
      if (requestId !== postsRequestId.current) return;
      setPosts(page.posts.map(mapPostDto));
      nextPostCursor.current = page.nextCursor;
    } catch {
      if (requestId !== postsRequestId.current) return;
      setPosts([]);
      nextPostCursor.current = null;
      setFeedError('Could not load posts for this unit. Check your connection and try again.');
    } finally {
      if (requestId === postsRequestId.current) setIsLoadingPosts(false);
    }
  }, []);

  const loadMorePosts = useCallback(async () => {
    const cursor = nextPostCursor.current;
    if (!cursor || !currentUnit || isLoadingMorePostsRef.current) return;

    const requestId = postsRequestId.current;
    isLoadingMorePostsRef.current = true;
    setIsLoadingMorePosts(true);
    try {
      const page = await fetchUnitPosts(currentUnit, cursor);
      if (requestId !== postsRequestId.current) return;
      setPosts((previous) => {
        const seen = new Set(previous.map((post) => post.id));
        return [...previous, ...page.posts.map(mapPostDto).filter((post) => !seen.has(post.id))];
      });
      nextPostCursor.current = page.nextCursor;
      setFeedError('');
    } catch {
      if (requestId === postsRequestId.current) {
        setFeedError('Could not load more posts. Check your connection and retry.');
      }
    } finally {
      isLoadingMorePostsRef.current = false;
      setIsLoadingMorePosts(false);
    }
  }, [currentUnit]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (!currentUnit) {
        const profile = await fetchAcademicProfile();
        const units = [...profile.mainUnits, ...profile.commonUnits, ...profile.otherUnits];
        const activeUnit = profile.activeUnit || profile.mainUnits[0] || profile.commonUnits[0] || profile.otherUnits[0] || '';
        setAvailableUnits(units);
        setCourseShareCode(profile.shareCode);
        setCurrentUnit(activeUnit);
        await loadPosts(activeUnit, true);
      } else {
        await loadPosts(currentUnit);
      }
    } catch {
      setFeedError('Could not load your course units. Check your connection and try again.');
    } finally {
      setRefreshing(false);
    }
  }, [currentUnit, loadPosts]);

  useEffect(() => {
    let isMounted = true;
    fetchAcademicProfile()
      .then((profile) => {
        if (!isMounted) return;
        const units = [...profile.mainUnits, ...profile.commonUnits, ...profile.otherUnits];
        setAvailableUnits(units);
        setCourseShareCode(profile.shareCode);
        const activeUnit = profile.activeUnit || profile.mainUnits[0] || profile.commonUnits[0] || profile.otherUnits[0] || '';
        setCurrentUnit(activeUnit);
        void loadPosts(activeUnit, true);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoadingPosts(false);
        setFeedError('Could not load your course units. Check your connection and try again.');
      });
    return () => {
      isMounted = false;
      postsRequestId.current += 1;
    };
  }, [loadPosts]);

  const handleChangeUnit = async (unit: string) => {
    if (isChangingUnit || unit === currentUnit) {
      setIsUnitPickerVisible(false);
      return;
    }
    setIsChangingUnit(true);
    try {
      const profile = await updateActiveUnit(unit);
      setCurrentUnit(profile.activeUnit);
      setIsUnitPickerVisible(false);
      setSearchQuery('');
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      await loadPosts(profile.activeUnit, true);
    } catch {
      Alert.alert('Unable to change course', 'Please check your connection and try again.');
    } finally {
      setIsChangingUnit(false);
    }
  };

  const shareCourseSetup = async () => {
    if (!courseShareCode) return;
    try {
      await Share.share({ message: `Use my Student Centre course setup code: ${courseShareCode}` });
    } catch {
      Alert.alert('Unable to share code', 'Please try again.');
    }
  };

  const scrollToTop = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // Exposing refresh and scroll functions to parent navigator via ref
  useImperativeHandle(ref, () => ({
    triggerRefresh: () => {
      scrollToTop();
      onRefresh();
    },
    scrollToTop,
  }));

  useEffect(() => {
    const parseAndNavigateUrl = (url: string) => {
      const match = url.match(/\/posts\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        const postId = match[1];
        setHighlightedPostId(postId);
        setTimeout(() => setHighlightedPostId(null), 3000);
      }
    };

    const handleDeepLink = (event: { url: string }) => {
      parseAndNavigateUrl(event.url);
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        parseAndNavigateUrl(url);
      }
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => {
      subscription.remove();
    };
  }, []);

  const handleCreateOrUpdatePost = async (text: string, mediaUri?: string): Promise<void> => {
    if (editingPost) {
      const updatedPost = await updateUnitPost(
        editingPost.id,
        editingPost.courseUnit,
        text,
        mediaUri,
        Boolean(editingPost.mediaUri && !mediaUri)
      );
      setPosts((previous) => previous.map((post) => post.id === updatedPost.id ? {
        ...post,
        text: updatedPost.text,
        mediaUri: updatedPost.mediaUri || undefined,
        mediaType: updatedPost.mediaType,
        subtitle: formatPostTimestamp(updatedPost.updatedAt),
      } : post));
    } else {
      const createdPost = await createUnitPost(currentUnit, text, mediaUri);
      const newPost: Post = {
        id: createdPost.id,
        authorId: createdPost.author.id,
        courseUnit: createdPost.courseUnit,
        author: createdPost.author.displayName || user?.displayName || 'You',
        subtitle: formatPostTimestamp(createdPost.createdAt),
        text: createdPost.text,
        mediaUri: createdPost.mediaUri || undefined,
        mediaType: createdPost.mediaType,
        commentsCount: createdPost.commentsCount,
        challengesCount: createdPost.challengesCount,
      };
      setPosts((previous) => [newPost, ...previous]);
      setPostComments((previous) => ({ ...previous, [newPost.id]: [] }));
      setPostChallenges((previous) => ({ ...previous, [newPost.id]: [] }));
    }
  };

  const handleDeletePost = (postId: string) => {
    Alert.alert('Delete post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUnitPost(postId);
            setPosts((previous) => previous.filter((post) => post.id !== postId));
          } catch (error: any) {
            Alert.alert('Unable to delete post', error?.response?.data?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const handleShare = async (postId: string, author: string) => {
    try {
      const shareUrl = `https://studentscentre.app/posts/${postId}`;
      await Share.share({
        message: `Check out this post by ${author} on Students Centre: ${shareUrl}`,
        title: `Students Centre - ${author}'s Post`,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSearchSubmit = () => {
    Keyboard.dismiss();
    Alert.alert("Search Results", `Displaying results for: "${searchQuery}"`);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* Sticky Active Unit and Search Bar Section */}
        <View style={styles.unitSearchContainer}>
          <TouchableOpacity
            style={styles.activeUnitButton}
            onPress={() => availableUnits.length > 0 && setIsUnitPickerVisible(true)}
            disabled={availableUnits.length === 0}
            accessibilityRole="button"
            accessibilityLabel={availableUnits.length > 0 ? `Change active course. Current course: ${currentUnit}` : `Active course: ${currentUnit}`}
          >
            <Text style={styles.activeUnitText} numberOfLines={1}>{currentUnit || 'Course units'}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.primaryDark} />
          </TouchableOpacity>
          <View style={styles.searchBarWrapper}>
            <TextInput
              style={styles.unitSearchInput}
              placeholder={`Search ${currentUnit}`}
              placeholderTextColor="#777"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            <TouchableOpacity onPress={handleSearchSubmit} style={styles.searchIconBtn}>
              <Ionicons name="search" size={20} color="#555" />
            </TouchableOpacity>
          </View>
        </View>

        <Modal
          visible={isUnitPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsUnitPickerVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setIsUnitPickerVisible(false)}>
            <View style={styles.unitPickerOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.unitPickerCard}>
                  <Text style={styles.unitPickerTitle}>Choose a course unit</Text>
                  {isChangingUnit ? <Text style={styles.unitPickerStatus}>Saving your choice…</Text> : null}
                  <ScrollView style={styles.unitPickerList}>
                    {availableUnits.map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={styles.unitPickerRow}
                        onPress={() => handleChangeUnit(unit)}
                        disabled={isChangingUnit}
                        accessibilityRole="button"
                        accessibilityState={{ selected: unit === currentUnit, disabled: isChangingUnit }}
                      >
                        <Text style={[styles.unitPickerText, unit === currentUnit && styles.unitPickerTextActive]}>{unit}</Text>
                        {unit === currentUnit ? <Ionicons name="checkmark-circle" size={20} color={colors.primaryDark} /> : null}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {courseShareCode ? (
                    <TouchableOpacity style={styles.shareCourseCodeButton} onPress={shareCourseSetup}>
                      <Ionicons name="share-social-outline" size={18} color={colors.primaryDark} />
                      <Text style={styles.unitPickerCancelText}>Share course setup code</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.unitPickerCancel} onPress={() => setIsUnitPickerVisible(false)} disabled={isChangingUnit}>
                    <Text style={styles.unitPickerCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Main Posts Feed with ScrollView containing Events Slider */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={250}
          onScroll={({ nativeEvent }) => {
            const distanceToBottom = nativeEvent.contentSize.height - (
              nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height
            );
            if (distanceToBottom < 450) void loadMorePosts();
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2e7d32" />
          }
        >
          {/* Top Events Slider placed inside scrolling content */}
          <View style={styles.storiesContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
              {initialEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  activeOpacity={0.9}
                  style={styles.storyCard}
                  onPress={() => {
                    setSelectedEventItem(event);
                    setEventModalVisible(true);
                  }}
                >
                  {event.thumbnail ? (
                    <Image source={{ uri: event.thumbnail }} style={styles.storyBgImage} />
                  ) : (
                    <View style={[styles.storyBgImage, { backgroundColor: '#2e7d32', justifyContent: 'center', alignItems: 'center', padding: 8 }]}>
                      <Text style={styles.storyTextBanner}>{event.title}</Text>
                    </View>
                  )}
                  <View style={styles.storyOverlayQuarter}>
                    <Text style={styles.storyTextBanner} numberOfLines={2}>{event.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {isLoadingPosts && posts.length === 0 ? (
            <View style={styles.feedStatus}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.feedStatusText}>Loading posts for {currentUnit || 'your course'}…</Text>
            </View>
          ) : null}

          {!isLoadingPosts && feedError ? (
            <View style={styles.feedStatus}>
              <Text style={styles.feedStatusText}>{feedError}</Text>
              <TouchableOpacity onPress={onRefresh} accessibilityRole="button">
                <Text style={styles.feedRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!isLoadingPosts && !feedError && posts.length === 0 ? (
            <View style={styles.feedStatus}>
              <Ionicons name="chatbubbles-outline" size={34} color={colors.textSecondary} />
              <Text style={styles.feedEmptyTitle}>No posts in {currentUnit} yet</Text>
              <Text style={styles.feedStatusText}>Be the first to share something with this course unit.</Text>
            </View>
          ) : null}

          {posts.map((post) => {
            const isHighlighted = highlightedPostId === post.id;
            const currentComments = postComments[post.id] || [];
            const currentChallenges = postChallenges[post.id] || [];
            const isCurrentUser = post.authorId === user?.id;

            return (
              <TouchableOpacity
                key={post.id}
                activeOpacity={0.95}
                onPress={() => setSelectedPostDetail(post)}
                style={[
                  styles.postCard, 
                  isHighlighted && styles.highlightedPostCard
                ]}
              >
                <View style={styles.postHeaderRow}>
                  <View style={styles.authorAvatarPlaceholder} />
                  <View style={styles.postHeaderTextContainer}>
                    <Text style={styles.postAuthor}>{post.author}</Text>
                    <Text style={styles.postSubtitle}>{post.subtitle}</Text>
                  </View>
                  {isCurrentUser && (
                    <TouchableOpacity
                      style={styles.postOptionsBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedPostForAction(post);
                        setPostActionSheetVisible(true);
                      }}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color="#555" />
                    </TouchableOpacity>
                  )}
                </View>

                {post.text ? <Text style={styles.postText}>{post.text}</Text> : null}
                
                {post.mediaUri && (post.mediaType === 'video' ? (
                  <Video source={{ uri: post.mediaUri }} style={styles.postImage} resizeMode={ResizeMode.COVER} useNativeControls />
                ) : (
                  <Image source={{ uri: post.mediaUri }} style={styles.postImage} />
                ))}

                <View style={styles.postFooter}>
                  <TouchableOpacity
                    style={styles.footerActionButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      setActiveModal({ type: 'comments', postId: post.id });
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color="#2e7d32" />
                    <Text style={styles.footerActionLabel}>Comment</Text>
                    {currentComments.length > 0 && (
                      <Text style={styles.badgeText}>{currentComments.length}</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.footerActionButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleShare(post.id, post.author);
                    }}
                  >
                    <Ionicons name="share-social-outline" size={18} color="#2e7d32" />
                    <Text style={styles.footerActionLabel}>Share</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.footerActionButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      setActiveModal({ type: 'challenges', postId: post.id });
                    }}
                  >
                    <Ionicons name="help-circle-outline" size={18} color="#2e7d32" />
                    <Text style={styles.footerActionLabel}>Challenge</Text>
                    {currentChallenges.length > 0 && (
                      <Text style={styles.badgeText}>{currentChallenges.length}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
          {isLoadingMorePosts ? (
            <View style={styles.feedLoadingMore}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.feedStatusText}>Loading more posts…</Text>
            </View>
          ) : null}
        </ScrollView>

        <TouchableOpacity
          style={styles.floatingCreateBtn}
          onPress={() => {
            setEditingPost(null);
            setIsCreateModalVisible(true);
          }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>

        {isCreateModalVisible && (
          <View style={styles.absoluteModalContainer}>
            <CreatePostScreen
              onClose={() => {
                setIsCreateModalVisible(false);
                setEditingPost(null);
              }}
              onSubmit={handleCreateOrUpdatePost}
              initialText={editingPost?.text || ''}
              initialMediaUri={editingPost?.mediaUri || ''}
              isEditing={!!editingPost}
            />
          </View>
        )}

        {activeModal && (
          <CommentsModal
            visible={true}
            onClose={() => setActiveModal(null)}
            title={activeModal.type === 'comments' ? 'Comments' : 'Challenges'}
            initialData={activeModal.type === 'comments' ? postComments[activeModal.postId] : postChallenges[activeModal.postId]}
            onDataChange={(updated) => {
              if (activeModal.type === 'comments') {
                setPostComments(prev => ({ ...prev, [activeModal.postId]: updated }));
                setPosts(prev => prev.map(p => p.id === activeModal.postId ? { ...p, commentsCount: updated.length } : p));
              } else {
                setPostChallenges(prev => ({ ...prev, [activeModal.postId]: updated }));
                setPosts(prev => prev.map(p => p.id === activeModal.postId ? { ...p, challengesCount: updated.length } : p));
              }
            }}
          />
        )}

        <PostDetailModal
          visible={!!selectedPostDetail}
          onClose={() => setSelectedPostDetail(null)}
          post={selectedPostDetail}
          comments={selectedPostDetail ? postComments[selectedPostDetail.id] || [] : []}
          challenges={selectedPostDetail ? postChallenges[selectedPostDetail.id] || [] : []}
          onOpenComments={() => {
            if (selectedPostDetail) {
              const postId = selectedPostDetail.id;
              setSelectedPostDetail(null);
              setActiveModal({ type: 'comments', postId });
            }
          }}
          onOpenChallenges={() => {
            if (selectedPostDetail) {
              const postId = selectedPostDetail.id;
              setSelectedPostDetail(null);
              setActiveModal({ type: 'challenges', postId });
            }
          }}
          onShare={() => {
            if (selectedPostDetail) {
              handleShare(selectedPostDetail.id, selectedPostDetail.author);
            }
          }}
        />

        <EventDetailModal
          visible={eventModalVisible}
          onClose={() => setEventModalVisible(false)}
          selectedEvent={selectedEventItem}
          navigation={navigation}
        />

        <Modal visible={postActionSheetVisible} transparent={true} animationType="fade" onRequestClose={() => setPostActionSheetVisible(false)}>
          <TouchableOpacity style={styles.actionSheetOverlay} activeOpacity={1} onPress={() => setPostActionSheetVisible(false)}>
            <View style={styles.actionSheetContent}>
              <View style={styles.grabberHandle} />
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setPostActionSheetVisible(false);
                  if (selectedPostForAction) {
                    setEditingPost(selectedPostForAction);
                    setIsCreateModalVisible(true);
                  }
                }}
              >
                <Ionicons name="pencil-outline" size={20} color="#333" />
                <Text style={styles.actionText}>Edit Post</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setPostActionSheetVisible(false);
                  if (selectedPostForAction) {
                    handleDeletePost(selectedPostForAction.id);
                  }
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#d32f2f" />
                <Text style={[styles.actionText, { color: '#d32f2f' }]}>Delete Post</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8f5e9',
  },
  headerBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#e8f5e9',
  },
  headerLogoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#c8e6c9',
    backgroundColor: '#e8f5e9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  createPostHeader: {
    justifyContent: 'center',
  },
  createPostActions: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 0,
    gap: 12,
    borderBottomWidth: 2, borderBottomColor: colors.border, 
    backgroundColor: '#e8f5e9',
  },
  createPostActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  discardActionButton: {
    backgroundColor: '#ffffff',
  },
  submitActionButton: {
    backgroundColor: '#129957',
  },
  discardActionText: {
    color: '#526456',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  discardButtonText: {
    color: '#d32f2f',
    fontWeight: '800',
    fontSize: 14,
  },
  storiesContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#c8e6c9',
  },
  storiesScroll: {
    paddingHorizontal: 16,
  },
  storyCard: {
    width: 110,
    height: 135,
    borderRadius: 12,
    backgroundColor: '#111',
    marginRight: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    elevation: 2,
  },
  storyBgImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    position: 'absolute',
  },
  storyOverlayQuarter: {
    height: '25%',
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  storyTextBanner: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  unitSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 64,
    backgroundColor: '#d8f3dc',
    borderBottomWidth: 1,
    borderBottomColor: '#c8e6c9',
    zIndex: 10,
  },
  activeUnitText: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  activeUnitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '45%',
  },
  feedStatus: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
    gap: 10,
  },
  feedStatusText: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  feedEmptyTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  feedRetryText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: '700',
  },
  feedLoadingMore: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  unitPickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  unitPickerCard: {
    maxHeight: '75%',
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.background,
  },
  unitPickerTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: '700', marginBottom: 10 },
  unitPickerStatus: { color: colors.textSecondary, marginBottom: 8 },
  unitPickerList: { flexShrink: 1 },
  unitPickerRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10 },
  unitPickerText: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  unitPickerTextActive: { color: colors.primaryDark, fontWeight: '700' },
  shareCourseCodeButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, padding: 10, marginTop: 8 },
  unitPickerCancel: { alignSelf: 'flex-end', padding: 10, marginTop: 4 },
  unitPickerCancelText: { color: colors.primaryDark, fontWeight: '700' },
  searchBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f4f3',
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 42,
    marginLeft: 16,
  },
  searchIconBtn: {
    padding: 4,
  },
  unitSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    padding: 0,
  },
  scrollContent: {
    padding: 0,
    paddingBottom: 80,
  },
  initialTextInput: {
    height: 150,
    textAlignVertical: 'top',
    fontSize: 16,
    color: '#333',
  },
  previewContainer: {
    marginBottom: 16,
  },
  mediaPreviewWrapper: {
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#d0e1d4',
    marginBottom: 12,
    position: 'relative',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeMedia: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  captionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 15,
    color: '#333',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
  },
  mediaPickerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#c8e6c9',
    backgroundColor: '#e8f5e9',
  },
  mediaPickerText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#2e7d32',
    fontWeight: '600',
  },
  modalRootContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingContainer: {
    width: '100%',
  },
  modalContentContainer: {
    backgroundColor: '#e8f5e9',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  grabberContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  grabberHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#a5d6a7',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#c8e6c9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  commentsList: {
    flex: 1,
    padding: 16,
  },
  commentBlock: {
    marginBottom: 14,
  },
  commentRowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  authorAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2e7d32',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  commentBubble: {
    backgroundColor: '#c8e6c9',
    padding: 12,
    borderRadius: 12,
    maxWidth: '78%',
  },
  commentAuthor: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#1b5e20',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
  },
  commentImagePreview: {
    width: 200,
    height: 140,
    borderRadius: 8,
    marginTop: 8,
    resizeMode: 'cover',
  },
  repliesContainer: {
    marginLeft: 36,
    marginTop: 6,
    borderLeftWidth: 2,
    borderLeftColor: '#a5d6a7',
    paddingLeft: 10,
  },
  toggleRepliesText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '600',
    marginVertical: 4,
  },
  replyItem: {
    backgroundColor: '#d0e1d4',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  replyAuthor: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  replyText: {
    fontSize: 13,
    color: '#333',
  },
  inputMediaPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#d0e1d4',
  },
  inputMediaThumb: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 10,
  },
  inputBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#c8e6c9',
    backgroundColor: '#e8f5e9',
  },
  inputIconBtn: {
    padding: 6,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    marginHorizontal: 8,
  },
  sendBtn: {
    padding: 8,
  },
  mediaViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaViewerHeader: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  viewerCloseBtn: {
    padding: 8,
  },
  viewerDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewerDownloadText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: 'bold',
  },
  fullscreenMedia: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    resizeMode: 'contain',
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  actionSheetContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  actionText: {
    fontSize: 16,
    marginLeft: 14,
    color: '#333',
    fontWeight: '500',
  },
  postCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 16,
    marginBottom: 0,
    borderBottomWidth: 8,
    borderBottomColor: '#d0e1d4',
  },
  highlightedPostCard: {
    backgroundColor: '#d0e1d4',
  },
  postHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  authorAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#c8e6c9',
    marginRight: 10,
  },
  postHeaderTextContainer: {
    flex: 1,
  },
  postAuthor: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#1b5e20',
  },
  postSubtitle: {
    fontSize: 13,
    color: '#555',
  },
  postOptionsBtn: {
    padding: 4,
  },
  postText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  postImage: {
    width: '100%',
    height: 340,
    marginBottom: 12,
    resizeMode: 'cover',
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#c8e6c9',
  },
  footerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d0e1d4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  footerActionLabel: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#1b5e20',
  },
  badgeText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  floatingCreateBtn: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2e7d32',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 50,
  },
  absoluteModalContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: '#fff',
  },
  postDetailRoot: {
    flex: 1,
    backgroundColor: '#e8f5e9',
  },
  postDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#c8e6c9',
    backgroundColor: '#e8f5e9',
    marginTop: Platform.OS === 'ios' ? 40 : 10,
  },
  postDetailHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  postDetailCloseBtn: {
    padding: 4,
  },
  postDetailScroll: {
    paddingVertical: 16,
    paddingBottom: 40,
  },
  postDetailText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  postDetailImage: {
    width: '100%',
    height: 380,
    marginBottom: 14,
    resizeMode: 'cover',
  },
});
