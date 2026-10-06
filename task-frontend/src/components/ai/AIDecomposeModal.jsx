import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { Badge } from '../ui/Badge';

/**
 * AIDecomposeModal Component (Phase 2-E)
 * Renders advisory AI-generated subtask suggestions for a given task.
 * User must explicitly select and confirm subtasks before they are saved to DB.
 */
export const AIDecomposeModal = ({
  isOpen,
  onClose,
  task,
  authAxios,
  userConsentEnabled = false,
  onSubtasksAdded,
  onConsentEnable,
}) => {
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [isFallback, setIsFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState('');

  const taskId = task?._id || task?.id;

  const fetchDecomposition = async () => {
    if (!taskId || !authAxios || !userConsentEnabled) return;
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setSelectedIndices([]);
    setIsFallback(false);

    try {
      const res = await authAxios.post(`/ai/tasks/${taskId}/decompose`);
      const data = res.data || {};
      const suggs = data.suggestions || [];
      setSuggestions(suggs);
      setSelectedIndices(suggs.map((_, i) => i)); // Select all by default
      if (data.fallback) {
        setIsFallback(true);
        setFallbackReason(data.reason || 'Deterministic fallback used.');
      }
    } catch (err) {
      console.error('Failed to generate AI decomposition:', err);
      if (err.response?.status === 403 && err.response?.data?.consentRequired) {
        setError('AI consent is required to use this feature.');
      } else if (err.response?.status === 429) {
        setError(err.response.data?.error || 'Rate limit exceeded (10 requests / 15 mins). Please try again later.');
      } else {
        setError('Failed to fetch AI suggestions. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && taskId && userConsentEnabled) {
      fetchDecomposition();
    }
  }, [isOpen, taskId, userConsentEnabled]);

  const handleToggleSelect = (index) => {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleAddSelectedSubtasks = async () => {
    if (selectedIndices.length === 0 || !authAxios || !taskId) return;
    setAdding(true);
    setError(null);
    try {
      const toAdd = selectedIndices.map((i) => suggestions[i]);
      for (const st of toAdd) {
        await authAxios.post(`/tasks/${taskId}/subtasks`, {
          title: st.title,
          description: st.rationale || '',
          priority: st.priority || 'Medium',
          estimatedMinutes: st.estimatedMinutes || 30,
        });
      }
      if (onSubtasksAdded) {
        onSubtasksAdded();
      }
      onClose();
    } catch (err) {
      console.error('Failed to add selected subtasks:', err);
      setError('Failed to create some subtasks. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="✨ AI Subtask Suggestions" maxWidth="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Header summary */}
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          Target Task: <strong style={{ color: 'var(--color-text-primary)' }}>{task?.title}</strong>
        </div>

        {/* Consent Check Banner */}
        {!userConsentEnabled ? (
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>🔒</span>
            <div>
              <h5 style={{ margin: '0 0 0.25rem 0', fontSize: 'var(--font-size-sm)' }}>AI Consent Required</h5>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                You must enable AI feature consent in your settings before requesting AI task decomposition.
              </p>
            </div>
            {onConsentEnable && (
              <Button variant="primary" size="sm" onClick={onConsentEnable}>
                Enable AI Features
              </Button>
            )}
          </div>
        ) : loading ? (
          <div style={{ padding: '2rem 0', display: 'flex', justifyContent: 'center' }}>
            <Spinner label="Analyzing task and generating breakdown..." />
          </div>
        ) : error ? (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-danger, #ef4444)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            ⚠️ {error}
          </div>
        ) : suggestions.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', padding: '1rem 0' }}>
            No subtask suggestions generated.
          </div>
        ) : (
          <>
            {isFallback && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Badge variant="secondary" size="sm">Rule-Based Fallback</Badge>
                <span>{fallbackReason}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              <span>Select the subtasks you want to create:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedIndices(
                    selectedIndices.length === suggestions.length ? [] : suggestions.map((_, i) => i)
                  )
                }
                style={{ padding: '0 4px', fontSize: 'var(--font-size-xs)' }}
              >
                {selectedIndices.length === suggestions.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
              {suggestions.map((st, idx) => {
                const isSelected = selectedIndices.includes(idx);
                return (
                  <div
                    key={idx}
                    onClick={() => handleToggleSelect(idx)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      backgroundColor: isSelected ? 'var(--color-bg-subtle)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'flex-start',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by div click
                      style={{ marginTop: '2px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                    />
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '600', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                          {st.title}
                        </span>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <Badge variant="secondary" size="sm">{st.priority || 'Medium'}</Badge>
                          {st.estimatedMinutes && (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                              ⏱️ {st.estimatedMinutes}m
                            </span>
                          )}
                        </div>
                      </div>
                      {st.rationale && (
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {st.rationale}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.75rem' }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={adding}>
            Cancel
          </Button>

          {userConsentEnabled && suggestions.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddSelectedSubtasks}
              loading={adding}
              disabled={selectedIndices.length === 0 || loading}
            >
              Add Selected Subtasks ({selectedIndices.length})
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AIDecomposeModal;
