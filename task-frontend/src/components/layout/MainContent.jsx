import React from 'react';

/**
 * Reusable Main Content Component (M4.1 Layout Foundation)
 */
export const MainContent = ({ children, className = '', style = {} }) => {
  return (
    <main
      className={`app-main-content ${className}`}
      style={{
        flexGrow: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-lg)',
        ...style,
      }}
    >
      {children}
    </main>
  );
};
