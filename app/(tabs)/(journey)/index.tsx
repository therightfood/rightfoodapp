import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  Image,
  Animated,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronRight, BookOpen, AlertCircle, Camera } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { apiGet } from '@/utils/api';
import AnimatedPressable from '@/components/AnimatedPressable';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Meal {
  id: string;
  image_url: string;
  dish_name: string;
  created_at: string;
  effective_portion_pct: number;
  effective_calories: number;
  effective_protein_g: number;
  portion_suggestion_pct: number;
  actual_portion_pct: number | null;
  total_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: number;
  foods_identified: string[];
  medication: string | null;
  dose_mg: number | null;
  time_of_day: string | null;
  status: string;
}

interface Summary {
  today_calories: number;
  today_protein_g: number;
  today_meal_count: number;
  week_avg_daily_calories: number;
  week_avg_daily_protein_g: number;
  week_meal_count: number;
}

interface JourneyResponse {
  summary: Summary;
  meals: Meal[];
}

type Section = { title: string; data: Meal[] };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

function groupMealsByDate(meals: Meal[]): Section[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, Meal[]> = {};
  for (const meal of meals) {
    const mealDate = new Date(meal.created_at);
    mealDate.setHours(0, 0, 0, 0);
    let label: string;
    if (mealDate.getTime() === today.getTime()) {
      label = 'Today';
    } else if (mealDate.getTime() === yesterday.getTime()) {
      label = 'Yesterday';
    } else {
      label = new Date(meal.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(meal);
  }
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

// ─── Shimmer ─────────────────────────────────────────────────────────────────

function ShimmerBlock({ style }: { style?: object }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return <Animated.View style={[{ backgroundColor: COLORS.surfaceSecondary, opacity }, style]} />;
}

function SkeletonLoader() {
  return (
    <View style={styles.skeletonContainer}>
      <ShimmerBlock style={styles.skeletonCard} />
      <ShimmerBlock style={styles.skeletonRow} />
      <ShimmerBlock style={styles.skeletonRow} />
      <ShimmerBlock style={styles.skeletonRow} />
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function JourneyScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);

  const sections = useMemo(() => groupMealsByDate(meals), [meals]);

  const fetchJourney = useCallback(async (isRefresh = false) => {
    console.log('[Journey] Fetching journey data', { isRefresh });
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await apiGet<JourneyResponse>('/api/journey');
      console.log('[Journey] Journey data received', {
        mealCount: data.meals?.length,
        todayCalories: data.summary?.today_calories,
      });
      setSummary(data.summary);
      setMeals(data.meals || []);
    } catch (err: any) {
      console.log('[Journey] Error fetching journey', err?.message);
      setError(err?.message || 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('[Journey] Screen focused — refreshing data');
      fetchJourney();
    }, [fetchJourney])
  );

  const handleRefresh = useCallback(() => {
    console.log('[Journey] Pull-to-refresh triggered');
    setRefreshing(true);
    fetchJourney(true);
  }, [fetchJourney]);

  const handleMealPress = useCallback((meal: Meal) => {
    console.log('[Journey] Meal row tapped', { mealId: meal.id, dishName: meal.dish_name });
    router.push({
      pathname: '/scan-result',
      params: {
        photoUri: meal.image_url,
        analysisId: meal.id,
        dishName: meal.dish_name || 'Unknown meal',
        portionPct: String(meal.effective_portion_pct),
        totalCalories: String(meal.total_calories || 0),
        proteinG: String(meal.protein_g || 0),
        carbsG: String(meal.carbs_g || 0),
        fatG: String(meal.fat_g || 0),
        fiberG: String(meal.fiber_g || 0),
        confidence: String(meal.confidence || 0),
        foodsIdentified: JSON.stringify(meal.foods_identified || []),
        medication: meal.medication || '',
        doseMg: String(meal.dose_mg || ''),
        confirmedMealCount: '5',
        error: '',
      },
    });
  }, [router]);

  const handleScanPress = useCallback(() => {
    console.log('[Journey] Scan a meal button pressed');
    router.push('/(tabs)/(scan)');
  }, [router]);

  const handleRetryPress = useCallback(() => {
    console.log('[Journey] Retry button pressed');
    fetchJourney();
  }, [fetchJourney]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <SkeletonLoader />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerFlex}>
          <AlertCircle size={32} color={COLORS.danger} />
          <Text style={styles.errorTitle}>Couldn't load your journey</Text>
          <Text style={styles.errorSubtitle}>Check your connection and try again</Text>
          <AnimatedPressable style={styles.retryButton} onPress={handleRetryPress}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  if (meals.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerFlex}>
          <View style={styles.emptyIconCircle}>
            <BookOpen size={40} color={COLORS.primary} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>No meals yet</Text>
          <Text style={styles.emptySubtitle}>
            Scan your first meal to start tracking your journey
          </Text>
          <AnimatedPressable style={styles.scanButton} onPress={handleScanPress}>
            <Text style={styles.scanButtonText}>Scan a meal</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main content ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index, section }) => (
          <MealRow
            meal={item}
            isFirst={index === 0}
            isLast={index === section.data.length - 1}
            onPress={handleMealPress}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
        )}
        ListHeaderComponent={
          <JourneyHeader summary={summary!} />
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function JourneyHeader({ summary }: { summary: Summary }) {
  const todayCalories = Math.round(summary.today_calories);
  const todayProtein = Math.round(summary.today_protein_g);
  const todayMealCount = summary.today_meal_count;
  const weekAvgCalories = Math.round(summary.week_avg_daily_calories);
  const weekAvgProtein = Math.round(summary.week_avg_daily_protein_g);
  const weekMealCount = summary.week_meal_count;
  const mealLabel = todayMealCount === 1 ? 'meal' : 'meals';

  return (
    <View>
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>My Journey</Text>
      </View>
      <View style={styles.summaryCard}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryLabel}>TODAY</Text>
          <View style={styles.statRow}>
            <Text style={styles.statValue}>{todayCalories}</Text>
            <Text style={styles.statUnit}> kcal</Text>
          </View>
          <Text style={styles.statSub}>
            {todayProtein}g protein · {todayMealCount} {mealLabel}
          </Text>
        </View>
        <View style={styles.summaryRight}>
          <Text style={styles.summaryLabel}>THIS WEEK</Text>
          <View style={styles.statRow}>
            <Text style={styles.statValue}>{weekAvgCalories}</Text>
            <Text style={styles.statUnit}> avg/day</Text>
          </View>
          <Text style={styles.statSub}>
            {weekAvgProtein}g protein · {weekMealCount} meals
          </Text>
        </View>
      </View>
    </View>
  );
}

interface MealRowProps {
  meal: Meal;
  isFirst: boolean;
  isLast: boolean;
  onPress: (meal: Meal) => void;
}

function MealRow({ meal, isFirst, isLast, onPress }: MealRowProps) {
  const timeString = new Date(meal.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const portionPct = Math.round(meal.effective_portion_pct);
  const calories = Math.round(meal.effective_calories);
  const dishName = meal.dish_name || 'Unknown meal';

  const isOverPortion =
    meal.actual_portion_pct !== null &&
    meal.actual_portion_pct > meal.portion_suggestion_pct;
  const dotColor = isOverPortion ? COLORS.accent : COLORS.primary;

  const rowStyle = [
    styles.mealRow,
    isFirst && styles.mealRowFirst,
    isLast && styles.mealRowLast,
    !isLast && styles.mealRowDivider,
  ];

  const hasImage = !!meal.image_url;

  return (
    <AnimatedPressable style={rowStyle} onPress={() => onPress(meal)}>
      <View style={styles.thumbnail}>
        {hasImage ? (
          <Image
            source={resolveImageSource(meal.image_url)}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailFallback}>
            <Camera size={20} color={COLORS.textTertiary} />
          </View>
        )}
      </View>

      <View style={styles.mealContent}>
        <View style={styles.mealRow1}>
          <Text style={styles.mealName} numberOfLines={1}>{dishName}</Text>
          <Text style={styles.mealTime}>{timeString}</Text>
        </View>
        <View style={styles.mealRow2}>
          <View style={[styles.portionDot, { backgroundColor: dotColor }]} />
          <Text style={styles.mealMeta}>Ate {portionPct}%</Text>
          <Text style={styles.mealSep}>·</Text>
          <Text style={styles.mealMeta}>{calories} kcal</Text>
        </View>
      </View>

      <ChevronRight size={16} color={COLORS.textTertiary} />
    </AnimatedPressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Skeleton
  skeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 12,
  },
  skeletonCard: {
    height: 100,
    borderRadius: 12,
    marginBottom: 4,
  },
  skeletonRow: {
    height: 72,
    borderRadius: 8,
  },

  // Center layouts
  centerFlex: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  // Error state
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 12,
  },
  errorSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  retryButton: {
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Empty state
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 260,
    lineHeight: 22,
  },
  scanButton: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  scanButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // List
  listContent: {
    paddingBottom: 100,
  },

  // Header
  titleRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    flexDirection: 'row',
  },
  summaryLeft: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: COLORS.divider,
    paddingRight: 16,
  },
  summaryRight: {
    flex: 1,
    paddingLeft: 16,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  statUnit: {
    fontSize: 13,
    color: COLORS.textSecondary,
    alignSelf: 'flex-end',
    marginBottom: 2,
    marginLeft: 3,
  },
  statSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: COLORS.background,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Meal row
  mealRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 1,
  },
  mealRowFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  mealRowLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 0,
  },
  mealRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  // Thumbnail
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: 52,
    height: 52,
  },
  thumbnailFallback: {
    width: 52,
    height: 52,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Meal content
  mealContent: {
    flex: 1,
  },
  mealRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  mealTime: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  mealRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  portionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mealMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  mealSep: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
});
