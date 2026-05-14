import { Pressable, Animated, PressableProps, ViewStyle, StyleProp, Platform } from 'react-native';
import { useRef, useCallback } from 'react';

const useNativeDriver = Platform.OS !== 'web';

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
  ...props
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleValue,
      useNativeDriver,
      speed: 50,
      bounciness: 4,
    }).start();
  }, []);

  const animateOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver,
      speed: 50,
      bounciness: 4,
    }).start();
  }, []);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, disabled && { opacity: 0.5 }]}>
      <Pressable
        onPressIn={animateIn}
        onPressOut={animateOut}
        onPress={onPress}
        disabled={disabled}
        style={style}
        {...props}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
