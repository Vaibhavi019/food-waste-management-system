const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const FoodListing = require('../models/FoodListing');
const Claim = require('../models/Claim');
const TraceabilityEvent = require('../models/TraceabilityEvent');
const traceabilityService = require('../services/traceabilityService');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sanchari');
        console.log('Connected to MongoDB');

        // Find or create a donor
        let donor = await User.findOne({ role: 'donor' });
        if (!donor) {
            donor = await User.create({
                name: 'Demo Institutional Kitchen',
                username: 'demodonor',
                email: 'donor@sanchari.demo',
                password: 'password123',
                role: 'donor',
                organization: 'Tech Park Kitchens',
                latitude: 12.9716,
                longitude: 77.5946
            });
        }

        // Find or create a receiver
        let receiver = await User.findOne({ role: 'receiver' });
        if (!receiver) {
            receiver = await User.create({
                name: 'Demo Community NGO',
                username: 'demoreceiver',
                email: 'receiver@sanchari.demo',
                password: 'password123',
                role: 'receiver',
                organization: 'Hope Foundation',
                latitude: 12.9720,
                longitude: 77.5950
            });
        }

        // Remove old demo data
        await FoodListing.deleteMany({ itemName: { $regex: /\[DEMO\]/ } });
        
        console.log('Creating demo food listings...');

        const now = Date.now();
        const hourMs = 60 * 60 * 1000;

        // DEMO LISTING 1 - Urgent / Critical
        const listing1 = await FoodListing.create({
            donor: donor._id,
            itemName: '[DEMO] Vegetable Rice',
            category: 'Rice',
            foodType: 'Vegetarian',
            quantity: '80 portions',
            producedQuantity: 200,
            consumedQuantity: 120,
            surplusQuantity: 80,
            unit: 'portions',
            weightKg: 20,
            pickupLocation: 'Main Cafeteria, Tech Park East',
            expiryTime: new Date(now + (2 * hourMs)), // 2 hours
            status: 'available',
            qualityScore: 88,
            qualityStatus: 'Fresh',
            storageTempC: 6,
            humidityPct: 62,
            visualRiskLevel: 'LOW',
            overallRiskLevel: 'LOW'
        });
        await recordDemoTraceability(listing1._id, donor._id, 'donor', 'FOOD_CREATED', 'Food surplus recorded');

        // DEMO LISTING 2 - Medium urgency
        const listing2 = await FoodListing.create({
            donor: donor._id,
            itemName: '[DEMO] Paneer Biryani',
            category: 'Meals',
            foodType: 'Vegetarian',
            quantity: '45 portions',
            producedQuantity: 150,
            consumedQuantity: 105,
            surplusQuantity: 45,
            unit: 'portions',
            weightKg: 11,
            pickupLocation: 'Kitchen 2, Sector B',
            expiryTime: new Date(now + (4 * hourMs)), // 4 hours
            status: 'available',
            qualityScore: 76,
            qualityStatus: 'Monitor',
            storageTempC: 8,
            humidityPct: 68,
            visualRiskLevel: 'MEDIUM',
            overallRiskLevel: 'MEDIUM'
        });
        await recordDemoTraceability(listing2._id, donor._id, 'donor', 'FOOD_CREATED', 'Food surplus recorded');
        await recordDemoTraceability(listing2._id, donor._id, 'donor', 'QUALITY_ASSESSED', 'Quality-risk assessment generated');

        // DEMO LISTING 3 - High quantity, safe
        const listing3 = await FoodListing.create({
            donor: donor._id,
            itemName: '[DEMO] Chapati & Dal',
            category: 'Meals',
            foodType: 'Vegetarian',
            quantity: '120 portions',
            producedQuantity: 300,
            consumedQuantity: 180,
            surplusQuantity: 120,
            unit: 'portions',
            weightKg: 24,
            pickupLocation: 'Central Kitchen Hub',
            expiryTime: new Date(now + (8 * hourMs)), // 8 hours
            status: 'available',
            qualityScore: 94,
            qualityStatus: 'Fresh',
            storageTempC: 4,
            humidityPct: 55,
            visualRiskLevel: 'LOW',
            overallRiskLevel: 'LOW'
        });
        await recordDemoTraceability(listing3._id, donor._id, 'donor', 'FOOD_CREATED', 'Food surplus recorded');

        // DEMO LISTING 4 - Claimed but pending OTP
        const listing4 = await FoodListing.create({
            donor: donor._id,
            itemName: '[DEMO] Mixed Fruit Bowls',
            category: 'Fruits',
            foodType: 'Vegetarian',
            quantity: '30 portions',
            producedQuantity: 100,
            consumedQuantity: 70,
            surplusQuantity: 30,
            unit: 'portions',
            weightKg: 8,
            pickupLocation: 'Salad Bar Annex',
            expiryTime: new Date(now + (3 * hourMs)),
            status: 'claimed',
            qualityScore: 90,
            qualityStatus: 'Fresh'
        });
        await recordDemoTraceability(listing4._id, donor._id, 'donor', 'FOOD_CREATED', 'Food surplus recorded');
        
        const claim4 = await Claim.create({
            food: listing4._id,
            receiver: receiver._id,
            phone: '9876543210',
            deliveryDetails: 'Coming in 30 mins',
            otp: '123456',
            status: 'claimed'
        });
        await recordDemoTraceability(listing4._id, receiver._id, 'receiver', 'CLAIM_CREATED', 'Food claim created', claim4._id);

        console.log('Demo scenario seeded successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
}

async function recordDemoTraceability(foodId, userId, role, type, label, claimId = null) {
    await traceabilityService.recordEvent({
        foodListingId: foodId,
        claimId,
        eventType: type,
        eventLabel: label,
        actorUserId: userId,
        actorRole: role
    });
}

seed();
