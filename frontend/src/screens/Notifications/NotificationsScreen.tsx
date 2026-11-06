import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Image,
  SafeAreaView,
  Modal,
  StatusBar,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Color Palette Constants
const COLORS = {
  primary: '#2E7D32', // Theme Primary Green
  background: '#E8F5E9', // Light pastel background matching screenshot
  white: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E0E0E0',
  danger: '#EF4444',
};

// Notification Interface
export interface NotificationItem {
  id: string;
  type: 'message' | 'peer_request' | 'event';
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  eventIcon?: keyof typeof Ionicons.glyphMap;
}

// Initial Sample Data
const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    type: 'message',
    title: 'Chris Namusasi',
    subtitle: 'Hello Steve, how are you....',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: '2',
    type: 'message',
    title: 'Mike Desagu',
    subtitle: "Hey bro, what's up man you've...",
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: '3',
    type: 'message',
    title: 'Lameck Jack',
    subtitle: 'Do you still remember the prayer day when you...',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: '4',
    type: 'message',
    title: 'Etsy Mitchell',
    subtitle: "Morning, it's been long hope you're doing well",
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: '5',
    type: 'message',
    title: 'Leyla Aketch',
    subtitle: "I'm having a social challenge, please find some time...",
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: '6',
    type: 'message',
    title: 'Bravin Kariuki',
    subtitle: "Hey Steve, what's up man you've...",
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: '7',
    type: 'peer_request',
    title: 'Alex Johnson',
    subtitle: 'Requested to connect with you',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: '8',
    type: 'event',
    title: 'Computer Science Lecture',
    subtitle: 'Starts today at 2:00 PM in Hall B',
    eventIcon: 'calendar-outline',
  },
];

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  // Open context menu for deletion
  const handleOpenOptions = (item: NotificationItem) => {
    setSelectedItem(item);
    setDeleteModalVisible(true);
  };

  // Perform delete action
  const handleDeleteNotification = () => {
    if (selectedItem) {
      setNotifications((prev) => prev.filter((item) => item.id !== selectedItem.id));
      setDeleteModalVisible(false);
      setSelectedItem(null);
    }
  };

  // Render Individual Notification Item
  const renderItem = ({ item }: { item: NotificationItem }) => {
    return (
      <View style={styles.notificationItem}>
        {/* Left Side: Avatar or Event Icon */}
        {item.type === 'event' ? (
          <TouchableOpacity style={styles.eventIconContainer} activeOpacity={0.8}>
            <Ionicons name={item.eventIcon || 'calendar'} size={24} color={COLORS.white} />
          </TouchableOpacity>
        ) : (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        )}

        {/* Middle Content */}
        <View style={styles.contentContainer}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text style={styles.itemSubtitle} numberOfLines={2}>
              {item.subtitle}
            </Text>
          ) : null}

          {/* Peer Request Accept Action Button */}
          {item.type === 'peer_request' && (
            <TouchableOpacity style={styles.acceptButton} activeOpacity={0.8}>
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Right Side: Options Menu */}
        <TouchableOpacity
          style={styles.moreOptionsButton}
          onPress={() => handleOpenOptions(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No notifications remaining</Text>
          </View>
        }
      />

      {/* Delete Confirmation Custom Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDeleteModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Delete Notification</Text>
                <Text style={styles.modalDescription}>
                  Are you sure you want to remove this notification?
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setDeleteModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.deleteButton]}
                    onPress={handleDeleteNotification}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingVertical: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.border,
  },
  eventIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  acceptButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  acceptButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  moreOptionsButton: {
    padding: 6,
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
  },
  deleteButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
});
