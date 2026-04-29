import { StyleSheet, View, ViewProps } from 'react-native';
import { useTheme } from 'utils/useTheme';

export const Container: React.FC<ViewProps> = ({ style, children, ...rest }) => {
    
    const theme = useTheme();

    return (
        <View style={[{ backgroundColor: theme.containerColor }, styles.base, style]} {...rest}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    base: {
        padding: 20,
        borderRadius: 20,
    }
});