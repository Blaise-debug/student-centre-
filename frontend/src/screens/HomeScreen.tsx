import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
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
  author: string;
  subtitle: string;
  text: string;
  mediaUri?: string;
  commentsCount: number;
  challengesCount: number;
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
  onSubmit: (text: string, mediaUri?: string) => void;
  initialText?: string;
  initialMediaUri?: string;
  isEditing?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initialText);
  const [mediaUri, setMediaUri] = useState<string | null>(initialMediaUri || null);
  const [captionText, setCaptionText] = useState(initialMediaUri ? initialText : '');

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
              <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
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
          accessibilityRole="button"
          accessibilityLabel="Discard post"
        >
          <Text style={styles.discardActionText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.createPostActionButton, styles.submitActionButton]}
          onPress={() => {
            onSubmit(mediaUri ? captionText : text, mediaUri || undefined);
            if (isEditing) {
              Alert.alert('Success', 'Post updated successfully');
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={isEditing ? 'Save post' : 'Publish post'}
        >
          <Text style={styles.addButtonText}>{isEditing ? 'Save' : 'Post'}</Text>
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

          {post.mediaUri && (
            <Image source={{ uri: post.mediaUri }} style={styles.postDetailImage} />
          )}

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
  const [posts, setPosts] = useState<Post[]>([
    {
      id: '1',
      author: 'Chris Moya',
      subtitle: 'Explore your future',
      text: '',
      mediaUri: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
      commentsCount: 2,
      challengesCount: 0,
    },
    {
      id: '2',
      author: 'You',
      subtitle: 'New update',
      text: 'Working on updating the mobile layout interface today!',
      mediaUri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
      commentsCount: 0,
      challengesCount: 0,
    },
  ]);

  const [postComments, setPostComments] = useState<{ [postId: string]: CommentItemData[] }>({
    '1': [
      {
        id: '1',
        author: 'Bw Oyugi Makosa',
        isAuthor: true,
        text: 'In the new workflow, this looks robust.',
        replies: [
          { id: 'r1', author: 'Chinonso', text: 'Agreed completely!', timestamp: '2m ago' }
        ]
      },
      {
        id: '2',
        author: 'Chinonso Chukwudi',
        isAuthor: false,
        text: 'Amazing setup!',
        replies: []
      }
    ],
    '2': []
  });

  const [postChallenges, setPostChallenges] = useState<{ [postId: string]: CommentItemData[] }>({
    '1': [
      {
        id: 'c1',
        author: 'You',
        isAuthor: true,
        text: 'Everyone, make a revision with this.',
        image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80',
        replies: []
      }
    ],
    '2': []
  });

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [activeModal, setActiveModal] = useState<{ type: 'comments' | 'challenges'; postId: string } | null>(null);
  const [selectedPostDetail, setSelectedPostDetail] = useState<Post | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Live Event modal state for slider
  const [selectedEventItem, setSelectedEventItem] = useState<EventItem | null>(null);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  
  // Post Options Action Sheet
  const [postActionSheetVisible, setPostActionSheetVisible] = useState(false);
  const [selectedPostForAction, setSelectedPostForAction] = useState<Post | null>(null);

  // Active Unit State
  const [currentUnit] = useState('CIT 360');
  const [searchQuery, setSearchQuery] = useState('');

  const scrollViewRef = useRef<ScrollView>(null);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

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

  const handleCreateOrUpdatePost = (text: string, mediaUri?: string) => {
    if (editingPost) {
      setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, text, mediaUri } : p));
      setEditingPost(null);
    } else {
      const newPostId = Date.now().toString();
      const newPost: Post = {
        id: newPostId,
        author: 'You',
        subtitle: 'New update',
        text,
        mediaUri,
        commentsCount: 0,
        challengesCount: 0,
      };
      setPosts([newPost, ...posts]);
      setPostComments(prev => ({ ...prev, [newPostId]: [] }));
      setPostChallenges(prev => ({ ...prev, [newPostId]: [] }));
    }
    setIsCreateModalVisible(false);
  };

  const handleDeletePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
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
          <Text style={styles.activeUnitText}>{currentUnit}</Text>
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

        {/* Main Posts Feed with ScrollView containing Events Slider */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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

          {posts.map((post) => {
            const isHighlighted = highlightedPostId === post.id;
            const currentComments = postComments[post.id] || [];
            const currentChallenges = postChallenges[post.id] || [];
            const isCurrentUser = post.author === 'You';

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
                
                {post.mediaUri && (
                  <Image source={{ uri: post.mediaUri }} style={styles.postImage} />
                )}

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
