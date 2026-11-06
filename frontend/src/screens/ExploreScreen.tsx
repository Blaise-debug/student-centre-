import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export interface ExploreUser {
  id: string;
  displayName: string;
  username: string;
  course: string;
  institution: string;
  levelOfStudy: string;
  avatarUrl: string;
  bannerUrl: string;
  isPeered?: boolean;
}

// 10 Initial Mock Users (4 pre-peered for testing the 'Peers' tab, 6 non-peered for 'Explore')
const INITIAL_MOCK_USERS: ExploreUser[] = [
  {
    id: 'u1',
    displayName: 'Chris Namusasi',
    username: 'chris_n',
    course: 'Software Engineering',
    institution: 'Turkana University',
    levelOfStudy: 'Undergraduate',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
    bannerUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800',
    isPeered: false,
  },
  {
    id: 'u2',
    displayName: 'Nazrin Hakim',
    username: 'nazrin_h',
    course: 'Computer Science',
    institution: 'KeMU',
    levelOfStudy: 'Undergraduate',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
    bannerUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800',
    isPeered: false,
  },
  {
    id: 'u3',
    displayName: 'Amina Mohamed',
    username: 'amina_m',
    course: 'Information Technology',
    institution: 'University of Nairobi',
    levelOfStudy: 'Undergraduate',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300',
    bannerUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800',
    isPeered: true,
  },
  {
    id: 'u4',
    displayName: 'David Ochieng',
    username: 'david_o',
    course: 'Data Science',
    institution: 'JJKUAT',
    levelOfStudy: 'Postgraduate',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300',
    bannerUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800',
    isPeered: false,
  },
  {
    id: 'u5',
    displayName: 'Sarah Wanjiku',
    username: 'sarah_w',
    course: 'Cyber Security',
    institution: 'Kenyatta University',
    levelOfStudy: 'Undergraduate',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300',
    bannerUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800',
    isPeered: true,
  },
  {
    id: 'u6',
    displayName: 'Brian Kiprop',
    username: 'brian_k',
    course: 'Electrical Engineering',
    institution: 'Moi University',
    levelOfStudy: 'Undergraduate',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300',
    bannerUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800',
    isPeered: false,
  },
  {
    id: 'u7',
    displayName: 'Grace Akinyi',
    username: 'grace_a',
    course: 'Business Information Systems',
    institution: 'Strathmore University',
    levelOfStudy: 'Undergraduate',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300',
    bannerUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
    isPeered: true,
  },
  {
    id: 'u8',
    displayName: 'Kevin Mutua',
    username: 'kevin_m',
    course: 'Software Engineering',
    institution: 'KeMU',
    levelOfStudy: 'Undergraduate',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300',
    bannerUrl: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800',
    isPeered: false,
  },
  {
    id: 'u9',
    displayName: 'Lucy Cherono',
    username: 'lucy_c',
    course: 'Applied Statistics',
    institution: 'Egerton University',
    levelOfStudy: 'Undergraduate',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300',
    bannerUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
    isPeered: true,
  },
  {
    id: 'u10',
    displayName: 'Daniel Hassan',
    username: 'daniel_h',
    course: 'Network Engineering',
    institution: 'Technical University of Kenya',
    levelOfStudy: 'Undergraduate',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300',
    bannerUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    isPeered: false,
  },
];

type TabType = 'explore' | 'peers';

