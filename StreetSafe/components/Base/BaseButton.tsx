import React, { useState } from "react";
import { Pressable, PressableProps, Text, StyleSheet, ViewStyle, StyleProp, Platform } from "react-native";
import { useTheme } from "utils/useTheme";

export type ButtonProps = PressableProps & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

// Amount is [0, 1]
function darkenHex (hex: string, amount: number) {
    hex = hex.replace("#", "");

    if (hex.length === 3) hex = Array.from(hex).map(ch => ch + ch).join("");

    // Convert hex into decimal
    const num = parseInt(hex, 16);

    // Get each colour value
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff; 
    let b = (num & 0xff);

    r = Math.max(0, Math.round(r * amount));    
    g = Math.max(0, Math.round(g * amount));
    b = Math.max(0, Math.round(b * amount));
    const toString = (value: number) => value.toString(16).padStart(2, "0");

    return `#${toString(r)}${toString(g)}${toString(b)}`;
 }

export const BaseButton: React.FC<ButtonProps> = ({ style, children, ...rest }) => {
  const theme = useTheme();

  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      {...rest}
      style={Platform.OS === "ios" || Platform.OS === "android" ? [
        styles.base,
        {
          backgroundColor: pressed
            ? darkenHex(theme.baseButtonBackgroundColor, 0.8)
            : theme.baseButtonBackgroundColor,
          borderWidth: theme.baseButtonBorderWidth,
        },
        style,
      ] :
      ({ pressed, hovered }) =>[
        styles.base,
        { backgroundColor: pressed
          ? darkenHex(theme.baseButtonBackgroundColor, 0.8)
          : hovered ? darkenHex(theme.baseButtonBackgroundColor, 0.9)
          : theme.baseButtonBackgroundColor, borderWidth: theme.baseButtonBorderWidth
        }, style
       ]
    }
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});