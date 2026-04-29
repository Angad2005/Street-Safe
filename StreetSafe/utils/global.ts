import { create } from "zustand";

export interface ThemeState {
    isDarkMode: boolean;
    isBoldFont: boolean;
    isHighContrast: boolean;
    isDyslexicFont: boolean; // 

    toggleDarkMode: () => void;
    toggleBoldFont: () => void;
    toggleHighContrast: () => void;
    toggleDyslexicFont: () => void; 
}

export const useDarkMode = create<ThemeState>((set) => ({
    isDarkMode: false,
    isBoldFont: false,
    isHighContrast: false,

    isDyslexicFont: false, 

    toggleDarkMode: () =>
        set((state) => ({
            isDarkMode: !state.isDarkMode,
        })),

    toggleBoldFont: () =>
        set((state) => ({
            isBoldFont: !state.isBoldFont,
        })),

    toggleHighContrast: () =>
        set((state) => ({
            isHighContrast: !state.isHighContrast,
        })),

    toggleDyslexicFont: () => 
        set((state) => ({
            isDyslexicFont: !state.isDyslexicFont,
        })),
}));