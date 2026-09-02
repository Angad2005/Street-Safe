import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { 
  View, 
  Platform, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar, 
  Text 
} from "react-native";
import * as Haptics from 'expo-haptics';
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useNavigation } from '@react-navigation/native';

import { ButtonText } from "components/ButtonText";
import { MainButton } from "components/MainButton";
import LeafletMap, { Line, Marker } from "components/LeafletMap";
import { useDarkMode } from "utils/global";
import { fetchWithToken } from "lib/stores/auth";
import { BACKEND_URL } from "utils/config";
import { BaseText } from "components/Base/BaseText";
import { Friend } from "utils/friends";
import { User, useUser } from "lib/stores/user";
import { BaseModal } from "components/Base/BaseModal";
import { Container } from "components/Container";

const POLL_INTERVAL_MS = 5_000;
type LocationEntry = { lat: number; lng: number; avatarUrl: string | null; name?: string };

export default function Tracking() {
  const navigation = useNavigation();
  const isDark = useDarkMode((s) => s.isDarkMode);
  const isHC = useDarkMode((s) => s.isHighContrast);
  
  const [modalVisible, setModalVisible] = useState(false);

  const currentUser = useUser((s) => s.value);
  const [isTracking, setIsTracking] = useState(false);
  const [otherUsers, setOtherUsers] = useState<Record<number, LocationEntry>>({});
  const [hazards, setHazards] = useState<Marker[]>([]);
  const [routes, setRoutes] = useState<Record<number, Line>>({});
  const [friends, setFriends] = useState<User[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<number>>(new Set());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const linePollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const lineColors = ["blue", "red", "green", "orange", "purple"];

  const handleGoBack = async () => {
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/");
  };

  useEffect(() => {
    let isMounted = true;
    const loadFriends = async () => {
      try {
        const friendsRes = await fetchWithToken(`${BACKEND_URL}/api/getFriends`);
        if (!friendsRes.ok) return;
        const friendsData: Friend[] = await friendsRes.json();
        
        const fetchUser = async (userId: number): Promise<User | null> => {
          try {
            const res = await fetchWithToken(`${BACKEND_URL}/users/getUser?id=${userId}`);
            return res.ok ? await res.json() : null;
          } catch { return null; }
        };
        const myId = currentUser?.id;
        const userList = (await Promise.all(friendsData.map((f) => {
          const otherId = f.sender_id === myId ? f.accepter_id : f.sender_id;
          return fetchUser(otherId);
        }))).filter((u): u is User => Boolean(u));
        
        if (isMounted) setFriends(userList);
      } catch (e) { console.warn("[Friends] Failed to load:", e); }
    };
    loadFriends();
    return () => { isMounted = false; };
  }, [currentUser?.id]);

  useEffect(() => {
    const poll = async (friendId: number) => {
      try {
        if (!isTracking) return;
        const res = await fetchWithToken(`${BACKEND_URL}/api/getFriendRoute`, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ friendId }) 
        });
        if (!res.ok) return;

        const data: { steps: { point: { lat: number, lng: number } }[] } = await res.json();
        if (!data?.steps) {
          setRoutes((prev) => {
            const newRoutes = { ...prev };
            delete newRoutes[friendId];
            return newRoutes;
          });
          return;
        }
        const routePoints = data.steps.map((step: any) => step.point);

        const newRoute = {
          id: friendId,
          color: lineColors[friendId % lineColors.length],
          points: routePoints,
        };

        setRoutes((prev) => ({
          ...prev,
          [friendId]: newRoute,
        }));
      } catch (e) { console.warn("[Poll] route failed:", e); }
    };

    const pollAll = async () => {
      for (const friend of selectedFriendIds.values()) {
        await poll(friend);
      }
    };

    if (isTracking && selectedFriendIds.size > 0) {
      pollAll(); 
      linePollIntervalRef.current = setInterval(pollAll, POLL_INTERVAL_MS);
    }
    return () => { 
      if (linePollIntervalRef.current) clearInterval(linePollIntervalRef.current); 
    };
  }, [isTracking, selectedFriendIds]);

  useEffect(() => {
    const poll = async () => {
      try {
        if (!isTracking) return;
        const res = await fetchWithToken(`${BACKEND_URL}/api/locations`);
        if (!res.ok) return;
        const others: Record<number, LocationEntry> = await res.json();
        if (currentUser?.id != null) delete others[currentUser.id];

        // Filter out users that are not selected
        const filtered = Object.fromEntries(
          Object.entries(others).filter(([id]) => selectedFriendIds.has(parseInt(id)))
        );
        
        setOtherUsers(filtered);
      } catch (e) { console.warn("[Poll] locations failed:", e); }
    };

    if (isTracking) {
      poll(); 
      pollIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    }
    return () => { 
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); 
    };
  }, [currentUser?.id, isTracking, selectedFriendIds]);

  const toggleFriend = (id: number) => {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const markers: Marker[] = [
    ...hazards,
    ...(Object.keys(otherUsers) as unknown as string[]).map((idStr): Marker => {
      const id = Number(idStr);
      const entry = otherUsers[id];
      return {
        id: String(id),
        lat: entry.lat,
        lng: entry.lng,
        avatarUrl: entry.avatarUrl || undefined,
        title: entry.name || "User",
        type: entry.avatarUrl ? undefined : "circle-marker",
        color: "#3b82f6",
        radius: 10,
        opacity: 0.9,
      };
    })
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* FIXED NAV BAR */}
      <SafeAreaView style={styles.navBar}>
        <View style={styles.navContent}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#2C3E50" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Live Tracking</Text>
          <View style={{ width: 40 }} /> 
        </View>
      </SafeAreaView>

      <View style={styles.mapWrapper}>
        <LeafletMap
          key={`${isDark}-${isHC}`}
          isDarkMode={isDark}
          isHighContrast={isHC}
          zoom={15}
          markers={markers}
          lines={Object.values(routes)}
        />

        <MainButton style={styles.fab} onPress={() => setModalVisible(true)}>
          <ButtonText>Tracking</ButtonText>
        </MainButton>
      </View>

      <BaseModal visible={modalVisible} OnClickOutside={() => setModalVisible(false)} style={styles.modalContent}>
        <BaseText style={styles.modalTitle}>Tracking Control</BaseText>
        <BaseText style={styles.statusLabel}>{isTracking ? "Tracking is ON" : "Tracking is OFF"}</BaseText>

        <Container>
          <View style={[s.friendsPanel, { marginTop: 15 }]}>
            <BaseText style={s.friendsPanelTitle}>Track friends ({selectedFriendIds.size})</BaseText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.friendsList}>
              {friends.map((friend) => {
                const selected = selectedFriendIds.has(friend.id);
                return (
                  <TouchableOpacity key={friend.id} onPress={() => toggleFriend(friend.id)} style={[s.friendChip, selected && s.friendChipSelected]}>
                    <Image source={{ uri: friend.avatarUrl }} style={s.friendAvatar} />
                    <BaseText style={[s.friendName, selected && s.friendNameSelected]}>{friend.name.split(" ")[0]}</BaseText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Container>

        <View style={styles.actionRow}>
          <MainButton style={{ flex: 1 }} onPress={() => setModalVisible(false)}>
            <ButtonText>Close</ButtonText>
          </MainButton>
          <MainButton
            style={{ flex: 1, marginLeft: 10, backgroundColor: isTracking ? "#E74C3C" : "#7c3aed" }}
            onPress={() => {
              isTracking ? setIsTracking(false) : setIsTracking(true);
              setModalVisible(false);
            }}
          >
            <ButtonText>{isTracking ? "Stop" : "Start"}</ButtonText>
          </MainButton>
        </View>
      </BaseModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  navBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  navContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F2F5', 
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700', 
    color: '#1A1A1A',
  },
  mapWrapper: {
    flex: 1,
    zIndex: 1,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 140,
    elevation: 10,
    zIndex: 999,
  },
  modalContent: {
    width: '90%',
    maxWidth: 350,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  statusLabel: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 20,
  },
});

const s = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  friendsPanel: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 15,
  },
  friendsPanelTitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
  },
  friendsList: {
    flexDirection: "row",
  },
  friendChip: {
    alignItems: "center",
    marginRight: 15,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  friendChipSelected: {
    backgroundColor: "#7c3aed15",
    borderColor: "#7c3aed",
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 4,
  },
  friendName: {
    fontSize: 12,
    textAlign: 'center',
  },
  friendNameSelected: {
    color: "#7c3aed",
    fontWeight: "bold",
  },
});
