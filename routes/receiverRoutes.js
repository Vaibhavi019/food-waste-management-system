const express = require('express');
const router = express.Router();
const { isLoggedIn, isReceiver } = require('../middleware/auth');
const FoodListing = require('../models/FoodListing');
const Claim = require('../models/Claim');
const User = require('../models/User');
const matchingService = require('../services/matchingService');
const { calculateLogistics } = require('../services/logisticsService');
const traceabilityService = require('../services/traceabilityService');

// Old manual routing logic removed; delegated to matchingService

// GET /receiver/dashboard
router.get('/dashboard', isLoggedIn, isReceiver, async (req, res) => {
    try {
        const available = await FoodListing.find({ status: 'available' })
            .populate('donor', 'name phone organization')
            .sort({ expiryTime: 1 })
            .limit(12);

        const receiverDoc = await User.findById(req.session.userId);
        
        const availableFood = available.map(food => {
            const obj = food.toObject();
            const hoursLeft = Math.max(0, (new Date(food.expiryTime).getTime() - Date.now()) / (1000 * 60 * 60));
            obj.hoursLeft = Number(hoursLeft.toFixed(1));
            
            const matchResult = matchingService.scoreSingleMatch(obj, receiverDoc || req.session);
            obj.matchDetails = matchResult;
            obj.matchScore = matchResult.matchScore;
            
            const logisticsResult = calculateLogistics(obj, receiverDoc || req.session);
            obj.logisticsDetails = logisticsResult;
            
            obj.urgency = hoursLeft <= 2 ? 'Critical' : hoursLeft <= 6 ? 'High' : hoursLeft <= 12 ? 'Medium' : 'Low';
            return obj;
        }).sort((a, b) => b.matchScore - a.matchScore);

        const myClaimsRaw = await Claim.find({ receiver: req.session.userId })
            .populate('food')
            .sort({ createdAt: -1 })
            .limit(5);

        const myClaims = await Promise.all(myClaimsRaw.map(async claim => {
            const c = claim.toObject();
            const timeline = await traceabilityService.getClaimTimeline(c._id);
            if (timeline && timeline.length > 0) {
                c.traceability = {
                    events: timeline,
                    eventCount: timeline.length,
                    integrity: traceabilityService.verifyTimelineIntegrity(timeline)
                };
            }
            return c;
        }));

        const totalClaims = await Claim.countDocuments({ receiver: req.session.userId });
        const completedClaims = await Claim.countDocuments({ receiver: req.session.userId, status: 'completed' });

        res.render('receiver/dashboard', {
            availableFood,
            myClaims,
            stats: { totalClaims, completedClaims, prioritizedMatches: availableFood.filter(x => x.matchScore >= 80).length }
        });
    } catch (err) {
        console.error('Receiver dashboard error:', err);
        req.session.error = 'Error loading dashboard.';
        res.redirect('/');
    }
});

// GET /receiver/available-food
router.get('/available-food', isLoggedIn, isReceiver, async (req, res) => {
    try {
        const foods = await FoodListing.find({ status: 'available' })
            .populate('donor', 'name phone organization isVerified')
            .sort({ expiryTime: 1 });

        const receiverDoc = await User.findById(req.session.userId);

        const enrichedFoods = foods.map(food => {
            const obj = food.toObject();
            const hoursLeft = Math.max(0, (new Date(food.expiryTime).getTime() - Date.now()) / (1000 * 60 * 60));
            obj.hoursLeft = Number(hoursLeft.toFixed(1));
            
            const matchResult = matchingService.scoreSingleMatch(obj, receiverDoc || req.session);
            obj.matchDetails = matchResult;
            obj.matchScore = matchResult.matchScore;
            
            const logisticsResult = calculateLogistics(obj, receiverDoc || req.session);
            obj.logisticsDetails = logisticsResult;
            
            obj.urgency = hoursLeft <= 2 ? 'Critical' : hoursLeft <= 6 ? 'High' : hoursLeft <= 12 ? 'Medium' : 'Low';
            return obj;
        }).sort((a, b) => b.matchScore - a.matchScore);

        res.render('receiver/available-food', { foods: enrichedFoods });
    } catch (err) {
        console.error('Available food error:', err);
        req.session.error = 'Error loading food listings.';
        res.redirect('/receiver/dashboard');
    }
});

