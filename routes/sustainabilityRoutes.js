const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const FoodListing = require('../models/FoodListing');
const TraceabilityEvent = require('../models/TraceabilityEvent');
const { getSustainabilityAnalytics } = require('../services/sustainabilityService');

// GET /api/sustainability/analytics
router.get('/analytics', isLoggedIn, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let query = {};
        if (req.session.role === 'donor') {
            // Donor sees only their own impact
            query.donor = req.session.userId;
        }

        const listings = await FoodListing.find(query).lean();
        const listingIds = listings.map(l => l._id);

        const events = await TraceabilityEvent.find({
            foodListingId: { $in: listingIds }
        }).lean();

        const context = {
            events,
            listings,
            startDate: startDate || null,
            endDate: endDate || null
        };

        const analytics = getSustainabilityAnalytics(context);

        res.json(analytics);
    } catch (err) {
        console.error('Sustainability analytics error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
