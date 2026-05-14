import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';

export default function ScanResultScreen() {
  const { photoUri } = useLocalSearchParams<{ photoUri: string }>();
  const router = useRouter();

  const handleBack = () => {
    console.log('[ScanResult] Back button pressed');
    router.back();
  };

  const photoSource = photoUri ? { uri: photoUri } : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ChevronLeft size={24} color={COLORS.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Your meal</Text>
        <View style={styles.headerSpacer} />
      </View>
      {photoSource ? (
        <Image source={photoSource} style={styles.photo} resizeMode="cover" />
      ) : null}
      <View style={styles.resultCard}>
        <Text style={styles.resultText}>Result screen coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSpacer: { width: 44 },
  photo: { width: '100%', height: 280 },
  resultCard: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  resultText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
