import { Text, TextProps, TextStyle } from 'react-native';
import { useTheme } from 'utils/useTheme';

export const BaseText: React.FC<TextProps> = ({ style, children, ...rest }) => {
  const theme = useTheme();
  
  return (
  <Text style={[{ color: theme.baseTextColor, fontFamily: theme.baseTextFontFamily }, style]} {...rest}>
    {children}
  </Text>
)};