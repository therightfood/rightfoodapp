import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, BookOpen, UtensilsCrossed, ScrollText, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const TAB_COLORS = {
  background: '#FAFAF8',
  border: '#E8E6E0',
  active: '#4A7C59',
  inactive: '#7A6A5A',
};

const TABS = [
  { name: 'scan', route: '/(tabs)/(scan)', icon: Camera, label: 'Scan' },
  { name: 'journey', route: '/(tabs)/(journey)', icon: BookOpen, label: 'Journey' },
  { name: 'recipes', route: '/(tabs)/(recipes)', icon: UtensilsCrossed, label: 'Recipes' },
  { name: 'menus', route: '/(tabs)/(menus)', icon: ScrollText, label: 'Menus' },
  { name: 'profile', route: '/(tabs)/(profile)', icon: User, label: 'Profile' },
] as const;

function TabItem({
  tab,
  active,
  onPress,
}: {
  tab: typeof TABS[number];
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const dotOpacity = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(dotOpacity, {
      toValue: active ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [active]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }),
    ]).start();
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress();
  };

  const IconComponent = tab.icon;
  const iconColor = active ? TAB_COLORS.active : TAB_COLORS.inactive;
  const strokeWidth = active ? 2.5 : 1.8;
  const labelWeight = active ? '600' : '400';

  return (
    <Pressable
      style={styles.tab}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
    >
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        <IconComponent size={24} color={iconColor} strokeWidth={strokeWidth} />
        <Text style={[styles.label, { color: iconColor, fontWeight: labelWeight }]}>
          {tab.label}
        </Text>
        <Animated.View style={[styles.activeDot, { opacity: dotOpacity }]} />
      </Animated.View>
    </Pressable>
  );
}

export default function RightFoodTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isActive = (tabName: string) => pathname.includes(tabName);

  const handleTabPress = (tab: typeof TABS[number]) => {
    console.log(`[TabBar] Tab pressed: ${tab.label} -> ${tab.route}`);
    router.push(tab.route as never);
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => (
        <TabItem
          key={tab.name}
          tab={tab}
          active={isActive(tab.name)}
          onPress={() => handleTabPress(tab)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FAFAF8',
    borderTopWidth: 1,
    borderTopColor: '#E8E6E0',
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  tabInner: {
    alignItems: 'center',
    gap: 3,
    paddingTop: 2,
    paddingBottom: 2,
  },
  label: {
    fontSize: 10,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4A7C59',
    marginTop: 1,
  },
});
