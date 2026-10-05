import React, { useState } from 'react';
import { Header } from './Header';
import { Drawer } from '../ui/Drawer';

/**
 * Reusable AppShell Layout Foundation (M4.1)
 * Provides max-width container, responsive mobile nav drawer, and landmark regions
 */
export const AppShell = ({
  user,
  onLogout,
  title,
  headerContent,
  sidebarContent,
  children,
  maxWidth = '1600px',
}) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <div
      className="app-shell"
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Header
        user={user}
        onLogout={onLogout}
        title={title}
        onMobileNavToggle={sidebarContent ? () => setMobileDrawerOpen(true) : undefined}
      >
        {headerContent}
      </Header>

      <div
        className="app-shell-body"
        style={{
          width: '100%',
          maxWidth: maxWidth,
          margin: '0 auto',
          padding: 'var(--space-lg)',
          display: 'flex',
          gap: 'var(--space-xl)',
          flexGrow: 1,
        }}
      >
        {children}
      </div>

      {sidebarContent && (
        <Drawer
          isOpen={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          position="left"
          title="Navigation & Activity"
          size="300px"
        >
          {sidebarContent}
        </Drawer>
      )}
    </div>
  );
};
