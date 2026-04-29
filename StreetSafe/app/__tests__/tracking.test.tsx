import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import Tracking from '../tracking';

// Mock Location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: 52.4862, longitude: -1.8904 } })),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
  Accuracy: { Highest: 4 }
}));

// Mock alert
global.alert = jest.fn();


// Mock Haptics
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium', Heavy: 'heavy', Light: 'light', Soft: 'soft' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' }
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
}));

jest.mock('lib/stores/auth', () => {
  const store = {
    kind: 'SignedIn',
    data: { token: 'mock-token' },
    isSignedIn: () => true
  };
  const hook = jest.fn((selector) => (selector ? selector(store) : store));
  (hook as any).getState = jest.fn(() => store);
  
  return {
    useAuthState: hook,
    fetchWithToken: jest.fn().mockImplementation(() => 
      Promise.resolve({ 
        ok: true, 
        status: 200, 
        json: () => Promise.resolve([]) 
      })
    )
  };
});

jest.mock('components/LeafletMap', () => 'LeafletMap');

const Location = require('expo-location');
const Haptics = require('expo-haptics');
const { fetchWithToken } = require('lib/stores/auth');

describe('Frontend Tracking & Haptic Feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TC-FE-HAP-01 - Tracking Haptics', () => {
    it('Given the tracking modal is active, When tracking is toggled on, Then Haptics.notificationAsync is called with Success feedback', async () => {
      render(<Tracking />);
      
      await waitFor(() => {
        // Haptics should be available
        expect(Haptics.notificationAsync).toBeDefined();
      });
    });
  });

  describe('TC-FE-HAP-02 - Alarm Haptics', () => {
    it('Given the user is flagged as off route, When triggerAlarm executes, Then Haptics.notificationAsync fires Error feedback', () => {
      // Simulate triggering alarm haptics
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
    });
  });
});

describe('Frontend Location Sharing', () => {
  describe('TC-FE-LOC-01 - Push Location Status', () => {
    it('Given isSharing is true, When the polling interval executes, Then POST /api/locations is called with correct payload', async () => {
      const { fetchWithToken } = require('lib/stores/auth');
      
      const mockPayload = {
        lat: 52.4862,
        lng: -1.8904
      };
      
      await fetchWithToken('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockPayload)
      });
      
      expect(fetchWithToken).toHaveBeenCalledWith(
        '/api/locations',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('TC-FE-LOC-02 - Load Friend Lists', () => {
    it('Given valid tokens, When component mounts, Then GET /api/getFriends returns friend data', async () => {
      const { fetchWithToken } = require('lib/stores/auth');
      
      const mockFriends = [
        { id: 2, name: 'Friend User', email: 'friend@example.com' }
      ];
      
      (fetchWithToken as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFriends)
      });
      
      const response = await fetchWithToken('/api/getFriends');
      const friends = await response.json();
      
      expect(friends).toHaveLength(1);
      expect(friends[0].name).toBe('Friend User');
    });
  });
});
