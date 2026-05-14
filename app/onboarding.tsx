import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Leaf } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { COLORS } from '@/constants/Colors';

export default function OnboardingScreen() {
  const router = useRouter();

  const handleContinue = () => {
    console.log('[Onboarding] Continue button pressed');
    router.replace('/(tabs)/(home)' as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Centered content */}
        <View style={styles.centerContent}>
          <View style={styles.iconCircle}>
            <Leaf size={48} color={COLORS.primary} strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>Let's get you set up</Text>
          <Text style={styles.subtitle}>
            We'll personalize your portion guidance based on your medication and body.
          </Text>
        </View>

        {/* Continue button */}
        <AnimatedPressable onPress={handleContinue} style={styles.continueButton}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 24,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 280,
    lineHeight: 22,
  },
  continueButton: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
