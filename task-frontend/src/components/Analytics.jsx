
import React from 'react';

// This component displays the personal productivity stats
export default function Analytics({ data }) {
    // Show a loading state if data hasn't arrived yet
    if (!data) {
        return <div className="analytics-widget">Loading personal stats...</div>;
    }

    return (
        <div className="analytics-widget">
            <h3>📊 My Productivity Stats</h3>
            <div className="stats-grid">
                <div className="stat-card">
                    <h4>Completed This Week</h4>
                    <p>{data.completedThisWeek || 0}</p>
                </div>
                <div className="stat-card">
                    <h4>Overall Completion</h4>
                    <p>{data.completionRate ? data.completionRate.toFixed(1) : 0}%</p>
                    <small>{data.totalCompleted} of {data.totalTasks} tasks</small>
                </div>
                <div className="stat-card">
                    <h4>Completed by Priority</h4>
                    <div className="priority-stats">
                        <span>High: {data.completedByPriority?.High || 0}</span>
                        <span>Medium: {data.completedByPriority?.Medium || 0}</span>
                        <span>Low: {data.completedByPriority?.Low || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

