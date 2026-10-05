const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const FoodListing = require('../models/FoodListing');
const Claim = require('../models/Claim');
const TraceabilityEvent = require('../models/TraceabilityEvent');

async function removeDemo() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sanchari');
        console.log('Connected to MongoDB');

        const demoFoods = await FoodListing.find({ itemName: { $regex: /\[DEMO\]/ } });
        const demoFoodIds = demoFoods.map(f => f._id);

        console.log(`Found ${demoFoodIds.length} demo listings. Removing associated claims and traceability events...`);

        await Claim.deleteMany({ food: { $in: demoFoodIds } });
        await TraceabilityEvent.deleteMany({ foodListingId: { $in: demoFoodIds } });
        await FoodListing.deleteMany({ _id: { $in: demoFoodIds } });

        console.log('Demo scenario removed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Removal error:', err);
        process.exit(1);
    }
}

removeDemo();
