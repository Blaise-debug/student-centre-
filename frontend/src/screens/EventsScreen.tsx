// src/screens/LiveEventsScreen.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export interface Consultant {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
}

export interface EventItem {
  id: string;
  title: string;
  status: 'View' | 'Join' | 'Completed' | 'Ongoing';
  day: string;
  time: string;
  type: 'general' | 'personal';
  host?: string;
  venue?: string;
  thumbnail?: string;
  consultants?: Consultant[];
}

export const initialEvents: EventItem[] = [
  {
    id: '1',
    title: 'BCS 214',
    status: 'View',
    day: 'Tomorrow',
    time: '3:00 pm',
    type: 'general',
    host: 'Andrew Shitote',
    venue: 'ICT Lab (I) / Online',
    thumbnail:
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80',
    consultants: [
      {
        id: 'c1',
        name: 'Blaise Stephen',
        username: '@blaiseadmin_01',
        avatar:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
      },
      {
        id: 'c2',
        name: 'Hillan Ronoh',
        username: '@hillan',
      },
      {
        id: 'c3',
        name: 'Dalton Fredrick',
        username: '@dalton',
      },
    ],
  },
  {
    id: '2',
    title: 'BIT 210',
    status: 'View',
    day: 'Tomorrow',
    time: '8:00 am',
    type: 'general',
    host: 'Dr. Jane Doe',
    venue: 'Lab 2',
    thumbnail:
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80',
    consultants: [
      {
        id: 'c4',
        name: 'Alice Smith',
        username: '@alice',
      },
    ],
  },
  {
    id: '3',
    title: 'Bible Study',
    status: 'View',
    day: 'Today',
    time: '2:30 pm',
    type: 'general',
    host: 'Pastor John',
    venue: 'Main Hall',
    thumbnail:
      'https://images.unsplash.com/photo-1438032005730-c779502df395?w=600&auto=format&fit=crop&q=80',
    consultants: [
      {
        id: 'c5',
        name: 'Mark B.',
        username: '@mark',
      },
    ],
  },
  {
    id: '4',
    title: 'Innovation Club',
    status: 'Ongoing',
    day: '',
    time: 'Ongoing',
    type: 'general',
    host: 'Tech Lead',
    venue: 'Hub Room',
    consultants: [
      {
        id: 'c6',
        name: 'Maxwell W.',
        username: '@maxwell',
      },
    ]
  },
  {
    id: '5',
    title: 'MAT 201',
    status: 'Completed',
    day: 'Yesterday',
    time: '2:00 pm',
    type: 'general',
    host: 'Prof. Newton',
    venue: 'Room 402',
    consultants: [
      {
        id: 'c7',
        name: 'Derek B.',
        username: '@derek',
      },
    ]
  },
  {
    id: '6',
    title: 'MAT 201',
    status: 'Completed',
    day: 'Yesterday',
    time: '10:00 am',
    type: 'general',
    host: 'Prof. Newton',
    venue: 'Room 402',
    consultants: [
      {
        id: 'c8',
        name: 'Agness N.',
        username: '@agness',
      },
    ]
  },
  {
    id: '7',
    title: 'Personal Study',
    status: 'View',
    day: 'Today',
    time: '6:00 pm',
    type: 'personal',
    host: 'Self',
    venue: 'Library',
    consultants: [
      {
        id: 'c9',
        name: 'Billiah W.',
        username: '@billiah',
      },
    ]
  },
  {
    id: '8',
    title: 'Assignment 1',
    status: 'Completed',
    day: 'Yesterday',
    time: '4:00 pm',
    type: 'personal',
    host: 'Self',
    venue: 'Dorm',
    consultants: [
      {
        id: 'c10',
        name: 'Beatrice C.',
        username: '@beaterice',
      },
    ],
  
  },
];

