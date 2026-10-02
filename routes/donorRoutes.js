const express = require('express');
const router = express.Router();
const { isLoggedIn, isDonor } = require('../middleware/auth');
const upload = require('../middleware/upload');
const visionService = require('../services/visionService');
const iotService = require('../services/iotService');
const fs = require('fs');
const FoodListing = require('../models/FoodListing');
const Claim = require('../models/Claim');
const User = require('../models/User');
const matchingService = require('../services/matchingService');
const { calculateLogistics } = require('../services/logisticsService');
const { generateForecast } = require('../services/aiForecastingService');
const traceabilityService = require('../services/traceabilityService');
const { recommendUtilizationPath } = require('../services/processingService');
const iotService = require('../services/iotService');
const TraceabilityEvent = require('../models/TraceabilityEvent');
const { getSustainabilityAnalytics } = require('../services/sustainabilityService');

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function getQualityAssessment({ expiryTime, storageTempC, humidityPct }) {
    const now = Date.now();
    const expiry = new Date(expiryTime).getTime();
    const hoursLeft = Math.max(0, (expiry - now) / (1000 * 60 * 60));

    let score = 92;

    // Demo screening heuristic: combine time remaining with basic storage telemetry.
    if (hoursLeft < 2) score -= 35;
    else if (hoursLeft < 4) score -= 20;
    else if (hoursLeft < 8) score -= 8;

    if (storageTempC !== null && storageTempC !== undefined && storageTempC !== '') {
        const t = Number(storageTempC);
        if (t > 8) score -= Math.min(25, (t - 8) * 4);
        if (t < 0) score -= 10;
    }

    if (humidityPct !== null && humidityPct !== undefined && humidityPct !== '') {
        const h = Number(humidityPct);
        if (h > 85) score -= 8;
    }

    score = Math.max(35, Math.min(99, Math.round(score)));

    let status = 'Fresh';
    if (score < 60) status = 'High Risk';
    else if (score < 78) status = 'Monitor';

    return { score, status, hoursLeft: Number(hoursLeft.toFixed(1)) };
}





// GET /donor/dashboard
router.get('/dashboard', isLoggedIn, isDonor, async (req, res) => {
    try {
        const listings = await FoodListing.find({ donor: req.session.userId })
            .sort({ createdAt: -1 })
            .limit(8);

        const allListings = await FoodListing.find({ donor: req.session.userId })
            .sort({ createdAt: -1 });

        const foodIds = listings.map(l => l._id);
        const activeClaims = await Claim.find({
            food: { $in: foodIds },
            status: 'claimed'
        }).populate('food').populate('receiver', 'name username organization');

        const totalListings = await FoodListing.countDocuments({ donor: req.session.userId });
        const completedDonations = await FoodListing.countDocuments({ donor: req.session.userId, status: 'completed' });
        const activeListings = await FoodListing.countDocuments({ donor: req.session.userId, status: 'available' });

        const structured = allListings.filter(x => toNumber(x.producedQuantity) > 0);
        const totalProduced = structured.reduce((s, x) => s + toNumber(x.producedQuantity), 0);
        const totalSurplus = structured.reduce((s, x) => s + Math.max(0, toNumber(x.surplusQuantity)), 0);
        const wasteRate = totalProduced ? Math.round((totalSurplus / totalProduced) * 100) : 0;

        const receivers = await User.find({ role: 'receiver' });
        const enrichedListings = await Promise.all(listings.map(async food => {
            const f = food.toObject();
            if (f.status === 'available') {
                const matches = matchingService.rankRecipients(f, receivers);
                const suitableMatches = matches.filter(m => m.matchScore > 0);
                f.matchCount = suitableMatches.length;
                if (suitableMatches.length > 0) {
                    f.topMatch = suitableMatches[0];
                    f.logisticsDetails = calculateLogistics(f, f.topMatch);
                } else {
                    f.topMatch = null;
                }
            }
            
            // Phase 9: Food Processing Intelligence
            const liveTelemetry = iotService.getCurrentTelemetry();
            f.processingInfo = recommendUtilizationPath(f, {
                topMatch: f.topMatch,
                logisticsDetails: f.logisticsDetails,
                liveTelemetry
            });
            
            // Phase 8: Traceability Fetching
            const timeline = await traceabilityService.getFoodTimeline(f._id);
            if (timeline && timeline.length > 0) {
                f.traceability = {
                    events: timeline,
                    eventCount: timeline.length,
                    integrity: traceabilityService.verifyTimelineIntegrity(timeline)
                };
            }
            return f;
        }));

        const allFoodIds = allListings.map(l => l._id);
        const donorEvents = await TraceabilityEvent.find({ foodListingId: { $in: allFoodIds } }).lean();
        const sustainabilityImpact = getSustainabilityAnalytics({
            events: donorEvents,
            listings: allListings
        });

        res.render('donor/dashboard', {
            listings: enrichedListings,
            activeClaims,
            stats: {
                totalListings,
                completedDonations,
                activeListings,
                wasteRate,
                totalProduced,
                totalSurplus
            },
            aiData: generateForecast(allListings),
            impact: sustainabilityImpact
        });
    } catch (err) {
        console.error('Donor dashboard error:', err);
        req.session.error = 'Error loading dashboard.';
        res.redirect('/');
    }
});

