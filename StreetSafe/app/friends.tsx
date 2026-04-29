import React, { useEffect, useState } from "react";
import { 
  View, 
  StyleSheet, 
  Image, 
  SafeAreaView, 
  TouchableOpacity, 
  Text, 
  Platform, 
  StatusBar,
  ScrollView 
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { MainButton } from "components/MainButton";
import { Root } from "components/Root";
import { ButtonText } from "components/ButtonText";
import { BaseText } from "components/Base/BaseText";
import { BaseModal } from "components/Base/BaseModal";
import { SquareButton } from "components/SquareButton";
import { Container } from "components/Container";
import { BaseInput } from "components/Base/BaseInput";

import { BACKEND_URL } from "utils/config";
import { fetchWithToken } from "lib/stores/auth";
import { Friend } from "utils/friends";
import { User } from "lib/stores/user";
import { useDarkMode } from "utils/global";

enum SelectedState {
  Friends = 0,
  Pending = 1,
  Incoming = 2
}

export default function Friends() {
  const isDark = useDarkMode((s) => s.isDarkMode);
  const navigation = useNavigation();
  
  const [selected, setSelected] = useState(SelectedState.Friends);
  const [addFriendModalEnabled, setAddFriendModalEnabled] = useState(false);
  const [friends, setFriends] = useState([] as User[]);
  const [pendingRequests, setPendingRequests] = useState([] as User[]);
  const [incomingRequests, setIncomingRequests] = useState([] as User[]);
  const [friendEmail, setFriendEmail] = useState("");

  const loadAll = async () => {
    try {
      const [friendsRes, pendingRes, incomingRes] = await Promise.all([
        fetchWithToken(`${BACKEND_URL}/api/getFriends`),
        fetchWithToken(`${BACKEND_URL}/api/getFriendRequestsSent`),
        fetchWithToken(`${BACKEND_URL}/api/getFriendRequests`),
      ]);

      const friendsData = await friendsRes.json();
      const pendingData = await pendingRes.json();
      const incomingData = await incomingRes.json();

      const fetchWithTokenUser = async (userId: number): Promise<User|null> => {
        try {
          const res = await fetchWithToken(`${BACKEND_URL}/users/getUser?id=${userId}`);
          if (!res.ok) return null;
          return await res.json();
        } catch { return null; }
      };

      const friendsList = (await Promise.all(friendsData.map((f: Friend) => fetchWithTokenUser(f.accepter_id)))).filter(Boolean) as User[];
      const pendingList = (await Promise.all(pendingData.map((f: Friend) => fetchWithTokenUser(f.accepter_id)))).filter(Boolean) as User[];
      const incomingList = (await Promise.all(incomingData.map((f: Friend) => fetchWithTokenUser(f.sender_id)))).filter(Boolean) as User[];

      setFriends(friendsList);
      setPendingRequests(pendingList);
      setIncomingRequests(incomingList);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { loadAll(); }, [selected]);

  const handleGoBack = async () => {
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/");
  };

  const addFriend = async () => {
    if (!friendEmail.trim()) return;
    setAddFriendModalEnabled(false);
    setFriendEmail("");
    await fetchWithToken(`${BACKEND_URL}/api/createFriendRequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendEmail }),
    });
    loadAll();
  };

  const removeFriend = async (id: number) => { await fetchWithToken(`${BACKEND_URL}/api/removeFriend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendId: id }) }); loadAll(); };
  const acceptRequest = async (id: number) => { await fetchWithToken(`${BACKEND_URL}/api/acceptFriendRequest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendId: id }) }); loadAll(); };
  const rejectRequest = async (id: number) => { await fetchWithToken(`${BACKEND_URL}/api/rejectFriendRequest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendId: id }) }); loadAll(); };
  const deleteRequest = async (id: number) => { await fetchWithToken(`${BACKEND_URL}/api/deleteFriendRequest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendId: id }) }); loadAll(); };

  return (
    <View style={s.mainWrapper}>
      <StatusBar barStyle="dark-content" />
      
      {/* FIXED NAV BAR - At the very top */}
      <SafeAreaView style={s.navBar}>
        <View style={s.navContent}>
          <TouchableOpacity style={s.backButton} onPress={handleGoBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#2C3E50" />
          </TouchableOpacity>
          <Text style={s.navTitle}>Friends</Text>
          <View style={{ width: 40 }} /> 
        </View>
      </SafeAreaView>

      <Root>
        <BaseModal visible={addFriendModalEnabled} animationType="fade" transparent={true} OnClickOutside={() => setAddFriendModalEnabled(false)}>
            <BaseText style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>Add Friend</BaseText>
            <SquareButton onPress={() => setAddFriendModalEnabled(false)} style={s.modalCloseButton}><BaseText>X</BaseText></SquareButton>
            <BaseInput placeholder="Email" onChangeText={setFriendEmail} onSubmitEditing={addFriend}/>
            <MainButton onPress={addFriend}><BaseText>Send Request</BaseText></MainButton>
        </BaseModal>

        <Container>
          {/* Category Tabs */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            <MainButton onPress={() => setSelected(SelectedState.Friends)} style={s.heading}><ButtonText>Friends ({friends.length})</ButtonText></MainButton>
            <MainButton onPress={() => setSelected(SelectedState.Pending)} style={s.heading}><ButtonText>Pending ({pendingRequests.length})</ButtonText></MainButton>
            <MainButton onPress={() => setSelected(SelectedState.Incoming)} style={s.heading}><ButtonText>Incoming ({incomingRequests.length})</ButtonText></MainButton>
            <MainButton onPress={() => setAddFriendModalEnabled(true)} style={[s.heading, {backgroundColor: '#27AE60'}]}><ButtonText>+ Add</ButtonText></MainButton>
          </View>

          {/* List Content */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {(selected === SelectedState.Friends ? friends : selected === SelectedState.Pending ? pendingRequests : incomingRequests).map((user) => (
              <View style={s.friendRow} key={user.id}>
                <Image source={{ uri: user.avatarUrl }} style={s.avatar} />
                <BaseText style={s.friendName}>{user.name}</BaseText>
                
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {selected === SelectedState.Friends && (
                    <SquareButton style={s.friendRemoveButton} onPress={() => removeFriend(user.id)}><ButtonText>X</ButtonText></SquareButton>
                    )}
                    {selected === SelectedState.Pending && (
                    <MainButton style={s.friendButton} onPress={() => deleteRequest(user.id)}><ButtonText>Cancel</ButtonText></MainButton>
                    )}
                    {selected === SelectedState.Incoming && (
                    <>
                        <MainButton style={s.friendButton} onPress={() => acceptRequest(user.id)}><ButtonText>Accept</ButtonText></MainButton>
                        <MainButton style={[s.friendRemoveButton, s.friendButton]} onPress={() => rejectRequest(user.id)}><ButtonText>X</ButtonText></MainButton>
                    </>
                    )}
                </View>
              </View>
            ))}
          </ScrollView>
        </Container>
      </Root>
    </View>
  );
}

const s = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF', 
  },
  navBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 999,
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
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    padding: 15,
    backgroundColor: "#1e293b", // RESTORED BLUE/DARK COLOR
    borderRadius: 15,
    justifyContent: "space-between"
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  friendName: {
    fontSize: 18,
    flex: 1,
    marginLeft: 12
  },
  friendRemoveButton: {
    width: 36,
    height: 36,
    backgroundColor: '#E74C3C',
  },
  friendButton: {
    marginLeft: 8,
    width: 84,
    height: 36,
  },
  heading: {
    margin: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    height: "auto",
    width: "auto"
  },
  modalCloseButton: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 36,
    height: 36,
  },
});