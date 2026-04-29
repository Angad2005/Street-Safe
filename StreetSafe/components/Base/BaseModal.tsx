import { StyleSheet, Modal, ModalProps, View, Pressable } from 'react-native';
import { useTheme } from 'utils/useTheme';

interface BaseModalProps extends ModalProps {
    OnClickOutside?: () => void
}

export const BaseModal: React.FC<BaseModalProps> = ({ style, children, OnClickOutside, ...rest }) => {
  const theme = useTheme();

  return (
    <Modal {...rest} transparent>
    <Pressable style={s.modalOverlay} onPress={OnClickOutside}>
        <Pressable onPress={() => {}} style={{cursor: "auto"}}>
            <View style={[s.modalBox, { backgroundColor: theme.modalColor }, style]}>
                <View>
                    {children}
                </View>
            </View>
        </Pressable>
    </Pressable>
    </Modal>
  );
};

const s = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
    },
    modalBox: {
        padding: 20,
        borderRadius: 20,
        justifyContent: "flex-start",
        minWidth: 300,
    },
});