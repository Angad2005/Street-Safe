import React from "react";
import { StyleSheet } from "react-native";
import { BaseButton, ButtonProps } from "./Base/BaseButton";
import { NotPressable } from "./NotPressable";
import { MainButton } from "./MainButton";


export const SquareButton: React.FC<ButtonProps> = ({ children, style, ...rest }) => (
    <MainButton style={[styles.base, style]} {...rest}>
      {children}
    </MainButton>
);

const styles = StyleSheet.create({
base: {
  paddingHorizontal: 20,
  justifyContent: "center",
  alignSelf: "flex-start",
  width: "auto",
  aspectRatio: 1
},
});