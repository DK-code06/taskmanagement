import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = "http://localhost:5000/api";

export default function TeamAnalytics({ teamId, token }) {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!teamId || !token) return;
            setIsLoading(true);
            try {
                const authAxios = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${token}` } });
                const res = await authAxios.get(`/analytics/team/${teamId}`);
                setStats(res.data);
            } catch (error) {
                console.error(`Failed to fetch analytics for team ${teamId}`, error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, [teamId, token]);

    if (isLoading) {
        return <div className="team-analytics-widget loading">Loading team stats...</div>;
    }

    if (!stats) {
        return null; // Don't render if there are no stats
    }

    const completionRate = stats.completionRate ? stats.completionRate.toFixed(1) : 0;

    return (
        <div className="team-analytics-widget">
            <h4>📈 Team Progress</h4>
            <div className="team-stat-main">
                <div className="progress-circle" style={{background: `conic-gradient(#4caf50 ${completionRate}%, #e0e0e0 ${completionRate}%)`}}>
                    <div className="progress-circle-inner">{completionRate}%</div>
                </div>
                <div className="team-stat-summary">
                    <strong>{stats.completedTasks} / {stats.totalTasks}</strong> tasks completed
                </div>
            </div>
            <div className="team-stat-breakdown">
                <h5>Completed by Member:</h5>
                <ul>
                    {stats.completedByMember.map(member => (
                        <li key={member.username}>
                            <span>{member.username}</span>
                            <strong>{member.count}</strong>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

