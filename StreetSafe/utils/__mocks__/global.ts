const mockThemeStore = {
  isDarkMode: false,
  isBoldFont: false,
  isHighContrast: false,
  isDyslexicFont: false,
  toggleDarkMode: jest.fn(),
  toggleBoldFont: jest.fn(),
  toggleHighContrast: jest.fn(),
  toggleDyslexicFont: jest.fn(),
};

const useDarkMode = jest.fn((selector) => {
  if (selector) return selector(mockThemeStore);
  return mockThemeStore;
});

(useDarkMode as any).getState = jest.fn(() => mockThemeStore);
(useDarkMode as any).setState = jest.fn((updates: any) => Object.assign(mockThemeStore, updates));

export { useDarkMode };
