const mockAuthStore = {
  kind: "SignedIn",
  data: { token: "mock-token", expiresAt: Date.now() + 3600000 },
  setCredentials: jest.fn(),
  clearCredentials: jest.fn(),
  isSignedIn: () => true,
};

const useAuthState = jest.fn((selector) => {
  if (selector) return selector(mockAuthStore);
  return mockAuthStore;
});

(useAuthState as any).getState = jest.fn(() => mockAuthStore);

const getToken = jest.fn(() => "mock-token");

const fetchWithToken = jest.fn().mockImplementation((url: string) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve([]),
  })
);

const clearCredentials = jest.fn();

export { useAuthState, getToken, fetchWithToken, clearCredentials };
