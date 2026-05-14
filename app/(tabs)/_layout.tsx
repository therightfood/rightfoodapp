import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import RightFoodTabBar from '@/components/RightFoodTabBar';

export default function TabLayout() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
          <Stack.Screen name="(scan)" />
          <Stack.Screen name="(journey)" />
          <Stack.Screen name="(recipes)" />
          <Stack.Screen name="(menus)" />
          <Stack.Screen name="(profile)" />
        </Stack>
      </View>
      <RightFoodTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  content: { flex: 1 },
});
