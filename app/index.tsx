import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Leaf } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { NotificationBell } from "@/components/NotificationBell";
import { COLORS } from '@/constants/Colors';
import { apiGet } from '@/utils/api';

interface UserProfile {
  onboarding_completed?: boolean;
}

export default function WelcomeScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Loading wordmark pulse
  const loadingOpacity = useRef(new Animated.Value(0.6)).current;

  // Entrance animations
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(12)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(12)).current;
  const subtextOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(8)).current;

  // Loading pulse animation
  useEffect(() => {
    if (loading && Platform.OS !== 'web') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(loadingOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(loadingOpacity, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => { pulse.stop(); };
    }
    return undefined;
  }, [loading, loadingOpacity]);

  useEffect(() => {
    if (!loading) {
      if (user) {
        console.log('[Welcome] User authenticated, fetching profile to check onboarding status');
        apiGet<UserProfile>('/api/profile')
          .then((profile) => {
            console.log('[Welcome] Profile fetched:', profile);
            if (profile?.onboarding_completed === true) {
              console.log('[Welcome] Onboarding complete, redirecting to home');
              router.replace('/(tabs)/(scan)' as never);
            } else {
              console.log('[Welcome] Onboarding not complete, redirecting to onboarding');
              router.replace('/onboarding' as never);
            }
          })
          .catch((err) => {
            console.error('[Welcome] Failed to fetch profile, defaulting to onboarding:', err);
            router.replace('/onboarding' as never);
          });
      } else {
        console.log('[Welcome] No user found, showing welcome screen');
        if (Platform.OS !== 'web') {
          Animated.parallel([
            Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(logoTranslateY, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.timing(headlineOpacity, { toValue: 1, duration: 350, delay: 200, useNativeDriver: true }),
            Animated.timing(headlineTranslateY, { toValue: 0, duration: 350, delay: 200, useNativeDriver: true }),
            Animated.timing(subtextOpacity, { toValue: 1, duration: 300, delay: 350, useNativeDriver: true }),
            Animated.timing(buttonsOpacity, { toValue: 1, duration: 300, delay: 500, useNativeDriver: true }),
            Animated.timing(buttonsTranslateY, { toValue: 0, duration: 300, delay: 500, useNativeDriver: true }),
          ]).start();
        }
      }
    }
  }, [loading, user, router, logoOpacity, logoTranslateY, headlineOpacity, headlineTranslateY, subtextOpacity, buttonsOpacity, buttonsTranslateY]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <NotificationBell />
        {Platform.OS !== 'web' ? (
          <Animated.View style={[styles.loadingWordmarkRow, { opacity: loadingOpacity }]}>
            <Leaf size={28} color={COLORS.primary} strokeWidth={2} />
            <Text style={styles.loadingWordmark}>Right Food</Text>
          </Animated.View>
        ) : (
          <View style={styles.loadingWordmarkRow}>
            <Leaf size={28} color={COLORS.primary} strokeWidth={2} />
            <Text style={styles.loadingWordmark}>Right Food</Text>
          </View>
        )}
      </View>
    );
  }

  if (user) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingWordmarkRow}>
          <Leaf size={28} color={COLORS.primary} strokeWidth={2} />
          <Text style={styles.loadingWordmark}>Right Food</Text>
        </View>
      </View>
    );
  }

  const handleGetStarted = () => {
    console.log('[Welcome] Get started button pressed');
    router.push('/sign-up');
  };

  const handleSignIn = () => {
    console.log('[Welcome] Sign in link pressed');
    router.push('/sign-in');
  };

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Top section */}
          <View style={styles.topSection}>
            <View style={styles.wordmarkRow}>
              <Leaf size={28} color={COLORS.primary} strokeWidth={2} />
              <Text style={styles.wordmark}>Right Food</Text>
            </View>

            <Text style={styles.headline}>Eat the right amount. Every meal.</Text>
            <Text style={styles.subtext}>
              Your AI meal companion for GLP-1 medications.
            </Text>
          </View>

          {/* Bottom section */}
          <View style={styles.bottomSection}>
            <AnimatedPressable onPress={handleGetStarted} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Get started</Text>
            </AnimatedPressable>

            <AnimatedPressable onPress={handleSignIn} style={styles.signInRow}>
              <Text style={styles.signInText}>Already have an account?</Text>
              <Text style={styles.signInLink}> Sign in</Text>
            </AnimatedPressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top section */}
        <View style={styles.topSection}>
          <Animated.View
            style={[
              styles.wordmarkRow,
              { opacity: logoOpacity, transform: [{ translateY: logoTranslateY }] },
            ]}
          >
            <Leaf size={28} color={COLORS.primary} strokeWidth={2} />
            <Text style={styles.wordmark}>Right Food</Text>
          </Animated.View>

          <Animated.View
            style={{ opacity: headlineOpacity, transform: [{ translateY: headlineTranslateY }] }}
          >
            <Text style={styles.headline}>Eat the right amount. Every meal.</Text>
          </Animated.View>

          <Animated.View style={{ opacity: subtextOpacity }}>
            <Text style={styles.subtext}>
              Your AI meal companion for GLP-1 medications.
            </Text>
          </Animated.View>
        </View>

        {/* Bottom section */}
        <Animated.View
          style={[
            styles.bottomSection,
            { opacity: buttonsOpacity, transform: [{ translateY: buttonsTranslateY }] },
          ]}
        >
          <AnimatedPressable onPress={handleGetStarted} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Get started</Text>
          </AnimatedPressable>

          <AnimatedPressable onPress={handleSignIn} style={styles.signInRow}>
            <Text style={styles.signInText}>Already have an account?</Text>
            <Text style={styles.signInLink}> Sign in</Text>
          </AnimatedPressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FAFAF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingWordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingWordmark: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 24,
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    gap: 0,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  subtext: {
    fontSize: 17,
    fontWeight: '400',
    color: '#7A6A5A',
    lineHeight: 26,
    marginTop: 12,
  },
  bottomSection: {
    paddingBottom: 8,
  },
  primaryButton: {
    height: 56,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 4px 16px rgba(74, 124, 89, 0.25)',
  } as any,
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  signInText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#7A6A5A',
  },
  signInLink: {
    fontSize: 16,
    fontWeight: '500',
    color: '#7A6A5A',
    textDecorationLine: 'underline',
  },
});
