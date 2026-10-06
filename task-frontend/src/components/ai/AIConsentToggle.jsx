import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

/**
 * AIConsentToggle Component (Phase 2-E)
 * Allows users to enable or revoke opt-in consent for server-side AI features.
 */
export const AIConsentToggle = ({ aiConsent, onConsentChange, authAxios }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleToggle = async () => {
    if (!authAxios) return;
    setLoading(true);
    setError(null);
    const targetState = !aiConsent;
    try {
      const res = await authAxios.put('/user/preferences/ai', { aiConsent: targetState });
      if (onConsentChange) {
        onConsentChange(res.data.aiConsent);
      }
    } catch (err) {
      console.error('Failed to update AI consent preference:', err);
      setError('Failed to update AI preference. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="ai-consent-toggle"
      style={{
        padding: '1rem',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-bg-subtle)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>✨</span>
          <h4 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: '600', color: 'var(--color-text-primary)' }}>
            AI Assistant Opt-In & Consent
          </h4>
          <Badge variant={aiConsent ? 'success' : 'secondary'} size="sm">
            {aiConsent ? 'Opted In' : 'Disabled'}
          </Badge>
        </div>

        <Button
          variant={aiConsent ? 'outline' : 'primary'}
          size="sm"
          onClick={handleToggle}
          loading={loading}
        >
          {aiConsent ? 'Revoke AI Consent' : 'Enable AI Features'}
        </Button>
      </div>

      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
        Opting in enables AI-assisted task decomposition and executive summaries powered by Google Gemini via server-side APIs.
        AI recommendations are strictly <strong>advisory</strong> and will never alter your tasks or reward points automatically.
        You can revoke consent at any time.
      </p>

      {error && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger, #ef4444)', marginTop: '0.25rem' }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

export default AIConsentToggle;
