import React, { useState } from 'react';
import DebtScoreBadge from './DebtScoreBadge';

/**
 * DebtBreakdownPopover - Renders popover details explaining Task Debt Score components.
 */
export default function DebtBreakdownPopover({ debtData, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!debtData) return null;

  const { debtScore, classification, priority, priorityMultiplier, breakdown, signals, isExcluded, exclusionReason } = debtData;

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full"
        aria-expanded={isOpen}
        aria-label="View task debt breakdown details"
      >
        <DebtScoreBadge debtScore={debtScore} classification={classification} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 text-sm text-gray-800 dark:text-gray-200">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white">Task Debt Breakdown</h4>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
              aria-label="Close popover"
            >
              ✕
            </button>
          </div>

          {isExcluded ? (
            <div className="text-xs text-gray-500 dark:text-gray-400 py-1">
              <span className="font-medium text-amber-600 dark:text-amber-400">Task Excluded:</span> {exclusionReason || 'No debt applies'}
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Overdue Duration:</span>
                <span className="font-mono font-medium">{breakdown?.overdueScore || 0} / 40</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Deadline Proximity:</span>
                <span className="font-mono font-medium">{breakdown?.proximityScore || 0} / 15</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Status Stagnation:</span>
                <span className="font-mono font-medium">{breakdown?.stagnationScore || 0} / 20</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Activity Event Churn:</span>
                <span className="font-mono font-medium">{breakdown?.churnScore || 0} / 15</span>
              </div>

              <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Priority Multiplier ({priority}):</span>
                <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">{priorityMultiplier || 1.0}x</span>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center font-semibold text-gray-900 dark:text-white text-sm">
                <span>Final Bounded Score:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">{debtScore} / 100</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
