import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Drawer } from '../ui/Drawer';
import { ConversationList } from './ConversationList';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { MessageSearchInput } from './MessageSearchInput';
import { Button } from '../ui/Button';
import { BACKEND_URL } from '../../config';

/**
 * ChatDrawer Component (M4.4)
 * Main Chat Container using M4.1 Drawer primitive & Socket.IO real-time updates
 */
export const ChatDrawer = ({
  isOpen,
  onClose,
  token,
  currentUser,
  socket,
  apiBase = BACKEND_URL,
  initialFriend = null,
  notifications = [],
  onMessagesRead,
}) => {
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(initialFriend);
  const [messages, setMessages] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const authAxios = axios.create({
    baseURL: `${apiBase}/api`,
    headers: { Authorization: `Bearer ${token}` },
  });

  // Fetch Friends / Conversations list
  useEffect(() => {
    if (!isOpen || !token) return;

    const fetchFriends = async () => {
      setLoadingFriends(true);
      try {
        const [friendsRes, progressRes] = await Promise.all([
          authAxios.get('/friends'),
          authAxios.get('/friends/progress'),
        ]);

        const rawFriends = friendsRes.data.friends || [];
        const progressList = progressRes.data || [];

        const merged = rawFriends.map((f) => {
          const p = progressList.find((prog) => (prog._id || prog.id) === (f.user?._id || f.user));
          return {
            ...f,
            dailyCompleted: p ? p.dailyCompleted : 0,
          };
        });

        setFriends(merged);
      } catch (err) {
        console.error('Failed to fetch chat friends:', err);
      } finally {
        setLoadingFriends(false);
      }
    };

    fetchFriends();
  }, [isOpen, token]);

  useEffect(() => {
    if (initialFriend) {
      setSelectedFriend(initialFriend);
    }
  }, [initialFriend]);

  // Load chat messages when a friend is selected
  useEffect(() => {
    if (!selectedFriend || !currentUser || !token) return;

    const friendId = selectedFriend._id || selectedFriend.id;
    const roomName = [currentUser.id || currentUser._id, friendId].sort().join('-');

    setLoadingMessages(true);

    // Mark read
    authAxios.put(`/friends/read-messages/${friendId}`).then(() => {
      if (onMessagesRead) onMessagesRead();
    });

    // Fetch message history
    authAxios.get(`/friends/chat/${friendId}`).then((res) => {
      setMessages(res.data || []);
      setLoadingMessages(false);
    });

    // Join Socket room
    if (socket) {
      socket.emit('joinRoom', roomName);

      const messageListener = (msg) => {
        setMessages((prev) => [...prev, msg]);
      };

      const typingListener = (data) => {
        if (data.userId === friendId) {
          setIsTyping(Boolean(data.isTyping));
        }
      };

      socket.on('receiveMessage', messageListener);
      socket.on('userTyping', typingListener);

      return () => {
        socket.off('receiveMessage', messageListener);
        socket.off('userTyping', typingListener);
      };
    }
  }, [selectedFriend, currentUser, token, socket]);

  // Send message
  const handleSendMessage = (content) => {
    if (!selectedFriend || !currentUser || !socket) return;

    const friendId = selectedFriend._id || selectedFriend.id;
    const roomName = [currentUser.id || currentUser._id, friendId].sort().join('-');

    const messageData = {
      fromUser: currentUser.id || currentUser._id,
      toUser: friendId,
      content,
      roomName,
    };

    socket.emit('sendMessage', messageData);
  };

  // Typing event
  const handleTyping = (typingState) => {
    if (!selectedFriend || !currentUser || !socket) return;
    const friendId = selectedFriend._id || selectedFriend.id;
    const roomName = [currentUser.id || currentUser._id, friendId].sort().join('-');

    socket.emit('typing', {
      roomName,
      userId: currentUser.id || currentUser._id,
      isTyping: typingState,
    });
  };

  const handleSelectSearchResult = (result) => {
    const currentId = currentUser?.id || currentUser?._id;
    const friendUser = (result.fromUser?._id === currentId || result.fromUser === currentId)
      ? result.toUser
      : result.fromUser;

    if (friendUser) {
      const targetId = friendUser._id || friendUser;
      const friendObj = friends.find((f) => (f.user?._id || f.user) === targetId);
      if (friendObj) {
        setSelectedFriend(friendObj.user || friendObj);
      } else {
        setSelectedFriend({
          _id: targetId,
          username: friendUser.username || 'Friend',
        });
      }
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      position="right"
      title={selectedFriend ? `Chat with ${selectedFriend.username}` : '💬 Messages & Chat'}
      size="420px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '-1rem' }}>
        {/* Global Message Search Bar */}
        <MessageSearchInput
          authAxios={authAxios}
          onSelectResult={handleSelectSearchResult}
          activeFriendId={selectedFriend?._id || selectedFriend?.id}
        />

        {selectedFriend ? (
          <React.Fragment>
            {/* Sub-header to switch back to conversation list */}
            <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFriend(null)}>
                ← All Conversations
              </Button>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {selectedFriend.username}
              </span>
            </div>

            <MessageList
              messages={messages}
              currentUserId={currentUser?.id || currentUser?._id}
              friend={selectedFriend}
              isTyping={isTyping}
              loading={loadingMessages}
            />

            <MessageComposer onSendMessage={handleSendMessage} onTyping={handleTyping} />
          </React.Fragment>
        ) : (
          <div style={{ padding: '1rem', overflowY: 'auto', flexGrow: 1 }}>
            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
              Active Conversations
            </h4>

            <ConversationList
              friends={friends}
              activeFriendId={selectedFriend?._id}
              onSelectFriend={(f) => setSelectedFriend(f)}
              loading={loadingFriends}
              notifications={notifications}
            />
          </div>
        )}
      </div>
    </Drawer>
  );
};
