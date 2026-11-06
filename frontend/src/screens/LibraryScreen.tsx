import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Modal,
  ScrollView,
  PanResponder,
  Platform,
  RefreshControl,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
  ListRenderItem,
} from 'react-native';

import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Brightness from 'expo-brightness';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';

import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const colors = {
  primary: '#1B5E20',
  textPrimary: '#1A3320',
  textSecondary: '#5A755E',
  background: '#EAF4EC',
  danger: '#D32F2F',
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } =
  Dimensions.get('window');

const PRIMARY_COLOR = colors.primary;

const FALLBACK_VIDEO_URI =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

const FULLSCREEN_AUTO_HIDE_DELAY = 5000;
const DOUBLE_TAP_DELAY = 300;
const SEEK_INTERVAL_MS = 10000;
const EDGE_GESTURE_THRESHOLD = 40;

export interface LibraryItem {
  id: string;
  title: string;
  author: string;
  image: string;
  avatar: string;
  fileUrl: any;
  type: 'document' | 'video';
  description: string;
  references?: string[];
}

export interface CommentItem {
  id: string;
  author: string;
  avatar: string;
  text: string;
  image?: string | null;
  isOwn?: boolean;
  replies?: CommentItem[];
}

const INITIAL_LIBRARY_ITEMS: Record<string, LibraryItem[]> = {
  Documents: [
    {
      id: '1',
      title: 'Digital Communication',
      author: 'Chris Mayo',
      image:
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      fileUrl:
        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      type: 'document',
      description:
        'An in-depth guide exploring modern digital communication protocols, network architecture, and effective data transfer mechanisms in enterprise environments.',
      references: [
        'Tanenbaum, A. S. - Computer Networks (5th Edition)',
        'IEEE Xplore Digital Library Protocol Standards',
      ],
    },
    {
      id: '2',
      title: 'Learn Java Programming',
      author: 'Anthony Ndiema',
      image:
        'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      fileUrl:
        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      type: 'document',
      description:
        'Master Object-Oriented Programming principles, robust data structures, and enterprise backend application development using Java.',
      references: [
        'Bloch, Joshua - Effective Java (3rd Edition)',
        'Oracle Java SE Documentation & Guidelines',
      ],
    },
  ],

  Media: [
    {
      id: 'm1',
      title: 'Introduction to Mobile Apps',
      author: 'Chris Mayo',
      image:
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      fileUrl: FALLBACK_VIDEO_URI,
      type: 'video',
      description:
        'A comprehensive video overview introducing the foundational lifecycle, UI design principles, and deployment workflows for mobile applications.',
      references: [
        'Mobile App Development Lifecycle Overview - ACM',
      ],
    },
    {
      id: 'm2',
      title: 'Advanced JavaScript Video Tutorial',
      author: 'Anthony Ndiema',
      image:
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      fileUrl: FALLBACK_VIDEO_URI,
      type: 'video',
      description:
        'Deep dive into closures, asynchronous JavaScript, event loops, prototypal inheritance, and performance optimization techniques.',
      references: [
        "You Don't Know JS Yet - Kyle Simpson",
        'MDN Web Docs - JavaScript Mechanics',
      ],
    },
  ],
};

const INITIAL_COMMENTS: Record<string, CommentItem[]> = {
  '1': [
    {
      id: 'c1',
      author: 'You',
      avatar:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      text:
        'This document really helped me understand protocol layers!',
      isOwn: true,
      replies: [],
    },
  ],
};

const isVideoFile = (
  nameOrUri: string,
  mimeType = ''
) =>
  mimeType.startsWith('video/') ||
  /\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i.test(nameOrUri);

const isMediaFile = (
  nameOrUri: string,
  mimeType = ''
) =>
  mimeType.startsWith('video/') ||
  mimeType.startsWith('image/') ||
  /\.(mp4|mov|avi|mkv|wmv|flv|webm|jpg|jpeg|png|gif)$/i.test(
    nameOrUri
  );

const updateCommentTree = (
  comments: CommentItem[],
  id: string,
  updater: (
    comment: CommentItem
  ) => CommentItem | null
): CommentItem[] => {
  const result: CommentItem[] = [];

  for (const comment of comments) {
    if (comment.id === id) {
      const updated = updater(comment);

      if (updated) {
        result.push(updated);
      }

      continue;
    }

    const replies = comment.replies || [];

    const updatedReplies = updateCommentTree(
      replies,
      id,
      updater
    );

    result.push({
      ...comment,
      replies: updatedReplies,
    });
  }

  return result;
};

const findCommentInTree = (
  comments: CommentItem[],
  id: string
): CommentItem | null => {
  for (const comment of comments) {
    if (comment.id === id) {
      return comment;
    }

    const found = findCommentInTree(
      comment.replies || [],
      id
    );

    if (found) {
      return found;
    }
  }

  return null;
};