export default function ExploreScreen() {
  const navigation = useNavigation<any>();

  const [activeTab, setActiveTab] = useState<TabType>('explore');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<ExploreUser[]>(INITIAL_MOCK_USERS);
  const [isSearching, setIsSearching] = useState(false);
  const [requestedUserIds, setRequestedUserIds] = useState<Record<string, boolean>>({});

  // Filter users based on active tab and search query
  const displayedUsers = users.filter((user) => {
    const matchesTab = activeTab === 'peers' ? user.isPeered : !user.isPeered;
    if (!matchesTab) return false;

    if (!query.trim()) return true;

    const q = query.trim().toLowerCase();
    return (
      user.displayName.toLowerCase().includes(q) ||
      user.username.toLowerCase().includes(q) ||
      user.institution.toLowerCase().includes(q) ||
      user.course.toLowerCase().includes(q)
    );
  });

  const handlePerformSearch = () => {
    Keyboard.dismiss();
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
    }, 150);
  };

  const handleInputChange = (text: string) => {
    setQuery(text);
  };

  // Toggle peer request / add to peer list
  const handleToggleRequestPeer = (user: ExploreUser) => {
    const isAlreadyRequested = requestedUserIds[user.id];
    setRequestedUserIds((prev) => ({
      ...prev,
      [user.id]: !isAlreadyRequested,
    }));

    if (!isAlreadyRequested) {
      // Mark as peered so they move to the Peers tab
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === user.id ? { ...u, isPeered: true } : u))
      );
      Alert.alert('Peer Added', `${user.displayName} is now added to your Peers!`);
    } else {
      Alert.alert('Request Cancelled', `Cancelled peer request to ${user.displayName}`);
    }
  };

  const handleSendMessage = (user: ExploreUser) => {
    try {
      navigation.navigate('ChatModal', {
        conversationId: `conv_${user.id}`,
        conversationName: user.displayName,
      });
    } catch (e) {
      Alert.alert('Message', `Opening conversation with ${user.displayName}`);
    }
  };

  // Robust profile navigation handler with fallbacks to avoid unhandled route errors
  const handleOpenUserProfile = (user: ExploreUser) => {
    const profileParams = {
      profile: {
        id: user.id,
        displayName: user.displayName,
        institution: user.institution,
        course: user.course,
        levelOfStudy: user.levelOfStudy,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        isPeerRequested: requestedUserIds[user.id] || false,
        about: {
          fieldOfStudy: `${user.course} & Computing`,
          academicYear: 'Year 3 (Semester 2)',
          projects: [
            {
              title: 'Campus Mobile Portal',
              description: 'Mobile app tailored for student resources and networking.',
              status: 'In Progress',
            },
          ],
          achievements: ['Dean’s List for Academic Excellence', 'Tech Student Ambassador'],
        },
        preferences: {
          favoriteBooks: ['Clean Architecture', 'The Pragmatic Programmer'],
          associations: ['Campus Devs Community', 'IEEE Student Branch'],
          techInterests: ['Mobile Apps', 'Software Systems', 'Cloud Services'],
        },
        posts: [
          {
            id: `post_${user.id}`,
            time: 'Explore your future',
            contentImage: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=700',
          },
        ],
      },
    };

    // Try navigating to various common route names to avoid "not handled by navigator" error
    try {
      if (navigation.getState()?.routeNames?.includes('UserProfile')) {
        navigation.navigate('UserProfile', profileParams);
      } else if (navigation.getState()?.routeNames?.includes('UserProfileScreen')) {
        navigation.navigate('UserProfileScreen', profileParams);
      } else if (navigation.getParent()) {
        navigation.getParent()?.navigate('UserProfile', profileParams);
      } else {
        navigation.navigate('UserProfile', profileParams);
      }
    } catch (error) {
      console.warn('[ExploreScreen] Navigation failed, triggering fallback modal/alert:', error);
      Alert.alert('User Profile', `${user.displayName}\n${user.institution}\n${user.course}`);
    }
  };

  const renderUserCard = ({ item }: { item: ExploreUser }) => {
    const isRequested = requestedUserIds[item.id];

    return (
      <View style={styles.userCard}>
        {/* Profile Avatar (Larger size) */}
        <TouchableOpacity onPress={() => handleOpenUserProfile(item)}>
          <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
        </TouchableOpacity>

        {/* Profile Info (Name & Institution) */}
        <TouchableOpacity
          style={styles.userInfoContainer}
          onPress={() => handleOpenUserProfile(item)}
        >
          <Text style={styles.displayName}>{item.displayName}</Text>
          <Text style={styles.institutionText}>{item.institution}</Text>
        </TouchableOpacity>

        {/* Action Button (Request Peer or Message based on Tab) */}
        {activeTab === 'explore' ? (
          <TouchableOpacity
            style={[styles.actionButton, isRequested && styles.actionButtonActive]}
            onPress={() => handleToggleRequestPeer(item)}
          >
            <Text style={styles.actionButtonText}>
              {isRequested ? 'Pending' : 'Request peer'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSendMessage(item)}
          >
            <Text style={styles.actionButtonText}>Message</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* Search Entry Bar */}
        <View style={styles.searchBarWrapper}>
          <View style={styles.searchInputContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or username"
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={handleInputChange}
              onSubmitEditing={handlePerformSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchIconButton} onPress={handlePerformSearch}>
              <Ionicons name="search" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs Row: Explore & Peers */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'explore' && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab('explore')}
          >
            <Text
              style={[
                styles.tabTitle,
                activeTab === 'explore' && styles.tabTitleActive,
              ]}
            >
              Explore
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'peers' && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab('peers')}
          >
            <Text
              style={[
                styles.tabTitle,
                activeTab === 'peers' && styles.tabTitleActive,
              ]}
            >
              Peers
            </Text>
          </TouchableOpacity>
        </View>

        {/* List Content Area */}
        <View style={styles.contentArea}>
          {isSearching ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : displayedUsers.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>
                {activeTab === 'peers' ? 'No peers found' : 'No users found'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={displayedUsers}
              keyExtractor={(item) => item.id}
              renderItem={renderUserCard}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    height: '100%',
  },
  searchIconButton: {
    padding: 4,
    marginLeft: 8,
  },
  /* Tabs Styles */
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginVertical: 8,
    gap: 12,
  },
  tabButton: {
    flex: 1,
    backgroundColor: '#EAEAEA',
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#E2EFE7',
  },
  tabTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTitleActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  contentArea: {
    flex: 1,
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  /* User Card Styles */
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  avatarImage: {
    width: 56, // Increased profile photo size
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceLight,
  },
  userInfoContainer: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  displayName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  institutionText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonActive: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});
