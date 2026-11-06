import { api } from './api';
import { Conversation, User } from '../types/models';

import { normalizeUser } from '../utils/normalize';


function normalizeConversation(raw: any): Conversation {
  const id = String(raw?.id ?? raw?._id ?? '');

  if (!id) {
    throw new Error('Invalid conversation: missing id');
  }

  return {
    id,
    participants: Array.isArray(raw.participants)
      ? raw.participants.map(normalizeUser)
      : [],
    isGroup: Boolean(raw.isGroup),
    groupName: raw.groupName ?? null,
    groupAvatarUrl: raw.groupAvatarUrl ?? null,
    lastMessage: raw.lastMessage
      ? {
          ...raw.lastMessage,
          id: String(raw.lastMessage.id ?? raw.lastMessage._id ?? ''),
          sender: raw.lastMessage.sender
            ? normalizeUser(raw.lastMessage.sender)
            : raw.lastMessage.sender,
        }
      : null,
    lastMessageAt: raw.lastMessageAt ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}


export async function fetchMyConversations(): Promise<Conversation[]> {
  const { data } = await api.get<{ conversations: any[] }>('/conversations');
  return data.conversations.map(normalizeConversation);
}

export async function createConversation(participantId: string): Promise<Conversation> {
  const { data } = await api.post<{ conversation: any }>('/conversations', {
    participantId,
  });
  return normalizeConversation(data.conversation);
}

export async function fetchConversationById(conversationId: string): Promise<Conversation> {
  const { data } = await api.get<{ conversation: any }>(
    `/conversations/${conversationId}`
  );
  return normalizeConversation(data.conversation);
}