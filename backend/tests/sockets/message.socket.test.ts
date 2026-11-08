import assert from 'node:assert/strict';
import test from 'node:test';
import type { Server } from 'socket.io';
import type { AuthenticatedSocket } from '../../src/sockets/socketAuth.middleware';
import { registerMessageHandlers } from '../../src/sockets/message.socket';

const conversationId = '507f1f77bcf86cd799439011';
const userId = '507f191e810c19729de860ea';

type EventHandler = (...args: any[]) => unknown;

interface EmittedEvent {
  room: string;
  event: string;
  payload: unknown;
}

function createHarness(isParticipant: boolean) {
  const handlers = new Map<string, EventHandler>();
  const emitted: EmittedEvent[] = [];
  const joins: string[] = [];
  const leaves: string[] = [];
  const readUpdates: Array<{ conversationId: string; userId: string }> = [];

  const socket = {
    userId,
    on(event: string, handler: EventHandler) {
      handlers.set(event, handler);
      return this;
    },
    async join(room: string) {
      joins.push(room);
    },
    async leave(room: string) {
      leaves.push(room);
    },
    to(room: string) {
      return {
        emit(event: string, payload: unknown) {
          emitted.push({ room, event, payload });
        },
      };
    },
  } as unknown as AuthenticatedSocket;

  const io = {
    to(room: string) {
      return {
        emit(event: string, payload: unknown) {
          emitted.push({ room, event, payload });
        },
      };
    },
  } as unknown as Server;

  registerMessageHandlers(io, socket, {
    async isConversationParticipant(requestedConversationId, requestedUserId) {
      assert.equal(requestedConversationId, conversationId);
      assert.equal(requestedUserId, userId);
      return isParticipant;
    },
    async markMessagesRead(requestedConversationId, requestedUserId) {
      readUpdates.push({
        conversationId: requestedConversationId,
        userId: requestedUserId,
      });
    },
  });

  return {
    emitted,
    joins,
    leaves,
    readUpdates,
    async trigger(event: string, ...args: unknown[]) {
      const handler = handlers.get(event);
      assert.ok(handler, `Expected ${event} handler to be registered`);
      await handler(...args);
    },
  };
}

test('conversation:join rejects non-members without joining the room', async () => {
  const harness = createHarness(false);
  const acknowledgements: Array<{ success?: true; error?: string }> = [];

  await harness.trigger('conversation:join', conversationId, (result: { success?: true; error?: string }) => {
    acknowledgements.push(result);
  });

  assert.deepEqual(harness.joins, []);
  assert.deepEqual(acknowledgements, [{ error: 'Conversation not found' }]);
});

test('conversation:join admits a verified participant', async () => {
  const harness = createHarness(true);
  const acknowledgements: Array<{ success?: true; error?: string }> = [];

  await harness.trigger('conversation:join', conversationId, (result: { success?: true; error?: string }) => {
    acknowledgements.push(result);
  });

  assert.deepEqual(harness.joins, [`conversation:${conversationId}`]);
  assert.deepEqual(acknowledgements, [{ success: true }]);
});

test('conversation:join rejects malformed IDs before checking membership', async () => {
  const harness = createHarness(true);
  const acknowledgements: Array<{ success?: true; error?: string }> = [];

  await harness.trigger('conversation:join', { id: conversationId }, (result: { success?: true; error?: string }) => {
    acknowledgements.push(result);
  });

  assert.deepEqual(harness.joins, []);
  assert.deepEqual(acknowledgements, [{ error: 'Invalid conversation ID' }]);
});

test('typing events reject non-members and malformed payloads without broadcasting', async () => {
  const harness = createHarness(false);
  const acknowledgements: Array<{ success?: true; error?: string }> = [];

  await harness.trigger('typing:start', { conversationId }, (result: { success?: true; error?: string }) => {
    acknowledgements.push(result);
  });
  await harness.trigger('typing:stop', { conversationId: 42 }, (result: { success?: true; error?: string }) => {
    acknowledgements.push(result);
  });

  assert.deepEqual(harness.emitted, []);
  assert.deepEqual(acknowledgements, [
    { error: 'Conversation not found' },
    { error: 'Invalid conversation ID' },
  ]);
});

test('message:read rejects non-members without updating or broadcasting', async () => {
  const harness = createHarness(false);
  const acknowledgements: Array<{ success?: true; error?: string }> = [];

  await harness.trigger('message:read', { conversationId }, (result: { success?: true; error?: string }) => {
    acknowledgements.push(result);
  });

  assert.deepEqual(harness.readUpdates, []);
  assert.deepEqual(harness.emitted, []);
  assert.deepEqual(acknowledgements, [{ error: 'Conversation not found' }]);
});

test('message:read updates and broadcasts only for a participant', async () => {
  const harness = createHarness(true);
  const acknowledgements: Array<{ success?: true; error?: string }> = [];

  await harness.trigger('message:read', { conversationId }, (result: { success?: true; error?: string }) => {
    acknowledgements.push(result);
  });

  assert.deepEqual(harness.readUpdates, [{ conversationId, userId }]);
  assert.deepEqual(harness.emitted, [
    {
      room: `conversation:${conversationId}`,
      event: 'message:read:update',
      payload: { conversationId, readerId: userId },
    },
  ]);
  assert.deepEqual(acknowledgements, [{ success: true }]);
});

test('message:delete rejects non-members before accessing messages', async () => {
  const harness = createHarness(false);
  const acknowledgements: Array<{ success?: true; error?: string }> = [];

  await harness.trigger(
    'message:delete',
    { conversationId, messageIds: ['507f1f77bcf86cd799439012'], mode: 'me' },
    (result: { success?: true; error?: string }) => {
      acknowledgements.push(result);
    }
  );

  assert.deepEqual(acknowledgements, [{ error: 'Conversation not found' }]);
});

test('conversation:leave clears a stale room after membership is revoked', async () => {
  const harness = createHarness(false);
  const acknowledgements: Array<{ success?: true; error?: string }> = [];

  await harness.trigger('conversation:leave', conversationId, (result: { success?: true; error?: string }) => {
    acknowledgements.push(result);
  });

  assert.deepEqual(harness.leaves, [`conversation:${conversationId}`]);
  assert.deepEqual(acknowledgements, [{ error: 'Conversation not found' }]);
});
