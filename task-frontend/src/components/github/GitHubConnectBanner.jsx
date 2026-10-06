import React, { useState, useEffect } from 'react';

/**
 * GitHubConnectBanner Component (Phase 2-H Milestone 4)
 * Provides user-level GitHub OAuth connection management, status indicator,
 * connection trigger, and secure disconnect confirmation dialog.
 */
export default function GitHubConnectBanner({ onStatusChange }) {
  const [isConnected, setIsConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState('');
  const [connectedAt, setConnectedAt] = useState(null);
  const [scope, setScope] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/github/status', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      if (res.ok) {
        const data = await res.json();
        setIsConnected(Boolean(data.connected));
        if (data.connected) {
          setGithubUsername(data.githubUsername || '');
          setConnectedAt(data.connectedAt || null);
          setScope(data.scope || '');
        } else {
          setGithubUsername('');
          setConnectedAt(null);
          setScope('');
        }
        if (onStatusChange) {
          onStatusChange(data);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to check GitHub connection status');
      }
    } catch (err) {
      setError('Network error while checking GitHub status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/github/connect', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to initiate GitHub connection');
      } else if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError('Network error while connecting to GitHub');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    setIsDisconnecting(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/github/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to disconnect GitHub account');
      } else {
        setIsConnected(false);
        setGithubUsername('');
        setConnectedAt(null);
        setScope('');
        setShowConfirmDisconnect(false);
        if (onStatusChange) {
          onStatusChange({ connected: false });
        }
      }
    } catch (err) {
      setError('Network error while disconnecting GitHub account');
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        role="region"
        aria-label="GitHub Connection Settings"
        className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
      >
        <div className="flex items-center space-x-3 text-gray-500 dark:text-gray-400 text-sm">
          <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Checking GitHub connection status...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="GitHub Connection Settings"
      className="p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm space-y-4 max-w-full"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start sm:items-center space-x-3">
          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-800 dark:text-white shrink-0">
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              GitHub Integration
              {isConnected && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                  Connected
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {isConnected
                ? `Connected as @${githubUsername}`
                : 'Link your GitHub account to auto-close tasks on PR merge'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {isConnected ? (
            <button
              onClick={() => setShowConfirmDisconnect(true)}
              disabled={isDisconnecting}
              aria-label="Disconnect GitHub Account"
              className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              aria-label="Connect GitHub Account"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center space-x-2"
            >
              {isConnecting ? (
                <span>Connecting...</span>
              ) : (
                <>
                  <span>Connect GitHub</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-md text-sm"
        >
          {error}
        </div>
      )}

      {isConnected && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap justify-between gap-2">
          <span>Connected user: <strong className="text-gray-700 dark:text-gray-200">@{githubUsername}</strong></span>
          {connectedAt && <span>Connected on: {new Date(connectedAt).toLocaleDateString()}</span>}
          {scope && <span>Scope: {scope}</span>}
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showConfirmDisconnect && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="disconnect-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h4 id="disconnect-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Disconnect GitHub Account?
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to disconnect <strong>@{githubUsername}</strong>? Webhook pull request synchronization for your tasks will stop working until reconnected.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDisconnect(false)}
                disabled={isDisconnecting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisconnect}
                disabled={isDisconnecting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {isDisconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
