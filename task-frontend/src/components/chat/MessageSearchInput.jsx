import React, { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

/**
 * MessageSearchInput Component (Phase 2-G)
 * Search input & live results view for 1-on-1 direct messages using native MongoDB text search.
 */
export const MessageSearchInput = ({
  authAxios,
  onSelectResult,
  activeFriendId = null,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchTimeoutRef = useRef(null);

  const performSearch = async (searchTerm) => {
    if (!searchTerm || searchTerm.trim().length < 2 || !authAxios) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let url = `/messages/search?q=${encodeURIComponent(searchTerm.trim())}`;
      if (activeFriendId) {
        url += `&friendId=${activeFriendId}`;
      }
      const res = await authAxios.get(url);
      setResults(res.data?.results || []);
      setHasSearched(true);
    } catch (err) {
      console.error('Failed to search messages:', err);
      if (err.response?.status === 400) {
        setError(err.response.data?.error || 'Invalid search query.');
      } else {
        setError('Failed to search messages.');
      }
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(val);
    }, 400);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setError(null);
  };

  return (
    <div className="message-search-container" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Input
          placeholder="🔍 Search messages..."
          value={query}
          onChange={handleInputChange}
          aria-label="Search direct messages"
          style={{ fontSize: 'var(--font-size-xs, 12px)', height: '32px' }}
        />
        {query && (
          <Button variant="ghost" size="sm" onClick={handleClear} style={{ padding: '0 6px', height: '32px' }} aria-label="Clear search">
            ✕
          </Button>
        )}
      </div>

      {loading && (
        <div style={{ padding: '0.5rem 0', display: 'flex', justifyContent: 'center' }}>
          <Spinner size="sm" label="Searching messages..." />
        </div>
      )}

      {error && (
        <div style={{ fontSize: 'var(--font-size-xs, 12px)', color: 'var(--color-danger, #ef4444)', marginTop: '0.375rem' }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && !error && (
        <div style={{ fontSize: 'var(--font-size-xs, 12px)', color: 'var(--color-text-muted, #64748b)', padding: '0.5rem 0', fontStyle: 'italic' }}>
          No messages found matching "{query}".
        </div>
      )}

      {!loading && results.length > 0 && (
        <div
          role="region"
          aria-label="Search Results"
          aria-live="polite"
          style={{
            marginTop: '0.5rem',
            maxHeight: '220px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.375rem',
          }}
        >
          {results.map((item) => (
            <div
              key={item._id}
              onClick={() => onSelectResult && onSelectResult(item)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm, 6px)',
                backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                border: '1px solid var(--color-border-subtle, #e2e8f0)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-xs, 12px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', color: 'var(--color-text-primary, #0f172a)' }}>
                <span>From: {item.fromUser?.username || 'User'}</span>
                <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted, #64748b)' }}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>
              <p style={{ margin: 0, color: 'var(--color-text-secondary, #334155)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageSearchInput;
