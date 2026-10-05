import React from 'react';

/**
 * DebtScoreBadge - Renders a deterministic task debt badge using M4.1 Design System tokens.
 */
export default function DebtScoreBadge({ debtScore = 0, classification = 'LOW', showLabel = true, className = '' }) {
  const getBadgeStyle = (cls) => {
    switch (cls) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800';
      case 'MODERATE':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
      case 'LOW':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyle(classification)} ${className}`}
      title={`Task Debt Score: ${debtScore}/100 (${classification})`}
      aria-label={`Task Debt Score ${debtScore} out of 100, status ${classification}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75" />
      <span>Debt: {debtScore}</span>
      {showLabel && <span className="uppercase text-[10px] tracking-wider opacity-90">({classification})</span>}
    </span>
  );
}
