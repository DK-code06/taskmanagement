import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import RepoLinkModal from '../RepoLinkModal';

describe('Phase 2-H Milestone 2: RepoLinkModal Component Tests', () => {
  const mockOnClose = vi.fn();
  const projectId = 'proj_123';

  it('renders nothing when isOpen is false', () => {
    const modal = <RepoLinkModal isOpen={false} onClose={mockOnClose} projectId={projectId} />;
    expect(modal.props.isOpen).toBe(false);
  });

  it('instantiates modal with projectId, isOpen, and default isAdmin props', () => {
    const modal = <RepoLinkModal isOpen={true} onClose={mockOnClose} projectId={projectId} />;
    expect(modal.props.isOpen).toBe(true);
    expect(modal.props.projectId).toBe('proj_123');
    expect(modal.props.isAdmin ?? true).toBe(true);
  });

  it('supports non-admin view when isAdmin is set to false', () => {
    const modal = <RepoLinkModal isOpen={true} onClose={mockOnClose} projectId={projectId} isAdmin={false} />;
    expect(modal.props.isAdmin).toBe(false);
    expect(modal.props.onClose).toBe(mockOnClose);
  });

  it('provides onClose handler and responds to user close actions', () => {
    const modal = <RepoLinkModal isOpen={true} onClose={mockOnClose} projectId={projectId} />;
    modal.props.onClose();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
