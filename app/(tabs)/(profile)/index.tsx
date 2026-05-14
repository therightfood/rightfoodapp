import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  Animated,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ChevronRight,
  Bell,
  LogOut,
  X,
  Plus,
} from 'lucide-react-native';
import { COLORS } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useAuth } from '@/contexts/AuthContext';
import { authClient } from '@/lib/auth';
import { apiGet, apiPut, apiDelete } from '@/utils/api';
import { useNotifications } from '@/contexts/NotificationContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const MEDICATIONS = [
  { id: 'ozempic', name: 'Ozempic', drug: 'semaglutide' },
  { id: 'wegovy', name: 'Wegovy', drug: 'semaglutide' },
  { id: 'mounjaro', name: 'Mounjaro', drug: 'tirzepatide' },
  { id: 'zepbound', name: 'Zepbound', drug: 'tirzepatide' },
] as const;

const MEDICATION_DOSES: Record<string, string[]> = {
  ozempic: ['0.25mg', '0.5mg', '1mg', '2mg'],
  wegovy: ['0.25mg', '0.5mg', '1mg', '1.7mg', '2.4mg'],
  mounjaro: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'],
  zepbound: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  medication: string | null;
  dose_mg: number | null;
  reminder_enabled: boolean;
  reminder_times: string[];
  created_at: string;
}

