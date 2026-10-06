import React, { useState, useEffect } from 'react';
import RecommendationCard from './RecommendationCard';

/**
 * ProjectRecommendationsWidget - Read-only advisory widget displaying active recommendations for a project.
 */
export default function ProjectRecommendationsWidget({ projectId, authAxios, className = '' }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dismissingId, setDismissingId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (!projectId || !authAxios) return;

    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await authAxios.get(`/api/projects/${projectId}/recommendations`);
        if (isMounted) {
          setRecommendations(res.data?.recommendations || []);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load project recommendations:', err);
          setError('Failed to load project recommendations.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRecommendations();
    return () => { isMounted = false; };
  }, [projectId, authAxios]);

  const handleDismiss = async (recommendationId) => {
    if (!authAxios || !projectId || !recommendationId) return;

    try {
      setDismissingId(recommendationId);
      const recToDismiss = recommendations.find(r => r.id === recommendationId);

      await authAxios.post(`/api/projects/${projectId}/recommendations/${recommendationId}/dismiss`, {
        ruleType: recToDismiss?.ruleType,
        entityId: recToDismiss?.entityId,
        targetUserId: recToDismiss?.targetUserId
      });

      // Filter out dismissed recommendation locally
      setRecommendations(prev => prev.filter(r => r.id !== recommendationId));
    } catch (err) {
      console.error('Failed to dismiss recommendation:', err);
    } finally {
      setDismissingId(null);
    }
  };

  if (loading) {
    return (
      <div className={`p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm ${className}`}>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <span>Analyzing project metrics & generating advisory recommendations...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 ${className}`}>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-base">
            Project Advisory Recommendations ({recommendations.length})
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Advisory only. Recommendations never automatically mutate tasks, projects, or workloads.
          </p>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500 dark:text-gray-400">
          <span className="text-base block mb-1">✨</span>
          <span>No active advisory recommendations for this project. Everything is running smoothly!</span>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map(rec => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onDismiss={handleDismiss}
              isDismissing={dismissingId === rec.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
