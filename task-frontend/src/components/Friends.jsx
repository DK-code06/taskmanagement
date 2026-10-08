import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

export default function Friends({ token, onChat, notifications = [], refreshKey }) {
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [progress, setProgress] = useState([]);
    const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'requests', 'add'
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sendingId, setSendingId] = useState(null);

    const authAxios = axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
    });

    const fetchData = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const friendsRes = await authAxios.get('/friends').catch(() => ({ data: { friends: [], pendingRequests: [] } }));
            const progressRes = await authAxios.get('/friends/progress').catch(() => ({ data: [] }));

            setFriends(friendsRes.data?.friends || []);
            setRequests(friendsRes.data?.pendingRequests || []);
            setProgress(progressRes.data || []);
        } catch (err) {
            console.error("Failed to fetch friends data", err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchData();
    }, [fetchData, refreshKey]);

    useEffect(() => {
        if (searchQuery.trim().length > 1) {
            const delayDebounce = setTimeout(async () => {
                try {
                    const res = await authAxios.get(`/friends/search?query=${encodeURIComponent(searchQuery.trim())}`);
                    setSearchResults(res.data || []);
                } catch (error) {
                    console.error("Failed to search for users:", error);
                }
            }, 300);
            return () => clearTimeout(delayDebounce);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    const handleSendRequest = async (userId) => {
        setSendingId(userId);
        try {
            await authAxios.post(`/friends/request/${userId}`);
            setSearchQuery('');
            setSearchResults([]);
            fetchData();
            alert("Friend request sent! ✨");
        } catch (error) {
            alert(error.response?.data?.error || "Failed to send request.");
        } finally {
            setSendingId(null);
        }
    };

    const handleAcceptRequest = async (userId) => {
        try {
            await authAxios.put(`/friends/accept/${userId}`);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.error || "Failed to accept request.");
        }
    };

    const friendsWithProgress = friends.map(friend => {
        const friendUser = friend.user || {};
        const p = progress.find(prog => prog._id === friendUser._id);
        return {
            ...friendUser,
            unreadCount: friend.unreadCount || 0,
            dailyCompleted: p ? p.dailyCompleted : 0
        };
    });

    return (
        <div className="friends-card-container">
            {/* Header & Tabs */}
            <div className="friends-header">
                <h3 className="friends-title">👥 Community & Friends</h3>
                <div className="friends-tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
                        onClick={() => setActiveTab('friends')}
                    >
                        Friends ({friends.length})
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                        onClick={() => setActiveTab('requests')}
                    >
                        Requests
                        {requests.length > 0 && <span className="tab-badge">{requests.length}</span>}
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
                        onClick={() => setActiveTab('add')}
                    >
                        ➕ Add
                    </button>
                </div>
            </div>

            {/* Tab 1: Friends List */}
            {activeTab === 'friends' && (
                <div className="friends-tab-content">
                    {friendsWithProgress.length === 0 ? (
                        <div className="empty-friends-state">
                            <p>No friends added yet.</p>
                            <button className="btn-primary-sm" onClick={() => setActiveTab('add')}>Find Friends</button>
                        </div>
                    ) : (
                        <div className="friends-grid">
                            {friendsWithProgress.map(friend => {
                                const hasLiveNotification = notifications.some(n => n.fromUser?._id === friend._id && n.type === 'chat');
                                const initial = (friend.username || 'U')[0].toUpperCase();

                                return (
                                    <div key={friend._id} className="friend-profile-card">
                                        <div className="friend-avatar-wrapper">
                                            <div className="friend-avatar">{initial}</div>
                                            <span className="online-status-dot"></span>
                                        </div>
                                        <div className="friend-info">
                                            <div className="friend-username-row">
                                                <span className="friend-username">{friend.username}</span>
                                                {hasLiveNotification && <span className="notification-dot" title="New message"></span>}
                                                {friend.unreadCount > 0 && <span className="unread-badge">{friend.unreadCount}</span>}
                                            </div>
                                            <span className="friend-progress-badge">
                                                ⚡ {friend.dailyCompleted} tasks completed today
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => onChat && onChat(friend)} 
                                            className="btn-chat-action"
                                            title="Open Chat"
                                        >
                                            💬 Chat
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Tab 2: Pending Requests */}
            {activeTab === 'requests' && (
                <div className="friends-tab-content">
                    {requests.length === 0 ? (
                        <div className="empty-friends-state">
                            <p>No pending friend requests.</p>
                        </div>
                    ) : (
                        <div className="requests-list">
                            {requests.map(req => {
                                const reqUser = req.user || {};
                                const initial = (reqUser.username || 'U')[0].toUpperCase();
                                return (
                                    <div key={reqUser._id} className="request-card">
                                        <div className="request-user-info">
                                            <div className="friend-avatar">{initial}</div>
                                            <div>
                                                <span className="request-username">{reqUser.username}</span>
                                                <span className="request-subtitle">wants to connect with you</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleAcceptRequest(reqUser._id)} 
                                            className="btn-accept-action"
                                        >
                                            ✓ Accept Request
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Tab 3: Search & Add Friend */}
            {activeTab === 'add' && (
                <div className="friends-tab-content">
                    <div className="search-friend-box">
                        <input
                            type="text"
                            placeholder="Search by username..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="friend-search-input"
                        />
                    </div>
                    <div className="search-results-list">
                        {searchResults.length === 0 && searchQuery.length > 1 && (
                            <p className="no-results-text">No user found matching "{searchQuery}"</p>
                        )}
                        {searchResults.map(user => {
                            const initial = (user.username || 'U')[0].toUpperCase();
                            return (
                                <div key={user._id} className="search-user-card">
                                    <div className="request-user-info">
                                        <div className="friend-avatar">{initial}</div>
                                        <span className="request-username">{user.username}</span>
                                    </div>
                                    <button 
                                        onClick={() => handleSendRequest(user._id)} 
                                        disabled={sendingId === user._id}
                                        className="btn-add-action"
                                    >
                                        {sendingId === user._id ? 'Sending...' : '+ Add Friend'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
