import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { Badge } from '../ui/Badge';

/**
 * AISummarizeWidget Component (Phase 2-E)
 * Generates and displays executive AI summaries of task status, activity history, and progress assessment.
 */
export const AISummarizeWidget = ({
  task,
  authAxios,
  userConsentEnabled = false,
  onConsentEnable,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summaryData, setSummaryData] = useState(null);

  const taskId = task?._id || task?.id;

  const handleGenerateSummary = async () => {
    if (!taskId || !authAxios || !userConsentEnabled) return;
    setLoading(true);
    setError(null);

    try {
      const res = await authAxios.post(`/ai/tasks/${taskId}/summarize`);
      setSummaryData(res.data);
    } catch (err) {
      console.error('Failed to generate AI task summary:', err);
      if (err.response?.status === 403 && err.response?.data?.consentRequired) {
        setError('AI consent is required to use this feature.');
      } else if (err.response?.status === 429) {
        setError(err.response.data?.error || 'Rate limit exceeded (10 requests / 15 mins). Please try again later.');
      } else {
        setError('Failed to fetch AI task summary. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!userConsentEnabled) {
    return (
      <div
        style={{
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-bg-subtle)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          fontSize: 'var(--font-size-xs)',
        }}
      >
        <span style={{ color: 'var(--color-text-muted)' }}>
          ✨ AI Task Summary available (Consent required)
        </span>
        {onConsentEnable && (
          <Button variant="ghost" size="sm" onClick={onConsentEnable} style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}>
            Enable AI
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className="ai-summarize-widget"
      style={{
        padding: '0.875rem 1rem',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-bg-subtle)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📝</span>
          <h5 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--color-text-primary)' }}>
            Executive AI Summary
          </h5>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateSummary}
          loading={loading}
          style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px' }}
        >
          {summaryData ? '🔄 Refresh Summary' : '✨ Generate Summary'}
        </Button>
      </div>

      {error && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger, #ef4444)' }}>
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: '0.75rem 0', display: 'flex', justifyContent: 'center' }}>
          <Spinner size="sm" label="Generating summary..." />
        </div>
      )}

      {summaryData && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--font-size-xs)' }}>
          {summaryData.fallback && (
            <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              <Badge variant="secondary" size="sm">Rule-Based Fallback</Badge>
            </div>
          )}

          <div style={{ color: 'var(--color-text-primary)', lineHeight: '1.4', backgroundColor: 'var(--color-surface)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
            {summaryData.summary}
          </div>

          {summaryData.progressAssessment && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: '600', color: 'var(--color-text-secondary)' }}>Assessment:</span>
              <Badge variant={summaryData.progressAssessment === 'ON_TRACK' ? 'success' : summaryData.progressAssessment === 'COMPLETED' ? 'info' : 'warning'} size="sm">
                {summaryData.progressAssessment}
              </Badge>
            </div>
          )}

          {summaryData.keyTakeaways && summaryData.keyTakeaways.length > 0 && (
            <div>
              <span style={{ fontWeight: '600', color: 'var(--color-text-secondary)' }}>Key Takeaways:</span>
              <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, color: 'var(--color-text-secondary)' }}>
                {summaryData.keyTakeaways.map((point, idx) => (
                  <li key={idx} style={{ marginBottom: '2px' }}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AISummarizeWidget;
