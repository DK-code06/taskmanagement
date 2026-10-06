import React, { useState, useEffect } from 'react';

/**
 * TaskGitHubWidget Component (Phase 2-H Milestone 4)
 * Displays GitHub PR references and repository links linked to a specific task.
 * Uses real backend data without mock/fake fallback.
 */
export default function TaskGitHubWidget({ projectId, taskId, isCompact = false }) {
  const [pullRequests, setPullRequests] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (projectId && taskId) {
      fetchTaskGitHubDetails();
    }
  }, [projectId, taskId]);

  const fetchTaskGitHubDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/projects/${projectId}/github/tasks/${taskId}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      if (res.ok) {
        const data = await res.json();
        setPullRequests(data.pullRequests || []);
        setRepositories(data.repositories || []);
      } else if (res.status === 404) {
        setPullRequests([]);
        setRepositories([]);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to load GitHub task details');
      }
    } catch (err) {
      setError('Network error while fetching task GitHub details');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div
        role="region"
        aria-label="GitHub Task Integration"
        className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${isCompact ? 'p-3' : 'p-4 sm:p-5'}`}
      >
        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading GitHub references...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="region"
        aria-label="GitHub Task Integration"
        className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${isCompact ? 'p-3' : 'p-4'}`}
      >
        <div className="text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="GitHub Task Integration"
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm ${
        isCompact ? 'p-3 space-y-2' : 'p-4 sm:p-5 space-y-3'
      } max-w-full`}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <svg className="w-4 h-4 fill-current text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          Linked GitHub Pull Requests ({pullRequests.length})
        </h4>
      </div>

      {pullRequests.length === 0 ? (
        <div className="text-xs text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-md">
          No GitHub Pull Requests are linked to this task yet.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          {pullRequests.map((pr) => (
            <li key={pr._id || pr.referenceId} className="p-2.5 sm:p-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                >
                  <span>PR #{pr.referenceId}:</span>
                  <span className="truncate">{pr.title || `Pull Request #${pr.referenceId}`}</span>
                </a>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold shrink-0 ${
                    pr.status === 'MERGED'
                      ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300'
                      : pr.status === 'OPEN'
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {pr.status || 'MERGED'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {repositories.length > 0 && !isCompact && (
        <div className="pt-2 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2">
          <span>Linked Project Repos:</span>
          {repositories.map((repo) => (
            <span
              key={repo._id || repo.githubRepoId}
              className="inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded font-mono text-[11px]"
            >
              {repo.fullName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
