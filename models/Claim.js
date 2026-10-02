const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
    food: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodListing',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    deliveryDetails: {
        type: String,
        required: true,
        trim: true
    },
    otp: {
        type: String,
        required: true
    },
    otpVerified: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['claimed', 'completed', 'cancelled'],
        default: 'claimed'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Claim', claimSchema);
