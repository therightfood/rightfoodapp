import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, BookOpen, UtensilsCrossed, ScrollText, User } from 'lucide-react-native';

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
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {TABS.map((tab) => {
        const active = isActive(tab.name);
        const IconComponent = tab.icon;
        const iconColor = active ? TAB_COLORS.active : TAB_COLORS.inactive;
        const labelColor = active ? TAB_COLORS.active : TAB_COLORS.inactive;
        const strokeWidth = active ? 2.5 : 2;
        return (
          <Pressable
            key={tab.name}
            style={styles.tab}
            onPress={() => handleTabPress(tab)}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
          >
            <IconComponent
              size={24}
              color={iconColor}
              strokeWidth={strokeWidth}
            />
            <Text style={[styles.label, { color: labelColor }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
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
    alignItems: 'flex-start',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    paddingTop: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
  },
});
