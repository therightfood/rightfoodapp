import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
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

// ─── Pulsing Dots ─────────────────────────────────────────────────────────────

function PulsingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const makePulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );

    const a1 = makePulse(dot1, 0);
    const a2 = makePulse(dot2, 200);
    const a3 = makePulse(dot3, 400);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  if (Platform.OS === 'web') {
    return (
      <View style={pulseStyles.row}>
        <View style={pulseStyles.dot} />
        <View style={pulseStyles.dot} />
        <View style={pulseStyles.dot} />
      </View>
    );
  }

  return (
    <View style={pulseStyles.row}>
      <Animated.View style={[pulseStyles.dot, { opacity: dot1 }]} />
      <Animated.View style={[pulseStyles.dot, { opacity: dot2 }]} />
      <Animated.View style={[pulseStyles.dot, { opacity: dot3 }]} />
    </View>
  );
}

const pulseStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4A7C59' },
});

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

  const caloriesText = String(calories) + ' kcal';
  const proteinText = String(protein) + 'g protein';

  const handleScan = () => {
    console.log('[Menus] Scan recommended dish pressed:', item.name);
    router.push('/(tabs)/(scan)');
  };

  return (
    <View style={styles.recommendationCard}>
      <Text style={styles.recommendationName}>{item.name}</Text>
      <Text style={styles.recommendationReason}>{item.recommendation_reason}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Flame size={12} color={COLORS.accent} />
          <Text style={styles.statText}>{caloriesText}</Text>
        </View>
        <View style={styles.statPill}>
          <Zap size={12} color="#4A7C59" />
          <Text style={styles.statText}>{proteinText}</Text>
        </View>
        {hasPrice && (
          <View style={styles.statPill}>
            <Text style={styles.statText}>{item.price}</Text>
          </View>
        )}
      </View>
      <AnimatedPressable style={styles.scanDishButton} onPress={handleScan}>
        <Camera size={13} color="#4A7C59" />
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
              <ScrollText size={40} color="#4A7C59" strokeWidth={1.5} />
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
              <ImageIcon size={16} color="#1A1A1A" />
              <Text style={styles.secondaryButtonText}>Choose from library</Text>
            </AnimatedPressable>
          </View>

          {error !== null && (
            <View style={styles.errorContainer}>
              <AlertCircle size={18} color="#C0392B" />
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
          <PulsingDots />
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
  const medicationLabel = medicationName
    ? `Optimized for ${medicationName} ${result.dose_mg}mg`
    : '';

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
              <Pill size={13} color="#4A7C59" />
              <Text style={styles.medicationPillText}>{medicationLabel}</Text>
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
                  <View style={styles.categoryLine} />
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E6E0',
    padding: 40,
    alignItems: 'center',
  },
  uploadIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(74, 124, 89, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 16,
  },
  uploadCardSubtitle: {
    fontSize: 14,
    color: '#7A6A5A',
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
    backgroundColor: '#4A7C59',
    borderRadius: 10,
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
    backgroundColor: '#F5F3EF',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
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
    color: '#C0392B',
    lineHeight: 20,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#7A6A5A',
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
    backgroundColor: 'rgba(74, 124, 89, 0.10)',
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
    color: '#4A7C59',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E6E0',
    borderLeftWidth: 3,
    borderLeftColor: '#4A7C59',
    padding: 16,
  },
  recommendationName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  recommendationReason: {
    fontSize: 13,
    color: '#7A6A5A',
    lineHeight: 19,
    marginTop: 4,
    fontStyle: 'italic',
  },
  statsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3EF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statText: {
    fontSize: 12,
    color: '#7A6A5A',
  },
  scanDishButton: {
    marginTop: 12,
    height: 40,
    backgroundColor: 'rgba(74, 124, 89, 0.10)',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  scanDishText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A7C59',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7A6A5A',
    letterSpacing: 0.5,
  },
  categoryLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E6E0',
  },
  categoryItems: {
    marginHorizontal: 16,
    gap: 1,
  },
  menuItemRow: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: 'rgba(74, 124, 89, 0.04)',
  },
  recommendedDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4A7C59',
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  menuItemDescription: {
    fontSize: 13,
    color: '#7A6A5A',
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
    color: '#B0A090',
  },
  menuItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
});
