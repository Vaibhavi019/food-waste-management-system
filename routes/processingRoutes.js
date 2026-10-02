const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const FoodListing = require('../models/FoodListing');
const User = require('../models/User');
const { recommendUtilizationPath } = require('../services/processingService');
const matchingService = require('../services/matchingService');
const { calculateLogistics } = require('../services/logisticsService');
const iotService = require('../services/iotService');
const traceabilityService = require('../services/traceabilityService');

// GET /api/processing/recommendation/:foodId
router.get('/recommendation/:foodId', isLoggedIn, async (req, res) => {
    try {
        const food = await FoodListing.findById(req.params.foodId);
        if (!food) {
            return res.status(404).json({ error: 'Food listing not found' });
        }

        // Must be donor or admin to view full processing recs in this prototype
        // Actually, let's just allow the donor who owns it, or admins.
        const u = await User.findById(req.session.userId);
        if (food.donor.toString() !== req.session.userId && u.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const receivers = await User.find({ role: 'receiver' });
        const matches = matchingService.rankRecipients(food.toObject(), receivers);
        const suitableMatches = matches.filter(m => m.matchScore > 0);
        let topMatch = null;
        let logisticsDetails = null;

        if (suitableMatches.length > 0) {
            topMatch = suitableMatches[0];
            logisticsDetails = calculateLogistics(food.toObject(), topMatch);
        }

        const liveTelemetry = iotService.getCurrentTelemetry();

        const recommendation = recommendUtilizationPath(food.toObject(), {
            topMatch,
            logisticsDetails,
            liveTelemetry
        });

        // Optional: Phase 8 Traceability logging
        // We only log if it's an actual recorded action, but here we just return the recommendation.
        // If we wanted to "save" the recommendation, we would log UTILIZATION_PATHWAY_RECOMMENDED.
        // We will log it just once if it hasn't been logged, but the prompt says:
        // "Do not create events simply because a dashboard is viewed."
        // So we just return the result.

        res.json(recommendation);
    } catch (err) {
        console.error('Processing recommendation error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
