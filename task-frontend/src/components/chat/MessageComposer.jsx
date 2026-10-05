import React, { useState, useRef, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

/**
 * MessageComposer Component (M4.4)
 * Accessible text input with Socket.IO typing indicators and send controls
 */
export const MessageComposer = ({
  onSendMessage,
  onTyping,
  disabled = false,
  placeholder = 'Type a message...',
}) => {
  const [content, setContent] = useState('');
  const typingTimerRef = useRef(null);

  const handleTextChange = (e) => {
    const text = e.target.value;
    setContent(text);

    if (onTyping) {
      onTyping(true);

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }

      typingTimerRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!content.trim() || disabled) return;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    if (onTyping) onTyping(false);

    onSendMessage(content.trim());
    setContent('');
  };

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  return (
    <form
      onSubmit={handleFormSubmit}
      className="message-composer-form"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      <Input
        value={content}
        onChange={handleTextChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Message content"
        style={{ minHeight: '44px', flexGrow: 1 }}
      />
      <Button
        variant="primary"
        type="submit"
        disabled={!content.trim() || disabled}
        aria-label="Send chat message"
        style={{ minWidth: '44px', height: '44px' }}
      >
        Send 🚀
      </Button>
    </form>
  );
};
