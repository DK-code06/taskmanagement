import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = "http://localhost:5000/api";

export default function Friends({ token, onChat, notifications, refreshKey }) {
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [progress, setProgress] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    
    const authAxios = axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
    });

    // This useEffect fetches all friend-related data. 
    // It re-runs when the component mounts or when a friend request notification arrives (via refreshKey).
    useEffect(() => {
        const fetchData = async () => {
            if (!token) return;
            try {
                const [friendsRes, progressRes] = await Promise.all([
                    authAxios.get('/friends'),
                    authAxios.get('/friends/progress')
                ]);
                setFriends(friendsRes.data.friends);
                setRequests(friendsRes.data.pendingRequests);
                setProgress(progressRes.data);
            } catch (err) { console.error("Failed to fetch friends data", err); }
        };
        fetchData();
    }, [token, refreshKey]); // The refreshKey prop forces this hook to re-run

    // This useEffect handles the user search functionality with a debounce
    useEffect(() => {
        if (searchQuery.length > 1) {
            const delayDebounce = setTimeout(async () => {
                try {
                    const res = await authAxios.get(`/friends/search?query=${searchQuery}`);
                    setSearchResults(res.data);
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
        try {
            await authAxios.post(`/friends/request/${userId}`);
            setSearchQuery('');
            setSearchResults([]);
            alert("Friend request sent!");
        } catch (error) {
            alert(error.response?.data?.error || "Failed to send request.");
        }
    };

    const handleAcceptRequest = async (userId) => {
        try {
            await authAxios.put(`/friends/accept/${userId}`);
            // Refetch data after accepting to update lists
             const [friendsRes, progressRes] = await Promise.all([
                authAxios.get('/friends'),
                authAxios.get('/friends/progress')
            ]);
            setFriends(friendsRes.data.friends);
            setRequests(friendsRes.data.pendingRequests);
            setProgress(progressRes.data);
        } catch (error) {
            alert(error.response?.data?.error || "Failed to accept request.");
        }
    };
    
    // Merge the daily progress data with the friends list
    const friendsWithProgress = friends.map(friend => {
        const p = progress.find(prog => prog._id === friend.user._id);
        return {
            ...friend.user, // Spread the user object which contains { _id, username }
            unreadCount: friend.unreadCount, // Pass along the unread count
            dailyCompleted: p ? p.dailyCompleted : 0
        };
    });

    return (
        <div className="friends-section">
            <h3>Friends</h3>
            
            {requests.length > 0 && (
                <div className="friend-requests">
                    <h4>Pending Requests</h4>
                    {requests.map(req => (
                        <div key={req.user._id} className="friend-item">
                            <span>{req.user.username}</span>
                            <button onClick={() => handleAcceptRequest(req.user._id)} className="btn-accept">Accept</button>
                        </div>
                    ))}
                </div>
            )}

            <div className="friends-progress">
                <h4>Friends' Daily Progress</h4>
                {friendsWithProgress.map(friend => {
                    const hasLiveNotification = notifications.some(n => n.fromUser._id === friend._id && n.type === 'chat');
                    return (
                        <div key={friend._id} className="friend-item">
                            <span className="friend-name">
                                {friend.username}
                                {hasLiveNotification && <span className="notification-dot"></span>}
                                {friend.unreadCount > 0 && <span className="unread-badge">{friend.unreadCount}</span>}
                            </span>
                            <span className="friend-progress-text">
                                {friend.dailyCompleted} tasks today
                            </span>
                            <button onClick={() => onChat(friend)} className="btn-chat">Chat</button>
                        </div>
                    );
                })}
            </div>

            <div className="add-friend">
                <h4>Add a Friend</h4>
                <input
                    type="text"
                    placeholder="Search by username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input"
                />
                <div className="search-results">
                    {searchResults.map(user => (
                        <div key={user._id} className="search-result-item">
                            <span>{user.username}</span>
                            <button onClick={() => handleSendRequest(user._id)} className="btn-add">+</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

