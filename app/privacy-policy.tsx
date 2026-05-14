import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { BodyScrollView } from '@/components/BodyScrollView';

const SUMMARY_TEXT =
  "We collect your email, medication data, meal photos, and usage data to provide and improve the app. We do not sell your data. Meal photos are stored securely and only used for analysis. You can delete your account and all data at any time from the Profile screen.";

const FULL_POLICY_URL = 'https://right.food/privacy';

export default function PrivacyPolicyScreen() {
  const handleOpenFullPolicy = async () => {
    console.log('[PrivacyPolicy] View full Privacy Policy pressed');
    await WebBrowser.openBrowserAsync(FULL_POLICY_URL);
  };

  return (
    <BodyScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardText}>{SUMMARY_TEXT}</Text>
      </View>
      <TouchableOpacity onPress={handleOpenFullPolicy} style={styles.linkRow} activeOpacity={0.7}>
        <Text style={styles.linkText}>View full Privacy Policy</Text>
        <Text style={styles.linkArrow}> →</Text>
      </TouchableOpacity>
    </BodyScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E6E0',
    padding: 16,
    marginBottom: 16,
  },
  cardText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#1A1A1A',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E6E0',
  },
  linkText: {
    fontSize: 16,
    color: '#4A7C59',
    fontWeight: '500',
  },
  linkArrow: {
    fontSize: 16,
    color: '#4A7C59',
  },
});
