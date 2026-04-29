import { View, Switch, Platform } from "react-native";
import { router } from "expo-router";
import { useDarkMode } from "../utils/global";
import { BaseText } from "components/Base/BaseText";
import { MainButton } from "components/MainButton";
import { Root } from "components/Root";
import { ButtonText } from "components/ButtonText";
import * as Haptics from "expo-haptics";
import { clearCredentials } from "lib/stores/auth";

export default function Settings() {
	const hapticHandler = async () => {
		if (Platform.OS !== "web") {
			await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		}
	};

	const isDarkMode = useDarkMode((state) => state.isDarkMode);
	const isBoldFont = useDarkMode((state) => state.isBoldFont);
	const isHighContrast = useDarkMode((state) => state.isHighContrast);
	const isDyslexicFont = useDarkMode((state) => state.isDyslexicFont);

	const toggleDarkMode = useDarkMode((state) => state.toggleDarkMode);
	const toggleBoldFont = useDarkMode((state) => state.toggleBoldFont);
	const toggleHighContrast = useDarkMode((state) => state.toggleHighContrast);
	const toggleDyslexicFont = useDarkMode((state) => state.toggleDyslexicFont);

	const settings = [
		{
			title: "Dark Mode",
			value: isDarkMode,
			onPress: toggleDarkMode,
		},
		{
			title: "Bold Font",
			value: isBoldFont,
			onPress: toggleBoldFont,
		},
		{
			title: "High Contrast",
			value: isHighContrast,
			onPress: toggleHighContrast,
		},
		{
			title: "Dyslexic Font",
			value: isDyslexicFont,
			onPress: toggleDyslexicFont,
		},
	];

	return (
		<Root>
			<BaseText
				style={{
					fontSize: 40,
					fontWeight: "bold",
					marginBottom: 40,
					width: "100%",
				}}
			>
				Settings
			</BaseText>

			{settings.map((setting) => (
				<MainButton
					key={setting.title}
					onPress={async () => {
						await hapticHandler();
						setting.onPress();
					}}
					style={{
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "center",
						width: "100%",
						paddingVertical: 18,
						marginBottom: 10,
					}}
				>
					<BaseText style={{ fontSize: 20 }}>
						{setting.title}
					</BaseText>

					<Switch
						testID={`${setting.title.toLowerCase().replace(/\s+/g, "-")}-switch`}
						value={setting.value}
						onValueChange={
							Platform.OS === "ios" || Platform.OS === "android"
								? async () => {
										await hapticHandler();
										setting.onPress();
								  }
								: () => {}
						}
					/>
				</MainButton>
			))}

			<MainButton
				onPress={async () => {
					await hapticHandler();
					clearCredentials();
					router.replace("/");
				}}
				style={{ marginTop: 20, backgroundColor: "#ff5a5f" }}
			>
				<ButtonText>Log Out</ButtonText>
			</MainButton>

			<MainButton
				onPress={async () => {
					router.replace("/");
					if (Platform.OS !== "web") {
						await Haptics.impactAsync(
							Haptics.ImpactFeedbackStyle.Soft
						);
					}
				}}
				style={{ marginTop: 20 }}
			>
				<ButtonText>Go Back</ButtonText>
			</MainButton>
		</Root>
	);
}