// This file is a fallback for using MaterialIcons on Android and web.

import React from "react";
import { SymbolWeight } from "expo-symbols";
import {
  OpaqueColorValue,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

/**
 * An icon component that uses native SFSymbols on iOS, and MaterialIcons on Android and web. This ensures a consistent look across platforms, and optimal resource usage.
 *
 * Icon `name`s are based on SFSymbols and require manual mapping to MaterialIcons.
 */
export function IconSymbol({
  ios_icon_name = undefined,
  android_material_icon_name,
  size = 24,
  color,
  style,
  // Forward only the event handlers we inject from EditableElement_ (and a few common RN/web props).
  onPress,
  onClick,
  onMouseOver,
  onMouseLeave,
  testID,
  accessibilityLabel,
}: {
  ios_icon_name?: string | undefined;
  android_material_icon_name: keyof typeof MaterialIcons.glyphMap;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
  onPress?: any;
  onClick?: any;
  onMouseOver?: any;
  onMouseLeave?: any;
  testID?: any;
  accessibilityLabel?: any;
}) {
  const extraProps: Record<string, any> = {};
  if (onPress !== undefined) extraProps.onPress = onPress;
  if (onClick !== undefined) extraProps.onClick = onClick;
  if (onMouseOver !== undefined) extraProps.onMouseOver = onMouseOver;
  if (onMouseLeave !== undefined) extraProps.onMouseLeave = onMouseLeave;
  if (testID !== undefined) extraProps.testID = testID;
  if (accessibilityLabel !== undefined) extraProps.accessibilityLabel = accessibilityLabel;

  return (
    <MaterialIcons
      color={color}
      size={size}
      name={android_material_icon_name}
      style={style as StyleProp<TextStyle>}
      {...extraProps}
    />
  );
}
