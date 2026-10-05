require('dotenv').config();
const mongoose = require('mongoose');
const FoodListing = require('../models/FoodListing');
const Claim = require('../models/Claim');
const TraceabilityEvent = require('../models/TraceabilityEvent');

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const listings = await FoodListing.find({ itemName: { $in: ['[DEMO TEST] Demo Biryani', '[DEMO TEST] Environmental Test Biryani'] } });
        const listingIds = listings.map(l => l._id);

        if (listingIds.length === 0) {
            console.log('No demo data found to remove.');
            return;
        }

        const eventsResult = await TraceabilityEvent.deleteMany({ foodListingId: { $in: listingIds } });
        console.log(`Deleted ${eventsResult.deletedCount} traceability events.`);

        const claimsResult = await Claim.deleteMany({ food: { $in: listingIds } });
        console.log(`Deleted ${claimsResult.deletedCount} claims.`);

        const listingsResult = await FoodListing.deleteMany({ _id: { $in: listingIds } });
        console.log(`Deleted ${listingsResult.deletedCount} food listings.`);

        console.log('Successfully removed demo data!');
    } catch (err) {
        console.error('Error:', err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}
run();
