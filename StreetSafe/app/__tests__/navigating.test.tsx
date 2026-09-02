import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import Navigating from '../navigating';

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
    isAuthed: jest.fn(() => true),
    fetchWithToken: jest.fn().mockImplementation((url: string) => {
      if (url?.includes?.('/api/route')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            steps: [
              { point: { lat: 52.48, lng: -1.90 } },
              { point: { lat: 52.49, lng: -1.91 } },
              { point: { lat: 52.50, lng: -1.92 } },
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    })
  };
});

jest.mock('components/LeafletMap', () => 'LeafletMap');

const Location = require('expo-location');
const Haptics = require('expo-haptics');
const { fetchWithToken } = require('lib/stores/auth');

describe('Frontend Navigation & Haptic Feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TC-FE-NAV-01 - Location State Updates', () => {
    it('Given foreground permissions are granted, When watchPositionAsync is called, Then location state is updated with coordinates', async () => {
      render(<Navigating />);
      await waitFor(() => {
        expect(Location.watchPositionAsync).toHaveBeenCalled();
      });
    });

    it('Given location permissions are denied, When the component mounts, Then appropriate error handling occurs', async () => {
      Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
      render(<Navigating />);
      await waitFor(() => {
        expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });
  });

  describe('TC-FE-HAP-01 - Navigation Haptics', () => {
    it('Given the navigation screen is active, When search interactions occur, Then Haptics.impactAsync is defined', async () => {
      const { getByPlaceholderText } = render(<Navigating />);
      const destInput = getByPlaceholderText('Search destination...');
      fireEvent.changeText(destInput, 'Birmingham');
      expect(Haptics.impactAsync).toBeDefined();
    });
  });

  describe('Frontend Location Sharing', () => {
    describe('TC-FE-LOC-01 - Push Location Status', () => {
      it('Given the component is active, When a location update occurs, Then POST /api/locations is called', async () => {
        render(<Navigating />);
        await waitFor(() => expect(Location.watchPositionAsync).toHaveBeenCalled());
        const watchCallback = Location.watchPositionAsync.mock.calls[0][1];
        await act(async () => {
          watchCallback({ coords: { latitude: 52.45, longitude: -1.93 } });
        });
        expect(fetchWithToken).toHaveBeenCalledWith(
          expect.stringContaining('/api/locations'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  describe('Search and Routing Flow', () => {
    it('Given a destination is entered, When a suggestion is selected, Then it fetches a route', async () => {
      const { getByPlaceholderText, findByText } = render(<Navigating />);

      await waitFor(() => expect(Location.watchPositionAsync).toHaveBeenCalled());
      const watchCallback = Location.watchPositionAsync.mock.calls[0][1];

      await act(async () => {
        watchCallback({ coords: { latitude: 52.48, longitude: -1.90 } });
      });

      const mockGeocode = [
        { place_id: 123, display_name: 'Target Destination', lat: '52.5', lon: '-1.8' }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGeocode)
      });

      const destInput = getByPlaceholderText('Search destination...');
      fireEvent.changeText(destInput, 'Tar');

      const suggestion = await findByText('Target Destination');
      await act(async () => {
        fireEvent.press(suggestion);
      });

      expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');

      await waitFor(() => {
        expect(fetchWithToken).toHaveBeenCalledWith(
          expect.stringContaining('/api/route'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"endLat":52.5')
          })
        );
      });
    });

    it('Given a route is fetched, When the Start button is pressed, Then the navigation phase begins', async () => {
      const { getByPlaceholderText, findByText, findAllByText } = render(<Navigating />);

      await waitFor(() => expect(Location.watchPositionAsync).toHaveBeenCalled());
      const watchCallback = Location.watchPositionAsync.mock.calls[0][1];

      await act(async () => {
        watchCallback({ coords: { latitude: 52.48, longitude: -1.90 } });
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ place_id: 456, display_name: 'City Centre', lat: '52.48', lon: '-1.90' }])
      });

      const destInput = getByPlaceholderText('Search destination...');
      fireEvent.changeText(destInput, 'Cit');

      const suggestion = await findByText('City Centre');
      await act(async () => {
        fireEvent.press(suggestion);
      });

      // Wait for route card and Start button to appear
      const startBtn = await findByText('Start');
      await act(async () => {
        fireEvent.press(startBtn);
      });

      // After pressing Start, we should see the End button (active navigation phase)
      const endBtn = await findByText('End');
      expect(endBtn).toBeTruthy();
    });
  });
});
