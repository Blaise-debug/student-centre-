import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as ExpoLinking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';

import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import RootNavigator from './src/navigation/RootNavigator';
import { RootStackParamList } from './src/navigation/types';

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [ExpoLinking.createURL('/'), 'studentscentre://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
    },
  },
};

export default function App() {
  return (
    <KeyboardProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <SocketProvider>
            <StatusBar style="light" />

            <NavigationContainer linking={linking}>
              <RootNavigator />
            </NavigationContainer>
          </SocketProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </KeyboardProvider>
  );
}
