import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestPasswordReset } from '../../services/auth.service';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const [email, setEmail] = useState(route.params?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleRequest() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    setErrorMessage('');
    setMessage('');
    setIsSubmitting(true);
    try {
      await requestPasswordReset(normalizedEmail);
      setMessage('If an eligible account exists for that email, a reset link has been sent. Check your inbox and spam folder.');
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      setErrorMessage(apiError.response?.data?.message || 'Password reset is temporarily unavailable. Try again later.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>Enter the email address on your account. We’ll send a secure reset link if it is eligible.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          editable={!isSubmitting}
        />

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleRequest}
          disabled={isSubmitting}
          accessibilityRole="button"
        >
          {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Send reset link</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (user && navigation.canGoBack()) navigation.goBack();
            else if (!user) navigation.navigate('Login');
            else if (user.onboardingComplete) navigation.navigate('MainTabs', { screen: 'MainTabs', params: { screen: 'HomeTab' } });
            else navigation.navigate('Onboarding');
          }}
          style={styles.secondaryButton}
        >
          <Text style={styles.link}>Back to sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { marginTop: 10, marginBottom: 28, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' },
  input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  message: { marginTop: 14, color: colors.textSecondary, lineHeight: 21, textAlign: 'center' },
  error: { marginTop: 12, color: colors.danger, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', paddingVertical: 18 },
  link: { color: colors.primaryDark, fontSize: 15, fontWeight: '600' },
});
