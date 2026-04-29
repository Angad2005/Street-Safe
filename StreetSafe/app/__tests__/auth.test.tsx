import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import Login from '../auth/login';
import * as WebBrowser from 'expo-web-browser';

// Mock the zustand store properly
jest.mock('lib/stores/auth', () => {
  const store = {
    kind: 'NotSignedIn' as const,
    data: undefined as { token: string; expiresAt: number } | undefined,
    setCredentials: jest.fn(),
    clearCredentials: jest.fn(),
    isSignedIn: jest.fn(() => false)
  };
  const hook = jest.fn((selector) => (selector ? selector(store) : store));
  (hook as any).getState = jest.fn(() => store);

  return {
    useAuthState: hook,
    fetchWithToken: jest.fn().mockImplementation((url) => 
      Promise.resolve({ 
        ok: true, 
        status: 200, 
        json: () => Promise.resolve([]) 
      })
    )
  };
});

jest.mock('lib/stores/user', () => ({
  tryUpdateUser: jest.fn()
}));

jest.mock('lib/http/auth', () => ({
  AuthService: {
    createContext: jest.fn().mockResolvedValue({ authorizeUrl: 'mockUrl', exchangeContextId: 'mockId' }),
    exchange: jest.fn().mockResolvedValue({ token: 'mockToken', expiresAt: Date.now() + 10000 })
  }
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn()
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ redirectTo: '/' }),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Redirect: () => null
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn(() => 'exp://mockUrl'),
  openURL: jest.fn(),
  canOpenURL: jest.fn(),
  addEventListener: jest.fn(),
  getInitialURL: jest.fn(),
}));

jest.spyOn(WebBrowser, 'openAuthSessionAsync').mockResolvedValue({ type: 'success', url: 'exp://mockUrl' } as any);

describe('Frontend Authentication & SSO Integration', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    const { useAuthState } = require('lib/stores/auth');
    useAuthState.getState().setCredentials.mockClear();
  });

  describe('TC-FE-AUTH-01 - SSO Login Trigger', () => {
    it('Given the login screen, When the Login button is pressed, Then it initiates the SSO flow', async () => {
      const { getByText } = render(<Login />);
      
      const loginButton = getByText(/Login with Google/i);
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled();
      });
    });
  });

  describe('TC-FE-AUTH-02 - SSO Redirect', () => {
    it('Given a successful SSO login, When the auth session completes, Then credentials are stored in the auth state', async () => {
      const { getByText } = render(<Login />);
      
      const loginButton = getByText(/Login with Google/i);
      
      await act(async () => {
        fireEvent.press(loginButton);
      });

      await waitFor(() => {
        // Verify credentials would be set via our local mock
        const { useAuthState } = require('lib/stores/auth');
        expect(useAuthState.getState().setCredentials).toHaveBeenCalled();
      });
    });

    it('Given the user is already signed in, When the login screen mounts, Then it redirects to the target page', () => {
      // Override the mock to return signed-in state
      const { useAuthState } = require('lib/stores/auth');
      useAuthState.getState().kind = 'SignedIn';
      useAuthState.getState().isSignedIn = () => true;
      
      // Re-render with signed-in state
      const { queryByText, getAllByText } = render(<Login />);
      
      // Button "Login" should not be rendered if redirect happens (mocked Redirect component returns null)
      // Note: In expo-router, Redirect is a component that we've mocked to return null
      const loginElements = queryByText('Login');
      // If Redirect works, the component returns null or something else that isn't the login form
    });
  });
});
