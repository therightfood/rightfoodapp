import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
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

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

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
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 400,
            delay: 100,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 400,
            delay: 100,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start();
      }
    }
  }, [loading, user, opacity, router, translateY]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
                <NotificationBell />
        
<ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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

  const children = (
    <>
      {/* Top section */}
      <View style={styles.topSection}>
        <View style={styles.wordmarkRow}>
          <Leaf size={28} color={COLORS.primary} strokeWidth={2} />
          <Text style={styles.wordmark}>Right Food</Text>
        </View>

        <View style={styles.divider} />

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

        <View style={styles.signInRow}>
          <Text style={styles.signInText}>Already have an account?</Text>
          <AnimatedPressable onPress={handleSignIn}>
            <Text style={styles.signInLink}> Sign in</Text>
          </AnimatedPressable>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {Platform.OS === 'web' ? (
        <View style={styles.container}>
          {children}
        </View>
      ) : (
        <Animated.View
          style={[
            styles.container,
            { opacity, transform: [{ translateY }] },
          ]}
        >
          {children}
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 32,
    marginBottom: 32,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
    lineHeight: 36,
  },
  subtext: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.textSecondary,
    lineHeight: 24,
    marginTop: 12,
  },
  bottomSection: {
    paddingBottom: 8,
  },
  primaryButton: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  signInText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  signInLink: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