export function EventDetailModal({
  visible,
  onClose,
  selectedEvent,
  navigation,
}: {
  visible: boolean;
  onClose: () => void;
  selectedEvent: EventItem | null;
  navigation: any;
}) {
  const handleMessageConsultant = (consultant: Consultant) => {
    onClose();

    const identifier = consultant.id.startsWith('c')
      ? consultant.username
        ? consultant.username.replace('@', '')
        : consultant.name
      : consultant.id;

    const rootNavigation = navigation.getParent() || navigation;

    rootNavigation.navigate('ChatModal', {
      conversationId: identifier,
      conversationName: consultant.name,
    });
  };

  if (!selectedEvent) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.fullScreenModalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitleText}>
            {selectedEvent.title}
          </Text>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons
              name="close"
              size={26}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.modalBodyScroll}
          showsVerticalScrollIndicator={false}
        >
          {selectedEvent.thumbnail ? (
            <View style={styles.thumbnailContainer}>
              <Image
                source={{ uri: selectedEvent.thumbnail }}
                style={styles.thumbnailImage}
              />
            </View>
          ) : null}

          <View style={styles.eventDetailsBox}>
            <Text style={styles.detailText}>
              <Text style={styles.boldLabel}>Host :</Text>{' '}
              {selectedEvent.host || 'N/A'}
            </Text>

            <Text style={styles.detailText}>
              <Text style={styles.boldLabel}>Venue :</Text>{' '}
              {selectedEvent.venue || 'N/A'}
            </Text>

            <Text style={styles.detailText}>
              <Text style={styles.boldLabel}>Time :</Text>{' '}
              {selectedEvent.time}
            </Text>
          </View>

          <Text style={styles.consultantsHeader}>
            Consultants
          </Text>

          {selectedEvent.consultants &&
          selectedEvent.consultants.length > 0 ? (
            selectedEvent.consultants.map((consultant) => (
              <View
                key={consultant.id}
                style={styles.consultantRow}
              >
                <Text style={styles.consultantName}>
                  {consultant.name}
                </Text>

                <View style={styles.consultantActions}>
                  <TouchableOpacity
                    style={styles.consultantIconButton}
                  >
                    <Ionicons
                      name="call-outline"
                      size={22}
                      color={colors.textPrimary}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.consultantIconButton}
                    onPress={() =>
                      handleMessageConsultant(consultant)
                    }
                  >
                    <Ionicons
                      name="chatbox-outline"
                      size={22}
                      color={colors.textPrimary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noConsultantsText}>
              No consultants assigned.
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function EventsScreen({
  navigation,
}: {
  navigation: any;
}) {
  const [activeTab, setActiveTab] = useState<
    'general' | 'personal'
  >('general');

  const [events] = useState<EventItem[]>(initialEvents);

  const [selectedEvent, setSelectedEvent] =
    useState<EventItem | null>(null);

  const [modalVisible, setModalVisible] = useState(false);

  const filteredEvents = events.filter(
    (item) => item.type === activeTab
  );

  const handleOpenEvent = (item: EventItem) => {
    setSelectedEvent(item);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              }
            }}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={colors.textPrimary}
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Live Class and Events
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setActiveTab('general')}
          style={styles.tabButton}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'general' &&
                styles.activeTabText,
            ]}
          >
            General
          </Text>

          {activeTab === 'general' && (
            <View style={styles.activeTabIndicator} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('personal')}
          style={styles.tabButton}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'personal' &&
                styles.activeTabText,
            ]}
          >
            Personal Events
          </Text>

          {activeTab === 'personal' && (
            <View style={styles.activeTabIndicator} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tabBorder} />

      {/* Event List */}
      <ScrollView
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      >
        {filteredEvents.map((item) => {
          /*
           * Derive the badge styles directly from the event status.
           *
           * This prevents TypeScript from narrowing badgeTextStyle
           * to the first style assigned to it. In particular,
           * joinBadgeText intentionally uses fontWeight "700",
           * while the other badge text styles use "600".
           */
          const badgeStyle =
            item.status === 'Join' ||
            item.status === 'Ongoing'
              ? styles.joinBadge
              : item.status === 'Completed'
                ? styles.completedBadge
                : styles.viewBadge;

          const badgeTextStyle =
            item.status === 'Join' ||
            item.status === 'Ongoing'
              ? styles.joinBadgeText
              : item.status === 'Completed'
                ? styles.completedBadgeText
                : styles.viewBadgeText;

          return (
            <View
              key={item.id}
              style={styles.eventRow}
            >
              <Text
                style={styles.eventTitle}
                numberOfLines={1}
              >
                {item.title}
              </Text>

              <View style={styles.eventRightSection}>
                <TouchableOpacity
                  style={[
                    styles.badgeBase,
                    badgeStyle,
                  ]}
                  onPress={() => handleOpenEvent(item)}
                >
                  <Text style={badgeTextStyle}>
                    {item.status}
                  </Text>
                </TouchableOpacity>

                <View style={styles.timeContainer}>
                  <Text style={styles.eventDay}>
                    {item.day}
                  </Text>

                  <Text style={styles.eventTime}>
                    {item.time}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.dotsButton}
                >
                  <Ionicons
                    name="ellipsis-vertical"
                    size={16}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Floating Create Button */}
      <View style={styles.floatingContainer}>
        <TouchableOpacity style={styles.createButton}>
          <Ionicons
            name="add"
            size={20}
            color="#fff"
          />
        </TouchableOpacity>

        <Text style={styles.newText}>
          New
        </Text>
      </View>

      <EventDetailModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        selectedEvent={selectedEvent}
        navigation={navigation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 16,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  backButton: {
    marginRight: 10,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconButton: {
    padding: 4,
  },

  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },

  tabButton: {
    marginRight: 24,
    paddingVertical: 6,
  },

  tabText: {
    fontSize: 16,
    color: '#7A9A7E',
    fontWeight: '600',
  },

  activeTabText: {
    color: '#2E5A36',
  },

  activeTabIndicator: {
    height: 2,
    backgroundColor: '#2E5A36',
    marginTop: 4,
    borderRadius: 1,
  },

  tabBorder: {
    height: 1,
    backgroundColor: '#D1E0D3',
    width: '100%',
    marginTop: 4,
    marginBottom: 8,
  },

  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },

  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2ECE3',
  },

  eventTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },

  eventRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  badgeBase: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 85,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  viewBadge: {
    backgroundColor: '#439A62',
  },

  viewBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  joinBadge: {
    backgroundColor: '#FFE600',
  },

  joinBadgeText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },

  completedBadge: {
    backgroundColor: '#7DB28C',
  },

  completedBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  timeContainer: {
    alignItems: 'flex-end',
    minWidth: 70,
    marginRight: 8,
  },

  eventDay: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },

  eventTime: {
    fontSize: 12,
    color: '#666',
  },

  dotsButton: {
    padding: 6,
  },

  floatingContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },

  createButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E8E3E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    elevation: 4,
  },

  newText: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: '#DCE8D8',
    paddingTop: 48,
    paddingHorizontal: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  modalTitleText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  closeButton: {
    padding: 4,
  },

  modalBodyScroll: {
    paddingBottom: 40,
  },

  thumbnailContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },

  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  eventDetailsBox: {
    marginBottom: 24,
  },

  detailText: {
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 8,
  },

  boldLabel: {
    fontWeight: '700',
  },

  consultantsHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },

  consultantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 4,
  },

  consultantName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },

  consultantActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  consultantIconButton: {
    marginLeft: 20,
    padding: 6,
  },

  noConsultantsText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});