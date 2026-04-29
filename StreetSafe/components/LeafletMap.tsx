import { useRef, useEffect, useState } from "react";
import { Platform } from "react-native";
import { WebView } from "react-native-webview";

export type Marker = {
  id: string | number;
  type?: "marker" | "circle" | "circle-marker";
  color?: string;
  radius?: number;
  opacity?: number;
  lat: number;
  lng: number;
  title?: string;
  // Support for user avatar image URL
  avatarUrl?: string;
};

export type Line = {
  id: string | number;
  points: [number, number][];
  color?: string;
  weight?: number;
};

export type MapProps = {
  markers?: Marker[];
  lines?: Line[];
  center?: [number, number];
  zoom?: number;
  style?: any;
  onMapClick?: (lat: number, lng: number) => void;
  isDarkMode?: boolean;
  isHighContrast?: boolean;
};

export default function LeafletMap({
  markers = [],
  lines = [],
  center = [52.452, -1.930],
  zoom = 13,
  style,
  onMapClick,
  isDarkMode = false,
  isHighContrast = false,
}: MapProps) {
  const webviewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  const mapUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <style>
      html,body,#map{height:100%;margin:0;padding:0;}
${isDarkMode ? `
      .leaflet-layer,
      .leaflet-control-zoom-in,
      .leaflet-control-zoom-out,
      .leaflet-control-attribution {
        filter: invert(100%) hue-rotate(210deg) brightness(1.4);
      }
` : ''}
${isHighContrast ? `
      .leaflet-layer,
      .leaflet-control-zoom-in,
      .leaflet-control-zoom-out,
      .leaflet-control-attribution {
        filter: invert(100%) grayscale(100%) contrast(150%) brightness(120%);
      }
` : ''}
      /* Class avatar-marker */
      .avatar-marker {
        position: relative;
        width: 48px;
        height: 48px;
        border: 3px solid white;
        border-radius: 50%;
        overflow: hidden;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      }
      .avatar-marker img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .marker-pointer {
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 10px solid white;
      }
    </style>
</head>
<body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        const map = L.map('map', { zoomControl: false }).setView([0, 0], 13);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        L.tileLayer("${mapUrl}", { 
            attribution:"© OpenStreetMap" 
        }).addTo(map);

        const markerLayer = L.layerGroup().addTo(map);
        const lineLayer = L.layerGroup().addTo(map);

        map.on('click', function(e) {
            const data = JSON.stringify({ type: "onMapClick", lat: e.latlng.lat, lng: e.latlng.lng });
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(data);
            } else {
                window.parent.postMessage(data, "*");
            }
        });

        function updateCenter(lat, lng) {
            map.setView([lat, lng], map.getZoom());
        }

        function updateMarkers(markers){
            markerLayer.clearLayers();
            markers.forEach(m => {
                if (m.type === "circle" || m.type === "circle-marker") {
                    const circle = (m.type === "circle" ? L.circle : L.circleMarker)([m.lat, m.lng], {
                        color: m.color || "red",
                        fillColor: m.color || "red",
                        fillOpacity: m.opacity || 0.4,
                        radius: m.radius || 100
                    });
                    circle.addTo(markerLayer);
                    if (m.title) circle.bindPopup(m.title);
                } else if (m.avatarUrl) {
                    // If we have an avatar URL, we can render an avatar marker.
                    const icon = L.divIcon({
                        className: "",
                        html: '<div class="avatar-marker"><img src="' + m.avatarUrl + '" /><div class="marker-pointer"></div></div>',
                        iconSize: [48, 48],
                        iconAnchor: [24, 56]
                    });
                    L.marker([m.lat, m.lng], { icon: icon }).addTo(markerLayer).bindPopup(m.title || "");
                } else {
                    L.marker([m.lat, m.lng]).addTo(markerLayer).bindPopup(m.title || "");
                }
            });
        }

        function updateLines(lines) {
            lineLayer.clearLayers();
            lines.forEach(line => {
                L.polyline(line.points, {
                    color: line.color || "blue",
                    weight: line.weight || 3
                }).addTo(lineLayer);
            });
        }

        function onMessage(event) {
            try {
                const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if(msg.type === "updateMarkers") updateMarkers(msg.markers);
                if(msg.type === "updateLines") updateLines(msg.lines);
                if(msg.type === "updateCenter") updateCenter(msg.lat, msg.lng);
            } catch(e) {}
        }

        window.addEventListener("message", onMessage);
        document.addEventListener("message", onMessage);
    </script>
</body>
</html>
`;

  const markersData = JSON.stringify({ type: "updateMarkers", markers });
  useEffect(() => {
    if (ready) {
      if (Platform.OS === "web") {
        iframeRef.current?.contentWindow?.postMessage(markersData, "*");
      } else {
        webviewRef.current?.postMessage(markersData);
      }
    }
  }, [markersData, ready]);

  const linesData = JSON.stringify({ type: "updateLines", lines });
  useEffect(() => {
    if (ready) {
      if (Platform.OS === "web") {
        iframeRef.current?.contentWindow?.postMessage(linesData, "*");
      } else {
        webviewRef.current?.postMessage(linesData);
      }
    }
  }, [linesData, ready]);

  const centerData = JSON.stringify({ type: "updateCenter", lat: center[0], lng: center[1] });
  useEffect(() => {
    if (ready) {
      if (Platform.OS === "web") {
        iframeRef.current?.contentWindow?.postMessage(centerData, "*");
      } else {
        webviewRef.current?.postMessage(centerData);
      }
    }
  }, [centerData, ready]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(Platform.OS === "web" ? event.data : event.nativeEvent.data);
      if (data.type === "onMapClick" && onMapClick) {
        onMapClick(data.lat, data.lng);
      }
    } catch (e) { }
  };

  useEffect(() => {
    if (Platform.OS === "web") {
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [onMapClick]);

  if (Platform.OS === "web") {
    return (
      <iframe
        ref={iframeRef}
        srcDoc={html}
        style={{ width: "100%", height: "100%", border: 0, ...style }}
        onLoad={() => { setReady(true); }}
      />
    );
  }

  return (
    <WebView
      ref={webviewRef}
      originWhitelist={["*"]}
      source={{ html }}
      style={[{ flex: 1 }, style]}
      onLoadEnd={() => setReady(true)}
      onMessage={handleMessage}
    />
  );
}