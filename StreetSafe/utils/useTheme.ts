import { useDarkMode } from "./global";

export const useTheme = () => {
	const isDarkMode = useDarkMode((s) => s.isDarkMode);
	const isBoldFont = useDarkMode((s) => s.isBoldFont);
	const isHighContrast = useDarkMode((s) => s.isHighContrast);
	const isDyslexicFont = useDarkMode((s) => s.isDyslexicFont);

	const highContrast = {
		baseTextColor: "#ff0",
		baseTextFontFamily: "Rajdhani_700Bold",
		baseButtonBackgroundColor: "#211f1f",
		baseButtonBorderWidth: 2,
		rootBackgroundColor: "#000",
		containerColor: "#211f1f",
		modalColor: "#2e2b34",
		inputBackgroundColor: "#5e5e61"
	};

	const darkMode = {
		baseTextColor: "#ddd",
		baseTextFontFamily: "Rajdhani_600SemiBold",
		baseButtonBackgroundColor: "#1a1a1a",
		baseButtonBorderWidth: 1,
		rootBackgroundColor: "#0a0a0a",
		containerColor: "#0a0a0a",
		modalColor: "#0a0a0a",
		inputBackgroundColor: "#0a0a0a"
	}
		
	const lightMode = {
		baseTextColor: "#fff",
		baseTextFontFamily: "Rajdhani_600SemiBold",
		baseButtonBackgroundColor: "#1F4E79",
		baseButtonBorderWidth: 1,
		rootBackgroundColor: "#0E2A47",
		containerColor: "#1f5c9e",
		modalColor: "#1f5c9e",
		inputBackgroundColor: "#1F4E79"
	};

	const theme = isHighContrast ? highContrast : isDarkMode ? darkMode : lightMode;
	if (isBoldFont) theme.baseTextFontFamily = "Rajdhani_700Bold";

	if (isDyslexicFont) theme.baseTextFontFamily = "OpenDyslexic";

	return theme;
};