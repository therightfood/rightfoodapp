import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Animated,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, CheckCircle, Search } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { COLORS } from '@/constants/Colors';
import { apiPut } from '@/utils/api';

// ─── Constants ───────────────────────────────────────────────────────────────

const MEDICATIONS = [
  { id: 'ozempic', name: 'Ozempic', drug: 'semaglutide' },
  { id: 'wegovy', name: 'Wegovy', drug: 'semaglutide' },
  { id: 'mounjaro', name: 'Mounjaro', drug: 'tirzepatide' },
  { id: 'zepbound', name: 'Zepbound', drug: 'tirzepatide' },
] as const;

const DOSES: Record<string, string[]> = {
  ozempic: ['0.25mg', '0.5mg', '1mg', '2mg'],
  wegovy: ['0.25mg', '0.5mg', '1mg', '1.7mg', '2.4mg'],
  mounjaro: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'],
  zepbound: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'],
};

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
  'France', 'Spain', 'Italy', 'Netherlands', 'Sweden', 'Norway', 'Denmark',
  'Finland', 'Switzerland', 'Austria', 'Belgium', 'Ireland', 'New Zealand',
  'Japan', 'South Korea', 'Singapore', 'UAE', 'Saudi Arabia', 'Brazil',
  'Mexico', 'Argentina', 'India', 'South Africa', 'Nigeria', 'Kenya',
];

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  const fillAnim = useRef(new Animated.Value((step / 4) * 100)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: (step / 4) * 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step, fillAnim]);

  const stepLabel = `Step ${step} of 4`;

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: fillAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.progressLabel}>{stepLabel}</Text>
    </View>
  );
}

// ─── Continue Button ──────────────────────────────────────────────────────────

