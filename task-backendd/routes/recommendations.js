const express = require('express');
const router = express.Router({ mergeParams: true });
const mongoose = require('mongoose');
const { authorizeProject } = require('../middleware/authorize');
const { generateProjectRecommendations, dismissRecommendation } = require('../services/recommendationService');

// GET /api/projects/:id/recommendations - Get active project recommendations
router.get('/:id/recommendations', authorizeProject('MEMBER'), async (req, res) => {
  try {
    const projectId = req.project._id;
    const recommendations = await generateProjectRecommendations(projectId, req.user.id);

    res.json({
      projectId,
      projectName: req.project.name,
      count: recommendations.length,
      recommendations
    });
  } catch (err) {
    console.error('Failed to fetch project recommendations:', err);
    res.status(500).json({ error: 'Failed to fetch project recommendations' });
  }
});

// POST /api/projects/:id/recommendations/:recommendationId/dismiss - Dismiss a recommendation
router.post('/:id/recommendations/:recommendationId/dismiss', authorizeProject('MEMBER'), async (req, res) => {
  try {
    const projectId = req.project._id;
    const { recommendationId } = req.params;
    const { ruleType: bodyRuleType, entityId: bodyEntityId, targetUserId: bodyTargetUserId } = req.body || {};

    let ruleType = bodyRuleType;
    let entityId = bodyEntityId;
    let targetUserId = bodyTargetUserId;

    // Parse recommendation ID if fields are not explicitly provided in body
    // ID format: rec_{projectId}_{ruleType}_{entityId}
    if (!ruleType && recommendationId && recommendationId.startsWith(`rec_${projectId}_`)) {
      const parts = recommendationId.replace(`rec_${projectId}_`, '').split('_');
      if (parts.length >= 2) {
        ruleType = parts[0];
        entityId = parts.slice(1).join('_');
      }
    }

    if (!ruleType) {
      return res.status(400).json({ error: 'ruleType is required to dismiss recommendation' });
    }

    const dismissal = await dismissRecommendation({
      projectId,
      ruleType,
      entityId: entityId || projectId.toString(),
      targetUserId: targetUserId || null,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Recommendation dismissed successfully',
      dismissal
    });
  } catch (err) {
    console.error('Failed to dismiss recommendation:', err);
    res.status(500).json({ error: 'Failed to dismiss recommendation' });
  }
});

module.exports = router;
