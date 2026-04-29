import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import LeafletMap from '../LeafletMap';

// Unmock the global mock from jest.setup.js
jest.unmock('../LeafletMap');

// Mock WebView locally to capture props precisely
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  const React = require('react');
  class MockWebView extends React.Component {
    render() {
      return <View {...this.props} testID="WebView" />;
    }
    postMessage = jest.fn();
  }
  return { WebView: MockWebView };
});

describe('Frontend Map Visualisation', () => {
  describe('TC-FE-MAP-01 - Leaflet Component Rendering', () => {
    it('Given markers, When LeafletMap mounts, Then the WebView source contains the base Leaflet structure', () => {
      const { getByTestId } = render(<LeafletMap markers={[]} />);
      const webview = getByTestId('WebView');
      
      const html = webview.props.source.html;
      expect(html).toContain('leaflet.js');
      expect(html).toContain('<div id="map"></div>');
    });

    it('Given isDarkMode is true, When LeafletMap renders, Then the HTML head includes dark mode filters', () => {
      const { getByTestId } = render(<LeafletMap isDarkMode={true} />);
      const webview = getByTestId('WebView');
      
      const html = webview.props.source.html;
      expect(html).toContain('filter: invert(100%) hue-rotate(210deg)');
    });

    it('Given isHighContrast is true, When LeafletMap renders, Then the HTML head includes high contrast filters', () => {
      const { getByTestId } = render(<LeafletMap isHighContrast={true} />);
      const webview = getByTestId('WebView');
      
      const html = webview.props.source.html;
      expect(html).toContain('grayscale(100%) contrast(150%)');
    });
  });

  describe('TC-FE-MAP-02 - Hazard Coloring', () => {
    it('Given specific hazard types, When rendered, Then it prepares the correct color codes in updateMarkers function', () => {
      const { getByTestId } = render(<LeafletMap />);
      const webview = getByTestId('WebView');
      const html = webview.props.source.html;
      
      expect(html).toContain('color: m.color || "red"');
      expect(html).toContain('fillOpacity: m.opacity || 0.4');
    });
  });
});
