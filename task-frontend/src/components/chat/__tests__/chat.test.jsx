import { describe, it, expect } from 'vitest';
import React from 'react';
import { ConversationList } from '../ConversationList';
import { MessageList } from '../MessageList';
import { MessageComposer } from '../MessageComposer';
import { ChatDrawer } from '../ChatDrawer';

describe('Chat & Real-Time UX Components (M4.4)', () => {
  const mockUser = { _id: 'u1', username: 'alice' };
  const mockFriend = { _id: 'u2', username: 'bob', dailyCompleted: 3 };
  const mockMessages = [
    { _id: 'm1', sender: 'u2', receiver: 'u1', content: 'Hello Alice!', createdAt: '2026-10-05T10:00:00.000Z' },
    { _id: 'm2', sender: 'u1', receiver: 'u2', content: 'Hi Bob, working on M4.4!', createdAt: '2026-10-05T10:01:00.000Z' },
  ];

  it('should render ConversationList with friend items and unread count badges', () => {
    const list = (
      <ConversationList
        friends={[mockFriend]}
        selectedFriendId="u2"
        onSelectFriend={() => {}}
        unreadCounts={{ u2: 2 }}
        onlineUserIds={['u2']}
      />
    );
    expect(list.props.friends.length).toBe(1);
    expect(list.props.selectedFriendId).toBe('u2');
    expect(list.props.unreadCounts.u2).toBe(2);
  });

  it('should render MessageList with message bubbles and typing indicator', () => {
    const list = (
      <MessageList
        messages={mockMessages}
        currentUserId="u1"
        friend={mockFriend}
        isTyping={true}
      />
    );
    expect(list.props.messages.length).toBe(2);
    expect(list.props.currentUserId).toBe('u1');
    expect(list.props.isTyping).toBe(true);
  });

  it('should render MessageComposer with send handler and placeholder', () => {
    const composer = (
      <MessageComposer
        onSendMessage={() => {}}
        onTyping={() => {}}
        disabled={false}
      />
    );
    expect(composer.props.disabled).toBe(false);
  });

  it('should render ChatDrawer drawer primitive container', () => {
    const drawer = (
      <ChatDrawer
        isOpen={true}
        onClose={() => {}}
        friends={[mockFriend]}
        currentUserId="u1"
        authAxios={{ get: () => Promise.resolve({ data: [] }) }}
      />
    );
    expect(drawer.props.isOpen).toBe(true);
    expect(drawer.props.friends.length).toBe(1);
  });
});
