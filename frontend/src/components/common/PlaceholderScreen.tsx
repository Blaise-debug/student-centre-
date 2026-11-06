import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../../theme/colors';

export default function PlaceholderScreen({ name }: { name: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: colors.textPrimary, fontSize: 18 }}>{name} Screen</Text>
    </View>
  );
}