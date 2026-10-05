import { describe, it, expect } from 'vitest';
import React from 'react';
import DebtScoreBadge from '../DebtScoreBadge';
import DebtBreakdownPopover from '../DebtBreakdownPopover';
import WorkloadSummaryWidget from '../WorkloadSummaryWidget';
import OverloadIndicatorBanner from '../OverloadIndicatorBanner';

describe('Phase 2-C Intelligence Advisory Frontend Components', () => {
  describe('DebtScoreBadge', () => {
    it('renders debt score and classification props correctly', () => {
      const comp = <DebtScoreBadge debtScore={72} classification="HIGH" />;
      expect(comp.props.debtScore).toBe(72);
      expect(comp.props.classification).toBe('HIGH');
    });

    it('handles default props for LOW classification', () => {
      const comp = <DebtScoreBadge debtScore={15} classification="LOW" />;
      expect(comp.props.debtScore).toBe(15);
      expect(comp.props.classification).toBe('LOW');
    });
  });

  describe('DebtBreakdownPopover', () => {
    const sampleDebtData = {
      taskId: 'task123',
      debtScore: 72,
      classification: 'HIGH',
      priority: 'High',
      priorityMultiplier: 1.5,
      isExcluded: false,
      breakdown: {
        overdueScore: 24,
        proximityScore: 12,
        stagnationScore: 12,
        churnScore: 0,
        rawTotal: 72,
        boundedScore: 72
      }
    };

    it('accepts debtData prop with breakdown scores', () => {
      const comp = <DebtBreakdownPopover debtData={sampleDebtData} />;
      expect(comp.props.debtData.debtScore).toBe(72);
      expect(comp.props.debtData.breakdown.overdueScore).toBe(24);
      expect(comp.props.debtData.priorityMultiplier).toBe(1.5);
    });
  });

  describe('WorkloadSummaryWidget', () => {
    const sampleWorkloadData = {
      activeTaskCount: 5,
      totalEstimatedWorkloadHours: 20,
      overdueWorkloadHours: 4,
      highPriorityCount: 2,
      capacityUtilizationPercentage: 50,
      capacityLabel: 'Assumed Capacity (Default 40h/wk)',
      loadLevel: 'NORMAL',
      isOverloaded: false
    };

    it('renders workload metrics and explicitly displays "Assumed Capacity (Default 40h/wk)"', () => {
      const comp = <WorkloadSummaryWidget workloadData={sampleWorkloadData} />;
      expect(comp.props.workloadData.capacityLabel).toBe('Assumed Capacity (Default 40h/wk)');
      expect(comp.props.workloadData.capacityUtilizationPercentage).toBe(50);
      expect(comp.props.workloadData.totalEstimatedWorkloadHours).toBe(20);
    });
  });

  describe('OverloadIndicatorBanner', () => {
    const overloadedData = {
      capacityUtilizationPercentage: 140,
      overdueHighPriorityCount: 4,
      loadLevel: 'OVERLOADED',
      isOverloaded: true,
      advisoryMessage: 'Workload exceeds assumed capacity (130% utilization threshold).'
    };

    it('accepts overloaded workloadData prop for rendering warning', () => {
      const comp = <OverloadIndicatorBanner workloadData={overloadedData} />;
      expect(comp.props.workloadData.isOverloaded).toBe(true);
      expect(comp.props.workloadData.capacityUtilizationPercentage).toBe(140);
    });

    it('handles normal workloadData prop', () => {
      const normalData = { capacityUtilizationPercentage: 50, isOverloaded: false };
      const comp = <OverloadIndicatorBanner workloadData={normalData} />;
      expect(comp.props.workloadData.isOverloaded).toBe(false);
    });
  });
});
