import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = "http://localhost:5000";

// Helper function to get initials for avatar
const getInitials = (name = '') => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

export default function ChatWindow({ token, currentUser, friend, onClose, socket, onMessagesRead }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);
    
    const roomName = [currentUser.id, friend._id].sort().join('-');

    const authAxios = axios.create({
        baseURL: `${API_BASE}/api`,
        headers: { Authorization: `Bearer ${token}` },
    });

    useEffect(() => {
        if (!socket) return;
        
        authAxios.put(`/friends/read-messages/${friend._id}`).then(() => {
            if (onMessagesRead) {
                onMessagesRead();
            }
        });

        authAxios.get(`/friends/chat/${friend._id}`).then(res => {
            setMessages(res.data);
        });

        socket.emit('joinRoom', roomName);

        const messageListener = (message) => {
            setMessages(prevMessages => [...prevMessages, message]);
        };
        socket.on('receiveMessage', messageListener);

        return () => {
            socket.off('receiveMessage', messageListener);
        };
    }, [socket, friend._id, roomName, token, onMessagesRead]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !socket) return;
        
        const messageData = {
            fromUser: currentUser.id,
            toUser: friend._id,
            content: newMessage.trim(),
            roomName: roomName
        };

        socket.emit('sendMessage', messageData);
        setNewMessage('');
    };

    return (
        <div className="chat-window">
            <div className="chat-header">
                <div className="chat-header-info">
                    <div className="avatar">{getInitials(friend.username)}</div>
                    <div>
                        <h4>{friend.username}</h4>
                        <span className="chat-progress">{friend.dailyCompleted} tasks completed today</span>
                    </div>
                </div>
                <button onClick={onClose} className="btn-close">×</button>
            </div>
            <div className="chat-messages">
                {messages.map((msg) => (
                    <div key={msg._id} className={`message-group ${msg.fromUser === currentUser.id ? 'sent' : 'received'}`}>
                        <div className="message">
                            {msg.content}
                            <span className="message-timestamp">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="chat-form">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="input"
                />
                <button type="submit" className="btn-send">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </form>
        </div>
    );
}
