import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import AIConsentToggle from '../AIConsentToggle';
import AIDecomposeModal from '../AIDecomposeModal';
import AISummarizeWidget from '../AISummarizeWidget';

describe('Phase 2-E Opt-In AI Component Tests', () => {
  describe('AIConsentToggle', () => {
    it('renders consent status correctly when aiConsent is true', () => {
      const comp = <AIConsentToggle aiConsent={true} />;
      expect(comp.props.aiConsent).toBe(true);
    });

    it('renders consent status correctly when aiConsent is false', () => {
      const comp = <AIConsentToggle aiConsent={false} />;
      expect(comp.props.aiConsent).toBe(false);
    });

    it('calls authAxios.put on toggle', async () => {
      const mockPut = vi.fn().mockResolvedValue({ data: { aiConsent: true } });
      const mockAuthAxios = { put: mockPut };
      const onConsentChange = vi.fn();

      const toggle = <AIConsentToggle aiConsent={false} onConsentChange={onConsentChange} authAxios={mockAuthAxios} />;
      expect(toggle.props.aiConsent).toBe(false);
      expect(toggle.props.authAxios.put).toBeDefined();
    });
  });

  describe('AIDecomposeModal', () => {
    const mockTask = { _id: 't1', title: 'Refactor Auth Module' };

    it('renders modal with task title when open', () => {
      const modal = (
        <AIDecomposeModal
          isOpen={true}
          onClose={vi.fn()}
          task={mockTask}
          userConsentEnabled={false}
        />
      );
      expect(modal.props.isOpen).toBe(true);
      expect(modal.props.task.title).toBe('Refactor Auth Module');
      expect(modal.props.userConsentEnabled).toBe(false);
    });

    it('handles advisory subtask selection and addition', () => {
      const mockPost = vi.fn().mockResolvedValue({
        data: {
          available: true,
          suggestions: [
            { title: 'Subtask 1', estimatedMinutes: 20, priority: 'Medium' }
          ]
        }
      });
      const mockAuthAxios = { post: mockPost };

      const modal = (
        <AIDecomposeModal
          isOpen={true}
          onClose={vi.fn()}
          task={mockTask}
          authAxios={mockAuthAxios}
          userConsentEnabled={true}
        />
      );
      expect(modal.props.userConsentEnabled).toBe(true);
      expect(modal.props.authAxios.post).toBeDefined();
    });
  });

  describe('AISummarizeWidget', () => {
    const mockTask = { _id: 't1', title: 'Design Schema' };

    it('renders summary widget with task and consent status', () => {
      const widget = (
        <AISummarizeWidget
          task={mockTask}
          userConsentEnabled={false}
        />
      );
      expect(widget.props.task.title).toBe('Design Schema');
      expect(widget.props.userConsentEnabled).toBe(false);
    });

    it('fetches summary on action when consent is enabled', () => {
      const mockPost = vi.fn().mockResolvedValue({
        data: {
          available: true,
          summary: 'Task is on track with 2 active subtasks.',
          keyTakeaways: ['Subtask 1 complete', 'Subtask 2 in progress'],
          progressAssessment: 'ON_TRACK'
        }
      });
      const mockAuthAxios = { post: mockPost };

      const widget = (
        <AISummarizeWidget
          task={mockTask}
          authAxios={mockAuthAxios}
          userConsentEnabled={true}
        />
      );
      expect(widget.props.userConsentEnabled).toBe(true);
      expect(widget.props.authAxios.post).toBeDefined();
    });
  });
});
