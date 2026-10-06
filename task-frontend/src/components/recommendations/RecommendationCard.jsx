import React from 'react';

/**
 * RecommendationCard - Renders a single advisory recommendation with type badge, explanation, confidence, and dismiss action.
 */
export default function RecommendationCard({ recommendation, onDismiss, isDismissing = false, className = '' }) {
  if (!recommendation) return null;

  const {
    id,
    title,
    description,
    reason,
    suggestedAction,
    ruleType,
    confidence = 0.85,
    priority = 'MEDIUM'
  } = recommendation;

  const getPriorityBadgeStyle = (prio) => {
    switch (prio) {
      case 'HIGH':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
      case 'LOW':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
    }
  };

  const formatRuleTypeLabel = (type) => {
    return (type || 'RECOMMENDATION').replace(/_/g, ' ');
  };

  return (
    <div
      className={`p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:shadow-md ${className}`}
      aria-label={`Recommendation: ${title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getPriorityBadgeStyle(priority)}`}>
            {priority}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {formatRuleTypeLabel(ruleType)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            Confidence: {Math.round(confidence * 100)}%
          </span>
        </div>

        <button
          onClick={() => onDismiss && onDismiss(id)}
          disabled={isDismissing}
          className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label={`Dismiss recommendation ${title}`}
        >
          {isDismissing ? '...' : 'Dismiss'}
        </button>
      </div>

      <h4 className="mt-2.5 font-semibold text-gray-900 dark:text-white text-base">
        {title}
      </h4>

      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
        {description}
      </p>

      {reason && (
        <div className="mt-2 p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-700 dark:text-gray-300">Trigger Reason:</span> {reason}
        </div>
      )}

      {suggestedAction && (
        <div className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
          <span>💡</span>
          <span>{suggestedAction}</span>
        </div>
      )}
    </div>
  );
}
