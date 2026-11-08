import { api } from './api';
import { Message } from '../types/models';
import { normalizeUser } from '../utils/normalize';

function normalizeMessage(raw: any): Message {
  const id = String(raw._id ?? raw.id ?? '');
  return {
    ...raw,
    id,
    _id: id,
    sender: normalizeUser(raw.sender),
    replyTo: raw.replyTo
      ? {
          id: raw.replyTo._id ?? raw.replyTo.id,
          content: raw.replyTo.content,
          sender: normalizeUser(raw.replyTo.sender),
        }
      : null,
  };
}

export async function fetchMessages(
  conversationId: string,
  before?: string
): Promise<Message[]> {
  const { data } = await api.get<{ messages: any[] }>(
    `/messages/${conversationId}`,
    { params: before ? { before } : {} }
  );
  return data.messages.map(normalizeMessage);
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await api.patch(`/messages/${conversationId}/read`);
}

export { normalizeMessage };
