import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');
const FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop';
const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop';
const DEFAULT_POST_IMAGE =
  'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1000&auto=format&fit=crop';

type ProfileTab = 'Posts' | 'Media' | 'Events' | 'Search';
type DiscussionMode = 'comment' | 'challenge';
type PostMedia = { uri: string; type?: 'image' | 'video' };
type ProfilePost = {
  id: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  media?: PostMedia | null;
  createdAt: string;
};
type PostComment = {
  id: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  imageUri?: string | null;
  createdAt: number;
};

const isVideoUri = (uri?: string | null) =>
  !!uri && /\.(mp4|mov|m4v|webm|mkv)(\?.*)?$/i.test(uri);

export default function ProfileScreen() {
  const { user } = useAuth();
  const authUser = user as any;
  const currentName = authUser?.displayName || authUser?.name || 'Blaise Stephen';
  const currentAvatar =
    authUser?.photoURL || authUser?.avatarUrl || authUser?.avatar || FALLBACK_AVATAR;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentName);
  const [institution, setInstitution] = useState('KeMU');
  const [course, setCourse] = useState('Software Engineering');
  const [levelOfStudy, setLevelOfStudy] = useState('Undergraduate');
  const [avatarUrl, setAvatarUrl] = useState(currentAvatar);
  const [bannerUrl, setBannerUrl] = useState(FALLBACK_COVER);
  const [quote, setQuote] = useState('Tomorrow is always promised');
  const [tempQuote, setTempQuote] = useState('Tomorrow is always promised');
  const [isQuoteModalVisible, setIsQuoteModalVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('Posts');
  const [searchQuery, setSearchQuery] = useState('');

  const [posts, setPosts] = useState<ProfilePost[]>([
    {
      id: 'profile-post-1',
      authorName: currentName,
      authorAvatar: currentAvatar,
      text: 'Working on updating the mobile layout interface today!',
      media: { uri: DEFAULT_POST_IMAGE, type: 'image' },
      createdAt: 'Just now',
    },
  ]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
  const [challengesByPost, setChallengesByPost] = useState<Record<string, PostComment[]>>({});
  const [selectedPost, setSelectedPost] = useState<ProfilePost | null>(null);
  const [isPostViewerVisible, setIsPostViewerVisible] = useState(false);

  const [discussionMode, setDiscussionMode] = useState<DiscussionMode>('comment');
  const [discussionPost, setDiscussionPost] = useState<ProfilePost | null>(null);
  const [isDiscussionVisible, setIsDiscussionVisible] = useState(false);
  const [discussionDraft, setDiscussionDraft] = useState('');
  const [discussionImageUri, setDiscussionImageUri] = useState<string | null>(null);
  const [isSendingDiscussion, setIsSendingDiscussion] = useState(false);
  
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const discussionInputRef = useRef<TextInput>(null);

  const [postOptionsTarget, setPostOptionsTarget] = useState<ProfilePost | null>(null);
  const [isPostOptionsVisible, setIsPostOptionsVisible] = useState(false);
  const [postBeingEdited, setPostBeingEdited] = useState<ProfilePost | null>(null);
  const [editPostText, setEditPostText] = useState('');
  const [editPostMedia, setEditPostMedia] = useState<PostMedia | null>(null);
  const [isEditPostVisible, setIsEditPostVisible] = useState(false);
  const [isSavingPostEdit, setIsSavingPostEdit] = useState(false);

  const eventImages = useMemo(
    () => [
      { id: '1', uri: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500&auto=format&fit=crop' },
      { id: '2', uri: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=500&auto=format&fit=crop' },
      { id: '3', uri: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=500&auto=format&fit=crop' },
    ],
    [],
  );

  const discussionItems = useMemo(() => {
    if (!discussionPost) return [];
    const source = discussionMode === 'comment' ? commentsByPost : challengesByPost;
    return source[discussionPost.id] || [];
  }, [commentsByPost, challengesByPost, discussionMode, discussionPost]);

  const selectedPostComments = selectedPost ? commentsByPost[selectedPost.id] || [] : [];

  useEffect(() => {
    if (toastMessage === null) return undefined;
    const timer = setTimeout(() => setToastMessage(null), 2800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    setDisplayName(currentName);
    setAvatarUrl(currentAvatar);
  }, [currentName, currentAvatar]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const showToast = useCallback((message: string) => setToastMessage(message), []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Profile refreshed');
    }, 1500);
  }, [showToast]);

  const handleSaveProfile = useCallback(() => {
    const safeName = displayName.trim();
    if (!safeName) {
      Alert.alert('Name required', 'Please enter your full name before saving.');
      return;
    }
    setDisplayName(safeName);
    setPosts(previous =>
      previous.map(post =>
        post.authorName === currentName
          ? { ...post, authorName: safeName, authorAvatar: avatarUrl || currentAvatar }
          : post,
      ),
    );
    setIsEditing(false);
    showToast('Profile updated on this device');
  }, [avatarUrl, currentAvatar, currentName, displayName, showToast]);

  const handleSaveQuote = useCallback(() => {
    setQuote(tempQuote.trim());
    setIsQuoteModalVisible(false);
    showToast('Quote updated');
  }, [showToast, tempQuote]);

  const pickImage = useCallback(async (onPicked: (uri: string) => void) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Allow photo-library access to attach an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]?.uri) onPicked(result.assets[0].uri);
    } catch (error) {
      Alert.alert(
        'Image picker',
        error instanceof Error ? error.message : 'The image could not be selected.',
      );
    }
  }, []);

  const openPost = useCallback((post: ProfilePost) => {
    Keyboard.dismiss();
    setSelectedPost(post);
    setIsPostViewerVisible(true);
  }, []);

  const closePostViewer = useCallback(() => {
    Keyboard.dismiss();
    setIsPostViewerVisible(false);
    setSelectedPost(null);
  }, []);

  const openDiscussion = useCallback(
    (post: ProfilePost, mode: DiscussionMode, focusInput = false) => {
      Keyboard.dismiss();
      setDiscussionPost(post);
      setDiscussionMode(mode);
      setDiscussionDraft('');
      setDiscussionImageUri(null);
      setIsDiscussionVisible(true);
      if (focusInput) {
        setTimeout(() => discussionInputRef.current?.focus(), 350);
      }
    },
    [],
  );

  const closeDiscussion = useCallback(() => {
    Keyboard.dismiss();
    setIsDiscussionVisible(false);
    setDiscussionPost(null);
    setDiscussionDraft('');
    setDiscussionImageUri(null);
    setIsKeyboardVisible(false);
  }, []);

  const sendDiscussionItem = useCallback(() => {
    const text = discussionDraft.trim();
    if (!discussionPost || (!text && !discussionImageUri) || isSendingDiscussion) return;

    const newItem: PostComment = {
      id: `${discussionMode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      authorName: displayName.trim() || currentName,
      authorAvatar: avatarUrl || currentAvatar,
      text,
      imageUri: discussionImageUri,
      createdAt: Date.now(),
    };

    const update = (previous: Record<string, PostComment[]>) => ({
      ...previous,
      [discussionPost.id]: [...(previous[discussionPost.id] || []), newItem],
    });

    setIsSendingDiscussion(true);
    if (discussionMode === 'comment') setCommentsByPost(update);
    else setChallengesByPost(update);

    setDiscussionDraft('');
    setDiscussionImageUri(null);
    setIsSendingDiscussion(false);
    Keyboard.dismiss();
  }, [
    avatarUrl,
    currentAvatar,
    currentName,
    discussionDraft,
    discussionImageUri,
    discussionMode,
    discussionPost,
    displayName,
    isSendingDiscussion,
  ]);

  const sharePost = useCallback(async (post: ProfilePost) => {
    const message = [post.authorName, post.text, post.media?.uri].filter(Boolean).join('\n\n');
    try {
      await Share.share({ title: `${post.authorName}'s post`, message });
    } catch (error) {
      Alert.alert(
        'Share failed',
        error instanceof Error ? error.message : 'Unable to open the sharing menu.',
      );
    }
  }, []);

  const openPostOptions = useCallback((post: ProfilePost) => {
    Keyboard.dismiss();
    setPostOptionsTarget(post);
    setIsPostOptionsVisible(true);
  }, []);

  const closePostOptions = useCallback(() => {
    setIsPostOptionsVisible(false);
    setPostOptionsTarget(null);
  }, []);

  const beginEditPost = useCallback(() => {
    if (!postOptionsTarget) return;
    setPostBeingEdited(postOptionsTarget);
    setEditPostText(postOptionsTarget.text);
    setEditPostMedia(postOptionsTarget.media ? { ...postOptionsTarget.media } : null);
    setIsPostOptionsVisible(false);
    setPostOptionsTarget(null);
    setIsEditPostVisible(true);
  }, [postOptionsTarget]);

  const discardPostEdit = useCallback(() => {
    Keyboard.dismiss();
    setIsEditPostVisible(false);
    setPostBeingEdited(null);
    setEditPostText('');
    setEditPostMedia(null);
    setIsSavingPostEdit(false);
  }, []);

  const savePostEdit = useCallback(() => {
    if (!postBeingEdited || isSavingPostEdit) return;
    if (!editPostText.trim() && !editPostMedia?.uri) {
      Alert.alert('Empty post', 'Add text or media before saving this post.');
      return;
    }

    setIsSavingPostEdit(true);
    const updated: ProfilePost = {
      ...postBeingEdited,
      text: editPostText.trim(),
      media: editPostMedia?.uri ? { ...editPostMedia } : null,
    };
    setPosts(previous => previous.map(post => (post.id === updated.id ? updated : post)));
    setSelectedPost(previous => (previous?.id === updated.id ? updated : previous));
    setPostBeingEdited(null);
    setEditPostText('');
    setEditPostMedia(null);
    setIsEditPostVisible(false);
    setIsSavingPostEdit(false);
    Keyboard.dismiss();
    showToast('Post updated on this device');
  }, [editPostMedia, editPostText, isSavingPostEdit, postBeingEdited, showToast]);

  const deletePost = useCallback(() => {
    if (!postOptionsTarget) return;
    const target = postOptionsTarget;
    setIsPostOptionsVisible(false);
    Alert.alert('Delete post?', 'This post and its local comments and challenges will be removed.', [
      { text: 'Cancel', style: 'cancel', onPress: () => setPostOptionsTarget(null) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setPosts(previous => previous.filter(post => post.id !== target.id));
          setCommentsByPost(previous => {
            const next = { ...previous };
            delete next[target.id];
            return next;
          });
          setChallengesByPost(previous => {
            const next = { ...previous };
            delete next[target.id];
            return next;
          });
          setSelectedPost(previous => {
            if (previous?.id === target.id) {
              setIsPostViewerVisible(false);
              return null;
            }
            return previous;
          });
          setPostOptionsTarget(null);
          showToast('Post deleted from this device');
        },
      },
    ]);
  }, [postOptionsTarget, showToast]);

  const createPost = useCallback(() => {
    const newPost: ProfilePost = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      authorName: displayName.trim() || currentName,
      authorAvatar: avatarUrl || currentAvatar,
      text: '',
      media: null,
      createdAt: 'Just now',
    };
    setPostBeingEdited(newPost);
    setEditPostText('');
    setEditPostMedia(null);
    setIsEditPostVisible(true);
  }, [avatarUrl, currentAvatar, currentName, displayName]);

  const renderMedia = (media?: PostMedia | null, full = false) => {
    if (!media?.uri) return null;
    if (media.type === 'video' || isVideoUri(media.uri)) {
      return (
        <Video
          source={{ uri: media.uri }}
          style={full ? styles.viewerMedia : styles.postMedia}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={false}
          isLooping={false}
        />
      );
    }
    return (
      <Image
        source={{ uri: media.uri }}
        style={full ? styles.viewerMedia : styles.postMedia}
        resizeMode="cover"
      />
    );
  };

  const renderDiscussionItem = (item: PostComment) => (
    <View key={item.id} style={styles.commentRow}>
      <Image source={{ uri: item.authorAvatar || FALLBACK_AVATAR }} style={styles.commentAvatar} />
      <View style={styles.commentBody}>
        <View style={styles.commentBubble}>
          <Text style={styles.commentAuthor}>{item.authorName}</Text>
          {!!item.text && <Text style={styles.commentText}>{item.text}</Text>}
          {!!item.imageUri && (
            <Image
              source={{ uri: item.imageUri }}
              style={styles.commentAttachment}
              resizeMode="cover"
            />
          )}
        </View>
        <Text style={styles.commentTimestamp}>
          {new Date(item.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );

  const renderPostCard = (post: ProfilePost) => {
    const commentCount = (commentsByPost[post.id] || []).length;
    const challengeCount = (challengesByPost[post.id] || []).length;
    return (
      <View key={post.id} style={styles.postCard}>
        <TouchableOpacity
          activeOpacity={0.94}
          onPress={() => openPost(post)}
          accessibilityRole="button"
          accessibilityLabel={`Open post by ${post.authorName}`}
        >
          <View style={styles.postCardHeader}>
            <Image
              source={{ uri: post.authorAvatar || FALLBACK_AVATAR }}
              style={styles.postAvatar}
            />
            <View style={styles.postHeaderTexts}>
              <Text style={styles.postAuthorName}>{post.authorName}</Text>
              <Text style={styles.postTimeText}>{post.createdAt}</Text>
            </View>
            <TouchableOpacity
              onPress={() => openPostOptions(post)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Post options"
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {!!post.text && (
            <Text style={styles.postText} numberOfLines={5}>
              {post.text}
            </Text>
          )}
          {renderMedia(post.media)}
        </TouchableOpacity>
        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.postAction}
            onPress={() => openDiscussion(post, 'comment')}
            accessibilityRole="button"
            accessibilityLabel="Comment on post"
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
            <Text style={styles.postActionText}>
              Comment{commentCount ? ` ${commentCount}` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.postAction}
            onPress={() => sharePost(post)}
            accessibilityRole="button"
            accessibilityLabel="Share post"
          >
            <Ionicons name="share-social-outline" size={20} color={colors.primary} />
            <Text style={styles.postActionText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.postAction}
            onPress={() => openDiscussion(post, 'challenge')}
            accessibilityRole="button"
            accessibilityLabel="Open challenges for post"
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.postActionText}>
              Challenge{challengeCount ? ` ${challengeCount}` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.bannerContainer}>
          <Image source={{ uri: bannerUrl || FALLBACK_COVER }} style={styles.bannerImage} />
        </View>

        <View style={styles.profileHeaderContainer}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: avatarUrl || FALLBACK_AVATAR }} style={styles.avatarImage} />
            </View>
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => (isEditing ? handleSaveProfile() : setIsEditing(true))}
            >
              <Text style={styles.editProfileButtonText}>
                {isEditing ? 'Save profile' : 'Edit profile'}
              </Text>
            </TouchableOpacity>
          </View>

          {isEditing ? (
            <View style={styles.editFormContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput style={styles.inputField} value={displayName} onChangeText={setDisplayName} placeholder="Full name" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.inputLabel}>Institution</Text>
              <TextInput style={styles.inputField} value={institution} onChangeText={setInstitution} placeholder="Institution" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.inputLabel}>Course</Text>
              <TextInput style={styles.inputField} value={course} onChangeText={setCourse} placeholder="Course" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.inputLabel}>Level of Study</Text>
              <TextInput style={styles.inputField} value={levelOfStudy} onChangeText={setLevelOfStudy} placeholder="Level of study" placeholderTextColor={colors.textSecondary} />
              
              <Text style={styles.inputLabel}>Profile Picture</Text>
              <TouchableOpacity style={[styles.inputField, { justifyContent: 'center' }]} onPress={() => pickImage(setAvatarUrl)}>
                <Text style={{ color: avatarUrl && avatarUrl !== FALLBACK_AVATAR ? colors.textPrimary : colors.textSecondary }}>
                  {avatarUrl && avatarUrl !== FALLBACK_AVATAR ? 'Image selected (tap to change)' : 'Tap to select profile picture'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Cover Banner Image</Text>
              <TouchableOpacity style={[styles.inputField, { justifyContent: 'center' }]} onPress={() => pickImage(setBannerUrl)}>
                <Text style={{ color: bannerUrl && bannerUrl !== FALLBACK_COVER ? colors.textPrimary : colors.textSecondary }}>
                  {bannerUrl && bannerUrl !== FALLBACK_COVER ? 'Banner selected (tap to change)' : 'Tap to select cover banner'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.userDetails}>
              <Text style={styles.displayName}>{displayName}</Text>
              <Text style={styles.institution}>{institution}</Text>
              <Text style={styles.courseLevel}>{course}, {levelOfStudy}</Text>
              <TouchableOpacity
                style={styles.quoteBox}
                onPress={() => {
                  setTempQuote(quote);
                  setIsQuoteModalVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Edit quote of the day"
              >
                <Text style={styles.quoteText}>“{quote}”</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.sliderWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sliderContent}>
            {eventImages.map(item => (
              <Image key={item.id} source={{ uri: item.uri }} style={styles.sliderImageCard} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.tabsHeaderBar}>
          {(['Posts', 'Media', 'Events', 'Search'] as ProfileTab[]).map(tab => (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabButton}>
              <Text style={[styles.tabTitle, activeTab === tab && styles.activeTabTitle]}>{tab}</Text>
              {tab === 'Search' && (
                <Ionicons name="search" size={15} color={colors.primary} style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'Posts' && <View style={styles.fullWidthTabArea}>{posts.map(renderPostCard)}</View>}
        {activeTab === 'Media' && (
          <View style={styles.mediaGridContainer}>
            {posts.filter(post => post.media?.uri).map(post => (
              <TouchableOpacity key={post.id} onPress={() => openPost(post)}>
                {post.media && (
                  <Image source={{ uri: post.media.uri }} style={styles.gridMediaItem} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
        {activeTab === 'Events' && (
          <View style={styles.eventsTabContainer}>
            <Text style={styles.sectionHeaderTitle}>Upcoming Campus Events</Text>
            {eventImages.map((event, index) => (
              <View key={event.id} style={styles.eventListItem}>
                <Image source={{ uri: event.uri }} style={styles.eventThumb} />
                <View style={styles.eventDetailsBox}>
                  <Text style={styles.eventTitleText}>Tech Innovation Summit 2026 #{index + 1}</Text>
                  <Text style={styles.eventSubText}>Auditorium Hall A • 10:00 AM</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        {activeTab === 'Search' && (
          <View style={styles.searchTabContainer}>
            <TextInput
              style={styles.searchInputBar}
              placeholder="Search posts, events, media..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Text style={styles.searchPlaceholderText}>
              {searchQuery
                ? `Results for “${searchQuery}” are not connected to server search yet.`
                : 'Type something to search profile content.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {activeTab === 'Posts' && (
        <TouchableOpacity
          style={styles.floatingAddButton}
          onPress={createPost}
          accessibilityRole="button"
          accessibilityLabel="Create a post"
        >
          <Ionicons name="add" size={30} color={colors.white} />
        </TouchableOpacity>
      )}

      <Modal
        visible={isPostViewerVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closePostViewer}
      >
        <View style={styles.viewerRoot}>
          <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
          <View style={styles.viewerHeader}>
            <TouchableOpacity onPress={closePostViewer} style={styles.headerIconButton} accessibilityRole="button" accessibilityLabel="Close post">
              <Ionicons name="arrow-back" size={25} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.viewerTitle}>Post</Text>
            <View style={styles.headerIconButton} />
          </View>
          {selectedPost && (
            <ScrollView style={styles.viewerScroll} contentContainerStyle={styles.viewerScrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.viewerAuthorRow}>
                <Image source={{ uri: selectedPost.authorAvatar || FALLBACK_AVATAR }} style={styles.viewerAvatar} />
                <View style={styles.postHeaderTexts}>
                  <Text style={styles.viewerAuthorName}>{selectedPost.authorName}</Text>
                  <Text style={styles.postTimeText}>{selectedPost.createdAt}</Text>
                </View>
                <TouchableOpacity onPress={() => openPostOptions(selectedPost)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Post options">
                  <Ionicons name="ellipsis-horizontal" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {!!selectedPost.text && <Text style={styles.viewerPostText}>{selectedPost.text}</Text>}
              {selectedPost.media && renderMedia(selectedPost.media, true)}
              {!selectedPost.text && !selectedPost.media && <Text style={styles.emptyPostText}>This post has no text or media.</Text>}
              <View style={styles.viewerActionRow}>
                <TouchableOpacity style={styles.viewerAction} onPress={() => openDiscussion(selectedPost, 'comment')}>
                  <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
                  <Text style={styles.postActionText}>Comment {(commentsByPost[selectedPost.id] || []).length || ''}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.viewerAction} onPress={() => sharePost(selectedPost)}>
                  <Ionicons name="share-social-outline" size={20} color={colors.primary} />
                  <Text style={styles.postActionText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.viewerAction} onPress={() => openDiscussion(selectedPost, 'challenge')}>
                  <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.postActionText}>Challenge</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.commentsSectionHeader}>
                <Text style={styles.commentsSectionTitle}>Comments</Text>
                <TouchableOpacity onPress={() => openDiscussion(selectedPost, 'comment')}>
                  <Text style={styles.viewAllComments}>Add a comment</Text>
                </TouchableOpacity>
              </View>
              {selectedPostComments.length ? selectedPostComments.map(renderDiscussionItem) : (
                <View style={styles.emptyComments}>
                  <Ionicons name="chatbubbles-outline" size={28} color={colors.textSecondary} />
                  <Text style={styles.emptyCommentsTitle}>No comments yet</Text>
                  <Text style={styles.emptyCommentsText}>Start the conversation.</Text>
                </View>
              )}
              <TouchableOpacity style={styles.viewerCommentButton} onPress={() => openDiscussion(selectedPost, 'comment')}>
                <Image source={{ uri: avatarUrl || FALLBACK_AVATAR }} style={styles.smallCurrentAvatar} />
                <Text style={styles.viewerCommentPlaceholder}>Write a comment…</Text>
                <Ionicons name="send" size={18} color={colors.primary} />
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>

      <Modal
        visible={isDiscussionVisible}
        transparent
        animationType="slide"
        onRequestClose={closeDiscussion}
        statusBarTranslucent
        navigationBarTranslucent={Platform.OS === 'android'}
        hardwareAccelerated
      >
        <View style={styles.commentsOverlay}>
          <TouchableOpacity style={styles.overlayDismissArea} activeOpacity={1} onPress={closeDiscussion} accessibilityLabel="Close discussion" />
          <KeyboardAvoidingView
            style={[
              styles.commentsKeyboardFrame,
              isKeyboardVisible && styles.commentsKeyboardFrameOpen,
            ]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.commentsSheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.commentsSheetHeader}>
                <Text style={styles.commentsSheetTitle}>
                  {discussionMode === 'comment' ? 'Comments' : 'Challenges'}
                </Text>
                <Text style={styles.commentsCount}>{discussionItems.length}</Text>
                <TouchableOpacity onPress={closeDiscussion} style={styles.closeSheetButton} accessibilityRole="button" accessibilityLabel="Close discussion">
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.commentsList}
                contentContainerStyle={styles.commentsListContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {discussionItems.length ? discussionItems.map(renderDiscussionItem) : (
                  <View style={styles.emptyComments}>
                    <Ionicons
                      name={discussionMode === 'comment' ? 'chatbubbles-outline' : 'help-circle-outline'}
                      size={30}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.emptyCommentsTitle}>
                      {discussionMode === 'comment' ? 'Be the first to comment' : 'Start the challenge'}
                    </Text>
                    <Text style={styles.emptyCommentsText}>
                      {discussionMode === 'comment'
                        ? 'Keep the conversation respectful and helpful.'
                        : 'Share a question, challenge, or idea related to this post.'}
                    </Text>
                  </View>
                )}
              </ScrollView>
              {discussionImageUri && (
                <View style={styles.attachmentPreviewRow}>
                  <Image source={{ uri: discussionImageUri }} style={styles.attachmentPreview} />
                  <TouchableOpacity onPress={() => setDiscussionImageUri(null)} style={styles.removeAttachmentButton} accessibilityRole="button" accessibilityLabel="Remove attached image">
                    <Ionicons name="close-circle" size={23} color="#D32F2F" />
                  </TouchableOpacity>
                </View>
              )}
              <View style={[styles.commentComposer, { paddingBottom: isKeyboardVisible ? (Platform.OS === 'ios' ? 12 : 12 + keyboardHeight) : (Platform.OS === 'android' ? 50 : 34) }]}>
                <TouchableOpacity
                  style={styles.pickImageButton}
                  onPress={() => pickImage(setDiscussionImageUri)}
                  accessibilityRole="button"
                  accessibilityLabel="Attach image"
                >
                  <Ionicons name="image-outline" size={25} color={colors.primary} />
                </TouchableOpacity>
                <TextInput
                  ref={discussionInputRef}
                  style={styles.commentInput}
                  value={discussionDraft}
                  onChangeText={setDiscussionDraft}
                  placeholder={discussionMode === 'comment' ? 'Write a comment…' : 'Write a challenge…'}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={2000}
                  returnKeyType="default"
                  blurOnSubmit={false}
                  accessibilityLabel={discussionMode === 'comment' ? 'Comment text' : 'Challenge text'}
                />
                <TouchableOpacity
                  style={[
                    styles.sendCommentButton,
                    (!discussionDraft.trim() && !discussionImageUri) && styles.sendCommentButtonDisabled,
                  ]}
                  onPress={sendDiscussionItem}
                  disabled={(!discussionDraft.trim() && !discussionImageUri) || isSendingDiscussion}
                  accessibilityRole="button"
                  accessibilityLabel={discussionMode === 'comment' ? 'Send comment' : 'Send challenge'}
                >
                  <Ionicons name="arrow-forward" size={20} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={isPostOptionsVisible}
        transparent
        animationType="slide"
        onRequestClose={closePostOptions}
        statusBarTranslucent
        navigationBarTranslucent={Platform.OS === 'android'}
      >
        <View style={styles.optionsOverlay}>
          <TouchableOpacity style={styles.optionsDismissArea} activeOpacity={1} onPress={closePostOptions} />
          <View style={styles.optionsSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.optionsTitle}>Post options</Text>
            <TouchableOpacity style={styles.optionRow} onPress={beginEditPost} accessibilityRole="button">
              <Ionicons name="create-outline" size={21} color={colors.textPrimary} />
              <Text style={styles.optionText}>Edit post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionRow} onPress={deletePost} accessibilityRole="button">
              <Ionicons name="trash-outline" size={21} color="#D32F2F" />
              <Text style={styles.deleteOptionText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionsCancelButton} onPress={closePostOptions}>
              <Text style={styles.optionsCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isEditPostVisible}
        animationType="slide"
        onRequestClose={discardPostEdit}
        statusBarTranslucent
        navigationBarTranslucent={Platform.OS === 'android'}
      >
        <KeyboardAvoidingView
          style={styles.editModalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={discardPostEdit} style={styles.headerIconButton} accessibilityRole="button" accessibilityLabel="Close editor">
              <Ionicons name="close" size={25} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>{postBeingEdited && posts.some(p => p.id === postBeingEdited.id) ? 'Edit post' : 'Create post'}</Text>
            <View style={styles.headerIconButton} />
          </View>
          <ScrollView
            style={styles.editModalScroll}
            contentContainerStyle={styles.editModalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.challengeAuthorRow}>
              <Image source={{ uri: avatarUrl || FALLBACK_AVATAR }} style={styles.smallCurrentAvatar} />
              <Text style={styles.challengeAuthorName}>{displayName || currentName}</Text>
            </View>
            <TextInput
              style={styles.editPostInput}
              value={editPostText}
              onChangeText={setEditPostText}
              placeholder="What would you like to share?"
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={5000}
              textAlignVertical="top"
              accessibilityLabel="Edit post text"
            />
            {editPostMedia?.uri ? (
              <View style={styles.editMediaWrap}>
                {editPostMedia.type === 'video' || isVideoUri(editPostMedia.uri) ? (
                  <Video
                    source={{ uri: editPostMedia.uri }}
                    style={styles.editMediaPreview}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={false}
                  />
                ) : (
                  <Image source={{ uri: editPostMedia.uri }} style={styles.editMediaPreview} resizeMode="cover" />
                )}
                <TouchableOpacity
                  style={styles.removeEditMediaButton}
                  onPress={() => setEditPostMedia(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove post media"
                >
                  <Ionicons name="close-circle" size={27} color="#D32F2F" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addEditMediaButton}
                onPress={() => pickImage(uri => setEditPostMedia({ uri, type: 'image' }))}
                accessibilityRole="button"
                accessibilityLabel="Add image to post"
              >
                <Ionicons name="image-outline" size={22} color={colors.primary} />
                <Text style={styles.addEditMediaText}>Add photo</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          <View style={[styles.editModalActions, { paddingBottom: isKeyboardVisible ? (Platform.OS === 'ios' ? 12 : 12 + keyboardHeight) : (Platform.OS === 'android' ? 50 : 34) }]}>
            <TouchableOpacity style={styles.discardButton} onPress={discardPostEdit} disabled={isSavingPostEdit}>
              <Text style={styles.discardButtonText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveEditButton, isSavingPostEdit && styles.disabledButton]}
              onPress={() => {
                if (postBeingEdited && posts.some(post => post.id === postBeingEdited.id)) {
                  savePostEdit();
                } else if (postBeingEdited) {
                  const text = editPostText.trim();
                  if (!text && !editPostMedia?.uri) {
                    Alert.alert('Empty post', 'Write something or attach an image before posting.');
                    return;
                  }
                  const newPost: ProfilePost = {
                    ...postBeingEdited,
                    text,
                    media: editPostMedia?.uri ? { ...editPostMedia } : null,
                    createdAt: 'Just now',
                  };
                  setPosts(previous => [newPost, ...previous]);
                  setIsEditPostVisible(false);
                  setPostBeingEdited(null);
                  setEditPostText('');
                  setEditPostMedia(null);
                  setActiveTab('Posts');
                  Keyboard.dismiss();
                  showToast('Post added on this device');
                }
              }}
              disabled={isSavingPostEdit}
            >
              <Text style={styles.saveEditButtonText}>
                {postBeingEdited && posts.some(post => post.id === postBeingEdited.id) ? 'Edit' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={isQuoteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsQuoteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Quote of the Day</Text>
            <TextInput
              style={styles.modalTextInput}
              value={tempQuote}
              onChangeText={setTempQuote}
              multiline
              numberOfLines={3}
              placeholder="Enter your quote…"
              placeholderTextColor={colors.textSecondary}
              maxLength={180}
            />
            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelModalButton]} onPress={() => setIsQuoteModalVisible(false)}>
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveModalButton]} onPress={handleSaveQuote}>
                <Text style={styles.saveModalButtonText}>Save Quote</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {toastMessage && (
        <View style={styles.toastContainer} accessibilityLiveRegion="polite">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  contentContainer: { paddingBottom: 110 },
  bannerContainer: { width: '100%', height: 180, backgroundColor: colors.surfaceLight },
  bannerImage: { width: '100%', height: '100%' },
  profileHeaderContainer: { paddingHorizontal: 16, marginBottom: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -40, marginBottom: 8 },
  avatarContainer: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  avatarImage: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: colors.surface, backgroundColor: colors.primary },
  editProfileButton: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  editProfileButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  userDetails: { marginTop: 4 },
  displayName: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  institution: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 2 },
  courseLevel: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  quoteBox: { marginTop: 8, backgroundColor: 'rgba(0, 128, 96, 0.08)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: colors.primary },
  quoteText: { fontSize: 13, fontStyle: 'italic', color: colors.primary, fontWeight: '600' },
  editFormContainer: { marginTop: 12 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  inputField: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.textPrimary, marginBottom: 10 },
  sliderWrapper: { marginBottom: 16 },
  sliderContent: { paddingHorizontal: 16 },
  sliderImageCard: { width: 120, height: 90, borderRadius: 10, marginRight: 10, backgroundColor: colors.surfaceLight },
  tabsHeaderBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 12 },
  tabButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 3 },
  tabTitle: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  activeTabTitle: { color: colors.primary, fontWeight: '800' },
  fullWidthTabArea: { width: '100%' },
  postCard: { width: '100%', backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginBottom: 14 },
  postCardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 13, paddingBottom: 9 },
  postAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10, backgroundColor: colors.surfaceLight },
  postHeaderTexts: { flex: 1, minWidth: 0 },
  postAuthorName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  postTimeText: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  postText: { fontSize: 15, lineHeight: 22, color: colors.textPrimary, paddingHorizontal: 14, paddingBottom: 12 },
  postMedia: { width: '100%', height: Math.min(WINDOW_WIDTH * 0.85, 420), backgroundColor: colors.surfaceLight },
  postActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 13, paddingHorizontal: 5, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 2 },
  postAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 5, minWidth: 85, gap: 6 },
  postActionText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  floatingAddButton: { position: 'absolute', bottom: Platform.OS === 'android' ? 70 : 55, right: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
  mediaGridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  gridMediaItem: { width: (WINDOW_WIDTH - 36) / 3, height: (WINDOW_WIDTH - 36) / 3, margin: 2, borderRadius: 8, backgroundColor: colors.surfaceLight },
  eventsTabContainer: { paddingHorizontal: 16 },
  sectionHeaderTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  eventListItem: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 8, marginBottom: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  eventThumb: { width: 60, height: 60, borderRadius: 6, backgroundColor: colors.surfaceLight, marginRight: 12 },
  eventDetailsBox: { flex: 1 },
  eventTitleText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  eventSubText: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  searchTabContainer: { paddingHorizontal: 16 },
  searchInputBar: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.textPrimary, marginBottom: 12 },
  searchPlaceholderText: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  viewerRoot: { flex: 1, backgroundColor: colors.background },
  viewerHeader: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
  headerIconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  viewerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  viewerScroll: { flex: 1 },
  viewerScrollContent: { paddingBottom: 32 },
  viewerAuthorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  viewerAvatar: { width: 46, height: 46, borderRadius: 23, marginRight: 11, backgroundColor: colors.surfaceLight },
  viewerAuthorName: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  viewerPostText: { color: colors.textPrimary, fontSize: 16, lineHeight: 24, paddingHorizontal: 16, paddingBottom: 15 },
  viewerMedia: { width: '100%', height: Math.min(WINDOW_HEIGHT * 0.58, 620), backgroundColor: '#101510' },
  emptyPostText: { color: colors.textSecondary, fontSize: 14, paddingHorizontal: 16, paddingVertical: 22 },
  viewerActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 14, borderBottomWidth: 1, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  viewerAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4 },
  commentsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  commentsSectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  viewAllComments: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, marginBottom: 14 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 9, backgroundColor: colors.surfaceLight },
  commentBody: { flex: 1, alignItems: 'flex-start' },
  commentBubble: { maxWidth: '100%', backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: colors.border },
  commentAuthor: { color: colors.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 3 },
  commentText: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  commentAttachment: { width: Math.min(WINDOW_WIDTH * 0.56, 240), height: 150, borderRadius: 10, marginTop: 7, backgroundColor: colors.surfaceLight },
  commentTimestamp: { color: colors.textSecondary, fontSize: 10, marginTop: 4, marginLeft: 8 },
  emptyComments: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 30 },
  emptyCommentsTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  emptyCommentsText: { color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  viewerCommentButton: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginTop: 12, padding: 10, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  smallCurrentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceLight },
  viewerCommentPlaceholder: { flex: 1, color: colors.textSecondary, fontSize: 14 },
  commentsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  overlayDismissArea: { flex: 1 },
  commentsKeyboardFrame: { width: '100%', maxHeight: '82%', flexShrink: 1 },
  commentsKeyboardFrameOpen: { maxHeight: '100%' },
  commentsSheet: { height: Math.min(WINDOW_HEIGHT * 0.76, 760), minHeight: WINDOW_HEIGHT * 0.5, backgroundColor: colors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 9, marginBottom: 6 },
  commentsSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  commentsSheetTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  commentsCount: { color: colors.textSecondary, fontSize: 13, marginLeft: 7 },
  closeSheetButton: { position: 'absolute', right: 12, top: 7, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  commentsList: { flex: 1, minHeight: 0 },
  commentsListContent: { paddingTop: 14, paddingBottom: 16, flexGrow: 1 },
  attachmentPreviewRow: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2, flexDirection: 'row', alignItems: 'flex-start' },
  attachmentPreview: { width: 68, height: 68, borderRadius: 9, backgroundColor: colors.surfaceLight },
  removeAttachmentButton: { marginLeft: -12, marginTop: -7, backgroundColor: colors.background, borderRadius: 12 },
  commentComposer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, gap: 8 },
  pickImageButton: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  commentInput: { flex: 1, maxHeight: 112, minHeight: 42, paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 11 : 9, paddingBottom: 9, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.textPrimary, fontSize: 14, lineHeight: 19 },
  sendCommentButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendCommentButtonDisabled: { opacity: 0.42 },
  optionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  optionsDismissArea: { flex: 1 },
  optionsSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingBottom: Platform.OS === 'android' ? 50 : 34 },
  optionsTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', paddingVertical: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  optionText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  deleteOptionText: { fontSize: 15, fontWeight: '700', color: '#D32F2F' },
  optionsCancelButton: { alignItems: 'center', paddingVertical: 13, marginTop: 4, borderRadius: 10, backgroundColor: colors.background },
  optionsCancelText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  editModalRoot: { flex: 1, backgroundColor: colors.background },
  editModalHeader: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
  editModalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  editModalScroll: { flex: 1 },
  editModalContent: { padding: 16, paddingBottom: 28 },
  editPostInput: { minHeight: 160, maxHeight: 320, textAlignVertical: 'top', color: colors.textPrimary, fontSize: 16, lineHeight: 23, padding: 13, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  editMediaWrap: { marginTop: 14, position: 'relative' },
  editMediaPreview: { width: '100%', height: 240, borderRadius: 12, backgroundColor: colors.surfaceLight },
  removeEditMediaButton: { position: 'absolute', top: 7, right: 7, backgroundColor: colors.surface, borderRadius: 15 },
  addEditMediaButton: { flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 12, marginTop: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface },
  addEditMediaText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  editModalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  discardButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 30, backgroundColor: colors.surfaceLight },
  discardButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: '800' },
  saveEditButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 30, backgroundColor: colors.primary },
  saveEditButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.5 },
  challengeAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  challengeAuthorName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalContent: { width: '100%', backgroundColor: colors.surface, borderRadius: 12, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  modalTextInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 14, color: colors.textPrimary, textAlignVertical: 'top', minHeight: 80, marginBottom: 16 },
  modalActionsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalButton: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, marginLeft: 8 },
  cancelModalButton: { backgroundColor: colors.surfaceLight },
  cancelModalButtonText: { color: colors.textSecondary, fontWeight: '700' },
  saveModalButton: { backgroundColor: colors.primary },
  saveModalButtonText: { color: colors.white, fontWeight: '700' },
  toastContainer: { position: 'absolute', bottom: 12, left: 20, right: 20, backgroundColor: 'rgba(30,30,30,0.92)', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  toastText: { color: colors.white, fontSize: 13, fontWeight: '600' },
});
