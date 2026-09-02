import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Platform,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  TextInput,
  ScrollView,
  Animated,
} from "react-native";
import * as Haptics from 'expo-haptics';
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useNavigation } from '@react-navigation/native';

import LeafletMap, { Line, Marker } from "components/LeafletMap";
import { BaseInput } from "components/Base/BaseInput";
import { BACKEND_URL } from "utils/config";
import { useTheme } from "utils/useTheme";
import { useDarkMode } from "utils/global";
import { getDistance } from "utils/location";
import { fetchWithToken, isAuthed } from "lib/stores/auth";

interface Suggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface RouteOption {
  id: string;
  label: string;
  durationMin: number;
  distanceKm: number;
  path: Line;
}

type Phase = "searching" | "navigating";

// Haversine distance between two points in KM
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalRouteKm(points: [number, number][]) {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += haversineKm(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return d;
}

function etaString(minutes: number) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Navigating() {
  const theme = useTheme();
  const navigation = useNavigation();
  const isDark = useDarkMode((s) => s.isDarkMode);
  const isHC = useDarkMode((s) => s.isHighContrast);

  // ─── State ────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("searching");
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [fromLocation, setFromLocation] = useState<Marker | null>(null);
  const [destination, setDestination] = useState<Marker | null>(null);
  const [activeSearch, setActiveSearch] = useState<"from" | "destination" | null>("destination");
  const [fromQuery, setFromQuery] = useState("Your Location");
  const [destQuery, setDestQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [fetchingRoute, setFetchingRoute] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [mapCenter, setMapCenter] = useState<[number, number]>([52.452, -1.930]);
  const [mapZoom, setMapZoom] = useState(14);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const destInputRef = useRef<TextInput>(null);
  const panelAnim = useRef(new Animated.Value(0)).current;
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Location ──────────────────────────────────────────────────────────────
  const handleLocationChange = (loc: Location.LocationObject) => {
    const lat = loc.coords.latitude;
    const lng = loc.coords.longitude;
    setUserLocation({ lat, lng });
    if (phase === "searching" && !destination) {
      setMapCenter([lat, lng]);
    }
    if (!isAuthed()) return;
    fetchWithToken(`${BACKEND_URL}/api/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    }).catch(() => {});
  };

  useEffect(() => {
    let isSubscribed = true;
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === "granted" && isSubscribed) {
        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Highest, timeInterval: 5000 },
          (loc) => { if (!isSubscribed) return; handleLocationChange(loc); }
        ).then((sub) => {
          if (!isSubscribed) { try { sub?.remove(); } catch (_) {} }
          else locationSubscription.current = sub;
        });
      }
    });
    return () => {
      isSubscribed = false;
      if (locationSubscription.current) {
        try { locationSubscription.current.remove(); } catch (_) {}
        locationSubscription.current = null;
      }
    };
  }, []);

  // Keep "Your Location" marker synced to GPS
  useEffect(() => {
    if (fromQuery === "Your Location" && userLocation) {
      setFromLocation((prev) => {
        if (!prev) return { id: "from", lat: userLocation.lat, lng: userLocation.lng, title: "Your Location" };
        const dist = getDistance(
          { latitude: prev.lat, longitude: prev.lng },
          { latitude: userLocation.lat, longitude: userLocation.lng }
        );
        return dist > 1 ? { ...prev, ...userLocation } : prev;
      });
    }
  }, [fromQuery, userLocation]);

  // Update visible map markers
  useEffect(() => {
    const next: Marker[] = [];
    if (userLocation) {
      next.push({ id: "user_location", lat: userLocation.lat, lng: userLocation.lng, title: "You", type: "circle-marker", color: "#3b82f6", radius: 8, opacity: 1 });
    }
    if (fromLocation && fromLocation.title !== "Your Location") next.push(fromLocation);
    if (destination) next.push(destination);
    setMarkers(next);
  }, [userLocation, fromLocation, destination]);

  // Slide-up animation for route panel
  useEffect(() => {
    Animated.spring(panelAnim, {
      toValue: routeOptions.length > 0 && phase === "searching" ? 1 : 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [routeOptions, phase]);

  // Route fetching
  useEffect(() => {
    if (!destination || !fromLocation || !isAuthed()) { setRouteOptions([]); return; }
    setFetchingRoute(true);
    fetchWithToken(`${BACKEND_URL}/api/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startLat: fromLocation.lat, startLng: fromLocation.lng,
        endLat: destination.lat, endLng: destination.lng,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("route error");
        return res.json();
      })
      .then((data: { steps: { point: { lat: number; lng: number } }[] }) => {
        if (!data?.steps) return;
        const points: [number, number][] = data.steps.map((s: any) => [s.point.lat, s.point.lng]);
        const distKm = totalRouteKm(points);
        const durationMin = Math.round((distKm / 5) * 60);
        const option: RouteOption = {
          id: "main",
          label: `via ${destination.title?.split(",")[0] || "destination"}`,
          durationMin,
          distanceKm: Math.round(distKm * 10) / 10,
          path: { id: "route", points, color: "#4f46e5", weight: 5 },
        };
        setRouteOptions([option]);
        setSelectedRoute(option);

        if (points.length > 0) {
          const lats = points.map(p => p[0]);
          const lngs = points.map(p => p[1]);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          const avgLat = (minLat + maxLat) / 2;
          const avgLng = (minLng + maxLng) / 2;

          const latSpan = maxLat - minLat;
          const lngSpan = (maxLng - minLng) * Math.cos(avgLat * Math.PI / 180);
          const maxSpan = Math.max(latSpan, lngSpan);

          let z = 14;
          if (maxSpan > 0) {
            z = Math.floor(14 - Math.log2(maxSpan / 0.014));
          }
          setMapCenter([avgLat, avgLng]);
          setMapZoom(Math.min(Math.max(z, 1), 18));
        }
      })
      .catch(() => {})
      .finally(() => setFetchingRoute(false));
  }, [destination, fromLocation]);

  // ─── Geocoding with Debounce ───────────────────────────────────────────────
  const fetchSuggestions = async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 3 || trimmed.toLowerCase() === "your location") {
      setSuggestions([{ place_id: -1, display_name: "Your Location", lat: "", lon: "" }]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/geocode?q=${encodeURIComponent(trimmed)}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(Array.isArray(data) && data.length > 0 ? data : []);
      } else {
        setSuggestions([]);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (text: string, type: "from" | "destination") => {
    if (type === "from") setFromQuery(text);
    else setDestQuery(text);
    setShowSuggestions(true);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const trimmed = text.trim();
    if (trimmed.length >= 3 && trimmed.toLowerCase() !== "your location") {
      searchDebounceRef.current = setTimeout(() => {
        fetchSuggestions(text);
      }, 500); // 500ms debounce
    } else {
      setSuggestions([{ place_id: -1, display_name: "Your Location", lat: "", lon: "" }]);
    }
  };

  const handleFocus = (type: "from" | "destination") => {
    setActiveSearch(type);
    setShowSuggestions(true);
    const text = type === "from" ? fromQuery : destQuery;
    const trimmed = text.trim();
    if (trimmed.length < 3 || trimmed.toLowerCase() === "your location") {
      setSuggestions([{ place_id: -1, display_name: "Your Location", lat: "", lon: "" }]);
    } else {
      fetchSuggestions(text);
    }
  };

  const handleSelectSuggestion = async (suggestion: Suggestion) => {
    let lat: number, lng: number;
    const title = suggestion.display_name;
    if (suggestion.place_id === -1) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { alert("Permission denied"); return; }
      const loc = await Location.getCurrentPositionAsync({});
      lat = loc.coords.latitude; lng = loc.coords.longitude;
    } else {
      lat = parseFloat(suggestion.lat); lng = parseFloat(suggestion.lon);
    }
    const newMarker: Marker = { id: activeSearch === "from" ? "from" : "destination", lat, lng, title };
    if (activeSearch === "from") {
      setFromLocation(newMarker); setFromQuery(title);
      setTimeout(() => destInputRef.current?.focus(), 100);
    } else {
      setDestination(newMarker); setDestQuery(title);
    }
    setShowSuggestions(false);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const clearSearch = (type: "from" | "destination") => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (type === "from") { setFromQuery(""); setFromLocation(null); }
    else { setDestQuery(""); setDestination(null); setRouteOptions([]); }
    setShowSuggestions(true);
    setSuggestions([{ place_id: -1, display_name: "Your Location", lat: "", lon: "" }]);
  };

  const startNavigation = (route: RouteOption) => {
    setSelectedRoute(route);
    setPhase("navigating");
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const endNavigation = () => {
    setPhase("searching");
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleGoBack = async () => {
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/");
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const activeLines = selectedRoute ? [selectedRoute.path] : [];

  // ─── PHASE 1: Searching ────────────────────────────────────────────────────
  if (phase === "searching") {
    const panelTranslateY = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });

    return (
      <View style={s.container}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

        {/* FIXED NAV BAR */}
        <SafeAreaView style={s.navBar}>
          <View style={s.navContent}>
            <TouchableOpacity style={s.backButton} onPress={handleGoBack} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color="#2C3E50" />
            </TouchableOpacity>
            <Text style={s.navTitle}>Navigation</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>

        {/* MAP */}
        <View style={s.mapWrapper}>
          <LeafletMap
            key={`${isDark}-${isHC}`}
            isDarkMode={isDark}
            isHighContrast={isHC}
            markers={markers}
            lines={activeLines}
            center={mapCenter}
            zoom={mapZoom}
            onMapClick={(lat, lng) => {
              if (activeSearch === "from") {
                setFromLocation({ id: "from", lat, lng, title: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
                setFromQuery(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
              } else {
                setDestination({ id: "destination", lat, lng, title: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
                setDestQuery(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
              }
              setShowSuggestions(false);
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />

          {/* SEARCH CARD */}
          <View style={[s.searchCard, { backgroundColor: isDark ? "#1e1e2e" : "#ffffff" }]}>
            {/* From row */}
            <View style={s.searchRow}>
              <View style={s.dotFrom} />
              <BaseInput
                placeholder="From..."
                placeholderTextColor="#94a3b8"
                value={fromQuery}
                onChangeText={(t) => handleSearchChange(t, "from")}
                onFocus={() => handleFocus("from")}
                style={[s.searchInput, { backgroundColor: "transparent", color: isDark ? "#f1f5f9" : "#1a1a2e", borderWidth: 0 }]}
              />
              {fromQuery.length > 0 && (
                <TouchableOpacity onPress={() => clearSearch("from")}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            <View style={s.searchDivider} />

            {/* To row */}
            <View style={s.searchRow}>
              <Ionicons name="location" size={18} color="#ef4444" style={s.dotTo} />
              <BaseInput
                ref={destInputRef}
                placeholder="Search destination..."
                placeholderTextColor="#94a3b8"
                value={destQuery}
                onChangeText={(t) => handleSearchChange(t, "destination")}
                onFocus={() => handleFocus("destination")}
                style={[s.searchInput, { backgroundColor: "transparent", color: isDark ? "#f1f5f9" : "#1a1a2e", borderWidth: 0 }]}
              />
              {destQuery.length > 0 && (
                <TouchableOpacity onPress={() => clearSearch("destination")}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Suggestions dropdown */}
            {showSuggestions && (suggestions.length > 0 || loading) && (
              <View style={[s.suggestions, { backgroundColor: isDark ? "#1e1e2e" : "#ffffff" }]}>
                {loading ? (
                  <ActivityIndicator style={{ padding: 16 }} color="#4f46e5" />
                ) : (
                  <FlatList
                    data={suggestions}
                    keyExtractor={(item, i) => String(item.place_id ?? i)}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={s.suggestionItem} onPress={() => handleSelectSuggestion(item)}>
                        <Ionicons
                          name={item.place_id === -1 ? "locate" : "location-outline"}
                          size={16}
                          color="#4f46e5"
                          style={{ marginRight: 10 }}
                        />
                        <Text style={[s.suggestionText, { color: isDark ? "#e2e8f0" : "#1e293b" }]} numberOfLines={2}>
                          {item.display_name}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            )}
          </View>

          {/* ROUTE OPTIONS PANEL */}
          {fetchingRoute && (
            <View style={s.fetchingBadge}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={s.fetchingText}>Finding routes…</Text>
            </View>
          )}

          {routeOptions.length > 0 && (
            <Animated.View style={[s.routePanel, { transform: [{ translateY: panelTranslateY }], backgroundColor: isDark ? "#1e1e2e" : "#ffffff" }]}>
              <View style={s.routePanelHandle} />
              <Text style={[s.routePanelTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>Route options</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {routeOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[s.routeCard, selectedRoute?.id === opt.id && s.routeCardSelected]}
                    onPress={() => setSelectedRoute(opt)}
                    activeOpacity={0.85}
                  >
                    <View style={s.routeCardIcon}>
                      <Ionicons name="walk" size={22} color={selectedRoute?.id === opt.id ? "#fff" : "#4f46e5"} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.routeCardLabel, { color: isDark ? "#e2e8f0" : "#1e293b" }]}>{opt.label}</Text>
                      <Text style={s.routeCardMeta}>
                        {opt.durationMin} min · {opt.distanceKm} km
                      </Text>
                    </View>
                    <TouchableOpacity style={s.startBtn} onPress={() => startNavigation(opt)}>
                      <Text style={s.startBtnText}>Start</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          )}
        </View>
      </View>
    );
  }

  // ─── PHASE 2: Active Navigation ────────────────────────────────────────────
  const route = selectedRoute!;
  const eta = etaString(route.durationMin);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* MAP fills screen */}
      <View style={{ flex: 1 }}>
        <LeafletMap
          key={`nav-${isDark}-${isHC}`}
          isDarkMode={isDark}
          isHighContrast={isHC}
          markers={markers}
          lines={[route.path]}
          center={mapCenter}
          zoom={mapZoom}
        />
      </View>

      {/* TOP BACK BUTTON overlay */}
      <SafeAreaView style={s.navOverlay} pointerEvents="box-none">
        <TouchableOpacity style={s.overlayBack} onPress={endNavigation} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={22} color="#1e293b" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* BOTTOM SHEET */}
      <View style={[s.bottomSheet, { backgroundColor: isDark ? "#1e1e2e" : "#ffffff" }]}>
        <View style={s.routePanelHandle} />

        <View style={s.bsStats}>
          {/* ETA */}
          <View style={s.bsStat}>
            <Text style={[s.bsStatValue, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{eta}</Text>
            <Text style={s.bsStatLabel}>arrival</Text>
          </View>
          {/* Duration */}
          <View style={s.bsStat}>
            <Text style={[s.bsStatValue, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{route.durationMin}</Text>
            <Text style={s.bsStatLabel}>min</Text>
          </View>
          {/* Distance */}
          <View style={s.bsStat}>
            <Text style={[s.bsStatValue, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>{route.distanceKm}</Text>
            <Text style={s.bsStatLabel}>km</Text>
          </View>
        </View>

        <TouchableOpacity style={s.endBtn} onPress={endNavigation} activeOpacity={0.85}>
          <Ionicons name="stop-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={s.endBtnText}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  navBar: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    zIndex: 1001,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  navContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#f0f2f5",
    alignItems: "center", justifyContent: "center",
  },
  navTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  mapWrapper: { flex: 1, zIndex: 1 },
  searchCard: {
    position: "absolute",
    top: 16, left: 16, right: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
    overflow: "hidden",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 50,
  },
  dotFrom: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#3b82f6", marginRight: 12,
  },
  dotTo: { marginRight: 8 },
  searchInput: {
    flex: 1, fontSize: 15, height: "100%",
    borderWidth: 0, marginBottom: 0, padding: 0,
  },
  searchDivider: { height: 1, backgroundColor: "#e2e8f0", marginLeft: 36 },
  suggestions: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    maxHeight: 220,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  suggestionText: { flex: 1, fontSize: 14 },
  fetchingBadge: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4f46e5",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    gap: 8,
  },
  fetchingText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  routePanel: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
    maxHeight: 340,
  },
  routePanelHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginBottom: 12,
  },
  routePanelTitle: {
    fontSize: 16, fontWeight: "700",
    marginBottom: 14,
  },
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  routeCardSelected: {
    borderColor: "#4f46e5",
    backgroundColor: "#4f46e510",
  },
  routeCardIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#4f46e515",
    alignItems: "center", justifyContent: "center",
  },
  routeCardLabel: { fontSize: 15, fontWeight: "600", marginBottom: 3 },
  routeCardMeta: { fontSize: 13, color: "#64748b" },
  startBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  startBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  navOverlay: {
    position: "absolute",
    top: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
    left: 0, right: 0,
    paddingTop: 12,
    paddingLeft: 16,
    zIndex: 10,
  },
  overlayBack: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, elevation: 6,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  bsStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
    marginTop: 6,
  },
  bsStat: { alignItems: "center" },
  bsStatValue: { fontSize: 28, fontWeight: "800" },
  bsStatLabel: { fontSize: 13, color: "#94a3b8", marginTop: 2 },
  endBtn: {
    backgroundColor: "#ef4444",
    borderRadius: 28,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ef4444",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  endBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
});
