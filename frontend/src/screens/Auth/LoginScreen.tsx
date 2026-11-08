import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { RootStackParamList } from '../../navigation/types';

type LoginNavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginNavProp>();
  const { login } = useAuth();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin() {
    if (!emailOrUsername.trim() || !password) {
      Alert.alert('Missing information', 'Please enter your email/username and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(emailOrUsername.trim(), password);
      // Navigation happens automatically — RootNavigator switches stacks once `user` is set
    } catch (error: unknown) {
      const apiError = error as {
        response?: { data?: { message?: string; code?: string; email?: string } };
      };
      if (apiError.response?.data?.code === 'EMAIL_NOT_VERIFIED' && apiError.response.data.email) {
        navigation.navigate('VerifyEmail', {
          email: apiError.response.data.email,
          notice: 'Verify your email before signing in. You can request a new code below.',
        });
      } else {
        Alert.alert(
          'Unable to sign in',
          apiError.response?.data?.message || 'Please check your details and try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Student Centre</Text>
        <Text style={styles.subtitle}>Welcome back</Text>

        <TextInput
          style={styles.input}
          placeholder="Email or username"
          placeholderTextColor={colors.textSecondary}
          value={emailOrUsername}
          onChangeText={setEmailOrUsername}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSubmitting}
        />

        <TouchableOpacity
          style={styles.forgotPasswordButton}
          onPress={() => navigation.navigate('ForgotPassword', {
            email: emailOrUsername.includes('@') ? emailOrUsername.trim() : undefined,
          })}
          disabled={isSubmitting}
        >
          <Text style={styles.forgotPasswordText}>Forgot password?</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={!isSubmitting}
        />

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Register')}
          disabled={isSubmitting}
        >
          <Text style={styles.linkText}>
            Don't have an account? <Text style={styles.linkTextBold}>Register</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
    paddingHorizontal: 2,
    marginTop: -3,
    marginBottom: 8,
  },
  forgotPasswordText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 14,
  },
  linkTextBold: {
    color: colors.primary,
    fontWeight: '600',
  },
});