// GET /donor/intelligence
router.get('/intelligence', isLoggedIn, isDonor, async (req, res) => {
    try {
        const listings = await FoodListing.find({ donor: req.session.userId }).sort({ createdAt: -1 });
        const now = Date.now();

        const enriched = listings.slice(0, 10).map(item => {
            const assessment = getQualityAssessment(item);
            const hoursLeft = Math.max(0, (new Date(item.expiryTime).getTime() - now) / (1000 * 60 * 60));
            const urgency = hoursLeft <= 2 ? 'Critical' : hoursLeft <= 6 ? 'High' : hoursLeft <= 12 ? 'Medium' : 'Low';
            const surplus = toNumber(item.surplusQuantity || item.producedQuantity - item.consumedQuantity);
            const risk = Math.min(99, Math.max(5, Math.round(
                (hoursLeft <= 4 ? 65 : 20) +
                (assessment.status === 'High Risk' ? 25 : assessment.status === 'Monitor' ? 10 : 0) +
                (surplus > 100 ? 10 : 0)
            )));
            return {
                ...item.toObject(),
                assessment,
                urgency,
                wasteRisk: risk
            };
        });

        const aiData = generateForecast(listings);
        const impact = getImpact(listings);

        res.render('donor/intelligence', {
            aiData,
            impact,
            listings: enriched,
            generatedAt: new Date()
        });
    } catch (err) {
        console.error('Intelligence dashboard error:', err);
        req.session.error = 'Error loading AI intelligence.';
        res.redirect('/donor/dashboard');
    }
});

// GET /donor/add-food
router.get('/add-food', isLoggedIn, isDonor, (req, res) => {
    res.render('donor/add-food');
});

// POST /donor/add-food
router.post('/add-food', isLoggedIn, isDonor, upload.single('foodImage'), async (req, res) => {
    try {
        const {
            itemName,
            category,
            foodType,
            quantity,
            producedQuantity,
            consumedQuantity,
            unit,
            pickupLocation,
            latitude,
            longitude,
            storageTempC,
            humidityPct,
            expiryTime,
            pickupWindowMinutes
        } = req.body;

        if (!itemName || !quantity || !pickupLocation || !expiryTime) {
            req.session.error = 'Food name, surplus quantity, location and safe-until time are required.';
            return res.redirect('/donor/add-food');
        }

        const expiryDate = new Date(expiryTime);
        if (Number.isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
            req.session.error = 'Expiry time must be valid and in the future.';
            return res.redirect('/donor/add-food');
        }

        const produced = toNumber(producedQuantity, toNumber(quantity));
        const consumed = toNumber(consumedQuantity, Math.max(0, produced - toNumber(quantity)));
        const surplus = Math.max(0, produced - consumed);
        const assessment = getQualityAssessment({ expiryTime: expiryDate, storageTempC, humidityPct });

        // Phase 5: CV & Risk Fusion
        let imagePath = null;
        let cvResult = null;
        let fusionResult = null;

        if (req.file) {
            // Verify magic bytes (file signature) to prevent malicious executable execution masquerading as images
            const buffer = Buffer.alloc(4);
            const fd = fs.openSync(req.file.path, 'r');
            fs.readSync(fd, buffer, 0, 4, 0);
            fs.closeSync(fd);
            
            const hex = buffer.toString('hex');
            const isJPEG = hex.startsWith('ffd8');
            const isPNG = hex === '89504e47';
            const isWebP = hex === '52494646'; // "RIFF" header for WebP
            
            if (!isJPEG && !isPNG && !isWebP) {
                fs.unlinkSync(req.file.path);
                req.session.error = 'Security check failed: Uploaded file does not possess a valid image signature.';
                return res.redirect('/donor/add-food');
            }

            imagePath = `/uploads/${req.file.filename}`;
            cvResult = visionService.assessFoodImage(imagePath);
            
            // Fetch live IoT storage state (fallback to provided manual telemetry)
            const liveTelemetry = iotService.getCurrentTelemetry();
            const storageRisk = iotService.evaluateTelemetryRisk(liveTelemetry || {
                temperature: toNumber(storageTempC, 5),
                humidity: toNumber(humidityPct, 50),
                machineStatus: 'ONLINE'
            });

            fusionResult = visionService.calculateOverallRisk(cvResult, storageRisk, expiryDate);
        }

        const newFood = await FoodListing.create({
            donor: req.session.userId,
            itemName,
            category: category || 'Prepared Food',
            foodType: foodType || 'Unknown',
            quantity,
            producedQuantity: produced,
            consumedQuantity: consumed,
            surplusQuantity: surplus,
            unit: unit || 'portions',
            pickupLocation,
            latitude: latitude ? toNumber(latitude, null) : null,
            longitude: longitude ? toNumber(longitude, null) : null,
            storageTempC: storageTempC === '' ? null : toNumber(storageTempC, null),
            humidityPct: humidityPct === '' ? null : toNumber(humidityPct, null),
            qualityScore: assessment.score,
            qualityStatus: assessment.status,
            expiryTime: expiryDate,
            pickupWindowMinutes: toNumber(pickupWindowMinutes, 120),
            
            imagePath: imagePath,
            visualRiskScore: cvResult ? cvResult.visualRiskScore : null,
            visualRiskLevel: cvResult ? cvResult.riskLevel : 'UNKNOWN',
            visualIndicators: cvResult ? cvResult.visualIndicators : [],
            visualAssessmentConfidence: cvResult ? cvResult.confidence : null,
            overallRiskScore: fusionResult ? fusionResult.overallRiskScore : null,
            overallRiskLevel: fusionResult ? fusionResult.overallRiskLevel : 'UNKNOWN',
            riskFactors: fusionResult ? fusionResult.riskFactors : [],
            recommendedAction: fusionResult ? fusionResult.recommendedAction : null,
            humanVerificationRequired: fusionResult ? fusionResult.humanVerificationRequired : true,
            qualityAssessedAt: cvResult ? new Date() : null
        });

        // Phase 8: Traceability Logging
        await traceabilityService.recordEvent({
            foodListingId: newFood._id,
            eventType: 'FOOD_CREATED',
            eventLabel: 'Food surplus recorded',
            actorUserId: req.session.userId,
            actorRole: 'donor',
            metadata: { category: newFood.category, quantity: newFood.quantity, expiryTime: newFood.expiryTime }
        });

        if (cvResult || fusionResult) {
            await traceabilityService.recordEvent({
                foodListingId: newFood._id,
                eventType: 'QUALITY_ASSESSED',
                eventLabel: 'Quality-risk assessment generated',
                actorUserId: req.session.userId,
                actorRole: 'donor',
                metadata: {
                    overallRiskLevel: newFood.overallRiskLevel,
                    humanVerificationRequired: newFood.humanVerificationRequired
                }
            });
        }

        req.session.success = `Food registered. AI quality score: ${assessment.score}/100 • ${assessment.status}.`;
        res.redirect('/donor/intelligence');
    } catch (err) {
        console.error('Add food error:', err);
        req.session.error = 'Error adding food listing.';
        res.redirect('/donor/add-food');
    }
});

