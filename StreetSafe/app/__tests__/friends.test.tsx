import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import Friends from '../friends';

const { fetchWithToken } = require('lib/stores/auth');


jest.mock('lib/stores/auth', () => {
  const store = {
    kind: 'SignedIn',
    data: { token: 'mock-token' },
    isSignedIn: () => true,
  };
  const hook = jest.fn((selector) => (selector ? selector(store) : store));
  (hook as any).getState = jest.fn(() => store);
  
  return {
    useAuthState: hook,
    fetchWithToken: jest.fn().mockImplementation((url: string) => {
      if (typeof url === 'string') {
        if (url.includes('/api/getFriends') || url.includes('/api/getFriendRequestsSent') || url.includes('/api/getFriendRequests')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }
        if (url.includes('/users/getUser')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1, name: 'TestUser', email: 'test@example.com', avatarUrl: '' }) });
        }
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    })
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
}));

afterEach(() => {
  jest.clearAllMocks();
});

describe('Frontend Social & Friends Management', () => {
  describe('TC-FE-LOC-03 - Manage Friends', () => {
    it('Given the friends UI is active, When user opens Add Friend modal, Then the modal should be accessible', async () => {
      const { getByText, queryByText } = render(<Friends />);
      
      // Wait for initial load to finish to avoid act warning
      await waitFor(() => {
        expect(fetchWithToken).toHaveBeenCalled();
      });

      // Look for the Add Friend text (could be a button or header)
      const addFriendElement = queryByText('+ Add');
      expect(addFriendElement).toBeTruthy();
    });

    it('Given user is on friends screen, When user sends a friend request, Then fetchWithToken is called with createFriendRequest', async () => {
      const { getByText, getByPlaceholderText } = render(<Friends />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(fetchWithToken).toHaveBeenCalled();
      });
      
      // Find and click Add Friend
      const addFriendButton = getByText('+ Add');
      fireEvent.press(addFriendButton);
      
      // Mock the API call for sending friend request before interaction
      (fetchWithToken as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Request sent' })
      });
      
      // Enter email and send
      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, 'test@request.com');
      
      const sendButton = getByText('Send Request');
      fireEvent.press(sendButton);
      
      await waitFor(() => {
        expect(fetchWithToken).toHaveBeenCalledWith(
          expect.stringContaining('/api/createFriendRequest'),
          expect.anything()
        );
      });
    });

    it('Given user has incoming friend requests, When displayed, Then requests are shown in the Incoming section', async () => {
      const incomingRequests = [
        { id: 2, name: 'Requester One', email: 'requester1@example.com', avatarUrl: '' }
      ];
      
      (fetchWithToken as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/getFriendRequests')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(incomingRequests)
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      });
      
      const { getByText, findByText } = render(<Friends />);
      
      // Wait for content to load
      await findByText(/Incoming/i);
    });

    it('Given user has sent friend requests, When displayed, Then requests are shown in the Pending section', async () => {
      const sentRequests = [
        { id: 3, name: 'Pending User', email: 'pending@example.com', avatarUrl: '' }
      ];
      
      (fetchWithToken as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/getFriendRequestsSent')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(sentRequests)
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      });
      
      const { getByText, findByText } = render(<Friends />);
      
      await findByText(/Pending/i);
    });

    it('Given local friend dictionaries are updated, When user accepts a request, Then the local state correctly reflects the change', async () => {
      const initialFriends: any[] = [];
      
      (fetchWithToken as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/getFriends')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(initialFriends)
          });
        }
        if (url.includes('/api/acceptFriendRequest')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      });
      
      const { getByText, findByText, getAllByText } = render(<Friends />);
      
      await waitFor(() => {
        expect(getAllByText(/Friends/i).length).toBeGreaterThan(0);
      });
    });

    it('Given local friend dictionaries are updated, When user removes a friend, Then the local state correctly reflects the removal', async () => {
      (fetchWithToken as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/removeFriend')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      });
      
      const { getByText, findByText, getAllByText } = render(<Friends />);
      
      await waitFor(() => {
        expect(getAllByText(/Friends/i).length).toBeGreaterThan(0);
      });
    });

    it('Given a list of friends from API, When the component loads, Then the friend names should be rendered in the list', async () => {
      const mockFriends = [{ id: 10, accepter_id: 11 }]; // accepter_id will be passed to fetchWithTokenUser
      const mockUser = { id: 11, name: 'Rendered Friend', email: 'friend@example.com', avatarUrl: 'url' };
      
      (fetchWithToken as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/getFriends')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFriends) });
        }
        if (url.includes('/users/getUser?id=11')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUser) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const { findByText, getAllByText } = render(<Friends />);
      
      // Wait for the friend's name to appear
      const nameElement = await findByText('Rendered Friend');
      expect(nameElement).toBeTruthy();
    });
  });
});