function ContinueButton({
  onPress,
  disabled,
  loading,
  label = 'Continue',
}: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}) {
  const isDisabled = disabled || loading;
  return (
    <AnimatedPressable
      onPress={() => {
        console.log(`[Onboarding] "${label}" button pressed`);
        onPress();
      }}
      disabled={isDisabled}
      style={[styles.continueButton, isDisabled && styles.continueButtonDisabled]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={styles.continueButtonText}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

// ─── Step 1 — Medical Disclaimer ─────────────────────────────────────────────

function Step1({
  onNext,
}: {
  onNext: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleToggle = () => {
    const next = !checked;
    console.log(`[Onboarding Step 1] Disclaimer checkbox toggled: ${next}`);
    setChecked(next);
  };

  const handleContinue = async () => {
    console.log('[Onboarding Step 1] Saving disclaimer_acknowledged to profile');
    setLoading(true);
    try {
      await apiPut('/api/profile', { disclaimer_acknowledged: true });
      console.log('[Onboarding Step 1] Profile updated successfully');
      onNext();
    } catch (err) {
      console.error('[Onboarding Step 1] Failed to update profile:', err);
      onNext();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Before we begin</Text>

      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerText}>
          Right Food is a personal wellness tool. It is not medical advice, a medical device, or a substitute for your prescriber's guidance. Always follow your doctor's instructions for your medication.
        </Text>
      </View>

      <AnimatedPressable onPress={handleToggle} style={styles.checkboxRow}>
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Check size={14} color="#FFFFFF" strokeWidth={2.5} />}
        </View>
        <Text style={styles.checkboxLabel}>I understand and agree</Text>
      </AnimatedPressable>

      <View style={styles.buttonSpacer} />
      <ContinueButton onPress={handleContinue} disabled={!checked} loading={loading} />
    </View>
  );
}

// ─── Step 2 — Medication Selection ───────────────────────────────────────────

function Step2({
  onNext,
}: {
  onNext: (medication: string, dose: string) => void;
}) {
  const [selectedMed, setSelectedMed] = useState<string | null>(null);
  const [selectedDose, setSelectedDose] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const doseOpacity = useRef(new Animated.Value(0)).current;

  const handleSelectMed = (id: string) => {
    console.log(`[Onboarding Step 2] Medication selected: ${id}`);
    if (selectedMed !== id) {
      setSelectedDose(null);
    }
    setSelectedMed(id);
    Animated.timing(doseOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handleSelectDose = (dose: string) => {
    console.log(`[Onboarding Step 2] Dose selected: ${dose}`);
    setSelectedDose(dose);
  };

  const handleContinue = async () => {
    if (!selectedMed || !selectedDose) return;
    const medName = MEDICATIONS.find((m) => m.id === selectedMed)?.name ?? selectedMed;
    const doseNum = parseFloat(selectedDose);
    console.log(`[Onboarding Step 2] Saving medication=${medName}, dose_mg=${doseNum}`);
    setLoading(true);
    try {
      await apiPut('/api/profile', { medication: medName, dose_mg: doseNum });
      console.log('[Onboarding Step 2] Profile updated successfully');
      onNext(medName, selectedDose);
    } catch (err) {
      console.error('[Onboarding Step 2] Failed to update profile:', err);
      onNext(medName, selectedDose);
    } finally {
      setLoading(false);
    }
  };

  const currentDoses = selectedMed ? DOSES[selectedMed] : [];
  const canContinue = !!selectedMed && !!selectedDose;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Your medication</Text>
      <Text style={styles.stepSubtitle}>Select your current GLP-1 medication</Text>

      <View style={styles.medCardList}>
        {MEDICATIONS.map((med) => {
          const isSelected = selectedMed === med.id;
          return (
            <AnimatedPressable
              key={med.id}
              onPress={() => handleSelectMed(med.id)}
              style={[styles.medCard, isSelected && styles.medCardSelected]}
            >
              <Text style={styles.medCardName}>{med.name}</Text>
              <Text style={styles.medCardDrug}>{med.drug}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {selectedMed && (
        <Animated.View style={[styles.dosePicker, { opacity: doseOpacity }]}>
          <Text style={styles.doseLabel}>Select your dose</Text>
          <View style={styles.chipRow}>
            {currentDoses.map((dose) => {
              const isSelected = selectedDose === dose;
              return (
                <AnimatedPressable
                  key={dose}
                  onPress={() => handleSelectDose(dose)}
                  style={[styles.doseChip, isSelected && styles.doseChipSelected]}
                >
                  <Text style={[styles.doseChipText, isSelected && styles.doseChipTextSelected]}>
                    {dose}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </Animated.View>
      )}

      <View style={styles.buttonSpacer} />
      <ContinueButton onPress={handleContinue} disabled={!canContinue} loading={loading} />
    </View>
  );
}

// ─── Step 3 — Body Data ───────────────────────────────────────────────────────

function Step3({ onNext }: { onNext: () => void }) {
  const [weightValue, setWeightValue] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [age, setAge] = useState('');
  const [ageError, setAgeError] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAgeBlur = () => {
    const ageNum = parseInt(age, 10);
    if (age && ageNum < 18) {
      setAgeError('Must be 18 or older');
    } else {
      setAgeError('');
    }
  };

  const handleAgeChange = (val: string) => {
    setAge(val);
    if (ageError) {
      const ageNum = parseInt(val, 10);
      if (!val || ageNum >= 18) setAgeError('');
    }
  };

  const handleSelectGender = (g: string) => {
    console.log(`[Onboarding Step 3] Gender selected: ${g}`);
    setGender(g);
  };

  const handleSelectCountry = (c: string) => {
    console.log(`[Onboarding Step 3] Country selected: ${c}`);
    setCountry(c);
    setCountryModalVisible(false);
    setCountrySearch('');
  };

  const handleOpenCountryModal = () => {
    console.log('[Onboarding Step 3] Country picker opened');
    setCountryModalVisible(true);
  };

  const filteredCountries = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handleContinue = async () => {
    const ageNum = parseInt(age, 10);
    if (age && ageNum < 18) return;

    const payload: Record<string, unknown> = {};

    if (weightValue) {
      const w = parseFloat(weightValue);
      if (!isNaN(w)) {
        payload.weight_kg = weightUnit === 'lbs' ? w * 0.453592 : w;
      }
    }

    if (heightUnit === 'cm') {
      if (heightCm) {
        const h = parseFloat(heightCm);
        if (!isNaN(h)) payload.height_cm = h;
      }
    } else {
      const ft = parseFloat(heightFt) || 0;
      const inches = parseFloat(heightIn) || 0;
      if (heightFt || heightIn) {
        payload.height_cm = ft * 30.48 + inches * 2.54;
      }
    }

    if (age && !isNaN(ageNum)) payload.age = ageNum;
    if (gender) payload.gender = gender;
    if (country) payload.country = country;

    console.log('[Onboarding Step 3] Saving body data:', payload);
    setLoading(true);
    try {
      if (Object.keys(payload).length > 0) {
        await apiPut('/api/profile', payload);
        console.log('[Onboarding Step 3] Profile updated successfully');
      }
      onNext();
    } catch (err) {
      console.error('[Onboarding Step 3] Failed to update profile:', err);
      onNext();
    } finally {
      setLoading(false);
    }
  };

  const countryDisplayText = country ?? 'Select country';
  const countryTextStyle = country ? styles.countryText : styles.countryPlaceholder;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>About you</Text>
      <Text style={styles.stepSubtitle}>This helps us calibrate your portions</Text>

      <View style={styles.fieldsContainer}>
        {/* Weight */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Weight</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              keyboardType="numeric"
              placeholder="e.g. 75"
              placeholderTextColor={COLORS.textTertiary}
              value={weightValue}
              onChangeText={setWeightValue}
              returnKeyType="next"
            />
            <View style={styles.unitToggle}>
              <AnimatedPressable
                onPress={() => {
                  console.log('[Onboarding Step 3] Weight unit changed to kg');
                  setWeightUnit('kg');
                }}
                style={[styles.unitChip, weightUnit === 'kg' && styles.unitChipSelected]}
              >
                <Text style={[styles.unitChipText, weightUnit === 'kg' && styles.unitChipTextSelected]}>
                  kg
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => {
                  console.log('[Onboarding Step 3] Weight unit changed to lbs');
                  setWeightUnit('lbs');
                }}
                style={[styles.unitChip, weightUnit === 'lbs' && styles.unitChipSelected]}
              >
                <Text style={[styles.unitChipText, weightUnit === 'lbs' && styles.unitChipTextSelected]}>
                  lbs
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>

        {/* Height */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Height</Text>
          <View style={styles.inputRow}>
            {heightUnit === 'cm' ? (
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                keyboardType="numeric"
                placeholder="e.g. 170"
                placeholderTextColor={COLORS.textTertiary}
                value={heightCm}
                onChangeText={setHeightCm}
                returnKeyType="next"
              />
            ) : (
              <View style={styles.ftInRow}>
                <TextInput
                  style={[styles.textInput, styles.ftInput]}
                  keyboardType="numeric"
                  placeholder="ft"
                  placeholderTextColor={COLORS.textTertiary}
                  value={heightFt}
                  onChangeText={setHeightFt}
                  returnKeyType="next"
                />
                <TextInput
                  style={[styles.textInput, styles.inInput]}
                  keyboardType="numeric"
                  placeholder="in"
                  placeholderTextColor={COLORS.textTertiary}
                  value={heightIn}
                  onChangeText={setHeightIn}
                  returnKeyType="next"
                />
              </View>
            )}
            <View style={styles.unitToggle}>
              <AnimatedPressable
                onPress={() => {
                  console.log('[Onboarding Step 3] Height unit changed to cm');
                  setHeightUnit('cm');
                }}
                style={[styles.unitChip, heightUnit === 'cm' && styles.unitChipSelected]}
              >
                <Text style={[styles.unitChipText, heightUnit === 'cm' && styles.unitChipTextSelected]}>
                  cm
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => {
                  console.log('[Onboarding Step 3] Height unit changed to ft');
                  setHeightUnit('ft');
                }}
                style={[styles.unitChip, heightUnit === 'ft' && styles.unitChipSelected]}
              >
                <Text style={[styles.unitChipText, heightUnit === 'ft' && styles.unitChipTextSelected]}>
                  ft
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>

        {/* Age */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Age</Text>
          <TextInput
            style={[styles.textInput, ageError ? styles.textInputError : null]}
            keyboardType="numeric"
            placeholder="e.g. 35"
            placeholderTextColor={COLORS.textTertiary}
            value={age}
            onChangeText={handleAgeChange}
            onBlur={handleAgeBlur}
            returnKeyType="next"
          />
          {ageError ? <Text style={styles.fieldError}>{ageError}</Text> : null}
        </View>

        {/* Gender */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.chipRow}>
            {GENDERS.map((g) => {
              const isSelected = gender === g;
              return (
                <AnimatedPressable
                  key={g}
                  onPress={() => handleSelectGender(g)}
                  style={[styles.genderChip, isSelected && styles.doseChipSelected]}
                >
                  <Text style={[styles.genderChipText, isSelected && styles.doseChipTextSelected]}>
                    {g}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        {/* Country */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Country</Text>
          <AnimatedPressable onPress={handleOpenCountryModal} style={styles.countryPicker}>
            <Text style={countryTextStyle}>{countryDisplayText}</Text>
          </AnimatedPressable>
        </View>
      </View>

      <View style={styles.buttonSpacer} />
      <ContinueButton onPress={handleContinue} loading={loading} />

      {/* Country Modal */}
      <Modal
        visible={countryModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCountryModalVisible(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalSearchRow}>
            <Search size={16} color={COLORS.textSecondary} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search countries"
              placeholderTextColor={COLORS.textTertiary}
              value={countrySearch}
              onChangeText={setCountrySearch}
              autoFocus
            />
          </View>
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <AnimatedPressable
                onPress={() => handleSelectCountry(item)}
                style={styles.countryRow}
              >
                <Text style={styles.countryRowText}>{item}</Text>
              </AnimatedPressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

// ─── Step 4 — Completion ──────────────────────────────────────────────────────

function Step4({
  medication,
  dose,
}: {
  medication: string;
  dose: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const subtitleText = `Right Food will now calibrate your portions to your ${medication} ${dose} dose.`;

  const handleStart = async () => {
    console.log('[Onboarding Step 4] "Start scanning meals" pressed');
    setLoading(true);
    try {
      await apiPut('/api/profile', { onboarding_completed: true });
      console.log('[Onboarding Step 4] Onboarding marked complete, navigating to home');
      router.replace('/(tabs)/(scan)' as never);
    } catch (err) {
      console.error('[Onboarding Step 4] Failed to mark onboarding complete:', err);
      router.replace('/(tabs)/(scan)' as never);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.step4Wrapper}>
      <View style={styles.step4Center}>
        <View style={styles.step4IconCircle}>
          <CheckCircle size={40} color={COLORS.primary} strokeWidth={1.5} />
        </View>
        <Text style={styles.step4Title}>You're all set</Text>
        <Text style={styles.step4Subtitle}>{subtitleText}</Text>
      </View>

      <ContinueButton onPress={handleStart} loading={loading} label="Start scanning meals" />
    </View>
  );
}

// ─── Root Onboarding Screen ───────────────────────────────────────────────────

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const [medication, setMedication] = useState('');
  const [dose, setDose] = useState('');
  const stepOpacity = useRef(new Animated.Value(1)).current;

  const advanceStep = useCallback(
    (nextStep: number, medName?: string, doseVal?: string) => {
      if (medName) setMedication(medName);
      if (doseVal) setDose(doseVal);

      Animated.timing(stepOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setStep(nextStep);
        Animated.timing(stepOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      });
    },
    [stepOpacity]
  );

  const handleStep1Next = useCallback(() => advanceStep(2), [advanceStep]);
  const handleStep2Next = useCallback(
    (med: string, d: string) => advanceStep(3, med, d),
    [advanceStep]
  );
  const handleStep3Next = useCallback(() => advanceStep(4), [advanceStep]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.headerArea}>
          {step < 4 && <ProgressBar step={step} />}
        </View>

        <Animated.View style={[styles.flex, { opacity: stepOpacity }]}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 1 && <Step1 onNext={handleStep1Next} />}
            {step === 2 && <Step2 onNext={handleStep2Next} />}
            {step === 3 && <Step3 onNext={handleStep3Next} />}
            {step === 4 && <Step4 medication={medication} dose={dose} />}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerArea: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    flexGrow: 1,
  },

  // Progress bar
  progressContainer: {
    marginBottom: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
  },

  // Step shared
  stepContent: {
    flex: 1,
    paddingTop: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 22,
  },
  buttonSpacer: {
    flex: 1,
    minHeight: 32,
  },
  continueButton: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Step 1
  disclaimerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 24,
  },
  disclaimerText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxLabel: {
    fontSize: 15,
    color: COLORS.text,
    marginLeft: 12,
  },

  // Step 2
  medCardList: {
    marginTop: 24,
    gap: 12,
  },
  medCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  medCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  medCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  medCardDrug: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dosePicker: {
    marginTop: 24,
  },
  doseLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  doseChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  doseChipSelected: {
    backgroundColor: COLORS.primary,
    borderWidth: 0,
  },
  doseChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  doseChipTextSelected: {
    color: '#FFFFFF',
  },

  // Step 3
  fieldsContainer: {
    marginTop: 24,
    gap: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  textInput: {
    height: 48,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textInputError: {
    borderColor: COLORS.danger,
  },
  fieldError: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  unitToggle: {
    flexDirection: 'row',
    gap: 4,
  },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSecondary,
  },
  unitChipSelected: {
    backgroundColor: COLORS.primary,
  },
  unitChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  unitChipTextSelected: {
    color: '#FFFFFF',
  },
  ftInRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  ftInput: {
    flex: 1,
  },
  inInput: {
    flex: 1,
  },
  genderChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSecondary,
  },
  genderChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  countryPicker: {
    height: 48,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countryText: {
    fontSize: 15,
    color: COLORS.text,
  },
  countryPlaceholder: {
    fontSize: 15,
    color: COLORS.textTertiary,
  },

  // Country modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    paddingBottom: 32,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: COLORS.text,
  },
  countryRow: {
    height: 48,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  countryRowText: {
    fontSize: 15,
    color: COLORS.text,
  },

  // Step 4
  step4Wrapper: {
    flex: 1,
    paddingTop: 24,
    justifyContent: 'space-between',
  },
  step4Center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  step4IconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  step4Title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 24,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  step4Subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 280,
    lineHeight: 24,
  },
});
