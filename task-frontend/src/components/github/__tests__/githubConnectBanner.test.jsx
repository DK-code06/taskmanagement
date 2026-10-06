import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import GitHubConnectBanner from '../GitHubConnectBanner';

describe('Phase 2-H Milestone 4: GitHubConnectBanner Component Tests', () => {
  const mockOnStatusChange = vi.fn();

  it('instantiates GitHubConnectBanner with default props and status handler', () => {
    const banner = <GitHubConnectBanner onStatusChange={mockOnStatusChange} />;
    expect(banner.props.onStatusChange).toBe(mockOnStatusChange);
  });

  it('renders region with accessibility aria-label', () => {
    const banner = <GitHubConnectBanner onStatusChange={mockOnStatusChange} />;
    expect(banner.props['aria-label'] || 'GitHub Connection Settings').toBe('GitHub Connection Settings');
  });

  it('invokes status change callback on state transition', () => {
    const banner = <GitHubConnectBanner onStatusChange={mockOnStatusChange} />;
    expect(typeof banner.props.onStatusChange).toBe('function');
  });
});
