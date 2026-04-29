import { StyleSheet, View, ViewProps } from 'react-native';
import { useTheme } from 'utils/useTheme';

export const Root: React.FC<ViewProps> = ({ style, children, ...rest }) => {
    
    const theme = useTheme();

    return (
        <View style={[{ backgroundColor: theme.rootBackgroundColor }, styles.base, style]} {...rest}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    base: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
        paddingVertical: 40
    }
});