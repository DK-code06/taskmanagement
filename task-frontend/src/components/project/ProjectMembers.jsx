import React from 'react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';

/**
 * ProjectMembers Component (M4.2)
 * Displays project owner and member avatars with accessible roles
 */
export const ProjectMembers = ({ ownerType = 'User', ownerId, members = [] }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <Badge variant={ownerType === 'Team' ? 'info' : 'neutral'} size="sm">
        {ownerType === 'Team' ? '👥 Team Project' : '👤 Personal'}
      </Badge>

      <div style={{ display: 'flex', alignItems: 'center', marginLeft: '0.25rem' }}>
        {members.slice(0, 4).map((m, idx) => {
          const userObj = m.user || {};
          const name = userObj.username || userObj.name || `Member ${idx + 1}`;
          return (
            <div
              key={userObj._id || idx}
              style={{
                marginLeft: idx === 0 ? 0 : '-8px',
                zIndex: members.length - idx,
              }}
              title={`${name} (${m.role || 'MEMBER'})`}
            >
              <Avatar name={name} size="sm" />
            </div>
          );
        })}

        {members.length > 4 && (
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: '600',
              color: 'var(--color-text-muted)',
              marginLeft: '0.5rem',
            }}
          >
            +{members.length - 4} more
          </span>
        )}
      </div>
    </div>
  );
};
