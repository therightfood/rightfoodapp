import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { BodyScrollView } from '@/components/BodyScrollView';

const BODY_TEXT =
  "Right Food is a personal wellness tool designed to help GLP-1 medication users understand portion sizes. It is not a medical device, does not provide medical advice, and is not intended to diagnose, treat, cure, or prevent any disease or health condition. Always follow your prescriber's guidance for your medication, dosing, and dietary needs. Right Food is not affiliated with Novo Nordisk or Eli Lilly.";

export default function MedicalDisclaimerScreen() {
  return (
    <BodyScrollView contentContainerStyle={styles.container}>
      <Text style={styles.body}>{BODY_TEXT}</Text>
    </BodyScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    color: '#1A1A1A',
  },
});
