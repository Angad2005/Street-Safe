import React from 'react';
import { TextInput, TextInputProps, StyleSheet } from 'react-native';
import { useTheme } from 'utils/useTheme';

export const BaseInput = React.forwardRef<TextInput, TextInputProps>(({ style, ...rest }, ref) => {
  const theme = useTheme();
  
  return (
    <TextInput ref={ref} {...rest} style={[s.base, { color: theme.baseTextColor, fontFamily: theme.baseTextFontFamily, backgroundColor: theme.inputBackgroundColor }, style]}/>
)});

const s = StyleSheet.create({
    base: {
        fontSize: 18,
        fontWeight: "600",
        height: 40,
        
        marginBottom: 16,
        borderWidth: 1,
        padding: 10,
        borderRadius: 10,
        backgroundColor: "#334155",
        color: "white",
    }
});