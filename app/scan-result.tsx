import React, { useRef, useState, useEffect } from 'react';
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
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, AlertCircle, Check, Share2, Bookmark, Info } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { COLORS } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { authClient } from '@/lib/auth';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

const BACKEND_URL = 'https://pmqb5ex8jduktbk9hrnr9rfqmaped4be.app.specular.dev';

// Arc constants
const ARC_WIDTH = 260;
const ARC_HEIGHT = 130;
const ARC_RADIUS = 100;
const ARC_CIRCUMFERENCE = Math.PI * ARC_RADIUS; // ~314.16

function resolveImageSource(
  source: string | number | ImageSourcePropType | undefined
): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

// Tick mark positions on the arc
function getTickPosition(percentage: number) {
  const angle = Math.PI * (percentage / 100);
  const x = 130 - ARC_RADIUS * Math.cos(angle);
  const y = 130 - ARC_RADIUS * Math.sin(angle);
  return { x, y };
}

// ─── Arc Visualization ────────────────────────────────────────────────────────
function ArcVisualization({ portionPct, arcAnim }: { portionPct: number; arcAnim: Animated.Value }) {
  const dashOffset = arcAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [ARC_CIRCUMFERENCE, 0],
  });

  const tick25 = getTickPosition(25);
  const tick50 = getTickPosition(50);
  const tick75 = getTickPosition(75);
  const tick100 = getTickPosition(100);

  const AnimatedPath = Animated.createAnimatedComponent(Path);

  return (
    <View style={arcStyles.container}>
      <Svg width={ARC_WIDTH} height={ARC_HEIGHT} viewBox={`0 0 ${ARC_WIDTH} ${ARC_HEIGHT}`}>
        {/* Track */}
        <Path
          d="M 30 130 A 100 100 0 0 1 230 130"
          fill="none"
          stroke="#E8E6E0"
          strokeWidth={8}
          strokeLinecap="round"
        />
        {/* Filled arc — driven by Animated.Value via native props */}
        <AnimatedPath
          d="M 30 130 A 100 100 0 0 1 230 130"
          fill="none"
          stroke="#4A7C59"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={ARC_CIRCUMFERENCE}
          strokeDashoffset={dashOffset as any}
        />
        {/* Tick marks */}
        <Circle cx={tick25.x} cy={tick25.y} r={3} fill="#B0A090" />
        <Circle cx={tick50.x} cy={tick50.y} r={3} fill="#B0A090" />
        <Circle cx={tick75.x} cy={tick75.y} r={3} fill="#B0A090" />
        <Circle cx={tick100.x} cy={tick100.y} r={3} fill="#B0A090" />
      </Svg>
    </View>
  );
}

const arcStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 8,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

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
  const confidence = parseFloat(params.confidence || '0');

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
  const prevSliderRef = useRef(initialPortion);
  const [confirmState, setConfirmState] = useState<'idle' | 'loading' | 'confirmed'>('idle');

  // ─── Share state ──────────────────────────────────────────────────────────────
  const [isSharing, setIsSharing] = useState(false);

  // ─── Entrance animations ──────────────────────────────────────────────────────
  const photoAnim = useRef(new Animated.Value(-20)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const arcAnim = useRef(new Animated.Value(0)).current;
  const pillsOpacity = useRef(new Animated.Value(0)).current;
  const bottomAnim = useRef(new Animated.Value(20)).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;
  const confirmScale = useRef(new Animated.Value(1)).current;

  const [displayedPct, setDisplayedPct] = useState(0);

  useEffect(() => {
    // Count-up listener
    const listenerId = countAnim.addListener(({ value }) => {
      setDisplayedPct(Math.round(value));
    });

    // Entrance sequence
    Animated.parallel([
      Animated.timing(photoAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(countAnim, {
        toValue: portionPctNum,
        duration: 600,
        useNativeDriver: false,
      }),
      Animated.timing(arcAnim, {
        toValue: portionPctNum,
        duration: 600,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(pillsOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(bottomAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(bottomOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    return () => {
      countAnim.removeListener(listenerId);
    };
    // All deps are stable Animated.Value refs or mount-only values — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Derived nutrition values ─────────────────────────────────────────────────
  const adjustedCalories = Math.round(totalCalories * sliderValue / 100);

  // Suggested portion nutrition (for pills)
  const suggestedCalories = Math.round(totalCalories * portionPctNum / 100);
  const suggestedProtein = Math.round(proteinG * portionPctNum / 100);
  const suggestedCarbs = Math.round(carbsG * portionPctNum / 100);

  const adjustedCaloriesDisplay = adjustedCalories.toString();

  const mealSuffix = mealsUntilPersonalized === 1 ? '' : 's';
  const personalizationHintText = `Confirm ${mealsUntilPersonalized} more meal${mealSuffix} to unlock personalized suggestions`;

  const subtitleText = hasMedication
    ? isPersonalized
      ? `Personalized for your ${medicationDisplay} ${doseMg}mg dose`
      : `Based on your ${medicationDisplay} ${doseMg}mg dose`
    : 'Based on your GLP-1 dose';

  const iAteCalText = `I ate ${sliderValue}% · ${adjustedCaloriesDisplay} kcal`;

  // Confidence badge
  const confidenceBadgeText = confidence > 0.7
    ? 'High confidence'
    : confidence > 0.4
    ? 'Good estimate'
    : 'Estimated';

  const suggestedCaloriesDisplay = suggestedCalories.toString();
  const suggestedProteinDisplay = suggestedProtein.toString();
  const suggestedCarbsDisplay = suggestedCarbs.toString();

  const displayedPctText = displayedPct.toString();
  const shareButtonLabel = isSharing ? 'Sharing...' : 'Share';

  // ─── Slider handler ───────────────────────────────────────────────────────────
  const handleSliderChange = (value: number) => {
    console.log('[ScanResult] Slider changed to:', value);
    const prev = prevSliderRef.current;
    if (Math.round(value / 5) !== Math.round(prev / 5)) {
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync().catch(() => {});
      }
    }
    prevSliderRef.current = value;
    setSliderValue(value);
  };

  // ─── Confirm handler ──────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (confirmState !== 'idle') return;
    console.log('[ScanResult] Confirm pressed, sliderValue:', sliderValue, 'analysisId:', params.analysisId);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setConfirmState('loading');

    // Scale down then spring back
    Animated.sequence([
      Animated.timing(confirmScale, { toValue: 0.96, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(confirmScale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 50, bounciness: 8 }),
    ]).start();

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
    } catch (err) {
      console.error('[ScanResult] PATCH error:', err);
      setConfirmState('idle');
    }
  };

  // ─── Share handler ────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (isSharing) return;
    console.log('[ScanResult] Share button pressed', { analysisId: params.analysisId, sliderValue });
    setIsSharing(true);
    try {
      const dishDisplay = params.dishName || 'my meal';
      const portionDisplay = confirmState === 'confirmed'
        ? `I ate ${sliderValue}% of this`
        : `Right Food suggested ${sliderValue}%`;

      const shareMessage = `${portionDisplay} — ${dishDisplay}\n\nCheck out Right Food — a free meal companion for GLP-1 users. right.food`;

      console.log('[ScanResult] Sharing via RN Share API');
      await Share.share({
        message: shareMessage,
        url: params.photoUri || undefined,
      });

      if (params.analysisId) {
        console.log('[ScanResult] PATCH /api/scan/analyses/:id/share — marking as shared');
        const session = await authClient.getSession();
        const token = session?.data?.session?.token;
        if (token) {
          const res = await fetch(
            `${BACKEND_URL}/api/scan/analyses/${params.analysisId}/share`,
            {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (!res.ok) {
            const errText = await res.text();
            console.error('[ScanResult] Share PATCH failed:', res.status, errText);
          } else {
            console.log('[ScanResult] Share PATCH succeeded');
          }
        }
      }
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        console.error('[Share] Error:', err);
      }
    } finally {
      setIsSharing(false);
    }
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
  const isConfirmed = confirmState === 'confirmed';
  const isLoading = confirmState === 'loading';

  const confirmButtonContent = isLoading ? (
    <ActivityIndicator color="#FFFFFF" />
  ) : isConfirmed ? (
    <View style={styles.confirmButtonRow}>
      <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
      <Text style={styles.confirmButtonText}>Confirmed</Text>
    </View>
  ) : (
    <Text style={styles.confirmButtonText}>Confirm what I ate</Text>
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
              Meal analysis
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
            Meal analysis
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 160 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Photo with gradient overlay ── */}
        <Animated.View style={[styles.photoContainer, { transform: [{ translateY: photoAnim }] }]}>
          <Image
            source={resolveImageSource(params.photoUri)}
            style={styles.photo}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.45)']}
            style={styles.photoGradient}
          />
          {/* Dish name on image */}
          <View style={styles.dishNameOverlay}>
            <Text style={styles.dishNameOnImage} numberOfLines={2}>
              {params.dishName || 'Your meal'}
            </Text>
          </View>
          {/* Confidence badge */}
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceBadgeText}>{confidenceBadgeText}</Text>
          </View>
        </Animated.View>

        {/* ── Portion recommendation ── */}
        <View style={styles.portionSection}>
          <Text style={styles.portionNumber}>{displayedPctText}</Text>
          <Text style={styles.portionUnit}>of this plate</Text>
          <Text style={styles.portionSubtitle}>{subtitleText}</Text>

          {/* Arc visualization */}
          <ArcVisualization portionPct={portionPctNum} arcAnim={arcAnim} />

          {/* Nutrition pills */}
          <Animated.View style={[styles.pillsRow, { opacity: pillsOpacity }]}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{suggestedCaloriesDisplay} kcal</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{suggestedProteinDisplay}g protein</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{suggestedCarbsDisplay}g carbs</Text>
            </View>
          </Animated.View>
        </View>

        {/* ── Personalization hint ── */}
        {mealsUntilPersonalized > 0 && (
          <View style={styles.personalizationHint}>
            <Info size={13} color={COLORS.textTertiary} strokeWidth={2} />
            <Text style={styles.personalizationHintText}>{personalizationHintText}</Text>
          </View>
        )}

        {/* ── Confirm section ── */}
        <Animated.View
          style={[
            styles.confirmSection,
            {
              transform: [{ translateY: bottomAnim }],
              opacity: bottomOpacity,
            },
          ]}
        >
          <View style={styles.confirmTopBorder} />

          <Text style={styles.confirmSectionLabel}>What did you actually eat?</Text>

          <Text style={styles.iAteText}>{iAteCalText}</Text>

          <Slider
            style={styles.slider}
            minimumValue={10}
            maximumValue={100}
            step={1}
            value={sliderValue}
            onValueChange={handleSliderChange}
            minimumTrackTintColor="#4A7C59"
            maximumTrackTintColor="#E8E6E0"
            thumbTintColor="#FFFFFF"
            disabled={isConfirmed}
          />

          <Animated.View
            style={[
              { transform: [{ scale: confirmScale }] },
              isConfirmed && { opacity: 1 },
            ]}
          >
            <AnimatedPressable
              style={[
                styles.confirmButton,
                isConfirmed && styles.confirmButtonDone,
                isLoading && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={confirmState !== 'idle'}
            >
              {confirmButtonContent}
            </AnimatedPressable>
          </Animated.View>

          <Text style={styles.confirmMicroCopy}>
            This helps Right Food learn your appetite
          </Text>
        </Animated.View>

        {/* ── Action row ── */}
        <View style={styles.actionRow}>
          <AnimatedPressable
            style={[styles.actionButton, isSharing && { opacity: 0.5 }]}
            onPress={handleShare}
            disabled={isSharing}
          >
            {isSharing
              ? <ActivityIndicator size="small" color={COLORS.textSecondary} />
              : <Share2 size={16} color={COLORS.textSecondary} strokeWidth={2} />
            }
            <Text style={styles.actionButtonText}>{shareButtonLabel}</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.actionButton} onPress={handleSave}>
            <Bookmark size={16} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={styles.actionButtonText}>Save</Text>
          </AnimatedPressable>
        </View>
      </ScrollView>

      {/* Describe modal */}
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FAFAF8' },

  // Header
  safeArea: { backgroundColor: '#FAFAF8' },
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
    color: '#1A1A1A',
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 44 },

  // Scroll
  scrollContent: {},
  errorScrollContent: { paddingBottom: 40 },

  // Photo
  photoContainer: {
    width: '100%',
    height: 240,
    overflow: 'hidden',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  photo: {
    width: '100%',
    height: 240,
  },
  photoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  dishNameOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 80,
  },
  dishNameOnImage: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  confidenceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confidenceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // Portion section
  portionSection: {
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 20,
  },
  portionNumber: {
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: -1,
    color: '#1A1A1A',
    fontVariant: ['tabular-nums'],
  },
  portionUnit: {
    fontSize: 18,
    fontWeight: '400',
    color: '#7A6A5A',
    marginTop: 2,
  },
  portionSubtitle: {
    fontSize: 13,
    color: '#7A6A5A',
    marginTop: 6,
    textAlign: 'center',
  },

  // Pills
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    backgroundColor: '#F5F3EF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 12,
    color: '#7A6A5A',
    fontWeight: '500',
  },

  // Personalization hint
  personalizationHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 16,
    marginHorizontal: 20,
    justifyContent: 'center',
  },
  personalizationHintText: {
    fontSize: 12,
    color: '#7A6A5A',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Confirm section
  confirmSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  confirmTopBorder: {
    height: 1,
    backgroundColor: '#E8E6E0',
    marginBottom: 20,
  },
  confirmSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7A6A5A',
    textTransform: 'uppercase',
    letterSpacing: 0.88,
    textAlign: 'center',
    marginBottom: 12,
  },
  iAteText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
  },
  slider: {
    width: '100%',
    height: 40,
  },
  confirmButton: {
    marginTop: 16,
    height: 52,
    backgroundColor: '#4A7C59',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonDone: {
    backgroundColor: '#3A6B49',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
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
  confirmMicroCopy: {
    fontSize: 12,
    color: '#7A6A5A',
    textAlign: 'center',
    marginTop: 10,
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
    borderWidth: 1,
    borderColor: '#E8E6E0',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7A6A5A',
  },

  // Error state
  errorPhoto: {
    width: '100%',
    height: 220,
  },
  errorCard: {
    marginTop: -16,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E8E6E0',
    alignItems: 'center',
  },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(200, 147, 58, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 16,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    color: '#7A6A5A',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  errorPrimaryButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#4A7C59',
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
    borderWidth: 1,
    borderColor: '#E8E6E0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  errorSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A7C59',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#F2F0EB',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#1A1A1A',
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E8E6E0',
  },
  modalPrimaryButton: {
    height: 48,
    backgroundColor: '#4A7C59',
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
    color: '#7A6A5A',
  },
});
