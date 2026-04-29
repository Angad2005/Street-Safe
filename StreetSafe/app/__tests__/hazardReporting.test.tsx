import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react-native';
import HazardReporting from '../hazardReporting';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('components/LeafletMap', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: function LeafletMap(props: any) {
      return (
        <View
          testID="mock-map"
          // Expose onMapClick so tests can simulate a map tap
          onTouchEnd={() => props.onMapClick?.(52.452, -1.93)}
          {...props}
        />
      );
    },
  };
});

jest.mock('utils/config', () => ({
  BACKEND_URL: 'http://localhost:3000',
}));

jest.mock('utils/global', () => ({
  useDarkMode: (selector: (s: any) => any) =>
    selector({ isDarkMode: false, isHighContrast: false }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
}));

// expo-haptics is already mocked in jest.setup.js — no need to re-mock here

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Standard mock for the initial GET /api/hazards on mount */
const mockEmptyLoad = () =>
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => [],
  });

const mockHazardLoad = (hazards = SEED_HAZARDS) =>
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => hazards,
  });

const mockSubmitSuccess = () =>
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ message: 'Hazard added!', id: 99 }),
  });

const SEED_HAZARDS = [
  { id: 1, Category: 'theft',      Latitude: '52.450', Longitude: '-1.920', timestamp: '2026-01-01T10:00:00Z' },
  { id: 2, Category: 'harassment', Latitude: '52.460', Longitude: '-1.910', timestamp: '2026-01-02T11:00:00Z' },
  { id: 3, Category: 'lighting',   Latitude: '52.470', Longitude: '-1.900', timestamp: '2026-01-03T12:00:00Z' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Setup / Teardown
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-FE-HAZ-01  Rendering & initial load
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-FE-HAZ-01 – Initial render & hazard loading', () => {
  it('renders the map without crashing', async () => {
    mockEmptyLoad();

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeTruthy();
    });
  });

  it('calls GET /api/hazards on mount', async () => {
    mockEmptyLoad();

    render(<HazardReporting />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/hazards')
      );
    });
  });

  it('passes formatted markers to the map after load', async () => {
    mockHazardLoad();

    render(<HazardReporting />);

    await waitFor(() => {
      const map = screen.getByTestId('mock-map');
      expect(map.props.markers).toHaveLength(SEED_HAZARDS.length);
    });
  });

  it('maps theft category to orange color (#F39C12)', async () => {
    mockHazardLoad([
      { id: 1, Category: 'theft', Latitude: '52.450', Longitude: '-1.920', timestamp: '' },
    ]);

    render(<HazardReporting />);

    await waitFor(() => {
      const map = screen.getByTestId('mock-map');
      expect(map.props.markers[0].color).toBe('#F39C12');
    });
  });

  it('maps harassment category to red color (#E74C3C)', async () => {
    mockHazardLoad([
      { id: 2, Category: 'harassment', Latitude: '52.460', Longitude: '-1.910', timestamp: '' },
    ]);

    render(<HazardReporting />);

    await waitFor(() => {
      const map = screen.getByTestId('mock-map');
      expect(map.props.markers[0].color).toBe('#E74C3C');
    });
  });

  it('falls back to grey (#7F8C8D) for unknown category', async () => {
    mockHazardLoad([
      { id: 3, Category: 'unknown_type', Latitude: '52.470', Longitude: '-1.900', timestamp: '' },
    ]);

    render(<HazardReporting />);

    await waitFor(() => {
      const map = screen.getByTestId('mock-map');
      expect(map.props.markers[0].color).toBe('#7F8C8D');
    });
  });

  it('parses lat/lng strings into floats for the marker', async () => {
    mockHazardLoad([
      { id: 1, Category: 'theft', Latitude: '52.450', Longitude: '-1.920', timestamp: '' },
    ]);

    render(<HazardReporting />);

    await waitFor(() => {
      const marker = screen.getByTestId('mock-map').props.markers[0];
      expect(typeof marker.lat).toBe('number');
      expect(typeof marker.lng).toBe('number');
      expect(marker.lat).toBeCloseTo(52.45);
      expect(marker.lng).toBeCloseTo(-1.92);
    });
  });

  it('handles an empty hazards array without crashing', async () => {
    mockEmptyLoad();

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-map').props.markers).toHaveLength(0);
    });
  });

  it('handles a fetch error gracefully and leaves markers empty', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<HazardReporting />);

    await waitFor(() => {
      // Component should not crash; markers stay at initial []
      expect(screen.getByTestId('mock-map').props.markers).toHaveLength(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Modal behaviour — opening via map click
// ─────────────────────────────────────────────────────────────────────────────

describe('Report modal – open & close', () => {
  it('modal is hidden on initial render', async () => {
    mockEmptyLoad();

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.queryByText('Report Hazard')).toBeNull();
    });
  });

  it('modal opens when the map is tapped', async () => {
    mockEmptyLoad();

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeTruthy();
    });

    await act(async () => {
      fireEvent(screen.getByTestId('mock-map'), 'touchEnd');
    });

    expect(screen.getByText('Report Hazard')).toBeTruthy();
  });

  it('modal closes when Cancel is pressed', async () => {
    mockEmptyLoad();

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeTruthy();
    });

    // Open modal
    await act(async () => {
      fireEvent(screen.getByTestId('mock-map'), 'touchEnd');
    });

    // Close modal
    await act(async () => {
      fireEvent.press(screen.getByText('Cancel'));
    });

    expect(screen.queryByText('Report Hazard')).toBeNull();
  });

  it('all four category buttons are visible in the modal', async () => {
    mockEmptyLoad();

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeTruthy();
    });

    await act(async () => {
      fireEvent(screen.getByTestId('mock-map'), 'touchEnd');
    });

    expect(screen.getByText('HARASSMENT')).toBeTruthy();
    expect(screen.getByText('THEFT')).toBeTruthy();
    expect(screen.getByText('LIGHTING')).toBeTruthy();
    expect(screen.getByText('POLICE')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Category selection
// ─────────────────────────────────────────────────────────────────────────────

describe('Category selection', () => {
  it('selecting a category button does not crash', async () => {
    mockEmptyLoad();

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeTruthy();
    });

    await act(async () => {
      fireEvent(screen.getByTestId('mock-map'), 'touchEnd');
    });

    await act(async () => {
      fireEvent.press(screen.getByText('THEFT'));
    });

    // If we got here without throwing, the test passes
    expect(screen.getByText('THEFT')).toBeTruthy();
  });

  it('selecting each category in turn does not crash', async () => {
    mockEmptyLoad();

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeTruthy();
    });

    await act(async () => {
      fireEvent(screen.getByTestId('mock-map'), 'touchEnd');
    });

    for (const cat of ['HARASSMENT', 'THEFT', 'LIGHTING', 'POLICE']) {
      await act(async () => {
        fireEvent.press(screen.getByText(cat));
      });
    }

    expect(screen.getByText('POLICE')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-FE-HAZ-01  Hazard submission
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-FE-HAZ-01 – Hazard submission', () => {
  it('POST /api/addhazards is called when Submit Report is pressed', async () => {
    mockEmptyLoad();      // initial GET on mount
    mockSubmitSuccess();  // POST on submit
    mockEmptyLoad();      // GET called again after successful submit

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeTruthy();
    });

    // Open modal via map tap
    await act(async () => {
      fireEvent(screen.getByTestId('mock-map'), 'touchEnd');
    });

    // Submit
    await act(async () => {
      fireEvent.press(screen.getByText('Submit Report'));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/addhazards'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: expect.stringContaining('Category'),
      })
    );
  });

  it('submission payload contains Latitude and Longitude', async () => {
    mockEmptyLoad();
    mockSubmitSuccess();
    mockEmptyLoad();

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeTruthy();
    });

    await act(async () => {
      fireEvent(screen.getByTestId('mock-map'), 'touchEnd');
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Submit Report'));
    });

    const postCall = (global.fetch as jest.Mock).mock.calls.find((call) =>
      call[0].includes('/api/addhazards')
    );
    expect(postCall).toBeDefined();

    const body = JSON.parse(postCall[1].body);
    expect(body).toHaveProperty('Latitude');
    expect(body).toHaveProperty('Longitude');
    expect(body).toHaveProperty('Category');
  });

  it('modal closes after a successful submission', async () => {
    mockEmptyLoad();
    mockSubmitSuccess();
    mockEmptyLoad();

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeTruthy();
    });

    await act(async () => {
      fireEvent(screen.getByTestId('mock-map'), 'touchEnd');
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Submit Report'));
    });

    await waitFor(() => {
      expect(screen.queryByText('Report Hazard')).toBeNull();
    });
  });

  it('reloads markers from the API after a successful submission', async () => {
    mockEmptyLoad();
    mockSubmitSuccess();
    mockEmptyLoad(); // the reload after submit

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeTruthy();
    });

    await act(async () => {
      fireEvent(screen.getByTestId('mock-map'), 'touchEnd');
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Submit Report'));
    });

    await waitFor(() => {
      // fetch should have been called 3 times: initial load + POST + reload
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  it('does not close the modal when the POST fails', async () => {
    mockEmptyLoad();
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeTruthy();
    });

    await act(async () => {
      fireEvent(screen.getByTestId('mock-map'), 'touchEnd');
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Submit Report'));
    });

    await waitFor(() => {
      expect(screen.getByText('Report Hazard')).toBeTruthy();
    });
  });

  it('handles a network error on submit without crashing', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockEmptyLoad();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network down'));

    render(<HazardReporting />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeTruthy();
    });

    await act(async () => {
      fireEvent(screen.getByTestId('mock-map'), 'touchEnd');
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Submit Report'));
    });

    // Modal stays open; component hasn't crashed
    await waitFor(() => {
      expect(screen.getByText('Report Hazard')).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-FE-MAP-02  Hazard colour mapping
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-FE-MAP-02 – Hazard colour mapping', () => {
  const COLOR_CASES: [string, string][] = [
    ['harassment', '#E74C3C'],
    ['theft',      '#F39C12'],
    ['lighting',   '#9B59B6'],
    ['police',     '#3498DB'],
    ['unknown',    '#7F8C8D'],
  ];

  it.each(COLOR_CASES)(
    'category "%s" maps to color %s',
    async (category, expectedColor) => {
      mockHazardLoad([
        { id: 1, Category: category, Latitude: '52.450', Longitude: '-1.920', timestamp: '' },
      ]);

      render(<HazardReporting />);

      await waitFor(() => {
        expect(screen.getByTestId('mock-map').props.markers[0].color).toBe(expectedColor);
      });
    }
  );
});