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

  // Filter out internal props (e.g. __s, __sourceLocation from Reanimated/dev tools) that must not reach DOM elements on web
  const safeProps = Platform.OS === 'web'
    ? Object.fromEntries(Object.entries(props).filter(([key]) => !key.startsWith('__') && !key.startsWith('data-')))
    : props;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, disabled && { opacity: 0.5 }]}>
      <Pressable
        onPressIn={animateIn}
        onPressOut={animateOut}
        onPress={onPress}
        disabled={disabled}
        style={style}
        {...safeProps}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
