import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  CompositeNavigationProp,
  DrawerActions,
  useNavigation,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TabParamList,
  DrawerParamList,
  RootStackParamList,
} from './types';
import { colors } from '../theme/colors';

import HomeScreen from '../screens/HomeScreen';
import LibraryScreen from '../screens/LibraryScreen';
import CommunityScreen from '../screens/ExploreScreen';
import MessagesScreen from '../screens/Messages/MessagesScreen';
import EventsScreen from '../screens/EventsScreen';
import CustomHeader from '../components/CustomHeader';

const Tab = createBottomTabNavigator<TabParamList>();

/**
 * Navigation available from the Tab Navigator:
 *
 * Tab → Drawer → Root Stack
 *
 * This allows the header to:
 * - open the Drawer
 * - navigate to Profile
 * - navigate to Notifications
 */
type TabNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  CompositeNavigationProp<
    DrawerNavigationProp<DrawerParamList>,
    NativeStackNavigationProp<RootStackParamList>
  >
>;

export default function TabNavigator() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<TabNavigationProp>();

  const bottomPadding = insets.bottom > 0 ? insets.bottom : 8;

  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefreshHome = () => {
    setRefreshKey((previousKey) => previousKey + 1);
  };

  const handleOpenDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleOpenNotifications = () => {
    navigation.navigate('Notifications');
  };

  const handleOpenProfile = () => {
    navigation.navigate('Profile');
  };

  return (
    <Tab.Navigator
      screenOptions={{
        header: () => (
          <CustomHeader
            onPressMenu={handleOpenDrawer}
            onPressNotifications={handleOpenNotifications}
            onPressProfile={handleOpenProfile}
            onRefreshFeed={handleRefreshHome}
          />
        ),

        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },

        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,

        tabBarShowLabel: true,

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={28}
              color={color}
            />
          ),
        }}
      >
        {(props) => (
          <HomeScreen
            {...props}
            key={refreshKey}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="LibraryTab"
        component={LibraryScreen}
        options={{
          title: 'Library',
          tabBarLabel: 'Library',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'book' : 'book-outline'}
              size={28}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="CommunityTab"
        component={CommunityScreen}
        options={{
          title: 'Community',
          tabBarLabel: 'Community',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={28}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="MessagesTab"
        component={MessagesScreen}
        options={{
          title: 'Messages',
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={
                focused
                  ? 'chatbubbles'
                  : 'chatbubbles-outline'
              }
              size={28}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="LiveEventsTab"
        component={EventsScreen}
        options={{
          title: 'Events',
          tabBarLabel: 'Events',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'videocam' : 'videocam-outline'}
              size={28}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}