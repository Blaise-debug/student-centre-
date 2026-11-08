import React from 'react';
import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  View,
} from 'react-native';

import { RootStackParamList } from './types';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import VerifyEmailScreen from '../screens/Auth/VerifyEmailScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/Auth/ResetPasswordScreen';
import OnboardingScreen from '../screens/Onboarding/OnboardingScreen';

import DrawerNavigator from './DrawerNavigator';

import ChatModal from '../screens/Messages/ChatModal';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import NotificationsScreen from '../screens/Notifications/NotificationsScreen';

const Stack =
  createNativeStackNavigator<RootStackParamList>();

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator
        size="large"
        color={colors.primary}
      />
    </View>
  );
}

export default function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {!user ? (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
          />

          <Stack.Screen
            name="Register"
            component={RegisterScreen}
          />

          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      ) : !user.onboardingComplete ? (
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      ) : (
        <>
          <Stack.Screen
            name="MainTabs"
            component={DrawerNavigator}
          />

          <Stack.Screen
            name="ChatModal"
            component={ChatModal}
            options={{
              presentation: 'card',
              headerShown: true,
              headerStyle: {
                backgroundColor: colors.surface,
              },
              headerTintColor: colors.textPrimary,
              headerBackTitle: '',
            }}
          />

          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Edit Profile',
              headerStyle: {
                backgroundColor: colors.surface,
              },
              headerTintColor: colors.textPrimary,
            }}
          />

          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              headerShown: true,
              title: 'Profile',
              headerStyle: {
                backgroundColor: colors.surface,
              },
              headerTintColor: colors.textPrimary,
            }}
          />

          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{
              headerShown: true,
              title: 'Notifications',
              headerStyle: {
                backgroundColor: colors.surface,
              },
              headerTintColor: colors.textPrimary,
            }}
          />

          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
