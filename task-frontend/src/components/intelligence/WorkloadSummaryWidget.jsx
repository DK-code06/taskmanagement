import React from 'react';

/**
 * WorkloadSummaryWidget - Displays user workload metrics, utilization progress, and explicit assumed capacity label.
 */
export default function WorkloadSummaryWidget({ workloadData, className = '' }) {
  if (!workloadData) return null;

  const {
    activeTaskCount = 0,
    totalEstimatedWorkloadHours = 0,
    overdueWorkloadHours = 0,
    highPriorityCount = 0,
    capacityUtilizationPercentage = 0,
    capacityLabel = "Assumed Capacity (Default 40h/wk)",
    loadLevel = 'NORMAL',
    isOverloaded = false
  } = workloadData;

  const getProgressBarColor = (level) => {
    if (level === 'OVERLOADED' || isOverloaded) return 'bg-rose-500';
    if (level === 'HIGH_LOAD') return 'bg-orange-500';
    if (level === 'MODERATE_LOAD') return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className={`p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm ${className}`}>
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-base">Workload Intelligence</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{capacityLabel}</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
            isOverloaded
              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          }`}
        >
          {loadLevel.replace('_', ' ')}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {/* Utilization Progress Bar */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
            <span className="text-gray-600 dark:text-gray-400">Capacity Utilization</span>
            <span className="text-gray-900 dark:text-white font-mono font-semibold">{capacityUtilizationPercentage}%</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(loadLevel)}`}
              style={{ width: `${Math.min(100, capacityUtilizationPercentage)}%` }}
              role="progressbar"
              aria-valuenow={capacityUtilizationPercentage}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Active Tasks</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">{activeTaskCount}</span>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Estimated Workload</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">{totalEstimatedWorkloadHours}h</span>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Overdue Workload</span>
            <span className={`text-lg font-bold ${overdueWorkloadHours > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
              {overdueWorkloadHours}h
            </span>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">High Priority</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">{highPriorityCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
