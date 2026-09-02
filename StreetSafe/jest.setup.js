global.self = global;


// Mock Expo modules
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: "granted" })
  ),
  watchPositionAsync: jest.fn((options, callback) => {
    // Optionally trigger the callback once for some tests
    // callback({ coords: { latitude: 52.452, longitude: -1.930 } });
    return Promise.resolve({
      remove: jest.fn(),
    });
  }),
  Accuracy: {
    Highest: 4,
  },
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Heavy: "heavy",
    Medium: "medium",
    Light: "light",
  },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
  },
}));

jest.mock("expo-modules-core", () => ({
  EventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
  NativeModulesProxy: {},
  requireNativeModule: jest.fn(),
  requireOptionalNativeModule: jest.fn(),
}));

jest.mock("expo-linking", () => ({
  createURL: jest.fn(),
  openURL: jest.fn(),
  canOpenURL: jest.fn(),
  addEventListener: jest.fn(),
  getInitialURL: jest.fn(),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: jest.fn(() => null),
  AntDesign: jest.fn(() => null),
  FontAwesome: jest.fn(() => null),
  MaterialIcons: jest.fn(() => null),
}));


jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(),
  openAuthSessionAsync: jest.fn(),
  maybeCompleteAuthSession: jest.fn(),
  warmUpAsync: jest.fn(),
  coolDownAsync: jest.fn(),
}));

// Mock react-native-webview
jest.mock("react-native-webview", () => ({
  WebView: (props) => require("react").createElement("WebView", { ...props, testID: "WebView" }),
}));


// Mock LeafletMap since it contains an iframe/webview
jest.mock("components/LeafletMap", () => ({
  __esModule: true,
  default: (props) => require("react").createElement("LeafletMap", { ...props, testID: "LeafletMap" }),
}));

// Mock utils/config
jest.mock("utils/config", () => ({
  __esModule: true,
  BACKEND_URL: "http://localhost:8080",
}));

// Mock utils/global (Theme/Accessibility Store)
console.log("Mocking utils/global...");
jest.mock("./utils/global", () => {
  console.log("Factory for utils/global running");
  const store = {
    isDarkMode: false,
    isBoldFont: false,
    isHighContrast: false,
    isDyslexicFont: false,
    toggleDarkMode: jest.fn(),
    toggleBoldFont: jest.fn(),
    toggleHighContrast: jest.fn(),
    toggleDyslexicFont: jest.fn(),
  };
  const hook = jest.fn((selector) => (selector ? selector(store) : store));
  hook.getState = jest.fn(() => store);
  hook.setState = jest.fn((updates) => Object.assign(store, updates));
  return { __esModule: true, useDarkMode: hook };
});

// Mock lib/stores/auth (Auth Store)
console.log("Mocking lib/stores/auth...");
jest.mock("./lib/stores/auth", () => {
  console.log("Factory for lib/stores/auth running");
  const store = {
    kind: "SignedIn",
    data: { token: "mock-token", expiresAt: Date.now() + 3600000 },
    setCredentials: jest.fn(),
    clearCredentials: jest.fn(),
    isSignedIn: () => true,
  };
  const hook = jest.fn((selector) => (selector ? selector(store) : store));
  hook.getState = jest.fn(() => store);
  return {
    __esModule: true,
    useAuthState: hook,
    getToken: jest.fn(() => "mock-token"),
    isAuthed: jest.fn(() => true),
    clearCredentials: jest.fn(),
    fetchWithToken: jest.fn().mockImplementation((url) => {
      let data = [];
      if (typeof url === 'string' && url.includes('/api/locations')) data = {};
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
      });
    }),
  };
});

// Mock global fetch
global.fetch = jest.fn().mockImplementation((url) => {
  let data = [];
  if (typeof url === 'string' && url.includes('/api/route')) data = { steps: [] };
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
});

// Silence console.warn/error if logs are too noisy
// console.warn = jest.fn();
// console.error = jest.fn();

// Silence console.warn/error in tests if needed
// console.warn = jest.fn();
// console.error = jest.fn();
