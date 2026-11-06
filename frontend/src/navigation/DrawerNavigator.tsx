import React from 'react';
import {
  Alert,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';

import TabNavigator from './TabNavigator';
import { colors } from '../theme/colors';
import { DrawerParamList } from './types';
import { useAuth } from '../context/AuthContext';

const Drawer = createDrawerNavigator<DrawerParamList>();

function CustomDrawerContent(
  props: DrawerContentComponentProps
) {
  const { navigation } = props;
  const { logout } = useAuth();

  const handleUnavailableScreen = (screenName: string) => {
    navigation.closeDrawer();

    Alert.alert(
      screenName,
      `${screenName} is not yet available.`
    );
  };

  const handleShareApp = async () => {
    navigation.closeDrawer();

    try {
      await Share.share({
        message:
          'Check out Student Centre — a global academic and learning platform.',
      });
    } catch {
      // The native share sheet may be dismissed by the user.
      // No navigation state needs to be changed.
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              navigation.closeDrawer();
              await logout();
            } catch {
              Alert.alert(
                'Logout Failed',
                'Unable to log out right now. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.container}
    >
      <View style={styles.menuItems}>
        <DrawerItem
          label="Settings"
          icon={({ color, size }) => (
            <Ionicons
              name="settings-outline"
              size={size}
              color={color}
            />
          )}
          activeTintColor={colors.primary}
          activeBackgroundColor={`${colors.primary}1A`}
          onPress={() => handleUnavailableScreen('Settings')}
        />

        <DrawerItem
          label="Privacy"
          icon={({ color, size }) => (
            <Ionicons
              name="shield-checkmark-outline"
              size={size}
              color={color}
            />
          )}
          activeTintColor={colors.primary}
          activeBackgroundColor={`${colors.primary}1A`}
          onPress={() => handleUnavailableScreen('Privacy')}
        />

        <DrawerItem
          label="Support"
          icon={({ color, size }) => (
            <Ionicons
              name="help-circle-outline"
              size={size}
              color={color}
            />
          )}
          activeTintColor={colors.primary}
          activeBackgroundColor={`${colors.primary}1A`}
          onPress={() => handleUnavailableScreen('Support')}
        />

        <DrawerItem
          label="Donate"
          icon={({ color, size }) => (
            <Ionicons
              name="heart-outline"
              size={size}
              color={color}
            />
          )}
          activeTintColor={colors.primary}
          activeBackgroundColor={`${colors.primary}1A`}
          onPress={() => handleUnavailableScreen('Donate')}
        />

        <DrawerItem
          label="Share App"
          icon={({ color, size }) => (
            <Ionicons
              name="share-social-outline"
              size={size}
              color={color}
            />
          )}
          activeTintColor={colors.primary}
          activeBackgroundColor={`${colors.primary}1A`}
          onPress={handleShareApp}
        />

        <DrawerItem
          label="Log Out"
          icon={({ color, size }) => (
            <Ionicons
              name="log-out-outline"
              size={size}
              color={color}
            />
          )}
          activeTintColor={colors.primary}
          activeBackgroundColor={`${colors.primary}1A`}
          onPress={handleLogout}
        />
      </View>
    </DrawerContentScrollView>
  );
}

export default function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => (
        <CustomDrawerContent {...props} />
      )}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: colors.primary,
        drawerActiveBackgroundColor: `${colors.primary}1A`,
        drawerInactiveTintColor:
          colors.textSecondary || '#666',
      }}
    >
      <Drawer.Screen
        name="MainTabs"
        component={TabNavigator}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
  },

  menuItems: {
    flex: 1,
  },
});