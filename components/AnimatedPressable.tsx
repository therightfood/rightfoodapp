import { Pressable, Animated, PressableProps, ViewStyle, StyleProp, Platform } from 'react-native';
import { useRef, useCallback } from 'react';

const useNativeDriverValue = Platform.OS !== 'web';

interface AnimatedPressableProps extends PressableProps {
  scaleValue?: number;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedPressable({
  onPress,
  style,
  children,
  disabled,
  scaleValue = 0.97,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  testID,
  hitSlop,
  onLongPress,
  delayLongPress,
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleValue,
      useNativeDriver: useNativeDriverValue,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale, scaleValue]);

  const animateOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: useNativeDriverValue,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale]);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, disabled && { opacity: 0.5 }]}>
      <Pressable
        onPressIn={animateIn}
        onPressOut={animateOut}
        onPress={onPress}
        onLongPress={onLongPress}
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
