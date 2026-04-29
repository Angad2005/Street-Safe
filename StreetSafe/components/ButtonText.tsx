import { Text, TextProps, StyleSheet } from 'react-native';
import { BaseText } from './Base/BaseText';

export const ButtonText: React.FC<TextProps> = ({ style, children, ...rest }) => (
  <BaseText style={[styles.base, style]} {...rest}>
    {children}
  </BaseText>
);

const styles = StyleSheet.create({
    base: {
        fontSize: 18,
        fontWeight: "600"
    }
});