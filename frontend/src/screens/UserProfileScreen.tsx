import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export interface PeerProfileData {
  id: string;
  displayName: string;
  institution: string;
  course: string;
  levelOfStudy: string;
  avatarUrl: string;
  bannerUrl: string;
  isPeerRequested?: boolean;
  about: {
    fieldOfStudy: string;
    academicYear: string;
    projects: Array<{ title: string; description: string; status: string }>;
    achievements: string[];
  };
  preferences: {
    favoriteBooks: string[];
    associations: string[];
    techInterests: string[];
  };
  posts: Array<{
    id: string;
    time: string;
    quote?: string;
    contentImage: string;
  }>;
}

interface UserProfileScreenProps {
  route?: {
    params?: {
      profile?: PeerProfileData;
    };
  };
  navigation?: any;
}

const DEFAULT_PEER: PeerProfileData = {
  id: 'peer_1',
  displayName: 'Chris Namusasi',
  institution: 'Turkana University',
  course: 'Software Engineering',
  levelOfStudy: 'Undergraduate',
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
  bannerUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800',
  isPeerRequested: false,
  about: {
    fieldOfStudy: 'Software Engineering & Cloud Computing',
    academicYear: 'Year 3 (Semester 2)',
    projects: [
      {
        title: 'Campus Mobile Hub',
        description: 'React Native app for peer collaboration and event management.',
        status: 'In Progress',
      },
      {
        title: 'Smart Library Portal',
        description: 'Automated book reservation system using Node.js.',
        status: 'Completed',
      },
    ],
    achievements: [
      '1st Place - University Hackathon 2025',
      'Dean’s List for Academic Excellence (2024)',
      'Lead Developer at Tech Student Club',
    ],
  },
  preferences: {
    favoriteBooks: [
      'Clean Code by Robert C. Martin',
      'Designing Data-Intensive Applications',
      'The Pragmatic Programmer',
    ],
    associations: [
      'IEEE Student Branch Member',
      'Turkana Devs Community',
      'Campus Open Source Collective',
    ],
    techInterests: ['React Native', 'TypeScript', 'GraphQL', 'DevOps & Docker'],
  },
  posts: [
    {
      id: 'p1',
      time: 'Explore your future',
      contentImage: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=700',
    },
    {
      id: 'p2',
      time: 'Building modern interfaces',
      contentImage: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=700',
    },
  ],
};

