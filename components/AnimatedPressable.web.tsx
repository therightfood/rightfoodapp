import React, { useRef, useCallback } from 'react';
import { Animated, Pressable, ViewStyle, StyleProp, PressableProps } from 'react-native';

interface AnimatedPressableProps {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  disabled?: boolean;
  scaleValue?: number;
  accessibilityLabel?: string;
  accessibilityRole?: PressableProps['accessibilityRole'];
  accessibilityHint?: string;
  testID?: string;
  hitSlop?: PressableProps['hitSlop'];
  delayLongPress?: number;
}

export function AnimatedPressable({
  onPress,
  onLongPress,
  style,
  children,
  disabled,
  scaleValue = 0.97,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  testID,
  hitSlop,
  delayLongPress,
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleValue,
      useNativeDriver: false,
      speed: 50,
      bounciness: 4,
    }).start();
  }, []);

  const animateOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: false,
      speed: 50,
      bounciness: 4,
    }).start();
  }, []);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, disabled ? { opacity: 0.5 } : undefined]}>
      <Pressable
        onPressIn={animateIn}
        onPressOut={animateOut}
        onPress={disabled ? undefined : onPress}
        onLongPress={disabled ? undefined : onLongPress}
        disabled={disabled}
        style={style}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessibilityHint={accessibilityHint}
        testID={testID}
        hitSlop={hitSlop}
        delayLongPress={delayLongPress}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
