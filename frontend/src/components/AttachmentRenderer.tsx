import React from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AttachmentProps {
  baseUrl: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'file' | string;
  isMyMessage: boolean;
}

export const AttachmentRenderer: React.FC<AttachmentProps> = ({
  baseUrl,
  attachmentUrl,
  attachmentType,
  isMyMessage,
}) => {
  if (!attachmentUrl) return null;

  // Ensure absolute URL construction
  const fullUrl = attachmentUrl.startsWith('http')
    ? attachmentUrl
    : `${baseUrl}${attachmentUrl.startsWith('/') ? '' : '/'}${attachmentUrl}`;

  const isImage =
    attachmentType === 'image' ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(attachmentUrl);

  const handleOpenDocument = () => {
    Linking.openURL(fullUrl).catch((err) =>
      console.error('Could not open document link:', err)
    );
  };

  if (isImage) {
    return (
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: fullUrl }}
          style={styles.attachmentImage}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Document/File Attachment
  const fileName =
    attachmentUrl.split('/').pop() || 'Attachment Document';

  return (
    <TouchableOpacity
      style={[
        styles.fileContainer,
        isMyMessage
          ? styles.myFileContainer
          : styles.theirFileContainer,
      ]}
      onPress={handleOpenDocument}
      activeOpacity={0.8}
    >
      <Ionicons
        name="document-attach-outline"
        size={24}
        color={isMyMessage ? '#FFF' : '#333'}
      />

      <View style={styles.fileInfo}>
        <Text
          numberOfLines={1}
          style={[
            styles.fileNameText,
            isMyMessage ? styles.myText : styles.theirText,
          ]}
        >
          {fileName}
        </Text>

        <Text
          style={[
            styles.fileActionText,
            isMyMessage
              ? styles.mySubText
              : styles.theirSubText,
          ]}
        >
          Tap to view file
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },

  attachmentImage: {
    width: 220,
    height: 180,
    borderRadius: 12,
  },

  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    maxWidth: 280,
  },

  myFileContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  theirFileContainer: {
    backgroundColor: '#F0F0F0',
  },

  fileInfo: {
    flex: 1,
    marginLeft: 10,
  },

  fileNameText: {
    fontSize: 14,
    fontWeight: '600',
  },

  fileActionText: {
    fontSize: 12,
    marginTop: 3,
  },

  myText: {
    color: '#FFF',
  },

  theirText: {
    color: '#333',
  },

  mySubText: {
    color: 'rgba(255, 255, 255, 0.75)',
  },

  theirSubText: {
    color: '#777',
  },
});