// GET /receiver/claim/:foodId
router.get('/claim/:foodId', isLoggedIn, isReceiver, async (req, res) => {
    try {
        const food = await FoodListing.findById(req.params.foodId).populate('donor', 'name phone');
        if (!food || food.status !== 'available') {
            req.session.error = 'This food listing is no longer available.';
            return res.redirect('/receiver/available-food');
        }

        res.render('receiver/claim', { food });
    } catch (err) {
        console.error('Claim form error:', err);
        req.session.error = 'Error loading claim form.';
        res.redirect('/receiver/available-food');
    }
});

// POST /receiver/claim/:foodId
router.post('/claim/:foodId', isLoggedIn, isReceiver, async (req, res) => {
    try {
        const { phone, deliveryDetails } = req.body;

        if (!phone || !deliveryDetails) {
            req.session.error = 'Phone number and delivery details are required.';
            return res.redirect(`/receiver/claim/${req.params.foodId}`);
        }

        const food = await FoodListing.findById(req.params.foodId);
        if (!food || food.status !== 'available') {
            req.session.error = 'This food listing is no longer available.';
            return res.redirect('/receiver/available-food');
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const claim = await Claim.create({
            food: food._id,
            receiver: req.session.userId,
            phone,
            deliveryDetails,
            otp
        });

        food.status = 'claimed';
        await food.save();

        // Phase 8: Traceability Logging
        const receiverDoc = await User.findById(req.session.userId);
        const matchResult = matchingService.scoreSingleMatch(food.toObject(), receiverDoc);
        const logisticsResult = calculateLogistics(food.toObject(), receiverDoc);

        await traceabilityService.recordEvent({
            foodListingId: food._id,
            claimId: claim._id,
            eventType: 'RECIPIENT_MATCHED',
            eventLabel: 'Intelligent recipient match confirmed',
            actorUserId: req.session.userId,
            actorRole: 'receiver',
            metadata: { matchScore: matchResult.matchScore, distanceKm: matchResult.distanceKm }
        });

        await traceabilityService.recordEvent({
            foodListingId: food._id,
            claimId: claim._id,
            eventType: 'CLAIM_CREATED',
            eventLabel: 'Food claim created',
            actorUserId: req.session.userId,
            actorRole: 'receiver'
        });

        await traceabilityService.recordEvent({
            foodListingId: food._id,
            claimId: claim._id,
            eventType: 'LOGISTICS_ESTIMATED',
            eventLabel: 'Pickup logistics estimated',
            actorUserId: req.session.userId,
            actorRole: 'receiver',
            metadata: { 
                estimatedTravelMinutes: logisticsResult.estimatedTravelMinutes, 
                feasibility: logisticsResult.feasibility 
            }
        });

        await traceabilityService.recordEvent({
            foodListingId: food._id,
            claimId: claim._id,
            eventType: 'PICKUP_STARTED',
            eventLabel: 'Pickup initiated',
            actorUserId: req.session.userId,
            actorRole: 'receiver'
        });

        req.session.success = `Food claimed successfully! Your OTP is: ${otp}. Show this to the donor at pickup.`;
        res.redirect('/receiver/my-claims');
    } catch (err) {
        console.error('Claim error:', err);
        req.session.error = 'Error claiming food.';
        res.redirect('/receiver/available-food');
    }
});

// GET /receiver/my-claims
router.get('/my-claims', isLoggedIn, isReceiver, async (req, res) => {
    try {
        const claims = await Claim.find({ receiver: req.session.userId })
            .populate('food')
            .sort({ createdAt: -1 });

        res.render('receiver/my-claims', { claims });
    } catch (err) {
        console.error('My claims error:', err);
        req.session.error = 'Error loading claims.';
        res.redirect('/receiver/dashboard');
    }
});

module.exports = router;
