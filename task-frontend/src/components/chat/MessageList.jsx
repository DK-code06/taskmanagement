import React, { useRef, useEffect } from 'react';
import { Avatar } from '../ui/Avatar';
import { Spinner } from '../ui/Spinner';

/**
 * MessageList Component (M4.4)
 * Renders chronological chat messages, sender badges, timestamps, and typing indicators
 */
export const MessageList = ({
  messages = [],
  currentUserId,
  friend,
  isTyping = false,
  loading = false,
}) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '2rem' }}>
        <Spinner size="lg" label="Loading messages..." />
      </div>
    );
  }

  return (
    <div
      className="message-list-container"
      style={{
        flexGrow: 1,
        padding: '1rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        backgroundColor: 'var(--color-bg-subtle)',
      }}
    >
      {messages.length === 0 ? (
        <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          No messages yet. Say hello to {friend?.username || 'your friend'}! 👋
        </div>
      ) : (
        messages.map((msg, idx) => {
          const isSentByMe = (msg.fromUser?._id || msg.fromUser) === currentUserId;
          const formattedTime = msg.createdAt
            ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';

          return (
            <div
              key={msg._id || idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isSentByMe ? 'flex-end' : 'flex-start',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '0.5rem',
                  maxWidth: '80%',
                  flexDirection: isSentByMe ? 'row-reverse' : 'row',
                }}
              >
                {!isSentByMe && <Avatar name={friend?.username} size="sm" />}

                <div
                  style={{
                    backgroundColor: isSentByMe ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: isSentByMe ? '#ffffff' : 'var(--color-text-primary)',
                    padding: '0.625rem 0.875rem',
                    borderRadius: isSentByMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    boxShadow: 'var(--shadow-subtle)',
                    fontSize: 'var(--font-size-sm)',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--font-size-xs)',
                      opacity: 0.75,
                      marginTop: '0.25rem',
                      textAlign: 'right',
                    }}
                  >
                    {formattedTime}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Typing Indicator Announcement */}
      {isTyping && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <Avatar name={friend?.username} size="sm" />
          <span>{friend?.username || 'Friend'} is typing...</span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
