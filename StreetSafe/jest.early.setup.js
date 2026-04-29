const mockNativeModules = require('react-native/Libraries/BatchedBridge/NativeModules');
if (!mockNativeModules.UIManager) {
  mockNativeModules.UIManager = {};
}

global.window = global;
global.window.navigator = {};
global.self = global;
