import React from 'react';

/**
 * OverloadIndicatorBanner - Advisory alert banner displayed when workload exceeds capacity threshold (>130%).
 * Strictly read-only and advisory.
 */
export default function OverloadIndicatorBanner({ workloadData, className = '' }) {
  if (!workloadData || (!workloadData.isOverloaded && workloadData.capacityUtilizationPercentage <= 130)) {
    return null;
  }

  const { capacityUtilizationPercentage = 0, overdueHighPriorityCount = 0, advisoryMessage } = workloadData;

  return (
    <div
      className={`p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-start gap-3 text-rose-900 dark:text-rose-200 text-sm ${className}`}
      role="alert"
    >
      <div className="p-1.5 bg-rose-100 dark:bg-rose-900/60 rounded-lg shrink-0 mt-0.5 text-rose-600 dark:text-rose-300">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-rose-950 dark:text-rose-100 text-sm">
          Advisory Warning: Workload Capacity Threshold Exceeded
        </h4>
        <p className="mt-1 text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
          {advisoryMessage || `Current estimated workload utilization is ${capacityUtilizationPercentage}% (threshold 130%), with ${overdueHighPriorityCount} overdue high-priority task(s).`}
        </p>
        <div className="mt-2 text-[11px] text-rose-700 dark:text-rose-400 font-medium italic">
          Note: This intelligence warning is advisory only. No tasks have been automatically reassigned or modified.
        </div>
      </div>
    </div>
  );
}
