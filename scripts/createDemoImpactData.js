require('dotenv').config();
const mongoose = require('mongoose');
const FoodListing = require('../models/FoodListing');
const Claim = require('../models/Claim');
const User = require('../models/User');
const traceabilityService = require('../services/traceabilityService');

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const donor = await User.findOne({ username: 'lucky@123' }) || await User.findOne({ email: 'lucky@123' }) || await User.findOne({ role: 'donor' });
        if (!donor) throw new Error('Could not find Lucky donor account');

        let receiver = await User.findOne({ role: 'receiver' });
        if (!receiver) {
            receiver = await User.create({
                name: 'Demo Receiver',
                username: 'demoreceiver',
                password: 'password123',
                email: 'demo@receiver.com',
                phone: '0987654321',
                role: 'receiver'
            });
            console.log('Created demo receiver');
        }

        const listing = await FoodListing.create({
            donor: donor._id,
            itemName: '[DEMO TEST] Environmental Test Biryani',
            category: 'Prepared Food',
            foodType: 'Vegetarian',
            quantity: '50',
            unit: 'portions',
            weightKg: 12.5,
            producedQuantity: 200,
            consumedQuantity: 150,
            surplusQuantity: 50,
            expiryTime: new Date(Date.now() + 86400000), // + 1 day
            pickupLocation: 'Demo Kitchen',
            status: 'completed'
        });
        console.log(`Created FoodListing ${listing._id}`);

        await traceabilityService.recordEvent({
            foodListingId: listing._id,
            eventType: 'FOOD_CREATED',
            eventLabel: 'Food surplus recorded',
            actorUserId: donor._id,
            actorRole: 'donor',
            metadata: {
                category: listing.category,
                quantity: listing.quantity,
                expiryTime: listing.expiryTime
            }
        });

        const claim = await Claim.create({
            food: listing._id,
            receiver: receiver._id,
            phone: '1234567890',
            deliveryDetails: 'Demo Pickup',
            otp: '123456',
            otpVerified: true,
            status: 'completed'
        });
        console.log(`Created Claim ${claim._id}`);

        await traceabilityService.recordEvent({
            foodListingId: listing._id,
            claimId: claim._id,
            eventType: 'OTP_VERIFIED',
            eventLabel: 'OTP successfully verified',
            actorUserId: donor._id,
            actorRole: 'donor'
        });

        await traceabilityService.recordEvent({
            foodListingId: listing._id,
            claimId: claim._id,
            eventType: 'HANDOVER_COMPLETED',
            eventLabel: 'Food handover completed successfully',
            actorUserId: donor._id,
            actorRole: 'donor'
        });

        console.log('Successfully created demo data for Lucky!');
    } catch (err) {
        console.error('Error:', err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}
run();
