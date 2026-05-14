import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Camera,
  Image as ImageIcon,
  ScrollText,
  AlertCircle,
  ChevronLeft,
  Flame,
  Zap,
  Pill,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { authClient } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  name: string;
  description: string;
  price: string;
  estimated_calories: number;
  estimated_protein_g: number;
  category: 'starter' | 'main' | 'dessert' | 'drink';
}

interface RecommendedItem extends MenuItem {
  recommendation_reason: string;
}

interface MenuAnalysisResult {
  session_id: string;
  image_url: string;
  extracted_items: MenuItem[];
  recommendations: RecommendedItem[];
  medication: string | null;
  dose_mg: number | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RecommendationCard({
  item,
  onScanPress,
}: {
  item: RecommendedItem;
  onScanPress: () => void;
}) {
  const router = useRouter();
  const calories = item.estimated_calories;
  const protein = item.estimated_protein_g;
  const hasPrice = item.price && item.price.trim().length > 0;

  const handleScan = () => {
    console.log('[Menus] Scan recommended dish pressed:', item.name);
    router.push('/(tabs)/(scan)');
  };

  return (
    <View style={styles.recommendationCard}>
      <Text style={styles.recommendationName}>{item.name}</Text>
      <Text style={styles.recommendationReason}>{item.recommendation_reason}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Flame size={13} color={COLORS.accent} />
          <Text style={styles.statText}>{calories}</Text>
          <Text style={styles.statText}> kcal</Text>
        </View>
        <View style={styles.statItem}>
          <Zap size={13} color={COLORS.primary} />
          <Text style={styles.statText}>{protein}</Text>
          <Text style={styles.statText}>g protein</Text>
        </View>
        {hasPrice && (
          <Text style={styles.statText}>{item.price}</Text>
        )}
      </View>
      <AnimatedPressable style={styles.scanDishButton} onPress={handleScan}>
        <Camera size={13} color={COLORS.primary} />
        <Text style={styles.scanDishText}>Scan this dish</Text>
      </AnimatedPressable>
    </View>
  );
}

function MenuItemRow({
  item,
  isFirst,
  isLast,
  isRecommended,
}: {
  item: MenuItem;
  isFirst: boolean;
  isLast: boolean;
  isRecommended: boolean;
}) {
  const hasDescription = item.description && item.description.trim().length > 0;
  const hasPrice = item.price && item.price.trim().length > 0;
  const calories = item.estimated_calories;
  const protein = item.estimated_protein_g;
  const macroText = `${calories} kcal · ${protein}g protein`;

  const itemStyle = [
    styles.menuItemRow,
    isFirst && styles.menuItemFirst,
    isLast && styles.menuItemLast,
    isRecommended && styles.menuItemRecommended,
  ];

  return (
    <View style={itemStyle}>
      {isRecommended && <View style={styles.recommendedDot} />}
      <Text style={styles.menuItemName}>{item.name}</Text>
      {hasDescription && (
        <Text style={styles.menuItemDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      <View style={styles.menuItemBottom}>
        <Text style={styles.menuItemMacro}>{macroText}</Text>
        {hasPrice && <Text style={styles.menuItemPrice}>{item.price}</Text>}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['starter', 'main', 'dessert', 'drink'];

export default function MenusScreen() {
  const router = useRouter();
  const [screenState, setScreenState] = useState<'idle' | 'loading' | 'results'>('idle');
  const [result, setResult] = useState<MenuAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeMenu = async (uri: string) => {
    console.log('[Menus] analyzeMenu called, uri:', uri);
    setScreenState('loading');
    setError(null);

    try {
      const session = await authClient.getSession();
      const token = session?.data?.session?.token;
      console.log('[Menus] POST /api/menus/analyze — token present:', !!token);

      const formData = new FormData();
      formData.append('image', { uri, type: 'image/jpeg', name: 'menu.jpg' } as any);

      const res = await fetch(
        'https://3pqctptn272ematfhedrjv4we23tdyxd.app.specular.dev/api/menus/analyze',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      console.log('[Menus] /api/menus/analyze response status:', res.status);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).error || 'Could not read the menu');
      }

      const data: MenuAnalysisResult = await res.json();
      console.log('[Menus] Analysis success, items:', data.extracted_items?.length, 'recommendations:', data.recommendations?.length);
      setResult(data);
      setScreenState('results');
    } catch (err: any) {
      console.log('[Menus] analyzeMenu error:', err.message);
      setError(err.message || 'Could not read the menu. Please try a clearer photo.');
      setScreenState('idle');
    }
  };

  const handleTakePhoto = async () => {
    console.log('[Menus] Take photo pressed');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      console.log('[Menus] Camera permission denied');
      setError('Camera permission is required to take a photo.');
      return;
    }
    const pickerResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (!pickerResult.canceled && pickerResult.assets.length > 0) {
      console.log('[Menus] Photo taken:', pickerResult.assets[0].uri);
      analyzeMenu(pickerResult.assets[0].uri);
    } else {
      console.log('[Menus] Camera cancelled');
    }
  };

  const handleChooseFromLibrary = async () => {
    console.log('[Menus] Choose from library pressed');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.log('[Menus] Media library permission denied');
      setError('Photo library permission is required.');
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (!pickerResult.canceled && pickerResult.assets.length > 0) {
      console.log('[Menus] Image selected:', pickerResult.assets[0].uri);
      analyzeMenu(pickerResult.assets[0].uri);
    } else {
      console.log('[Menus] Library picker cancelled');
    }
  };

  const handleReset = () => {
    console.log('[Menus] Reset to idle pressed');
    setScreenState('idle');
    setResult(null);
  };

  // ── Idle state ──────────────────────────────────────────────────────────────

  if (screenState === 'idle') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.idleScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.idleHeader}>
            <Text style={styles.idleTitle}>Menus</Text>
            <Text style={styles.idleSubtitle}>Get personalized dish recommendations</Text>
          </View>

          <View style={styles.uploadCard}>
            <View style={styles.uploadIconCircle}>
              <ScrollText size={36} color={COLORS.primary} strokeWidth={1.5} />
            </View>
            <Text style={styles.uploadCardTitle}>Take a photo of a menu</Text>
            <Text style={styles.uploadCardSubtitle}>
              Point your camera at any restaurant menu
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <AnimatedPressable style={styles.primaryButton} onPress={handleTakePhoto}>
              <Camera size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Take photo</Text>
            </AnimatedPressable>
            <AnimatedPressable style={styles.secondaryButton} onPress={handleChooseFromLibrary}>
              <ImageIcon size={16} color={COLORS.textSecondary} />
              <Text style={styles.secondaryButtonText}>Choose from library</Text>
            </AnimatedPressable>
          </View>

          {error !== null && (
            <View style={styles.errorContainer}>
              <AlertCircle size={18} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Loading state ───────────────────────────────────────────────────────────

  if (screenState === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingTitle}>Reading the menu...</Text>
          <Text style={styles.loadingSubtitle}>This takes a few seconds</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Results state ───────────────────────────────────────────────────────────

  if (!result) return null;

  const recommendedNames = new Set(result.recommendations.map((r) => r.name.toLowerCase()));
  const hasRecommendations = result.recommendations.length > 0;
  const recommendationCount = result.recommendations.length;

  const medicationName = result.medication
    ? result.medication.charAt(0).toUpperCase() + result.medication.slice(1)
    : null;
  const hasMedication = !!medicationName;

  // Group items by category
  const grouped: Record<string, MenuItem[]> = {};
  for (const item of result.extracted_items) {
    const cat = item.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  const sortedCategories = [
    ...CATEGORY_ORDER.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  const totalItems = result.extracted_items.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.resultsScroll} showsVerticalScrollIndicator={false}>
        {/* Header row */}
        <View style={styles.resultsHeader}>
          <AnimatedPressable style={styles.backButton} onPress={handleReset}>
            <ChevronLeft size={22} color={COLORS.text} />
          </AnimatedPressable>
          <Text style={styles.resultsTitle}>Menu Analysis</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Medication pill */}
        {hasMedication && (
          <View style={styles.medicationPillWrapper}>
            <View style={styles.medicationPill}>
              <Pill size={12} color={COLORS.primary} />
              <Text style={styles.medicationPillText}>
                Optimized for {medicationName} {result.dose_mg}mg
              </Text>
            </View>
          </View>
        )}

        {/* Recommended section */}
        {hasRecommendations && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recommended for you</Text>
              <Text style={styles.sectionSubtitle}>
                {recommendationCount} dishes picked for your medication
              </Text>
            </View>
            <View style={styles.recommendationList}>
              {result.recommendations.map((item, idx) => (
                <RecommendationCard
                  key={`rec-${idx}`}
                  item={item}
                  onScanPress={() => {
                    console.log('[Menus] Scan dish pressed from results:', item.name);
                    router.push('/(tabs)/(scan)');
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Full menu section */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Full menu</Text>
            <Text style={styles.sectionSubtitle}>{totalItems} items</Text>
          </View>

          {sortedCategories.map((category) => {
            const items = grouped[category];
            const categoryLabel = category.toUpperCase();
            return (
              <View key={category}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryLabel}>{categoryLabel}</Text>
                </View>
                <View style={styles.categoryItems}>
                  {items.map((item, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === items.length - 1;
                    const isRecommended = recommendedNames.has(item.name.toLowerCase());
                    return (
                      <MenuItemRow
                        key={`${category}-${idx}`}
                        item={item}
                        isFirst={isFirst}
                        isLast={isLast}
                        isRecommended={isRecommended}
                      />
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Idle
  idleScroll: {
    paddingBottom: 40,
  },
  idleHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  idleTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  idleSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  uploadCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    padding: 32,
    alignItems: 'center',
  },
  uploadIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 16,
  },
  uploadCardSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  buttonRow: {
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flex: 1,
    height: 52,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  errorContainer: {
    marginHorizontal: 16,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(192, 57, 43, 0.08)',
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.danger,
    lineHeight: 20,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
  },

  // Results
  resultsScroll: {
    paddingBottom: 100,
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  medicationPillWrapper: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  medicationPill: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  medicationPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  recommendationList: {
    marginHorizontal: 16,
    gap: 10,
  },
  recommendationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: 16,
  },
  recommendationName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  recommendationReason: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 4,
    fontStyle: 'italic',
  },
  statsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  scanDishButton: {
    marginTop: 12,
    height: 40,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  scanDishText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  divider: {
    marginVertical: 20,
    marginHorizontal: 16,
    height: 1,
    backgroundColor: COLORS.border,
  },
  categoryHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  categoryItems: {
    marginHorizontal: 16,
    gap: 1,
  },
  menuItemRow: {
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 0,
    position: 'relative',
  },
  menuItemFirst: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  menuItemLast: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  menuItemRecommended: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  recommendedDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  menuItemDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  menuItemBottom: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItemMacro: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  menuItemPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
});
