import React, { useState, useCallback } from 'react';
import { Pressable, ViewStyle, StyleProp, PressableProps, View } from 'react-native';

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
  const [pressed, setPressed] = useState(false);

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);

  // Use a plain View with CSS transition via style prop — no Animated API, no __s prop leak
  const wrapperStyle: ViewStyle = {
    opacity: disabled ? 0.5 : 1,
    // @ts-expect-error — 'transition' and 'transform' as CSS string are valid on web
    transition: 'transform 0.1s ease-out',
    transform: [{ scale: pressed && !disabled ? scaleValue : 1 }],
  };

  return (
    <View style={wrapperStyle}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
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
    </View>
  );
}