export default function LibraryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const {
    width: windowWidth,
    height: windowHeight,
  } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<
    'Documents' | 'Media'
  >('Documents');

  const [libraryData, setLibraryData] =
    useState<Record<string, LibraryItem[]>>(
      INITIAL_LIBRARY_ITEMS
    );

  const [searchQuery, setSearchQuery] =
    useState('');

  const [submittedQuery, setSubmittedQuery] =
    useState('');

  const [isSearching, setIsSearching] =
    useState(false);

  const [selectedItem, setSelectedItem] =
    useState<LibraryItem | null>(null);

  const [refreshing, setRefreshing] =
    useState(false);

  const [downloadMessage, setDownloadMessage] =
    useState('');

  /*
   * ---------------------------------------------------------
   * VIDEO STATE
   * ---------------------------------------------------------
   */

  const videoRef = useRef<Video>(null);

  const [isPlaying, setIsPlaying] =
    useState(true);

  const [isMuted, setIsMuted] =
    useState(false);

  const [isFullscreen, setIsFullscreen] =
    useState(false);

  const [showControls, setShowControls] =
    useState(true);

  const [videoFinished, setVideoFinished] =
    useState(false);

  const [playbackPosition, setPlaybackPosition] =
    useState(0);

  const [playbackDuration, setPlaybackDuration] =
    useState(1);

  const [volume, setVolume] =
    useState(1);

  const [brightnessVal, setBrightnessVal] =
    useState(0.5);

  const [gestureOverlayText, setGestureOverlayText] =
    useState<string | null>(null);

  const [systemBarsHidden, setSystemBarsHidden] =
    useState(false);

  const brightnessRef =
    useRef(0.5);

  const volumeRef =
    useRef(1);

  const touchStartY =
    useRef(0);

  const touchStartX =
    useRef(0);

  const gestureSide =
    useRef<'left' | 'right' | null>(null);

  const edgeGestureActive =
    useRef(false);

  const fullscreenChromeTimer =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const lastTapTime =
    useRef(0);

  const lastTapX =
    useRef(0);

  const doubleTapTimeout =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const progressBarWidth =
    useRef(0);

  const searchAnimation =
    useSharedValue(0);

  /*
   * ---------------------------------------------------------
   * CREATE RESOURCE STATE
   * ---------------------------------------------------------
   */

  const [isCreateModalVisible, setIsCreateModalVisible] =
    useState(false);

  const [newTitle, setNewTitle] =
    useState('');

  const [newDescription, setNewDescription] =
    useState('');

  const [newThumbnail, setNewThumbnail] =
    useState<string | null>(null);

  const [newResourceFile, setNewResourceFile] =
    useState<any>(null);

  const [newReferences, setNewReferences] =
    useState<string[]>([]);

  const [currentReferenceInput, setCurrentReferenceInput] =
    useState('');

  /*
   * ---------------------------------------------------------
   * COMMENT STATE
   * ---------------------------------------------------------
   */

  const [isCommentModalVisible, setIsCommentModalVisible] =
    useState(false);

  const [activeCommentItemId, setActiveCommentItemId] =
    useState<string | null>(null);

  const [commentsMap, setCommentsMap] =
    useState<Record<string, CommentItem[]>>(
      INITIAL_COMMENTS
    );

  const [commentText, setCommentText] =
    useState('');

  const [attachedCommentImage, setAttachedCommentImage] =
    useState<string | null>(null);

  const [editingCommentId, setEditingCommentId] =
    useState<string | null>(null);

  const [replyingToCommentId, setReplyingToCommentId] =
    useState<string | null>(null);

  const [optionsModalVisible, setOptionsModalVisible] =
    useState(false);

  const [selectedCommentForOptions, setSelectedCommentForOptions] =
    useState<CommentItem | null>(null);

  const [isOwnCommentSelected, setIsOwnCommentSelected] =
    useState(false);

  /*
   * ---------------------------------------------------------
   * COMMENT SHEET ANIMATION
   * ---------------------------------------------------------
   */

  const translateY =
    useSharedValue(SCREEN_HEIGHT);

  /*
   * Keyboard offset is deliberately separate from the
   * sheet open/close animation.
   *
   * This prevents the keyboard from covering the entry bar
   * while also avoiding the old snapping behaviour.
   */

  const keyboardTranslateY =
    useSharedValue(0);

  /*
   * ---------------------------------------------------------
   * SYSTEM BAR HELPERS
   * ---------------------------------------------------------
   */

  const clearFullscreenChromeTimer =
    useCallback(() => {
      if (fullscreenChromeTimer.current) {
        clearTimeout(
          fullscreenChromeTimer.current
        );

        fullscreenChromeTimer.current = null;
      }
    }, []);

  const hideFullscreenSystemUI =
    useCallback(() => {
      if (!isFullscreen) {
        return;
      }

      setShowControls(false);
      setSystemBarsHidden(true);

      StatusBar.setHidden(
        true,
        'fade'
      );

      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync(
          'hidden'
        ).catch(() => {});
      }
    }, [isFullscreen]);

  const showFullscreenSystemUI =
    useCallback(() => {
      if (!isFullscreen) {
        return;
      }

      clearFullscreenChromeTimer();

      setShowControls(true);
      setSystemBarsHidden(false);

      StatusBar.setHidden(
        false,
        'fade'
      );

      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync(
          'visible'
        ).catch(() => {});
      }

      fullscreenChromeTimer.current =
        setTimeout(() => {
          hideFullscreenSystemUI();
        }, FULLSCREEN_AUTO_HIDE_DELAY);
    }, [
      clearFullscreenChromeTimer,
      hideFullscreenSystemUI,
      isFullscreen,
    ]);

  /*
   * ---------------------------------------------------------
   * KEYBOARD HANDLING FOR COMMENTS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const keyboardShowSubscription =
      Keyboard.addListener(
        'keyboardDidShow',
        event => {
          if (!isCommentModalVisible) {
            return;
          }

          const keyboardHeight =
            event.endCoordinates?.height || 0;

          keyboardTranslateY.value =
            withTiming(
              -keyboardHeight,
              {
                duration: 180,
                easing: Easing.out(
                  Easing.cubic
                ),
              }
            );
        }
      );

    const keyboardHideSubscription =
      Keyboard.addListener(
        'keyboardDidHide',
        () => {
          keyboardTranslateY.value =
            withTiming(
              0,
              {
                duration: 160,
                easing: Easing.out(
                  Easing.cubic
                ),
              }
            );
        }
      );

    return () => {
      keyboardShowSubscription.remove();
      keyboardHideSubscription.remove();
    };
  }, [
    isCommentModalVisible,
    keyboardTranslateY,
  ]);

  /*
   * ---------------------------------------------------------
   * BRIGHTNESS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    let mounted = true;

    const loadBrightness = async () => {
      try {
        const { status } =
          await Brightness.requestPermissionsAsync();

        if (
          status !== 'granted' ||
          !mounted
        ) {
          return;
        }

        const current =
          await Brightness.getBrightnessAsync();

        if (
          mounted &&
          Number.isFinite(current)
        ) {
          brightnessRef.current =
            current;

          setBrightnessVal(current);
        }
      } catch {
        // Brightness is optional.
      }
    };

    loadBrightness();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * FULLSCREEN SYSTEM UI LIFECYCLE
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!isFullscreen) {
      clearFullscreenChromeTimer();

      setSystemBarsHidden(false);
      setShowControls(true);

      StatusBar.setHidden(
        false,
        'fade'
      );

      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync(
          'visible'
        ).catch(() => {});
      }

      return;
    }

    /*
     * Allow the orientation change to settle before
     * hiding the system chrome.
     */

    const timer = setTimeout(() => {
      if (Platform.OS === 'android') {
        NavigationBar.setBehaviorAsync(
          'overlay-swipe'
        ).catch(() => {});
      }

      setSystemBarsHidden(true);

      StatusBar.setHidden(
        true,
        'fade'
      );

      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync(
          'hidden'
        ).catch(() => {});
      }

      setShowControls(false);

      clearFullscreenChromeTimer();

      fullscreenChromeTimer.current =
        setTimeout(() => {
          hideFullscreenSystemUI();
        }, FULLSCREEN_AUTO_HIDE_DELAY);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [
    isFullscreen,
    clearFullscreenChromeTimer,
    hideFullscreenSystemUI,
  ]);

  /*
   * ---------------------------------------------------------
   * GENERAL CLEANUP
   * ---------------------------------------------------------
   */

  useEffect(() => {
    return () => {
      clearFullscreenChromeTimer();

      if (doubleTapTimeout.current) {
        clearTimeout(
          doubleTapTimeout.current
        );
      }

      StatusBar.setHidden(
        false,
        'none'
      );

      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync(
          'visible'
        ).catch(() => {});
      }
    };
  }, [clearFullscreenChromeTimer]);

  /*
   * ---------------------------------------------------------
   * SELECTED VIDEO RESET
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    setIsPlaying(true);
    setVideoFinished(false);
    setShowControls(true);
    setPlaybackPosition(0);
    setPlaybackDuration(1);

    return () => {
      videoRef.current
        ?.pauseAsync()
        .catch(() => {});
    };
  }, [selectedItem]);

  /*
   * ---------------------------------------------------------
   * ANDROID BACK BUTTON
   * ---------------------------------------------------------
   */

  const exitFullscreen =
    useCallback(async () => {
      try {
        clearFullscreenChromeTimer();

        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock
            .PORTRAIT_UP
        );

        setIsFullscreen(false);
        setSystemBarsHidden(false);
        setShowControls(true);

        StatusBar.setHidden(
          false,
          'fade'
        );

        if (Platform.OS === 'android') {
          NavigationBar.setVisibilityAsync(
            'visible'
          ).catch(() => {});
        }
      } catch {
        Alert.alert(
          'Fullscreen unavailable',
          'The device could not return to portrait orientation.'
        );
      }
    }, [clearFullscreenChromeTimer]);

  useEffect(() => {
    const onBackPress = () => {
      if (isFullscreen) {
        exitFullscreen();
        return true;
      }

      return false;
    };

    const subscription =
      BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

    return () =>
      subscription.remove();
  }, [isFullscreen, exitFullscreen]);

  /*
   * ---------------------------------------------------------
   * COMMENT MODAL
   * ---------------------------------------------------------
   */

  const openCommentModalSmoothly =
    useCallback(
      (item: LibraryItem) => {
        setActiveCommentItemId(
          item.id
        );

        setCommentText('');
        setAttachedCommentImage(null);
        setEditingCommentId(null);
        setReplyingToCommentId(null);

        keyboardTranslateY.value = 0;

        setIsCommentModalVisible(true);

        translateY.value =
          withTiming(
            0,
            {
              duration: 250,
              easing: Easing.out(
                Easing.cubic
              ),
            }
          );
      },
      [
        translateY,
        keyboardTranslateY,
      ]
    );

  const closeModalSmoothly =
    useCallback(() => {
      Keyboard.dismiss();

      keyboardTranslateY.value = 0;

      translateY.value =
        withTiming(
          SCREEN_HEIGHT,
          {
            duration: 220,
            easing: Easing.in(
              Easing.cubic
            ),
          },
          finished => {
            if (finished) {
              runOnJS(
                setIsCommentModalVisible
              )(false);
            }
          }
        );
    }, [
      translateY,
      keyboardTranslateY,
    ]);

  const panResponder =
    useRef(
      PanResponder.create({
        onStartShouldSetPanResponder:
          () => false,

        onMoveShouldSetPanResponder:
          (_, state) =>
            state.dy > 8,

        onPanResponderMove:
          (_, state) => {
            if (state.dy > 0) {
              translateY.value =
                state.dy;
            }
          },

        onPanResponderRelease:
          (_, state) => {
            if (
              state.dy > 100 ||
              state.vy > 0.5
            ) {
              closeModalSmoothly();
            } else {
              translateY.value =
                withSpring(
                  0,
                  {
                    damping: 20,
                  }
                );
            }
          },
      })
    ).current;

  /*
   * ---------------------------------------------------------
   * VIDEO SEEK HELPERS
   * ---------------------------------------------------------
   */

  const seekTo =
    useCallback(
      async (
        positionMillis: number,
        resume = true
      ) => {
        try {
          const status =
            await videoRef.current?.getStatusAsync();

          if (
            !status ||
            !status.isLoaded
          ) {
            return;
          }

          const duration =
            status.durationMillis ||
            playbackDuration ||
            1;

          const nextPosition =
            Math.max(
              0,
              Math.min(
                positionMillis,
                duration
              )
            );

          await videoRef.current?.setPositionAsync(
            nextPosition
          );

          setPlaybackPosition(
            nextPosition
          );

          setVideoFinished(false);

          if (resume) {
            await videoRef.current?.playAsync();
            setIsPlaying(true);
          }
        } catch {
          // Ignore transient playback seek errors.
        }
      },
      [playbackDuration]
    );

  const seekRelative =
    useCallback(
      async (deltaMillis: number) => {
        try {
          const status =
            await videoRef.current?.getStatusAsync();

          if (
            !status ||
            !status.isLoaded
          ) {
            return;
          }

          const current =
            status.positionMillis || 0;

          const duration =
            status.durationMillis || 1;

          const next =
            Math.max(
              0,
              Math.min(
                current + deltaMillis,
                duration
              )
            );

          await videoRef.current?.setPositionAsync(
            next
          );

          setPlaybackPosition(next);
          setVideoFinished(false);

          if (
            deltaMillis !== 0 &&
            !status.isPlaying
          ) {
            await videoRef.current?.playAsync();
            setIsPlaying(true);
          }
        } catch {
          // Ignore transient seek errors.
        }
      },
      []
    );

  /*
   * ---------------------------------------------------------
   * RESTART VIDEO
   * ---------------------------------------------------------
   */

  const restartVideo =
    useCallback(async () => {
      try {
        await videoRef.current?.setPositionAsync(
          0
        );

        setPlaybackPosition(0);
        setVideoFinished(false);

        await videoRef.current?.playAsync();

        setIsPlaying(true);
        setShowControls(true);

        if (isFullscreen) {
          showFullscreenSystemUI();
        }
      } catch {
        // Ignore transient playback errors.
      }
    }, [
      isFullscreen,
      showFullscreenSystemUI,
    ]);

  /*
   * ---------------------------------------------------------
   * PLAY / PAUSE
   * ---------------------------------------------------------
   */

  const togglePlayPause =
    useCallback(async () => {
      try {
        const status =
          await videoRef.current?.getStatusAsync();

        if (
          !status ||
          !status.isLoaded
        ) {
          return;
        }

        const duration =
          status.durationMillis || 0;

        const position =
          status.positionMillis || 0;

        /*
         * A video at its end needs to be explicitly moved
         * back to zero before playAsync().
         */

        if (
          videoFinished ||
          (
            duration > 0 &&
            position >= duration - 100
          )
        ) {
          await restartVideo();
          return;
        }

        if (status.isPlaying) {
          await videoRef.current?.pauseAsync();
          setIsPlaying(false);
        } else {
          await videoRef.current?.playAsync();
          setIsPlaying(true);
          setVideoFinished(false);
        }

        if (isFullscreen) {
          showFullscreenSystemUI();
        }
      } catch {
        // Ignore transient playback errors.
      }
    }, [
      videoFinished,
      restartVideo,
      isFullscreen,
      showFullscreenSystemUI,
    ]);

  /*
   * ---------------------------------------------------------
   * MUTE
   * ---------------------------------------------------------
   */

  const toggleMute =
    useCallback(async () => {
      try {
        const next = !isMuted;

        await videoRef.current?.setIsMutedAsync(
          next
        );

        setIsMuted(next);

        if (isFullscreen) {
          showFullscreenSystemUI();
        }
      } catch {
        // Ignore transient audio errors.
      }
    }, [
      isMuted,
      isFullscreen,
      showFullscreenSystemUI,
    ]);

  /*
   * ---------------------------------------------------------
   * FULLSCREEN
   * ---------------------------------------------------------
   */

  const toggleFullscreen =
    useCallback(async () => {
      try {
        if (!isFullscreen) {
          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock
              .LANDSCAPE_RIGHT
          );

          setIsFullscreen(true);
        } else {
          await exitFullscreen();
        }
      } catch {
        Alert.alert(
          'Fullscreen unavailable',
          'The device could not change screen orientation.'
        );
      }
    }, [
      isFullscreen,
      exitFullscreen,
    ]);

  /*
   * ---------------------------------------------------------
   * VIDEO STATUS
   * ---------------------------------------------------------
   */

  const handlePlaybackStatusUpdate =
    useCallback(
      (status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          return;
        }

        const position =
          status.positionMillis || 0;

        const duration =
          Math.max(
            status.durationMillis || 1,
            1
          );

        setPlaybackPosition(position);
        setPlaybackDuration(duration);
        setIsPlaying(status.isPlaying);

        if (status.didJustFinish) {
          setVideoFinished(true);
          setIsPlaying(false);
          setPlaybackPosition(duration);

          if (isFullscreen) {
            showFullscreenSystemUI();
          }
        }
      },
      [
        isFullscreen,
        showFullscreenSystemUI,
      ]
    );

  /*
   * ---------------------------------------------------------
   * VIDEO SOURCE
   * ---------------------------------------------------------
   */

  const getVideoSource =
    (fileUrl: any) => {
      if (
        typeof fileUrl === 'string' &&
        fileUrl
      ) {
        return {
          uri: fileUrl,
        };
      }

      if (
        fileUrl &&
        typeof fileUrl === 'object' &&
        fileUrl.uri
      ) {
        return {
          uri: fileUrl.uri,
        };
      }

      return {
        uri: FALLBACK_VIDEO_URI,
      };
    };

  /*
   * ---------------------------------------------------------
   * VIDEO TAP / DOUBLE TAP
   * ---------------------------------------------------------
   */

  const handleVideoSurfacePress =
    useCallback(
      (locationX: number) => {
        const now = Date.now();

        const isSecondTap =
          now - lastTapTime.current <
            DOUBLE_TAP_DELAY;

        const sameSide =
          (
            locationX <
              windowWidth / 2
          ) ===
          (
            lastTapX.current <
              windowWidth / 2
          );

        if (
          isSecondTap &&
          sameSide
        ) {
          if (doubleTapTimeout.current) {
            clearTimeout(
              doubleTapTimeout.current
            );

            doubleTapTimeout.current = null;
          }

          lastTapTime.current = 0;

          const isLeftSide =
            locationX <
            windowWidth / 2;

          if (isLeftSide) {
            seekRelative(
              -SEEK_INTERVAL_MS
            );
          } else {
            seekRelative(
              SEEK_INTERVAL_MS
            );
          }

          if (isFullscreen) {
            showFullscreenSystemUI();
          } else {
            setShowControls(true);
          }

          return;
        }

        lastTapTime.current = now;
        lastTapX.current = locationX;

        if (doubleTapTimeout.current) {
          clearTimeout(
            doubleTapTimeout.current
          );
        }

        doubleTapTimeout.current =
          setTimeout(() => {
            if (isFullscreen) {
              showFullscreenSystemUI();
            } else {
              setShowControls(
                previous => !previous
              );
            }

            doubleTapTimeout.current = null;
          }, DOUBLE_TAP_DELAY);
      },
      [
        windowWidth,
        seekRelative,
        isFullscreen,
        showFullscreenSystemUI,
      ]
    );

  /*
   * ---------------------------------------------------------
   * VIDEO GESTURE RESPONDER
   *
   * LEFT  = brightness
   * RIGHT = volume
   *
   * EDGE START = reveal system chrome
   * ---------------------------------------------------------
   */

  const videoPanResponder =
    useRef(
      PanResponder.create({
        onStartShouldSetPanResponder:
          () => false,

        onMoveShouldSetPanResponder:
          (_, state) =>
            Math.abs(state.dy) > 8 ||
            Math.abs(state.dx) > 8,

        onPanResponderGrant:
          event => {
            const x =
              event.nativeEvent.pageX;

            const y =
              event.nativeEvent.pageY;

            touchStartY.current = y;
            touchStartX.current = x;

            gestureSide.current =
              x < windowWidth / 2
                ? 'left'
                : 'right';

            edgeGestureActive.current =
              isFullscreen &&
              (
                x <= EDGE_GESTURE_THRESHOLD ||
                x >=
                  windowWidth -
                    EDGE_GESTURE_THRESHOLD ||
                y <= EDGE_GESTURE_THRESHOLD ||
                y >=
                  windowHeight -
                    EDGE_GESTURE_THRESHOLD
              );
          },

        onPanResponderMove:
          event => {
            const side =
              gestureSide.current;

            if (!side) {
              return;
            }

            const currentX =
              event.nativeEvent.pageX;

            const currentY =
              event.nativeEvent.pageY;

            const deltaY =
              touchStartY.current -
              currentY;

            const deltaX =
              Math.abs(
                currentX -
                  touchStartX.current
              );

            /*
             * Any meaningful gesture that starts from the
             * physical edge reveals the video chrome.
             */

            if (
              edgeGestureActive.current &&
              (
                Math.abs(deltaY) > 8 ||
                deltaX > 8
              )
            ) {
              showFullscreenSystemUI();
            }

            /*
             * Horizontal gestures should not alter
             * brightness or volume.
             */

            if (
              deltaX >
              Math.abs(deltaY)
            ) {
              return;
            }

            if (side === 'left') {
              const next =
                Math.min(
                  1,
                  Math.max(
                    0,
                    brightnessRef.current +
                      deltaY * 0.002
                  )
                );

              brightnessRef.current =
                next;

              setBrightnessVal(next);

              Brightness.setBrightnessAsync(
                next
              ).catch(() => {});

              setGestureOverlayText(
                `Brightness: ${Math.round(
                  next * 100
                )}%`
              );
            } else {
              const next =
                Math.min(
                  1,
                  Math.max(
                    0,
                    volumeRef.current +
                      deltaY * 0.002
                  )
                );

              volumeRef.current =
                next;

              setVolume(next);

              videoRef.current
                ?.setVolumeAsync(next)
                .catch(() => {});

              setGestureOverlayText(
                `Volume: ${Math.round(
                  next * 100
                )}%`
              );
            }
          },

        onPanResponderRelease:
          () => {
            gestureSide.current = null;
            edgeGestureActive.current =
              false;

            setTimeout(() => {
              setGestureOverlayText(
                null
              );
            }, 700);
          },

        onPanResponderTerminate:
          () => {
            gestureSide.current = null;
            edgeGestureActive.current =
              false;

            setGestureOverlayText(
              null
            );
          },
      })
    ).current;

  /*
   * ---------------------------------------------------------
   * PROGRESS BAR SEEKING
   * ---------------------------------------------------------
   */

  const seekFromProgressX =
    useCallback(
      async (
        locationX: number,
        resume: boolean
      ) => {
        if (
          progressBarWidth.current <= 0
        ) {
          return;
        }

        const ratio =
          Math.max(
            0,
            Math.min(
              1,
              locationX /
                progressBarWidth.current
            )
          );

        const duration =
          playbackDuration || 1;

        const target =
          ratio * duration;

        await seekTo(
          target,
          resume
        );
      },
      [
        playbackDuration,
        seekTo,
      ]
    );

  const progressPanResponder =
    useRef(
      PanResponder.create({
        onStartShouldSetPanResponder:
          () => true,

        onMoveShouldSetPanResponder:
          () => true,

        onPanResponderGrant:
          event => {
            seekFromProgressX(
              event.nativeEvent.locationX,
              false
            ).catch(() => {});
          },

        onPanResponderMove:
          event => {
            seekFromProgressX(
              event.nativeEvent.locationX,
              false
            ).catch(() => {});
          },

        onPanResponderRelease:
          event => {
            seekFromProgressX(
              event.nativeEvent.locationX,
              true
            ).catch(() => {});

            if (isFullscreen) {
              showFullscreenSystemUI();
            }
          },

        onPanResponderTerminate:
          () => {
            seekFromProgressX(
              0,
              false
            ).catch(() => {});
          },
      })
    ).current;

  /*
   * ---------------------------------------------------------
   * ANIMATED STYLES
   * ---------------------------------------------------------
   */

  const animatedModalStyle =
    useAnimatedStyle(() => ({
      transform: [
        {
          translateY:
            translateY.value +
            keyboardTranslateY.value,
        },
      ],
    }));

  const animatedBackButtonContainerStyle =
    useAnimatedStyle(() => ({
      opacity:
        1 -
        searchAnimation.value,

      width:
        (1 -
          searchAnimation.value) *
        32,

      transform: [
        {
          translateX:
            -searchAnimation.value *
            30,
        },
      ],
    }));

  const animatedTitleStyle =
    useAnimatedStyle(() => ({
      opacity:
        1 -
        searchAnimation.value *
          0.8,

      transform: [
        {
          translateX:
            -10 *
            searchAnimation.value,
        },
      ],
    }));

  const animatedSearchInputStyle =
    useAnimatedStyle(() => ({
      width: `${
        searchAnimation.value *
        72
      }%`,

      opacity:
        searchAnimation.value,

      transform: [
        {
          translateX:
            (1 -
              searchAnimation.value) *
            20,
        },
      ],
    }));

  /*
   * ---------------------------------------------------------
   * SEARCH / LIBRARY
   * ---------------------------------------------------------
   */

  const currentItems =
    libraryData[activeTab] || [];

  const filteredItems =
    useMemo(() => {
      const query =
        submittedQuery
          .trim()
          .toLowerCase();

      if (!query) {
        return currentItems;
      }

      return currentItems.filter(
        item =>
          `${item.title} ${item.author}`
            .toLowerCase()
            .includes(query)
      );
    }, [
      currentItems,
      submittedQuery,
    ]);

  const handleRefresh =
    useCallback(() => {
      setRefreshing(true);

      setTimeout(() => {
        setRefreshing(false);
      }, 900);
    }, []);

  const handleSearchToggle =
    () => {
      if (isSearching) {
        setSubmittedQuery(
          searchQuery.trim()
        );

        Keyboard.dismiss();
      } else {
        setIsSearching(true);

        searchAnimation.value =
          withTiming(
            1,
            {
              duration: 280,
              easing: Easing.out(
                Easing.cubic
              ),
            }
          );
      }
    };

  const handleDismissSearch =
    () => {
      if (!isSearching) {
        return;
      }

      Keyboard.dismiss();

      setIsSearching(false);
      setSearchQuery('');
      setSubmittedQuery('');

      searchAnimation.value =
        withTiming(
          0,
          {
            duration: 250,
            easing: Easing.out(
              Easing.quad
            ),
          }
        );
    };

  const handleBackPress =
    () => {
      if (
        navigation &&
        typeof navigation.goBack ===
          'function'
      ) {
        navigation.goBack();
      } else {
        Alert.alert(
          'Navigation',
          'Navigating to the previous screen.'
        );
      }
    };

  /*
   * ---------------------------------------------------------
   * DOWNLOAD
   * ---------------------------------------------------------
   */

  const showDownloadMessage =
    (message: string) => {
      setDownloadMessage(message);

      setTimeout(() => {
        setDownloadMessage('');
      }, 3500);
    };

  const handleDownload =
    async (
      itemTitle: string,
      fileAttachmentOrUrl: any,
      imageFallbackUrl: string
    ) => {
      try {
        let sourceUri = '';
        let filename =
          `resource_${Date.now()}`;

        if (
          fileAttachmentOrUrl &&
          typeof fileAttachmentOrUrl ===
            'object' &&
          fileAttachmentOrUrl.uri
        ) {
          sourceUri =
            fileAttachmentOrUrl.uri;

          filename =
            fileAttachmentOrUrl.name ||
            filename;
        } else if (
          typeof fileAttachmentOrUrl ===
            'string' &&
          fileAttachmentOrUrl
        ) {
          sourceUri =
            fileAttachmentOrUrl;

          filename =
            sourceUri
              .split('?')[0]
              .split('/')
              .pop() ||
            filename;
        } else if (
          imageFallbackUrl
        ) {
          sourceUri =
            imageFallbackUrl;

          filename =
            sourceUri
              .split('?')[0]
              .split('/')
              .pop() ||
            'resource.jpg';
        }

        if (!sourceUri) {
          throw new Error(
            'No downloadable resource is available.'
          );
        }

        let localUri =
          sourceUri;

        if (
          /^https?:\/\//i.test(
            sourceUri
          )
        ) {
          const baseDir =
            FileSystem.documentDirectory ||
            FileSystem.cacheDirectory;

          if (!baseDir) {
            throw new Error(
              'No writable app storage is available.'
            );
          }

          localUri =
            `${baseDir}${filename.replace(
              /[^a-zA-Z0-9._-]/g,
              '_'
            )}`;

          const result =
            await FileSystem.downloadAsync(
              sourceUri,
              localUri
            );

          localUri = result.uri;
        }

        const media =
          isMediaFile(filename);

        if (media) {
          const permission =
            await MediaLibrary.requestPermissionsAsync();

          if (
            permission.status !==
            'granted'
          ) {
            Alert.alert(
              'Permission required',
              'Allow media access to save this item to your gallery.'
            );

            return;
          }

          await MediaLibrary.createAssetAsync(
            localUri
          );

          showDownloadMessage(
            `${itemTitle} saved to Gallery`
          );

          return;
        }

        if (Platform.OS === 'android') {
          const permissions =
            await FileSystem.StorageAccessFramework
              .requestDirectoryPermissionsAsync();

          if (!permissions.granted) {
            return;
          }

          const base64 =
            await FileSystem.readAsStringAsync(
              localUri,
              {
                encoding:
                  FileSystem.EncodingType
                    .Base64,
              }
            );

          const mimeType =
            /\.pdf$/i.test(filename)
              ? 'application/pdf'
              : 'application/octet-stream';

          const destination =
            await FileSystem.StorageAccessFramework
              .createFileAsync(
                permissions.directoryUri,
                filename,
                mimeType
              );

          await FileSystem.writeAsStringAsync(
            destination,
            base64,
            {
              encoding:
                FileSystem.EncodingType
                  .Base64,
            }
          );

          showDownloadMessage(
            `${itemTitle} saved to selected folder`
          );
        } else {
          await Share.share({
            message:
              `${itemTitle}\n${sourceUri}`,
          });
        }
      } catch (error: any) {
        Alert.alert(
          'Download Error',
          error?.message ||
            'Failed to save the resource.'
        );
      }
    };

  /*
   * ---------------------------------------------------------
   * SHARE
   * ---------------------------------------------------------
   */

  const handleShare =
    async (
      itemTitle: string,
      fileUrl: any,
      imageUrl: string
    ) => {
      try {
        const shareUrl =
          typeof fileUrl === 'object'
            ? fileUrl?.uri
            : fileUrl;

        await Share.share({
          message:
            `Check out this resource material: ${itemTitle}\n${
              shareUrl ||
              imageUrl ||
              ''
            }`,
        });
      } catch (error: any) {
        if (error?.message) {
          Alert.alert(
            'Share Error',
            error.message
          );
        }
      }
    };

  /*
   * ---------------------------------------------------------
   * IMAGE / FILE PICKERS
   * ---------------------------------------------------------
   */

  const pickImage =
    async (
      onPicked: (uri: string) => void
    ) => {
      try {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            'Permission required',
            'Gallery permission is required to select an image.'
          );

          return;
        }

        const result =
          await ImagePicker.launchImageLibraryAsync(
            {
              mediaTypes:
                ImagePicker.MediaTypeOptions
                  .Images,
              allowsEditing: true,
              quality: 0.8,
            }
          );

        if (
          !result.canceled &&
          result.assets?.[0]?.uri
        ) {
          onPicked(
            result.assets[0].uri
          );
        }
      } catch (error: any) {
        Alert.alert(
          'Image Error',
          error?.message ||
            'Failed to select the image.'
        );
      }
    };

  const handlePickCommentImage =
    () =>
      pickImage(
        setAttachedCommentImage
      );

  const handlePickThumbnail =
    () =>
      pickImage(
        setNewThumbnail
      );

  const handlePickResourceFile =
    async () => {
      try {
        const result =
          await DocumentPicker.getDocumentAsync(
            {
              type: '*/*',
              copyToCacheDirectory:
                true,
            }
          );

        if (
          !result.canceled &&
          result.assets?.[0]
        ) {
          setNewResourceFile(
            result.assets[0]
          );
        }
      } catch (error: any) {
        Alert.alert(
          'File Error',
          error?.message ||
            'Failed to select the file.'
        );
      }
    };

  /*
   * ---------------------------------------------------------
   * REFERENCES / CREATE RESOURCE
   * ---------------------------------------------------------
   */

  const handleAddReference =
    () => {
      const value =
        currentReferenceInput.trim();

      if (!value) {
        return;
      }

      setNewReferences(
        previous => [
          ...previous,
          value,
        ]
      );

      setCurrentReferenceInput('');
    };

  const handleResetCreateForm =
    () => {
      setNewTitle('');
      setNewDescription('');
      setNewThumbnail(null);
      setNewResourceFile(null);
      setNewReferences([]);
      setCurrentReferenceInput('');
      setIsCreateModalVisible(false);
    };

  const handleCreateResource =
    () => {
      const title =
        newTitle.trim();

      if (!title) {
        Alert.alert(
          'Missing field',
          'Please enter a title for the resource.'
        );

        return;
      }

      const fileUri =
        newResourceFile?.uri ||
        '';

      const fileName =
        newResourceFile?.name ||
        '';

      const mimeType =
        newResourceFile?.mimeType ||
        '';

      const video =
        isVideoFile(
          fileName || fileUri,
          mimeType
        );

      const category:
        | 'Documents'
        | 'Media' =
        video
          ? 'Media'
          : 'Documents';

      const resource:
        LibraryItem = {
        id: `res_${Date.now()}`,
        title,
        author: 'You',

        image:
          newThumbnail ||
          (video
            ? 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80'
            : 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80'),

        avatar:
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',

        fileUrl:
          newResourceFile ||
          null,

        type:
          video
            ? 'video'
            : 'document',

        description:
          newDescription.trim() ||
          (
            newResourceFile
              ? `Attached file: ${newResourceFile.name}`
              : 'Custom uploaded community resource.'
          ),

        references:
          newReferences,
      };

      setLibraryData(
        previous => ({
          ...previous,

          [category]: [
            resource,
            ...(previous[
              category
            ] || []),
          ],
        })
      );

      setActiveTab(category);

      handleResetCreateForm();
    };

  /*
   * ---------------------------------------------------------
   * COMMENTS
   * ---------------------------------------------------------
   */

  const getTotalCommentCount =
    (itemId: string) => {
      const countComments =
        (
          comments: CommentItem[]
        ): number =>
          comments.reduce(
            (
              total,
              comment
            ) =>
              total +
              1 +
              countComments(
                comment.replies ||
                  []
              ),
            0
          );

      return countComments(
        commentsMap[itemId] || []
      );
    };

  const handleCommentSubmit =
    () => {
      if (
        (
          !commentText.trim() &&
          !attachedCommentImage
        ) ||
        !activeCommentItemId
      ) {
        return;
      }

      setCommentsMap(
        previous => {
          const comments = [
            ...(previous[
              activeCommentItemId
            ] || []),
          ];

          if (editingCommentId) {
            return {
              ...previous,

              [activeCommentItemId]:
                updateCommentTree(
                  comments,
                  editingCommentId,
                  comment => ({
                    ...comment,
                    text:
                      commentText.trim(),
                    image:
                      attachedCommentImage ??
                      comment.image,
                  })
                ),
            };
          }

          if (replyingToCommentId) {
            return {
              ...previous,

              [activeCommentItemId]:
                updateCommentTree(
                  comments,
                  replyingToCommentId,
                  comment => ({
                    ...comment,

                    replies: [
                      ...(comment.replies ||
                        []),

                      {
                        id: `r_${Date.now()}`,

                        author: 'You',

                        avatar:
                          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',

                        text:
                          commentText.trim(),

                        image:
                          attachedCommentImage,

                        isOwn: true,

                        replies: [],
                      },
                    ],
                  })
                ),
            };
          }

          return {
            ...previous,

            [activeCommentItemId]: [
              {
                id: `c_${Date.now()}`,

                author: 'You',

                avatar:
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',

                text:
                  commentText.trim(),

                image:
                  attachedCommentImage,

                isOwn: true,

                replies: [],
              },

              ...comments,
            ],
          };
        }
      );

      setCommentText('');
      setAttachedCommentImage(null);
      setEditingCommentId(null);
      setReplyingToCommentId(null);

      /*
       * Do not dismiss the keyboard after sending.
       *
       * Keeping the keyboard open makes it possible to
       * immediately continue the conversation.
       */
    };

  /*
   * ---------------------------------------------------------
   * COMMENT RENDERING
   * ---------------------------------------------------------
   */

  const currentComments =
    activeCommentItemId
      ? commentsMap[
          activeCommentItemId
        ] || []
      : [];

  const renderComment =
    ({
      item,
    }: {
      item: CommentItem;
    }) => {
      const renderNode = (
        comment: CommentItem,
        nested = false
      ): React.ReactNode => {
        const isOwn =
          comment.isOwn ||
          comment.author === 'You';

        return (
          <View
            key={comment.id}
            style={
              nested
                ? styles.replyThreadWrapper
                : styles.commentThreadWrapper
            }
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onLongPress={() => {
                setSelectedCommentForOptions(
                  comment
                );

                setIsOwnCommentSelected(
                  isOwn
                );

                setOptionsModalVisible(
                  true
                );
              }}
              style={
                styles.commentItemContainer
              }
            >
              <View
                style={
                  styles.commentAuthorTopRow
                }
              >
                <Image
                  source={{
                    uri: comment.avatar,
                  }}
                  style={
                    nested
                      ? styles.replyAuthorAvatar
                      : styles.commentAuthorAvatar
                  }
                />

                <Text
                  style={
                    styles.commentAuthorName
                  }
                >
                  {comment.author}
                </Text>
              </View>

              <View
                style={
                  styles.commentBubbleBox
                }
              >
                {comment.image ? (
                  <Image
                    source={{
                      uri: comment.image,
                    }}
                    style={
                      styles.commentImageAttachment
                    }
                  />
                ) : null}

                {!!comment.text && (
                  <Text
                    style={
                      styles.commentText
                    }
                  >
                    {comment.text}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {comment.replies?.length ? (
              <View
                style={
                  styles.repliesContainer
                }
              >
                {comment.replies.map(
                  reply =>
                    renderNode(
                      reply,
                      true
                    )
                )}
              </View>
            ) : null}
          </View>
        );
      };

      return renderNode(item);
    };

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <TouchableWithoutFeedback
      onPress={handleDismissSearch}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop:
              Math.max(
                insets.top,
                12
              ),
          },
        ]}
      >
        <StatusBar
          hidden={systemBarsHidden}
          translucent
          backgroundColor="transparent"
          barStyle="dark-content"
        />

        {/* -------------------------------------------------
            HEADER
        ------------------------------------------------- */}

        <View style={styles.header}>
          <Animated.View
            style={[
              styles.backButtonContainer,
              animatedBackButtonContainerStyle,
            ]}
          >
            {!isSearching ? (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={
                  handleBackPress
                }
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chevron-back"
                  size={26}
                  color={
                    colors.textPrimary
                  }
                />
              </TouchableOpacity>
            ) : null}
          </Animated.View>

          <View
            style={
              styles.headerCenter
            }
          >
            <Animated.Text
              style={[
                styles.headerTitle,
                animatedTitleStyle,
              ]}
              numberOfLines={1}
            >
              Library
            </Animated.Text>

            <Animated.View
              style={[
                styles.searchAnimatedWrapper,
                animatedSearchInputStyle,
              ]}
            >
              <TextInput
                style={
                  styles.searchInput
                }
                placeholder="Search library..."
                placeholderTextColor={
                  colors.textSecondary
                }
                value={
                  searchQuery
                }
                onChangeText={
                  setSearchQuery
                }
                autoFocus={
                  isSearching
                }
                returnKeyType="search"
                onSubmitEditing={() => {
                  setSubmittedQuery(
                    searchQuery.trim()
                  );

                  Keyboard.dismiss();
                }}
              />
            </Animated.View>
          </View>

          <TouchableOpacity
            style={
              styles.searchIconButton
            }
            onPress={
              handleSearchToggle
            }
            activeOpacity={0.8}
          >
            <Feather
              name="search"
              size={20}
              color={
                colors.textPrimary
              }
              strokeWidth={2.5}
            />
          </TouchableOpacity>
        </View>

        {/* -------------------------------------------------
            TABS
        ------------------------------------------------- */}

        <View
          style={
            styles.tabContainer
          }
        >
          {(
            [
              'Documents',
              'Media',
            ] as const
          ).map(tab => {
            const active =
              activeTab === tab;

            return (
              <TouchableOpacity
                key={tab}
                onPress={() =>
                  setActiveTab(tab)
                }
                style={
                  styles.tabItem
                }
              >
                <Text
                  style={[
                    styles.tabText,
                    active &&
                      styles.activeTabText,
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* -------------------------------------------------
            LIBRARY CONTENT
        ------------------------------------------------- */}

        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                handleRefresh
              }
              colors={[
                PRIMARY_COLOR,
              ]}
              tintColor={
                PRIMARY_COLOR
              }
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          {filteredItems.length ? (
            filteredItems.map(
              item => {
                const commentCount =
                  getTotalCommentCount(
                    item.id
                  );

                const isVideoItem =
                  item.type ===
                  'video';

                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.9}
                    style={
                      styles.card
                    }
                    onPress={() =>
                      setSelectedItem(
                        item
                      )
                    }
                  >
                    <View
                      style={
                        styles.cardHeader
                      }
                    >
                      <Image
                        source={{
                          uri: item.avatar,
                        }}
                        style={
                          styles.avatar
                        }
                      />

                      <View
                        style={
                          styles.cardHeaderText
                        }
                      >
                        <Text
                          style={
                            styles.cardTitle
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {item.title}
                        </Text>

                        <Text
                          style={
                            styles.cardAuthor
                          }
                        >
                          {item.author}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={
                        styles.imageContainer
                      }
                    >
                      <Image
                        source={{
                          uri: item.image,
                        }}
                        style={
                          styles.cardImage
                        }
                      />

                      {isVideoItem ? (
                        <View
                          style={
                            styles.playOverlay
                          }
                        >
                          <View
                            style={
                              styles.playButtonCircle
                            }
                          >
                            <Ionicons
                              name="play"
                              size={28}
                              color="#FFFFFF"
                              style={{
                                marginLeft: 3,
                              }}
                            />
                          </View>
                        </View>
                      ) : null}
                    </View>

                    <View
                      style={
                        styles.cardFooter
                      }
                    >
                      <View
                        style={
                          styles.footerLeftActions
                        }
                      >
                        <TouchableOpacity
                          style={
                            styles.actionIconButton
                          }
                          onPress={event => {
                            event.stopPropagation();

                            handleDownload(
                              item.title,
                              item.fileUrl,
                              item.image
                            );
                          }}
                        >
                          <Feather
                            name="download"
                            size={18}
                            color={
                              colors.textPrimary
                            }
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={
                            styles.commentActionGroup
                          }
                          onPress={event => {
                            event.stopPropagation();

                            openCommentModalSmoothly(
                              item
                            );
                          }}
                        >
                          <View
                            style={
                              styles.actionIconButton
                            }
                          >
                            <Feather
                              name="message-square"
                              size={18}
                              color={
                                colors.textPrimary
                              }
                            />
                          </View>

                          {commentCount >
                          0 ? (
                            <Text
                              style={
                                styles.commentCountText
                              }
                            >
                              {
                                commentCount
                              }
                            </Text>
                          ) : null}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={
                            styles.actionIconButton
                          }
                          onPress={event => {
                            event.stopPropagation();

                            handleShare(
                              item.title,
                              item.fileUrl,
                              item.image
                            );
                          }}
                        >
                          <Feather
                            name="share-2"
                            size={18}
                            color={
                              colors.textPrimary
                            }
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }
            )
          ) : (
            <View
              style={
                styles.emptyContainer
              }
            >
              <Text
                style={
                  styles.emptyText
                }
              >
                {submittedQuery
                  ? `No results found for "${submittedQuery}"`
                  : 'No resources available.'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* -------------------------------------------------
            DOWNLOAD MESSAGE
        ------------------------------------------------- */}

        {downloadMessage ? (
          <View
            style={[
              styles.fadedNotificationContainer,
              {
                bottom: Math.max(
                  insets.bottom +
                    12,
                  16
                ),
              },
            ]}
          >
            <Text
              style={
                styles.fadedNotificationText
              }
            >
              {downloadMessage}
            </Text>
          </View>
        ) : null}

        {/* -------------------------------------------------
            CREATE RESOURCE FAB
            Exactly 2px above the safe-area bottom.
        ------------------------------------------------- */}

        <TouchableOpacity
          style={[
            styles.fab,
            {
              bottom:
                insets.bottom + 2,
            },
          ]}
          onPress={() =>
            setIsCreateModalVisible(
              true
            )
          }
          activeOpacity={0.85}
        >
          <MaterialIcons
            name="add"
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        {/* -------------------------------------------------
            CREATE RESOURCE MODAL
        ------------------------------------------------- */}

        <Modal
          visible={
            isCreateModalVisible
          }
          animationType="slide"
          transparent={false}
          onRequestClose={
            handleResetCreateForm
          }
        >
          <View
            style={
              styles.createModalContainer
            }
          >
            <View
              style={
                styles.createModalHeader
              }
            >
              <Text
                style={
                  styles.createModalHeaderTitle
                }
              >
                Upload Resource
              </Text>

              <TouchableOpacity
                style={
                  styles.modalCloseButton
                }
                onPress={
                  handleResetCreateForm
                }
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={
                    colors.textPrimary
                  }
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={
                styles.createModalScrollContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
            >
              <Text
                style={
                  styles.fieldLabel
                }
              >
                Resource Title *
              </Text>

              <TextInput
                style={
                  styles.formInput
                }
                placeholder="Enter resource title..."
                placeholderTextColor={
                  colors.textSecondary
                }
                value={newTitle}
                onChangeText={
                  setNewTitle
                }
              />

              <Text
                style={
                  styles.fieldLabel
                }
              >
                Resource Thumbnail
              </Text>

              <TouchableOpacity
                style={
                  styles.attachmentButton
                }
                onPress={
                  handlePickThumbnail
                }
              >
                <Feather
                  name="image"
                  size={18}
                  color={
                    PRIMARY_COLOR
                  }
                  style={{
                    marginRight: 8,
                  }}
                />

                <Text
                  style={
                    styles.attachmentButtonText
                  }
                >
                  {newThumbnail
                    ? 'Change Thumbnail Image'
                    : 'Select Thumbnail Image'}
                </Text>
              </TouchableOpacity>

              {newThumbnail ? (
                <Image
                  source={{
                    uri: newThumbnail,
                  }}
                  style={
                    styles.thumbnailPreview
                  }
                />
              ) : null}

              <Text
                style={
                  styles.fieldLabel
                }
              >
                Attach Resource File
              </Text>

              <TouchableOpacity
                style={
                  styles.attachmentButton
                }
                onPress={
                  handlePickResourceFile
                }
              >
                <Feather
                  name="file-text"
                  size={18}
                  color={
                    PRIMARY_COLOR
                  }
                  style={{
                    marginRight: 8,
                  }}
                />

                <Text
                  style={
                    styles.attachmentButtonText
                  }
                  numberOfLines={1}
                >
                  {newResourceFile?.name ||
                    'Select File Attachment'}
                </Text>
              </TouchableOpacity>

              <Text
                style={
                  styles.fieldLabel
                }
              >
                About
              </Text>

              <TextInput
                style={[
                  styles.formInput,
                  styles.multilineInput,
                ]}
                placeholder="Enter resource description or details..."
                placeholderTextColor={
                  colors.textSecondary
                }
                value={
                  newDescription
                }
                onChangeText={
                  setNewDescription
                }
                multiline
              />

              <Text
                style={
                  styles.fieldLabel
                }
              >
                References
              </Text>

              <View
                style={
                  styles.referenceInputRow
                }
              >
                <TextInput
                  style={[
                    styles.formInput,
                    styles.referenceTextInput,
                  ]}
                  placeholder="Add a reference..."
                  placeholderTextColor={
                    colors.textSecondary
                  }
                  value={
                    currentReferenceInput
                  }
                  onChangeText={
                    setCurrentReferenceInput
                  }
                />

                <TouchableOpacity
                  style={
                    styles.addRefButton
                  }
                  onPress={
                    handleAddReference
                  }
                >
                  <Ionicons
                    name="add"
                    size={22}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>

              {newReferences.length ? (
                <View
                  style={
                    styles.referenceListContainer
                  }
                >
                  {newReferences.map(
                    (
                      reference,
                      index
                    ) => (
                      <View
                        key={`${reference}-${index}`}
                        style={
                          styles.referenceBadgeItem
                        }
                      >
                        <Text
                          style={
                            styles.referenceBadgeText
                          }
                        >
                          {index + 1}.{' '}
                          {reference}
                        </Text>

                        <TouchableOpacity
                          onPress={() =>
                            setNewReferences(
                              previous =>
                                previous.filter(
                                  (
                                    _,
                                    i
                                  ) =>
                                    i !==
                                    index
                                )
                            )
                          }
                        >
                          <Ionicons
                            name="close-circle"
                            size={18}
                            color={
                              colors.danger
                            }
                          />
                        </TouchableOpacity>
                      </View>
                    )
                  )}
                </View>
              ) : null}
            </ScrollView>

            <View
              style={[
                styles.createModalFooter,
                {
                  paddingBottom:
                    Math.max(
                      insets.bottom +
                        10,
                      16
                    ),
                },
              ]}
            >
              <TouchableOpacity
                style={
                  styles.discardButton
                }
                onPress={
                  handleResetCreateForm
                }
              >
                <Text
                  style={
                    styles.discardButtonText
                  }
                >
                  Discard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.createButton
                }
                onPress={
                  handleCreateResource
                }
              >
                <Text
                  style={
                    styles.createButtonText
                  }
                >
                  Create
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* -------------------------------------------------
            RESOURCE DETAILS / VIDEO MODAL
        ------------------------------------------------- */}

        <Modal
          visible={
            selectedItem !== null
          }
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            if (isFullscreen) {
              exitFullscreen();
            } else {
              setSelectedItem(null);
            }
          }}
        >
          {selectedItem ? (
            <View
              style={[
                styles.modalContainer,
                isFullscreen &&
                  styles.fullscreenModalContainer,
              ]}
            >
              {!isFullscreen ? (
                <View
                  style={
                    styles.modalHeader
                  }
                >
                  <Text
                    style={
                      styles.modalHeaderTitle
                    }
                    numberOfLines={1}
                  >
                    Resource Details
                  </Text>

                  <TouchableOpacity
                    style={
                      styles.modalCloseButton
                    }
                    onPress={() =>
                      setSelectedItem(
                        null
                      )
                    }
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={
                        colors.textPrimary
                      }
                    />
                  </TouchableOpacity>
                </View>
              ) : null}

              <ScrollView
                contentContainerStyle={
                  isFullscreen
                    ? styles.fullscreenScrollContent
                    : styles.modalScrollContent
                }
                showsVerticalScrollIndicator={
                  false
                }
                scrollEnabled={
                  !isFullscreen
                }
              >
                {selectedItem.type ===
                'video' ? (
                  <View
                    style={[
                      styles.videoPlayerContainer,

                      isFullscreen && {
                        width:
                          windowWidth,
                        height:
                          windowHeight,
                        borderRadius: 0,
                        marginBottom: 0,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={1}
                      style={
                        styles.videoTouchContainer
                      }
                      onPress={event =>
                        handleVideoSurfacePress(
                          event
                            .nativeEvent
                            .locationX
                        )
                      }
                    >
                      <View
                        {...videoPanResponder.panHandlers}
                        style={
                          styles.videoGestureArea
                        }
                      >
                        <Video
                          ref={
                            videoRef
                          }
                          source={getVideoSource(
                            selectedItem.fileUrl
                          )}
                          style={
                            styles.videoElement
                          }
                          resizeMode={
                            ResizeMode.CONTAIN
                          }
                          shouldPlay
                          isMuted={
                            isMuted
                          }
                          volume={
                            volume
                          }
                          onPlaybackStatusUpdate={
                            handlePlaybackStatusUpdate
                          }
                        />

                        {gestureOverlayText ? (
                          <View
                            style={
                              styles.gestureOverlayContainer
                            }
                            pointerEvents="none"
                          >
                            <Text
                              style={
                                styles.gestureOverlayText
                              }
                            >
                              {
                                gestureOverlayText
                              }
                            </Text>
                          </View>
                        ) : null}

                        {videoFinished ? (
                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={
                              styles.videoRestartButton
                            }
                            onPress={
                              restartVideo
                            }
                          >
                            <Ionicons
                              name="refresh"
                              size={42}
                              color={
                                PRIMARY_COLOR
                              }
                            />
                          </TouchableOpacity>
                        ) : null}

                        {showControls ? (
                          <View
                            style={
                              styles.videoControlsOverlay
                            }
                          >
                            <TouchableOpacity
                              onPress={
                                togglePlayPause
                              }
                              style={
                                styles.videoControlBtn
                              }
                              hitSlop={
                                {
                                  top: 8,
                                  bottom: 8,
                                  left: 8,
                                  right: 8,
                                }
                              }
                            >
                              <Ionicons
                                name={
                                  videoFinished
                                    ? 'refresh'
                                    : isPlaying
                                    ? 'pause'
                                    : 'play'
                                }
                                size={20}
                                color={
                                  PRIMARY_COLOR
                                }
                              />
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={
                                toggleMute
                              }
                              style={
                                styles.videoControlBtn
                              }
                              hitSlop={
                                {
                                  top: 8,
                                  bottom: 8,
                                  left: 8,
                                  right: 8,
                                }
                              }
                            >
                              <Ionicons
                                name={
                                  isMuted
                                    ? 'volume-mute'
                                    : 'volume-high'
                                }
                                size={20}
                                color={
                                  PRIMARY_COLOR
                                }
                              />
                            </TouchableOpacity>

                            <View
                              style={
                                styles.progressBarWrapper
                              }
                              onLayout={event => {
                                progressBarWidth.current =
                                  event.nativeEvent.layout.width;
                              }}
                              {...progressPanResponder.panHandlers}
                            >
                              <View
                                style={
                                  styles.progressBarBackground
                                }
                              >
                                <View
                                  style={[
                                    styles.progressBarFill,
                                    {
                                      width: `${Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          (
                                            playbackPosition /
                                            playbackDuration
                                          ) *
                                            100
                                        )
                                      )}%`,
                                    },
                                  ]}
                                />
                              </View>

                              <View
                                style={[
                                  styles.progressThumb,
                                  {
                                    left: `${Math.min(
                                      100,
                                      Math.max(
                                        0,
                                        (
                                          playbackPosition /
                                          playbackDuration
                                        ) *
                                          100
                                      )
                                    )}%`,
                                  },
                                ]}
                              />
                            </View>

                            <TouchableOpacity
                              onPress={
                                toggleFullscreen
                              }
                              style={
                                styles.videoControlBtn
                              }
                              hitSlop={
                                {
                                  top: 10,
                                  bottom: 10,
                                  left: 10,
                                  right: 10,
                                }
                              }
                            >
                              <Ionicons
                                name={
                                  isFullscreen
                                    ? 'contract'
                                    : 'expand'
                                }
                                size={20}
                                color={
                                  PRIMARY_COLOR
                                }
                              />
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Image
                    source={{
                      uri: selectedItem.image,
                    }}
                    style={
                      styles.modalImage
                    }
                  />
                )}

                {!isFullscreen ? (
                  <>
                    <Text
                      style={
                        styles.modalTitle
                      }
                    >
                      {
                        selectedItem.title
                      }
                    </Text>

                    <View
                      style={
                        styles.modalAuthorContainer
                      }
                    >
                      <Image
                        source={{
                          uri: selectedItem.avatar,
                        }}
                        style={
                          styles.modalAvatar
                        }
                      />

                      <View>
                        <Text
                          style={
                            styles.modalAuthorLabel
                          }
                        >
                          Author / Presenter
                        </Text>

                        <Text
                          style={
                            styles.modalAuthorName
                          }
                        >
                          {
                            selectedItem.author
                          }
                        </Text>
                      </View>
                    </View>

                    <View
                      style={
                        styles.modalSection
                      }
                    >
                      <Text
                        style={
                          styles.modalSectionTitle
                        }
                      >
                        About this resource
                      </Text>

                      <Text
                        style={
                          styles.modalDescription
                        }
                      >
                        {
                          selectedItem.description
                        }
                      </Text>
                    </View>

                    {selectedItem.references
                      ?.length ? (
                      <View
                        style={
                          styles.modalSection
                        }
                      >
                        <Text
                          style={
                            styles.modalSectionTitle
                          }
                        >
                          References
                        </Text>

                        {selectedItem.references.map(
                          (
                            reference,
                            index
                          ) => (
                            <View
                              key={`${reference}-${index}`}
                              style={
                                styles.referenceDetailRow
                              }
                            >
                              <Ionicons
                                name="bookmark-outline"
                                size={16}
                                color={
                                  PRIMARY_COLOR
                                }
                                style={{
                                  marginRight: 6,
                                  marginTop: 2,
                                }}
                              />

                              <Text
                                style={
                                  styles.referenceDetailText
                                }
                              >
                                {
                                  reference
                                }
                              </Text>
                            </View>
                          )
                        )}
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={
                        styles.modalDownloadButton
                      }
                      onPress={() =>
                        handleDownload(
                          selectedItem.title,
                          selectedItem.fileUrl,
                          selectedItem.image
                        )
                      }
                    >
                      <Feather
                        name="download"
                        size={18}
                        color="#FFFFFF"
                        style={{
                          marginRight: 8,
                        }}
                      />

                      <Text
                        style={
                          styles.modalDownloadButtonText
                        }
                      >
                        Download Material
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </ScrollView>
            </View>
          ) : null}
        </Modal>

        {/* -------------------------------------------------
            COMMENT MODAL
        ------------------------------------------------- */}

        <Modal
          visible={
            isCommentModalVisible
          }
          animationType="none"
          transparent
          onRequestClose={
            closeModalSmoothly
          }
        >
          <View
            style={
              styles.commentModalOverlay
            }
          >
            <TouchableWithoutFeedback
              onPress={
                closeModalSmoothly
              }
            >
              <View
                style={
                  styles.commentModalDismissArea
                }
              />
            </TouchableWithoutFeedback>

            <Animated.View
              style={[
                styles.commentModalContentWrapper,
                animatedModalStyle,
              ]}
            >
              <View
                {...panResponder.panHandlers}
                style={
                  styles.commentHeaderGestureArea
                }
              >
                <View
                  style={
                    styles.commentModalHeader
                  }
                >
                  <View
                    style={
                      styles.commentModalIndicator
                    }
                  />

                  <Text
                    style={
                      styles.commentModalTitle
                    }
                  >
                    Comments
                  </Text>

                  <TouchableOpacity
                    onPress={
                      closeModalSmoothly
                    }
                    style={
                      styles.commentCloseIcon
                    }
                  >
                    <Ionicons
                      name="close"
                      size={22}
                      color={
                        colors.textPrimary
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {(
                replyingToCommentId ||
                editingCommentId
              ) ? (
                <View
                  style={
                    styles.replyEditBanner
                  }
                >
                  <Text
                    style={
                      styles.replyEditText
                    }
                  >
                    {editingCommentId
                      ? 'Editing comment...'
                      : 'Replying to comment...'}
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      setReplyingToCommentId(
                        null
                      );

                      setEditingCommentId(
                        null
                      );

                      setCommentText('');

                      setAttachedCommentImage(
                        null
                      );
                    }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={
                        colors.textSecondary
                      }
                    />
                  </TouchableOpacity>
                </View>
              ) : null}

              <FlatList
                data={
                  currentComments
                }
                keyExtractor={item =>
                  item.id
                }
                contentContainerStyle={
                  styles.commentsListContainer
                }
                renderItem={
                  renderComment
                }
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View
                    style={
                      styles.emptyCommentsContainer
                    }
                  >
                    <Text
                      style={
                        styles.emptyCommentsText
                      }
                    >
                      No comments yet. Start the conversation!
                    </Text>
                  </View>
                }
              />

              {attachedCommentImage ? (
                <View
                  style={
                    styles.attachedPreviewContainer
                  }
                >
                  <Image
                    source={{
                      uri: attachedCommentImage,
                    }}
                    style={
                      styles.attachedPreviewThumbnail
                    }
                  />

                  <TouchableOpacity
                    onPress={() =>
                      setAttachedCommentImage(
                        null
                      )
                    }
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={
                        colors.danger
                      }
                    />
                  </TouchableOpacity>
                </View>
              ) : null}

              {/*
               * IMPORTANT:
               *
               * This input bar is no longer inside a
               * KeyboardAvoidingView.
               *
               * The entire comment sheet is translated by
               * keyboardTranslateY when Android reports the
               * keyboard height. This makes the entry bar
               * physically rise with the keyboard instead
               * of being covered by it.
               */}

              <View
                style={[
                  styles.commentInputBar,
                  {
                    paddingBottom:
                      Math.max(
                        insets.bottom,
                        10
                      ),
                  },
                ]}
              >
                <TouchableOpacity
                  style={
                    styles.commentAttachButton
                  }
                  onPress={
                    handlePickCommentImage
                  }
                >
                  <Ionicons
                    name="image-outline"
                    size={26}
                    color={
                      PRIMARY_COLOR
                    }
                  />
                </TouchableOpacity>

                <TextInput
                  style={
                    styles.commentTextInput
                  }
                  placeholder={
                    editingCommentId
                      ? 'Edit your comment...'
                      : replyingToCommentId
                      ? 'Write a reply...'
                      : 'Add a comment...'
                  }
                  placeholderTextColor={
                    colors.textSecondary
                  }
                  value={
                    commentText
                  }
                  onChangeText={
                    setCommentText
                  }
                  multiline
                  textAlignVertical="center"
                />

                <TouchableOpacity
                  style={[
                    styles.commentSendButton,
                    !commentText.trim() &&
                      !attachedCommentImage &&
                      styles.commentSendButtonDisabled,
                  ]}
                  onPress={
                    handleCommentSubmit
                  }
                  disabled={
                    !commentText.trim() &&
                    !attachedCommentImage
                  }
                >
                  {editingCommentId ? (
                    <Text
                      style={
                        styles.commentEditTextButton
                      }
                    >
                      Edit
                    </Text>
                  ) : (
                    <Ionicons
                      name="send"
                      size={16}
                      color="#FFFFFF"
                      style={{
                        marginLeft: 2,
                      }}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>

        {/* -------------------------------------------------
            COMMENT OPTIONS
        ------------------------------------------------- */}

        <Modal
          visible={
            optionsModalVisible
          }
          animationType="fade"
          transparent
          onRequestClose={() =>
            setOptionsModalVisible(
              false
            )
          }
        >
          <View
            style={
              styles.optionsModalOverlay
            }
          >
            <TouchableWithoutFeedback
              onPress={() =>
                setOptionsModalVisible(
                  false
                )
              }
            >
              <View
                style={
                  styles.optionsModalDismissArea
                }
              />
            </TouchableWithoutFeedback>

            <View
              style={
                styles.optionsModalContent
              }
            >
              <Text
                style={
                  styles.optionsModalTitle
                }
              >
                Comment Options
              </Text>

              <Text
                style={
                  styles.optionsModalSubtitle
                }
              >
                Choose an action
              </Text>

              {isOwnCommentSelected ? (
                <>
                  <TouchableOpacity
                    style={
                      styles.optionButton
                    }
                    onPress={() => {
                      setOptionsModalVisible(
                        false
                      );

                      const comment =
                        selectedCommentForOptions &&
                        activeCommentItemId
                          ? findCommentInTree(
                              commentsMap[
                                activeCommentItemId
                              ] || [],
                              selectedCommentForOptions.id
                            )
                          : null;

                      if (!comment) {
                        return;
                      }

                      setCommentText(
                        comment.text
                      );

                      setAttachedCommentImage(
                        comment.image ||
                          null
                      );

                      setEditingCommentId(
                        comment.id
                      );

                      setReplyingToCommentId(
                        null
                      );
                    }}
                  >
                    <Text
                      style={
                        styles.optionButtonText
                      }
                    >
                      EDIT
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.optionButton
                    }
                    onPress={() => {
                      setOptionsModalVisible(
                        false
                      );

                      if (
                        !selectedCommentForOptions ||
                        !activeCommentItemId
                      ) {
                        return;
                      }

                      setCommentsMap(
                        previous => ({
                          ...previous,

                          [activeCommentItemId]:
                            updateCommentTree(
                              previous[
                                activeCommentItemId
                              ] || [],
                              selectedCommentForOptions.id,
                              () => null
                            ),
                        })
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        {
                          color:
                            colors.danger,
                        },
                      ]}
                    >
                      DELETE
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={
                    styles.optionButton
                  }
                  onPress={() => {
                    setOptionsModalVisible(
                      false
                    );

                    if (
                      !selectedCommentForOptions
                    ) {
                      return;
                    }

                    setReplyingToCommentId(
                      selectedCommentForOptions.id
                    );

                    setEditingCommentId(
                      null
                    );

                    setCommentText('');
                    setAttachedCommentImage(
                      null
                    );
                  }}
                >
                  <Text
                    style={
                      styles.optionButtonText
                    }
                  >
                    REPLY
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.optionButton,
                  {
                    borderBottomWidth: 0,
                  },
                ]}
                onPress={() =>
                  setOptionsModalVisible(
                    false
                  )
                }
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    {
                      color:
                        colors.textSecondary,
                    },
                  ]}
                >
                  CANCEL
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    height: 54,
  },

  backButtonContainer: {
    overflow: 'hidden',
    justifyContent: 'center',
  },

  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    height: '100%',
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  searchAnimatedWrapper: {
    position: 'absolute',
    right: 4,
    height: 40,
    justifyContent: 'center',
  },

  searchInput: {
    width: '100%',
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  iconButton: {
    padding: 4,
  },

  searchIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor:
      '#D3E5D7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor:
      '#D3E5D7',
    paddingBottom: 8,
  },

  tabItem: {
    marginRight: 32,
    paddingBottom: 4,
  },

  tabText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  activeTabText: {
    color: PRIMARY_COLOR,
    fontWeight: '700',
    borderBottomWidth: 2,
    borderBottomColor:
      PRIMARY_COLOR,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },

  card: {
    backgroundColor:
      '#DCEFE0',
    borderRadius: 16,
    marginBottom: 16,
    padding: 12,
    borderWidth: 1,
    borderColor:
      '#C5E2CB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  cardHeaderText: {
    flex: 1,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#CCC',
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  cardAuthor: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
  },

  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EEE',
  },

  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  playButtonCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor:
      PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    marginTop: 10,
    paddingHorizontal: 4,
  },

  footerLeftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  actionIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor:
      '#E2EFE4',
    justifyContent: 'center',
    alignItems: 'center',
  },

  commentActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  commentCountText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  fadedNotificationContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    backgroundColor:
      'rgba(27,94,32,0.88)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    zIndex: 999,
    elevation: 4,
  },

  fadedNotificationText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },

  /*
   * FAB:
   *
   * The bottom position is supplied inline as:
   * insets.bottom + 2
   *
   * Therefore it sits exactly 2px above the
   * device's bottom safe-area/navigation region.
   */

  fab: {
    position: 'absolute',
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor:
      '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },

  /*
   * ---------------------------------------------------------
   * CREATE MODAL
   * ---------------------------------------------------------
   */

  createModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop:
      Platform.OS === 'ios'
        ? 44
        : 12,
  },

  createModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor:
      '#EFEFEF',
  },

  createModalHeaderTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  createModalScrollContent: {
    padding: 20,
    paddingBottom: 30,
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    marginTop: 12,
  },

  formInput: {
    backgroundColor:
      '#F0F4F1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor:
      '#E2EFE4',
    marginBottom: 8,
  },

  multilineInput: {
    height: 90,
    textAlignVertical:
      'top',
  },

  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      '#EAF4EC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor:
      '#C5E2CB',
    marginBottom: 8,
  },

  attachmentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    flex: 1,
  },

  thumbnailPreview: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 8,
  },

  referenceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  referenceTextInput: {
    flex: 1,
    marginBottom: 0,
  },

  addRefButton: {
    backgroundColor:
      PRIMARY_COLOR,
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  referenceListContainer: {
    marginTop: 10,
    gap: 6,
  },

  referenceBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    backgroundColor:
      '#F0F4F1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },

  referenceBadgeText: {
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },

  createModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor:
      '#EFEFEF',
    backgroundColor:
      '#FFFFFF',
    gap: 12,
  },

  discardButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor:
      '#F0F4F1',
    justifyContent: 'center',
    alignItems: 'center',
  },

  discardButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  createButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor:
      '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },

  createButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /*
   * ---------------------------------------------------------
   * RESOURCE MODAL
   * ---------------------------------------------------------
   */

  modalContainer: {
    flex: 1,
    backgroundColor:
      '#FFFFFF',
    paddingTop:
      Platform.OS === 'ios'
        ? 44
        : 12,
  },

  fullscreenModalContainer: {
    paddingTop: 0,
    backgroundColor:
      '#000000',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor:
      '#EFEFEF',
  },

  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  modalCloseButton: {
    padding: 4,
  },

  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  fullscreenScrollContent: {
    flexGrow: 1,
    backgroundColor:
      '#000000',
    padding: 0,
  },

  modalImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#EEE',
    marginBottom: 20,
  },

  /*
   * The fullscreen dimensions are supplied dynamically
   * using useWindowDimensions().
   */

  videoPlayerContainer: {
    width: '100%',
    height: 220,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },

  videoTouchContainer: {
    flex: 1,
  },

  videoGestureArea: {
    flex: 1,
    position: 'relative',
    backgroundColor:
      '#000000',
  },

  videoElement: {
    width: '100%',
    height: '100%',
  },

  /*
   * Controls are inset from the edges so the fullscreen
   * minimise button does not sit underneath the Android
   * system navigation area.
   */

  videoControlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: 12,
    backgroundColor:
      'rgba(0,0,0,0.70)',
    zIndex: 20,
  },

  videoControlBtn: {
    minWidth: 36,
    height: 36,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /*
   * Larger touch area around the progress bar makes
   * pressing and swiping reliable on phones.
   */

  progressBarWrapper: {
    flex: 1,
    height: 30,
    justifyContent:
      'center',
    marginHorizontal: 8,
  },

  progressBarBackground: {
    height: 4,
    width: '100%',
    backgroundColor:
      'rgba(255,255,255,0.30)',
    borderRadius: 2,
    overflow: 'hidden',
  },

  progressBarFill: {
    height: '100%',
    backgroundColor:
      PRIMARY_COLOR,
    borderRadius: 2,
  },

  progressThumb: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor:
      PRIMARY_COLOR,
    top: 10,
    marginLeft: -5,
  },

  /*
   * Video completion refresh control.
   */

  videoRestartButton: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 72,
    height: 72,
    marginLeft: -36,
    marginTop: -36,
    borderRadius: 36,
    backgroundColor:
      'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },

  gestureOverlayContainer: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    backgroundColor:
      'rgba(0,0,0,0.70)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 30,
  },

  gestureOverlayText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 16,
  },

  modalAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor:
      '#F9FBF9',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor:
      '#E8F2EA',
  },

  modalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#CCC',
  },

  modalAuthorLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform:
      'uppercase',
    fontWeight: '600',
  },

  modalAuthorName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  modalSection: {
    marginBottom: 20,
  },

  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },

  modalDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  referenceDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },

  referenceDetailText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  modalDownloadButton: {
    flexDirection: 'row',
    backgroundColor:
      '#2E7D32',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    marginTop: 10,
  },

  modalDownloadButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /*
   * ---------------------------------------------------------
   * COMMENTS
   * ---------------------------------------------------------
   */

  commentModalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.50)',
    justifyContent:
      'flex-end',
  },

  commentModalDismissArea: {
    flex: 1,
  },

  commentModalContentWrapper: {
    height: '75%',
    backgroundColor:
      '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    overflow: 'hidden',
  },

  commentHeaderGestureArea: {
    width: '100%',
  },

  commentModalHeader: {
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor:
      '#EFEFEF',
    flexDirection: 'row',
    justifyContent:
      'space-between',
    paddingHorizontal: 16,
  },

  commentModalIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor:
      '#CCC',
    position: 'absolute',
    top: 6,
    left: '50%',
    marginLeft: -18,
  },

  commentModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },

  commentCloseIcon: {
    padding: 4,
  },

  replyEditBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    backgroundColor:
      '#EAF4EC',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },

  replyEditText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },

  commentsListContainer: {
    padding: 16,
    paddingBottom: 20,
  },

  commentThreadWrapper: {
    marginBottom: 16,
  },

  commentItemContainer: {
    alignItems: 'flex-start',
  },

  commentAuthorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },

  commentAuthorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#CCC',
  },

  commentAuthorName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  commentBubbleBox: {
    backgroundColor:
      '#F0F4F1',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 40,
    maxWidth: '85%',
  },

  commentText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 18,
  },

  commentImageAttachment: {
    width: 160,
    height: 120,
    borderRadius: 8,
    marginBottom: 6,
  },

  repliesContainer: {
    marginTop: 8,
    marginLeft: 32,
    borderLeftWidth: 2,
    borderLeftColor:
      '#E0E0E0',
    paddingLeft: 12,
  },

  replyThreadWrapper: {
    marginTop: 8,
  },

  replyAuthorAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: 8,
    backgroundColor: '#CCC',
  },

  emptyCommentsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  emptyCommentsText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  attachedPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor:
      '#F9FBF9',
    borderTopWidth: 1,
    borderTopColor:
      '#EFEFEF',
  },

  attachedPreviewThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 10,
  },

  /*
   * This is deliberately safe-area aware.
   *
   * When the keyboard is closed:
   *   bottom = max(insets.bottom, 10)
   *
   * When the keyboard opens:
   *   the complete comment sheet is translated above
   *   the keyboard using keyboardTranslateY.
   */

  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor:
      '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor:
      '#EFEFEF',
  },

  commentAttachButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  commentTextInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    backgroundColor:
      '#F0F4F1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.textPrimary,
    marginHorizontal: 8,
  },

  commentSendButton: {
    backgroundColor:
      PRIMARY_COLOR,
    width: 38,
    minHeight: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },

  commentEditTextButton: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  commentSendButtonDisabled: {
    opacity: 0.4,
  },

  /*
   * ---------------------------------------------------------
   * COMMENT OPTIONS
   * ---------------------------------------------------------
   */

  optionsModalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.40)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  optionsModalDismissArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },

  optionsModalContent: {
    width: '80%',
    backgroundColor:
      '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    elevation: 5,
  },

  optionsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },

  optionsModalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },

  optionButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor:
      '#F0F0F0',
  },

  optionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
});