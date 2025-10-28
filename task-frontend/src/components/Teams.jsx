import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = "http://localhost:5000/api";

// This component will be placed in the Dashboard's sidebar
export default function Teams({ token, friends }) {
    const [teams, setTeams] = useState([]);
    const [newTeamName, setNewTeamName] = useState('');
    const [inviteFriendId, setInviteFriendId] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState('');

    const authAxios = axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
    });

    // Fetch the user's teams when the component loads
    useEffect(() => {
        const fetchTeams = async () => {
            if (token) {
                try {
                    const res = await authAxios.get('/teams');
                    setTeams(res.data);
                } catch (error) {
                    console.error("Failed to fetch teams:", error);
                }
            }
        };
        fetchTeams();
    }, [token]);

    // Handler to create a new team
    const handleCreateTeam = async (e) => {
        e.preventDefault();
        if (!newTeamName.trim()) return;
        try {
            const res = await authAxios.post('/teams', { name: newTeamName.trim() });
            setTeams(prev => [...prev, res.data]);
            setNewTeamName('');
        } catch (error) {
            alert(error.response?.data?.error || "Failed to create team.");
        }
    };

    // Handler to invite a friend to the selected team
    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteFriendId || !selectedTeamId) return alert("Please select a team and a friend.");
        try {
            const res = await authAxios.put(`/teams/${selectedTeamId}/invite`, { friendId: inviteFriendId });
            // Update the specific team in the state with the new member list
            setTeams(prev => prev.map(team => team._id === selectedTeamId ? res.data : team));
            setInviteFriendId('');
            setSelectedTeamId('');
            alert("Friend invited successfully!");
        } catch (error) {
            alert(error.response?.data?.error || "Failed to invite friend.");
        }
    };

    return (
        <div className="teams-section">
            <h3>👥 My Teams</h3>
            
            {/* List of existing teams */}
            <div className="teams-list">
                {teams.map(team => (
                    <div key={team._id} className="team-item">
                        <strong>{team.name}</strong>
                        <div className="team-members">
                            Members: {team.members.map(m => m.user.username).join(', ')}
                        </div>
                    </div>
                ))}
            </div>

            {/* Form to create a new team */}
            <form onSubmit={handleCreateTeam} className="team-form">
                <input
                    type="text"
                    className="input"
                    placeholder="New team name..."
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                />
                <button type="submit" className="btn btn-dark">Create Team</button>
            </form>

            {/* Form to invite friends to a team */}
            <form onSubmit={handleInvite} className="team-form">
                <h4>Invite a Friend</h4>
                <select className="input" value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}>
                    <option value="">Select a team...</option>
                    {teams.map(team => <option key={team._id} value={team._id}>{team.name}</option>)}
                </select>
                <select className="input" value={inviteFriendId} onChange={e => setInviteFriendId(e.target.value)}>
                    <option value="">Select a friend...</option>
                    {/* We need the list of friends passed down as a prop */}
                    {friends.map(friend => <option key={friend.user._id} value={friend.user._id}>{friend.user.username}</option>)}
                </select>
                <button type="submit" className="btn">Invite</button>
            </form>
        </div>
    );
}
