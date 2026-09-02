import { useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import { BaseText } from "components/Base/BaseText";
import { View } from "react-native";

WebBrowser.maybeCompleteAuthSession();

export default function Complete() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <BaseText>Done!</BaseText>
    </View>
  );
}