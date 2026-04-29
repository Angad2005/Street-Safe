import React from "react";
import { StyleSheet } from "react-native";
import { BaseButton, ButtonProps } from "./Base/BaseButton";
import { NotPressable } from "./NotPressable";


export const MainButton: React.FC<ButtonProps> = ({ children, style, ...rest }) => (
    <BaseButton style={[styles.base, style]} {...rest}>
      <NotPressable>{children}</NotPressable>
    </BaseButton>
);

const styles = StyleSheet.create({
  base: {
    width: 320,
    paddingVertical: 20,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});