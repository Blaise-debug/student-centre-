import { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Bottom Tab Navigator
 *
 * These are the five primary sections of the authenticated app.
 */
export type TabParamList = {
  HomeTab: undefined;
  LibraryTab: undefined;
  CommunityTab: undefined;
  MessagesTab: undefined;
  LiveEventsTab: undefined;
};

/**
 * Drawer Navigator
 *
 * The drawer currently hosts the bottom-tab navigator.
 *
 * Settings, Privacy, Support, and Donate are intentionally NOT included
 * here because those screens do not exist yet.
 */
export type DrawerParamList = {
  MainTabs: NavigatorScreenParams<TabParamList>;
};

/**
 * Root Stack Navigator
 *
 * Authentication screens and authenticated screens that sit above
 * the Drawer/Tab navigation hierarchy belong here.
 */
export type RootStackParamList = {
  // Authentication
  Login: undefined;
  Register: undefined;

  // Authenticated application
  MainTabs: NavigatorScreenParams<DrawerParamList>;

  // Global authenticated screens
  ChatModal: {
    conversationId: string;
    conversationName: string;
  };
  EditProfile: undefined;
  Profile: undefined;
  Notifications: undefined;
};

/**
 * Global React Navigation type augmentation.
 *
 * This allows React Navigation's hooks and navigation objects to
 * understand the application's root routes throughout the project.
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}