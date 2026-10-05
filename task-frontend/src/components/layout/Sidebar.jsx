import React from 'react';

/**
 * Reusable Sidebar Component (M4.1 Layout Foundation)
 */
export const Sidebar = ({ children, className = '', style = {} }) => {
  return (
    <aside
      className={`app-sidebar ${className}`}
      style={{
        width: '320px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-lg)',
        ...style,
      }}
    >
      {children}
    </aside>
  );
};
