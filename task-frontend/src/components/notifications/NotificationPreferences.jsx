import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { Badge } from '../ui/Badge';
import { useToast } from '../../context/ToastContext';

/**
 * Helper to convert VAPID public key base64 URL string to Uint8Array for PushManager
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Helper to ensure Service Worker is registered before requesting PushManager subscription
 */
async function getOrRegisterServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers are not supported in this browser.');
  }
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }
  return reg;
}

/**
 * NotificationPreferences Component (M4.4)
 * Form for managing in-app, Web Push, and category notification preferences
 */
export const NotificationPreferences = ({ authAxios }) => {
  const { addToast } = useToast();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Web Push state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const categories = [
    { key: 'taskReminders', label: '⏰ Task Reminders & Deadlines' },
    { key: 'taskAssignment', label: '📋 Task Assignments' },
    { key: 'taskCompletion', label: '✅ Task Completion Updates' },
    { key: 'projectActivity', label: '📁 Project Activity & Changes' },
    { key: 'teamActivity', label: '👥 Team Membership & Updates' },
    { key: 'friendActivity', label: '🤝 Friend Requests & Progress' },
    { key: 'chatMessages', label: '💬 Chat Messages' },
    { key: 'systemSecurity', label: '🔐 System & Security Alerts', locked: true },
  ];

  const fetchPreferences = useCallback(async () => {
    if (!authAxios) return;
    setLoading(true);
    try {
      const res = await authAxios.get('/notifications/preferences');
      setPreferences(res.data);
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
    } finally {
      setLoading(false);
    }
  }, [authAxios]);

  useEffect(() => {
    fetchPreferences();

    // Check Web Push Browser support & registration
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    setPushSupported(isSupported);

    if (isSupported) {
      getOrRegisterServiceWorker()
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setPushSubscribed(Boolean(sub)))
        .catch(() => {});
    }
  }, [fetchPreferences]);

  const handleToggle = (categoryKey, channel) => {
    if (categoryKey === 'systemSecurity' && channel === 'inApp') return; // Locked by security policy

    setPreferences((prev) => {
      if (!prev) return prev;
      const currentCat = prev[categoryKey] || { inApp: true, push: true };
      return {
        ...prev,
        [categoryKey]: {
          ...currentCat,
          [channel]: !currentCat[channel],
        },
      };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!preferences || !authAxios) return;

    setSaving(true);
    try {
      const res = await authAxios.put('/notifications/preferences', preferences);
      setPreferences(res.data);
      addToast('Notification preferences updated.', { type: 'success' });
    } catch (err) {
      console.error('Failed to save preferences:', err);
      addToast(err.response?.data?.error || 'Failed to update preferences', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleWebPush = async () => {
    if (!pushSupported || !authAxios) return;
    setPushLoading(true);

    try {
      const reg = await getOrRegisterServiceWorker();

      if (pushSubscribed) {
        // Unsubscribe
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await authAxios.post('/notifications/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
          await sub.unsubscribe();
        }
        setPushSubscribed(false);
        addToast('Web Push disabled for this browser.', { type: 'info' });
      } else {
        // Subscribe
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          addToast('Notification permission denied by browser settings.', { type: 'warning' });
          return;
        }

        const keyRes = await authAxios.get('/notifications/push/vapid-key');
        const vapidPublicKey = keyRes.data?.publicKey;

        if (!vapidPublicKey) {
          addToast('Web Push VAPID key is not available.', { type: 'warning' });
          return;
        }

        const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
        const newSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });

        await authAxios.post('/notifications/push/subscribe', {
          endpoint: newSub.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(newSub.getKey('p256dh')))),
            auth: btoa(String.fromCharCode.apply(null, new Uint8Array(newSub.getKey('auth')))),
          },
          deviceLabel: `${navigator.platform || 'Desktop'} Browser`,
          userAgent: navigator.userAgent,
        });

        setPushSubscribed(true);
        addToast('Web Push notifications enabled successfully!', { type: 'success' });
      }
    } catch (err) {
      console.error('Web Push setup error:', err);
      addToast(err.message || 'Failed to configure Web Push notifications.', { type: 'error' });
    } finally {
      setPushLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <Spinner size="lg" label="Loading preferences..." />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="notification-preferences-form" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* Web Push Subscription Banner */}
      <div
        style={{
          padding: '1rem',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🌐 Web Push Notifications
            <Badge variant={pushSubscribed ? 'success' : 'neutral'} size="sm">
              {pushSubscribed ? 'Active' : 'Disabled'}
            </Badge>
          </h4>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
            Receive browser push alerts for urgent task deadlines and security notifications even when tab is idle.
          </p>
        </div>

        {pushSupported ? (
          <Button
            variant={pushSubscribed ? 'outline' : 'primary'}
            size="sm"
            type="button"
            onClick={handleToggleWebPush}
            loading={pushLoading}
          >
            {pushSubscribed ? 'Disable Push' : 'Enable Push'}
          </Button>
        ) : (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Not supported in this browser
          </span>
        )}
      </div>

      {/* Category Controls Table */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', padding: '0.75rem 1rem', backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)', fontWeight: '600', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          <span>Notification Category</span>
          <span style={{ textAlign: 'center' }}>In-App</span>
          <span style={{ textAlign: 'center' }}>Web Push</span>
        </div>

        {categories.map((c) => {
          const catState = preferences?.[c.key] || { inApp: true, push: true };

          return (
            <div
              key={c.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 100px',
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--color-border-subtle)',
                alignItems: 'center',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              <span>{c.label}</span>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <input
                  type="checkbox"
                  checked={catState.inApp}
                  disabled={c.locked}
                  onChange={() => handleToggle(c.key, 'inApp')}
                  aria-label={`In-App notifications for ${c.label}`}
                  style={{ width: '18px', height: '18px', cursor: c.locked ? 'not-allowed' : 'pointer', accentColor: 'var(--color-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <input
                  type="checkbox"
                  checked={catState.push}
                  onChange={() => handleToggle(c.key, 'push')}
                  aria-label={`Push notifications for ${c.label}`}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-sm)' }}>
        <Button variant="primary" type="submit" loading={saving}>
          Save Preferences
        </Button>
      </div>
    </form>
  );
};
