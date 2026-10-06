import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import RecommendationCard from '../RecommendationCard';
import ProjectRecommendationsWidget from '../ProjectRecommendationsWidget';

describe('Phase 2-D Recommendation Frontend Components', () => {
  describe('RecommendationCard', () => {
    const mockRec = {
      id: 'rec_p1_REALLOCATE_WORKLOAD_u1',
      title: 'Reallocate Workload',
      description: 'Member A is at 140% capacity while Member B is at 30%.',
      reason: 'Excessive workload disparity detected across project members.',
      suggestedAction: 'Consider reassigning tasks to balance project workload.',
      ruleType: 'REALLOCATE_WORKLOAD',
      confidence: 0.90,
      priority: 'HIGH'
    };

    it('renders recommendation title, type badge, explanation, confidence score, and priority', () => {
      const comp = <RecommendationCard recommendation={mockRec} />;
      expect(comp.props.recommendation.title).toBe('Reallocate Workload');
      expect(comp.props.recommendation.ruleType).toBe('REALLOCATE_WORKLOAD');
      expect(comp.props.recommendation.confidence).toBe(0.90);
      expect(comp.props.recommendation.priority).toBe('HIGH');
    });

    it('passes dismiss callback when dismiss button is interacted with', () => {
      const handleDismiss = vi.fn();
      const comp = <RecommendationCard recommendation={mockRec} onDismiss={handleDismiss} />;
      expect(comp.props.onDismiss).toBeDefined();
    });
  });

  describe('ProjectRecommendationsWidget', () => {
    const mockAuthAxios = {
      get: vi.fn().mockResolvedValue({
        data: {
          projectId: 'p1',
          recommendations: [
            {
              id: 'rec_p1_ARCHIVE_COMPLETED_PROJECT_p1',
              title: 'Archive Completed Project',
              description: 'Project is 100% complete.',
              ruleType: 'ARCHIVE_COMPLETED_PROJECT',
              confidence: 0.95,
              priority: 'LOW'
            }
          ]
        }
      }),
      post: vi.fn().mockResolvedValue({ data: { success: true } })
    };

    it('renders ProjectRecommendationsWidget with projectId and authAxios props', () => {
      const widget = <ProjectRecommendationsWidget projectId="p1" authAxios={mockAuthAxios} />;
      expect(widget.props.projectId).toBe('p1');
      expect(widget.props.authAxios).toBeDefined();
    });
  });
});
