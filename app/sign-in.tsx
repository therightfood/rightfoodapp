import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { COLORS } from '@/constants/Colors';

export default function SignInScreen() {
  const { signInWithEmail, user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (user) {
      console.log('[SignIn] User authenticated, redirecting to home');
      router.replace('/(tabs)/(home)' as never);
    }
  }, [user]);

  const validateEmail = (value: string) => {
    if (!value.includes('@')) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = async () => {
    console.log('[SignIn] Sign in button pressed', { email });
    const emailValid = validateEmail(email);
    if (!emailValid) return;

    setGeneralError('');
    setIsLoading(true);
    try {
      console.log('[SignIn] Calling signInWithEmail', { email });
      await signInWithEmail(email, password);
      console.log('[SignIn] Sign in successful');
    } catch (err: unknown) {
      console.log('[SignIn] Sign in error', err);
      setGeneralError('Incorrect email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    console.log('[SignIn] Back button pressed');
    router.back();
  };

  const handleSignUp = () => {
    console.log('[SignIn] Get started link pressed');
    router.push('/sign-up');
  };

  const handleForgotPassword = () => {
    console.log('[SignIn] Forgot password pressed');
  };

  const togglePassword = () => {
    console.log('[SignIn] Toggle password visibility');
    setShowPassword((prev) => !prev);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <AnimatedPressable onPress={handleBack} style={styles.backButton}>
            <ChevronLeft size={24} color={COLORS.text} strokeWidth={2} />
          </AnimatedPressable>

          {/* Header */}
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your Right Food account.</Text>

          {/* General error banner */}
          {generalError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{generalError}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={[
                  styles.input,
                  emailFocused && styles.inputFocused,
                  emailError ? styles.inputError : null,
                ]}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (emailError) validateEmail(v);
                }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => {
                  setEmailFocused(false);
                  validateEmail(email);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                placeholder="e.g. you@email.com"
                placeholderTextColor={COLORS.textTertiary}
              />
              {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.label}>Password</Text>
                <AnimatedPressable onPress={handleForgotPassword}>
                  <Text style={styles.forgotLink}>Forgot password?</Text>
                </AnimatedPressable>
              </View>
              <View style={[
                styles.inputWrapper,
                passwordFocused && styles.inputFocused,
              ]}>
                <TextInput
                  ref={passwordRef}
                  style={styles.inputInner}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  placeholder="Your password"
                  placeholderTextColor={COLORS.textTertiary}
                />
                <TouchableOpacity onPress={togglePassword} style={styles.eyeButton}>
                  {showPassword
                    ? <EyeOff size={20} color={COLORS.textSecondary} strokeWidth={2} />
                    : <Eye size={20} color={COLORS.textSecondary} strokeWidth={2} />
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Submit */}
          <AnimatedPressable
            onPress={handleSubmit}
            disabled={isLoading}
            style={styles.submitButton}
          >
            {isLoading
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={styles.submitButtonText}>Sign in</Text>
            }
          </AnimatedPressable>

          {/* Bottom link */}
          <View style={styles.bottomRow}>
            <Text style={styles.bottomText}>Don't have an account?</Text>
            <AnimatedPressable onPress={handleSignUp}>
              <Text style={styles.bottomLink}> Get started</Text>
            </AnimatedPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    marginTop: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 32,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 8,
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: COLORS.dangerMuted,
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
  },
  errorBannerText: {
    fontSize: 14,
    color: COLORS.danger,
    lineHeight: 20,
  },
  form: {
    marginTop: 32,
    gap: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  forgotLink: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
  },
  inputFocused: {
    borderColor: COLORS.primary,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  eyeButton: {
    padding: 4,
  },
  fieldError: {
    fontSize: 13,
    color: COLORS.danger,
    marginTop: 2,
  },
  submitButton: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  bottomText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  bottomLink: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
