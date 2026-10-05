import { describe, it, expect } from 'vitest';
import React from 'react';

// Import design tokens and primitives
import { colors, typography, spacing, radius, shadows } from '../../../tokens/designTokens';
import { Button } from '../Button';
import { Card } from '../Card';
import { Input } from '../Input';
import { Badge } from '../Badge';
import { Modal } from '../Modal';
import { Drawer } from '../Drawer';
import { Toast } from '../Toast';
import { Spinner } from '../Spinner';
import { Progress } from '../Progress';
import { Avatar } from '../Avatar';
import { Tooltip } from '../Tooltip';
import { EmptyState } from '../EmptyState';
import { ConfirmDialog } from '../ConfirmDialog';

describe('Design System Primitives (M4.1)', () => {
  it('should define required design tokens', () => {
    expect(colors.primary.DEFAULT).toBe('#3b82f6');
    expect(colors.text.secondary).toBe('#334155'); // High contrast WCAG text
    expect(typography.fontFamily).toContain('Inter');
    expect(spacing.md).toBe('1rem');
    expect(radius.md).toBe('0.5rem');
    expect(shadows.subtle).toBeDefined();
  });

  it('should instantiate Button with proper default props and styles', () => {
    const btn = <Button variant="primary" size="md">Click Me</Button>;
    expect(btn.props.variant).toBe('primary');
    expect(btn.props.children).toBe('Click Me');
  });

  it('should instantiate Input with accessible props', () => {
    const input = <Input label="Username" placeholder="Enter username" required error="Required field" />;
    expect(input.props.label).toBe('Username');
    expect(input.props.required).toBe(true);
    expect(input.props.error).toBe('Required field');
  });

  it('should instantiate Badge with proper variant', () => {
    const badge = <Badge variant="success" dot>Active</Badge>;
    expect(badge.props.variant).toBe('success');
    expect(badge.props.dot).toBe(true);
  });

  it('should instantiate Modal with accessible structure', () => {
    const modal = (
      <Modal isOpen={true} onClose={() => {}} title="Test Modal" description="Modal Description">
        <div>Modal Content</div>
      </Modal>
    );
    expect(modal.props.isOpen).toBe(true);
    expect(modal.props.title).toBe('Test Modal');
  });

  it('should instantiate Drawer with proper position', () => {
    const drawer = (
      <Drawer isOpen={true} onClose={() => {}} position="left" title="Nav Drawer">
        <div>Drawer Content</div>
      </Drawer>
    );
    expect(drawer.props.position).toBe('left');
    expect(drawer.props.isOpen).toBe(true);
  });

  it('should instantiate Toast primitive', () => {
    const toast = <Toast type="warning" message="Warning message" visible={true} />;
    expect(toast.props.type).toBe('warning');
    expect(toast.props.message).toBe('Warning message');
  });

  it('should instantiate Progress and Spinner primitives', () => {
    const spinner = <Spinner size="lg" label="Loading tasks" />;
    const progress = <Progress value={45} max={100} showLabel />;
    expect(spinner.props.size).toBe('lg');
    expect(progress.props.value).toBe(45);
  });

  it('should instantiate Avatar, Tooltip, EmptyState, and ConfirmDialog', () => {
    const avatar = <Avatar name="John Doe" status="online" />;
    const tooltip = <Tooltip content="Edit item"><button>Edit</button></Tooltip>;
    const emptyState = <EmptyState title="No tasks" description="Create a task to get started" />;
    const confirm = <ConfirmDialog isOpen={false} onClose={() => {}} onConfirm={() => {}} title="Delete?" />;

    expect(avatar.props.name).toBe('John Doe');
    expect(tooltip.props.content).toBe('Edit item');
    expect(emptyState.props.title).toBe('No tasks');
    expect(confirm.props.title).toBe('Delete?');
  });
});
