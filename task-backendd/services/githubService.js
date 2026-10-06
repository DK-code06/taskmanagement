const { decryptToken } = require('./encryptionService');

/**
 * Service encapsulating server-side interaction with GitHub REST API.
 * Plaintext tokens are decrypted strictly inside service boundaries and never logged.
 */

/**
 * Fetches repositories accessible to the authenticated GitHub user.
 * Returns normalized minimum metadata required for selection and linking.
 */
async function getUserRepositories(encryptedAccessToken, options = {}) {
  if (!encryptedAccessToken) {
    throw new Error('Encrypted access token is required');
  }

  const token = decryptToken(encryptedAccessToken);
  const page = options.page || 1;
  const perPage = Math.min(options.per_page || 100, 100);

  const url = `https://api.github.com/user/repos?sort=updated&direction=desc&per_page=${perPage}&page=${page}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Task-Management-App'
    }
  });

  if (response.status === 401) {
    const error = new Error('GitHub access token has been revoked or expired');
    error.status = 401;
    throw error;
  }

  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const error = new Error(
      rateLimitRemaining === '0'
        ? 'GitHub API rate limit exceeded'
        : 'GitHub API access forbidden'
    );
    error.status = 403;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`GitHub API request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const rawRepos = await response.json();
  if (!Array.isArray(rawRepos)) {
    return [];
  }

  return rawRepos.map((repo) => ({
    githubRepoId: repo.id.toString(),
    owner: repo.owner?.login || '',
    name: repo.name || '',
    fullName: repo.full_name || '',
    private: Boolean(repo.private),
    defaultBranch: repo.default_branch || 'main',
    htmlUrl: repo.html_url || '',
    description: repo.description || ''
  }));
}

/**
 * Verifies server-side that the authenticated GitHub user has access to a specific repository.
 * Fetches canonical metadata directly from GitHub API (`GET /repos/:owner/:name`).
 */
async function verifyAndFetchRepository(encryptedAccessToken, owner, name) {
  if (!encryptedAccessToken) {
    throw new Error('Encrypted access token is required');
  }
  if (!owner || !name) {
    throw new Error('Repository owner and name parameters are required');
  }

  const token = decryptToken(encryptedAccessToken);
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Task-Management-App'
    }
  });

  if (response.status === 404 || response.status === 403) {
    const error = new Error('GitHub repository not found or access denied for connected account');
    error.status = response.status === 404 ? 404 : 403;
    throw error;
  }

  if (response.status === 401) {
    const error = new Error('GitHub access token has been revoked or expired');
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`GitHub API request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const repo = await response.json();
  return {
    githubRepoId: repo.id.toString(),
    owner: repo.owner?.login || '',
    name: repo.name || '',
    fullName: repo.full_name || '',
    private: Boolean(repo.private),
    defaultBranch: repo.default_branch || 'main',
    htmlUrl: repo.html_url || '',
    description: repo.description || ''
  };
}

module.exports = {
  getUserRepositories,
  verifyAndFetchRepository
};
