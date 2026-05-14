import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Pill, AlertCircle } from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';

function resolveImageSource(
  source: string | number | ImageSourcePropType | undefined
): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

interface MacroCardProps {
  value: string;
  label: string;
}

function MacroCard({ value, label }: MacroCardProps) {
  return (
    <View style={styles.macroCard}>
      <Text style={styles.macroValue}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
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
    error: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [describeModalVisible, setDescribeModalVisible] = useState(false);
  const [manualDescription, setManualDescription] = useState('');

  const hasError = !!params.error;
  const confidence = parseFloat(params.confidence || '0');
  const portionPct = parseFloat(params.portionPct || '0');
  const totalCalories = parseFloat(params.totalCalories || '0');
  const proteinG = parseFloat(params.proteinG || '0');
  const carbsG = parseFloat(params.carbsG || '0');
  const fatG = parseFloat(params.fatG || '0');

  let foodsIdentified: string[] = [];
  try {
    foodsIdentified = params.foodsIdentified ? JSON.parse(params.foodsIdentified) : [];
  } catch {
    foodsIdentified = [];
  }

  const medicationName = params.medication || '';
  const doseMg = params.doseMg || '';
  const hasMedication = !!medicationName && !!doseMg;
  const medicationDisplay =
    medicationName.charAt(0).toUpperCase() + medicationName.slice(1);

  let confidenceBadgeText = 'Low confidence';
  let confidenceBadgeBg = COLORS.textSecondary;
  if (confidence >= 0.8) {
    confidenceBadgeText = 'High confidence';
    confidenceBadgeBg = COLORS.primary;
  } else if (confidence >= 0.5) {
    confidenceBadgeText = 'Good match';
    confidenceBadgeBg = COLORS.accent;
  }

  const portionPctDisplay = Math.round(portionPct);
  const caloriesDisplay = Math.round(totalCalories).toString();
  const proteinDisplay = Math.round(proteinG).toString();
  const carbsDisplay = Math.round(carbsG).toString();
  const fatDisplay = Math.round(fatG).toString();

  const handleBack = () => {
    console.log('[ScanResult] Back button pressed');
    router.back();
  };

  const handleLogIt = () => {
    console.log('[ScanResult] "Log it" button pressed, analysisId:', params.analysisId);
    router.back();
  };

  const handleAdjustPortion = () => {
    console.log('[ScanResult] "Adjust portion" button pressed, analysisId:', params.analysisId);
    router.back();
  };

  const handleTryAgain = () => {
    console.log('[ScanResult] "Try again" button pressed');
    router.back();
  };

  const handleDescribeManually = () => {
    console.log('[ScanResult] "Describe manually" button pressed');
    setDescribeModalVisible(true);
  };

  const handleAnalyzeDescription = () => {
    console.log('[ScanResult] "Analyze description" pressed, description:', manualDescription);
    setDescribeModalVisible(false);
    router.back();
  };

  const handleCloseModal = () => {
    console.log('[ScanResult] Describe modal closed');
    setDescribeModalVisible(false);
  };

  const bottomPadding = insets.bottom + 16;

  // ─── Error state ─────────────────────────────────────────────────────────────
  if (hasError) {
    return (
      <View style={styles.flex}>
        <SafeAreaView style={styles.safeAreaError} edges={['top']}>
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
      <SafeAreaView style={styles.safeAreaSuccess} edges={['top']}>
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
        {/* Photo */}
        <View style={styles.photoContainer}>
          <Image
            source={resolveImageSource(params.photoUri)}
            style={styles.photo}
            resizeMode="cover"
          />
          <View style={[styles.confidenceBadge, { backgroundColor: confidenceBadgeBg }]}>
            <Text style={styles.confidenceBadgeText}>{confidenceBadgeText}</Text>
          </View>
        </View>

        {/* Portion card */}
        <View style={styles.portionCard}>
          <Text style={styles.portionLabel}>SUGGESTED PORTION</Text>
          <View style={styles.gaugeContainer}>
            <View style={styles.gaugeOuter}>
              <View style={styles.gaugeInner}>
                <Text style={styles.gaugePct}>{portionPctDisplay}</Text>
                <Text style={styles.gaugePctSymbol}>%</Text>
              </View>
            </View>
          </View>
          <Text style={styles.gaugeSubtext}>of your plate</Text>

          <View style={styles.divider} />

          {hasMedication ? (
            <View style={styles.medicationRow}>
              <Pill size={14} color={COLORS.textSecondary} strokeWidth={2} />
              <Text style={styles.medicationText}>
                {'Calibrated for '}
                {medicationDisplay}
                {' '}
                {doseMg}
                {'mg'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Macros */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NUTRITIONAL ESTIMATE</Text>
          <View style={styles.macroGrid}>
            <MacroCard value={caloriesDisplay} label="kcal" />
            <MacroCard value={proteinDisplay} label="g protein" />
            <MacroCard value={carbsDisplay} label="g carbs" />
            <MacroCard value={fatDisplay} label="g fat" />
          </View>
        </View>

        {/* Foods identified */}
        {foodsIdentified.length > 0 ? (
          <View style={[styles.section, styles.foodsSection]}>
            <Text style={styles.sectionTitle}>WHAT WE FOUND</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {foodsIdentified.map((food, index) => (
                <View key={index} style={styles.chip}>
                  <Text style={styles.chipText}>{food}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {/* Fixed bottom actions */}
      <View style={[styles.bottomActions, { paddingBottom: bottomPadding }]}>
        <AnimatedPressable style={styles.logButton} onPress={handleLogIt}>
          <Text style={styles.logButtonText}>This looks right — log it</Text>
        </AnimatedPressable>
        <AnimatedPressable style={styles.adjustButton} onPress={handleAdjustPortion}>
          <Text style={styles.adjustButtonText}>Adjust portion</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },

  // Header
  safeAreaSuccess: { backgroundColor: COLORS.background },
  safeAreaError: { backgroundColor: COLORS.background },
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
  scrollContent: { paddingBottom: 120 },
  errorScrollContent: { paddingBottom: 40 },

  // Photo
  photoContainer: { position: 'relative' },
  photo: { width: '100%', height: 260 },
  confidenceBadge: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Portion card
  portionCard: {
    marginTop: -20,
    marginHorizontal: 16,
    zIndex: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  portionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
  },
  gaugeContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  gaugeOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  gaugePct: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.primary,
    lineHeight: 52,
  },
  gaugePctSymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginLeft: 2,
  },
  gaugeSubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    alignSelf: 'stretch',
    marginVertical: 16,
  },
  medicationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  medicationText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Sections
  section: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  foodsSection: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Macro grid
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  macroCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  macroValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  macroLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Food chips
  chipsRow: {
    paddingRight: 16,
  },
  chip: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },

  // Bottom actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  logButton: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adjustButton: {
    height: 44,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  adjustButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
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
