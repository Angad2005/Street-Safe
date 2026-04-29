import React, { useEffect, useState } from "react";
import { 
  View, 
  Platform, 
  Modal, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  StatusBar
} from "react-native";
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router } from "expo-router";
import { useNavigation } from '@react-navigation/native';
import LeafletMap, { Marker } from "components/LeafletMap";
import { BACKEND_URL } from "utils/config";
import { useDarkMode } from "utils/global";

// 1. Define Categories and their associated colors
const CATEGORY_CONFIG: Record<string, string> = {
  harassment: "#E74C3C", // Red
  theft: "#F39C12",      // Orange
  lighting: "#9B59B6",   // Purple
  police: "#3498DB",     // Blue
  default: "#7F8C8D"     // Grey (fallback)
};

const CATEGORIES = Object.keys(CATEGORY_CONFIG).filter(cat => cat !== 'default');

export default function HazardReporting() {
  const isDark = useDarkMode((s) => s.isDarkMode);
  const isHC = useDarkMode((s) => s.isHighContrast);
  const navigation = useNavigation();
  
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);

  // 2. Fetch and Format Markers with dynamic colors
  const loadMarkersFromDB = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/hazards`);
      const data = await response.json();
      
      const formatted = data.map((item: any) => {
        const categoryKey = item.Category?.toLowerCase();
        const markerColor = CATEGORY_CONFIG[categoryKey] || CATEGORY_CONFIG.default;

        return {
          id: item.id,
          lat: parseFloat(item.Latitude),
          lng: parseFloat(item.Longitude),
          title: item.Category,
          type: "circle",
          color: markerColor,
          radius: 20,
          opacity: 0.6
        } as Marker;
      });
      
      setMarkers(formatted);
    } catch (e) { 
      console.error("Load error:", e); 
    }
  };

  useEffect(() => { 
    loadMarkersFromDB(); 
  }, []);

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    setModalVisible(true);
  };

  const submitHazard = async () => {
    if (!selectedLocation) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/addhazards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Category: selectedCategory,
          Latitude: selectedLocation.lat.toString(),
          Longitude: selectedLocation.lng.toString()
        })
      });

      if (response.ok) {
        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setModalVisible(false);
        loadMarkersFromDB(); 
      }
    } catch (e) { 
      console.error("Save error:", e); 
    }
  };

  const handleGoBack = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      {/* FIX: Removed the nested View around SafeAreaView. 
          Applied the 'navBar' styles directly to the SafeAreaView 
          to prevent the "double white box" effect.
      */}
      <SafeAreaView style={styles.navBar}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={styles.navContent}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleGoBack}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#2C3E50" />
          </TouchableOpacity>
          
          <Text style={styles.navTitle}>Hazard Map</Text>
          
          {/* Spacer to keep title centered */}
          <View style={{ width: 40 }} /> 
        </View>
      </SafeAreaView>

      <View style={styles.mapContainer}>
        <LeafletMap
          key="hazard-map"
          isDarkMode={isDark}
          isHighContrast={isHC}
          markers={markers}
          center={[52.452, -1.930]}
          zoom={14}
          onMapClick={handleMapClick} 
        />
      </View>

      {/* REPORTING MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Report Hazard</Text>
            
            <Text style={styles.label}>Select Category:</Text>
            <View style={styles.categoryList}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={[
                    styles.catButton, 
                    selectedCategory === cat && { 
                      backgroundColor: CATEGORY_CONFIG[cat],
                      borderColor: CATEGORY_CONFIG[cat] 
                    }
                  ]}
                  onPress={async () => {
                    setSelectedCategory(cat);
                    if (Platform.OS !== "web") {
                      if (cat === "harassment") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                      else if (cat === "theft") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                >
                  <Text style={[
                    styles.catText,
                    selectedCategory === cat && styles.catTextSelected
                  ]}>
                    {cat.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={async () => {
                  setModalVisible(false); 
                  if (Platform.OS !== "web") {
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  }
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.submitBtn} 
                onPress={submitHazard}
              >
                <Text style={styles.submitText}>Submit Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  navBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    // Shadow handles the elevation depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10, 
    // This ensures the color extends to the top on Android
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  navContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56, // Standard mobile header height
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
  mapContainer: {
    flex: 1,
    zIndex: 1,
  },
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.6)' 
  },
  modalContent: { 
    width: '85%', 
    backgroundColor: 'white', 
    padding: 25, 
    borderRadius: 20,
  },
  modalTitle: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 20,
    textAlign: 'center',
    color: '#2C3E50'
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    fontWeight: '600'
  },
  categoryList: { 
    marginVertical: 10 
  },
  catButton: { 
    padding: 12, 
    marginVertical: 5, 
    backgroundColor: '#F5F6F8', 
    borderRadius: 12, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent'
  },
  catText: {
    fontWeight: '700',
    color: '#4A5568',
  },
  catTextSelected: {
    color: 'white'
  },
  actionRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 20 
  },
  cancelBtn: { 
    padding: 15,
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    borderRadius: 12,
    marginRight: 8,
  },
  cancelText: {
    color: '#64748B',
    fontWeight: '700',
  },
  submitBtn: { 
    backgroundColor: '#27AE60', 
    padding: 15, 
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
    marginLeft: 8,
  },
  submitText: {
    color: 'white', 
    fontWeight: 'bold',
  }
});