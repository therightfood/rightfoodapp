import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { BodyScrollView } from '@/components/BodyScrollView';

const SUMMARY_TEXT =
  "By using Right Food, you agree to use the app for personal wellness purposes only. Right Food is not a medical device and does not provide medical advice. You are responsible for following your prescriber's guidance. We may update these terms from time to time.";

const FULL_TERMS_URL = 'https://right.food/terms';

export default function TermsOfServiceScreen() {
  const handleOpenFullTerms = async () => {
    console.log('[TermsOfService] View full Terms of Service pressed');
    await WebBrowser.openBrowserAsync(FULL_TERMS_URL);
  };

  return (
    <BodyScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardText}>{SUMMARY_TEXT}</Text>
      </View>
      <TouchableOpacity onPress={handleOpenFullTerms} style={styles.linkRow} activeOpacity={0.7}>
        <Text style={styles.linkText}>View full Terms of Service</Text>
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
