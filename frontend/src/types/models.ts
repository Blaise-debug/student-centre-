export type UserStatus = 'online' | 'offline' | 'away';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  status?: UserStatus;
  lastSeen?: string | null;
  isVerified?: boolean;
  onboardingComplete?: boolean;
  isDeleted?: boolean;
}

export interface AcademicProfile {
  id: string;
  country: string;
  institution: string;
  levelOfStudy: string;
  yearOfStudy: string;
  program: string;
  mainUnits: string[];
  commonUnits: string[];
  otherUnits: string[];
  activeUnit: string;
  shareCode: string;
}

export interface Conversation {
  id: string;
  participants: User[];
  isGroup: boolean;
  groupName?: string | null;
  groupAvatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastMessageAt?: string | null;
  lastMessage?: Message | null;
}

export interface MessageReplyPreview {
  id: string;
  content: string;
  sender: Pick<User, 'id' | 'username' | 'displayName'>;
}

export interface Message {
  id: string;
  _id?: string;
  conversation: string;
  sender: User;
  content: string;
  attachment?: string | null;
  attachmentUrl?: string | null;
  mediaUrl?: string | null;
  
attachmentType?: 'image' | 'video' | 'file' | 'audio' | null;
  readBy?: string[];
  deliveredTo?: string[];
  isDeleted?: boolean;
  isEdited?: boolean;
  replyTo?: MessageReplyPreview | null;
  deletedFor?: string[];
  createdAt?: string;
  updatedAt?: string;
}
