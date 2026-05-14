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
import { ChevronLeft, Eye, EyeOff, AlertCircle } from 'lucide-react-native';
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
      router.replace('/(tabs)/(scan)' as never);
    }
  }, [user, router]);

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

  const emailBorderColor = emailError ? COLORS.danger : emailFocused ? '#4A7C59' : '#E8E6E0';
  const emailBorderWidth = emailFocused ? 1.5 : 1;
  const passwordBorderColor = passwordFocused ? '#4A7C59' : '#E8E6E0';
  const passwordBorderWidth = passwordFocused ? 1.5 : 1;

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
              <AlertCircle size={16} color="#C0392B" />
              <Text style={styles.errorBannerText}>{generalError}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: emailBorderColor, borderWidth: emailBorderWidth },
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
              {emailError ? (
                <View style={styles.fieldErrorRow}>
                  <AlertCircle size={13} color={COLORS.danger} />
                  <Text style={styles.fieldError}>{emailError}</Text>
                </View>
              ) : null}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.label}>PASSWORD</Text>
                <AnimatedPressable onPress={handleForgotPassword}>
                  <Text style={styles.forgotLink}>Forgot password?</Text>
                </AnimatedPressable>
              </View>
              <View style={[
                styles.inputWrapper,
                { borderColor: passwordBorderColor, borderWidth: passwordBorderWidth },
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
            style={[styles.submitButton, isLoading && { opacity: 0.7 }]}
          >
            {isLoading
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={styles.submitButtonText}>Sign in</Text>
            }
          </AnimatedPressable>

          {/* Bottom link */}
          <View style={styles.bottomRow}>
            <Text style={styles.bottomText}>Don't have an account?</Text>
            <AnimatedPressable onPress={handleSignUp} style={styles.bottomLinkButton}>
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
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 32,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    color: '#7A6A5A',
    marginTop: 8,
    lineHeight: 24,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(192, 57, 43, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginTop: 20,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#C0392B',
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
    fontSize: 13,
    fontWeight: '600',
    color: '#7A6A5A',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  forgotLink: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F5F3EF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3EF',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  eyeButton: {
    padding: 4,
  },
  fieldErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  fieldError: {
    fontSize: 13,
    color: COLORS.danger,
  },
  submitButton: {
    height: 56,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    boxShadow: '0 4px 16px rgba(74, 124, 89, 0.20)',
  } as any,
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  bottomText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  bottomLinkButton: {
    paddingVertical: 4,
  },
  bottomLink: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A7C59',
  },
});
