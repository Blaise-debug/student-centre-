import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { completePasswordReset } from '../../services/auth.service';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen({ route, navigation }: Props) {
  const { logout } = useAuth();
  const token = route.params?.token || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleReset() {
    if (!token) {
      setErrorMessage('This reset link is missing its token. Request a new link from sign in.');
      return;
    }
    if (password.length < 8 || password.length > 72 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage('Use 8-72 characters with a letter and a number.');
      return;
    }
    if (password !== confirmation) {
      setErrorMessage('The passwords do not match.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await completePasswordReset(token, password);
      await logout().catch(() => undefined);
      Alert.alert('Password updated', 'Sign in with your new password.');
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      setErrorMessage(apiError.response?.data?.message || 'The reset link may have expired. Request a new one and try again.');
    } finally {
      setIsSubmitting(false);
      setPassword('');
      setConfirmation('');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Choose a new password</Text>
        <Text style={styles.subtitle}>Your reset link can be used once and expires after 30 minutes.</Text>

        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          autoCapitalize="none"
          maxLength={72}
          editable={!isSubmitting}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor={colors.textSecondary}
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          autoCapitalize="none"
          maxLength={72}
          editable={!isSubmitting}
        />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleReset}
          disabled={isSubmitting}
          accessibilityRole="button"
        >
          {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Update password</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword', undefined)} style={styles.secondaryButton}>
          <Text style={styles.link}>Request a new reset link</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  title: { fontSize: 27, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { marginTop: 10, marginBottom: 28, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' },
  input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  error: { marginTop: 4, color: colors.danger, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', paddingVertical: 18 },
  link: { color: colors.primaryDark, fontSize: 15, fontWeight: '600' },
});
