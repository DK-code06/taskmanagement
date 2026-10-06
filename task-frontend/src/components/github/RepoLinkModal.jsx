import React, { useState, useEffect } from 'react';

export default function RepoLinkModal({ isOpen, onClose, projectId, isAdmin = true }) {
  const [availableRepos, setAvailableRepos] = useState([]);
  const [linkedRepos, setLinkedRepos] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState(null);
  const [error, setError] = useState(null);
  const [githubConnected, setGithubConnected] = useState(true);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchData();
    }
  }, [isOpen, projectId]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch currently linked repositories
      const linkedRes = await fetch(`/api/projects/${projectId}/github/repositories`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (linkedRes.ok) {
        const linkedData = await linkedRes.json();
        setLinkedRepos(linkedData.repositories || []);
      }

      // Fetch user's accessible GitHub repositories
      const githubRes = await fetch('/api/github/repositories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (githubRes.status === 404) {
        setGithubConnected(false);
        setAvailableRepos([]);
      } else if (githubRes.ok) {
        const githubData = await githubRes.json();
        setGithubConnected(true);
        setAvailableRepos(githubData.repositories || []);
      } else {
        const errData = await githubRes.json();
        setError(errData.error || 'Failed to load GitHub repositories');
      }
    } catch (err) {
      setError('Network error while connecting to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedRepoId) return;

    const targetRepo = availableRepos.find(r => r.githubRepoId === selectedRepoId);
    if (!targetRepo) return;

    setIsLinking(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/github/repositories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          owner: targetRepo.owner,
          name: targetRepo.name,
          githubRepoId: targetRepo.githubRepoId,
          autoCloseOnPRMerge: true
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to link repository');
      } else {
        setLinkedRepos(prev => [...prev, data.link]);
        setSelectedRepoId('');
      }
    } catch (err) {
      setError('Network error while linking repository');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (repoId) => {
    setUnlinkingId(repoId);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/github/repositories/${repoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to unlink repository');
      } else {
        setLinkedRepos(prev => prev.filter(r => r.githubRepoId !== repoId && r._id !== repoId));
      }
    } catch (err) {
      setError('Network error while unlinking repository');
    } finally {
      setUnlinkingId(null);
    }
  };

  if (!isOpen) return null;

  const filteredAvailableRepos = availableRepos.filter(repo => {
    const isAlreadyLinked = linkedRepos.some(l => l.githubRepoId === repo.githubRepoId);
    if (isAlreadyLinked) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return repo.fullName.toLowerCase().includes(q) || repo.name.toLowerCase().includes(q);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repo-link-modal-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="repo-link-modal-title" className="text-xl font-semibold text-gray-900 dark:text-white">
            Link GitHub Repository
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded text-sm">
              {error}
            </div>
          )}

          {!githubConnected ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-gray-600 dark:text-gray-300">
                No connected GitHub account found. Please connect your GitHub account in Settings before linking repositories.
              </p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading repositories...
            </div>
          ) : (
            <>
              {/* Currently Linked Repositories */}
              <div>
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                  Linked Repositories ({linkedRepos.length})
                </h3>
                {linkedRepos.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                    No GitHub repositories are linked to this project yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-md">
                    {linkedRepos.map(link => (
                      <li key={link._id || link.githubRepoId} className="flex items-center justify-between p-3">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">{link.fullName}</span>
                          {link.private && (
                            <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 px-2 py-0.5 rounded">
                              Private
                            </span>
                          )}
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleUnlink(link.githubRepoId || link._id)}
                            disabled={unlinkingId === (link.githubRepoId || link._id)}
                            className="text-sm text-red-600 hover:text-red-800 dark:hover:text-red-400 font-medium disabled:opacity-50"
                          >
                            {unlinkingId === (link.githubRepoId || link._id) ? 'Unlinking...' : 'Unlink'}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Link New Repository Section */}
              {isAdmin && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                  <h3 className="text-md font-medium text-gray-900 dark:text-white">
                    Select a Repository to Link
                  </h3>

                  {/* Filter Input */}
                  <input
                    type="text"
                    placeholder="Search repositories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Filter repositories"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Repository Select List */}
                  {filteredAvailableRepos.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                      {searchQuery ? 'No matching repositories found.' : 'No additional repositories available to link.'}
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredAvailableRepos.map(repo => (
                        <label
                          key={repo.githubRepoId}
                          className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                            selectedRepoId === repo.githubRepoId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="repoSelect"
                              value={repo.githubRepoId}
                              checked={selectedRepoId === repo.githubRepoId}
                              onChange={() => setSelectedRepoId(repo.githubRepoId)}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {repo.fullName}
                            </span>
                          </div>
                          {repo.private && (
                            <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
                              Private
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleLink}
                    disabled={!selectedRepoId || isLinking}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {isLinking ? 'Linking Repository...' : 'Link Selected Repository'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white text-sm font-medium rounded-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

RepoLinkModal.defaultProps = {
  isAdmin: true
};
