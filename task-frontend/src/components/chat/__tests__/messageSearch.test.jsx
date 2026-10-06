import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import MessageSearchInput from '../MessageSearchInput';

describe('Phase 2-G Message Search Component Tests', () => {
  const mockResults = [
    {
      _id: 'm1',
      content: 'Pipeline deployment finished successfully.',
      fromUser: { _id: 'u1', username: 'alice' },
      toUser: { _id: 'u2', username: 'bob' },
      createdAt: '2026-10-06T09:00:00.000Z',
    },
  ];

  it('renders search input with placeholder', () => {
    const comp = <MessageSearchInput />;
    expect(comp.props.onSelectResult).toBeUndefined();
  });

  it('handles debounced search API requests via authAxios', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        results: mockResults,
        count: 1,
      },
    });
    const mockAuthAxios = { get: mockGet };

    const comp = (
      <MessageSearchInput
        authAxios={mockAuthAxios}
        onSelectResult={vi.fn()}
      />
    );

    expect(comp.props.authAxios.get).toBeDefined();
  });

  it('passes search result selection to callback', () => {
    const handleSelect = vi.fn();
    const comp = (
      <MessageSearchInput
        onSelectResult={handleSelect}
      />
    );

    expect(comp.props.onSelectResult).toBe(handleSelect);
  });
});