export default function UserProfileScreen({ route, navigation }: UserProfileScreenProps) {
  const profile: PeerProfileData = route?.params?.profile || DEFAULT_PEER;

  // Tabs: 'Posts' | 'About' | 'Preferences'
  const [activeTab, setActiveTab] = useState<'Posts' | 'About' | 'Preferences'>('Posts');
  const [isRequested, setIsRequested] = useState(profile.isPeerRequested || false);

  const handlePeerRequest = () => {
    setIsRequested((prev) => !prev);
    Alert.alert(
      isRequested ? 'Request Cancelled' : 'Peer Request Sent',
      isRequested
        ? `Cancelled peer request to ${profile.displayName}`
        : `Peer request sent to ${profile.displayName}`
    );
  };

  const handleMessagePress = () => {
    Alert.alert('Message', `Starting conversation with ${profile.displayName}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Top Header Navigation */}
      <View style={styles.topNavHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topNavTitle}>{profile.displayName}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Banner Image */}
        <View style={styles.bannerContainer}>
          <Image source={{ uri: profile.bannerUrl }} style={styles.bannerImage} />
        </View>

        {/* Profile Details & Action Buttons Section */}
        <View style={styles.profileHeaderSection}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
          </View>

          <View style={styles.userDetails}>
            <Text style={styles.displayName}>{profile.displayName}</Text>
            <Text style={styles.institution}>{profile.institution}</Text>
            <Text style={styles.courseLevel}>
              {profile.course}, {profile.levelOfStudy}
            </Text>
          </View>

          {/* Peer Request & Message Actions */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.actionButton, isRequested && styles.actionButtonActive]}
              onPress={handlePeerRequest}
            >
              <Text style={styles.actionButtonText}>
                {isRequested ? 'Pending Request' : 'Request Peer'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleMessagePress}>
              <Text style={styles.actionButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic Profile Navigation Tabs */}
        <View style={styles.tabsHeaderBar}>
          <TouchableOpacity onPress={() => setActiveTab('Posts')} style={styles.tabItem}>
            <Text style={[styles.tabTitle, activeTab === 'Posts' && styles.activeTabTitle]}>
              Posts
            </Text>
            {activeTab === 'Posts' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setActiveTab('About')} style={styles.tabItem}>
            <Text style={[styles.tabTitle, activeTab === 'About' && styles.activeTabTitle]}>
              About {profile.displayName.split(' ')[0]}
            </Text>
            {activeTab === 'About' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setActiveTab('Preferences')} style={styles.tabItem}>
            <Text style={[styles.tabTitle, activeTab === 'Preferences' && styles.activeTabTitle]}>
              Preferences
            </Text>
            {activeTab === 'Preferences' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* Tab 1: Posts Tab Content */}
        {activeTab === 'Posts' && (
          <View style={styles.fullWidthTabArea}>
            {profile.posts.map((post) => (
              <View key={post.id} style={styles.fullWidthPostCard}>
                <View style={styles.postCardHeader}>
                  <Image source={{ uri: profile.avatarUrl }} style={styles.postAvatar} />
                  <View style={styles.postHeaderTexts}>
                    <Text style={styles.postAuthorName}>{profile.displayName}</Text>
                    <Text style={styles.postTimeText}>{post.time}</Text>
                  </View>
                </View>

                {/* Full Width Image Container */}
                <Image
                  source={{ uri: post.contentImage }}
                  style={styles.fullWidthPostImage}
                  resizeMode="cover"
                />
              </View>
            ))}
          </View>
        )}

        {/* Tab 2: About Tab Content */}
        {activeTab === 'About' && (
          <View style={styles.paddedTabArea}>
            {/* Field of Study & Academic Year */}
            <View style={styles.infoCard}>
              <Text style={styles.cardHeaderTitle}>Academic Information</Text>

              <View style={styles.infoRow}>
                <Ionicons name="book-outline" size={18} color={colors.primary} />
                <View style={styles.infoRowText}>
                  <Text style={styles.infoLabel}>Field of Study</Text>
                  <Text style={styles.infoValue}>{profile.about.fieldOfStudy}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="school-outline" size={18} color={colors.primary} />
                <View style={styles.infoRowText}>
                  <Text style={styles.infoLabel}>Academic Year</Text>
                  <Text style={styles.infoValue}>{profile.about.academicYear}</Text>
                </View>
              </View>
            </View>

            {/* Projects */}
            <View style={styles.infoCard}>
              <Text style={styles.cardHeaderTitle}>Projects</Text>
              {profile.about.projects.map((proj, idx) => (
                <View key={idx} style={styles.projectItem}>
                  <View style={styles.projectTitleRow}>
                    <Text style={styles.projectTitle}>{proj.title}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>{proj.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.projectDescription}>{proj.description}</Text>
                </View>
              ))}
            </View>

            {/* Achievements */}
            <View style={styles.infoCard}>
              <Text style={styles.cardHeaderTitle}>Achievements & Honors</Text>
              {profile.about.achievements.map((item, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Ionicons name="trophy-outline" size={16} color={colors.primary} />
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tab 3: Preferences Tab Content */}
        {activeTab === 'Preferences' && (
          <View style={styles.paddedTabArea}>
            {/* Favorite Reading / Books */}
            <View style={styles.infoCard}>
              <Text style={styles.cardHeaderTitle}>Preferred Reading</Text>
              {profile.preferences.favoriteBooks.map((book, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Ionicons name="bookmarks-outline" size={16} color={colors.primary} />
                  <Text style={styles.bulletText}>{book}</Text>
                </View>
              ))}
            </View>

            {/* Tech Stack & Interests */}
            <View style={styles.infoCard}>
              <Text style={styles.cardHeaderTitle}>Tech Stack & Interests</Text>
              <View style={styles.chipContainer}>
                {profile.preferences.techInterests.map((interest, idx) => (
                  <View key={idx} style={styles.chip}>
                    <Text style={styles.chipText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Associations & Communities */}
            <View style={styles.infoCard}>
              <Text style={styles.cardHeaderTitle}>Associations & Clubs</Text>
              {profile.preferences.associations.map((assoc, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Ionicons name="people-outline" size={16} color={colors.primary} />
                  <Text style={styles.bulletText}>{assoc}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  topNavTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 30,
  },
  bannerContainer: {
    width: '100%',
    height: 180,
    backgroundColor: colors.surfaceLight,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  profileHeaderSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  avatarContainer: {
    marginTop: -40,
    marginBottom: 8,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
  },
  userDetails: {
    marginTop: 2,
    marginBottom: 14,
  },
  displayName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  institution: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  courseLevel: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  actionButtonActive: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  tabsHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  tabItem: {
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabTitle: {
    color: colors.primary,
    fontWeight: '700',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
  },
  /* Full Width Tab Content (Posts) */
  fullWidthTabArea: {
    width: '100%',
  },
  fullWidthPostCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  postCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  postHeaderTexts: {
    flex: 1,
  },
  postAuthorName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  postTimeText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  fullWidthPostImage: {
    width: '100%',
    height: 280,
    backgroundColor: colors.surfaceLight,
  },
  /* Padded Tab Content (About & Preferences) */
  paddedTabArea: {
    paddingHorizontal: 16,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoRowText: {
    marginLeft: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  projectItem: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  projectTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 128, 96, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  projectDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bulletText: {
    fontSize: 13,
    color: colors.textPrimary,
    marginLeft: 8,
    flex: 1,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: 'rgba(0, 128, 96, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
});
