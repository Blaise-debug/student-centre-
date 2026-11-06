import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { colors } from '../theme/colors';

interface CustomHeaderProps {
  onPressMenu?: () => void;
  onPressNotifications?: () => void;
  onPressProfile?: () => void;
  onPressLogo?: () => void;
  onRefreshFeed?: () => void; // Added prop for feed refresh
}

export default function CustomHeader({
  onPressMenu,
  onPressNotifications,
  onPressProfile,
  onPressLogo,
  onRefreshFeed,
}: CustomHeaderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handleMenuPress = () => {
    if (onPressMenu) {
      onPressMenu();
    } else {
      navigation.dispatch(DrawerActions.openDrawer());
    }
  };

  const handleLogoPress = () => {
    if (onPressLogo) {
      onPressLogo();
    }
    // Triggers feed refresh if callback is provided
    if (onRefreshFeed) {
      onRefreshFeed();
    }
  };

  return (
    <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 12) }]}>
      {/* Line 1: Hamburger & Logo (Left) | Notifications & Profile (Right) */}
      <View style={styles.headerRow}>
        <View style={styles.leftGroup}>
          <TouchableOpacity onPress={handleMenuPress} style={styles.iconButton} accessibilityLabel="Open menu">
            <Ionicons name="menu" size={35} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.7} accessibilityLabel="Refresh feed">
            <Text style={styles.logoText}>Student Centre</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rightGroup}>
          <TouchableOpacity onPress={onPressNotifications} style={styles.iconButton} accessibilityLabel="Notifications">
            <Ionicons name="notifications" size={27} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onPressProfile} style={styles.iconButton} accessibilityLabel="Profile">
            <Ionicons name="person-circle" size={32} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: colors.background,
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 5,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 10,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 2,
    marginLeft: 0,
  },
});