interface Stats {
  total_meals_scanned: number;
  days_using_app: number;
  current_streak: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeStringToDate(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hours ?? 12, minutes ?? 0, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatTimeDisplay(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const h = hours ?? 12;
  const m = minutes ?? 0;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getMedId(medicationName: string | null): string | null {
  if (!medicationName) return null;
  const lower = medicationName.toLowerCase();
  const found = MEDICATIONS.find((m) => m.name.toLowerCase() === lower || m.id === lower);
  return found ? found.id : null;
}

function formatDoseMg(doseMg: number | null): string {
  if (doseMg === null || doseMg === undefined) return '—';
  const num = Number(doseMg);
  if (isNaN(num)) return '—';
  // Format: remove trailing zeros
  const str = num % 1 === 0 ? `${num}mg` : `${num}mg`;
  return str;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBox({ width, height = 14, style }: { width: number | string; height?: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  if (Platform.OS === 'web') {
    return <View style={[{ width, height, borderRadius: height / 2, backgroundColor: COLORS.surfaceSecondary, opacity: 0.5 }, style]} />;
  }
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: height / 2, backgroundColor: COLORS.surfaceSecondary, opacity },
        style,
      ]}
    />
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

// ─── Profile Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermission, setShowPrimingModal, saveTimezone } = useNotifications();

  // Data
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  // Reminders
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTimes, setReminderTimes] = useState<string[]>([]);
  const [showTimePicker, setShowTimePicker] = useState<number | null>(null);
  const reminderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals
  const [showMedModal, setShowMedModal] = useState(false);

  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Medication modal state
  const [modalSelectedMed, setModalSelectedMed] = useState<string | null>(null);
  const [modalSelectedDose, setModalSelectedDose] = useState<string | null>(null);
  const [savingMed, setSavingMed] = useState(false);
  const doseOpacity = useRef(new Animated.Value(0)).current;

  // Delete modal state
  const [deleteInput, setDeleteInput] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    console.log('[Profile] Loading profile and stats');
    setLoadingProfile(true);
    setLoadingStats(true);

    try {
      const [profileData, statsData] = await Promise.all([
        apiGet<Profile>('/api/profile'),
        apiGet<Stats>('/api/profile/stats'),
      ]);

      console.log('[Profile] Profile loaded:', profileData);
      console.log('[Profile] Stats loaded:', statsData);

      setProfile(profileData);
      setStats(statsData);
      setReminderEnabled(profileData.reminder_enabled ?? false);
      setReminderTimes(profileData.reminder_times ?? []);
    } catch (err) {
      console.error('[Profile] Failed to load data:', err);
    } finally {
      setLoadingProfile(false);
      setLoadingStats(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ── Reminder debounce save ─────────────────────────────────────────────────

  const saveReminders = useCallback((enabled: boolean, times: string[]) => {
    if (reminderDebounceRef.current) clearTimeout(reminderDebounceRef.current);
    reminderDebounceRef.current = setTimeout(async () => {
      console.log('[Profile] Saving reminders:', { reminder_enabled: enabled, reminder_times: times });
      try {
        await apiPut('/api/profile/reminders', { reminder_enabled: enabled, reminder_times: times });
        console.log('[Profile] Reminders saved successfully');
      } catch (err) {
        console.error('[Profile] Failed to save reminders:', err);
      }
    }, 800);
  }, []);

  const handleToggleReminder = useCallback((value: boolean) => {
    console.log('[Profile] Reminder toggle pressed:', value);
    if (value && !hasPermission) {
      console.log('[Profile] No notification permission — showing priming modal');
      setShowPrimingModal(true);
      return;
    }
    if (value) {
      saveTimezone().catch(() => {});
    }
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setReminderEnabled(value);
    saveReminders(value, reminderTimes);
  }, [reminderTimes, saveReminders, hasPermission, setShowPrimingModal, saveTimezone]);

  const handleAddReminderSlot = useCallback(() => {
    console.log('[Profile] Add reminder slot pressed');
    if (reminderTimes.length >= 3) return;
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    const newTimes = [...reminderTimes, '12:00'];
    setReminderTimes(newTimes);
    saveReminders(reminderEnabled, newTimes);
  }, [reminderTimes, reminderEnabled, saveReminders]);

  const handleRemoveReminderSlot = useCallback((index: number) => {
    console.log('[Profile] Remove reminder slot pressed, index:', index);
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    const newTimes = reminderTimes.filter((_, i) => i !== index);
    setReminderTimes(newTimes);
    saveReminders(reminderEnabled, newTimes);
  }, [reminderTimes, reminderEnabled, saveReminders]);

  const handleTimeChange = useCallback((_: unknown, selectedDate: Date | undefined, index: number) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(null);
    }
    if (selectedDate) {
      const timeStr = dateToTimeString(selectedDate);
      console.log('[Profile] Time changed for slot', index, ':', timeStr);
      const newTimes = reminderTimes.map((t, i) => (i === index ? timeStr : t));
      setReminderTimes(newTimes);
      saveReminders(reminderEnabled, newTimes);
    }
  }, [reminderTimes, reminderEnabled, saveReminders]);

  // ── Medication modal ───────────────────────────────────────────────────────

  const openMedModal = useCallback(() => {
    console.log('[Profile] Open medication modal pressed');
    const currentMedId = getMedId(profile?.medication ?? null);
    const currentDose = profile?.dose_mg != null ? formatDoseMg(profile.dose_mg) : null;
    setModalSelectedMed(currentMedId);
    setModalSelectedDose(currentDose !== '—' ? currentDose : null);
    if (currentMedId) {
      doseOpacity.setValue(1);
    } else {
      doseOpacity.setValue(0);
    }
    setShowMedModal(true);
  }, [profile, doseOpacity]);

  const handleModalSelectMed = useCallback((id: string) => {
    console.log('[Profile] Modal medication selected:', id);
    if (modalSelectedMed !== id) {
      setModalSelectedDose(null);
    }
    setModalSelectedMed(id);
    Animated.timing(doseOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [modalSelectedMed, doseOpacity]);

  const handleModalSelectDose = useCallback((dose: string) => {
    console.log('[Profile] Modal dose selected:', dose);
    setModalSelectedDose(dose);
  }, []);

  const handleSaveMedication = useCallback(async () => {
    if (!modalSelectedMed || !modalSelectedDose) return;
    const medObj = MEDICATIONS.find((m) => m.id === modalSelectedMed);
    const medName = medObj?.name ?? modalSelectedMed;
    const doseNum = parseFloat(modalSelectedDose);
    console.log('[Profile] Saving medication:', { medication: medName, dose_mg: doseNum });
    setSavingMed(true);
    try {
      await apiPut('/api/profile', { medication: medName, dose_mg: doseNum });
      console.log('[Profile] Medication saved successfully');
      setShowMedModal(false);
      loadData();
    } catch (err) {
      console.error('[Profile] Failed to save medication:', err);
    } finally {
      setSavingMed(false);
    }
  }, [modalSelectedMed, modalSelectedDose, loadData]);

  // ── Sign out ───────────────────────────────────────────────────────────────

  const handleSignOut = useCallback(async () => {
    console.log('[Profile] Sign out confirmed');
    try {
      await authClient.signOut();
      console.log('[Profile] Signed out successfully');
    } catch (err) {
      console.error('[Profile] Sign out error:', err);
    }
    setShowSignOutModal(false);
    router.replace('/');
  }, [router]);

  // ── Delete account ─────────────────────────────────────────────────────────

  const handleDeleteAccount = useCallback(async () => {
    console.log('[Profile] Delete account confirmed');
    setDeletingAccount(true);
    try {
      await apiDelete('/api/account');
      console.log('[Profile] Account deleted successfully');
      await authClient.signOut();
      setShowDeleteModal(false);
      router.replace('/');
    } catch (err) {
      console.error('[Profile] Failed to delete account:', err);
    } finally {
      setDeletingAccount(false);
    }
  }, [router]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const userInitial = user?.email ? user.email[0].toUpperCase() : '?';
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  const medicationDisplay = profile?.medication
    ? profile.medication.charAt(0).toUpperCase() + profile.medication.slice(1)
    : null;

  const doseDisplay = formatDoseMg(profile?.dose_mg ?? null);

  const currentModalDoses = modalSelectedMed ? (MEDICATION_DOSES[modalSelectedMed] ?? []) : [];
  const canSaveMed = !!modalSelectedMed && !!modalSelectedDose;

  const streakDisplay =
    stats && stats.current_streak > 0
      ? `${stats.current_streak} 🔥`
      : stats
      ? `${stats.current_streak}`
      : '—';

  const deleteConfirmEnabled = deleteInput.toLowerCase() === 'delete';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* ── Section 1: User Info ── */}
        <View style={styles.card}>
          <View style={styles.userRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{userInitial}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userEmail} numberOfLines={1}>
                {user?.email ?? '—'}
              </Text>
              {loadingProfile ? (
                <SkeletonBox width={120} height={12} style={{ marginTop: 6 }} />
              ) : (
                <Text style={styles.memberSince}>
                  {'Member since '}
                  {memberSince}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Section 2: GLP-1 ── */}
        <View style={styles.sectionWrapper}>
          <SectionLabel label="MY GLP-1" />
          <View style={styles.cardOverflow}>
            {/* Medication row */}
            <View style={styles.medRow}>
              <View style={styles.medLeft}>
                <Text style={styles.medLabel}>Medication</Text>
                {loadingProfile ? (
                  <SkeletonBox width={100} height={14} style={{ marginTop: 6 }} />
                ) : (
                  <Text
                    style={[
                      styles.medName,
                      !medicationDisplay && styles.medNameEmpty,
                    ]}
                  >
                    {medicationDisplay ?? 'Not set'}
                  </Text>
                )}
              </View>
              {loadingProfile ? (
                <SkeletonBox width={48} height={28} style={{ borderRadius: 14 }} />
              ) : (
                <View style={styles.doseBadge}>
                  <Text style={styles.doseBadgeText}>{doseDisplay}</Text>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* Update row */}
            <AnimatedPressable onPress={openMedModal} style={styles.updateRow}>
              <Text style={styles.updateRowText}>Update medication or dose</Text>
              <ChevronRight size={16} color={COLORS.primary} strokeWidth={2} />
            </AnimatedPressable>
          </View>
        </View>

        {/* ── Section 3: Stats ── */}
        <View style={styles.sectionWrapper}>
          <SectionLabel label="MY STATS" />
          <View style={styles.card}>
            <View style={styles.statsRow}>
              {loadingStats ? (
                <>
                  <View style={styles.statItem}>
                    <SkeletonBox width={40} height={24} style={{ borderRadius: 4 }} />
                    <SkeletonBox width={72} height={12} style={{ marginTop: 8, borderRadius: 4 }} />
                  </View>
                  <View style={styles.statItem}>
                    <SkeletonBox width={40} height={24} style={{ borderRadius: 4 }} />
                    <SkeletonBox width={60} height={12} style={{ marginTop: 8, borderRadius: 4 }} />
                  </View>
                  <View style={styles.statItem}>
                    <SkeletonBox width={40} height={24} style={{ borderRadius: 4 }} />
                    <SkeletonBox width={64} height={12} style={{ marginTop: 8, borderRadius: 4 }} />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats?.total_meals_scanned ?? 0}</Text>
                    <Text style={styles.statLabel}>Meals scanned</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats?.days_using_app ?? 0}</Text>
                    <Text style={styles.statLabel}>Days active</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{streakDisplay}</Text>
                    <Text style={styles.statLabel}>Day streak</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* ── Section 4: Reminders ── */}
        <View style={styles.sectionWrapper}>
          <SectionLabel label="REMINDERS" />
          <View style={styles.cardOverflow}>
            {/* Toggle row */}
            <View style={styles.reminderToggleRow}>
              <View style={styles.reminderToggleLeft}>
                <Bell size={18} color={COLORS.textSecondary} strokeWidth={2} />
                <Text style={styles.reminderToggleText}>Meal reminders</Text>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={handleToggleReminder}
                trackColor={{ true: COLORS.primary, false: COLORS.surfaceSecondary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Time slots */}
            {reminderEnabled && (
              <View style={styles.timeSlotsSection}>
                <Text style={styles.timeSlotsLabel}>Reminder times</Text>

                {reminderTimes.map((time, index) => {
                  const displayTime = formatTimeDisplay(time);
                  return (
                    <View key={index} style={styles.timeSlotRow}>
                      <AnimatedPressable
                        onPress={() => {
                          console.log('[Profile] Time slot pressed, index:', index);
                          setShowTimePicker(index);
                        }}
                        style={styles.timeSlotDisplay}
                      >
                        <Text style={styles.timeSlotText}>{displayTime}</Text>
                      </AnimatedPressable>
                      <AnimatedPressable
                        onPress={() => handleRemoveReminderSlot(index)}
                        style={styles.timeSlotRemove}
                        accessibilityLabel="Remove reminder"
                      >
                        <X size={16} color={COLORS.textTertiary} strokeWidth={2} />
                      </AnimatedPressable>
                    </View>
                  );
                })}

                {reminderTimes.length < 3 && (
                  <AnimatedPressable onPress={handleAddReminderSlot} style={styles.addReminderBtn}>
                    <Plus size={14} color={COLORS.primary} strokeWidth={2.5} />
                    <Text style={styles.addReminderText}>Add reminder</Text>
                  </AnimatedPressable>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ── Section 5: Account ── */}
        <View style={[styles.sectionWrapper, styles.lastSection]}>
          <SectionLabel label="ACCOUNT" />
          <View style={styles.cardOverflow}>
            {/* Privacy Policy */}
            <AnimatedPressable
              onPress={() => {
                console.log('[Profile] Privacy Policy pressed');
                router.push('/privacy-policy');
              }}
              style={styles.accountRow}
            >
              <Text style={styles.accountRowText}>Privacy Policy</Text>
              <ChevronRight size={16} color={COLORS.textTertiary} strokeWidth={2} />
            </AnimatedPressable>
            <View style={styles.rowDivider} />

            {/* Terms of Service */}
            <AnimatedPressable
              onPress={() => {
                console.log('[Profile] Terms of Service pressed');
                router.push('/terms-of-service');
              }}
              style={styles.accountRow}
            >
              <Text style={styles.accountRowText}>Terms of Service</Text>
              <ChevronRight size={16} color={COLORS.textTertiary} strokeWidth={2} />
            </AnimatedPressable>
            <View style={styles.rowDivider} />

            {/* Medical Disclaimer */}
            <AnimatedPressable
              onPress={() => {
                console.log('[Profile] Medical Disclaimer pressed');
                router.push('/medical-disclaimer');
              }}
              style={styles.accountRow}
            >
              <Text style={styles.accountRowText}>Medical Disclaimer</Text>
              <ChevronRight size={16} color={COLORS.textTertiary} strokeWidth={2} />
            </AnimatedPressable>
            <View style={styles.rowDivider} />

            {/* Sign out */}
            <AnimatedPressable
              onPress={() => {
                console.log('[Profile] Sign out pressed');
                setShowSignOutModal(true);
              }}
              style={styles.accountRow}
            >
              <Text style={styles.accountRowText}>Sign out</Text>
              <LogOut size={16} color={COLORS.textTertiary} strokeWidth={2} />
            </AnimatedPressable>
            <View style={styles.rowDivider} />

            {/* Delete account */}
            <AnimatedPressable
              onPress={() => {
                console.log('[Profile] Delete account pressed');
                setDeleteInput('');
                setShowDeleteModal(true);
              }}
              style={styles.accountRow}
            >
              <Text style={styles.deleteRowText}>Delete account</Text>
            </AnimatedPressable>
          </View>
        </View>
      </ScrollView>

      {/* ── DateTimePicker (Android inline) ── */}
      {showTimePicker !== null && Platform.OS === 'android' && (
        <DateTimePicker
          value={timeStringToDate(reminderTimes[showTimePicker] ?? '12:00')}
          mode="time"
          display="default"
          onChange={(e, date) => handleTimeChange(e, date, showTimePicker)}
        />
      )}

      {/* ── DateTimePicker (iOS modal) ── */}
      {showTimePicker !== null && Platform.OS === 'ios' && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setShowTimePicker(null)}
        >
          <View style={styles.timePickerOverlay}>
            <View style={styles.timePickerSheet}>
              <View style={styles.timePickerHeader}>
                <Text style={styles.timePickerTitle}>Set reminder time</Text>
                <AnimatedPressable
                  onPress={() => setShowTimePicker(null)}
                  style={styles.timePickerClose}
                  accessibilityLabel="Close time picker"
                >
                  <X size={20} color={COLORS.textSecondary} strokeWidth={2} />
                </AnimatedPressable>
              </View>
              <DateTimePicker
                value={timeStringToDate(reminderTimes[showTimePicker] ?? '12:00')}
                mode="time"
                display="spinner"
                onChange={(e, date) => handleTimeChange(e, date, showTimePicker)}
                style={styles.iosTimePicker}
              />
              <AnimatedPressable
                onPress={() => setShowTimePicker(null)}
                style={styles.timePickerDoneBtn}
              >
                <Text style={styles.timePickerDoneText}>Done</Text>
              </AnimatedPressable>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Medication Update Modal ── */}
      <Modal
        visible={showMedModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMedModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Update medication</Text>
            <AnimatedPressable
              onPress={() => {
                console.log('[Profile] Close medication modal pressed');
                setShowMedModal(false);
              }}
              style={styles.modalCloseBtn}
              accessibilityLabel="Close modal"
            >
              <X size={20} color={COLORS.textSecondary} strokeWidth={2} />
            </AnimatedPressable>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.medCardList}>
              {MEDICATIONS.map((med) => {
                const isSelected = modalSelectedMed === med.id;
                return (
                  <AnimatedPressable
                    key={med.id}
                    onPress={() => handleModalSelectMed(med.id)}
                    style={[styles.medCard, isSelected && styles.medCardSelected]}
                  >
                    <Text style={styles.medCardName}>{med.name}</Text>
                    <Text style={styles.medCardDrug}>{med.drug}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            {modalSelectedMed && (
              Platform.OS === 'web' ? (
                <View style={[styles.dosePicker, { opacity: 1 }]}>
                  <Text style={styles.dosePickerLabel}>Select your dose</Text>
                  <View style={styles.chipRow}>
                    {currentModalDoses.map((dose) => {
                      const isSelected = modalSelectedDose === dose;
                      return (
                        <AnimatedPressable
                          key={dose}
                          onPress={() => handleModalSelectDose(dose)}
                          style={[styles.doseChip, isSelected && styles.doseChipSelected]}
                        >
                          <Text
                            style={[
                              styles.doseChipText,
                              isSelected && styles.doseChipTextSelected,
                            ]}
                          >
                            {dose}
                          </Text>
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <Animated.View style={[styles.dosePicker, { opacity: doseOpacity }]}>
                  <Text style={styles.dosePickerLabel}>Select your dose</Text>
                  <View style={styles.chipRow}>
                    {currentModalDoses.map((dose) => {
                      const isSelected = modalSelectedDose === dose;
                      return (
                        <AnimatedPressable
                          key={dose}
                          onPress={() => handleModalSelectDose(dose)}
                          style={[styles.doseChip, isSelected && styles.doseChipSelected]}
                        >
                          <Text
                            style={[
                              styles.doseChipText,
                              isSelected && styles.doseChipTextSelected,
                            ]}
                          >
                            {dose}
                          </Text>
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                </Animated.View>
              )
            )}

            <AnimatedPressable
              onPress={handleSaveMedication}
              disabled={!canSaveMed || savingMed}
              style={[styles.saveBtn, (!canSaveMed || savingMed) && styles.saveBtnDisabled]}
            >
              {savingMed ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save changes</Text>
              )}
            </AnimatedPressable>
          </ScrollView>
        </View>
      </Modal>


      {/* ── Sign Out Confirmation Modal ── */}
      <Modal
        visible={showSignOutModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View style={styles.confirmModalContainer}>
          <View style={styles.modalHandle} />
          <Text style={styles.confirmTitle}>Sign out?</Text>
          <Text style={styles.confirmBody}>
            You'll need to sign in again to access your meals and data.
          </Text>
          <View style={styles.confirmButtons}>
            <AnimatedPressable
              onPress={() => {
                console.log('[Profile] Sign out cancelled');
                setShowSignOutModal(false);
              }}
              style={styles.confirmCancelBtn}
            >
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={handleSignOut} style={styles.confirmDangerBtn}>
              <Text style={styles.confirmDangerText}>Sign out</Text>
            </AnimatedPressable>
          </View>
        </View>
      </Modal>

      {/* ── Delete Account Modal ── */}
      <Modal
        visible={showDeleteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.confirmModalContainer}>
          <View style={styles.modalHandle} />
          <Text style={styles.confirmTitle}>Delete your account?</Text>
          <Text style={styles.confirmBodyDelete}>
            This will permanently delete all your meals, analyses, and profile data. This cannot be
            undone.
          </Text>
          <TextInput
            style={styles.deleteInput}
            placeholder="Type 'delete' to confirm"
            placeholderTextColor={COLORS.textTertiary}
            value={deleteInput}
            onChangeText={(v) => {
              console.log('[Profile] Delete confirmation input changed');
              setDeleteInput(v);
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.confirmButtons}>
            <AnimatedPressable
              onPress={() => {
                console.log('[Profile] Delete account cancelled');
                setShowDeleteModal(false);
                setDeleteInput('');
              }}
              style={styles.confirmCancelBtn}
            >
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={handleDeleteAccount}
              disabled={!deleteConfirmEnabled || deletingAccount}
              style={[
                styles.confirmDeleteBtn,
                (!deleteConfirmEnabled || deletingAccount) && styles.confirmDeleteBtnDisabled,
              ]}
            >
              {deletingAccount ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmDeleteText}>Delete my account</Text>
              )}
            </AnimatedPressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },

  // Section wrapper
  sectionWrapper: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  lastSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  // Cards
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 12,
  },
  cardOverflow: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  // User info
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  memberSince: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },

  // GLP-1 card
  medRow: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medLeft: {
    flex: 1,
  },
  medLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  medName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 2,
  },
  medNameEmpty: {
    color: COLORS.textTertiary,
  },
  doseBadge: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  doseBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginHorizontal: 16,
  },
  updateRow: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  updateRowText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },

  // Reminders
  reminderToggleRow: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderToggleText: {
    fontSize: 15,
    color: COLORS.text,
    marginLeft: 10,
  },
  timeSlotsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  timeSlotsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  timeSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeSlotDisplay: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    padding: 12,
  },
  timeSlotText: {
    fontSize: 15,
    color: COLORS.text,
  },
  timeSlotRemove: {
    marginLeft: 8,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addReminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  addReminderText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },

  // Account rows
  accountRow: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountRowText: {
    fontSize: 15,
    color: COLORS.text,
  },
  deleteRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.danger,
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },

  // iOS time picker modal
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  timePickerSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  timePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  timePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  timePickerClose: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iosTimePicker: {
    height: 180,
  },
  timePickerDoneBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Medication modal
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  medCardList: {
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
  dosePickerLabel: {
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
  saveBtn: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Confirm modals (sign out / delete)
  confirmModalContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 24,
  },
  confirmBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 10,
    lineHeight: 20,
  },
  confirmBodyDelete: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 10,
    lineHeight: 20,
  },
  deleteInput: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  confirmCancelBtn: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  confirmDangerBtn: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmDangerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmDeleteBtn: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmDeleteBtnDisabled: {
    opacity: 0.4,
  },
  confirmDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
