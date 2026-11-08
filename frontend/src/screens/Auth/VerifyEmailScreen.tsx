import React, { useEffect, useState } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { resendVerification } from '../../services/auth.service';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
  const { email, notice } = route.params;
  const { verifyEmail } = useAuth();
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState(notice || '');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((remaining) => remaining - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function handleVerify() {
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage('Enter the six-digit code from your email.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await verifyEmail(email, code);
      // Root navigation advances to the required academic onboarding after the session is set.
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string; code?: string } } };
      setErrorMessage(apiError.response?.data?.message || 'We could not verify that code. Try again.');
      if (apiError.response?.data?.code === 'EMAIL_ALREADY_VERIFIED') {
        setMessage('This email is already verified. Sign in to continue.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (seconds > 0 || isResending) return;
    setErrorMessage('');
    setIsResending(true);
    try {
      await resendVerification(email);
      setMessage('If this account still needs verification, a new code has been sent.');
      setSeconds(60);
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      setErrorMessage(apiError.response?.data?.message || 'Unable to resend the code right now.');
    } finally {
      setIsResending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>Enter the six-digit code sent to</Text>
        <Text style={styles.email}>{email}</Text>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <TextInput
          style={[styles.input, styles.codeInput]}
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          editable={!isSubmitting}
          accessibilityLabel="Email verification code"
        />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={isSubmitting}
          accessibilityRole="button"
        >
          {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Verify email</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleResend}
          disabled={seconds > 0 || isResending}
          style={styles.secondaryButton}
          accessibilityRole="button"
        >
          {isResending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.link, seconds > 0 && styles.disabledLink]}>
              {seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.secondaryButton}>
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
  subtitle: { marginTop: 8, fontSize: 16, color: colors.textSecondary, textAlign: 'center' },
  email: { marginTop: 4, marginBottom: 24, fontSize: 16, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  message: { marginBottom: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 10, fontWeight: '700' },
  error: { marginTop: 10, color: colors.danger, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', paddingVertical: 14 },
  link: { color: colors.primaryDark, fontSize: 15, fontWeight: '600' },
  disabledLink: { color: colors.textSecondary },
});