// GET /donor/history
router.get('/history', isLoggedIn, isDonor, async (req, res) => {
    try {
        const listings = await FoodListing.find({ donor: req.session.userId })
            .sort({ createdAt: -1 });

        res.render('donor/history', { listings });
    } catch (err) {
        console.error('History error:', err);
        req.session.error = 'Error loading history.';
        res.redirect('/donor/dashboard');
    }
});

// POST /donor/verify-otp
router.post('/verify-otp', isLoggedIn, isDonor, async (req, res) => {
    try {
        const { claimId, otp } = req.body;

        if (!claimId || !otp) {
            req.session.error = 'Claim ID and OTP are required.';
            return res.redirect('/donor/dashboard');
        }

        const claim = await Claim.findById(claimId).populate('food');
        if (!claim) {
            req.session.error = 'Claim not found.';
            return res.redirect('/donor/dashboard');
        }

        if (claim.food.donor.toString() !== req.session.userId) {
            req.session.error = 'Unauthorized action.';
            return res.redirect('/donor/dashboard');
        }

        if (claim.otp !== otp) {
            req.session.error = 'Invalid OTP. Please try again.';
            return res.redirect('/donor/dashboard');
        }

        claim.otpVerified = true;
        claim.status = 'completed';
        await claim.save();

        await FoodListing.findByIdAndUpdate(claim.food._id, { status: 'completed' });

        // Phase 8: Traceability Logging
        await traceabilityService.recordEvent({
            foodListingId: claim.food._id,
            claimId: claim._id,
            eventType: 'OTP_VERIFIED',
            eventLabel: 'OTP successfully verified',
            actorUserId: req.session.userId,
            actorRole: 'donor'
        });

        await traceabilityService.recordEvent({
            foodListingId: claim.food._id,
            claimId: claim._id,
            eventType: 'HANDOVER_COMPLETED',
            eventLabel: 'Food handover completed successfully',
            actorUserId: req.session.userId,
            actorRole: 'donor'
        });

        req.session.success = 'OTP verified! Food handover completed and impact metrics updated.';
        res.redirect('/donor/dashboard');
    } catch (err) {
        console.error('OTP verification error:', err);
        req.session.error = 'Error verifying OTP.';
        res.redirect('/donor/dashboard');
    }
});

module.exports = router;
