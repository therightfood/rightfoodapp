import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  ImageSourcePropType,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Pill, AlertCircle, Check, Share2, Bookmark } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { COLORS } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { authClient } from '@/lib/auth';

const BACKEND_URL = 'https://3pqctptn272ematfhedrjv4we23tdyxd.app.specular.dev';

function resolveImageSource(
  source: string | number | ImageSourcePropType | undefined
): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function ScanResultScreen() {
  const params = useLocalSearchParams<{
    photoUri: string;
    analysisId: string;
    dishName: string;
    portionPct: string;
    totalCalories: string;
    proteinG: string;
    carbsG: string;
    fatG: string;
    fiberG: string;
    confidence: string;
    foodsIdentified: string;
    medication: string;
    doseMg: string;
    confirmedMealCount: string;
    error: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ─── Error state modal state ──────────────────────────────────────────────────
  const [describeModalVisible, setDescribeModalVisible] = useState(false);
  const [manualDescription, setManualDescription] = useState('');

  // ─── Parsed params ────────────────────────────────────────────────────────────
  const portionPctNum = parseFloat(params.portionPct || '65');
  const totalCalories = parseFloat(params.totalCalories || '0');
  const proteinG = parseFloat(params.proteinG || '0');
  const carbsG = parseFloat(params.carbsG || '0');
  const fatG = parseFloat(params.fatG || '0');

  const medicationName = params.medication || '';
  const doseMg = params.doseMg || '';
  const hasMedication = !!medicationName && !!doseMg;
  const medicationDisplay =
    medicationName.charAt(0).toUpperCase() + medicationName.slice(1);

  const confirmedMealCount = parseInt(params.confirmedMealCount || '0', 10);
  const mealsUntilPersonalized = Math.max(0, 5 - confirmedMealCount);
  const isPersonalized = confirmedMealCount >= 5;

  // ─── Slider / animation state ─────────────────────────────────────────────────
  const initialPortion = Math.round(portionPctNum);
  const [sliderValue, setSliderValue] = useState(initialPortion);
  const [confirmState, setConfirmState] = useState<'idle' | 'loading' | 'confirmed'>('idle');

  const barWidth = useRef(new Animated.Value(initialPortion)).current;
  const confirmScale = useRef(new Animated.Value(1)).current;

  const handleSliderChange = (value: number) => {
    console.log('[ScanResult] Slider changed to:', value);
    setSliderValue(value);
    Animated.timing(barWidth, {
      toValue: value,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  // ─── Derived nutrition values ─────────────────────────────────────────────────
  const adjustedCalories = Math.round(totalCalories * sliderValue / 100);
  const adjustedProtein = Math.round(proteinG * sliderValue / 100);
  const adjustedCarbs = Math.round(carbsG * sliderValue / 100);
  const adjustedFat = Math.round(fatG * sliderValue / 100);

  const totalCaloriesDisplay = Math.round(totalCalories).toString();
  const adjustedCaloriesDisplay = adjustedCalories.toString();
  const adjustedProteinDisplay = adjustedProtein.toString();
  const adjustedCarbsDisplay = adjustedCarbs.toString();
  const adjustedFatDisplay = adjustedFat.toString();

  const mealSuffix = mealsUntilPersonalized === 1 ? '' : 's';
  const personalizationHintText = `Confirm ${mealsUntilPersonalized} more meal${mealSuffix} to unlock personalized suggestions`;

  const heroText = `Eat ${sliderValue}% of this`;
  const subtitleText = hasMedication
    ? isPersonalized
      ? `Personalized for your ${medicationDisplay} ${doseMg}mg dose`
      : `Based on your ${medicationDisplay} ${doseMg}mg dose`
    : 'Based on your GLP-1 dose';
  const captionText = `Based on full-plate estimate of ${totalCaloriesDisplay} kcal`;
  const iAteText = `I ate ${sliderValue}%`;

  const barInterpolated = barWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // ─── Confirm handler ──────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (confirmState !== 'idle') return;
    console.log('[ScanResult] Confirm pressed, sliderValue:', sliderValue, 'analysisId:', params.analysisId);
    setConfirmState('loading');
    try {
      const session = await authClient.getSession();
      const token = session?.data?.session?.token;
      console.log('[ScanResult] PATCH /api/scan/analyses/:id — actual_portion_pct:', sliderValue);
      const res = await fetch(
        `${BACKEND_URL}/api/scan/analyses/${params.analysisId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ actual_portion_pct: sliderValue }),
        }
      );
      if (!res.ok) {
        const errText = await res.text();
        console.error('[ScanResult] PATCH failed:', res.status, errText);
        setConfirmState('idle');
        return;
      }
      console.log('[ScanResult] PATCH succeeded');
      setConfirmState('confirmed');
      Animated.sequence([
        Animated.timing(confirmScale, { toValue: 1.04, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(confirmScale, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    } catch (err) {
      console.error('[ScanResult] PATCH error:', err);
      setConfirmState('idle');
    }
  };

  // ─── Action row handlers ──────────────────────────────────────────────────────
  const handleShare = () => {
    console.log('[ScanResult] Share result pressed');
  };

  const handleSave = () => {
    console.log('[ScanResult] Save to Journey pressed');
  };

  // ─── Back ─────────────────────────────────────────────────────────────────────
  const handleBack = () => {
    console.log('[ScanResult] Back button pressed');
    router.back();
  };

  // ─── Error state handlers ─────────────────────────────────────────────────────
  const handleTryAgain = () => {
    console.log('[ScanResult] Try again pressed');
    router.back();
  };

  const handleDescribeManually = () => {
    console.log('[ScanResult] Describe manually pressed');
    setDescribeModalVisible(true);
  };

  const handleAnalyzeDescription = () => {
    console.log('[ScanResult] Analyze description pressed, description:', manualDescription);
    setDescribeModalVisible(false);
    router.back();
  };

  const handleCloseModal = () => {
    console.log('[ScanResult] Describe modal closed');
    setDescribeModalVisible(false);
  };

  // ─── Confirm button content ───────────────────────────────────────────────────
  const confirmButtonContent = confirmState === 'loading' ? (
    <ActivityIndicator color="#FFFFFF" />
  ) : confirmState === 'confirmed' ? (
    <View style={styles.confirmButtonRow}>
      <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
      <Text style={styles.confirmButtonText}>Confirmed</Text>
    </View>
  ) : (
    <Text style={styles.confirmButtonText}>Confirm</Text>
  );

  // ─── Error state ──────────────────────────────────────────────────────────────
  const hasError = !!params.error;
  if (hasError) {
    return (
      <View style={styles.flex}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.headerRow}>
            <AnimatedPressable style={styles.backButton} onPress={handleBack}>
              <ChevronLeft size={24} color={COLORS.text} strokeWidth={2} />
            </AnimatedPressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Scan result
            </Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.errorScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {params.photoUri ? (
            <Image
              source={resolveImageSource(params.photoUri)}
              style={styles.errorPhoto}
              resizeMode="cover"
            />
          ) : null}

          <View style={styles.errorCard}>
            <View style={styles.errorIconCircle}>
              <AlertCircle size={40} color={COLORS.accent} strokeWidth={1.5} />
            </View>
            <Text style={styles.errorTitle}>We couldn't identify this meal</Text>
            <Text style={styles.errorBody}>
              We couldn't identify this meal clearly. Try a better-lit photo, or describe the meal
              manually.
            </Text>
            <AnimatedPressable style={styles.errorPrimaryButton} onPress={handleTryAgain}>
              <Text style={styles.errorPrimaryButtonText}>Try again</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={styles.errorSecondaryButton}
              onPress={handleDescribeManually}
            >
              <Text style={styles.errorSecondaryButtonText}>Describe manually</Text>
            </AnimatedPressable>
          </View>
        </ScrollView>

        <Modal
          visible={describeModalVisible}
          transparent
          animationType="slide"
          onRequestClose={handleCloseModal}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { paddingBottom: insets.bottom + 24 }]}>
              <Text style={styles.modalTitle}>Describe your meal</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. grilled chicken with rice and salad"
                placeholderTextColor={COLORS.textTertiary}
                value={manualDescription}
                onChangeText={setManualDescription}
                multiline
                numberOfLines={3}
                autoFocus
              />
              <AnimatedPressable
                style={styles.modalPrimaryButton}
                onPress={handleAnalyzeDescription}
              >
                <Text style={styles.modalPrimaryButtonText}>Analyze description</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.modalCancelButton} onPress={handleCloseModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </AnimatedPressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ─── Success state ────────────────────────────────────────────────────────────
  return (
    <View style={styles.flex}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerRow}>
          <AnimatedPressable style={styles.backButton} onPress={handleBack}>
            <ChevronLeft size={24} color={COLORS.text} strokeWidth={2} />
          </AnimatedPressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {params.dishName || 'Your meal'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1: Portion recommendation ── */}
        <Image
          source={resolveImageSource(params.photoUri)}
          style={styles.photo}
          resizeMode="cover"
        />

        <Text style={styles.dishName}>{params.dishName || 'Your meal'}</Text>

        <Text style={styles.heroText}>{heroText}</Text>

        <Text style={styles.subtitle}>{subtitleText}</Text>

        {/* Satiety bar */}
        <View style={styles.satietyBarContainer}>
          <View style={styles.satietyBarTrack}>
            <Animated.View
              style={[
                styles.satietyBarFill,
                { width: barInterpolated },
              ]}
            />
          </View>
          <View style={styles.satietyBarLabels}>
            <Text style={styles.satietyBarLabelLeft}>Your suggested portion</Text>
            <Text style={styles.satietyBarLabelRight}>Full plate</Text>
          </View>
        </View>

        {mealsUntilPersonalized > 0 && (
          <View style={styles.personalizationHint}>
            <Text style={styles.personalizationHintText}>{personalizationHintText}</Text>
          </View>
        )}

        {/* ── Section 2: Nutrition panel ── */}
        <View style={styles.nutritionCard}>
          <Text style={styles.nutritionCardTitle}>Nutrition estimate</Text>

          <View style={styles.nutritionRow}>
            <Text style={styles.nutritionLabel}>Calories</Text>
            <Text style={styles.nutritionValue}>{adjustedCaloriesDisplay} kcal</Text>
          </View>
          <View style={[styles.nutritionRow, styles.nutritionRowBorder]}>
            <Text style={styles.nutritionLabel}>Protein</Text>
            <Text style={styles.nutritionValue}>{adjustedProteinDisplay}g</Text>
          </View>
          <View style={[styles.nutritionRow, styles.nutritionRowBorder]}>
            <Text style={styles.nutritionLabel}>Carbs</Text>
            <Text style={styles.nutritionValue}>{adjustedCarbsDisplay}g</Text>
          </View>
          <View style={[styles.nutritionRow, styles.nutritionRowBorder, styles.nutritionRowLast]}>
            <Text style={styles.nutritionLabel}>Fat</Text>
            <Text style={styles.nutritionValue}>{adjustedFatDisplay}g</Text>
          </View>
        </View>

        <Text style={styles.nutritionCaption}>{captionText}</Text>

        {/* ── Section 3: Confirm what you ate ── */}
        <View style={styles.confirmSection}>
          <Text style={styles.confirmSectionTitle}>How much did you eat?</Text>

          <Text style={styles.iAteText}>{iAteText}</Text>

          <Slider
            style={styles.slider}
            minimumValue={10}
            maximumValue={100}
            step={1}
            value={sliderValue}
            onValueChange={handleSliderChange}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor={COLORS.surfaceSecondary}
            thumbTintColor={COLORS.primary}
          />

          <Animated.View style={{ transform: [{ scale: confirmScale }] }}>
            <AnimatedPressable
              style={[
                styles.confirmButton,
                confirmState !== 'idle' && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
            >
              {confirmButtonContent}
            </AnimatedPressable>
          </Animated.View>
        </View>

        {/* ── Action row ── */}
        <View style={styles.actionRow}>
          <AnimatedPressable style={styles.actionButton} onPress={handleShare}>
            <Share2 size={16} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={styles.actionButtonText}>Share</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.actionButton} onPress={handleSave}>
            <Bookmark size={16} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={styles.actionButtonText}>Save</Text>
          </AnimatedPressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },

  // Header
  safeArea: { backgroundColor: COLORS.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 44 },

  // Scroll
  scrollContent: { paddingBottom: 140 },
  errorScrollContent: { paddingBottom: 40 },

  // Photo
  photo: {
    width: '100%',
    height: 200,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  // Dish name + hero
  dishName: {
    marginTop: 16,
    marginHorizontal: 20,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  heroText: {
    marginTop: 8,
    marginHorizontal: 20,
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    marginHorizontal: 20,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Satiety bar
  satietyBarContainer: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  satietyBarTrack: {
    width: '100%',
    height: 10,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 5,
    overflow: 'hidden',
  },
  satietyBarFill: {
    height: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },
  satietyBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  satietyBarLabelLeft: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  satietyBarLabelRight: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  // Nutrition card
  nutritionCard: {
    marginTop: 24,
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  nutritionCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  nutritionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  nutritionRowLast: {},
  nutritionLabel: {
    fontSize: 15,
    color: COLORS.text,
  },
  nutritionValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  nutritionCaption: {
    marginTop: 8,
    marginHorizontal: 16,
    fontSize: 12,
    color: COLORS.textTertiary,
  },

  // Confirm section
  confirmSection: {
    marginTop: 24,
    marginHorizontal: 16,
    marginBottom: 0,
  },
  confirmSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  iAteText: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  slider: {
    width: '100%',
  },
  confirmButton: {
    marginTop: 20,
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.9,
  },
  confirmButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Personalization hint
  personalizationHint: {
    marginTop: 12,
    marginHorizontal: 20,
    backgroundColor: COLORS.accentMuted,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  personalizationHintText: {
    fontSize: 13,
    color: COLORS.accent,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  actionButton: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },

  // Error state
  errorPhoto: {
    width: '100%',
    height: 220,
  },
  errorCard: {
    marginTop: -16,
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  errorPrimaryButton: {
    width: '100%',
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  errorPrimaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorSecondaryButton: {
    width: '100%',
    height: 48,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  errorSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalPrimaryButton: {
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  modalPrimaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalCancelButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
});
