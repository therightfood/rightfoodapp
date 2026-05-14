import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useNotifications } from '@/contexts/NotificationContext';
import { COLORS } from '@/constants/Colors';

export function NotificationPrimingModal() {
  const { showPrimingModal, setShowPrimingModal, requestPermission } = useNotifications();

  const handleEnable = async () => {
    console.log('[NotificationPrimingModal] "Enable reminders" pressed');
    setShowPrimingModal(false);
    await requestPermission();
  };

  const handleNotNow = () => {
    console.log('[NotificationPrimingModal] "Not now" pressed');
    setShowPrimingModal(false);
  };

  return (
    <Modal
      visible={showPrimingModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowPrimingModal(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Bell size={32} color={COLORS.primary} strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>Never miss a meal scan</Text>
          <Text style={styles.body}>
            Enable reminders and Right Food will remind you before each meal time — so you never
            forget to check your portion.
          </Text>
          <AnimatedPressable style={styles.enableButton} onPress={handleEnable}>
            <Text style={styles.enableButtonText}>Enable reminders</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.notNowButton} onPress={handleNotNow}>
            <Text style={styles.notNowText}>Not now</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  enableButton: {
    width: '100%',
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  enableButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  notNowButton: {
    width: '100%',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notNowText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
});
